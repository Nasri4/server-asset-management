import { Router } from 'express';
import { Request, Response } from 'express';
import { pool } from '../db/pool';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticate } from '../middleware/auth';

const router = Router();

/**
 * GET /api/search
 * Global search across all resources
 * Query params:
 * - q: search query (required)
 * - limit: max results per resource type (default: 5)
 */
router.get(
  '/',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { q, limit = 5 } = req.query;

    if (!q || typeof q !== 'string' || q.trim().length === 0) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Search query (q) is required',
        },
      });
    }

    const searchTerm = `%${q.trim()}%`;
    const maxResults = Number(limit);

    // Search across multiple resources in parallel
    const [servers, incidents, maintenance, engineers, locations] = await Promise.all([
      searchServers(searchTerm, maxResults),
      searchIncidents(searchTerm, maxResults),
      searchMaintenance(searchTerm, maxResults),
      searchEngineers(searchTerm, maxResults),
      searchLocations(searchTerm, maxResults),
    ]);

    const totalResults =
      servers.length +
      incidents.length +
      maintenance.length +
      engineers.length +
      locations.length;

    res.json({
      data: {
        servers,
        incidents,
        maintenance,
        engineers,
        locations,
      },
      meta: {
        query: q,
        totalResults,
      },
    });
  })
);

/**
 * Search servers
 */
async function searchServers(searchTerm: string, limit: number) {
  const query = `
    SELECT TOP (@limit)
      server_id,
      server_code,
      hostname,
      status,
      environment,
      role
    FROM dbo.servers
    WHERE (
      server_code LIKE @searchTerm
      OR hostname LIKE @searchTerm
      OR role LIKE @searchTerm
    )
    AND deleted_at IS NULL
    ORDER BY
      CASE
        WHEN server_code LIKE @searchTerm THEN 1
        WHEN hostname LIKE @searchTerm THEN 2
        ELSE 3
      END,
      server_code ASC
  `;

  const result = await pool.request()
    .input('limit', limit)
    .input('searchTerm', searchTerm)
    .query(query);

  return result.recordset.map((row: any) => ({
    id: row.server_id,
    type: 'server',
    title: row.server_code,
    subtitle: row.hostname,
    url: `/assets/${row.server_id}`,
    metadata: {
      status: row.status,
      environment: row.environment,
      role: row.role,
    },
  }));
}

/**
 * Search incidents
 */
async function searchIncidents(searchTerm: string, limit: number) {
  const query = `
    SELECT TOP (@limit)
      si.incident_id,
      si.server_id,
      s.server_code,
      si.incident_type,
      si.severity,
      si.status,
      si.description,
      si.reported_at
    FROM dbo.server_incidents si
    LEFT JOIN dbo.servers s ON si.server_id = s.server_id
    WHERE (
      s.server_code LIKE @searchTerm
      OR si.incident_type LIKE @searchTerm
      OR si.description LIKE @searchTerm
    )
    ORDER BY si.reported_at DESC
  `;

  const result = await pool.request()
    .input('limit', limit)
    .input('searchTerm', searchTerm)
    .query(query);

  return result.recordset.map((row: any) => ({
    id: row.incident_id,
    type: 'incident',
    title: `Incident #${row.incident_id} - ${row.incident_type || 'Unknown'}`,
    subtitle: row.server_code || 'No server',
    url: `/incidents/${row.incident_id}`,
    metadata: {
      severity: row.severity,
      status: row.status,
      reported_at: row.reported_at,
    },
  }));
}

/**
 * Search maintenance
 */
async function searchMaintenance(searchTerm: string, limit: number) {
  const query = `
    SELECT TOP (@limit)
      sm.maintenance_id,
      sm.server_id,
      s.server_code,
      sm.maintenance_type,
      sm.status,
      sm.scheduled_start,
      sm.notes
    FROM dbo.server_maintenance sm
    LEFT JOIN dbo.servers s ON sm.server_id = s.server_id
    WHERE (
      s.server_code LIKE @searchTerm
      OR sm.maintenance_type LIKE @searchTerm
      OR sm.notes LIKE @searchTerm
    )
    ORDER BY sm.scheduled_start DESC
  `;

  const result = await pool.request()
    .input('limit', limit)
    .input('searchTerm', searchTerm)
    .query(query);

  return result.recordset.map((row: any) => ({
    id: row.maintenance_id,
    type: 'maintenance',
    title: `Maintenance #${row.maintenance_id} - ${row.maintenance_type || 'Unknown'}`,
    subtitle: row.server_code || 'No server',
    url: `/maintenance/${row.maintenance_id}`,
    metadata: {
      status: row.status,
      scheduled_start: row.scheduled_start,
    },
  }));
}

/**
 * Search engineers
 */
async function searchEngineers(searchTerm: string, limit: number) {
  const query = `
    SELECT TOP (@limit)
      e.engineer_id,
      e.full_name,
      e.email,
      e.phone,
      t.team_name
    FROM dbo.engineers e
    LEFT JOIN dbo.teams t ON e.team_id = t.team_id
    WHERE e.is_active = 1
      AND (
        e.full_name LIKE @searchTerm
        OR e.email LIKE @searchTerm
      )
    ORDER BY e.full_name ASC
  `;

  const result = await pool.request()
    .input('limit', limit)
    .input('searchTerm', searchTerm)
    .query(query);

  return result.recordset.map((row: any) => ({
    id: row.engineer_id,
    type: 'engineer',
    title: row.full_name,
    subtitle: row.email || row.team_name || '',
    url: `/engineers/${row.engineer_id}`,
    metadata: {
      email: row.email,
      phone: row.phone,
      team: row.team_name,
    },
  }));
}

/**
 * Search locations
 */
async function searchLocations(searchTerm: string, limit: number) {
  const query = `
    SELECT TOP (@limit)
      location_id,
      site_name,
      address,
      site_type
    FROM dbo.locations
    WHERE (
      site_name LIKE @searchTerm
      OR address LIKE @searchTerm
      OR site_type LIKE @searchTerm
    )
    ORDER BY site_name ASC
  `;

  const result = await pool.request()
    .input('limit', limit)
    .input('searchTerm', searchTerm)
    .query(query);

  return result.recordset.map((row: any) => ({
    id: row.location_id,
    type: 'location',
    title: row.site_name,
    subtitle: row.address || row.site_type || '',
    url: `/locations/${row.location_id}`,
    metadata: {
      site_type: row.site_type,
      address: row.address,
    },
  }));
}

export default router;
