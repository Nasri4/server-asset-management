const express = require('express');
const router = express.Router();
const { execute, query } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { scopeFilter } = require('../middleware/rbac');

router.get('/', authenticate, async (req, res) => {
  try {
    const scope = scopeFilter(req);
    const result = await execute('sp_GetDashboardStats', {
      user_id: req.user.user_id,
      role_name: req.user.role_name,
      department_id: scope.department_id || null,
      team_id: scope.team_id || null,
      engineer_id: scope.engineer_id || null,
    });

    const [serverStats, incidentsBySeverity, upcomingMaintenance, overdueMaintenance, expiringWarranties, recentActivity] = result.recordsets;

    res.json({
      serverStats: serverStats[0] || {},
      incidentsBySeverity,
      upcomingMaintenance,
      overdueCount: overdueMaintenance[0]?.overdue_count || 0,
      expiringWarranties: expiringWarranties[0]?.expiring_warranties || 0,
      recentActivity,
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: 'Failed to load dashboard.' });
  }
});

// GET /api/dashboard/engineer-workspace - For engineers: assigned servers, maintenance, incidents, visits
router.get('/engineer-workspace', authenticate, async (req, res) => {
  try {
    const engineerId = req.user.engineer_id;
    if (!engineerId) {
      return res.json({ assignedServers: [], myMaintenance: [], myIncidents: [], myVisits: [] });
    }

    const [serversRes, maintRes, incRes, visitsRes] = await Promise.all([
      query(
        `SELECT TOP 15 s.server_id, s.server_code, s.hostname, s.status
         FROM servers s
         JOIN server_assignments sa ON sa.server_id = s.server_id AND sa.engineer_id = @eng_id AND sa.unassigned_at IS NULL
         ORDER BY s.server_code`,
        { eng_id: engineerId }
      ),
      query(
        `SELECT TOP 10 m.maintenance_id, m.title, m.status, m.scheduled_date, m.server_id, s.server_code
         FROM maintenance m
         JOIN servers s ON m.server_id = s.server_id
         WHERE m.assigned_engineer_id = @eng_id AND m.status IN ('Scheduled', 'Pending', 'In Progress')
         ORDER BY m.scheduled_date ASC`,
        { eng_id: engineerId }
      ),
      query(
        `SELECT TOP 10 i.incident_id, i.title, i.severity, i.status, i.server_id, s.server_code, i.sla_deadline
         FROM incidents i
         JOIN servers s ON i.server_id = s.server_id
         WHERE i.assigned_to = @eng_id AND i.status NOT IN ('Resolved', 'Closed')
         ORDER BY i.reported_at DESC`,
        { eng_id: engineerId }
      ),
      query(
        `SELECT TOP 10 v.visit_id, v.visit_date, v.visit_type, v.server_id, s.server_code
         FROM server_visits v
         JOIN servers s ON v.server_id = s.server_id
         WHERE v.engineer_id = @eng_id AND v.visit_date >= CAST(GETDATE() AS DATE)
         ORDER BY v.visit_date ASC`,
        { eng_id: engineerId }
      ),
    ]);

    res.json({
      assignedServers: serversRes.recordset || [],
      myMaintenance: maintRes.recordset || [],
      myIncidents: incRes.recordset || [],
      myVisits: visitsRes.recordset || [],
    });
  } catch (err) {
    console.error('Engineer workspace error:', err);
    res.status(500).json({ error: 'Failed to load engineer workspace.' });
  }
});

module.exports = router;
