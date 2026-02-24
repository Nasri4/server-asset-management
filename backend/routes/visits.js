const express = require('express');
const router = express.Router();
const { query } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { requirePermission, scopeFilter } = require('../middleware/rbac');
const { logAudit } = require('../middleware/audit');

// GET /api/visits - List all visits (optional server_id filter). When no server_id, returns all with server + engineer info.
router.get('/', authenticate, requirePermission('servers.read'), async (req, res) => {
  try {
    const serverId = req.query.server_id ? parseInt(req.query.server_id) : null;
    const scope = scopeFilter(req);

    if (serverId) {
      const result = await query(
        `SELECT v.*, e.full_name as engineer_name
         FROM server_visits v
         JOIN engineers e ON v.engineer_id = e.engineer_id
         WHERE v.server_id = @server_id
         ORDER BY v.visit_date DESC`,
        { server_id: serverId }
      );
      return res.json(result.recordset || []);
    }

    let where = ' WHERE 1=1';
    const params = {};
    if (scope.department_id) { where += ' AND s.department_id = @dept_id'; params.dept_id = scope.department_id; }
    if (scope.team_id) { where += ' AND s.team_id = @team_id'; params.team_id = scope.team_id; }

    const result = await query(
      `SELECT v.*, e.full_name as engineer_name, s.server_code, s.hostname
       FROM server_visits v
       JOIN engineers e ON v.engineer_id = e.engineer_id
       JOIN servers s ON v.server_id = s.server_id
       ${where}
       ORDER BY v.visit_date DESC`,
      params
    );
    res.json(result.recordset || []);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch visits.' });
  }
});

// POST /api/visits - Create visit (body: server_id, engineer_id, visit_date, visit_type, location, notes, result_outcome, status)
router.post('/', authenticate, requirePermission('servers.update'),
  async (req, res) => {
    try {
      const { server_id, engineer_id, visit_date, visit_type, location, notes, result_outcome, status } = req.body;
      if (!server_id || !engineer_id || !visit_date) {
        return res.status(400).json({ error: 'Server, engineer, and visit date are required.' });
      }
      const serverId = parseInt(server_id);
      // Accept `purpose` directly, or build it from legacy location+notes fields
      const purposeValue = req.body.purpose !== undefined
        ? (req.body.purpose || null)
        : ([location, notes].filter(Boolean).join(' | ') || null);
      const result = await query(
        `INSERT INTO server_visits (server_id, engineer_id, visit_date, visit_type, purpose, findings, actions_taken)
         OUTPUT INSERTED.visit_id
         VALUES (@server_id, @engineer_id, @visit_date, @visit_type, @purpose, @findings, @actions_taken)`,
        {
          server_id: serverId,
          engineer_id: parseInt(engineer_id),
          visit_date: visit_date,
          visit_type: visit_type || 'Inspection',
          purpose: purposeValue,
          findings: result_outcome || null,
          actions_taken: status || null,
        }
      );
      const visitId = result.recordset[0].visit_id;
      if (req.user) {
        await logAudit(
          req.user.user_id,
          req.user.username,
          'VISIT_REGISTERED',
          'server',
          serverId,
          null,
          { visit_id: visitId, visit_type: visit_type || 'Inspection', visit_date: visit_date },
          req.user.ip,
          req.user.userAgent,
          false
        );
      }
      res.status(201).json({ id: visitId, visit_id: visitId, message: 'Visit registered.' });
    } catch (err) {
      res.status(500).json({ error: err.message || 'Failed to create visit.' });
    }
  }
);

// GET /api/visits/:id - Get one visit
router.get('/:id', authenticate, requirePermission('servers.read'), async (req, res) => {
  try {
    const result = await query(
      `SELECT v.*, e.full_name as engineer_name, s.server_code, s.hostname
       FROM server_visits v
       JOIN engineers e ON v.engineer_id = e.engineer_id
       JOIN servers s ON v.server_id = s.server_id
       WHERE v.visit_id = @id`,
      { id: parseInt(req.params.id) }
    );
    if (!result.recordset.length) return res.status(404).json({ error: 'Visit not found.' });
    res.json(result.recordset[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch visit.' });
  }
});

// PUT /api/visits/:id - Update visit
router.put('/:id', authenticate, requirePermission('servers.update'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { engineer_id, visit_date, visit_type, location, notes, result_outcome, status } = req.body;
    const updates = [];
    const params = { id };
    if (engineer_id !== undefined) { updates.push('engineer_id = @engineer_id'); params.engineer_id = parseInt(engineer_id); }
    if (visit_date !== undefined) { updates.push('visit_date = @visit_date'); params.visit_date = visit_date; }
    if (visit_type !== undefined) { updates.push('visit_type = @visit_type'); params.visit_type = visit_type; }
    if (req.body.purpose !== undefined) {
      updates.push('purpose = @purpose');
      params.purpose = req.body.purpose || null;
    } else if (notes !== undefined || location !== undefined) {
      const purpose = [req.body.location, req.body.notes].filter(Boolean).join(' | ') || null;
      updates.push('purpose = @purpose');
      params.purpose = purpose;
    }
    if (result_outcome !== undefined) { updates.push('findings = @findings'); params.findings = result_outcome; }
    if (status !== undefined) { updates.push('actions_taken = @actions_taken'); params.actions_taken = status; }
    if (!updates.length) return res.status(400).json({ error: 'No fields to update.' });
    await query(`UPDATE server_visits SET ${updates.join(', ')} WHERE visit_id = @id`, params);
    res.json({ message: 'Visit updated.' });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to update visit.' });
  }
});

// DELETE /api/visits/:id - Delete visit
router.delete('/:id', authenticate, requirePermission('servers.update'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid visit ID.' });
    const exists = await query('SELECT server_id, visit_type, visit_date FROM server_visits WHERE visit_id = @id', { id });
    if (!exists.recordset.length) return res.status(404).json({ error: 'Visit not found.' });
    const { server_id, visit_type, visit_date } = exists.recordset[0];
    await query('DELETE FROM server_visits WHERE visit_id = @id', { id });
    if (req.user) {
      await logAudit(req.user.user_id, req.user.username, 'VISIT_DELETED', 'server', server_id, { visit_id: id, visit_type, visit_date }, null, req.user.ip, req.user.userAgent, false);
    }
    res.json({ message: 'Visit deleted.' });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to delete visit.' });
  }
});

module.exports = router;
