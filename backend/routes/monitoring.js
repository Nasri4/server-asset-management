const express = require('express');
const router = express.Router();
const { query } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { scopeFilter } = require('../middleware/rbac');
const { logAudit } = require('../middleware/audit');

router.get('/', authenticate, async (req, res) => {
  try {
    const scope = scopeFilter(req);
    let sql = `SELECT m.*, s.server_code, s.hostname, s.status as server_status
     FROM server_monitoring m
     JOIN servers s ON m.server_id = s.server_id WHERE 1=1`;
    const params = {};
    if (scope.department_id) { sql += ' AND s.department_id = @dept_id'; params.dept_id = scope.department_id; }
    if (scope.team_id) { sql += ' AND s.team_id = @team_id'; params.team_id = scope.team_id; }
    sql += ' ORDER BY m.health_status DESC, s.server_code';
    const result = await query(sql, params);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch monitoring data.' });
  }
});

router.put('/:server_id', authenticate, async (req, res) => {
  try {
    const serverId = parseInt(req.params.server_id);
    const { monitoring_tool, monitoring_url, cpu_threshold, ram_threshold, disk_threshold,
            uptime_percent, health_status, alert_enabled } = req.body;

    const exists = await query('SELECT 1 FROM server_monitoring WHERE server_id = @id', { id: serverId });
    if (exists.recordset.length) {
      await query(
        `UPDATE server_monitoring SET monitoring_tool = ISNULL(@tool, monitoring_tool),
         monitoring_url = ISNULL(@url, monitoring_url), cpu_threshold = ISNULL(@cpu, cpu_threshold),
         ram_threshold = ISNULL(@ram, ram_threshold), disk_threshold = ISNULL(@disk, disk_threshold),
         uptime_percent = ISNULL(@uptime, uptime_percent), health_status = ISNULL(@health, health_status),
         alert_enabled = ISNULL(@alert, alert_enabled), last_health_check = GETDATE()
         WHERE server_id = @id`,
        { id: serverId, tool: monitoring_tool, url: monitoring_url, cpu: cpu_threshold,
          ram: ram_threshold, disk: disk_threshold, uptime: uptime_percent,
          health: health_status, alert: alert_enabled }
      );
    } else {
      await query(
        `INSERT INTO server_monitoring (server_id, monitoring_tool, monitoring_url, cpu_threshold,
         ram_threshold, disk_threshold, uptime_percent, health_status, alert_enabled, last_health_check)
         VALUES (@id, @tool, @url, @cpu, @ram, @disk, @uptime, @health, @alert, GETDATE())`,
        { id: serverId, tool: monitoring_tool, url: monitoring_url,
          cpu: cpu_threshold || 80, ram: ram_threshold || 85, disk: disk_threshold || 90,
          uptime: uptime_percent || 99.99, health: health_status || 'Unknown', alert: alert_enabled ?? 1 }
      );
    }
    if (req.user) {
      await logAudit(req.user.user_id, req.user.username, 'MONITORING_UPDATED', 'server', serverId, null,
        { monitoring_tool, monitoring_url, health_status }, req.user.ip, req.user.userAgent, false);
    }
    res.json({ message: 'Monitoring data updated.' });
  } catch (err) {
    console.error('Update monitoring error:', err);
    res.status(500).json({ error: 'Failed to update monitoring.' });
  }
});

module.exports = router;
