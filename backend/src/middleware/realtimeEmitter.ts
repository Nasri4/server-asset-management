/**
 * REALTIME EMITTER MIDDLEWARE
 * 
 * Centralized middleware for emitting real-time events and triggering
 * server status recomputation after operations.
 */

import { realtimeService } from "../services/realtimeService";
import { recomputeServerStatus } from "../utils/serverStatusV2";
import type sql from "mssql";

/**
 * Emit incident event and recompute server status
 */
export async function emitIncidentEvent(
  action: "created" | "updated" | "resolved",
  incidentId: number,
  serverId: number,
  data: any,
  teamId?: number,
  userId?: number,
  tx?: sql.Transaction
): Promise<void> {
  // Emit real-time event
  realtimeService.emitIncidentEvent(action, incidentId, serverId, data, teamId);
  
  // Recompute server status (incidents affect status)
  await recomputeServerStatus(serverId, userId, tx);
}

/**
 * Emit maintenance event and recompute server status
 */
export async function emitMaintenanceEvent(
  action: "created" | "updated" | "completed",
  maintenanceId: number,
  serverId: number,
  data: any,
  teamId?: number,
  userId?: number,
  tx?: sql.Transaction
): Promise<void> {
  // Emit real-time event
  realtimeService.emitMaintenanceEvent(action, maintenanceId, serverId, data, teamId);
  
  // Recompute server status (maintenance affects status)
  await recomputeServerStatus(serverId, userId, tx);
}

/**
 * Emit visit event and recompute server status
 */
export async function emitVisitEvent(
  action: "created" | "updated" | "completed",
  visitId: number,
  serverId: number,
  data: any,
  teamId?: number,
  userId?: number,
  tx?: sql.Transaction
): Promise<void> {
  // Emit real-time event
  realtimeService.emitVisitEvent(action, visitId, serverId, data, teamId);
  
  // Recompute server status (visits may affect status)
  await recomputeServerStatus(serverId, userId, tx);
}

/**
 * Emit security event
 */
export async function emitSecurityEvent(
  serverId: number,
  data: any,
  teamId?: number
): Promise<void> {
  realtimeService.emitSecurityEvent(serverId, data, teamId);
}

/**
 * Emit monitoring event and recompute server status
 */
export async function emitMonitoringEvent(
  serverId: number,
  data: any,
  teamId?: number,
  userId?: number,
  tx?: sql.Transaction
): Promise<void> {
  // Emit real-time event
  realtimeService.emitMonitoringEvent(serverId, data, teamId);
  
  // Recompute server status (monitoring health affects status)
  await recomputeServerStatus(serverId, userId, tx);
}

/**
 * Emit activity event
 */
export async function emitActivityEvent(
  activityId: number,
  serverId: number | null,
  data: any,
  teamId?: number
): Promise<void> {
  realtimeService.emitActivityEvent(activityId, serverId, data, teamId);
}
