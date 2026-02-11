/**
 * HORMUUD TELECOM - ACTIVITY LOGGER
 * 
 * Comprehensive activity logging for all server-related actions
 */

import { query, queryTx } from "../db/sql";
import type sql from "mssql";

/**
 * Log server activity
 * 
 * @param serverId - Server ID
 * @param actorUserId - User who performed the action (null for system)
 * @param actionType - Type of action (e.g., "created", "updated", "deleted")
 * @param entityType - Entity type (e.g., "server", "incident", "maintenance")
 * @param entityId - Entity ID
 * @param message - Human-readable message
 * @param isSensitive - Whether activity contains sensitive info (credentials, etc)
 * @param metadata - Additional JSON metadata
 * @param tx - Optional transaction
 */
export async function logServerActivity(
  serverId: number,
  actorUserId: number | null,
  actionType: string,
  entityType: string,
  entityId: number | null,
  message: string,
  isSensitive: boolean = false,
  metadata?: Record<string, any>,
  tx?: sql.Transaction
): Promise<void> {
  
  // Get actor role if user provided
  let actorRole: string | null = null;
  
  if (actorUserId) {
    const sqlText = `
      SELECT r.role_name
      FROM dbo.Users u
      JOIN dbo.roles r ON u.role_id = r.role_id
      WHERE u.user_id = @user_id
    `;
    
    const rows = tx
      ? await queryTx<{ role_name: string }>(tx, sqlText, (r) => r.input("user_id", actorUserId))
      : await query<{ role_name: string }>(sqlText, (r) => r.input("user_id", actorUserId));
    
    actorRole = rows[0]?.role_name || null;
  }
  
  const insertSql = `
    INSERT INTO dbo.server_activity (
      server_id,
      actor_user_id,
      actor_role,
      action_type,
      entity_type,
      entity_id,
      message,
      metadata,
      is_sensitive,
      created_at
    )
    VALUES (
      @server_id,
      @actor_user_id,
      @actor_role,
      @action_type,
      @entity_type,
      @entity_id,
      @message,
      @metadata,
      @is_sensitive,
      GETDATE()
    )
  `;
  
  const params = (r: any) => {
    r.input("server_id", serverId);
    r.input("actor_user_id", actorUserId);
    r.input("actor_role", actorRole);
    r.input("action_type", actionType);
    r.input("entity_type", entityType);
    r.input("entity_id", entityId);
    r.input("message", message);
    r.input("metadata", metadata ? JSON.stringify(metadata) : null);
    r.input("is_sensitive", isSensitive);
  };
  
  if (tx) {
    await queryTx(tx, insertSql, params);
  } else {
    await query(insertSql, params);
  }
}

/**
 * Get server activity with redaction based on user role
 */
export async function getServerActivity(
  serverId: number,
  userRoleName: string,
  userId: number,
  limit: number = 50,
  offset: number = 0
): Promise<any[]> {
  const sqlText = `
    SELECT 
      sa.activity_id,
      sa.server_id,
      sa.actor_user_id,
      sa.actor_role,
      sa.action_type,
      sa.entity_type,
      sa.entity_id,
      CASE 
        WHEN sa.is_sensitive = 1 AND sa.actor_user_id <> @user_id AND @role_name = 'Engineer' 
        THEN '[Sensitive action - details hidden]'
        ELSE sa.message
      END AS message,
      sa.metadata,
      sa.is_sensitive,
      sa.created_at,
      u.username AS actor_username,
      u.full_name AS actor_full_name
    FROM dbo.server_activity sa
    LEFT JOIN dbo.Users u ON sa.actor_user_id = u.user_id
    WHERE sa.server_id = @server_id
    ORDER BY sa.created_at DESC
    OFFSET @offset ROWS
    FETCH NEXT @limit ROWS ONLY
  `;
  
  return query(sqlText, (r) => {
    r.input("server_id", serverId);
    r.input("user_id", userId);
    r.input("role_name", userRoleName);
    r.input("limit", limit);
    r.input("offset", offset);
  });
}

/**
 * Common activity logging helpers
 */

export async function logServerCreated(
  serverId: number,
  userId: number,
  serverCode: string,
  hostname: string,
  tx?: sql.Transaction
): Promise<void> {
  await logServerActivity(
    serverId,
    userId,
    "created",
    "server",
    serverId,
    `Server ${serverCode} (${hostname}) created`,
    false,
    { server_code: serverCode, hostname },
    tx
  );
}

export async function logServerUpdated(
  serverId: number,
  userId: number,
  changes: Record<string, any>,
  tx?: sql.Transaction
): Promise<void> {
  const changedFields = Object.keys(changes).join(", ");
  await logServerActivity(
    serverId,
    userId,
    "updated",
    "server",
    serverId,
    `Server updated: ${changedFields}`,
    false,
    { changes },
    tx
  );
}

export async function logMaintenanceScheduled(
  serverId: number,
  userId: number,
  maintenanceId: number,
  assignedEngineerId: number | null,
  scheduleType: string,
  tx?: sql.Transaction
): Promise<void> {
  await logServerActivity(
    serverId,
    userId,
    "scheduled",
    "maintenance",
    maintenanceId,
    `Maintenance scheduled (${scheduleType})${assignedEngineerId ? ` - assigned to engineer ${assignedEngineerId}` : ""}`,
    false,
    { maintenance_id: maintenanceId, schedule_type: scheduleType, assigned_engineer_id: assignedEngineerId },
    tx
  );
}

export async function logMaintenanceCompleted(
  serverId: number,
  userId: number,
  maintenanceId: number,
  tx?: sql.Transaction
): Promise<void> {
  await logServerActivity(
    serverId,
    userId,
    "completed",
    "maintenance",
    maintenanceId,
    "Maintenance completed",
    false,
    { maintenance_id: maintenanceId },
    tx
  );
}

export async function logIncidentCreated(
  serverId: number,
  userId: number,
  incidentId: number,
  severity: string,
  summary: string,
  tx?: sql.Transaction
): Promise<void> {
  await logServerActivity(
    serverId,
    userId,
    "created",
    "incident",
    incidentId,
    `${severity} incident created: ${summary}`,
    false,
    { incident_id: incidentId, severity, summary },
    tx
  );
}

export async function logIncidentResolved(
  serverId: number,
  userId: number,
  incidentId: number,
  tx?: sql.Transaction
): Promise<void> {
  await logServerActivity(
    serverId,
    userId,
    "resolved",
    "incident",
    incidentId,
    "Incident resolved",
    false,
    { incident_id: incidentId },
    tx
  );
}

export async function logVisitCreated(
  serverId: number,
  userId: number,
  visitId: number,
  visitType: string,
  tx?: sql.Transaction
): Promise<void> {
  await logServerActivity(
    serverId,
    userId,
    "created",
    "visit",
    visitId,
    `Visit scheduled: ${visitType}`,
    false,
    { visit_id: visitId, visit_type: visitType },
    tx
  );
}

export async function logVisitCompleted(
  serverId: number,
  userId: number,
  visitId: number,
  tx?: sql.Transaction
): Promise<void> {
  await logServerActivity(
    serverId,
    userId,
    "completed",
    "visit",
    visitId,
    "Visit completed",
    false,
    { visit_id: visitId },
    tx
  );
}

export async function logCredentialsUpdated(
  serverId: number,
  userId: number,
  tx?: sql.Transaction
): Promise<void> {
  await logServerActivity(
    serverId,
    userId,
    "updated",
    "credentials",
    null,
    "Server credentials updated",
    true, // Sensitive!
    {},
    tx
  );
}

export async function logCredentialsRevealed(
  serverId: number,
  userId: number,
  tx?: sql.Transaction
): Promise<void> {
  await logServerActivity(
    serverId,
    userId,
    "revealed",
    "credentials",
    null,
    "Server credentials revealed",
    true, // Sensitive!
    {},
    tx
  );
}
