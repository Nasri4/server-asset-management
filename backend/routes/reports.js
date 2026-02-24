const express = require('express');
const router = express.Router();
const { execute, query } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { requirePermission, scopeFilter } = require('../middleware/rbac');

router.get('/server-inventory', authenticate, requirePermission('reports.read'), async (req, res) => {
  try {
    const scope = scopeFilter(req);
    const result = await execute('sp_ReportServerInventory', {
      department_id: scope.department_id || req.query.department_id || null,
      team_id: scope.team_id || req.query.team_id || null,
      status: req.query.status || null,
    });
    const data = result.recordset ?? result.recordsets?.[0] ?? [];
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate report.' });
  }
});

router.get('/incident-summary', authenticate, requirePermission('reports.read'), async (req, res) => {
  try {
    const scope = scopeFilter(req);
    const result = await execute('sp_ReportIncidentSummary', {
      start_date: req.query.start_date || null,
      end_date: req.query.end_date || null,
      department_id: scope.department_id || req.query.department_id || null,
    });
    res.json({ incidents: result.recordsets[0], summary: result.recordsets[1] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate report.' });
  }
});

router.get('/maintenance-compliance', authenticate, requirePermission('reports.read'), async (req, res) => {
  try {
    const scope = scopeFilter(req);
    let sql = `SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN status IN ('Scheduled', 'Pending') AND scheduled_date < GETDATE() THEN 1 ELSE 0 END) as overdue,
      SUM(CASE WHEN status IN ('Scheduled', 'Pending') AND scheduled_date >= GETDATE() THEN 1 ELSE 0 END) as upcoming
     FROM maintenance m JOIN servers s ON m.server_id = s.server_id WHERE 1=1`;
    const params = {};
    if (scope.department_id) { sql += ' AND s.department_id = @dept_id'; params.dept_id = scope.department_id; }
    if (scope.team_id) { sql += ' AND s.team_id = @team_id'; params.team_id = scope.team_id; }
    const result = await query(sql, params);
    res.json(result.recordset[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate report.' });
  }
});

router.get('/warranty-expiry', authenticate, requirePermission('reports.read'), async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 90;
    const scope = scopeFilter(req);
    let sql = `SELECT h.*, s.server_code, s.hostname, s.status, t.team_name
     FROM server_hardware h
     JOIN servers s ON h.server_id = s.server_id
     LEFT JOIN teams t ON s.team_id = t.team_id
     WHERE h.warranty_expiry BETWEEN GETDATE() AND DATEADD(DAY, @days, GETDATE())`;
    const params = { days };
    if (scope.department_id) { sql += ' AND s.department_id = @dept_id'; params.dept_id = scope.department_id; }
    sql += ' ORDER BY h.warranty_expiry';
    const result = await query(sql, params);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate report.' });
  }
});

module.exports = router;
