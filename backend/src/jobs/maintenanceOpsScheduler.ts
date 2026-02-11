import { query, queryTx, withTransaction } from "../db/sql";
import { audit } from "../utils/audit";
import { sendSmsPlaceholder } from "../utils/sms";

type Frequency = "Daily" | "Weekly" | "Monthly";

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

let schemaChecked: boolean | null = null;
let schemaWarned = false;

async function ensureMaintenanceOpsSchema(): Promise<boolean> {
	if (schemaChecked !== null) return schemaChecked;
	try {
		const rows = await query<{ due_date_col: number | null }>(
			`SELECT COL_LENGTH('dbo.maintenance_runs', 'due_date') AS due_date_col`
		);
		const ok = rows?.[0]?.due_date_col !== null;
		schemaChecked = ok;
		if (!ok && !schemaWarned) {
			schemaWarned = true;
			console.warn(
				"[maintenance-ops-scheduler] Missing dbo.maintenance_runs.due_date. Run backend/sql/migrations/2026-01-28_add-advanced-maintenance-ops.sql against your database. Scheduler is paused until schema is fixed."
			);
		}
		return ok;
	} catch (e) {
		schemaChecked = false;
		if (!schemaWarned) {
			schemaWarned = true;
			console.warn(
				"[maintenance-ops-scheduler] Maintenance Ops schema check failed. Scheduler is paused until DB connectivity/schema is fixed.",
				e
			);
		}
		return false;
	}
}

async function notificationsSchemaAvailable(): Promise<boolean> {
	try {
		const rows = await query<{ id: number | null }>(
			`SELECT OBJECT_ID('dbo.maintenance_run_notifications', 'U') AS id`
		);
		return rows?.[0]?.id !== null;
	} catch {
		return false;
	}
}

async function assignedTasksForEngineer(runId: number, engineerId: number): Promise<string[]> {
	try {
		const rows = await query<{ label: string }>(
			`
			SELECT p.label
			FROM dbo.maintenance_run_checklist_assignments a
			JOIN dbo.maintenance_run_checklist_progress p
				ON p.run_id = a.run_id AND p.checklist_item_id = a.checklist_item_id
			WHERE a.run_id = @run_id AND a.engineer_id = @engineer_id
			ORDER BY a.checklist_item_id ASC
			`,
			(r) => {
				r.input("run_id", runId);
				r.input("engineer_id", engineerId);
			}
		);
		return rows.map((x) => String(x.label ?? "").trim()).filter(Boolean);
	} catch {
		return [];
	}
}

async function assignChecklistToEngineersTx(tx: any, runId: number) {
	// Assign checklist items to engineers (round-robin). Skip if schema not present.
	try {
		const ok = await queryTx<{ id: number | null }>(
			tx,
			`SELECT OBJECT_ID('dbo.maintenance_run_checklist_assignments', 'U') AS id`
		);
		if (ok?.[0]?.id === null) return;

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

		await queryTx(tx, `DELETE FROM dbo.maintenance_run_checklist_assignments WHERE run_id=@run_id`, (r) => r.input("run_id", runId));
		for (let i = 0; i < items.length; i++) {
			const engineerId = engineers[i % engineers.length].engineer_id;
			await queryTx(
				tx,
				`INSERT INTO dbo.maintenance_run_checklist_assignments(run_id, checklist_item_id, engineer_id) VALUES(@run_id, @checklist_item_id, @engineer_id)`,
				(r) => {
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

async function processDueTomorrowReminders() {
	if (!(await notificationsSchemaAvailable())) return;

	const dayRows = await query<{ tomorrow: string }>(
		`SELECT CONVERT(varchar(10), DATEADD(day, 1, CAST(GETDATE() AS date)), 23) AS tomorrow`
	);
	const tomorrow = dayRows?.[0]?.tomorrow;
	if (!tomorrow) return;

	const runs = await query<{
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
		SELECT
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
		WHERE r.status <> 'Complete'
			AND CONVERT(varchar(10), r.due_date, 23) = @tomorrow
		`,
		(r) => r.input("tomorrow", tomorrow)
	);

	let totalSent = 0;
	let totalSkipped = 0;

	for (const run of runs) {
		const recipients = await query<{ engineer_id: number; phone: string | null }>(
			`
			SELECT e.engineer_id, e.phone
			FROM dbo.maintenance_run_engineers re
			JOIN dbo.engineers e ON e.engineer_id = re.engineer_id
			WHERE re.run_id = @run_id
			`,
			(r) => r.input("run_id", run.run_id)
		);

		const serverLabel =
			[run.server_code, run.hostname].filter(Boolean).join(" ").trim() || `Server #${run.server_id}`;
		const baseMessage = [
			"SAM Maintenance Reminder",
			serverLabel,
			`Type: ${run.type_name}`,
			`Due: ${run.due_date}`,
		].join(" | ");

		for (const rec of recipients) {
			const phone = (rec.phone ?? "").trim();
			if (!phone) {
				totalSkipped += 1;
				continue;
			}

			const kind = "maintenance_due_tomorrow";
			const shouldSend = await withTransaction(async (tx) => {
				const rows = await queryTx<{ inserted: number }>(
					tx,
					`
					IF NOT EXISTS (
						SELECT 1
						FROM dbo.maintenance_run_notifications
						WHERE run_id=@run_id AND engineer_id=@engineer_id AND kind=@kind
					)
					BEGIN
						INSERT INTO dbo.maintenance_run_notifications(run_id, engineer_id, kind, sent_at, created_at)
						VALUES(@run_id, @engineer_id, @kind, NULL, GETDATE());
						SELECT 1 AS inserted;
					END
					ELSE
					BEGIN
						SELECT 0 AS inserted;
					END
					`,
					(r) => {
						r.input("run_id", run.run_id);
						r.input("engineer_id", rec.engineer_id);
						r.input("kind", kind);
					}
				);
				return rows?.[0]?.inserted === 1;
			});

			if (!shouldSend) {
				totalSkipped += 1;
				continue;
			}

			let message = baseMessage;
			const tasks = await assignedTasksForEngineer(run.run_id, rec.engineer_id);
			if (tasks.length > 0) {
				const max = 5;
				const shown = tasks.slice(0, max);
				const extra = tasks.length > max ? ` (+${tasks.length - max} more)` : "";
				message = `${baseMessage} | Your Tasks: ${shown.join("; ")}${extra}`;
			}

			try {
				await sendSmsPlaceholder({
					to: phone,
					message,
					kind,
					actor: "system",
					entity: "maintenance_runs",
					entityId: run.run_id,
					details: { run_id: run.run_id, schedule_id: run.schedule_id, engineer_id: rec.engineer_id },
				});
				totalSent += 1;
				await query(
					`
					UPDATE dbo.maintenance_run_notifications
					SET sent_at = GETDATE()
					WHERE run_id=@run_id AND engineer_id=@engineer_id AND kind=@kind
					`,
					(r) => {
						r.input("run_id", run.run_id);
						r.input("engineer_id", rec.engineer_id);
						r.input("kind", kind);
					}
				);
			} catch (e) {
				// allow retry later
				await query(
					`DELETE FROM dbo.maintenance_run_notifications WHERE run_id=@run_id AND engineer_id=@engineer_id AND kind=@kind AND sent_at IS NULL`,
					(r) => {
						r.input("run_id", run.run_id);
						r.input("engineer_id", rec.engineer_id);
						r.input("kind", kind);
					}
				);
				console.warn(`[maintenance-ops-scheduler] Reminder SMS failed engineer_id=${rec.engineer_id}:`, e);
			}
		}
	}

	if (totalSent || totalSkipped) {
		await audit({
			actor: "system",
			action: "REMINDERS_DUE_TOMORROW",
			entity: "maintenance_runs",
			entityId: null,
			details: { tomorrow, sent: totalSent, skipped: totalSkipped },
		});
	}
}

async function sendRunCreatedSms(runId: number) {
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
		(q) => q.input("run_id", runId)
	);
	const summary = summaryRows[0];
	if (!summary) return { sent: 0, skipped: 0 };

	const recipients = await query<{ engineer_id: number; phone: string | null }>(
		`
		SELECT e.engineer_id, e.phone
		FROM dbo.maintenance_run_engineers re
		JOIN dbo.engineers e ON e.engineer_id = re.engineer_id
		WHERE re.run_id = @run_id
		`,
		(q) => q.input("run_id", runId)
	);

	const serverLabel =
		[summary.server_code, summary.hostname].filter(Boolean).join(" ").trim() || `Server #${summary.server_id}`;
	const baseMessage = [
		"SAM Maintenance Run Created",
		serverLabel,
		`Type: ${summary.type_name}`,
		`Frequency: ${summary.frequency}`,
		`Due: ${summary.due_date}`,
	].join(" | ");

	let sent = 0;
	let skipped = 0;
	for (const r of recipients) {
		const phone = (r.phone ?? "").trim();
		if (!phone) {
			skipped += 1;
			continue;
		}
		let message = baseMessage;
		const tasks = await assignedTasksForEngineer(runId, r.engineer_id);
		if (tasks.length > 0) {
			const max = 5;
			const shown = tasks.slice(0, max);
			const extra = tasks.length > max ? ` (+${tasks.length - max} more)` : "";
			message = `${baseMessage} | Your Tasks: ${shown.join("; ")}${extra}`;
		}
		try {
			await sendSmsPlaceholder({
				to: phone,
				message,
				kind: "maintenance_run_created_auto",
				actor: "system",
				entity: "maintenance_runs",
				entityId: runId,
				details: { run_id: runId, schedule_id: summary.schedule_id, engineer_id: r.engineer_id },
			});
			sent += 1;
		} catch (e) {
			console.warn(`[maintenance-ops-scheduler] SMS failed engineer_id=${r.engineer_id}:`, e);
		}
	}

	await audit({
		actor: "system",
		action: "SMS_SENT",
		entity: "maintenance_runs",
		entityId: runId,
		details: { run_id: runId, schedule_id: summary.schedule_id, sent, skipped },
	});

	return { sent, skipped };
}

export async function processMaintenanceOpsDaily() {
	if (!(await ensureMaintenanceOpsSchema())) return;

	// Mark overdue runs (not complete, due_date < today)
	const overdue = await query<{ run_id: number }>(
		`
		UPDATE dbo.maintenance_runs
		SET status = 'Overdue', updated_at = GETDATE()
		OUTPUT INSERTED.run_id
		WHERE status <> 'Complete'
			AND due_date < CAST(GETDATE() AS date)
			AND status <> 'Overdue'
		`
	);

	if (overdue.length > 0) {
		await audit({
			actor: "system",
			action: "OVERDUE_MARKED",
			entity: "maintenance_runs",
			entityId: null,
			details: { count: overdue.length, run_ids: overdue.map((x) => x.run_id) },
		});
	}

	// Auto-renew: if schedule.next_due_date has a completed run, advance schedule and create next run.
	const dueSchedules = await query<{
		schedule_id: number;
		next_due_date: string;
		frequency: Frequency;
		maintenance_type_id: number;
	}>(
		`
		SELECT
			s.schedule_id,
			CONVERT(varchar(10), s.next_due_date, 23) AS next_due_date,
			s.frequency,
			s.maintenance_type_id
		FROM dbo.maintenance_schedules s
		WHERE s.is_active = 1
			AND s.next_due_date <= CAST(GETDATE() AS date)
			AND EXISTS (
				SELECT 1
				FROM dbo.maintenance_runs r
				WHERE r.schedule_id = s.schedule_id
					AND r.due_date = s.next_due_date
					AND r.status = 'Complete'
			)
		`
	);

	for (const s of dueSchedules) {
		const created = await withTransaction(async (tx) => {
			// Re-check inside tx to avoid races.
			const ok = await queryTx<{ schedule_id: number }>(
				tx,
				`
				SELECT TOP 1 s.schedule_id
				FROM dbo.maintenance_schedules s
				WHERE s.schedule_id = @schedule_id
					AND s.is_active = 1
					AND s.next_due_date <= CAST(GETDATE() AS date)
					AND EXISTS (
						SELECT 1
						FROM dbo.maintenance_runs r
						WHERE r.schedule_id = s.schedule_id
							AND r.due_date = s.next_due_date
							AND r.status = 'Complete'
					)
				`,
				(r) => r.input("schedule_id", s.schedule_id)
			);
			if (!ok[0]) return null;

			// Fast-forward next due date to >= today (telecom-grade: avoid creating a run for ancient dates).
			const todayRows = await queryTx<{ today: string }>(tx, `SELECT CONVERT(varchar(10), CAST(GETDATE() AS date), 23) AS today`);
			const today = todayRows?.[0]?.today ?? s.next_due_date;

			let next = addFrequency(s.next_due_date, s.frequency);
			while (next < today) {
				next = addFrequency(next, s.frequency);
			}

			await queryTx(
				tx,
				`UPDATE dbo.maintenance_schedules SET next_due_date = @next_due_date, updated_at = GETDATE() WHERE schedule_id = @schedule_id`,
				(r) => {
					r.input("schedule_id", s.schedule_id);
					r.input("next_due_date", next);
				}
			);

			const runRows = await queryTx<{ run_id: number }>(
				tx,
				`
				INSERT INTO dbo.maintenance_runs(schedule_id, due_date, status, created_at, updated_at)
				OUTPUT INSERTED.run_id
				VALUES(@schedule_id, @due_date, 'Active', GETDATE(), GETDATE())
				`,
				(r) => {
					r.input("schedule_id", s.schedule_id);
					r.input("due_date", next);
				}
			);
			const runId = runRows?.[0]?.run_id;
			if (!runId) throw new Error("Failed to create renewed run");

			// Snapshot engineers from schedule
			await queryTx(
				tx,
				`
				INSERT INTO dbo.maintenance_run_engineers(run_id, engineer_id)
				SELECT @run_id, se.engineer_id
				FROM dbo.maintenance_schedule_engineers se
				WHERE se.schedule_id = @schedule_id
				`,
				(r) => {
					r.input("run_id", runId);
					r.input("schedule_id", s.schedule_id);
				}
			);

			// Init checklist progress
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
				WHERE ci.maintenance_type_id = @maintenance_type_id
					AND ci.is_active = 1
				ORDER BY ci.sort_order ASC, ci.checklist_item_id ASC
				`,
				(r) => {
					r.input("run_id", runId);
					r.input("maintenance_type_id", s.maintenance_type_id);
				}
			);

			await assignChecklistToEngineersTx(tx, runId);

			return { runId, next_due_date: next };
		});

		if (created?.runId) {
			await audit({
				actor: "system",
				action: "AUTO_RENEW",
				entity: "maintenance_schedules",
				entityId: s.schedule_id,
				details: { schedule_id: s.schedule_id, new_run_id: created.runId, next_due_date: created.next_due_date },
			});

			await sendRunCreatedSms(created.runId);
		}
	}

	await processDueTomorrowReminders();
}

export function startMaintenanceOpsScheduler() {
	// “Cron-like”: run on startup and then hourly.
	void processMaintenanceOpsDaily().catch((e) => {
		console.warn("[maintenance-ops-scheduler] processMaintenanceOpsDaily failed:", e);
	});
	setInterval(() => {
		void processMaintenanceOpsDaily().catch((e) => {
			console.warn("[maintenance-ops-scheduler] processMaintenanceOpsDaily failed:", e);
		});
	}, 60 * 60 * 1000);
}
