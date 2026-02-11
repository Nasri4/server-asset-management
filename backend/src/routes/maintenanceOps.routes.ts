import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../utils/asyncHandler";
import { requirePermission } from "../middleware/permissions";
import { validateBody } from "../middleware/validate";
import { HttpError } from "../middleware/error";
import { created, ok } from "../utils/response";
import { audit } from "../utils/audit";
import { query, queryTx, withTransaction } from "../db/sql";
import { sendSmsPlaceholder } from "../utils/sms";
import { recalculateServerStatus } from "../utils/serverStatus";

export const maintenanceOpsRouter = Router();

type Frequency = "Daily" | "Weekly" | "Monthly";
type RunStatus = "Active" | "Incomplete" | "Overdue" | "Complete";

function addFrequency(dateYmd: string, frequency: Frequency) {
	const d = new Date(`${dateYmd}T00:00:00`);
	if (Number.isNaN(d.getTime())) return dateYmd;
	if (frequency === "Daily") d.setDate(d.getDate() + 1);
	else if (frequency === "Weekly") d.setDate(d.getDate() + 7);
	else d.setMonth(d.getMonth() + 1);

	const yyyy = d.getFullYear();
	const mm = String(d.getMonth() + 1).padStart(2, "0");
	const dd = String(d.getDate()).padStart(2, "0");
	return `${yyyy}-${mm}-${dd}`;
}

function toDateOnly(value: string) {
	// SQL Server DATE accepts YYYY-MM-DD.
	const m = String(value ?? "").trim().match(/\d{4}-\d{2}-\d{2}/);
	if (!m) throw new HttpError(400, "Invalid date (expected YYYY-MM-DD)", "INVALID_DATE");
	return m[0];
}

async function requireRunAccess(runId: number, actorEmail: string, allowManageBypass: boolean) {
	// If user has maintenance.manage (or Admin via requirePermission), allow.
	if (allowManageBypass) return;

	const email = String(actorEmail ?? "").trim().toLowerCase();
	if (!email) throw new HttpError(403, "Permission denied", "PERMISSION_DENIED");

	const rows = await query<{ engineer_id: number }>(
		`
		SELECT TOP 1 e.engineer_id
		FROM dbo.maintenance_run_engineers re
		JOIN dbo.engineers e ON e.engineer_id = re.engineer_id
		WHERE re.run_id = @run_id
			AND LOWER(LTRIM(RTRIM(ISNULL(e.email, '')))) = @email
		`,
		(r) => {
			r.input("run_id", runId);
			r.input("email", email);
		}
	);

	if (!rows[0]) throw new HttpError(403, "Not assigned to this maintenance run", "NOT_ASSIGNED");
}

async function getServerTeamId(serverId: number): Promise<number | null> {
	const rows = await query<{ team_id: number | null }>(
		`SELECT TOP 1 team_id FROM dbo.servers WHERE server_id = @id`,
		(r) => r.input("id", serverId)
	);
	return rows?.[0]?.team_id ?? null;
}

async function validateEngineersMatchTeam(engineerIds: number[], teamId: number | null) {
	if (!teamId) return;
	if (!engineerIds.length) return;

	const bad = await query<{ engineer_id: number }>(
		`
		SELECT e.engineer_id
		FROM dbo.engineers e
		WHERE e.engineer_id IN (${engineerIds.map((_, i) => `@e${i}`).join(", ")})
			AND (e.team_id IS NULL OR e.team_id <> @team_id)
		`,
		(r) => {
			r.input("team_id", teamId);
			engineerIds.forEach((id, i) => r.input(`e${i}`, id));
		}
	);

	if (bad.length > 0) {
		throw new HttpError(400, "One or more engineers are not in the server team", "ENGINEER_TEAM_MISMATCH");
	}
}

function normalizeEngineerIds(ids: unknown): number[] {
	const arr = Array.isArray(ids) ? ids : [];
	const cleaned = arr
		.map((x) => Number(x))
		.filter((n) => Number.isFinite(n) && n > 0);
	return Array.from(new Set(cleaned));
}

function buildRunCreatedMessage(summary: {
	server_id: number;
	server_code: string | null;
	hostname: string | null;
	type_name: string;
	frequency: Frequency;
	due_date: string;
}) {
	const serverLabel = [summary.server_code, summary.hostname]
		.filter(Boolean)
		.join(" ")
		.trim() || `Server #${summary.server_id}`;

	return [
		"SAM Maintenance Run Created",
		serverLabel,
		`Type: ${summary.type_name}`,
		`Frequency: ${summary.frequency}`,
		`Due: ${summary.due_date}`,
	].join(" | ");
}

async function requireMultiMaintenanceSchema() {
	const rows = await query<{
		schedule_types_object_id: number | null;
		checklist_schedule_id_len: number | null;
		checklist_is_custom_len: number | null;
	}>(
		`
		SELECT
			OBJECT_ID('dbo.maintenance_schedule_types') AS schedule_types_object_id,
			COL_LENGTH('dbo.maintenance_type_checklist_items', 'schedule_id') AS checklist_schedule_id_len,
			COL_LENGTH('dbo.maintenance_type_checklist_items', 'is_custom') AS checklist_is_custom_len
		`
	);
	const r = rows?.[0];
	const missing: string[] = [];
	if (!r?.schedule_types_object_id) missing.push("dbo.maintenance_schedule_types");
	if (r?.checklist_schedule_id_len == null) missing.push("dbo.maintenance_type_checklist_items.schedule_id");
	if (r?.checklist_is_custom_len == null) missing.push("dbo.maintenance_type_checklist_items.is_custom");

	if (missing.length) {
		throw new HttpError(
			500,
			"Database schema is out of date for maintenance operations. Apply migration: backend/sql/migrations/2026-02-02_multi-maintenance-types-and-custom-checklists.sql",
			"MIGRATION_REQUIRED",
			{ missing }
		);
	}
}

async function sendRunSmsToAssigned(params: { runId: number; actor: string; mode: "AUTO" | "MANUAL" }) {
	const summaryRows = await query<{
		run_id: number;
		schedule_id: number;
		due_date: string;
		frequency: Frequency;
		server_id: number;
		server_code: string | null;
		hostname: string | null;
		type_name: string;
	}>(
		`
		SELECT TOP 1
			r.run_id,
			r.schedule_id,
			CONVERT(varchar(10), r.due_date, 23) AS due_date,
			s.frequency,
			s.server_id,
			sv.server_code,
			sv.hostname,
			mt.name AS type_name
		FROM dbo.maintenance_runs r
		JOIN dbo.maintenance_schedules s ON s.schedule_id = r.schedule_id
		JOIN dbo.servers sv ON sv.server_id = s.server_id
		JOIN dbo.maintenance_types mt ON mt.maintenance_type_id = s.maintenance_type_id
		WHERE r.run_id = @run_id
		`,
		(q) => q.input("run_id", params.runId)
	);

	const summary = summaryRows[0];
	if (!summary) return { sent: 0, skipped: 0 };

	const recipients = await query<{ engineer_id: number; full_name: string; phone: string | null }>(
		`
		SELECT e.engineer_id, e.full_name, e.phone
		FROM dbo.maintenance_run_engineers re
		JOIN dbo.engineers e ON e.engineer_id = re.engineer_id
		WHERE re.run_id = @run_id
		ORDER BY e.full_name ASC
		`,
		(q) => q.input("run_id", params.runId)
	);

	const baseMessage = buildRunCreatedMessage(summary);
	let sent = 0;
	let skipped = 0;

	for (const r of recipients) {
		const phone = (r.phone ?? "").trim();
		if (!phone) {
			skipped += 1;
			continue;
		}

		let message = baseMessage;
		try {
			const taskRows = await query<{ label: string }>(
				`
				SELECT p.label
				FROM dbo.maintenance_run_checklist_assignments a
				JOIN dbo.maintenance_run_checklist_progress p
					ON p.run_id = a.run_id AND p.checklist_item_id = a.checklist_item_id
				WHERE a.run_id = @run_id AND a.engineer_id = @engineer_id
				ORDER BY a.checklist_item_id ASC
				`,
				(q) => {
					q.input("run_id", params.runId);
					q.input("engineer_id", r.engineer_id);
				}
			);
			const tasks = taskRows.map((x) => String(x.label ?? "").trim()).filter(Boolean);
			if (tasks.length > 0) {
				const max = 5;
				const shown = tasks.slice(0, max);
				const extra = tasks.length > max ? ` (+${tasks.length - max} more)` : "";
				message = `${baseMessage} | Your Tasks: ${shown.join("; ")}${extra}`;
			}
		} catch {
			// If assignments table isn't present yet, keep generic message.
		}

		try {
			await sendSmsPlaceholder({
				to: phone,
				message,
				kind: params.mode === "AUTO" ? "maintenance_run_created_auto" : "maintenance_run_created_manual",
				actor: params.actor,
				entity: "maintenance_runs",
				entityId: params.runId,
				details: {
					run_id: params.runId,
					schedule_id: summary.schedule_id,
					engineer_id: r.engineer_id,
				},
			});
			sent += 1;
		} catch (e) {
			console.warn(`[maintenance-ops] SMS failed engineer_id=${r.engineer_id}:`, e);
		}
	}

	await audit({
		actor: params.actor,
		action: params.mode === "AUTO" ? "SMS_SENT" : "SMS_SENT_MANUAL",
		entity: "maintenance_runs",
		entityId: params.runId,
		details: {
			run_id: params.runId,
			schedule_id: summary.schedule_id,
			recipients: recipients.map((x) => ({ engineer_id: x.engineer_id, phone: x.phone })),
			sent,
			skipped,
		},
	});

	return { sent, skipped };
}

async function getEngineerIdByEmail(email: string): Promise<number | null> {
	const e = String(email ?? "").trim().toLowerCase();
	if (!e) return null;
	const rows = await query<{ engineer_id: number }>(
		`SELECT TOP 1 engineer_id FROM dbo.engineers WHERE LOWER(LTRIM(RTRIM(ISNULL(email, '')))) = @email`,
		(r) => r.input("email", e)
	);
	return rows?.[0]?.engineer_id ?? null;
}

async function assignChecklistToEngineersTx(tx: any, runId: number) {
	// Assign each checklist item to one engineer (round-robin).
	// If schema isn't present yet, silently skip.
	try {
		const engineers = await queryTx<{ engineer_id: number }>(
			tx,
			`SELECT engineer_id FROM dbo.maintenance_run_engineers WHERE run_id=@run_id ORDER BY engineer_id ASC`,
			(r) => r.input("run_id", runId)
		);
		const items = await queryTx<{ checklist_item_id: number }>(
			tx,
			`SELECT checklist_item_id FROM dbo.maintenance_run_checklist_progress WHERE run_id=@run_id ORDER BY checklist_item_id ASC`,
			(r) => r.input("run_id", runId)
		);
		if (!engineers.length || !items.length) return;

		await queryTx(tx, `DELETE FROM dbo.maintenance_run_checklist_assignments WHERE run_id=@run_id`, (r: any) => r.input("run_id", runId));
		for (let i = 0; i < items.length; i++) {
			const engineerId = engineers[i % engineers.length].engineer_id;
			await queryTx(
				tx,
				`INSERT INTO dbo.maintenance_run_checklist_assignments(run_id, checklist_item_id, engineer_id) VALUES(@run_id, @checklist_item_id, @engineer_id)`,
				(r: any) => {
					r.input("run_id", runId);
					r.input("checklist_item_id", items[i].checklist_item_id);
					r.input("engineer_id", engineerId);
				}
			);
		}
	} catch {
		// no-op
	}
}

/* =====================================================
	 Maintenance Types (Admin-managed)
===================================================== */

maintenanceOpsRouter.get(
	"/types",
	requirePermission("maintenance.read"),
	asyncHandler(async (_req, res) => {
		await requireMultiMaintenanceSchema();
		const rows = await query(
			`
			SELECT
				mt.maintenance_type_id,
				mt.name,
				mt.description,
				mt.is_active,
				mt.created_at,
				mt.updated_at,
				(
					SELECT COUNT(1)
					FROM dbo.maintenance_type_checklist_items ci
					WHERE ci.maintenance_type_id = mt.maintenance_type_id
						AND ci.is_active = 1
						AND ci.schedule_id IS NULL
				) AS checklist_count
			FROM dbo.maintenance_types mt
			ORDER BY mt.name ASC
			`
		);
		return ok(res, rows);
	})
);

maintenanceOpsRouter.get(
	"/types/:id",
	requirePermission("maintenance.read"),
	asyncHandler(async (req, res) => {
		await requireMultiMaintenanceSchema();
		const id = Number(req.params.id);

		const typeRows = await query(
			`
			SELECT TOP 1
				maintenance_type_id,
				name,
				description,
				is_active,
				created_at,
				updated_at
			FROM dbo.maintenance_types
			WHERE maintenance_type_id = @id
			`,
			(r) => r.input("id", id)
		);
		const type = typeRows[0] ?? null;
		if (!type) throw new HttpError(404, "Maintenance type not found", "NOT_FOUND");

		const items = await query(
			`
			SELECT
				checklist_item_id,
				maintenance_type_id,
				label,
				sort_order
			FROM dbo.maintenance_type_checklist_items
			WHERE maintenance_type_id = @id
				AND is_active = 1
				AND schedule_id IS NULL
			ORDER BY sort_order ASC, checklist_item_id ASC
			`,
			(r) => r.input("id", id)
		);

		return ok(res, { type, checklist_items: items });
	})
);

const checklistItemInput = z.object({
	label: z.string().trim().min(1),
	sort_order: z.number().int().min(1),
	is_active: z.boolean().optional(),
});

const createTypeSchema = z.object({
	name: z.string().trim().min(1),
	description: z.string().trim().max(500).nullable().optional(),
	is_active: z.boolean().optional(),
	checklist_items: z.array(checklistItemInput).optional(),
});

maintenanceOpsRouter.post(
	"/types",
	requirePermission("maintenance.manage"),
	validateBody(createTypeSchema),
	asyncHandler(async (req, res) => {
		const body = req.body as z.infer<typeof createTypeSchema>;

		const result = await withTransaction(async (tx) => {
			const inserted = await queryTx<{ maintenance_type_id: number }>(
				tx,
				`
				INSERT INTO dbo.maintenance_types(name, description, is_active, created_at, updated_at)
				OUTPUT INSERTED.maintenance_type_id
				VALUES(@name, @description, @is_active, GETDATE(), GETDATE())
				`,
				(r) => {
					r.input("name", body.name);
					r.input("description", body.description ?? null);
					r.input("is_active", body.is_active ?? true);
				}
			);

			const id = inserted?.[0]?.maintenance_type_id;
			if (!id) throw new HttpError(500, "Failed to create maintenance type", "CREATE_FAILED");

			const items = (body.checklist_items ?? [])
				.map((i) => ({ ...i, label: i.label.trim() }))
				.filter((i) => i.label);

			for (const item of items) {
				await queryTx(
					tx,
					`
					INSERT INTO dbo.maintenance_type_checklist_items(maintenance_type_id, label, sort_order, is_active, created_at, updated_at)
					VALUES(@maintenance_type_id, @label, @sort_order, @is_active, GETDATE(), GETDATE())
					`,
					(r) => {
						r.input("maintenance_type_id", id);
						r.input("label", item.label);
						r.input("sort_order", item.sort_order);
						r.input("is_active", item.is_active ?? true);
					}
				);
			}

			return { maintenance_type_id: id };
		});

		await audit({
			actor: req.user!.username,
			action: "CREATE",
			entity: "maintenance_types",
			entityId: result.maintenance_type_id,
			details: body,
		});

		return created(res, result);
	})
);

const updateTypeSchema = z.object({
	name: z.string().trim().min(1).optional(),
	description: z.string().trim().max(500).nullable().optional(),
	is_active: z.boolean().optional(),
	// Replace template if provided.
	checklist_items: z.array(checklistItemInput).optional(),
});

maintenanceOpsRouter.patch(
	"/types/:id",
	requirePermission("maintenance.manage"),
	validateBody(updateTypeSchema),
	asyncHandler(async (req, res) => {
		const id = Number(req.params.id);
		const body = req.body as z.infer<typeof updateTypeSchema>;

		await withTransaction(async (tx) => {
			const existing = await queryTx<{ maintenance_type_id: number }>(
				tx,
				`SELECT TOP 1 maintenance_type_id FROM dbo.maintenance_types WHERE maintenance_type_id = @id`,
				(r) => r.input("id", id)
			);
			if (!existing[0]) throw new HttpError(404, "Maintenance type not found", "NOT_FOUND");

			await queryTx(
				tx,
				`
				UPDATE dbo.maintenance_types
				SET
					name = COALESCE(@name, name),
					description = COALESCE(@description, description),
					is_active = COALESCE(@is_active, is_active),
					updated_at = GETDATE()
				WHERE maintenance_type_id = @id
				`,
				(r) => {
					r.input("id", id);
					r.input("name", body.name ?? null);
					r.input("description", body.description ?? null);
					r.input("is_active", body.is_active ?? null);
				}
			);

			if (body.checklist_items) {
				await queryTx(
					tx,
					`DELETE FROM dbo.maintenance_type_checklist_items WHERE maintenance_type_id = @id AND schedule_id IS NULL`,
					(r) => r.input("id", id)
				);

				for (const item of body.checklist_items) {
					await queryTx(
						tx,
						`
						INSERT INTO dbo.maintenance_type_checklist_items(maintenance_type_id, label, sort_order, is_active, created_at, updated_at)
						VALUES(@maintenance_type_id, @label, @sort_order, @is_active, GETDATE(), GETDATE())
						`,
						(r) => {
							r.input("maintenance_type_id", id);
							r.input("label", item.label.trim());
							r.input("sort_order", item.sort_order);
							r.input("is_active", item.is_active ?? true);
						}
					);
				}
			}
		});

		await audit({
			actor: req.user!.username,
			action: "UPDATE",
			entity: "maintenance_types",
			entityId: id,
			details: body,
		});

		return ok(res, true);
	})
);

maintenanceOpsRouter.delete(
	"/types/:id",
	requirePermission("maintenance.manage"),
	asyncHandler(async (req, res) => {
		const id = Number(req.params.id);
		await query(`DELETE FROM dbo.maintenance_types WHERE maintenance_type_id = @id`, (r) => r.input("id", id));

		await audit({ actor: req.user!.username, action: "DELETE", entity: "maintenance_types", entityId: id });
		return ok(res, true);
	})
);

/* =====================================================
	 Schedules + Runs
===================================================== */

const createScheduleSchema = z.object({
	server_id: z.number().int().positive(),
	maintenance_type_ids: z.array(z.number().int().positive()).min(1),
	frequency: z.enum(["Daily", "Weekly", "Monthly"]),
	next_due_date: z.string().trim().min(1),
	engineer_ids: z.array(z.number().int().positive()).min(1),
	custom_checklist_items: z
		.array(
			z.object({
				maintenance_type_id: z.number().int().positive(),
				label: z.string().trim().min(1),
			})
		)
		.optional(),
});

maintenanceOpsRouter.post(
	"/schedules",
	requirePermission("maintenance.manage"),
	validateBody(createScheduleSchema),
	asyncHandler(async (req, res) => {
		const body = req.body as z.infer<typeof createScheduleSchema>;
		const engineerIds = normalizeEngineerIds(body.engineer_ids);
		if (!engineerIds.length) throw new HttpError(400, "At least one engineer is required", "ENGINEERS_REQUIRED");
		const maintenanceTypeIds = Array.from(
			new Set((body.maintenance_type_ids ?? []).map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0))
		);
		if (!maintenanceTypeIds.length) throw new HttpError(400, "At least one maintenance type is required", "TYPES_REQUIRED");

		const due = toDateOnly(body.next_due_date);
		const teamId = await getServerTeamId(body.server_id);
		await validateEngineersMatchTeam(engineerIds, teamId);

		const result = await withTransaction(async (tx) => {
			for (const typeId of maintenanceTypeIds) {
				const typeOk = await queryTx<{ maintenance_type_id: number }>(
					tx,
					`SELECT TOP 1 maintenance_type_id FROM dbo.maintenance_types WHERE maintenance_type_id=@id AND is_active=1`,
					(r) => r.input("id", typeId)
				);
				if (!typeOk[0]) throw new HttpError(400, `Invalid maintenance_type_id: ${typeId}`, "INVALID_TYPE");
			}

			const primaryTypeId = maintenanceTypeIds[0];

			const scheduleRows = await queryTx<{ schedule_id: number }>(
				tx,
				`
				INSERT INTO dbo.maintenance_schedules(server_id, maintenance_type_id, frequency, next_due_date, is_active, created_by, created_at, updated_at)
				OUTPUT INSERTED.schedule_id
				VALUES(@server_id, @maintenance_type_id, @frequency, @next_due_date, 1, @created_by, GETDATE(), GETDATE())
				`,
				(r) => {
					r.input("server_id", body.server_id);
					r.input("maintenance_type_id", primaryTypeId);
					r.input("frequency", body.frequency);
					r.input("next_due_date", due);
					r.input("created_by", req.user!.username);
				}
			);

			const scheduleId = scheduleRows?.[0]?.schedule_id;
			if (!scheduleId) throw new HttpError(500, "Failed to create schedule", "CREATE_FAILED");

			// Persist all selected schedule types (idempotent)
			for (const typeId of maintenanceTypeIds) {
				await queryTx(
					tx,
					`
					INSERT INTO dbo.maintenance_schedule_types(schedule_id, maintenance_type_id)
					SELECT @schedule_id, @maintenance_type_id
					WHERE NOT EXISTS (
						SELECT 1 FROM dbo.maintenance_schedule_types
						WHERE schedule_id=@schedule_id AND maintenance_type_id=@maintenance_type_id
					)
					`,
					(r) => {
						r.input("schedule_id", scheduleId);
						r.input("maintenance_type_id", typeId);
					}
				);
			}

			// Insert schedule-scoped custom checklist items (optional)
			const customItems = (body.custom_checklist_items ?? [])
				.map((i) => ({ maintenance_type_id: Number(i.maintenance_type_id), label: String(i.label ?? "").trim() }))
				.filter((i) => i.label && maintenanceTypeIds.includes(i.maintenance_type_id));

			if (customItems.length) {
				const byType = new Map<number, string[]>();
				for (const item of customItems) {
					const arr = byType.get(item.maintenance_type_id) ?? [];
					arr.push(item.label);
					byType.set(item.maintenance_type_id, arr);
				}

				for (const [typeId, labels] of byType.entries()) {
					const maxRows = await queryTx<{ max_sort: number }>(
						tx,
						`
						SELECT ISNULL(MAX(sort_order), 0) AS max_sort
						FROM dbo.maintenance_type_checklist_items
						WHERE maintenance_type_id = @maintenance_type_id
							AND is_active = 1
							AND (schedule_id IS NULL OR schedule_id = @schedule_id)
						`,
						(r) => {
							r.input("maintenance_type_id", typeId);
							r.input("schedule_id", scheduleId);
						}
					);
					let sort = Number(maxRows?.[0]?.max_sort ?? 0);
					for (const label of labels) {
						sort += 1;
						await queryTx(
							tx,
							`
							INSERT INTO dbo.maintenance_type_checklist_items(
								maintenance_type_id, schedule_id, label, sort_order, is_active, is_custom, created_at, updated_at
							)
							VALUES(@maintenance_type_id, @schedule_id, @label, @sort_order, 1, 1, GETDATE(), GETDATE())
							`,
							(r) => {
								r.input("maintenance_type_id", typeId);
								r.input("schedule_id", scheduleId);
								r.input("label", label);
								r.input("sort_order", sort);
							}
						);
					}
				}
			}

			for (const engineerId of engineerIds) {
				await queryTx(
					tx,
					`
					INSERT INTO dbo.maintenance_schedule_engineers(schedule_id, engineer_id)
					VALUES(@schedule_id, @engineer_id)
					`,
					(r) => {
						r.input("schedule_id", scheduleId);
						r.input("engineer_id", engineerId);
					}
				);
			}

			const runRows = await queryTx<{ run_id: number }>(
				tx,
				`
				INSERT INTO dbo.maintenance_runs(schedule_id, due_date, status, created_at, updated_at)
				OUTPUT INSERTED.run_id
				VALUES(@schedule_id, @due_date, 'Active', GETDATE(), GETDATE())
				`,
				(r) => {
					r.input("schedule_id", scheduleId);
					r.input("due_date", due);
				}
			);

			const runId = runRows?.[0]?.run_id;
			if (!runId) throw new HttpError(500, "Failed to create run", "CREATE_FAILED");

			// Snapshot run engineers
			for (const engineerId of engineerIds) {
				await queryTx(
					tx,
					`INSERT INTO dbo.maintenance_run_engineers(run_id, engineer_id) VALUES(@run_id, @engineer_id)`,
					(r) => {
						r.input("run_id", runId);
						r.input("engineer_id", engineerId);
					}
				);
			}

			// Initialize checklist progress based on template items
			await queryTx(
				tx,
				`
				INSERT INTO dbo.maintenance_run_checklist_progress(run_id, checklist_item_id, label, is_done, done_at, updated_at)
				SELECT
					@run_id,
					ci.checklist_item_id,
					ci.label,
					0,
					NULL,
					GETDATE()
				FROM dbo.maintenance_type_checklist_items ci
				WHERE ci.is_active = 1
					AND (ci.schedule_id IS NULL OR ci.schedule_id = @schedule_id)
					AND EXISTS (
						SELECT 1
						FROM dbo.maintenance_schedule_types st
						WHERE st.schedule_id = @schedule_id
							AND st.maintenance_type_id = ci.maintenance_type_id
					)
				ORDER BY ci.maintenance_type_id ASC, ci.sort_order ASC, ci.checklist_item_id ASC
				`,
				(r) => {
					r.input("run_id", runId);
					r.input("schedule_id", scheduleId);
				}
			);

			await assignChecklistToEngineersTx(tx, runId);

			// Server status is derived (incidents/maintenance).
			await recalculateServerStatus(body.server_id, tx);

			return { schedule_id: scheduleId, run_id: runId };
		});

		await audit({
			actor: req.user!.username,
			action: "CREATE",
			entity: "maintenance_schedules",
			entityId: result.schedule_id,
			details: { ...body, engineer_ids: engineerIds, maintenance_type_ids: maintenanceTypeIds },
		});

		// SMS auto-send (placeholder provider)
		await sendRunSmsToAssigned({ runId: result.run_id, actor: req.user!.username, mode: "MANUAL" });

		return created(res, result);
	})
);

const replaceAssignmentsSchema = z.object({
	engineer_ids: z.array(z.number().int().positive()).min(1),
});

maintenanceOpsRouter.put(
	"/schedules/:id/assignments",
	requirePermission("maintenance.manage"),
	validateBody(replaceAssignmentsSchema),
	asyncHandler(async (req, res) => {
		const scheduleId = Number(req.params.id);
		const body = req.body as z.infer<typeof replaceAssignmentsSchema>;
		const engineerIds = normalizeEngineerIds(body.engineer_ids);
		if (!engineerIds.length) throw new HttpError(400, "At least one engineer is required", "ENGINEERS_REQUIRED");

		const scheduleRows = await query<{
			server_id: number;
			maintenance_type_id: number;
		}>(
			`SELECT TOP 1 server_id, maintenance_type_id FROM dbo.maintenance_schedules WHERE schedule_id=@id`,
			(r) => r.input("id", scheduleId)
		);
		const schedule = scheduleRows[0];
		if (!schedule) throw new HttpError(404, "Schedule not found", "NOT_FOUND");

		const teamId = await getServerTeamId(schedule.server_id);
		await validateEngineersMatchTeam(engineerIds, teamId);

		await withTransaction(async (tx) => {
			await queryTx(tx, `DELETE FROM dbo.maintenance_schedule_engineers WHERE schedule_id=@id`, (r) => r.input("id", scheduleId));
			for (const engineerId of engineerIds) {
				await queryTx(
					tx,
					`INSERT INTO dbo.maintenance_schedule_engineers(schedule_id, engineer_id) VALUES(@schedule_id, @engineer_id)`,
					(r) => {
						r.input("schedule_id", scheduleId);
						r.input("engineer_id", engineerId);
					}
				);
			}

			// Update engineers on all non-complete runs for this schedule (prevent duplicate active assignment + keep live runs accurate)
			const openRuns = await queryTx<{ run_id: number }>(
				tx,
				`SELECT run_id FROM dbo.maintenance_runs WHERE schedule_id=@id AND status <> 'Complete'`,
				(r) => r.input("id", scheduleId)
			);

			for (const run of openRuns) {
				await queryTx(tx, `DELETE FROM dbo.maintenance_run_engineers WHERE run_id=@run_id`, (r) => r.input("run_id", run.run_id));
				for (const engineerId of engineerIds) {
					await queryTx(
						tx,
						`INSERT INTO dbo.maintenance_run_engineers(run_id, engineer_id) VALUES(@run_id, @engineer_id)`,
						(r) => {
							r.input("run_id", run.run_id);
							r.input("engineer_id", engineerId);
						}
					);
				}
			}
		});

		await audit({
			actor: req.user!.username,
			action: "UPDATE",
			entity: "maintenance_schedules",
			entityId: scheduleId,
			details: { engineer_ids: engineerIds },
		});

		return ok(res, true);
	})
);

maintenanceOpsRouter.get(
	"/runs/active",
	requirePermission("maintenance.read"),
	asyncHandler(async (req, res) => {
		await requireMultiMaintenanceSchema();
		const allowManageBypass =
			(req.user?.permissions ?? []).includes("maintenance.manage") ||
			(req.user?.roles ?? []).some((r) => {
				const v = String(r).toLowerCase();
				return v === "admin" || v === "administrator";
			});
		const actorEngineerId = allowManageBypass ? null : await getEngineerIdByEmail(req.user!.username);

		const page = Math.max(1, Number(req.query.page ?? 1));
		const pageSize = Math.min(100, Math.max(1, Number(req.query.page_size ?? 20)));
		const q = String(req.query.q ?? "").trim() || null;
		const serverId = req.query.server_id ? Number(req.query.server_id) : null;

		const offset = (page - 1) * pageSize;

		const rows = await query(
			`
			WITH base AS (
				SELECT
					r.run_id,
					r.schedule_id,
					CONVERT(varchar(10), r.due_date, 23) AS due_date,
					r.status,
					r.completed_at,
					r.note,
					s.frequency,
					s.server_id,
					sv.server_code,
					sv.hostname,
					sv.team_id,
					t.team_name,
					NULLIF(
						STUFF((
							SELECT ', ' + mt2.name
							FROM dbo.maintenance_schedule_types st
							JOIN dbo.maintenance_types mt2 ON mt2.maintenance_type_id = st.maintenance_type_id
							WHERE st.schedule_id = s.schedule_id
							ORDER BY mt2.name
							FOR XML PATH(''), TYPE
						).value('.', 'nvarchar(max)'), 1, 2, ''),
						''
					) AS maintenance_type,
					(
						SELECT COUNT(1)
						FROM dbo.maintenance_run_checklist_progress p
						WHERE p.run_id = r.run_id
					) AS total_tasks,
					(
						SELECT COUNT(1)
						FROM dbo.maintenance_run_checklist_progress p
						WHERE p.run_id = r.run_id AND p.is_done = 1
					) AS done_tasks,
					NULLIF(
						STUFF((
							SELECT ', ' + e.full_name
							FROM dbo.maintenance_run_engineers re
							JOIN dbo.engineers e ON e.engineer_id = re.engineer_id
							WHERE re.run_id = r.run_id
							ORDER BY e.full_name
							FOR XML PATH(''), TYPE
						).value('.', 'nvarchar(max)'), 1, 2, ''),
						''
					) AS assigned_engineers
				FROM dbo.maintenance_runs r
				JOIN dbo.maintenance_schedules s ON s.schedule_id = r.schedule_id
				JOIN dbo.servers sv ON sv.server_id = s.server_id
				LEFT JOIN dbo.teams t ON t.team_id = sv.team_id
				JOIN dbo.maintenance_types mt ON mt.maintenance_type_id = s.maintenance_type_id
				WHERE r.status <> 'Complete'
					AND (
						@engineer_id IS NULL
						OR EXISTS (
							SELECT 1
							FROM dbo.maintenance_run_engineers re
							WHERE re.run_id = r.run_id AND re.engineer_id = @engineer_id
						)
					)
					AND (@server_id IS NULL OR s.server_id = @server_id)
					AND (
						@q IS NULL
						OR sv.server_code LIKE '%' + @q + '%'
						OR sv.hostname LIKE '%' + @q + '%'
						OR mt.name LIKE '%' + @q + '%'
						OR EXISTS (
							SELECT 1
							FROM dbo.maintenance_schedule_types st
							JOIN dbo.maintenance_types mt2 ON mt2.maintenance_type_id = st.maintenance_type_id
							WHERE st.schedule_id = s.schedule_id
								AND mt2.name LIKE '%' + @q + '%'
						)
					)
			)
			SELECT *
			FROM base
			ORDER BY
				CASE WHEN status = 'Overdue' THEN 0 ELSE 1 END,
				due_date ASC,
				run_id DESC
			OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
			`,
			(r) => {
				r.input("q", q);
				r.input("server_id", serverId);
				r.input("engineer_id", actorEngineerId);
				r.input("offset", offset);
				r.input("limit", pageSize);
			}
		);

		return ok(res, { page, page_size: pageSize, rows });
	})
);

maintenanceOpsRouter.get(
	"/runs/completed",
	requirePermission("maintenance.read"),
	asyncHandler(async (req, res) => {
		await requireMultiMaintenanceSchema();
		const allowManageBypass =
			(req.user?.permissions ?? []).includes("maintenance.manage") ||
			(req.user?.roles ?? []).some((r) => {
				const v = String(r).toLowerCase();
				return v === "admin" || v === "administrator";
			});
		const actorEngineerId = allowManageBypass ? null : await getEngineerIdByEmail(req.user!.username);

		const page = Math.max(1, Number(req.query.page ?? 1));
		const pageSize = Math.min(100, Math.max(1, Number(req.query.page_size ?? 20)));
		const q = String(req.query.q ?? "").trim() || null;
		const serverId = req.query.server_id ? Number(req.query.server_id) : null;
		const offset = (page - 1) * pageSize;

		const rows = await query(
			`
			WITH base AS (
				SELECT
					r.run_id,
					r.schedule_id,
					CONVERT(varchar(10), r.due_date, 23) AS due_date,
					r.status,
					r.completed_at,
					r.note,
					s.frequency,
					s.server_id,
					sv.server_code,
					sv.hostname,
					NULLIF(
						STUFF((
							SELECT ', ' + mt2.name
							FROM dbo.maintenance_schedule_types st
							JOIN dbo.maintenance_types mt2 ON mt2.maintenance_type_id = st.maintenance_type_id
							WHERE st.schedule_id = s.schedule_id
							ORDER BY mt2.name
							FOR XML PATH(''), TYPE
						).value('.', 'nvarchar(max)'), 1, 2, ''),
						''
					) AS maintenance_type,
					(
						SELECT COUNT(1)
						FROM dbo.maintenance_run_checklist_progress p
						WHERE p.run_id = r.run_id
					) AS total_tasks,
					(
						SELECT COUNT(1)
						FROM dbo.maintenance_run_checklist_progress p
						WHERE p.run_id = r.run_id AND p.is_done = 1
					) AS done_tasks,
					NULLIF(
						STUFF((
							SELECT ', ' + e.full_name
							FROM dbo.maintenance_run_engineers re
							JOIN dbo.engineers e ON e.engineer_id = re.engineer_id
							WHERE re.run_id = r.run_id
							ORDER BY e.full_name
							FOR XML PATH(''), TYPE
						).value('.', 'nvarchar(max)'), 1, 2, ''),
						''
					) AS assigned_engineers
				FROM dbo.maintenance_runs r
				JOIN dbo.maintenance_schedules s ON s.schedule_id = r.schedule_id
				JOIN dbo.servers sv ON sv.server_id = s.server_id
				JOIN dbo.maintenance_types mt ON mt.maintenance_type_id = s.maintenance_type_id
				WHERE r.status = 'Complete'
					AND (
						@engineer_id IS NULL
						OR EXISTS (
							SELECT 1
							FROM dbo.maintenance_run_engineers re
							WHERE re.run_id = r.run_id AND re.engineer_id = @engineer_id
						)
					)
					AND (@server_id IS NULL OR s.server_id = @server_id)
					AND (
						@q IS NULL
						OR sv.server_code LIKE '%' + @q + '%'
						OR sv.hostname LIKE '%' + @q + '%'
						OR mt.name LIKE '%' + @q + '%'
						OR EXISTS (
							SELECT 1
							FROM dbo.maintenance_schedule_types st
							JOIN dbo.maintenance_types mt2 ON mt2.maintenance_type_id = st.maintenance_type_id
							WHERE st.schedule_id = s.schedule_id
								AND mt2.name LIKE '%' + @q + '%'
						)
					)
			)
			SELECT *
			FROM base
			ORDER BY completed_at DESC, run_id DESC
			OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
			`,
			(r) => {
				r.input("q", q);
				r.input("server_id", serverId);
				r.input("engineer_id", actorEngineerId);
				r.input("offset", offset);
				r.input("limit", pageSize);
			}
		);

		return ok(res, { page, page_size: pageSize, rows });
	})
);

maintenanceOpsRouter.get(
	"/runs/:runId",
	requirePermission("maintenance.read"),
	asyncHandler(async (req, res) => {
		const runId = Number(req.params.runId);
		const allowManageBypass = (req.user?.permissions ?? []).includes("maintenance.manage") || (req.user?.roles ?? []).some((r) => String(r).toLowerCase() === "admin" || String(r).toLowerCase() === "administrator");
		await requireRunAccess(runId, req.user!.username, allowManageBypass);
		const actorEngineerId = allowManageBypass ? null : await getEngineerIdByEmail(req.user!.username);

		const headerRows = await query<{
			run_id: number;
			schedule_id: number;
			due_date: string;
			status: RunStatus;
			completed_at: string | null;
			note: string | null;
			frequency: Frequency;
			server_id: number;
			server_code: string | null;
			hostname: string | null;
			maintenance_type: string;
		}>(
			`
			SELECT TOP 1
				r.run_id,
				r.schedule_id,
				CONVERT(varchar(10), r.due_date, 23) AS due_date,
				r.status,
				CONVERT(varchar(19), r.completed_at, 120) AS completed_at,
				r.note,
				s.frequency,
				s.server_id,
				sv.server_code,
				sv.hostname,
				NULLIF(
					STUFF((
						SELECT ', ' + mt2.name
						FROM dbo.maintenance_schedule_types st
						JOIN dbo.maintenance_types mt2 ON mt2.maintenance_type_id = st.maintenance_type_id
						WHERE st.schedule_id = s.schedule_id
						ORDER BY mt2.name
						FOR XML PATH(''), TYPE
					).value('.', 'nvarchar(max)'), 1, 2, ''),
					''
				) AS maintenance_type
			FROM dbo.maintenance_runs r
			JOIN dbo.maintenance_schedules s ON s.schedule_id = r.schedule_id
			JOIN dbo.servers sv ON sv.server_id = s.server_id
			WHERE r.run_id = @run_id
			`,
			(r) => r.input("run_id", runId)
		);

		const header = headerRows[0] ?? null;
		if (!header) throw new HttpError(404, "Run not found", "NOT_FOUND");

		const engineers = await query(
			`
			SELECT e.engineer_id, e.full_name, e.email, e.phone
			FROM dbo.maintenance_run_engineers re
			JOIN dbo.engineers e ON e.engineer_id = re.engineer_id
			WHERE re.run_id = @run_id
			ORDER BY e.full_name ASC
			`,
			(r) => r.input("run_id", runId)
		);

		let checklist: any[] = [];
		if (actorEngineerId) {
			try {
				checklist = await query(
					`
					SELECT
						p.checklist_item_id,
						p.label,
						p.is_done,
						CONVERT(varchar(19), p.done_at, 120) AS done_at
					FROM dbo.maintenance_run_checklist_assignments a
					JOIN dbo.maintenance_run_checklist_progress p
						ON p.run_id = a.run_id AND p.checklist_item_id = a.checklist_item_id
					WHERE a.run_id = @run_id AND a.engineer_id = @engineer_id
					ORDER BY a.checklist_item_id ASC
					`,
					(r) => {
						r.input("run_id", runId);
						r.input("engineer_id", actorEngineerId);
					}
				);
			} catch {
				// fallback to full checklist if assignments schema isn't present
			}
		}
		if (!checklist.length) {
			checklist = await query(
				`
				SELECT
					p.checklist_item_id,
					p.label,
					p.is_done,
					CONVERT(varchar(19), p.done_at, 120) AS done_at
				FROM dbo.maintenance_run_checklist_progress p
				WHERE p.run_id = @run_id
				ORDER BY p.checklist_item_id ASC
				`,
				(r) => r.input("run_id", runId)
			);
		}

		const total = checklist.length;
		const done = checklist.filter((c: any) => Boolean(c.is_done)).length;

		return ok(res, {
			run: header,
			engineers,
			checklist,
			progress: { done, total, percent: total ? Math.round((done / total) * 100) : 0 },
		});
	})
);

const updateRunSchema = z.object({
	note: z.string().trim().max(500).nullable().optional(),
});

maintenanceOpsRouter.patch(
	"/runs/:runId",
	requirePermission("maintenance.read"),
	validateBody(updateRunSchema),
	asyncHandler(async (req, res) => {
		const runId = Number(req.params.runId);
		const body = req.body as z.infer<typeof updateRunSchema>;

		const allowManageBypass = (req.user?.permissions ?? []).includes("maintenance.manage") || (req.user?.roles ?? []).some((r) => String(r).toLowerCase() === "admin" || String(r).toLowerCase() === "administrator");
		await requireRunAccess(runId, req.user!.username, allowManageBypass);

		await query(
			`
			UPDATE dbo.maintenance_runs
			SET note = @note, updated_at = GETDATE()
			WHERE run_id = @run_id
			`,
			(r) => {
				r.input("run_id", runId);
				r.input("note", body.note ?? null);
			}
		);

		await audit({ actor: req.user!.username, action: "UPDATE", entity: "maintenance_runs", entityId: runId, details: body });
		return ok(res, true);
	})
);

const updateChecklistSchema = z.object({
	is_done: z.boolean(),
});

maintenanceOpsRouter.patch(
	"/runs/:runId/checklist/:checklistItemId",
	requirePermission("maintenance.read"),
	validateBody(updateChecklistSchema),
	asyncHandler(async (req, res) => {
		const runId = Number(req.params.runId);
		const checklistItemId = Number(req.params.checklistItemId);
		const body = req.body as z.infer<typeof updateChecklistSchema>;

		const allowManageBypass = (req.user?.permissions ?? []).includes("maintenance.manage") || (req.user?.roles ?? []).some((r) => String(r).toLowerCase() === "admin" || String(r).toLowerCase() === "administrator");
		await requireRunAccess(runId, req.user!.username, allowManageBypass);

		const updated = await withTransaction(async (tx) => {
			const runRows = await queryTx<{ status: RunStatus; due_date: string }>(
				tx,
				`SELECT TOP 1 status, CONVERT(varchar(10), due_date, 23) AS due_date FROM dbo.maintenance_runs WHERE run_id=@run_id`,
				(r) => r.input("run_id", runId)
			);
			const run = runRows[0];
			if (!run) throw new HttpError(404, "Run not found", "NOT_FOUND");
			if (run.status === "Complete") throw new HttpError(409, "Run is already complete", "ALREADY_COMPLETE");

			await queryTx(
				tx,
				`
				UPDATE dbo.maintenance_run_checklist_progress
				SET is_done = @is_done,
						done_at = CASE WHEN @is_done = 1 THEN GETDATE() ELSE NULL END,
						updated_at = GETDATE()
				WHERE run_id = @run_id AND checklist_item_id = @checklist_item_id
				`,
				(r) => {
					r.input("run_id", runId);
					r.input("checklist_item_id", checklistItemId);
					r.input("is_done", body.is_done ? 1 : 0);
				}
			);

			const counts = await queryTx<{ total: number; done: number }>(
				tx,
				`
				SELECT
					(SELECT COUNT(1) FROM dbo.maintenance_run_checklist_progress WHERE run_id = @run_id) AS total,
					(SELECT COUNT(1) FROM dbo.maintenance_run_checklist_progress WHERE run_id = @run_id AND is_done = 1) AS done
				`,
				(r) => r.input("run_id", runId)
			);
			const total = counts?.[0]?.total ?? 0;
			const done = counts?.[0]?.done ?? 0;

			// Status heuristic:
			// - Overdue if due_date < today
			// - Incomplete if started (some done) but not all
			// - Active if none done
			const todayRows = await queryTx<{ today: string }>(
				tx,
				`SELECT CONVERT(varchar(10), CAST(GETDATE() AS date), 23) AS today`
			);
			const today = todayRows?.[0]?.today;
			const isOverdue = today && run.due_date < today;

			let nextStatus: RunStatus = "Active";
			if (isOverdue) nextStatus = "Overdue";
			else if (total > 0 && done > 0 && done < total) nextStatus = "Incomplete";
			else nextStatus = "Active";

			await queryTx(
				tx,
				`UPDATE dbo.maintenance_runs SET status=@status, updated_at=GETDATE() WHERE run_id=@run_id`,
				(r) => {
					r.input("run_id", runId);
					r.input("status", nextStatus);
				}
			);

			return { total, done, status: nextStatus };
		});

		await audit({
			actor: req.user!.username,
			action: "UPDATE",
			entity: "maintenance_run_checklist_progress",
			entityId: `${runId}:${checklistItemId}`,
			details: { is_done: body.is_done },
		});

		return ok(res, updated);
	})
);

maintenanceOpsRouter.post(
	"/runs/:runId/complete",
	requirePermission("maintenance.read"),
	asyncHandler(async (req, res) => {
		const runId = Number(req.params.runId);
		const allowManageBypass = (req.user?.permissions ?? []).includes("maintenance.manage") || (req.user?.roles ?? []).some((r) => String(r).toLowerCase() === "admin" || String(r).toLowerCase() === "administrator");
		await requireRunAccess(runId, req.user!.username, allowManageBypass);

		const result = await withTransaction(async (tx) => {
			const runRows = await queryTx<{
				run_id: number;
				schedule_id: number;
				status: RunStatus;
				due_date: string;
				frequency: Frequency;
				maintenance_type_id: number;
				is_active: boolean;
				server_id: number;
			}>(
				tx,
				`
				SELECT TOP 1
					r.run_id,
					r.schedule_id,
					r.status,
					CONVERT(varchar(10), r.due_date, 23) AS due_date,
					s.frequency,
					s.maintenance_type_id,
					CAST(s.is_active AS bit) AS is_active,
					s.server_id
				FROM dbo.maintenance_runs r
				JOIN dbo.maintenance_schedules s ON s.schedule_id = r.schedule_id
				WHERE r.run_id = @run_id
				`,
				(r) => r.input("run_id", runId)
			);
			const run = runRows?.[0];
			if (!run) throw new HttpError(404, "Run not found", "NOT_FOUND");
			if (run.status === "Complete") {
				return { completed: true, renewed: false, next_run_id: null as number | null, next_due_date: null as string | null };
			}

			// Auto-tick all checklist items (as requested).
			await queryTx(
				tx,
				`
				UPDATE dbo.maintenance_run_checklist_progress
				SET is_done = 1,
					done_at = ISNULL(done_at, GETDATE()),
					updated_at = GETDATE()
				WHERE run_id = @run_id
				`,
				(r) => r.input("run_id", runId)
			);

			await queryTx(
				tx,
				`
				UPDATE dbo.maintenance_runs
				SET status='Complete', completed_at = ISNULL(completed_at, GETDATE()), updated_at=GETDATE()
				WHERE run_id=@run_id
				`,
				(r) => r.input("run_id", runId)
			);

			// Server status is derived; we'll recalculate after the run (and potential renewal).

			// Immediately renew: advance schedule and create next run.
			if (!run.is_active) {
				await recalculateServerStatus(run.server_id, tx);
				return { completed: true, renewed: false, next_run_id: null as number | null, next_due_date: null as string | null };
			}

			const nextDue = addFrequency(run.due_date, run.frequency);
			await queryTx(
				tx,
				`UPDATE dbo.maintenance_schedules SET next_due_date = @next_due_date, updated_at = GETDATE() WHERE schedule_id = @schedule_id`,
				(r) => {
					r.input("schedule_id", run.schedule_id);
					r.input("next_due_date", nextDue);
				}
			);

			const existingNext = await queryTx<{ run_id: number }>(
				tx,
				`SELECT TOP 1 run_id FROM dbo.maintenance_runs WHERE schedule_id=@schedule_id AND due_date=@due_date ORDER BY run_id DESC`,
				(r) => {
					r.input("schedule_id", run.schedule_id);
					r.input("due_date", nextDue);
				}
			);

			let nextRunId = existingNext?.[0]?.run_id ?? null;
			if (!nextRunId) {
				const inserted = await queryTx<{ run_id: number }>(
					tx,
					`
					INSERT INTO dbo.maintenance_runs(schedule_id, due_date, status, created_at, updated_at)
					OUTPUT INSERTED.run_id
					VALUES(@schedule_id, @due_date, 'Active', GETDATE(), GETDATE())
					`,
					(r) => {
						r.input("schedule_id", run.schedule_id);
						r.input("due_date", nextDue);
					}
				);
				nextRunId = inserted?.[0]?.run_id ?? null;
			}

			if (!nextRunId) {
				await recalculateServerStatus(run.server_id, tx);
				return { completed: true, renewed: false, next_run_id: null as number | null, next_due_date: nextDue };
			}

			// Snapshot engineers from schedule onto next run (idempotent).
			await queryTx(
				tx,
				`
				INSERT INTO dbo.maintenance_run_engineers(run_id, engineer_id)
				SELECT @run_id, se.engineer_id
				FROM dbo.maintenance_schedule_engineers se
				WHERE se.schedule_id = @schedule_id
					AND NOT EXISTS (
						SELECT 1 FROM dbo.maintenance_run_engineers re
						WHERE re.run_id = @run_id AND re.engineer_id = se.engineer_id
					)
				`,
				(r) => {
					r.input("run_id", nextRunId);
					r.input("schedule_id", run.schedule_id);
				}
			);

			// Init checklist progress (only if not already initialized).
			const hasChecklist = await queryTx<{ x: number }>(
				tx,
				`SELECT TOP 1 1 AS x FROM dbo.maintenance_run_checklist_progress WHERE run_id=@run_id`,
				(r) => r.input("run_id", nextRunId)
			);
			if (!hasChecklist?.[0]) {
				await queryTx(
					tx,
					`
					INSERT INTO dbo.maintenance_run_checklist_progress(run_id, checklist_item_id, label, is_done, done_at, updated_at)
					SELECT
						@run_id,
						ci.checklist_item_id,
						ci.label,
						0,
						NULL,
						GETDATE()
					FROM dbo.maintenance_type_checklist_items ci
					WHERE ci.is_active = 1
						AND (ci.schedule_id IS NULL OR ci.schedule_id = @schedule_id)
						AND EXISTS (
							SELECT 1
							FROM dbo.maintenance_schedule_types st
							WHERE st.schedule_id = @schedule_id
								AND st.maintenance_type_id = ci.maintenance_type_id
						)
					ORDER BY ci.maintenance_type_id ASC, ci.sort_order ASC, ci.checklist_item_id ASC
					`,
					(r) => {
						r.input("run_id", nextRunId);
						r.input("schedule_id", run.schedule_id);
					}
				);
			}

			await assignChecklistToEngineersTx(tx, nextRunId);

			// Server status is derived; depends on due_date/status rules.
			await recalculateServerStatus(run.server_id, tx);

			return { completed: true, renewed: true, next_run_id: nextRunId, next_due_date: nextDue };
		});

		await audit({ actor: req.user!.username, action: "COMPLETE", entity: "maintenance_runs", entityId: runId, details: result });
		if (result.renewed && result.next_run_id) {
			await audit({
				actor: req.user!.username,
				action: "AUTO_RENEW",
				entity: "maintenance_schedules",
				entityId: null,
				details: { completed_run_id: runId, next_run_id: result.next_run_id, next_due_date: result.next_due_date },
			});
		}

		return ok(res, result);
	})
);

maintenanceOpsRouter.get(
	"/schedules/:id/history",
	requirePermission("maintenance.read"),
	asyncHandler(async (req, res) => {
		const scheduleId = Number(req.params.id);

		const rows = await query(
			`
			SELECT
				r.run_id,
				r.schedule_id,
				CONVERT(varchar(10), r.due_date, 23) AS due_date,
				r.status,
				CONVERT(varchar(19), r.completed_at, 120) AS completed_at,
				r.note,
				(
					SELECT COUNT(1)
					FROM dbo.maintenance_run_checklist_progress p
					WHERE p.run_id = r.run_id
				) AS total_tasks,
				(
					SELECT COUNT(1)
					FROM dbo.maintenance_run_checklist_progress p
					WHERE p.run_id = r.run_id AND p.is_done = 1
				) AS done_tasks,
				r.created_at
			FROM dbo.maintenance_runs r
			WHERE r.schedule_id = @schedule_id
			ORDER BY r.due_date DESC, r.run_id DESC
			`,
			(r) => r.input("schedule_id", scheduleId)
		);

		return ok(res, rows);
	})
);

maintenanceOpsRouter.get(
	"/servers/:serverId/history",
	requirePermission("maintenance.read"),
	asyncHandler(async (req, res) => {
		const serverId = Number(req.params.serverId);

		const rows = await query(
			`
			SELECT
				r.run_id,
				r.schedule_id,
				s.frequency,
				NULLIF(
					STUFF((
						SELECT ', ' + mt2.name
						FROM dbo.maintenance_schedule_types st
						JOIN dbo.maintenance_types mt2 ON mt2.maintenance_type_id = st.maintenance_type_id
						WHERE st.schedule_id = s.schedule_id
						ORDER BY mt2.name
						FOR XML PATH(''), TYPE
					).value('.', 'nvarchar(max)'), 1, 2, ''),
					''
				) AS maintenance_type,
				CONVERT(varchar(10), r.due_date, 23) AS due_date,
				r.status,
				CONVERT(varchar(19), r.completed_at, 120) AS completed_at,
				r.note,
				(
					SELECT COUNT(1)
					FROM dbo.maintenance_run_checklist_progress p
					WHERE p.run_id = r.run_id
				) AS total_tasks,
				(
					SELECT COUNT(1)
					FROM dbo.maintenance_run_checklist_progress p
					WHERE p.run_id = r.run_id AND p.is_done = 1
				) AS done_tasks,
				r.created_at
			FROM dbo.maintenance_runs r
			JOIN dbo.maintenance_schedules s ON s.schedule_id = r.schedule_id
			WHERE s.server_id = @server_id
			  AND r.status = 'Complete'
			ORDER BY r.completed_at DESC, r.run_id DESC
			`,
			(r) => r.input("server_id", serverId)
		);

		return ok(res, rows);
	})
);

maintenanceOpsRouter.post(
	"/runs/:runId/sms/resend",
	requirePermission("maintenance.manage"),
	asyncHandler(async (req, res) => {
		const runId = Number(req.params.runId);
		const result = await sendRunSmsToAssigned({ runId, actor: req.user!.username, mode: "MANUAL" });
		return ok(res, result);
	})
);

maintenanceOpsRouter.delete(
	"/runs/:runId",
	requirePermission("maintenance.manage"),
	asyncHandler(async (req, res) => {
		const runId = Number(req.params.runId);

		await withTransaction(async (tx) => {
			// Check if run exists
			const runRows = await queryTx<{ run_id: number; schedule_id: number }>(
				tx,
				`SELECT TOP 1 run_id, schedule_id FROM dbo.maintenance_runs WHERE run_id = @run_id`,
				(r) => r.input("run_id", runId)
			);
			
			if (!runRows[0]) {
				throw new HttpError(404, "Maintenance run not found", "NOT_FOUND");
			}

			// Delete checklist progress
			await queryTx(
				tx,
				`DELETE FROM dbo.maintenance_run_checklist_progress WHERE run_id = @run_id`,
				(r) => r.input("run_id", runId)
			);

			// Delete run engineers
			await queryTx(
				tx,
				`DELETE FROM dbo.maintenance_run_engineers WHERE run_id = @run_id`,
				(r) => r.input("run_id", runId)
			);

			// Delete the run
			await queryTx(
				tx,
				`DELETE FROM dbo.maintenance_runs WHERE run_id = @run_id`,
				(r) => r.input("run_id", runId)
			);

			// Audit log
			await audit({
				actor: req.user!.username,
				action: "DELETE",
				entity: "maintenance_runs",
				entityId: runId,
				details: { run_id: runId }
			});
		});

		return ok(res, { success: true });
	})
);
