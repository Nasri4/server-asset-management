const express = require('express');
const router = express.Router();
const { query } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { scopeFilter } = require('../middleware/rbac');
const { logAudit } = require('../middleware/audit');

router.get('/', authenticate, async (req, res) => {
  try {
    const scope = scopeFilter(req);
    let sql = `SELECT sec.*, s.server_code, s.hostname, s.status as server_status
     FROM server_security sec
     JOIN servers s ON sec.server_id = s.server_id WHERE 1=1`;
    const params = {};
    if (scope.department_id) { sql += ' AND s.department_id = @dept_id'; params.dept_id = scope.department_id; }
    if (scope.team_id) { sql += ' AND s.team_id = @team_id'; params.team_id = scope.team_id; }
    sql += ' ORDER BY sec.hardening_status, s.server_code';
    const result = await query(sql, params);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch security data.' });
  }
});

router.put('/:server_id', authenticate, async (req, res) => {
  try {
    const serverId = parseInt(req.params.server_id);
    const fields = req.body;
    const exists = await query('SELECT 1 FROM server_security WHERE server_id = @id', { id: serverId });

    if (exists.recordset.length) {
      const allowed = ['os_name', 'os_version', 'hardening_status', 'ssh_key_only', 'antivirus_installed',
        'backup_enabled', 'backup_frequency', 'backup_destination', 'log_retention_days',
        'compliance_status', 'last_audit_date', 'next_audit_date'];
      const updateFields = [];
      const params = { id: serverId };
      for (const f of allowed) {
        if (fields[f] !== undefined) { updateFields.push(`${f} = @${f}`); params[f] = fields[f]; }
      }
      if (updateFields.length) {
        await query(`UPDATE server_security SET ${updateFields.join(', ')} WHERE server_id = @id`, params);
      }
    } else {
      await query(
        `INSERT INTO server_security (server_id, os_name, os_version, hardening_status,
         ssh_key_only, antivirus_installed, backup_enabled, backup_frequency, log_retention_days)
         VALUES (@id, @os_name, @os_version, @hardening, @ssh, @av, @backup, @freq, @retention)`,
        { id: serverId, os_name: fields.os_name, os_version: fields.os_version,
          hardening: fields.hardening_status || 'Pending', ssh: fields.ssh_key_only || 0,
          av: fields.antivirus_installed || 0, backup: fields.backup_enabled || 0,
          freq: fields.backup_frequency, retention: fields.log_retention_days || 90 }
      );
    }
    if (req.user) {
      await logAudit(req.user.user_id, req.user.username, 'SECURITY_UPDATED', 'server', serverId, null, fields, req.user.ip, req.user.userAgent, false);
    }
    res.json({ message: 'Security data updated.' });
  } catch (err) {
    console.error('Update security error:', err);
    res.status(500).json({ error: 'Failed to update security.' });
  }
});

module.exports = router;
