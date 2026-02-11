import type sql from "mssql";
import { query, queryTx } from "../db/sql";

export type ServerStatus = "Active" | "Maintenance" | "Down" | "Degraded" | "Issue" | "Warning";

const OPEN_INCIDENT_STATUSES = ["open", "inprogress", "in progress", "investigating", "mitigating"] as const;

function normalizeText(v: unknown): string {
	return String(v ?? "").trim().toLowerCase();
}

async function hasServersStatusColumn(tx?: sql.Transaction): Promise<boolean> {
	const sqlText = "SELECT COL_LENGTH('dbo.servers','status') AS len";
	const rows = tx ? await queryTx<{ len: number | null }>(tx, sqlText) : await query<{ len: number | null }>(sqlText);
	return rows?.[0]?.len != null;
}

/**
 * computeServerStatus(server_id)
 * Backend source-of-truth status intelligence.
 *
 * Priority:
 * 1) Open incidents (severity priority): Critical->Down, High/Major->Degraded, Medium->Issue, Low->Warning
 * 2) Active maintenance (scheduled/started and not completed; due today) -> Maintenance
 * 3) Else -> Active
 */
export async function computeServerStatus(serverId: number, tx?: sql.Transaction): Promise<ServerStatus> {
	const runQuery = async <T>(sqlText: string, input?: (req: any) => void): Promise<T[]> => {
		if (tx) return queryTx<T>(tx, sqlText, input);
		return query<T>(sqlText, input);
	};

	const [incidentAgg] = await runQuery<{ best_sev_rank: number | null }>(
		`
		DECLARE @best INT = NULL;

		IF OBJECT_ID('dbo.server_incidents','U') IS NOT NULL
		BEGIN
			SELECT TOP 1
				@best = MIN(
					CASE
						WHEN LTRIM(RTRIM(ISNULL(severity,''))) IN ('Critical') THEN 1
						WHEN LTRIM(RTRIM(ISNULL(severity,''))) IN ('High','Major') THEN 2
						WHEN LTRIM(RTRIM(ISNULL(severity,''))) IN ('Medium') THEN 3
						WHEN LTRIM(RTRIM(ISNULL(severity,''))) IN ('Low') THEN 4
						ELSE 99
					END
				)
			FROM dbo.server_incidents
			WHERE server_id = @server_id
				AND LOWER(LTRIM(RTRIM(ISNULL(status,'')))) IN (
					'open','inprogress','in progress','investigating','mitigating'
				);
		END

		SELECT @best AS best_sev_rank;
		`,
		(r) => r.input("server_id", serverId)
	);

	const sevRank = incidentAgg?.best_sev_rank == null ? null : Number(incidentAgg.best_sev_rank);
	if (sevRank === 1) return "Down";
	if (sevRank === 2) return "Degraded";
	if (sevRank === 3) return "Issue";
	if (sevRank === 4) return "Warning";

	const [maintenanceAgg] = await runQuery<{ has_active: number }>(
		`
		DECLARE @hasMaint BIT = 0;
		DECLARE @today DATE = CAST(GETDATE() AS DATE);

		IF OBJECT_ID('dbo.server_maintenance','U') IS NOT NULL
		BEGIN
			-- In progress and not completed
			IF EXISTS (
				SELECT 1
				FROM dbo.server_maintenance
				WHERE server_id = @server_id
					AND (
						(status = 'InProgress' AND completed_at IS NULL)
						OR (
							status = 'Scheduled'
							AND scheduled_start IS NOT NULL
							AND CAST(scheduled_start AS DATE) = @today
							AND (scheduled_end IS NULL OR scheduled_end >= scheduled_start)
						)
					)
			)
				SET @hasMaint = 1;
		END

		-- Advanced maintenance ops (optional)
		IF @hasMaint = 0
			AND OBJECT_ID('dbo.maintenance_runs','U') IS NOT NULL
			AND OBJECT_ID('dbo.maintenance_schedules','U') IS NOT NULL
		BEGIN
			IF EXISTS (
				SELECT 1
				FROM dbo.maintenance_runs r
				JOIN dbo.maintenance_schedules s ON s.schedule_id = r.schedule_id
				WHERE s.server_id = @server_id
					AND r.status IN ('Active','Incomplete','Overdue')
					AND CAST(r.due_date AS date) = @today
			)
				SET @hasMaint = 1;
		END

		SELECT CASE WHEN @hasMaint = 1 THEN 1 ELSE 0 END AS has_active;
		`,
		(r) => r.input("server_id", serverId)
	);

	const hasActiveMaintenance = Number(maintenanceAgg?.has_active ?? 0) === 1;
	if (hasActiveMaintenance) return "Maintenance";

	return "Active";
}

/**
 * syncServerStatus(server_id)
 * Computes and persists servers.status when the column exists.
 */
export async function syncServerStatus(serverId: number, tx?: sql.Transaction): Promise<ServerStatus> {
	const nextStatus = await computeServerStatus(serverId, tx);
	const canPersist = await hasServersStatusColumn(tx);
	if (!canPersist) return nextStatus;

	if (tx) {
		await queryTx(
			tx,
			`
			UPDATE dbo.servers
			SET status = @status, updated_at = GETDATE()
			WHERE server_id = @server_id
				AND (status IS NULL OR status <> @status);
			`,
			(r) => {
				r.input("server_id", serverId);
				r.input("status", nextStatus);
			}
		);
		return nextStatus;
	}

	await query(
		`
		UPDATE dbo.servers
		SET status = @status, updated_at = GETDATE()
		WHERE server_id = @server_id
			AND (status IS NULL OR status <> @status);
		`,
		(r) => {
			r.input("server_id", serverId);
			r.input("status", nextStatus);
		}
	);

	return nextStatus;
}

// Backward compatibility with older imports.
export async function recalculateServerStatus(serverId: number, tx?: sql.Transaction): Promise<void> {
	await syncServerStatus(serverId, tx);
}
