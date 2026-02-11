import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../utils/asyncHandler";
import { ok, created } from "../utils/response";
import { requirePermission } from "../middleware/permissions";
import { validateBody } from "../middleware/validate";
import { query, queryTx, withTransaction } from "../db/sql";
import { audit } from "../utils/audit";
import { HttpError } from "../middleware/error";
import { scopedTeamId } from "../utils/teamScope";
import { syncServerStatus } from "../utils/serverStatus";
import { writeAuditAndActivity } from "../services/auditService";

export const maintenanceRouter = Router();

const createSchema = z.object({
  server_id: z.number().int().positive(),
  maintenance_type: z.string().trim().min(1).optional(),
  scheduled_start: z.string().optional(),
  scheduled_end: z.string().optional(),
  notes: z.string().optional(),
});

const updateSchema = z.object({
  status: z.enum(["Scheduled","InProgress","Completed","Cancelled"]).optional(),
  notes: z.string().optional(),
});

async function assertServerVisible(serverId: number, teamId: number | null) {
  const rows = await query<{ server_id: number }>(
    `SELECT TOP (1) server_id FROM dbo.servers WHERE server_id=@id AND (@team_id IS NULL OR team_id=@team_id)`,
    (r) => {
      r.input("id", serverId);
      r.input("team_id", teamId);
    }
  );
  if (!rows[0]) throw new HttpError(404, "Server not found", "SERVER_NOT_FOUND");
}

async function getServerTeamId(serverId: number) {
  const rows = await query<{ team_id: number | null }>(
    `SELECT TOP (1) team_id FROM dbo.servers WHERE server_id=@id`,
    (r) => r.input("id", serverId)
  );
  if (!rows[0]) throw new HttpError(404, "Server not found", "SERVER_NOT_FOUND");
  if (rows[0].team_id == null) throw new HttpError(409, "Server missing team", "SERVER_TEAM_MISSING");
  return rows[0].team_id;
}

maintenanceRouter.get(
  "/",
  requirePermission("MAINTENANCE_VIEW"),
  asyncHandler(async (req, res) => {
    const serverId = req.query.server_id ? Number(req.query.server_id) : null;
    const teamId = scopedTeamId(req);
    if (serverId) await assertServerVisible(serverId, teamId);

    const rows = await query(
      `
      SELECT TOP 200 m.*
      FROM dbo.server_maintenance m
      JOIN dbo.servers s ON s.server_id = m.server_id
      WHERE (@server_id IS NULL OR m.server_id=@server_id)
        AND (@team_id IS NULL OR s.team_id=@team_id)
      ORDER BY m.maintenance_id DESC
      `,
      (r) => {
        r.input("server_id", serverId);
        r.input("team_id", teamId);
      }
    );

    return ok(res, rows);
  })
);

maintenanceRouter.post(
  "/",
  requirePermission("MAINTENANCE_CREATE"),
  validateBody(createSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof createSchema>;
    const scopeTeamId = scopedTeamId(req);
    await assertServerVisible(body.server_id, scopeTeamId);
    const serverTeamId = await getServerTeamId(body.server_id);

    const actorUserId = Number((req.user as any)?.userId ?? NaN);
    if (!Number.isFinite(actorUserId) || actorUserId <= 0) {
      throw new HttpError(401, "User ID required", "UNAUTHORIZED");
    }

    const maintenanceId = await withTransaction(async (tx) => {
      const inserted = await queryTx<{ maintenance_id: number }>(
        tx,
        `
        INSERT INTO dbo.server_maintenance
          (server_id, team_id, created_by_user_id, maintenance_type, status, scheduled_start, scheduled_end, notes, started_at, created_at, updated_at)
        OUTPUT INSERTED.maintenance_id
        VALUES
          (@server_id, @team_id, @created_by_user_id, @maintenance_type, 'Scheduled', @scheduled_start, @scheduled_end, @notes, NULL, GETDATE(), GETDATE())
        `,
        (r) => {
          r.input("server_id", body.server_id);
          r.input("team_id", serverTeamId);
          r.input("created_by_user_id", actorUserId);
          r.input("maintenance_type", body.maintenance_type ?? null);
          r.input("scheduled_start", body.scheduled_start ? new Date(body.scheduled_start) : null);
          r.input("scheduled_end", body.scheduled_end ? new Date(body.scheduled_end) : null);
          r.input("notes", body.notes ?? null);
        }
      );

      const newId = inserted?.[0]?.maintenance_id ?? null;

      await syncServerStatus(body.server_id, tx);

      await audit({
        actor: req.user!.username,
        action: "CREATE",
        entity: "server_maintenance",
        entityId: newId ?? body.server_id,
        details: body,
        tx,
      });

      const after = await queryTx<any>(
        tx,
        `SELECT TOP 1 * FROM dbo.server_maintenance WHERE maintenance_id = @id`,
        (r) => r.input("id", newId)
      );

      await writeAuditAndActivity({
        tx,
        actorUserId,
        teamId: serverTeamId,
        action: "MAINTENANCE_CREATE",
        entityType: "Maintenance",
        entityId: String(newId),
        before: null,
        after: after[0] ?? null,
        activityMessage: `Maintenance scheduled for server #${body.server_id}`,
        ipAddress: req.ip,
        userAgent: String(req.headers["user-agent"] ?? "") || null
      });

      // Also write a server-level activity for easy server dialog queries
      await writeAuditAndActivity({
        tx,
        actorUserId,
        teamId: serverTeamId,
        action: "MAINTENANCE_CREATE",
        entityType: "Server",
        entityId: String(body.server_id),
        before: null,
        after: { maintenance_id: newId },
        activityMessage: `Maintenance created (#${newId})`,
        ipAddress: req.ip,
        userAgent: String(req.headers["user-agent"] ?? "") || null
      });

      return newId;
    });

    return created(res, { maintenance_id: maintenanceId });
  })
);

maintenanceRouter.patch(
  "/:id",
  requirePermission("MAINTENANCE_UPDATE"),
  validateBody(updateSchema),
  asyncHandler(async (req, res) => {
    const maintenanceId = Number(req.params.id);
    const body = req.body as z.infer<typeof updateSchema>;

    const actorUserId = Number((req.user as any)?.userId ?? NaN);
    const roleName = String((req.user as any)?.roleName ?? "");
    if (!Number.isFinite(actorUserId) || actorUserId <= 0) {
      throw new HttpError(401, "User ID required", "UNAUTHORIZED");
    }

    const rows = await query<{ server_id: number; status: string; created_by_user_id: number | null; assigned_to_user_id: number | null }>(
      `SELECT server_id, status, created_by_user_id, assigned_to_user_id FROM dbo.server_maintenance WHERE maintenance_id=@id`,
      (r) => r.input("id", maintenanceId)
    );
    if (!rows[0]) throw new HttpError(404, "Maintenance not found", "MAINTENANCE_NOT_FOUND");

    const serverId = rows[0].server_id;
    const scopeTeamId = scopedTeamId(req);
    await assertServerVisible(serverId, scopeTeamId);
    const serverTeamId = await getServerTeamId(serverId);

    // Engineer ownership enforcement: must be creator or assigned.
    if (roleName.toLowerCase() === "engineer") {
      const createdBy = rows[0].created_by_user_id;
      const assignedTo = rows[0].assigned_to_user_id;
      const allowed = (createdBy != null && createdBy === actorUserId) || (assignedTo != null && assignedTo === actorUserId);
      if (!allowed) {
        throw new HttpError(403, "You can only update maintenance you created or that is assigned to you", "MAINTENANCE_NOT_OWNED");
      }
    }

    const startedAt = body.status === "InProgress" ? new Date() : null;
    const completedAt = body.status === "Completed" ? new Date() : null;

    await withTransaction(async (tx) => {
      const before = await queryTx<any>(
        tx,
        `SELECT TOP 1 * FROM dbo.server_maintenance WHERE maintenance_id=@id`,
        (r) => r.input("id", maintenanceId)
      );

      await queryTx(
        tx,
        `
        UPDATE dbo.server_maintenance
        SET
          status       = COALESCE(@status, status),
          notes        = COALESCE(@notes, notes),
          started_at   = CASE WHEN @status = 'InProgress' AND started_at IS NULL THEN COALESCE(@started_at, started_at) ELSE started_at END,
          completed_at = CASE WHEN @status = 'Completed'  AND completed_at IS NULL THEN COALESCE(@completed_at, completed_at) ELSE completed_at END,
          updated_at   = SYSUTCDATETIME()
        WHERE maintenance_id=@id
        `,
        (r) => {
          r.input("id", maintenanceId);
          r.input("status", body.status ?? null);
          r.input("notes", body.notes ?? null);
          r.input("started_at", startedAt);
          r.input("completed_at", completedAt);
        }
      );

      await syncServerStatus(serverId, tx);

      await audit({
        actor: req.user!.username,
        action: "UPDATE",
        entity: "server_maintenance",
        entityId: maintenanceId,
        details: body,
        tx,
      });

      const after = await queryTx<any>(
        tx,
        `SELECT TOP 1 * FROM dbo.server_maintenance WHERE maintenance_id=@id`,
        (r) => r.input("id", maintenanceId)
      );

      await writeAuditAndActivity({
        tx,
        actorUserId,
        teamId: serverTeamId,
        action: "MAINTENANCE_UPDATE",
        entityType: "Maintenance",
        entityId: String(maintenanceId),
        before: before[0] ?? null,
        after: after[0] ?? null,
        activityMessage: `Maintenance updated (#${maintenanceId})`,
        ipAddress: req.ip,
        userAgent: String(req.headers["user-agent"] ?? "") || null
      });

      await writeAuditAndActivity({
        tx,
        actorUserId,
        teamId: serverTeamId,
        action: "MAINTENANCE_UPDATE",
        entityType: "Server",
        entityId: String(serverId),
        before: null,
        after: { maintenance_id: maintenanceId },
        activityMessage: `Maintenance updated (#${maintenanceId})`,
        ipAddress: req.ip,
        userAgent: String(req.headers["user-agent"] ?? "") || null
      });
    });

    return ok(res, true);
  })
);

maintenanceRouter.delete(
  "/:id",
  requirePermission("MAINTENANCE_UPDATE"),
  asyncHandler(async (req, res) => {
    const maintenanceId = Number(req.params.id);

    const actorUserId = Number((req.user as any)?.userId ?? NaN);
    const roleName = String((req.user as any)?.roleName ?? "");
    if (!Number.isFinite(actorUserId) || actorUserId <= 0) {
      throw new HttpError(401, "User ID required", "UNAUTHORIZED");
    }

    const rows = await query<{ server_id: number; created_by_user_id: number | null; assigned_to_user_id: number | null }>(
      `SELECT server_id, created_by_user_id, assigned_to_user_id FROM dbo.server_maintenance WHERE maintenance_id=@id`,
      (r) => r.input("id", maintenanceId)
    );
    if (!rows[0]) throw new HttpError(404, "Maintenance not found", "MAINTENANCE_NOT_FOUND");

    const serverId = rows[0].server_id;
    const scopeTeamId = scopedTeamId(req);
    await assertServerVisible(serverId, scopeTeamId);
    const serverTeamId = await getServerTeamId(serverId);

    if (roleName.toLowerCase() === "engineer") {
      const createdBy = rows[0].created_by_user_id;
      const assignedTo = rows[0].assigned_to_user_id;
      const allowed = (createdBy != null && createdBy === actorUserId) || (assignedTo != null && assignedTo === actorUserId);
      if (!allowed) {
        throw new HttpError(403, "You can only delete maintenance you created or that is assigned to you", "MAINTENANCE_NOT_OWNED");
      }
    }

    await withTransaction(async (tx) => {
      const before = await queryTx<any>(
        tx,
        `SELECT TOP 1 * FROM dbo.server_maintenance WHERE maintenance_id=@id`,
        (r) => r.input("id", maintenanceId)
      );

      await queryTx(tx, `DELETE FROM dbo.server_maintenance WHERE maintenance_id=@id`, (r) => r.input("id", maintenanceId));
      await syncServerStatus(serverId, tx);
      await audit({
        actor: req.user!.username,
        action: "DELETE",
        entity: "server_maintenance",
        entityId: maintenanceId,
        details: { maintenance_id: maintenanceId },
        tx,
      });

      await writeAuditAndActivity({
        tx,
        actorUserId,
        teamId: serverTeamId,
        action: "MAINTENANCE_DELETE",
        entityType: "Maintenance",
        entityId: String(maintenanceId),
        before: before[0] ?? null,
        after: null,
        activityMessage: `Maintenance deleted (#${maintenanceId})`,
        ipAddress: req.ip,
        userAgent: String(req.headers["user-agent"] ?? "") || null
      });

      await writeAuditAndActivity({
        tx,
        actorUserId,
        teamId: serverTeamId,
        action: "MAINTENANCE_DELETE",
        entityType: "Server",
        entityId: String(serverId),
        before: null,
        after: { maintenance_id: maintenanceId },
        activityMessage: `Maintenance deleted (#${maintenanceId})`,
        ipAddress: req.ip,
        userAgent: String(req.headers["user-agent"] ?? "") || null
      });
    });

    return ok(res, true);
  })
);

/**
 * POST /api/maintenance/:id/approve
 * TeamLead/Admin only, within team
 */
maintenanceRouter.post(
  "/:id/approve",
  requirePermission("MAINTENANCE_APPROVE"),
  asyncHandler(async (req, res) => {
    const maintenanceId = Number(req.params.id);
    const actorUserId = Number((req.user as any)?.userId ?? NaN);
    const roleName = String((req.user as any)?.roleName ?? "");
    if (roleName.toLowerCase() === "engineer") {
      throw new HttpError(403, "Maintenance approval denied", "MAINTENANCE_APPROVE_DENIED");
    }
    if (!Number.isFinite(actorUserId) || actorUserId <= 0) {
      throw new HttpError(401, "User ID required", "UNAUTHORIZED");
    }

    const row = await query<{ server_id: number }>(
      `SELECT TOP 1 server_id FROM dbo.server_maintenance WHERE maintenance_id=@id`,
      (r) => r.input("id", maintenanceId)
    );
    if (!row[0]) throw new HttpError(404, "Maintenance not found", "MAINTENANCE_NOT_FOUND");

    const serverId = row[0].server_id;
    const scopeTeamId = scopedTeamId(req);
    await assertServerVisible(serverId, scopeTeamId);
    const serverTeamId = await getServerTeamId(serverId);

    await withTransaction(async (tx) => {
      const before = await queryTx<any>(
        tx,
        `SELECT TOP 1 * FROM dbo.server_maintenance WHERE maintenance_id=@id`,
        (r) => r.input("id", maintenanceId)
      );

      await queryTx(
        tx,
        `
        UPDATE dbo.server_maintenance
        SET
          approved_by_user_id = @actor_user_id,
          approved_at = COALESCE(approved_at, SYSUTCDATETIME()),
          status = CASE WHEN status = 'Scheduled' THEN 'InProgress' ELSE status END,
          started_at = CASE WHEN status = 'Scheduled' AND started_at IS NULL THEN SYSUTCDATETIME() ELSE started_at END,
          updated_at = SYSUTCDATETIME()
        WHERE maintenance_id=@id
        `,
        (r) => {
          r.input("id", maintenanceId);
          r.input("actor_user_id", actorUserId);
        }
      );

      await syncServerStatus(serverId, tx);

      const after = await queryTx<any>(
        tx,
        `SELECT TOP 1 * FROM dbo.server_maintenance WHERE maintenance_id=@id`,
        (r) => r.input("id", maintenanceId)
      );

      await writeAuditAndActivity({
        tx,
        actorUserId,
        teamId: serverTeamId,
        action: "MAINTENANCE_APPROVE",
        entityType: "Maintenance",
        entityId: String(maintenanceId),
        before: before[0] ?? null,
        after: after[0] ?? null,
        activityMessage: `Maintenance approved (#${maintenanceId})`,
        ipAddress: req.ip,
        userAgent: String(req.headers["user-agent"] ?? "") || null
      });

      await writeAuditAndActivity({
        tx,
        actorUserId,
        teamId: serverTeamId,
        action: "MAINTENANCE_APPROVE",
        entityType: "Server",
        entityId: String(serverId),
        before: null,
        after: { maintenance_id: maintenanceId },
        activityMessage: `Maintenance approved (#${maintenanceId})`,
        ipAddress: req.ip,
        userAgent: String(req.headers["user-agent"] ?? "") || null
      });
    });

    ok(res, true);
  })
);

/**
 * POST /api/maintenance/:id/close
 * TeamLead/Admin only, within team
 */
maintenanceRouter.post(
  "/:id/close",
  requirePermission("MAINTENANCE_CLOSE"),
  asyncHandler(async (req, res) => {
    const maintenanceId = Number(req.params.id);
    const actorUserId = Number((req.user as any)?.userId ?? NaN);
    const roleName = String((req.user as any)?.roleName ?? "");
    if (roleName.toLowerCase() === "engineer") {
      throw new HttpError(403, "Maintenance close denied", "MAINTENANCE_CLOSE_DENIED");
    }
    if (!Number.isFinite(actorUserId) || actorUserId <= 0) {
      throw new HttpError(401, "User ID required", "UNAUTHORIZED");
    }

    const row = await query<{ server_id: number }>(
      `SELECT TOP 1 server_id FROM dbo.server_maintenance WHERE maintenance_id=@id`,
      (r) => r.input("id", maintenanceId)
    );
    if (!row[0]) throw new HttpError(404, "Maintenance not found", "MAINTENANCE_NOT_FOUND");

    const serverId = row[0].server_id;
    const scopeTeamId = scopedTeamId(req);
    await assertServerVisible(serverId, scopeTeamId);
    const serverTeamId = await getServerTeamId(serverId);

    await withTransaction(async (tx) => {
      const before = await queryTx<any>(
        tx,
        `SELECT TOP 1 * FROM dbo.server_maintenance WHERE maintenance_id=@id`,
        (r) => r.input("id", maintenanceId)
      );

      await queryTx(
        tx,
        `
        UPDATE dbo.server_maintenance
        SET
          closed_by_user_id = @actor_user_id,
          closed_at = COALESCE(closed_at, SYSUTCDATETIME()),
          status = 'Completed',
          completed_at = COALESCE(completed_at, SYSUTCDATETIME()),
          updated_at = SYSUTCDATETIME()
        WHERE maintenance_id=@id
        `,
        (r) => {
          r.input("id", maintenanceId);
          r.input("actor_user_id", actorUserId);
        }
      );

      await syncServerStatus(serverId, tx);

      const after = await queryTx<any>(
        tx,
        `SELECT TOP 1 * FROM dbo.server_maintenance WHERE maintenance_id=@id`,
        (r) => r.input("id", maintenanceId)
      );

      await writeAuditAndActivity({
        tx,
        actorUserId,
        teamId: serverTeamId,
        action: "MAINTENANCE_CLOSE",
        entityType: "Maintenance",
        entityId: String(maintenanceId),
        before: before[0] ?? null,
        after: after[0] ?? null,
        activityMessage: `Maintenance closed (#${maintenanceId})`,
        ipAddress: req.ip,
        userAgent: String(req.headers["user-agent"] ?? "") || null
      });

      await writeAuditAndActivity({
        tx,
        actorUserId,
        teamId: serverTeamId,
        action: "MAINTENANCE_CLOSE",
        entityType: "Server",
        entityId: String(serverId),
        before: null,
        after: { maintenance_id: maintenanceId },
        activityMessage: `Maintenance closed (#${maintenanceId})`,
        ipAddress: req.ip,
        userAgent: String(req.headers["user-agent"] ?? "") || null
      });
    });

    ok(res, true);
  })
);
