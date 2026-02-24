const express = require('express');
const router = express.Router();
const { query } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { requirePermission, scopeFilter } = require('../middleware/rbac');
const { auditMiddleware, logAudit } = require('../middleware/audit');
const { sendSMS } = require('../utils/sms');

router.get('/', authenticate, requirePermission('maintenance.read'), async (req, res) => {
  try {
    const scope = scopeFilter(req);
    const { status, server_id, upcoming, overdue } = req.query;

    // Auto-set status to Pending when scheduled date has passed
    await query(
      `UPDATE maintenance SET status = 'Pending', updated_at = GETDATE()
       WHERE status = 'Scheduled' AND scheduled_date < GETDATE()`
    );

    let sql = `SELECT m.*, s.server_code, s.hostname, e.full_name as engineer_name
     FROM maintenance m
     JOIN servers s ON m.server_id = s.server_id
     LEFT JOIN engineers e ON m.assigned_engineer_id = e.engineer_id
     WHERE 1=1`;
    const params = {};

    if (scope.department_id) { sql += ' AND s.department_id = @dept_id'; params.dept_id = scope.department_id; }
    if (scope.team_id) { sql += ' AND s.team_id = @team_id'; params.team_id = scope.team_id; }
    if (status) { sql += ' AND m.status = @status'; params.status = status; }
    if (server_id) { sql += ' AND m.server_id = @server_id'; params.server_id = parseInt(server_id); }
    if (upcoming === 'true') { sql += ' AND m.scheduled_date >= GETDATE() AND m.status IN (\'Scheduled\', \'Pending\')'; }
    if (overdue === 'true') { sql += ' AND m.scheduled_date < GETDATE() AND m.status IN (\'Scheduled\', \'Pending\')'; }

    sql += ' ORDER BY m.scheduled_date DESC';
    const result = await query(sql, params);
    res.json(result.recordset);
  } catch (err) {
    console.error('Maintenance list error:', err.message);
    res.status(500).json({ error: err.message || 'Failed to fetch maintenance records.' });
  }
});

router.get('/:id', authenticate, requirePermission('maintenance.read'), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid maintenance ID.' });
    const result = await query(
      `SELECT m.*, s.server_code, s.hostname, e.full_name as engineer_name,
        u.full_name as created_by_name
       FROM maintenance m
       JOIN servers s ON m.server_id = s.server_id
       LEFT JOIN engineers e ON m.assigned_engineer_id = e.engineer_id
       LEFT JOIN users u ON m.created_by = u.user_id
       WHERE m.maintenance_id = @id`,
      { id }
    );
    if (!result.recordset.length) return res.status(404).json({ error: 'Maintenance not found.' });
    res.json(result.recordset[0]);
  } catch (err) {
    console.error('Maintenance GET by id error:', err.message);
    res.status(500).json({ error: err.message || 'Failed to fetch maintenance.' });
  }
});

router.post('/', authenticate, requirePermission('maintenance.create'),
  auditMiddleware('CREATE', 'maintenance'),
  async (req, res) => {
    try {
      const { server_id, maintenance_type, title, description, scheduled_date,
              scheduled_end, priority, assigned_engineer_id, notify_team, notify_engineer,
              recurrence_type, recurrence_interval, checklist_tasks } = req.body;

      if (!server_id || !title || !scheduled_date) {
        return res.status(400).json({ error: 'Server, title, and scheduled date are required.' });
      }

      const serverId = parseInt(server_id, 10);
      const engineerId = assigned_engineer_id ? parseInt(assigned_engineer_id, 10) : null;
      const scheduledDate = new Date(scheduled_date);
      if (isNaN(scheduledDate.getTime())) {
        return res.status(400).json({ error: 'Invalid scheduled date.' });
      }
      const scheduledEnd = scheduled_end && String(scheduled_end).trim() ? new Date(scheduled_end) : null;
      if (scheduledEnd !== null && isNaN(scheduledEnd.getTime())) {
        return res.status(400).json({ error: 'Invalid scheduled end date.' });
      }
      const baseParams = {
        server_id: serverId,
        type: maintenance_type || 'Preventive',
        title: String(title).trim(),
        description: description && String(description).trim() ? String(description).trim() : null,
        date: scheduledDate,
        end_date: scheduledEnd,
        priority: priority || 'Medium',
        engineer_id: engineerId,
        notify_team: notify_team !== false ? 1 : 0,
        notify_engineer: notify_engineer !== false ? 1 : 0,
        created_by: req.user?.user_id ?? null,
      };
      if (!baseParams.created_by) {
        return res.status(401).json({ error: 'Authentication required.' });
      }
      // Use base INSERT so creation always works (recurrence/checklist need migration 001)
      const result = await query(
        `INSERT INTO maintenance (server_id, maintenance_type, title, description, scheduled_date,
         scheduled_end, priority, assigned_engineer_id, notify_team, notify_engineer, created_by)
         OUTPUT INSERTED.maintenance_id
         VALUES (@server_id, @type, @title, @description, @date, @end_date, @priority,
         @engineer_id, @notify_team, @notify_engineer, @created_by)`,
        baseParams
      );

      const maintenanceId = result.recordset[0].maintenance_id;

      // Send SMS (Hormuud) – do not fail the request if SMS fails (wrong env, network, etc.)
      const serverRow = await query('SELECT server_code, hostname FROM servers WHERE server_id = @id', { id: serverId });
      const serverName = serverRow.recordset[0]?.server_code || serverRow.recordset[0]?.hostname || 'Server';
      const priorityVal = priority || 'Medium';
      const descShort = (description || title || '').slice(0, 60);
      const smsBody = `[${serverName}] ${maintenance_type || 'Maintenance'} - ${new Date(scheduled_date).toLocaleString()} - Priority: ${priorityVal}. ${descShort}`;

      if (notify_engineer && engineerId) {
        try {
          const eng = await query('SELECT phone FROM engineers WHERE engineer_id = @id', { id: engineerId });
          if (eng.recordset[0]?.phone) {
            const smsResult = await sendSMS(eng.recordset[0].phone, smsBody, 'maintenance', 'maintenance', maintenanceId);
            if (smsResult.success) await query('UPDATE maintenance SET sms_sent = 1 WHERE maintenance_id = @id', { id: maintenanceId });
          }
        } catch (smsErr) {
          console.error('SMS to engineer failed:', smsErr.message);
        }
      }

      if (notify_team) {
        try {
          const team = await query(
            `SELECT t.oncall_phone FROM servers s JOIN teams t ON s.team_id = t.team_id WHERE s.server_id = @id`,
            { id: serverId }
          );
          if (team.recordset[0]?.oncall_phone) {
            await sendSMS(team.recordset[0].oncall_phone, smsBody, 'maintenance', 'maintenance', maintenanceId);
          }
        } catch (smsErr) {
          console.error('SMS to team failed:', smsErr.message);
        }
      }

      if (req.user) {
        try {
          await logAudit(req.user.user_id, req.user.username, 'MAINTENANCE_SCHEDULED', 'server', serverId, null,
            { maintenance_id: maintenanceId, title, maintenance_type: maintenance_type || 'Maintenance', scheduled_date, status: 'Scheduled' }, req.user.ip, req.user.userAgent, false);
        } catch (auditErr) {
          console.error('Audit log failed:', auditErr.message);
        }
      }

      res.status(201).json({ id: maintenanceId, message: 'Maintenance scheduled.' });
    } catch (err) {
      console.error('Maintenance POST error:', err.message);
      res.status(500).json({ error: err.message || 'Failed to schedule maintenance.' });
    }
  }
);

router.put('/:id', authenticate, requirePermission('maintenance.update'),
  auditMiddleware('UPDATE', 'maintenance'),
  async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ error: 'Invalid maintenance ID.' });
      const raw = req.body;
      const allowed = ['status', 'priority', 'assigned_engineer_id', 'actual_start', 'actual_end',
                        'completion_notes', 'scheduled_date', 'scheduled_end'];
      const updateFields = [];
      const params = { id };
      for (const f of allowed) {
        if (raw[f] === undefined) continue;
        let value = raw[f];
        if (f === 'scheduled_date' && value != null && value !== '') {
          value = new Date(value);
          if (isNaN(value.getTime())) continue;
        }
        if (f === 'scheduled_end' && value != null && value !== '') {
          value = new Date(value);
          if (isNaN(value.getTime())) value = null;
        }
        if (f === 'assigned_engineer_id' && (value === '' || value === null)) value = null;
        updateFields.push(`${f} = @${f}`);
        params[f] = value;
      }
      if (updateFields.length === 0) return res.status(400).json({ error: 'No fields to update.' });
      updateFields.push('updated_at = GETDATE()');
      const prev = await query('SELECT server_id, status FROM maintenance WHERE maintenance_id = @id', { id });
      await query(`UPDATE maintenance SET ${updateFields.join(', ')} WHERE maintenance_id = @id`, params);
      if (req.user && prev.recordset[0]) {
        const serverId = prev.recordset[0].server_id;
        const oldStatus = prev.recordset[0].status;
        if (raw.status !== undefined && raw.status !== oldStatus) {
          try {
            await logAudit(req.user.user_id, req.user.username, 'MAINTENANCE_STATUS_CHANGE', 'server', serverId, { status: oldStatus }, { status: raw.status }, req.user.ip, req.user.userAgent, false);
          } catch (e) { console.error('Audit log failed:', e.message); }
        } else {
          try {
            await logAudit(req.user.user_id, req.user.username, 'MAINTENANCE_UPDATED', 'server', serverId, null, raw, req.user.ip, req.user.userAgent, false);
          } catch (e) { console.error('Audit log failed:', e.message); }
        }
      }
      res.json({ message: 'Maintenance updated.' });
    } catch (err) {
      console.error('Maintenance PUT error:', err.message);
      res.status(500).json({ error: err.message || 'Failed to update maintenance.' });
    }
  }
);

module.exports = router;
