import { Router } from 'express';
import { Request, Response } from 'express';
import { pool } from '../db/pool';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticate } from '../middleware/auth';
import { checkPermissions } from '../middleware/permissions';

const router = Router();

/**
 * GET /api/activity
 * Get activity log with filtering and pagination
 * Query params:
 * - page, pageSize
 * - resourceType: filter by resource type
 * - resourceId: filter by specific resource
 * - eventType: filter by event type
 * - actorId: filter by actor
 * - startDate, endDate: date range
 */
router.get(
  '/',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const {
      page = 1,
      pageSize = 50,
      resourceType,
      resourceId,
      eventType,
      actorId,
      startDate,
      endDate,
    } = req.query;

    const offset = (Number(page) - 1) * Number(pageSize);

    // Build dynamic WHERE clause
    const conditions: string[] = ['1=1'];
    const params: any = {};

    if (resourceType) {
      conditions.push('resource_type = @resourceType');
      params.resourceType = resourceType;
    }

    if (resourceId) {
      conditions.push('resource_id = @resourceId');
      params.resourceId = resourceId;
    }

    if (eventType) {
      conditions.push('event_type = @eventType');
      params.eventType = eventType;
    }

    if (actorId) {
      conditions.push('actor_id = @actorId');
      params.actorId = Number(actorId);
    }

    if (startDate) {
      conditions.push('created_at >= @startDate');
      params.startDate = startDate;
    }

    if (endDate) {
      conditions.push('created_at <= @endDate');
      params.endDate = endDate;
    }

    const whereClause = conditions.join(' AND ');

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM dbo.activity_log
      WHERE ${whereClause}
    `;

    const countResult = await pool.request()
      .input('resourceType', params.resourceType)
      .input('resourceId', params.resourceId)
      .input('eventType', params.eventType)
      .input('actorId', params.actorId)
      .input('startDate', params.startDate)
      .input('endDate', params.endDate)
      .query(countQuery);

    const total = countResult.recordset[0].total;

    // Get paginated results
    const dataQuery = `
      SELECT 
        activity_id,
        event_type,
        resource_type,
        resource_id,
        actor_id,
        actor_name,
        actor_type,
        description,
        metadata,
        ip_address,
        user_agent,
        created_at
      FROM dbo.activity_log
      WHERE ${whereClause}
      ORDER BY created_at DESC
      OFFSET @offset ROWS
      FETCH NEXT @pageSize ROWS ONLY
    `;

    const dataResult = await pool.request()
      .input('offset', offset)
      .input('pageSize', Number(pageSize))
      .input('resourceType', params.resourceType)
      .input('resourceId', params.resourceId)
      .input('eventType', params.eventType)
      .input('actorId', params.actorId)
      .input('startDate', params.startDate)
      .input('endDate', params.endDate)
      .query(dataQuery);

    // Parse metadata JSON
    const activities = dataResult.recordset.map((row: any) => ({
      ...row,
      metadata: row.metadata ? JSON.parse(row.metadata) : null,
    }));

    res.json({
      data: activities,
      meta: {
        pagination: {
          page: Number(page),
          pageSize: Number(pageSize),
          total,
          totalPages: Math.ceil(total / Number(pageSize)),
        },
      },
    });
  })
);

/**
 * POST /api/activity
 * Create activity log entry manually (for custom events)
 * Body: { eventType, resourceType, resourceId, description, metadata }
 */
router.post(
  '/',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { eventType, resourceType, resourceId, description, metadata } = req.body;
    const user = (req as any).user;

    if (!eventType || !resourceType || !resourceId || !description) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing required fields',
        },
      });
    }

    const query = `
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
      );
      
      SELECT 
        activity_id, event_type, resource_type, resource_id,
        actor_id, actor_name, actor_type,
        description, metadata, created_at
      FROM dbo.activity_log
      WHERE activity_id = SCOPE_IDENTITY();
    `;

    const result = await pool.request()
      .input('eventType', eventType)
      .input('resourceType', resourceType)
      .input('resourceId', String(resourceId))
      .input('actorId', user?.engineer_id || null)
      .input('actorName', user?.full_name || 'System')
      .input('actorType', user ? 'engineer' : 'system')
      .input('description', description)
      .input('metadata', metadata ? JSON.stringify(metadata) : null)
      .input('ipAddress', req.ip || null)
      .input('userAgent', req.headers['user-agent'] || null)
      .query(query);

    const activity = result.recordset[0];

    res.status(201).json({
      data: {
        ...activity,
        metadata: activity.metadata ? JSON.parse(activity.metadata) : null,
      },
    });
  })
);

/**
 * GET /api/activity/timeline/:resourceType/:resourceId
 * Get activity timeline for a specific resource
 */
router.get(
  '/timeline/:resourceType/:resourceId',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { resourceType, resourceId } = req.params;
    const { limit = 100 } = req.query;

    const query = `
      SELECT TOP (@limit)
        activity_id,
        event_type,
        resource_type,
        resource_id,
        actor_id,
        actor_name,
        actor_type,
        description,
        metadata,
        created_at
      FROM dbo.activity_log
      WHERE resource_type = @resourceType
        AND resource_id = @resourceId
      ORDER BY created_at DESC
    `;

    const result = await pool.request()
      .input('limit', Number(limit))
      .input('resourceType', resourceType)
      .input('resourceId', String(resourceId))
      .query(query);

    const activities = result.recordset.map((row: any) => ({
      ...row,
      metadata: row.metadata ? JSON.parse(row.metadata) : null,
    }));

    res.json({
      data: activities,
    });
  })
);

export default router;
