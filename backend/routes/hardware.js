const express = require('express');
const router = express.Router();
const { query } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { requirePermission, scopeFilter } = require('../middleware/rbac');

// GET /api/hardware - List all servers with hardware info (for Hardware sidebar page)
router.get('/', authenticate, requirePermission('servers.read'), async (req, res) => {
  try {
    const scope = scopeFilter(req);
    let where = ' WHERE 1=1';
    const params = {};
    if (scope.department_id) { where += ' AND s.department_id = @dept_id'; params.dept_id = scope.department_id; }
    if (scope.team_id) { where += ' AND s.team_id = @team_id'; params.team_id = scope.team_id; }

    const sql = `SELECT s.server_id, s.server_code, s.hostname, s.status as server_status,
      h.vendor, h.model, h.serial_number, h.asset_tag, h.cpu_model, h.cpu_cores, h.ram_gb, h.storage_tb,
      h.raid_level, h.nic_count, h.power_supply, h.warranty_start, h.warranty_expiry
     FROM servers s
     LEFT JOIN server_hardware h ON h.server_id = s.server_id
     ${where}
     ORDER BY s.server_code`;
    const result = await query(sql, params);
    res.json(result.recordset || []);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch hardware data.' });
  }
});

module.exports = router;
