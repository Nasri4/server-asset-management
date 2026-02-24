const express = require('express');
const router = express.Router();
const { query } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { requirePermission, scopeFilter } = require('../middleware/rbac');
const { auditMiddleware, logAudit } = require('../middleware/audit');
const { sendSMS } = require('../utils/sms');

router.get('/', authenticate, requirePermission('incidents.read'), async (req, res) => {
  try {
    const scope = scopeFilter(req);
    const { status, severity, server_id, page = 1, page_size = 25 } = req.query;
    const p = Math.max(1, parseInt(page, 10) || 1);
    const ps = Math.min(100, Math.max(1, parseInt(page_size, 10) || 25));
    const offset = (p - 1) * ps;

    let sql = `SELECT i.*, s.server_code, s.hostname, e.full_name as assigned_engineer,
      u.full_name as reported_by_name
     FROM incidents i
     JOIN servers s ON i.server_id = s.server_id
     LEFT JOIN engineers e ON i.assigned_to = e.engineer_id
     LEFT JOIN users u ON i.reported_by = u.user_id
     WHERE 1=1`;
    const params = {};

    if (scope.department_id) { sql += ' AND s.department_id = @dept_id'; params.dept_id = scope.department_id; }
    if (scope.team_id) { sql += ' AND s.team_id = @team_id'; params.team_id = scope.team_id; }
    if (scope.engineer_id) { sql += ' AND i.assigned_to = @eng_id'; params.eng_id = scope.engineer_id; }
    if (status) { sql += ' AND i.status = @status'; params.status = status; }
    if (severity) { sql += ' AND i.severity = @severity'; params.severity = severity; }
    if (server_id) { sql += ' AND i.server_id = @server_id'; params.server_id = parseInt(server_id, 10); }

    sql += ` ORDER BY i.reported_at DESC OFFSET @offset ROWS FETCH NEXT @page_size ROWS ONLY`;
    params.offset = offset;
    params.page_size = ps;
    const result = await query(sql, params);
    res.json({ incidents: result.recordset, page: p, page_size: ps });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch incidents.' });
  }
});

router.get('/:id', authenticate, requirePermission('incidents.read'), async (req, res) => {
  try {
    const result = await query(
      `SELECT i.*, s.server_code, s.hostname, e.full_name as assigned_engineer,
        u.full_name as reported_by_name, esc.full_name as escalated_to_name
       FROM incidents i
       JOIN servers s ON i.server_id = s.server_id
       LEFT JOIN engineers e ON i.assigned_to = e.engineer_id
       LEFT JOIN users u ON i.reported_by = u.user_id
       LEFT JOIN engineers esc ON i.escalated_to = esc.engineer_id
       WHERE i.incident_id = @id`,
      { id: parseInt(req.params.id) }
    );
    if (!result.recordset.length) return res.status(404).json({ error: 'Incident not found.' });
    res.json(result.recordset[0]);
  } catch (err) {
    console.error('Get incident error:', err);
    res.status(500).json({ error: 'Failed to fetch incident.' });
  }
});

router.post('/', authenticate, requirePermission('incidents.create'),
  auditMiddleware('CREATE', 'incident'),
  async (req, res) => {
    try {
      const { server_id, incident_type, title, severity, description, assigned_to } = req.body;
      if (!server_id || !title || !severity) {
        return res.status(400).json({ error: 'Server, title, and severity are required.' });
      }

      const slaHours = { Critical: 2, High: 4, Medium: 8, Low: 24 };
      const sla = slaHours[severity] || 24;

      const result = await query(
        `INSERT INTO incidents (server_id, incident_type, title, severity, description, status,
         reported_by, assigned_to, sla_deadline)
         OUTPUT INSERTED.incident_id
         VALUES (@server_id, @type, @title, @severity, @description, 'Open',
         @reported_by, @assigned_to, DATEADD(HOUR, @sla, GETDATE()))`,
        { server_id, type: incident_type, title, severity, description,
          reported_by: req.user.user_id, assigned_to: assigned_to || null, sla }
      );

      // Send SMS for critical incidents
      if (severity === 'Critical') {
        const server = await query(
          `SELECT s.server_code, t.oncall_phone FROM servers s
           LEFT JOIN teams t ON s.team_id = t.team_id WHERE s.server_id = @id`,
          { id: server_id }
        );
        if (server.recordset[0]?.oncall_phone) {
          await sendSMS(
            server.recordset[0].oncall_phone,
            `CRITICAL INCIDENT: ${title} on ${server.recordset[0].server_code}. Immediate attention required.`,
            'incident', 'incident', result.recordset[0].incident_id
          );
        }
      }

      await logAudit(req.user.user_id, req.user.username, 'INCIDENT_CREATED', 'server', server_id, null,
        { incident_id: result.recordset[0].incident_id, title, severity }, req.user.ip, req.user.userAgent, false);

      res.status(201).json({ id: result.recordset[0].incident_id, message: 'Incident created.' });
    } catch (err) {
      res.status(500).json({ error: 'Failed to create incident.' });
    }
  }
);

router.put('/:id', authenticate, requirePermission('incidents.update'),
  auditMiddleware('UPDATE', 'incident'),
  async (req, res) => {
    try {
      const fields = req.body;
      const allowed = ['status', 'severity', 'assigned_to', 'escalated_to', 'root_cause', 'resolution_notes'];
      const updateFields = [];
      const params = { id: parseInt(req.params.id) };

      for (const f of allowed) {
        if (fields[f] !== undefined) { updateFields.push(`${f} = @${f}`); params[f] = fields[f]; }
      }

      if (fields.status === 'Investigating') { updateFields.push('acknowledged_at = GETDATE()'); }
      if (fields.status === 'Resolved') { updateFields.push('resolved_at = GETDATE()'); }
      if (fields.status === 'Closed') { updateFields.push('closed_at = GETDATE()'); }

      if (!updateFields.length) return res.status(400).json({ error: 'No fields to update.' });
      updateFields.push('updated_at = GETDATE()');
      const incidentId = parseInt(req.params.id);
      const serverRow = await query('SELECT server_id FROM incidents WHERE incident_id = @id', { id: incidentId });
      await query(`UPDATE incidents SET ${updateFields.join(', ')} WHERE incident_id = @id`, params);
      if (serverRow.recordset[0]) {
        await logAudit(req.user.user_id, req.user.username, 'INCIDENT_UPDATED', 'server', serverRow.recordset[0].server_id, null,
          fields, req.user.ip, req.user.userAgent, false);
      }
      res.json({ message: 'Incident updated.' });
    } catch (err) {
      console.error('Update incident error:', err);
      res.status(500).json({ error: 'Failed to update incident.' });
    }
  }
);

module.exports = router;
