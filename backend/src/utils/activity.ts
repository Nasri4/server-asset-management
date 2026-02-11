/**
 * ACTIVITY LOGGING UTILITY
 * 
 * Provides unified activity timeline for servers and related entities.
 * Activities are high-level business events that users care about.
 * 
 * Activities differ from audit logs:
 * - Audit logs: technical, all field changes, for compliance
 * - Activity logs: business events, user-friendly, for monitoring
 */

import type sql from "mssql";
import { query, queryTx } from "../db/sql";

export type EntityType = 
  | "server" 
  | "incident" 
  | "maintenance" 
  | "visit" 
  | "security" 
  | "monitoring"
  | "hardware"
  | "network"
  | "application";

export type ActivityAction =
  | "created"
  | "updated"
  | "deleted"
  | "status_changed"
  | "status_override_set"
  | "status_override_cleared"
  | "resolved"
  | "completed"
  | "assigned"
  | "health_changed"
  | "hardening_updated";

export type ActorType = "user" | "system";

export interface ActivityLogEntry {
  activity_id: number;
  entity_type: EntityType;
  entity_id: number;
  server_id: number | null;
  action: ActivityAction;
  actor_type: ActorType;
  actor_id: number | null;
  actor_name: string | null;
  description: string | null;
  old_value: string | null;
  new_value: string | null;
  metadata: string | null;
  created_at: Date;
}

/**
 * Log an activity
 */
export async function logActivity(
  entityType: EntityType,
  entityId: number,
  serverId: number | null,
  action: ActivityAction,
  actorId: number | null,
  actorName: string | null,
  description: string | null,
  oldValue?: any,
  newValue?: any,
  metadata?: Record<string, any>,
  tx?: sql.Transaction
): Promise<void> {
  const sqlText = `
    INSERT INTO dbo.activity_log (
      entity_type,
      entity_id,
      server_id,
      action,
      actor_type,
      actor_id,
      actor_name,
      description,
      old_value,
      new_value,
      metadata,
      created_at
    )
    VALUES (
      @entity_type,
      @entity_id,
      @server_id,
      @action,
      @actor_type,
      @actor_id,
      @actor_name,
      @description,
      @old_value,
      @new_value,
      @metadata,
      GETDATE()
    )
  `;
  
  const actorType: ActorType = actorId ? "user" : "system";
  
  const params = (r: any) => {
    r.input("entity_type", entityType);
    r.input("entity_id", entityId);
    r.input("server_id", serverId);
    r.input("action", action);
    r.input("actor_type", actorType);
    r.input("actor_id", actorId);
    r.input("actor_name", actorName);
    r.input("description", description);
    r.input("old_value", oldValue !== undefined ? JSON.stringify(oldValue) : null);
    r.input("new_value", newValue !== undefined ? JSON.stringify(newValue) : null);
    r.input("metadata", metadata ? JSON.stringify(metadata) : null);
  };
  
  if (tx) {
    await queryTx(tx, sqlText, params);
  } else {
    await query(sqlText, params);
  }
}

/**
 * Get server activity timeline
 * Returns activities for a specific server, sorted by recency
 */
export async function getServerActivity(
  serverId: number,
  limit: number = 50,
  offset: number = 0
): Promise<ActivityLogEntry[]> {
  const sqlText = `
    SELECT 
      activity_id,
      entity_type,
      entity_id,
      server_id,
      action,
      actor_type,
      actor_id,
      actor_name,
      description,
      old_value,
      new_value,
      metadata,
      created_at
    FROM dbo.activity_log
    WHERE server_id = @server_id
    ORDER BY created_at DESC
    OFFSET @offset ROWS
    FETCH NEXT @limit ROWS ONLY
  `;
  
  return query<ActivityLogEntry>(sqlText, (r) => {
    r.input("server_id", serverId);
    r.input("limit", limit);
    r.input("offset", offset);
  });
}

/**
 * Get activity count for a server
 */
export async function getServerActivityCount(serverId: number): Promise<number> {
  const sqlText = `
    SELECT COUNT(*) as count
    FROM dbo.activity_log
    WHERE server_id = @server_id
  `;
  
  const rows = await query<{ count: number }>(sqlText, (r) => r.input("server_id", serverId));
  return rows[0]?.count || 0;
}

/**
 * Get global activity timeline (all servers)
 */
export async function getGlobalActivity(
  limit: number = 100,
  offset: number = 0,
  filters?: {
    entityType?: EntityType;
    action?: ActivityAction;
    serverId?: number;
  }
): Promise<ActivityLogEntry[]> {
  let sqlText = `
    SELECT 
      activity_id,
      entity_type,
      entity_id,
      server_id,
      action,
      actor_type,
      actor_id,
      actor_name,
      description,
      old_value,
      new_value,
      metadata,
      created_at
    FROM dbo.activity_log
    WHERE 1=1
  `;
  
  if (filters?.entityType) {
    sqlText += ` AND entity_type = @entity_type`;
  }
  
  if (filters?.action) {
    sqlText += ` AND action = @action`;
  }
  
  if (filters?.serverId) {
    sqlText += ` AND server_id = @server_id`;
  }
  
  sqlText += `
    ORDER BY created_at DESC
    OFFSET @offset ROWS
    FETCH NEXT @limit ROWS ONLY
  `;
  
  return query<ActivityLogEntry>(sqlText, (r) => {
    r.input("limit", limit);
    r.input("offset", offset);
    if (filters?.entityType) r.input("entity_type", filters.entityType);
    if (filters?.action) r.input("action", filters.action);
    if (filters?.serverId) r.input("server_id", filters.serverId);
  });
}
