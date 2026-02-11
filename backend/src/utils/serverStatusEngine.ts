/**
 * HORMUUD TELECOM - SERVER STATUS ENGINE
 * 
 * Automatically derives server status from operational state
 * Priority: Incident (Open) > Maintenance (InProgress/Overdue) > Active
 */

import { query, queryTx, transaction } from "../db/sql";
import type sql from "mssql";
import { logServerActivity } from "./activityLogger";

export type ServerStatus = "ACTIVE" | "MAINTENANCE" | "INCIDENT" | "DECOMMISSIONED";

/**
 * Update server status based on current operational state
 * 
 * Priority:
 * 1. Open Incident → "INCIDENT"
 * 2. Active Maintenance (InProgress/Overdue) → "MAINTENANCE"
 * 3. Explicitly Decommissioned → "DECOMMISSIONED"
 * 4. Otherwise → "ACTIVE"
 */
export async function updateServerStatus(
  serverId: number,
  userId?: number,
  tx?: sql.Transaction
): Promise<ServerStatus> {
  
  const runQuery = async <T>(sqlText: string, input?: (req: any) => void): Promise<T[]> => {
    if (tx) {
      return queryTx<T>(tx, sqlText, input);
    }
    return query<T>(sqlText, input);
  };
  
  const runUpdate = async (sqlText: string, input?: (req: any) => void): Promise<void> => {
    if (tx) {
      await queryTx(tx, sqlText, input);
    } else {
      await query(sqlText, input);
    }
  };
  
  // Get current status
  const [currentServer] = await runQuery<{ status: string; server_code: string; hostname: string }>(
    "SELECT status, server_code, hostname FROM dbo.servers WHERE server_id = @server_id",
    (r) => r.input("server_id", serverId)
  );
  
  if (!currentServer) {
    throw new Error(`Server ${serverId} not found`);
  }
  
  const oldStatus = currentServer.status;
  let newStatus: ServerStatus = "ACTIVE";
  let reason = "";
  
  // Check for open incidents (highest priority)
  const [incidentCheck] = await runQuery<{ has_open: number; severity: string }>(
    `
    SELECT TOP 1
      1 AS has_open,
      severity
    FROM dbo.server_incidents
    WHERE server_id = @server_id
      AND status IN ('Open', 'Investigating')
    ORDER BY 
      CASE severity
        WHEN 'Critical' THEN 1
        WHEN 'High' THEN 2
        WHEN 'Major' THEN 2
        WHEN 'Medium' THEN 3
        WHEN 'Low' THEN 4
        ELSE 5
      END
    `,
    (r) => r.input("server_id", serverId)
  );
  
  if (incidentCheck?.has_open) {
    newStatus = "INCIDENT";
    reason = `Open ${incidentCheck.severity} incident`;
  } else {
    // Check for active maintenance
    const [maintenanceCheck] = await runQuery<{ has_active: number; maintenance_type: string }>(
      `
      SELECT TOP 1
        1 AS has_active,
        maintenance_type
      FROM dbo.server_maintenance
      WHERE server_id = @server_id
        AND status IN ('InProgress', 'Overdue')
      ORDER BY scheduled_start DESC
      `,
      (r) => r.input("server_id", serverId)
    );
    
    if (maintenanceCheck?.has_active) {
      newStatus = "MAINTENANCE";
      reason = `Active maintenance: ${maintenanceCheck.maintenance_type || "Scheduled"}`;
    } else {
      // Check if explicitly decommissioned
      const [decommCheck] = await runQuery<{ is_decomm: number }>(
        `
        SELECT 
          CASE WHEN status = 'Decommissioned' THEN 1 ELSE 0 END AS is_decomm
        FROM dbo.servers
        WHERE server_id = @server_id
        `,
        (r) => r.input("server_id", serverId)
      );
      
      if (decommCheck?.is_decomm === 1) {
        newStatus = "DECOMMISSIONED";
        reason = "Server decommissioned";
      } else {
        newStatus = "ACTIVE";
        reason = "No active incidents or maintenance";
      }
    }
  }
  
  // Update status if changed
  if (oldStatus !== newStatus) {
    await runUpdate(
      `
      UPDATE dbo.servers
      SET status = @status, updated_at = GETDATE()
      WHERE server_id = @server_id
      `,
      (r) => {
        r.input("server_id", serverId);
        r.input("status", newStatus);
      }
    );
    
    // Log status change activity
    await logServerActivity(
      serverId,
      userId || null,
      "status_changed",
      "server",
      serverId,
      `Server status changed from ${oldStatus} to ${newStatus}: ${reason}`,
      false,
      { old_status: oldStatus, new_status: newStatus, reason },
      tx
    );
  }
  
  return newStatus;
}

/**
 * Recompute server status (wrapper for updateServerStatus)
 */
export async function recomputeServerStatus(
  serverId: number,
  userId?: number
): Promise<{ status: ServerStatus; changed: boolean; reason: string }> {
  let changed = false;
  let oldStatus: string | null = null;
  
  const newStatus = await transaction(async (tx) => {
    // Get old status
    const [server] = await queryTx<{ status: string }>(
      tx,
      "SELECT status FROM dbo.servers WHERE server_id = @server_id",
      (r) => r.input("server_id", serverId)
    );
    
    oldStatus = server?.status || null;
    
    // Update status
    return updateServerStatus(serverId, userId, tx);
  });
  
  changed = oldStatus !== newStatus;
  
  return {
    status: newStatus,
    changed,
    reason: `Status ${changed ? "changed" : "unchanged"}: ${newStatus}`
  };
}
