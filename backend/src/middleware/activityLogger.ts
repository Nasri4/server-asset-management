import { Request, Response, NextFunction } from 'express';
import { pool } from '../db/pool';

/**
 * Activity Logger Middleware
 * Automatically logs activities for tracked endpoints
 */

interface ActivityConfig {
  eventType: string;
  resourceType: string;
  getResourceId: (req: Request) => string | number;
  getDescription: (req: Request, res: Response) => string;
  getMetadata?: (req: Request, res: Response) => any;
}

export function logActivity(config: ActivityConfig) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Store original send function
    const originalSend = res.send;

    // Override send to capture response
    res.send = function (data: any): Response {
      // Restore original send
      res.send = originalSend;

      // Log activity only on successful responses (2xx)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        // Fire and forget - don't block response
        logActivityAsync(req, res, config).catch((err) => {
          console.error('Failed to log activity:', err);
        });
      }

      // Send response
      return originalSend.call(this, data);
    };

    next();
  };
}

async function logActivityAsync(req: Request, res: Response, config: ActivityConfig) {
  try {
    const user = (req as any).user;
    const resourceId = String(config.getResourceId(req));
    const description = config.getDescription(req, res);
    const metadata = config.getMetadata ? config.getMetadata(req, res) : null;

    await pool.request()
      .input('eventType', config.eventType)
      .input('resourceType', config.resourceType)
      .input('resourceId', resourceId)
      .input('actorId', user?.engineer_id || null)
      .input('actorName', user?.full_name || 'System')
      .input('actorType', user ? 'engineer' : 'system')
      .input('description', description)
      .input('metadata', metadata ? JSON.stringify(metadata) : null)
      .input('ipAddress', req.ip || null)
      .input('userAgent', req.headers['user-agent'] || null)
      .query(`
        INSERT INTO dbo.activity_log (
          event_type, resource_type, resource_id,
          actor_id, actor_name, actor_type,
          description, metadata,
          ip_address, user_agent
        )
        VALUES (
          @eventType, @resourceType, @resourceId,
          @actorId, @actorName, @actorType,
          @description, @metadata,
          @ipAddress, @userAgent
        )
      `);
  } catch (err) {
    console.error('Error logging activity:', err);
  }
}

/**
 * Helper function to create description for updates
 */
export function createUpdateDescription(
  user: any,
  resourceName: string,
  changes: Record<string, { old: any; new: any }>
): string {
  const userName = user?.full_name || 'System';
  const changeCount = Object.keys(changes).length;

  if (changeCount === 1) {
    const [field, { old: oldVal, new: newVal }] = Object.entries(changes)[0];
    return `${userName} changed ${field} from "${oldVal}" to "${newVal}"`;
  }

  const fieldNames = Object.keys(changes).join(', ');
  return `${userName} updated ${resourceName} (${fieldNames})`;
}

/**
 * Helper to log server status changes
 */
export async function logServerStatusChange(
  serverId: number,
  oldStatus: string,
  newStatus: string,
  user: any
) {
  try {
    const actorName = user?.full_name || 'System';
    
    await pool.request()
      .input('eventType', 'ServerStatusChanged')
      .input('resourceType', 'server')
      .input('resourceId', String(serverId))
      .input('actorId', user?.engineer_id || null)
      .input('actorName', actorName)
      .input('actorType', user ? 'engineer' : 'system')
      .input('description', `${actorName} changed status from "${oldStatus}" to "${newStatus}"`)
      .input('metadata', JSON.stringify({ oldStatus, newStatus }))
      .query(`
        INSERT INTO dbo.activity_log (
          event_type, resource_type, resource_id,
          actor_id, actor_name, actor_type,
          description, metadata
        )
        VALUES (
          @eventType, @resourceType, @resourceId,
          @actorId, @actorName, @actorType,
          @description, @metadata
        )
      `);
  } catch (err) {
    console.error('Error logging server status change:', err);
  }
}

/**
 * Helper to log incident assignment
 */
export async function logIncidentAssignment(
  incidentId: number,
  engineerName: string,
  user: any
) {
  try {
    const actorName = user?.full_name || 'System';
    
    await pool.request()
      .input('eventType', 'IncidentAssigned')
      .input('resourceType', 'incident')
      .input('resourceId', String(incidentId))
      .input('actorId', user?.engineer_id || null)
      .input('actorName', actorName)
      .input('actorType', user ? 'engineer' : 'system')
      .input('description', `${actorName} assigned incident to ${engineerName}`)
      .input('metadata', JSON.stringify({ engineerName }))
      .query(`
        INSERT INTO dbo.activity_log (
          event_type, resource_type, resource_id,
          actor_id, actor_name, actor_type,
          description, metadata
        )
        VALUES (
          @eventType, @resourceType, @resourceId,
          @actorId, @actorName, @actorType,
          @description, @metadata
        )
      `);
  } catch (err) {
    console.error('Error logging incident assignment:', err);
  }
}

/**
 * Helper to log maintenance completion
 */
export async function logMaintenanceCompletion(
  maintenanceId: number,
  outcome: string,
  user: any
) {
  try {
    const actorName = user?.full_name || 'System';
    
    await pool.request()
      .input('eventType', 'MaintenanceCompleted')
      .input('resourceType', 'maintenance')
      .input('resourceId', String(maintenanceId))
      .input('actorId', user?.engineer_id || null)
      .input('actorName', actorName)
      .input('actorType', user ? 'engineer' : 'system')
      .input('description', `${actorName} completed maintenance with outcome: ${outcome}`)
      .input('metadata', JSON.stringify({ outcome }))
      .query(`
        INSERT INTO dbo.activity_log (
          event_type, resource_type, resource_id,
          actor_id, actor_name, actor_type,
          description, metadata
        )
        VALUES (
          @eventType, @resourceType, @resourceId,
          @actorId, @actorName, @actorType,
          @description, @metadata
        )
      `);
  } catch (err) {
    console.error('Error logging maintenance completion:', err);
  }
}
