const express = require('express');
const router = express.Router();
const { query } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { auditMiddleware } = require('../middleware/audit');

router.get('/', authenticate, async (req, res) => {
  try {
    const result = await query(
      `SELECT a.*,
        (SELECT COUNT(*) FROM server_applications WHERE application_id = a.application_id) as server_count
       FROM applications a ORDER BY a.app_name`
    );
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch applications.' });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const app = await query('SELECT * FROM applications WHERE application_id = @id', { id: parseInt(req.params.id) });
    if (!app.recordset.length) return res.status(404).json({ error: 'Application not found.' });
    const servers = await query(
      `SELECT sa.*, s.server_code, s.hostname, t.team_name
       FROM server_applications sa
       JOIN servers s ON sa.server_id = s.server_id
       LEFT JOIN teams t ON sa.owner_team_id = t.team_id
       WHERE sa.application_id = @id`,
      { id: parseInt(req.params.id) }
    );
    res.json({ application: app.recordset[0], servers: servers.recordset });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch application.' });
  }
});

router.post('/', authenticate, auditMiddleware('CREATE', 'application'), async (req, res) => {
  try {
    const { app_name, app_type, version, criticality, sla_level, description, server_id } = req.body;
    if (!app_name || typeof app_name !== 'string' || !app_name.trim()) {
      return res.status(400).json({ error: 'Application name is required.' });
    }
    const existing = await query(
      `SELECT 1 FROM applications WHERE LOWER(TRIM(app_name)) = LOWER(TRIM(@name))`,
      { name: app_name }
    );
    if (existing.recordset.length) {
      return res.status(409).json({ error: 'An application with this name already exists.' });
    }
    const result = await query(
      `INSERT INTO applications (app_name, app_type, version, criticality, sla_level, description)
       OUTPUT INSERTED.application_id VALUES (@name, @type, @version, @crit, @sla, @desc)`,
      { name: app_name, type: app_type, version, crit: criticality, sla: sla_level, desc: description }
    );
    const appId = result.recordset[0].application_id;
    if (server_id) {
      await query(
        `INSERT INTO server_applications (server_id, application_id, owner_team_id)
         VALUES (@server_id, @app_id, NULL)`,
        { server_id: parseInt(server_id), app_id: appId }
      );
    }
    res.status(201).json({ id: appId, message: server_id ? 'Application created and linked to server.' : 'Application created.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create application.' });
  }
});

router.put('/:id', authenticate, auditMiddleware('UPDATE', 'application'), async (req, res) => {
  try {
    const fields = req.body;
    const allowed = ['app_name', 'app_type', 'version', 'criticality', 'sla_level', 'description'];
    const updateFields = [];
    const params = { id: parseInt(req.params.id) };
    for (const f of allowed) {
      if (fields[f] !== undefined) { updateFields.push(`${f} = @${f}`); params[f] = fields[f]; }
    }
    if (!updateFields.length) return res.status(400).json({ error: 'No fields to update.' });
    if (fields.app_name !== undefined) {
      const dup = await query(
        `SELECT 1 FROM applications WHERE LOWER(TRIM(app_name)) = LOWER(TRIM(@name)) AND application_id != @id`,
        { name: fields.app_name, id: parseInt(req.params.id) }
      );
      if (dup.recordset.length) return res.status(409).json({ error: 'An application with this name already exists.' });
    }
    await query(`UPDATE applications SET ${updateFields.join(', ')} WHERE application_id = @id`, params);
    res.json({ message: 'Application updated.' });
  } catch (err) {
    console.error('Update application error:', err);
    res.status(500).json({ error: 'Failed to update application.' });
  }
});

router.post('/server-link', authenticate, auditMiddleware('LINK', 'server_application'), async (req, res) => {
  try {
    const { server_id, application_id, ports, database_type, database_name, owner_team_id } = req.body;
    if (!server_id || !application_id) return res.status(400).json({ error: 'Server and application IDs are required.' });
    await query(
      `INSERT INTO server_applications (server_id, application_id, ports, database_type, database_name, owner_team_id)
       VALUES (@server_id, @app_id, @ports, @db_type, @db_name, @owner)`,
      { server_id, app_id: application_id, ports, db_type: database_type, db_name: database_name, owner: owner_team_id }
    );
    res.status(201).json({ message: 'Application linked to server.' });
  } catch (err) {
    console.error('Link application error:', err);
    if (err?.message?.includes('UNIQUE') || err?.message?.includes('duplicate')) {
      return res.status(409).json({ error: 'Application already linked to this server.' });
    }
    res.status(500).json({ error: 'Failed to link application.' });
  }
});

module.exports = router;
