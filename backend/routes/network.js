const express = require('express');
const router = express.Router();
const { query } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { requirePermission, scopeFilter } = require('../middleware/rbac');

// GET /api/network - List all servers with network info (for Network sidebar page)
router.get('/', authenticate, requirePermission('servers.read'), async (req, res) => {
  try {
    const scope = scopeFilter(req);
    let where = ' WHERE 1=1';
    const params = {};
    if (scope.department_id) { where += ' AND s.department_id = @dept_id'; params.dept_id = scope.department_id; }
    if (scope.team_id) { where += ' AND s.team_id = @team_id'; params.team_id = scope.team_id; }

    const sql = `SELECT s.server_id, s.server_code, s.hostname, s.status as server_status,
      n.ip_address, n.secondary_ip, n.ipv6, n.subnet, n.vlan, n.gateway,
      n.dns_primary, n.dns_secondary, n.network_type, n.bandwidth, n.firewall_enabled, n.nat_enabled
     FROM servers s
     LEFT JOIN server_network n ON n.server_id = s.server_id
     ${where}
     ORDER BY s.server_code`;
    const result = await query(sql, params);
    res.json(result.recordset || []);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch network data.' });
  }
});

module.exports = router;
