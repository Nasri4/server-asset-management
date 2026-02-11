import { Router } from "express";
import { z } from "zod";
import sql from "mssql";
import { asyncHandler } from "../utils/asyncHandler";
import { ok, created } from "../utils/response";
import { requirePermission } from "../middleware/permissions";
import { validateBody } from "../middleware/validate";
import { query, queryTx, withTransaction } from "../db/sql";
import { HttpError } from "../middleware/error";
import { scopedTeamId } from "../utils/teamScope";
import { syncServerStatus } from "../utils/serverStatus";
import { emitIncidentEvent } from "../middleware/realtimeEmitter";
import { writeAuditActivityAndEmit } from "../services/auditService";

export const incidentsRouter = Router();

const createIncidentSchema = z.object({
  server_id: z.number().int().positive(),
  engineer_id: z.number().int().positive().optional(),
  incident_type: z.string().trim().min(1).optional(),
  // Allow both legacy (Major) and enterprise (High) labels.
  severity: z.enum(["Critical", "High", "Major", "Medium", "Low"]),
  description: z.string().trim().optional(),
  root_cause: z.string().trim().optional(),
  resolution: z.string().trim().optional(),
});

const updateIncidentSchema = z.object({
  engineer_id: z.number().int().positive().optional(),
  incident_type: z.string().trim().min(1).optional(),
  severity: z.enum(["Critical", "High", "Major", "Medium", "Low"]).optional(),
  status: z.enum(["Open", "InProgress", "Resolved", "Closed"]).optional(),
  description: z.string().trim().optional(),
  root_cause: z.string().trim().optional(),
  resolution: z.string().trim().optional(),
});

const resolveIncidentSchema = z.object({
  root_cause: z.string().trim().optional(),
  resolution: z.string().trim().min(1, "Resolution is required"),
  close: z.boolean().optional(),
});

type IncidentColumnSupport = {
  engineer_id: boolean;
  root_cause: boolean;
  resolution: boolean;
  reported_at: boolean;
  resolved_at: boolean;
  created_at: boolean;
  updated_at: boolean;
};

async function getIncidentColumnSupport(tx?: any): Promise<IncidentColumnSupport> {
  const sqlText = `
    SELECT
      CASE WHEN COL_LENGTH('dbo.server_incidents','engineer_id') IS NULL THEN 0 ELSE 1 END AS engineer_id,
      CASE WHEN COL_LENGTH('dbo.server_incidents','root_cause') IS NULL THEN 0 ELSE 1 END AS root_cause,
      CASE WHEN COL_LENGTH('dbo.server_incidents','resolution') IS NULL THEN 0 ELSE 1 END AS resolution,
      CASE WHEN COL_LENGTH('dbo.server_incidents','reported_at') IS NULL THEN 0 ELSE 1 END AS reported_at,
      CASE WHEN COL_LENGTH('dbo.server_incidents','resolved_at') IS NULL THEN 0 ELSE 1 END AS resolved_at,
      CASE WHEN COL_LENGTH('dbo.server_incidents','created_at') IS NULL THEN 0 ELSE 1 END AS created_at,
      CASE WHEN COL_LENGTH('dbo.server_incidents','updated_at') IS NULL THEN 0 ELSE 1 END AS updated_at
  `;

  const rows = tx
    ? await queryTx<{
        engineer_id: number;
        root_cause: number;
        resolution: number;
        reported_at: number;
        resolved_at: number;
        created_at: number;
        updated_at: number;
      }>(tx, sqlText)
    : await query<{
        engineer_id: number;
        root_cause: number;
        resolution: number;
        reported_at: number;
        resolved_at: number;
        created_at: number;
        updated_at: number;
      }>(sqlText);

  const r = rows?.[0];
  return {
    engineer_id: Boolean(r?.engineer_id),
    root_cause: Boolean(r?.root_cause),
    resolution: Boolean(r?.resolution),
    reported_at: Boolean(r?.reported_at),
    resolved_at: Boolean(r?.resolved_at),
    created_at: Boolean(r?.created_at),
    updated_at: Boolean(r?.updated_at),
  };
}

async function assertServerVisible(serverId: number, teamId: number | null) {
  const rows = await query<{ server_id: number }>(
    `SELECT TOP (1) server_id FROM dbo.servers WHERE server_id=@id AND (@team_id IS NULL OR team_id=@team_id)`,
    (r) => {
      r.input("id", sql.Int, serverId);
      r.input("team_id", sql.Int, teamId);
    }
  );
  if (!rows[0]) throw new HttpError(404, "Server not found", "SERVER_NOT_FOUND");
}

incidentsRouter.get(
  "/",
  requirePermission("incidents.read"),
  asyncHandler(async (req, res) => {
    const serverId = req.query.server_id ? Number(req.query.server_id) : null;
    const teamId = scopedTeamId(req);

    if (serverId) await assertServerVisible(serverId, teamId);

    const support = await getIncidentColumnSupport();

    const selectCols: string[] = [
      "i.incident_id",
      "i.server_id",
      "i.incident_type",
      "i.severity",
      "i.status",
      "i.description",
      support.engineer_id ? "i.engineer_id" : "CAST(NULL AS int) AS engineer_id",
      support.root_cause ? "i.root_cause" : "CAST(NULL AS nvarchar(max)) AS root_cause",
      support.resolution ? "i.resolution" : "CAST(NULL AS nvarchar(max)) AS resolution",
      support.reported_at ? "i.reported_at" : "CAST(NULL AS datetime) AS reported_at",
      support.resolved_at ? "i.resolved_at" : "CAST(NULL AS datetime) AS resolved_at",
      support.created_at ? "i.created_at" : "CAST(NULL AS datetime) AS created_at",
      support.updated_at ? "i.updated_at" : "CAST(NULL AS datetime) AS updated_at",
      "s.server_code",
      "s.hostname",
      support.engineer_id ? "e.full_name AS engineer_name" : "CAST(NULL AS nvarchar(200)) AS engineer_name",
    ];

    const fromJoin = support.engineer_id
      ? `
        FROM dbo.server_incidents i
        JOIN dbo.servers s ON s.server_id = i.server_id
        LEFT JOIN dbo.engineers e ON e.engineer_id = i.engineer_id
      `
      : `
        FROM dbo.server_incidents i
        JOIN dbo.servers s ON s.server_id = i.server_id
      `;

    const rows = await query(
      `
      SELECT TOP 200
        ${selectCols.join(",\n        ")}
      ${fromJoin}
      WHERE (@server_id IS NULL OR i.server_id=@server_id)
        AND (@team_id IS NULL OR s.team_id=@team_id)
      ORDER BY i.incident_id DESC;
      `,
      (r) => {
        r.input("server_id", sql.Int, serverId);
        r.input("team_id", sql.Int, teamId);
      }
    );

    return ok(res, rows);
  })
);

incidentsRouter.post(
  "/",
  requirePermission("incidents.create"),
  validateBody(createIncidentSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof createIncidentSchema>;
    const teamId = scopedTeamId(req);
    await assertServerVisible(body.server_id, teamId);

    const incidentId = await withTransaction(async (tx) => {
      const support = await getIncidentColumnSupport(tx);

      const cols: string[] = ["server_id", "incident_type", "severity", "status", "description"];
      const vals: string[] = [
        "@server_id",
        "@incident_type",
        "@severity",
        "'Open'",
        "@description",
      ];

      if (support.engineer_id) {
        cols.push("engineer_id");
        vals.push("@engineer_id");
      }
      if (support.root_cause) {
        cols.push("root_cause");
        vals.push("@root_cause");
      }
      if (support.resolution) {
        cols.push("resolution");
        vals.push("@resolution");
      }
      if (support.reported_at) {
        cols.push("reported_at");
        vals.push("GETDATE()");
      }
      if (support.created_at) {
        cols.push("created_at");
        vals.push("GETDATE()");
      }
      if (support.updated_at) {
        cols.push("updated_at");
        vals.push("GETDATE()");
      }

      const inserted = await queryTx<{ incident_id: number }>(
        tx,
        `
        INSERT INTO dbo.server_incidents (${cols.join(", ")})
        OUTPUT INSERTED.incident_id
        VALUES (${vals.join(", ")})
        `,
        (r) => {
          r.input("server_id", sql.Int, body.server_id);
          r.input("engineer_id", sql.Int, body.engineer_id ?? null);
          r.input("incident_type", sql.NVarChar, body.incident_type ?? null);
          r.input("severity", sql.NVarChar, body.severity);
          r.input("description", sql.NVarChar, body.description ?? null);
          r.input("root_cause", sql.NVarChar, body.root_cause ?? null);
          r.input("resolution", sql.NVarChar, body.resolution ?? null);
        }
      );

      const newId = inserted?.[0]?.incident_id ?? null;

      await syncServerStatus(body.server_id, tx);

      if (newId) {
        const afterRows = await queryTx<any>(
          tx,
          `SELECT TOP (1) * FROM dbo.server_incidents WHERE incident_id=@id`,
          (r) => r.input("id", sql.Int, newId)
        );
        const after = afterRows[0] ?? null;

        await writeAuditActivityAndEmit({
          tx,
          actorUserId: req.user!.userId,
          teamId: req.user!.teamId,
          action: "CREATE",
          entityType: "Incident",
          entityId: newId,
          before: null,
          after,
          activityMessage: "Incident created",
          activityAction: "created",
          serverId: body.server_id,
          ipAddress: req.ip,
          userAgent: String(req.headers["user-agent"] ?? "") || null
        });
      }
      
      // Emit real-time event
      if (newId) {
        const serverRows = await queryTx<{ team_id: number | null }>(
          tx,
          `SELECT TOP (1) team_id FROM dbo.servers WHERE server_id=@id`,
          (r) => r.input("id", sql.Int, body.server_id)
        );
        const serverTeamId = serverRows?.[0]?.team_id ?? undefined;

        await emitIncidentEvent(
          "created",
          newId,
          body.server_id,
          {
            severity: body.severity,
            incident_type: body.incident_type,
            description: body.description,
            status: "Open",
          },
          serverTeamId,
          req.user?.userId,
          tx
        );
      }

      return newId;
    });

    return created(res, { incident_id: incidentId });
  })
);

incidentsRouter.patch(
  "/:id",
  requirePermission("incidents.update"),
  validateBody(updateIncidentSchema),
  asyncHandler(async (req, res) => {
    const incidentId = Number(req.params.id);
    const body = req.body as z.infer<typeof updateIncidentSchema>;

    const rows = await query<{ server_id: number }>(
      `SELECT server_id FROM dbo.server_incidents WHERE incident_id=@id`,
      (r) => r.input("id", incidentId)
    );
    if (!rows[0]) throw new HttpError(404, "Incident not found", "INCIDENT_NOT_FOUND");

    const serverId = rows[0].server_id;
    const teamId = scopedTeamId(req);
    await assertServerVisible(serverId, teamId);

    // if resolved/closed, set resolved_at
    const resolvedAt =
      body.status && ["Resolved", "Closed"].includes(body.status) ? new Date() : null;

    await withTransaction(async (tx) => {
      const support = await getIncidentColumnSupport(tx);

      const beforeRows = await queryTx<any>(
        tx,
        `SELECT TOP (1) * FROM dbo.server_incidents WHERE incident_id=@id`,
        (r) => r.input("id", incidentId)
      );
      const before = beforeRows[0] ?? null;

      const setParts: string[] = [
        "incident_type = COALESCE(@incident_type, incident_type)",
        "severity      = COALESCE(@severity, severity)",
        "status        = COALESCE(@status, status)",
        "description   = COALESCE(@description, description)",
      ];

      if (support.engineer_id) {
        setParts.unshift("engineer_id   = COALESCE(@engineer_id, engineer_id)");
      }
      if (support.resolved_at) {
        setParts.push("resolved_at   = COALESCE(@resolved_at, resolved_at)");
      }
      if (support.root_cause) {
        setParts.push("root_cause    = COALESCE(@root_cause, root_cause)");
      }
      if (support.resolution) {
        setParts.push("resolution    = COALESCE(@resolution, resolution)");
      }
      if (support.updated_at) {
        setParts.push("updated_at    = SYSUTCDATETIME()");
      }

      if (setParts.length === 0) {
        throw new HttpError(400, "No updatable fields", "INCIDENT_NO_UPDATES");
      }

      await queryTx(
        tx,
        `
        UPDATE dbo.server_incidents
        SET
          ${setParts.join(",\n          ")}
        WHERE incident_id=@id
        `,
        (r) => {
          r.input("id", incidentId);
          r.input("engineer_id", body.engineer_id ?? null);
          r.input("incident_type", body.incident_type ?? null);
          r.input("severity", body.severity ?? null);
          r.input("status", body.status ?? null);
          r.input("description", body.description ?? null);
          r.input("resolved_at", resolvedAt);
          r.input("root_cause", body.root_cause ?? null);
          r.input("resolution", body.resolution ?? null);
        }
      );

      await syncServerStatus(serverId, tx);

      const afterRows = await queryTx<any>(
        tx,
        `SELECT TOP (1) * FROM dbo.server_incidents WHERE incident_id=@id`,
        (r) => r.input("id", incidentId)
      );
      const after = afterRows[0] ?? null;

      await writeAuditActivityAndEmit({
        tx,
        actorUserId: req.user!.userId,
        teamId: req.user!.teamId,
        action: "UPDATE",
        entityType: "Incident",
        entityId: incidentId,
        before,
        after,
        activityMessage: "Incident updated",
        activityAction: "updated",
        serverId,
        ipAddress: req.ip,
        userAgent: String(req.headers["user-agent"] ?? "") || null
      });
    });

    return ok(res, true);
  })
);

// Dedicated resolve endpoint (separate from generic edit)
incidentsRouter.post(
  "/:id/resolve",
  requirePermission("incidents.update"),
  validateBody(resolveIncidentSchema),
  asyncHandler(async (req, res) => {
    const incidentId = Number(req.params.id);
    const body = req.body as z.infer<typeof resolveIncidentSchema>;

    const rows = await query<{ server_id: number }>(
      `SELECT server_id FROM dbo.server_incidents WHERE incident_id=@id`,
      (r) => r.input("id", incidentId)
    );
    if (!rows[0]) throw new HttpError(404, "Incident not found", "INCIDENT_NOT_FOUND");

    const serverId = rows[0].server_id;
    const teamId = scopedTeamId(req);
    await assertServerVisible(serverId, teamId);

    await withTransaction(async (tx) => {
      const support = await getIncidentColumnSupport(tx);

      const beforeRows = await queryTx<any>(
        tx,
        `SELECT TOP (1) * FROM dbo.server_incidents WHERE incident_id=@id`,
        (r) => r.input("id", incidentId)
      );
      const before = beforeRows[0] ?? null;

      const setParts: string[] = [
        `status = @status`,
        support.resolved_at ? `resolved_at = COALESCE(resolved_at, GETDATE())` : "",
        support.updated_at ? `updated_at = SYSUTCDATETIME()` : "",
      ].filter(Boolean);

      if (support.root_cause) setParts.push(`root_cause = COALESCE(@root_cause, root_cause)`);
      if (support.resolution) setParts.push(`resolution = COALESCE(@resolution, resolution)`);

      await queryTx(
        tx,
        `
        UPDATE dbo.server_incidents
        SET
          ${setParts.join(",\n          ")}
        WHERE incident_id=@id
        `,
        (r) => {
          r.input("id", incidentId);
          r.input("status", body.close ? "Closed" : "Resolved");
          r.input("root_cause", body.root_cause ?? null);
          r.input("resolution", body.resolution ?? null);
        }
      );

      await syncServerStatus(serverId, tx);

      const afterRows = await queryTx<any>(
        tx,
        `SELECT TOP (1) * FROM dbo.server_incidents WHERE incident_id=@id`,
        (r) => r.input("id", incidentId)
      );
      const after = afterRows[0] ?? null;

      await writeAuditActivityAndEmit({
        tx,
        actorUserId: req.user!.userId,
        teamId: req.user!.teamId,
        action: "RESOLVE",
        entityType: "Incident",
        entityId: incidentId,
        before,
        after,
        activityMessage: body.close ? "Incident closed" : "Incident resolved",
        activityAction: body.close ? "closed" : "resolved",
        serverId,
        ipAddress: req.ip,
        userAgent: String(req.headers["user-agent"] ?? "") || null
      });
    });

    return ok(res, true);
  })
);

incidentsRouter.delete(
  "/:id",
  requirePermission("incidents.update"),
  asyncHandler(async (req, res) => {
    const incidentId = Number(req.params.id);

    const rows = await query<{ server_id: number }>(
      `SELECT server_id FROM dbo.server_incidents WHERE incident_id=@id`,
      (r) => r.input("id", incidentId)
    );
    if (!rows[0]) throw new HttpError(404, "Incident not found", "INCIDENT_NOT_FOUND");

    const serverId = rows[0].server_id;
    const teamId = scopedTeamId(req);
    await assertServerVisible(serverId, teamId);

    await withTransaction(async (tx) => {
      const beforeRows = await queryTx<any>(
        tx,
        `SELECT TOP (1) * FROM dbo.server_incidents WHERE incident_id=@id`,
        (r) => r.input("id", incidentId)
      );
      const before = beforeRows[0] ?? null;

      await queryTx(tx, `DELETE FROM dbo.server_incidents WHERE incident_id=@id`, (r) => r.input("id", incidentId));
      await syncServerStatus(serverId, tx);

      await writeAuditActivityAndEmit({
        tx,
        actorUserId: req.user!.userId,
        teamId: req.user!.teamId,
        action: "DELETE",
        entityType: "Incident",
        entityId: incidentId,
        before,
        after: null,
        activityMessage: "Incident deleted",
        activityAction: "deleted",
        serverId,
        ipAddress: req.ip,
        userAgent: String(req.headers["user-agent"] ?? "") || null
      });
    });

    return ok(res, true);
  })
);
