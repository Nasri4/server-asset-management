import { Router } from 'express';
import { Request, Response } from 'express';
import { pool } from '../db/pool';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticate } from '../middleware/auth';

const router = Router();

/**
 * GET /api/saved-views
 * Get saved views for current user or system views
 * Query params:
 * - resourceType: filter by resource type (servers, incidents, maintenance)
 * - includeShared: include shared views from other users
 */
router.get(
  '/',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { resourceType, includeShared = 'true' } = req.query;
    const user = (req as any).user;
    const userId = user?.engineer_id;

    let query = `
      SELECT 
        view_id,
        user_id,
        view_name,
        resource_type,
        filter_config,
        sort_config,
        column_config,
        is_default,
        is_shared,
        created_at,
        updated_at
      FROM dbo.saved_views
      WHERE 1=1
    `;

    const conditions: string[] = [];

    // Get user's own views + system views (user_id IS NULL) + shared views
    if (includeShared === 'true') {
      conditions.push('(user_id = @userId OR user_id IS NULL OR is_shared = 1)');
    } else {
      conditions.push('(user_id = @userId OR user_id IS NULL)');
    }

    if (resourceType) {
      conditions.push('resource_type = @resourceType');
    }

    if (conditions.length > 0) {
      query += ' AND ' + conditions.join(' AND ');
    }

    query += ' ORDER BY is_default DESC, view_name ASC';

    const result = await pool.request()
      .input('userId', userId || null)
      .input('resourceType', resourceType || null)
      .query(query);

    // Parse JSON configs
    const views = result.recordset.map((row: any) => ({
      ...row,
      filter_config: row.filter_config ? JSON.parse(row.filter_config) : {},
      sort_config: row.sort_config ? JSON.parse(row.sort_config) : null,
      column_config: row.column_config ? JSON.parse(row.column_config) : null,
    }));

    res.json({
      data: views,
    });
  })
);

/**
 * GET /api/saved-views/:id
 * Get a specific saved view
 */
router.get(
  '/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const query = `
      SELECT 
        view_id,
        user_id,
        view_name,
        resource_type,
        filter_config,
        sort_config,
        column_config,
        is_default,
        is_shared,
        created_at,
        updated_at
      FROM dbo.saved_views
      WHERE view_id = @viewId
    `;

    const result = await pool.request()
      .input('viewId', Number(id))
      .query(query);

    if (result.recordset.length === 0) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Saved view not found',
        },
      });
    }

    const view = result.recordset[0];

    res.json({
      data: {
        ...view,
        filter_config: view.filter_config ? JSON.parse(view.filter_config) : {},
        sort_config: view.sort_config ? JSON.parse(view.sort_config) : null,
        column_config: view.column_config ? JSON.parse(view.column_config) : null,
      },
    });
  })
);

/**
 * POST /api/saved-views
 * Create a new saved view
 * Body: { viewName, resourceType, filterConfig, sortConfig, columnConfig, isDefault, isShared }
 */
router.post(
  '/',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { viewName, resourceType, filterConfig, sortConfig, columnConfig, isDefault = false, isShared = false } = req.body;
    const user = (req as any).user;
    const userId = user?.engineer_id;

    if (!viewName || !resourceType || !filterConfig) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing required fields: viewName, resourceType, filterConfig',
        },
      });
    }

    // If setting as default, unset other defaults for this user and resource type
    if (isDefault) {
      await pool.request()
        .input('userId', userId)
        .input('resourceType', resourceType)
        .query(`
          UPDATE dbo.saved_views
          SET is_default = 0
          WHERE user_id = @userId AND resource_type = @resourceType
        `);
    }

    const query = `
      INSERT INTO dbo.saved_views (
        user_id, view_name, resource_type,
        filter_config, sort_config, column_config,
        is_default, is_shared
      )
      VALUES (
        @userId, @viewName, @resourceType,
        @filterConfig, @sortConfig, @columnConfig,
        @isDefault, @isShared
      );
      
      SELECT 
        view_id, user_id, view_name, resource_type,
        filter_config, sort_config, column_config,
        is_default, is_shared, created_at, updated_at
      FROM dbo.saved_views
      WHERE view_id = SCOPE_IDENTITY();
    `;

    const result = await pool.request()
      .input('userId', userId || null)
      .input('viewName', viewName)
      .input('resourceType', resourceType)
      .input('filterConfig', JSON.stringify(filterConfig))
      .input('sortConfig', sortConfig ? JSON.stringify(sortConfig) : null)
      .input('columnConfig', columnConfig ? JSON.stringify(columnConfig) : null)
      .input('isDefault', isDefault)
      .input('isShared', isShared)
      .query(query);

    const view = result.recordset[0];

    res.status(201).json({
      data: {
        ...view,
        filter_config: JSON.parse(view.filter_config),
        sort_config: view.sort_config ? JSON.parse(view.sort_config) : null,
        column_config: view.column_config ? JSON.parse(view.column_config) : null,
      },
    });
  })
);

/**
 * PATCH /api/saved-views/:id
 * Update a saved view
 */
router.patch(
  '/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { viewName, filterConfig, sortConfig, columnConfig, isDefault, isShared } = req.body;
    const user = (req as any).user;
    const userId = user?.engineer_id;

    // Check if view exists and belongs to user
    const checkQuery = `
      SELECT view_id, user_id, resource_type
      FROM dbo.saved_views
      WHERE view_id = @viewId
    `;

    const checkResult = await pool.request()
      .input('viewId', Number(id))
      .query(checkQuery);

    if (checkResult.recordset.length === 0) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Saved view not found',
        },
      });
    }

    const view = checkResult.recordset[0];

    // Only allow editing own views (not system views)
    if (view.user_id !== userId && view.user_id !== null) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'You can only edit your own views',
        },
      });
    }

    // If setting as default, unset other defaults
    if (isDefault) {
      await pool.request()
        .input('userId', userId)
        .input('resourceType', view.resource_type)
        .query(`
          UPDATE dbo.saved_views
          SET is_default = 0
          WHERE user_id = @userId AND resource_type = @resourceType
        `);
    }

    // Build dynamic UPDATE query
    const updates: string[] = [];
    const params: any = { viewId: Number(id) };

    if (viewName !== undefined) {
      updates.push('view_name = @viewName');
      params.viewName = viewName;
    }

    if (filterConfig !== undefined) {
      updates.push('filter_config = @filterConfig');
      params.filterConfig = JSON.stringify(filterConfig);
    }

    if (sortConfig !== undefined) {
      updates.push('sort_config = @sortConfig');
      params.sortConfig = sortConfig ? JSON.stringify(sortConfig) : null;
    }

    if (columnConfig !== undefined) {
      updates.push('column_config = @columnConfig');
      params.columnConfig = columnConfig ? JSON.stringify(columnConfig) : null;
    }

    if (isDefault !== undefined) {
      updates.push('is_default = @isDefault');
      params.isDefault = isDefault;
    }

    if (isShared !== undefined) {
      updates.push('is_shared = @isShared');
      params.isShared = isShared;
    }

    updates.push('updated_at = GETDATE()');

    if (updates.length === 1) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'No fields to update',
        },
      });
    }

    const updateQuery = `
      UPDATE dbo.saved_views
      SET ${updates.join(', ')}
      WHERE view_id = @viewId;
      
      SELECT 
        view_id, user_id, view_name, resource_type,
        filter_config, sort_config, column_config,
        is_default, is_shared, created_at, updated_at
      FROM dbo.saved_views
      WHERE view_id = @viewId;
    `;

    const request = pool.request();
    Object.keys(params).forEach((key) => {
      request.input(key, params[key]);
    });

    const result = await request.query(updateQuery);
    const updatedView = result.recordset[0];

    res.json({
      data: {
        ...updatedView,
        filter_config: JSON.parse(updatedView.filter_config),
        sort_config: updatedView.sort_config ? JSON.parse(updatedView.sort_config) : null,
        column_config: updatedView.column_config ? JSON.parse(updatedView.column_config) : null,
      },
    });
  })
);

/**
 * DELETE /api/saved-views/:id
 * Delete a saved view
 */
router.delete(
  '/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const user = (req as any).user;
    const userId = user?.engineer_id;

    // Check if view exists and belongs to user
    const checkQuery = `
      SELECT view_id, user_id
      FROM dbo.saved_views
      WHERE view_id = @viewId
    `;

    const checkResult = await pool.request()
      .input('viewId', Number(id))
      .query(checkQuery);

    if (checkResult.recordset.length === 0) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Saved view not found',
        },
      });
    }

    const view = checkResult.recordset[0];

    // Only allow deleting own views (not system views)
    if (view.user_id !== userId && view.user_id !== null) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'You can only delete your own views',
        },
      });
    }

    await pool.request()
      .input('viewId', Number(id))
      .query('DELETE FROM dbo.saved_views WHERE view_id = @viewId');

    res.status(204).send();
  })
);

export default router;
