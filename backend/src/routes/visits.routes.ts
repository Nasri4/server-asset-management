import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../utils/asyncHandler";
import { requirePermission } from "../middleware/permissions";
import { validateBody } from "../middleware/validate";
import { query, queryTx, withTransaction } from "../db/sql";
import { created, ok } from "../utils/response";
import { HttpError } from "../middleware/error";
import { scopedTeamId } from "../utils/teamScope";
import { writeAuditActivityAndEmit } from "../services/auditService";
import { diffFields, summarizeChangeMessage } from "../utils/fieldDiff";

export const visitsRouter = Router();

type VisitTypeColumn = "visit_type" | "type" | "visitType";

async function hasColumn(table: string, column: string) {
  const rows = await query<{ len: number | null }>(
    "SELECT COL_LENGTH(@table, @column) AS len",
    (r) => {
      r.input("table", table);
      r.input("column", column);
    }
  );
  return rows?.[0]?.len != null;
}

async function getVisitTypeColumn(): Promise<VisitTypeColumn | null> {
  // Backward compatibility: some older schemas used `type` or `visitType`.
  if (await hasColumn("dbo.server_visits", "visit_type")) return "visit_type";
  if (await hasColumn("dbo.server_visits", "type")) return "type";
  if (await hasColumn("dbo.server_visits", "visitType")) return "visitType";
  return null;
}

function sqlVisitTypeSelect(col: VisitTypeColumn | null): string {
  if (col === "visit_type") return "v.visit_type";
  if (col === "type") return "v.[type] AS visit_type";
  if (col === "visitType") return "v.visitType AS visit_type";
  return "NULL AS visit_type";
}

function sqlVisitTypeColumn(col: VisitTypeColumn): string {
  return col === "type" ? "[type]" : col;
}

async function hasVisitEngineerIdColumn() {
  const rows = await query<{ len: number | null }>(
    "SELECT COL_LENGTH('dbo.server_visits','engineer_id') AS len"
  );
  return rows?.[0]?.len != null;
}

async function hasVisitNotesColumn() {
  const rows = await query<{ len: number | null }>(
    "SELECT COL_LENGTH('dbo.server_visits','visit_notes') AS len"
  );
  return rows?.[0]?.len != null;
}

/**
 * GET /api/visits?server_id=
 * Permission: visits.read
 */
visitsRouter.get(
  "/",
  requirePermission("visits.read"),
  asyncHandler(async (req, res) => {
    const serverId = req.query.server_id ? Number(req.query.server_id) : null;
    const teamId = scopedTeamId(req);

    const visitTypeCol = await getVisitTypeColumn();
    const hasEngineer = await hasVisitEngineerIdColumn();
    const hasNotes = await hasVisitNotesColumn();

    const sqlText = hasEngineer
      ? `
        SELECT TOP 500
          v.visit_id, v.server_id, s.server_code, s.hostname,
          ${sqlVisitTypeSelect(visitTypeCol)}, v.visit_date,
          v.engineer_id,
          e.full_name AS engineer_name,
          ${hasNotes ? "v.visit_notes AS visit_notes" : "v.notes AS visit_notes"},
          v.created_at, v.updated_at
        FROM dbo.server_visits v
        JOIN dbo.servers s ON s.server_id = v.server_id
        LEFT JOIN dbo.engineers e ON e.engineer_id = v.engineer_id
        WHERE (@team_id IS NULL OR s.team_id = @team_id)
          AND (@server_id IS NULL OR v.server_id = @server_id)
        ORDER BY v.visit_id DESC
        `
      : `
        SELECT TOP 500
          v.visit_id, v.server_id, s.server_code, s.hostname,
          ${sqlVisitTypeSelect(visitTypeCol)}, v.visit_date,
          NULL AS engineer_id,
          v.engineer_name,
          v.notes AS visit_notes,
          v.created_at, v.updated_at
        FROM dbo.server_visits v
        JOIN dbo.servers s ON s.server_id = v.server_id
        WHERE (@team_id IS NULL OR s.team_id = @team_id)
          AND (@server_id IS NULL OR v.server_id = @server_id)
        ORDER BY v.visit_id DESC
        `;

    const rows = await query(sqlText, (r) => {
      r.input("server_id", serverId);
      r.input("team_id", teamId);
    });

    return ok(res, rows);
  })
);

const createSchema = z.object({
  server_id: z.number().int().positive(),
  visit_type: z.string().trim().min(1),
  visit_date: z.string().trim().min(1), // YYYY-MM-DD or ISO string
  engineer_id: z.number().int().positive(),
  visit_notes: z.string().trim().min(1)
});

/**
 * POST /api/visits
 * Permission: visits.manage
 */
visitsRouter.post(
  "/",
  requirePermission("visits.manage"),
  validateBody(createSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof createSchema>;
    const teamId = scopedTeamId(req);

    const visitTypeCol = await getVisitTypeColumn();
    if (!visitTypeCol) {
      throw new HttpError(
        400,
        "Visits are not supported by the current database schema. Add dbo.server_visits.visit_type (or map an existing column like type/visitType).",
        "VISIT_TYPE_NOT_SUPPORTED"
      );
    }

    const hasEngineer = await hasVisitEngineerIdColumn();
    if (!hasEngineer) {
      throw new HttpError(
        400,
        "Engineer selection for visits is not supported by the current database schema. Add dbo.server_visits.engineer_id and FK to dbo.engineers.",
        "VISIT_ENGINEER_NOT_SUPPORTED"
      );
    }

    const serverRows = await query<{ team_id: number | null }>(
      "SELECT TOP (1) team_id FROM dbo.servers WHERE server_id = @server_id AND (@team_id IS NULL OR team_id = @team_id)",
      (r) => {
        r.input("server_id", body.server_id);
        r.input("team_id", teamId);
      }
    );
    if (!serverRows[0]) throw new HttpError(404, "Server not found", "SERVER_NOT_FOUND");

    const engRows = await query<{ engineer_id: number; team_id: number | null }>(
      "SELECT engineer_id, team_id FROM dbo.engineers WHERE engineer_id = @engineer_id",
      (r) => r.input("engineer_id", body.engineer_id)
    );
    if (!engRows[0]) throw new HttpError(404, "Engineer not found", "ENGINEER_NOT_FOUND");
    if (serverRows[0].team_id != null && engRows[0].team_id != null && serverRows[0].team_id !== engRows[0].team_id) {
      throw new HttpError(400, "Engineer must belong to the selected server team", "ENGINEER_TEAM_MISMATCH");
    }

    const hasNotes = await hasVisitNotesColumn();

    const visitTypeColumnSql = sqlVisitTypeColumn(visitTypeCol);

    const visitId = await withTransaction(async (tx) => {
      const rows = await queryTx<{ visit_id: number }>(
        tx,
        hasNotes
          ? `
            INSERT INTO dbo.server_visits
              (server_id, ${visitTypeColumnSql}, visit_date, engineer_id, visit_notes, created_at, updated_at)
            OUTPUT INSERTED.visit_id
            VALUES
              (@server_id, @visit_type, @visit_date, @engineer_id, @visit_notes, GETDATE(), GETDATE())
            `
          : `
            INSERT INTO dbo.server_visits
              (server_id, ${visitTypeColumnSql}, visit_date, engineer_id, notes, created_at, updated_at)
            OUTPUT INSERTED.visit_id
            VALUES
              (@server_id, @visit_type, @visit_date, @engineer_id, @visit_notes, GETDATE(), GETDATE())
            `,
        (r) => {
          r.input("server_id", body.server_id);
          r.input("visit_type", body.visit_type);
          r.input("visit_date", body.visit_date);
          r.input("engineer_id", body.engineer_id);
          r.input("visit_notes", body.visit_notes);
        }
      );

      const newId = Number(rows?.[0]?.visit_id ?? 0);
      const afterRows = await queryTx<any>(
        tx,
        `SELECT TOP (1) * FROM dbo.server_visits WHERE visit_id = @id`,
        (r) => r.input("id", newId)
      );
      const afterRow = afterRows[0] ?? null;

      const canonicalAfter = afterRow
        ? {
            visit_type: afterRow[visitTypeCol],
            visit_date: afterRow.visit_date,
            engineer_id: afterRow.engineer_id,
            visit_notes: hasNotes ? afterRow.visit_notes : afterRow.notes
          }
        : null;

      const changes = diffFields(null, canonicalAfter as any, ["visit_type", "visit_date", "engineer_id", "visit_notes"]);

      await writeAuditActivityAndEmit({
        tx,
        actorUserId: req.user!.userId,
        teamId: req.user!.teamId,
        action: "CREATE",
        entityType: "Visit",
        entityId: newId || body.server_id,
        before: null,
        after: canonicalAfter,
        activityMessage: "Visit created",
        activityAction: "created",
        activityMeta: { changes },
        serverId: body.server_id,
        ipAddress: req.ip,
        userAgent: String(req.headers["user-agent"] ?? "") || null
      });

      return newId;
    });

    return created(res, { visit_id: visitId });
  })
);

const updateSchema = z.object({
  visit_type: z.string().trim().min(1).optional(),
  visit_date: z.string().trim().min(1).optional(),
  engineer_id: z.number().int().positive().optional(),
  visit_notes: z.string().trim().min(1).optional()
});

/**
 * PATCH /api/visits/:id
 * Permission: visits.manage
 */
visitsRouter.patch(
  "/:id",
  requirePermission("visits.manage"),
  validateBody(updateSchema),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = req.body as z.infer<typeof updateSchema>;
    const teamId = scopedTeamId(req);

    // Team isolation: return 404 if visit belongs to another team.
    const visible = await query<{ visit_id: number }>(
      `
      SELECT TOP (1) v.visit_id
      FROM dbo.server_visits v
      JOIN dbo.servers s ON s.server_id = v.server_id
      WHERE v.visit_id = @id
        AND (@team_id IS NULL OR s.team_id = @team_id)
      `,
      (r) => {
        r.input("id", id);
        r.input("team_id", teamId);
      }
    );
    if (!visible[0]) throw new HttpError(404, "Visit not found", "VISIT_NOT_FOUND");

    const visitTypeCol = await getVisitTypeColumn();
    if (!visitTypeCol) {
      throw new HttpError(
        400,
        "Visits are not supported by the current database schema. Add dbo.server_visits.visit_type (or map an existing column like type/visitType).",
        "VISIT_TYPE_NOT_SUPPORTED"
      );
    }

    const hasEngineer = await hasVisitEngineerIdColumn();
    const hasNotes = await hasVisitNotesColumn();

    if (typeof body.engineer_id === "number") {
      if (!hasEngineer) {
        throw new HttpError(
          400,
          "Engineer selection for visits is not supported by the current database schema. Add dbo.server_visits.engineer_id and FK to dbo.engineers.",
          "VISIT_ENGINEER_NOT_SUPPORTED"
        );
      }

      const current = await query<{ server_id: number }>(
        "SELECT TOP (1) server_id FROM dbo.server_visits WHERE visit_id = @id",
        (r) => r.input("id", id)
      );
      if (!current[0]) throw new HttpError(404, "Visit not found", "VISIT_NOT_FOUND");

      const serverRows = await query<{ team_id: number | null }>(
        "SELECT TOP (1) team_id FROM dbo.servers WHERE server_id = @server_id AND (@team_id IS NULL OR team_id = @team_id)",
        (r) => {
          r.input("server_id", current[0].server_id);
          r.input("team_id", teamId);
        }
      );
      if (!serverRows[0]) throw new HttpError(404, "Server not found", "SERVER_NOT_FOUND");
      const engRows = await query<{ engineer_id: number; team_id: number | null }>(
        "SELECT engineer_id, team_id FROM dbo.engineers WHERE engineer_id = @engineer_id",
        (r) => r.input("engineer_id", body.engineer_id)
      );
      if (!engRows[0]) throw new HttpError(404, "Engineer not found", "ENGINEER_NOT_FOUND");
      if (serverRows[0]?.team_id != null && engRows[0].team_id != null && serverRows[0].team_id !== engRows[0].team_id) {
        throw new HttpError(400, "Engineer must belong to the selected server team", "ENGINEER_TEAM_MISMATCH");
      }
    }

    await withTransaction(async (tx) => {
      const beforeRows = await queryTx<any>(
        tx,
        `SELECT TOP (1) * FROM dbo.server_visits WHERE visit_id = @id`,
        (r) => r.input("id", id)
      );
      const beforeRow = beforeRows[0];
      if (!beforeRow) throw new HttpError(404, "Visit not found", "VISIT_NOT_FOUND");

      await queryTx(
        tx,
        `
        UPDATE dbo.server_visits
        SET
          ${sqlVisitTypeColumn(visitTypeCol)} = COALESCE(@visit_type, ${sqlVisitTypeColumn(visitTypeCol)}),
          visit_date = COALESCE(@visit_date, visit_date),
          ${hasEngineer ? "engineer_id = COALESCE(@engineer_id, engineer_id)," : ""}
          ${hasNotes ? "visit_notes = COALESCE(@visit_notes, visit_notes)," : "notes = COALESCE(@visit_notes, notes),"}
          updated_at = GETDATE()
        WHERE visit_id = @id
        `,
        (r) => {
          r.input("id", id);
          r.input("visit_type", body.visit_type ?? null);
          r.input("visit_date", body.visit_date ?? null);
          if (hasEngineer) r.input("engineer_id", body.engineer_id ?? null);
          r.input("visit_notes", body.visit_notes ?? null);
        }
      );

      const afterRows = await queryTx<any>(
        tx,
        `SELECT TOP (1) * FROM dbo.server_visits WHERE visit_id = @id`,
        (r) => r.input("id", id)
      );
      const afterRow = afterRows[0] ?? null;

      const canonicalBefore = {
        visit_type: beforeRow[visitTypeCol],
        visit_date: beforeRow.visit_date,
        engineer_id: hasEngineer ? beforeRow.engineer_id : null,
        visit_notes: hasNotes ? beforeRow.visit_notes : beforeRow.notes
      };
      const canonicalAfter = afterRow
        ? {
            visit_type: afterRow[visitTypeCol],
            visit_date: afterRow.visit_date,
            engineer_id: hasEngineer ? afterRow.engineer_id : null,
            visit_notes: hasNotes ? afterRow.visit_notes : afterRow.notes
          }
        : null;

      const changes = diffFields(canonicalBefore as any, canonicalAfter as any, ["visit_type", "visit_date", "engineer_id", "visit_notes"]);
      const msg = summarizeChangeMessage("Visit", changes);

      await writeAuditActivityAndEmit({
        tx,
        actorUserId: req.user!.userId,
        teamId: req.user!.teamId,
        action: "UPDATE",
        entityType: "Visit",
        entityId: id,
        before: canonicalBefore,
        after: canonicalAfter,
        activityMessage: msg,
        activityAction: "updated",
        activityMeta: { changes },
        serverId: Number(beforeRow.server_id ?? null),
        ipAddress: req.ip,
        userAgent: String(req.headers["user-agent"] ?? "") || null
      });
    });

    return ok(res, true);
  })
);

/**
 * DELETE /api/visits/:id
 * Permission: visits.manage
 */
visitsRouter.delete(
  "/:id",
  requirePermission("visits.manage"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const teamId = scopedTeamId(req);

    const visible = await query<{ visit_id: number }>(
      `
      SELECT TOP (1) v.visit_id
      FROM dbo.server_visits v
      JOIN dbo.servers s ON s.server_id = v.server_id
      WHERE v.visit_id = @id
        AND (@team_id IS NULL OR s.team_id = @team_id)
      `,
      (r) => {
        r.input("id", id);
        r.input("team_id", teamId);
      }
    );
    if (!visible[0]) throw new HttpError(404, "Visit not found", "VISIT_NOT_FOUND");

    const visitTypeCol = await getVisitTypeColumn();
    const hasEngineer = await hasVisitEngineerIdColumn();
    const hasNotes = await hasVisitNotesColumn();

    await withTransaction(async (tx) => {
      const beforeRows = await queryTx<any>(
        tx,
        `SELECT TOP (1) * FROM dbo.server_visits WHERE visit_id = @id`,
        (r) => r.input("id", id)
      );
      const beforeRow = beforeRows[0] ?? null;

      await queryTx(
        tx,
        `DELETE FROM dbo.server_visits WHERE visit_id = @id`,
        (r) => r.input("id", id)
      );

      const canonicalBefore = beforeRow && visitTypeCol
        ? {
            visit_type: beforeRow[visitTypeCol],
            visit_date: beforeRow.visit_date,
            engineer_id: hasEngineer ? beforeRow.engineer_id : null,
            visit_notes: hasNotes ? beforeRow.visit_notes : beforeRow.notes
          }
        : beforeRow;

      await writeAuditActivityAndEmit({
        tx,
        actorUserId: req.user!.userId,
        teamId: req.user!.teamId,
        action: "DELETE",
        entityType: "Visit",
        entityId: id,
        before: canonicalBefore,
        after: null,
        activityMessage: "Visit deleted",
        activityAction: "deleted",
        activityMeta: canonicalBefore
          ? { changes: diffFields(canonicalBefore as any, null as any, ["visit_type", "visit_date", "engineer_id", "visit_notes"]) }
          : null,
        serverId: Number(beforeRow?.server_id ?? null),
        ipAddress: req.ip,
        userAgent: String(req.headers["user-agent"] ?? "") || null
      });
    });

    return ok(res, true);
  })
);
