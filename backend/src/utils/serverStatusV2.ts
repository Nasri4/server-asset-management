/**
 * V2 SERVER STATUS ENGINE
 * 
 * Single source of truth for server status computation.
 * Implements comprehensive business rules with priority-based status resolution.
 * 
 * PRIORITY ORDER (highest to lowest):
 * 1. Manual Override (if set by privileged user)
 * 2. Critical Incident (Open/InProgress)
 * 3. Active Maintenance (In Progress or Scheduled for today)
 * 4. Active Visit (In Progress)
 * 5. Monitoring Health (Critical/Down)
 * 6. Default: Active
 * 
 * STATUS TRANSITIONS:
 * - Incident (Critical) -> Down
 * - Incident (Major/High) -> Degraded
 * - Incident (Medium) -> Issue
 * - Incident (Low) -> Warning
 * - Maintenance (In Progress or Scheduled Today) -> Maintenance
 * - Visit (In Progress) -> Under Visit
 * - Monitoring (Down) -> Down
 * - Monitoring (Critical) -> Degraded
 * - Monitoring (Warning) -> Warning
 * - No active events -> Active
 */

import type sql from "mssql";
import { query, queryTx, transaction } from "../db/sql";
import { logAudit } from "./audit";
import { logActivity } from "./activity";

export type ServerStatus = 
  | "Active" 
  | "Maintenance" 
  | "Degraded" 
  | "Offline" 
  | "Incident" 
  | "Under Visit" 
  | "Down" 
  | "Issue" 
  | "Warning";

export type HealthStatus = "Healthy" | "Warning" | "Critical" | "Down" | "Unknown";

export type StatusPriority = {
  priority: number;
  status: ServerStatus;
  reason: string;
  source: string;
};

const OPEN_INCIDENT_STATUSES = ["Open", "InProgress", "Investigating", "Mitigating"];
const ACTIVE_MAINTENANCE_STATUSES = ["InProgress", "Scheduled"];
const ACTIVE_VISIT_STATUSES = ["InProgress", "Scheduled"];

/**
 * Get open incidents for a server
 */
async function getOpenIncidents(serverId: number, tx?: sql.Transaction): Promise<any[]> {
  const sqlText = `
    SELECT 
      incident_id,
      severity,
      status,
      description,
      reported_at
    FROM dbo.server_incidents
    WHERE server_id = @server_id
      AND status IN ('Open', 'InProgress', 'Investigating', 'Mitigating')
    ORDER BY 
      CASE severity
        WHEN 'Critical' THEN 1
        WHEN 'Major' THEN 2
        WHEN 'Medium' THEN 3
        WHEN 'Low' THEN 4
        ELSE 5
      END,
      reported_at DESC
  `;
  
  if (tx) {
    return queryTx(tx, sqlText, (r) => r.input("server_id", serverId));
  }
  return query(sqlText, (r) => r.input("server_id", serverId));
}

/**
 * Get active maintenance for a server
 */
async function getActiveMaintenance(serverId: number, tx?: sql.Transaction): Promise<any[]> {
  const sqlText = `
    SELECT 
      maintenance_id,
      maintenance_type,
      status,
      scheduled_start,
      scheduled_end,
      started_at,
      completed_at
    FROM dbo.server_maintenance
    WHERE server_id = @server_id
      AND (
        (status = 'InProgress' AND completed_at IS NULL)
        OR (
          status = 'Scheduled' 
          AND scheduled_start IS NOT NULL
          AND CAST(scheduled_start AS DATE) = CAST(GETDATE() AS DATE)
        )
      )
    ORDER BY scheduled_start DESC
  `;
  
  if (tx) {
    return queryTx(tx, sqlText, (r) => r.input("server_id", serverId));
  }
  return query(sqlText, (r) => r.input("server_id", serverId));
}

/**
 * Get active visits for a server
 */
async function getActiveVisits(serverId: number, tx?: sql.Transaction): Promise<any[]> {
  const sqlText = `
    SELECT 
      visit_id,
      visit_type,
      status,
      scheduled_at,
      completed_at
    FROM dbo.server_visits
    WHERE server_id = @server_id
      AND status IN ('InProgress', 'Scheduled')
      AND (
        status = 'InProgress'
        OR (
          status = 'Scheduled'
          AND scheduled_at IS NOT NULL
          AND CAST(scheduled_at AS DATE) = CAST(GETDATE() AS DATE)
        )
      )
    ORDER BY scheduled_at DESC
  `;
  
  if (tx) {
    return queryTx(tx, sqlText, (r) => r.input("server_id", serverId));
  }
  return query(sqlText, (r) => r.input("server_id", serverId));
}

/**
 * Get latest monitoring health for a server
 */
async function getLatestMonitoring(serverId: number, tx?: sql.Transaction): Promise<any | null> {
  const sqlText = `
    SELECT TOP 1
      health_status,
      last_check_at,
      cpu_usage,
      memory_usage,
      disk_usage
    FROM dbo.server_monitoring
    WHERE server_id = @server_id
    ORDER BY last_check_at DESC
  `;
  
  const rows = tx 
    ? await queryTx(tx, sqlText, (r) => r.input("server_id", serverId))
    : await query(sqlText, (r) => r.input("server_id", serverId));
  
  return rows[0] || null;
}

/**
 * Get manual status override if set
 */
async function getStatusOverride(serverId: number, tx?: sql.Transaction): Promise<string | null> {
  const sqlText = `
    SELECT status_override
    FROM dbo.servers
    WHERE server_id = @server_id
      AND status_override IS NOT NULL
  `;
  
  const rows = tx 
    ? await queryTx<{ status_override: string | null }>(tx, sqlText, (r) => r.input("server_id", serverId))
    : await query<{ status_override: string | null }>(sqlText, (r) => r.input("server_id", serverId));
  
  return rows[0]?.status_override || null;
}

/**
 * Compute server status based on business rules
 * Returns status with priority and reason
 */
export async function computeServerStatusV2(
  serverId: number, 
  tx?: sql.Transaction
): Promise<StatusPriority> {
  
  // Check for manual override (highest priority)
  const override = await getStatusOverride(serverId, tx);
  if (override) {
    return {
      priority: 1000,
      status: override as ServerStatus,
      reason: "Manual override by administrator",
      source: "override"
    };
  }
  
  // Check for open incidents (priority 2)
  const incidents = await getOpenIncidents(serverId, tx);
  if (incidents.length > 0) {
    const topIncident = incidents[0];
    const severity = topIncident.severity?.toLowerCase() || "";
    
    if (severity === "critical") {
      return {
        priority: 900,
        status: "Down",
        reason: `Critical incident: ${topIncident.description || "No description"}`,
        source: "incident"
      };
    }
    
    if (severity === "major" || severity === "high") {
      return {
        priority: 800,
        status: "Degraded",
        reason: `Major incident: ${topIncident.description || "No description"}`,
        source: "incident"
      };
    }
    
    if (severity === "medium") {
      return {
        priority: 700,
        status: "Issue",
        reason: `Medium incident: ${topIncident.description || "No description"}`,
        source: "incident"
      };
    }
    
    if (severity === "low") {
      return {
        priority: 600,
        status: "Warning",
        reason: `Low incident: ${topIncident.description || "No description"}`,
        source: "incident"
      };
    }
  }
  
  // Check for active maintenance (priority 3)
  const maintenance = await getActiveMaintenance(serverId, tx);
  if (maintenance.length > 0) {
    const topMaintenance = maintenance[0];
    return {
      priority: 500,
      status: "Maintenance",
      reason: `Maintenance: ${topMaintenance.maintenance_type || "Scheduled maintenance"}`,
      source: "maintenance"
    };
  }
  
  // Check for active visits (priority 4)
  const visits = await getActiveVisits(serverId, tx);
  if (visits.length > 0) {
    const topVisit = visits[0];
    return {
      priority: 400,
      status: "Under Visit",
      reason: `Visit: ${topVisit.visit_type || "Scheduled visit"}`,
      source: "visit"
    };
  }
  
  // Check monitoring health (priority 5)
  const monitoring = await getLatestMonitoring(serverId, tx);
  if (monitoring && monitoring.health_status) {
    const health = monitoring.health_status.toLowerCase();
    
    if (health === "down") {
      return {
        priority: 300,
        status: "Down",
        reason: "Server is down (monitoring)",
        source: "monitoring"
      };
    }
    
    if (health === "critical") {
      return {
        priority: 200,
        status: "Degraded",
        reason: "Critical health status (monitoring)",
        source: "monitoring"
      };
    }
    
    if (health === "warning") {
      return {
        priority: 100,
        status: "Warning",
        reason: "Warning health status (monitoring)",
        source: "monitoring"
      };
    }
  }
  
  // Default: Active
  return {
    priority: 0,
    status: "Active",
    reason: "No active incidents, maintenance, or health issues",
    source: "default"
  };
}

/**
 * Recompute and persist server status
 * This is the main function called when server state changes
 */
export async function recomputeServerStatus(
  serverId: number,
  userId?: number,
  tx?: sql.Transaction
): Promise<{ status: ServerStatus; reason: string; changed: boolean }> {
  
  const runInTransaction = async (transaction: sql.Transaction) => {
    // Get current status
    const [currentRow] = await queryTx<{ status: string | null }>(
      transaction,
      "SELECT status FROM dbo.servers WHERE server_id = @server_id",
      (r) => r.input("server_id", serverId)
    );
    
    const currentStatus = currentRow?.status || "Active";
    
    // Compute new status
    const result = await computeServerStatusV2(serverId, transaction);
    const newStatus = result.status;
    
    // Update if changed
    if (currentStatus !== newStatus) {
      await queryTx(
        transaction,
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
      
      // Log the status change
      await logAudit(
        "server",
        serverId,
        "status_changed",
        userId || null,
        `Status changed from ${currentStatus} to ${newStatus}: ${result.reason}`,
        transaction
      );
      
      await logActivity(
        "server",
        serverId,
        serverId,
        "status_changed",
        userId || null,
        null,
        `Server status changed from ${currentStatus} to ${newStatus}`,
        currentStatus,
        newStatus,
        { reason: result.reason, source: result.source },
        transaction
      );
      
      return { status: newStatus, reason: result.reason, changed: true };
    }
    
    return { status: newStatus, reason: result.reason, changed: false };
  };
  
  if (tx) {
    return runInTransaction(tx);
  }
  
  return transaction(runInTransaction);
}

/**
 * Set manual status override
 * Requires privileged user
 */
export async function setStatusOverride(
  serverId: number,
  status: ServerStatus,
  userId: number,
  reason?: string
): Promise<void> {
  await transaction(async (tx) => {
    // Get current status
    const [currentRow] = await queryTx<{ status: string | null }>(
      tx,
      "SELECT status FROM dbo.servers WHERE server_id = @server_id",
      (r) => r.input("server_id", serverId)
    );
    
    const currentStatus = currentRow?.status || "Active";
    
    // Set override
    await queryTx(
      tx,
      `
      UPDATE dbo.servers
      SET 
        status_override = @status,
        status_override_by = @user_id,
        status_override_at = GETDATE(),
        status = @status,
        updated_at = GETDATE()
      WHERE server_id = @server_id
      `,
      (r) => {
        r.input("server_id", serverId);
        r.input("status", status);
        r.input("user_id", userId);
      }
    );
    
    // Log override
    await logAudit(
      "server",
      serverId,
      "status_override_set",
      userId,
      `Manual status override set to ${status}: ${reason || "No reason provided"}`,
      tx
    );
    
    await logActivity(
      "server",
      serverId,
      serverId,
      "status_override_set",
      userId,
      null,
      `Manual status override: ${currentStatus} → ${status}`,
      currentStatus,
      status,
      { reason: reason || "No reason provided" },
      tx
    );
  });
}

/**
 * Clear manual status override
 * Automatically recomputes status
 */
export async function clearStatusOverride(
  serverId: number,
  userId: number
): Promise<{ status: ServerStatus; reason: string }> {
  return transaction(async (tx) => {
    // Clear override
    await queryTx(
      tx,
      `
      UPDATE dbo.servers
      SET 
        status_override = NULL,
        status_override_by = NULL,
        status_override_at = NULL
      WHERE server_id = @server_id
      `,
      (r) => r.input("server_id", serverId)
    );
    
    // Recompute status
    const result = await recomputeServerStatus(serverId, userId, tx);
    
    // Log clearing
    await logAudit(
      "server",
      serverId,
      "status_override_cleared",
      userId,
      `Manual status override cleared, recomputed to: ${result.status}`,
      tx
    );
    
    return result;
  });
}

/**
 * Update monitoring health and recompute status
 */
export async function updateMonitoringHealth(
  serverId: number,
  healthStatus: HealthStatus,
  metrics?: {
    cpu_usage?: number;
    memory_usage?: number;
    disk_usage?: number;
  }
): Promise<void> {
  await transaction(async (tx) => {
    // Update monitoring
    await queryTx(
      tx,
      `
      IF EXISTS (SELECT 1 FROM dbo.server_monitoring WHERE server_id = @server_id)
      BEGIN
        UPDATE dbo.server_monitoring
        SET 
          health_status = @health_status,
          cpu_usage = @cpu_usage,
          memory_usage = @memory_usage,
          disk_usage = @disk_usage,
          last_check_at = GETDATE(),
          updated_at = GETDATE()
        WHERE server_id = @server_id
      END
      ELSE
      BEGIN
        INSERT INTO dbo.server_monitoring (server_id, health_status, cpu_usage, memory_usage, disk_usage, last_check_at)
        VALUES (@server_id, @health_status, @cpu_usage, @memory_usage, @disk_usage, GETDATE())
      END
      
      -- Also update servers.health_status
      UPDATE dbo.servers
      SET health_status = @health_status, updated_at = GETDATE()
      WHERE server_id = @server_id
      `,
      (r) => {
        r.input("server_id", serverId);
        r.input("health_status", healthStatus);
        r.input("cpu_usage", metrics?.cpu_usage || null);
        r.input("memory_usage", metrics?.memory_usage || null);
        r.input("disk_usage", metrics?.disk_usage || null);
      }
    );
    
    // Recompute server status
    await recomputeServerStatus(serverId, undefined, tx);
  });
}

// Export for backward compatibility
export const syncServerStatus = recomputeServerStatus;
export const computeServerStatus = computeServerStatusV2;
