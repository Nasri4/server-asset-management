/**
 * V2 ENHANCEMENTS FOR SERVERS ROUTER
 * 
 * Additional routes and middleware to be integrated into servers.routes.ts:
 * 1. POST /api/servers/:id/status/recompute - Recompute server status
 * 2. POST /api/servers/:id/status/override - Set manual status override
 * 3. DELETE /api/servers/:id/status/override - Clear status override
 * 4. GET /api/servers/:id/activity - Get server activity timeline
 * 5. Real-time event emissions for all server operations
 */

import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../utils/asyncHandler";
import { ok } from "../utils/response";
import { requirePermission } from "../middleware/permissions";
import { validateBody } from "../middleware/validate";
import { HttpError } from "../middleware/error";
import { scopedTeamId } from "../utils/teamScope";
import { query } from "../db/sql";
import { 
  recomputeServerStatus, 
  setStatusOverride, 
  clearStatusOverride,
  type ServerStatus 
} from "../utils/serverStatusV2";
import { realtimeService } from "../services/realtimeService";
import { writeAuditAndActivity } from "../services/auditService";

async function hasActivitiesColumn(name: string) {
  const rows = await query<{ len: number | null }>(
    "SELECT COL_LENGTH('dbo.Activities', @col) AS len",
    (r) => r.input("col", name)
  );
  return rows?.[0]?.len != null;
}

function parseLimit(v: unknown, fallback: number) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(100, Math.floor(n));
}

function parseOffset(v: unknown) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

export const serversV2EnhancementsRouter = Router();

/**
 * Helper to check server visibility (team scoping)
 */
async function assertServerVisible(serverId: number, teamId: number | null): Promise<any> {
  const rows = await query<any>(
    `
    SELECT TOP (1) s.*, t.team_name
    FROM dbo.servers s
    LEFT JOIN dbo.teams t ON s.team_id = t.team_id
    WHERE s.server_id = @server_id
      AND (@team_id IS NULL OR s.team_id = @team_id)
    `,
    (r) => {
      r.input("server_id", serverId);
      r.input("team_id", teamId);
    }
  );
  if (!rows[0]) throw new HttpError(404, "Server not found", "SERVER_NOT_FOUND");
  return rows[0];
}

/**
 * POST /api/servers/:id/status/recompute
 * Manually trigger status recomputation
 */
serversV2EnhancementsRouter.post(
  "/:id/status/recompute",
  requirePermission("servers.update"),
  asyncHandler(async (req, res) => {
    const serverId = parseInt(req.params.id);
    const teamId = scopedTeamId(req);
    const userId = req.user?.userId;
    
    // Verify server exists and is visible
    const server = await assertServerVisible(serverId, teamId);
    
    // Recompute status
    const result = await recomputeServerStatus(serverId, userId);
    
    // Emit real-time event if status changed
    if (result.changed) {
      realtimeService.emitServerEvent(
        "status.changed",
        serverId,
        {
          oldStatus: server.status,
          newStatus: result.status,
          reason: result.reason,
          server_code: server.server_code,
          hostname: server.hostname
        },
        server.team_id
      );
    }
    
    ok(res, {
      serverId,
      status: result.status,
      reason: result.reason,
      changed: result.changed
    });
  })
);

/**
 * POST /api/servers/:id/status/override
 * Set manual status override (requires admin)
 */
const statusOverrideSchema = z.object({
  status: z.enum([
    "Active",
    "Maintenance",
    "Degraded",
    "Offline",
    "Incident",
    "Under Visit",
    "Down",
    "Issue",
    "Warning"
  ]),
  reason: z.string().optional()
});

serversV2EnhancementsRouter.post(
  "/:id/status/override",
  requirePermission("SERVER_STATUS_UPDATE"),
  validateBody(statusOverrideSchema),
  asyncHandler(async (req, res) => {
    const serverId = parseInt(req.params.id);
    const teamId = scopedTeamId(req);
    const userId = req.user?.userId;
    
    if (!userId) {
      throw new HttpError(401, "User ID required", "UNAUTHORIZED");
    }
    
    // Verify server exists and is visible
    const server = await assertServerVisible(serverId, teamId);

    const before = await query<any>(
      `SELECT TOP 1 * FROM dbo.servers WHERE server_id=@id`,
      (r) => r.input("id", serverId)
    );
    
    const { status, reason } = req.body;
    
    // Set override
    await setStatusOverride(serverId, status as ServerStatus, userId, reason);

    const after = await query<any>(
      `SELECT TOP 1 * FROM dbo.servers WHERE server_id=@id`,
      (r) => r.input("id", serverId)
    );

    await writeAuditAndActivity({
      actorUserId: userId,
      teamId: server.team_id ?? null,
      action: "SERVER_STATUS_UPDATE",
      entityType: "Server",
      entityId: String(serverId),
      before: before[0] ?? null,
      after: after[0] ?? null,
      activityMessage: `Status override set: ${server.status} → ${status}`,
      ipAddress: req.ip,
      userAgent: String(req.headers["user-agent"] ?? "") || null
    });
    
    // Emit real-time event
    realtimeService.emitServerEvent(
      "status.changed",
      serverId,
      {
        oldStatus: server.status,
        newStatus: status,
        reason: `Manual override: ${reason || "No reason provided"}`,
        override: true,
        server_code: server.server_code,
        hostname: server.hostname
      },
      server.team_id
    );
    
    ok(res, {
      serverId,
      status,
      overrideSet: true,
      message: "Status override set successfully"
    });
  })
);

/**
 * DELETE /api/servers/:id/status/override
 * Clear manual status override
 */
serversV2EnhancementsRouter.delete(
  "/:id/status/override",
  requirePermission("SERVER_STATUS_UPDATE"),
  asyncHandler(async (req, res) => {
    const serverId = parseInt(req.params.id);
    const teamId = scopedTeamId(req);
    const userId = req.user?.userId;
    
    if (!userId) {
      throw new HttpError(401, "User ID required", "UNAUTHORIZED");
    }
    
    // Verify server exists and is visible
    const server = await assertServerVisible(serverId, teamId);

    const before = await query<any>(
      `SELECT TOP 1 * FROM dbo.servers WHERE server_id=@id`,
      (r) => r.input("id", serverId)
    );
    
    // Clear override and recompute
    const result = await clearStatusOverride(serverId, userId);

    const after = await query<any>(
      `SELECT TOP 1 * FROM dbo.servers WHERE server_id=@id`,
      (r) => r.input("id", serverId)
    );

    await writeAuditAndActivity({
      actorUserId: userId,
      teamId: server.team_id ?? null,
      action: "SERVER_STATUS_UPDATE",
      entityType: "Server",
      entityId: String(serverId),
      before: before[0] ?? null,
      after: after[0] ?? null,
      activityMessage: `Status override cleared: ${server.status} → ${result.status}`,
      ipAddress: req.ip,
      userAgent: String(req.headers["user-agent"] ?? "") || null
    });
    
    // Emit real-time event
    realtimeService.emitServerEvent(
      "status.changed",
      serverId,
      {
        oldStatus: server.status,
        newStatus: result.status,
        reason: `Override cleared: ${result.reason}`,
        override: false,
        server_code: server.server_code,
        hostname: server.hostname
      },
      server.team_id
    );
    
    ok(res, {
      serverId,
      status: result.status,
      reason: result.reason,
      overrideCleared: true,
      message: "Status override cleared, status recomputed"
    });
  })
);

/**
 * GET /api/servers/:id/activity
 * Get server activity timeline
 */
serversV2EnhancementsRouter.get(
  "/:id/activity",
  requirePermission("ACTIVITY_VIEW"),
  asyncHandler(async (req, res) => {
    const serverId = parseInt(req.params.id);
    const teamId = scopedTeamId(req);
    const limit = parseLimit(req.query.limit, 50);
    const offset = parseOffset(req.query.offset);
    
    // Verify server exists and is visible
    await assertServerVisible(serverId, teamId);
    
    // Recent Activity (required): query real dbo.Activities with actor joins.
    // Includes:
    // - any activities with server_id = serverId (preferred, supports all related entities)
    // - legacy fallback for older rows:
    //   - server-level activities (entity_type = 'Server', entity_id = serverId)
    //   - maintenance activities for this server (entity_type = 'Maintenance', entity_id in server_maintenance)
    const serverEntityId = String(serverId);

    const hasServerIdCol = await hasActivitiesColumn("server_id");
    const hasActionCol = await hasActivitiesColumn("action");
    const hasMetaCol = await hasActivitiesColumn("meta_json");

    const whereParts: string[] = [];
    if (hasServerIdCol) {
      whereParts.push("(a.server_id = @server_id)");
    }
    whereParts.push("(a.entity_type = 'Server' AND a.entity_id = @server_entity_id)");
    whereParts.push(
      `(
        a.entity_type = 'Maintenance'
        AND a.entity_id IN (
          SELECT CAST(m.maintenance_id AS NVARCHAR(100))
          FROM dbo.server_maintenance m
          WHERE m.server_id = @server_id
        )
      )`
    );

    const whereClause = whereParts.join("\n        OR ");

    const totalRows = await query<{ total: number }>(
      `
      SELECT COUNT(1) AS total
      FROM dbo.Activities a
      WHERE (
        ${whereClause}
      )
      `,
      (r) => {
        r.input("server_entity_id", serverEntityId);
        r.input("server_id", serverId);
      }
    );

    const total = totalRows[0]?.total ?? 0;

    const rows = await query(
      `
      SELECT
        a.activity_id,
        a.team_id,
        a.actor_user_id,
        a.message,
        a.entity_type,
        a.entity_id,
        ${hasServerIdCol ? "a.server_id" : "CAST(NULL AS INT) AS server_id"},
        ${hasActionCol ? "a.action" : "CAST(NULL AS NVARCHAR(50)) AS action"},
        ${hasMetaCol ? "a.meta_json" : "CAST(NULL AS NVARCHAR(MAX)) AS meta_json"},
        a.created_at,

        u.user_id AS actor_user_id2,
        u.full_name AS actor_full_name,
        r.role_name AS actor_role_name,
        u.team_id AS actor_team_id,
        t.team_name AS actor_team_name
      FROM dbo.Activities a
      LEFT JOIN dbo.Users u ON u.user_id = a.actor_user_id
      LEFT JOIN dbo.roles r ON r.role_id = u.role_id
      LEFT JOIN dbo.teams t ON t.team_id = u.team_id
      WHERE (
        ${whereClause}
      )
      ORDER BY a.created_at DESC
      OFFSET @offset ROWS
      FETCH NEXT @limit ROWS ONLY
      `,
      (r) => {
        r.input("server_entity_id", serverEntityId);
        r.input("server_id", serverId);
        r.input("offset", offset);
        r.input("limit", limit);
      }
    );

    const activities = rows.map((row: any) => ({
      activity_id: row.activity_id,
      team_id: row.team_id,
      server_id: row.server_id ?? null,
      action: row.action ?? null,
      message: row.message,
      entity_type: row.entity_type,
      entity_id: row.entity_id,
      meta_json: row.meta_json ?? null,
      created_at: row.created_at,
      actor: row.actor_user_id2
        ? {
            user_id: row.actor_user_id2,
            full_name: row.actor_full_name,
            role_name: row.actor_role_name,
            team_id: row.actor_team_id,
            team_name: row.actor_team_name
          }
        : null
    }));

    ok(res, {
      activities,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    });
  })
);

/**
 * GET /api/servers/:id/audits
 * Audit timeline (Admin global; TeamLead team-only; Engineer denied)
 */
serversV2EnhancementsRouter.get(
  "/:id/audits",
  requirePermission("AUDIT_VIEW"),
  asyncHandler(async (req, res) => {
    const role = String((req.user as any)?.roleName ?? "");
    if (role.toLowerCase() === "engineer") {
      throw new HttpError(403, "Audit access denied", "AUDIT_ACCESS_DENIED");
    }

    const serverId = parseInt(req.params.id);
    const teamId = scopedTeamId(req);
    const limit = parseLimit(req.query.limit, 50);
    const offset = parseOffset(req.query.offset);

    await assertServerVisible(serverId, teamId);

    const serverEntityId = String(serverId);

    const totalRows = await query<{ total: number }>(
      `
      SELECT COUNT(1) AS total
      FROM dbo.AuditLogs al
      WHERE (
        (al.entity_type = 'Server' AND al.entity_id = @server_entity_id)
        OR (
          al.entity_type = 'Maintenance'
          AND al.entity_id IN (
            SELECT CAST(m.maintenance_id AS NVARCHAR(100))
            FROM dbo.server_maintenance m
            WHERE m.server_id = @server_id
          )
        )
      )
      `,
      (r) => {
        r.input("server_entity_id", serverEntityId);
        r.input("server_id", serverId);
      }
    );

    const total = totalRows[0]?.total ?? 0;

    const rows = await query(
      `
      SELECT
        al.audit_id,
        al.actor_user_id,
        al.action,
        al.entity_type,
        al.entity_id,
        al.team_id,
        al.before_json,
        al.after_json,
        al.ip_address,
        al.user_agent,
        al.created_at,

        u.user_id AS actor_user_id2,
        u.full_name AS actor_full_name,
        r.role_name AS actor_role_name,
        u.team_id AS actor_team_id,
        t.team_name AS actor_team_name
      FROM dbo.AuditLogs al
      LEFT JOIN dbo.Users u ON u.user_id = al.actor_user_id
      LEFT JOIN dbo.roles r ON r.role_id = u.role_id
      LEFT JOIN dbo.teams t ON t.team_id = u.team_id
      WHERE (
        (al.entity_type = 'Server' AND al.entity_id = @server_entity_id)
        OR (
          al.entity_type = 'Maintenance'
          AND al.entity_id IN (
            SELECT CAST(m.maintenance_id AS NVARCHAR(100))
            FROM dbo.server_maintenance m
            WHERE m.server_id = @server_id
          )
        )
      )
      ORDER BY al.created_at DESC
      OFFSET @offset ROWS
      FETCH NEXT @limit ROWS ONLY
      `,
      (r) => {
        r.input("server_entity_id", serverEntityId);
        r.input("server_id", serverId);
        r.input("offset", offset);
        r.input("limit", limit);
      }
    );

    const audits = rows.map((row: any) => ({
      audit_id: row.audit_id,
      action: row.action,
      entity_type: row.entity_type,
      entity_id: row.entity_id,
      team_id: row.team_id,
      before: row.before_json ? JSON.parse(row.before_json) : null,
      after: row.after_json ? JSON.parse(row.after_json) : null,
      ip_address: row.ip_address,
      user_agent: row.user_agent,
      created_at: row.created_at,
      actor: row.actor_user_id2
        ? {
            user_id: row.actor_user_id2,
            full_name: row.actor_full_name,
            role_name: row.actor_role_name,
            team_id: row.actor_team_id,
            team_name: row.actor_team_name
          }
        : null
    }));

    ok(res, {
      audits,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    });
  })
);

/**
 * Middleware: Emit real-time event after server creation
 * (To be called from servers.routes.ts after creating a server)
 */
export function emitServerCreated(
  serverId: number,
  serverData: any,
  teamId?: number
): void {
  realtimeService.emitServerEvent(
    "created",
    serverId,
    {
      server_code: serverData.server_code,
      hostname: serverData.hostname,
      server_type: serverData.server_type,
      environment: serverData.environment,
      status: serverData.status || "Active"
    },
    teamId
  );
}

/**
 * Middleware: Emit real-time event after server update
 * (To be called from servers.routes.ts after updating a server)
 */
export function emitServerUpdated(
  serverId: number,
  oldData: any,
  newData: any,
  teamId?: number
): void {
  realtimeService.emitServerEvent(
    "updated",
    serverId,
    {
      server_code: newData.server_code,
      hostname: newData.hostname,
      changes: Object.keys(newData).filter(key => oldData[key] !== newData[key])
    },
    teamId
  );
}

/**
 * Middleware: Emit real-time event after server deletion
 * (To be called from servers.routes.ts after deleting a server)
 */
export function emitServerDeleted(
  serverId: number,
  serverData: any,
  teamId?: number
): void {
  realtimeService.emitServerEvent(
    "deleted",
    serverId,
    {
      server_code: serverData.server_code,
      hostname: serverData.hostname
    },
    teamId
  );
}
