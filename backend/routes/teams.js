const express = require('express');
const router = express.Router();
const { query } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { requirePermission, scopeFilter } = require('../middleware/rbac');
const { auditMiddleware } = require('../middleware/audit');

router.get('/', authenticate, requirePermission('teams.read'), async (req, res) => {
  try {
    const scope = scopeFilter(req);
    let sql = `SELECT t.*, d.department_name,
      (SELECT COUNT(*) FROM engineers WHERE team_id = t.team_id AND is_active = 1) as engineer_count,
      (SELECT COUNT(*) FROM servers WHERE team_id = t.team_id) as server_count
     FROM teams t JOIN departments d ON t.department_id = d.department_id WHERE t.is_active = 1`;
    const params = {};
    if (scope.department_id) { sql += ' AND t.department_id = @dept_id'; params.dept_id = scope.department_id; }
    if (scope.team_id) { sql += ' AND t.team_id = @team_id'; params.team_id = scope.team_id; }
    sql += ' ORDER BY d.department_name, t.team_name';
    const result = await query(sql, params);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch teams.' });
  }
});

router.get('/:id', authenticate, requirePermission('teams.read'), async (req, res) => {
  try {
    const teamResult = await query(
      `SELECT t.*, d.department_name FROM teams t
       JOIN departments d ON t.department_id = d.department_id WHERE t.team_id = @id`,
      { id: parseInt(req.params.id) }
    );
    if (!teamResult.recordset.length) return res.status(404).json({ error: 'Team not found.' });

    const engineers = await query(
      'SELECT * FROM engineers WHERE team_id = @id AND is_active = 1 ORDER BY full_name',
      { id: parseInt(req.params.id) }
    );
    const servers = await query(
      `SELECT s.server_id, s.server_code, s.hostname, s.status
       FROM servers s WHERE s.team_id = @id ORDER BY s.server_code`,
      { id: parseInt(req.params.id) }
    );

    res.json({ team: teamResult.recordset[0], engineers: engineers.recordset, servers: servers.recordset });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch team.' });
  }
});

router.post('/', authenticate, requirePermission('teams.create'),
  auditMiddleware('CREATE', 'team'),
  async (req, res) => {
    try {
      const { team_name, department_id, description, oncall_phone, oncall_email } = req.body;
      if (!team_name || typeof team_name !== 'string' || !team_name.trim()) {
        return res.status(400).json({ error: 'Team name is required.' });
      }
      if (!department_id) return res.status(400).json({ error: 'Department is required.' });
      const existing = await query(
        `SELECT 1 FROM teams t WHERE LOWER(TRIM(t.team_name)) = LOWER(TRIM(@team_name)) AND t.department_id = @department_id AND t.is_active = 1`,
        { team_name, department_id }
      );
      if (existing.recordset.length) {
        return res.status(409).json({ error: 'A team with this name already exists in this department.' });
      }
      const result = await query(
        `INSERT INTO teams (team_name, department_id, description, oncall_phone, oncall_email)
         OUTPUT INSERTED.team_id
         VALUES (@team_name, @department_id, @description, @oncall_phone, @oncall_email)`,
        {
          team_name: (team_name || '').trim(),
          department_id: parseInt(department_id, 10),
          description: description && String(description).trim() ? description.trim() : null,
          oncall_phone: oncall_phone && String(oncall_phone).trim() ? oncall_phone.trim() : null,
          oncall_email: oncall_email && String(oncall_email).trim() ? oncall_email.trim() : null,
        }
      );
      res.status(201).json({ id: result.recordset[0].team_id, message: 'Team created.' });
    } catch (err) {
      res.status(500).json({ error: 'Failed to create team.' });
    }
  }
);

router.put('/:id', authenticate, requirePermission('teams.update'),
  auditMiddleware('UPDATE', 'team'),
  async (req, res) => {
    try {
      const fields = req.body;
      const allowed = ['team_name', 'department_id', 'description', 'oncall_phone', 'oncall_email', 'is_active'];
      const updateFields = [];
      const params = { id: parseInt(req.params.id) };
      for (const f of allowed) {
        if (fields[f] !== undefined) { updateFields.push(`${f} = @${f}`); params[f] = fields[f]; }
      }
      if (!updateFields.length) return res.status(400).json({ error: 'No fields to update.' });
      if (fields.team_name !== undefined || fields.department_id !== undefined) {
        const curr = await query('SELECT team_name, department_id FROM teams WHERE team_id = @id', { id: parseInt(req.params.id) });
        const checkName = (fields.team_name !== undefined ? fields.team_name : curr.recordset[0]?.team_name) || '';
        const checkDept = fields.department_id !== undefined ? fields.department_id : curr.recordset[0]?.department_id;
        if (checkName && checkDept) {
          const dup = await query(
            `SELECT 1 FROM teams WHERE LOWER(TRIM(team_name)) = LOWER(TRIM(@team_name)) AND department_id = @department_id AND team_id != @id AND is_active = 1`,
            { team_name: checkName, department_id: checkDept, id: parseInt(req.params.id) }
          );
          if (dup.recordset.length) return res.status(409).json({ error: 'A team with this name already exists in this department.' });
        }
      }
      updateFields.push('updated_at = GETDATE()');
      await query(`UPDATE teams SET ${updateFields.join(', ')} WHERE team_id = @id`, params);
      res.json({ message: 'Team updated.' });
    } catch (err) {
      console.error('Update team error:', err);
      res.status(500).json({ error: 'Failed to update team.' });
    }
  }
);

module.exports = router;
