const express = require('express');
const router = express.Router();
const { query } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { scopeFilter } = require('../middleware/rbac');

// GET /api/search?q= - Global search across servers, applications, engineers, incidents
router.get('/', authenticate, async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q || q.length < 2) {
      return res.json({ servers: [], applications: [], engineers: [], incidents: [] });
    }

    const scope = scopeFilter(req);
    const pattern = '%' + q + '%';

    let serverWhere = ' WHERE (s.server_code LIKE @pattern OR s.hostname LIKE @pattern)';
    const serverParams = { pattern };
    if (scope.department_id) { serverWhere += ' AND s.department_id = @dept_id'; serverParams.dept_id = scope.department_id; }
    if (scope.team_id) { serverWhere += ' AND s.team_id = @team_id'; serverParams.team_id = scope.team_id; }
    if (scope.engineer_id) {
      serverWhere += ' AND EXISTS (SELECT 1 FROM server_assignments sa WHERE sa.server_id = s.server_id AND sa.engineer_id = @eng_id AND sa.unassigned_at IS NULL)';
      serverParams.eng_id = scope.engineer_id;
    }

    const [serverRes, appRes, engRes, incRes] = await Promise.all([
      query(
        `SELECT TOP 10 s.server_id, s.server_code, s.hostname, s.status
         FROM servers s ${serverWhere}
         ORDER BY s.server_code`,
        serverParams
      ),
      query(
        `SELECT TOP 10 a.application_id, a.app_name, a.app_type
         FROM applications a
         WHERE a.app_name LIKE @pattern`,
        { pattern }
      ),
      query(
        `SELECT TOP 10 e.engineer_id, e.full_name, e.employee_id
         FROM engineers e
         WHERE e.full_name LIKE @pattern OR e.employee_id LIKE @pattern`,
        { pattern }
      ),
      (() => {
        let incWhere = ' WHERE i.title LIKE @pattern';
        const incParams = { pattern };
        if (scope.department_id) { incWhere += ' AND s.department_id = @dept_id'; incParams.dept_id = scope.department_id; }
        if (scope.team_id) { incWhere += ' AND s.team_id = @team_id'; incParams.team_id = scope.team_id; }
        if (scope.engineer_id) { incWhere += ' AND i.assigned_to = @eng_id'; incParams.eng_id = scope.engineer_id; }
        return query(
          `SELECT TOP 10 i.incident_id, i.title, i.severity, i.status, i.server_id, s.server_code
           FROM incidents i
           JOIN servers s ON i.server_id = s.server_id
           ${incWhere}
           ORDER BY i.reported_at DESC`,
          incParams
        );
      })(),
    ]);

    res.json({
      servers: serverRes.recordset || [],
      applications: appRes.recordset || [],
      engineers: engRes.recordset || [],
      incidents: incRes.recordset || [],
    });
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Search failed.' });
  }
});

module.exports = router;
