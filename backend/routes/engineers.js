const express = require('express');
const router = express.Router();
const { query, execute } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { requirePermission, scopeFilter } = require('../middleware/rbac');
const { auditMiddleware } = require('../middleware/audit');

router.get('/', authenticate, requirePermission('engineers.read'), async (req, res) => {
  try {
    const scope = scopeFilter(req);
    let sql = `SELECT e.*, t.team_name, d.department_name,
      lu.user_id as linked_user_id, lu.username as linked_username,
      (SELECT COUNT(*) FROM server_assignments sa WHERE sa.engineer_id = e.engineer_id AND sa.unassigned_at IS NULL) as assigned_servers
     FROM engineers e
     LEFT JOIN teams t ON e.team_id = t.team_id
     LEFT JOIN departments d ON COALESCE(e.department_id, t.department_id) = d.department_id
     LEFT JOIN users lu ON (lu.engineer_id = e.engineer_id OR lu.user_id = e.user_id)
     WHERE 1=1`;
    const params = {};
    if (scope.team_id) {
      sql += ' AND e.team_id = @team_id'; params.team_id = scope.team_id;
    } else if (req.query.team_id) {
      sql += ' AND e.team_id = @team_id'; params.team_id = parseInt(req.query.team_id, 10);
    }
    if (scope.department_id) { sql += ' AND t.department_id = @dept_id'; params.dept_id = scope.department_id; }
    else if (req.query.department_id) {
      sql += ' AND COALESCE(e.department_id, t.department_id) = @dept_id';
      params.dept_id = parseInt(req.query.department_id, 10);
    }
    if (req.query.search && String(req.query.search).trim()) {
      sql += ' AND (e.full_name LIKE @search OR e.email LIKE @search OR e.phone LIKE @search)';
      params.search = '%' + String(req.query.search).trim() + '%';
    }
    sql += ' ORDER BY e.full_name';
    const result = await query(sql, params);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch engineers.' });
  }
});

router.get('/:id', authenticate, requirePermission('engineers.read'), async (req, res) => {
  try {
    const result = await execute('sp_GetEngineerProfile', { engineer_id: parseInt(req.params.id) });
    if (!result.recordsets[0].length) return res.status(404).json({ error: 'Engineer not found.' });
    const [engineer, servers, incidents, maintenance, visits, metrics] = result.recordsets;
    res.json({ engineer: engineer[0], assignedServers: servers, incidents, maintenance, visits, metrics: metrics[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch engineer profile.' });
  }
});

router.post('/', authenticate, requirePermission('engineers.create'),
  auditMiddleware('CREATE', 'engineer'),
  async (req, res) => {
    try {
      const { full_name, phone, email, employee_id, team_id, department_id, specialization, user_id } = req.body;
      if (!full_name || typeof full_name !== 'string' || !full_name.trim()) {
        return res.status(400).json({ error: 'Full name is required.' });
      }
      let finalDepartmentId = department_id ? parseInt(department_id, 10) : null;
      let finalTeamId = team_id ? parseInt(team_id, 10) : null;

      if (finalTeamId) {
        const teamCheck = await query(
          `SELECT team_id, department_id
           FROM teams
           WHERE team_id = @team_id AND is_active = 1`,
          { team_id: finalTeamId }
        );
        if (!teamCheck.recordset.length) {
          return res.status(400).json({ error: 'Invalid team selected.' });
        }
        const teamRow = teamCheck.recordset[0];
        if (finalDepartmentId && finalDepartmentId !== teamRow.department_id) {
          return res.status(400).json({ error: 'Selected team does not belong to selected department.' });
        }
        finalDepartmentId = teamRow.department_id;
      }
      if (employee_id && String(employee_id).trim()) {
        const existing = await query(
          `SELECT 1 FROM engineers WHERE LOWER(TRIM(employee_id)) = LOWER(TRIM(@emp_id)) AND is_active = 1`,
          { emp_id: employee_id }
        );
        if (existing.recordset.length) return res.status(409).json({ error: 'An engineer with this employee ID already exists.' });
      }
      const result = await query(
        `INSERT INTO engineers (full_name, phone, email, employee_id, department_id, team_id, specialization, user_id)
         OUTPUT INSERTED.engineer_id
         VALUES (@full_name, @phone, @email, @employee_id, @department_id, @team_id, @specialization, @user_id)`,
        { full_name, phone, email, employee_id, department_id: finalDepartmentId, team_id: finalTeamId, specialization, user_id }
      );
      res.status(201).json({ id: result.recordset[0].engineer_id, message: 'Engineer created.' });
    } catch (err) {
      res.status(500).json({ error: 'Failed to create engineer.' });
    }
  }
);

router.put('/:id', authenticate, requirePermission('engineers.update'),
  auditMiddleware('UPDATE', 'engineer'),
  async (req, res) => {
    try {
      const fields = req.body;
      const allowed = ['full_name', 'phone', 'email', 'employee_id', 'department_id', 'team_id', 'specialization', 'is_active', 'user_id'];
      const updateFields = [];
      const params = { id: parseInt(req.params.id) };
      for (const f of allowed) {
        if (fields[f] !== undefined) { updateFields.push(`${f} = @${f}`); params[f] = fields[f]; }
      }
      if (fields.team_id !== undefined) {
        const nextTeamId = fields.team_id ? parseInt(fields.team_id, 10) : null;
        params.team_id = nextTeamId;
        if (nextTeamId) {
          const teamCheck = await query(
            `SELECT team_id, department_id FROM teams WHERE team_id = @team_id AND is_active = 1`,
            { team_id: nextTeamId }
          );
          if (!teamCheck.recordset.length) return res.status(400).json({ error: 'Invalid team selected.' });
          const teamRow = teamCheck.recordset[0];
          if (fields.department_id && parseInt(fields.department_id, 10) !== teamRow.department_id) {
            return res.status(400).json({ error: 'Selected team does not belong to selected department.' });
          }
          params.department_id = teamRow.department_id;
          if (!updateFields.includes('department_id = @department_id')) updateFields.push('department_id = @department_id');
        }
      }
      if (!updateFields.length) return res.status(400).json({ error: 'No fields to update.' });
      if (fields.employee_id !== undefined && fields.employee_id && String(fields.employee_id).trim()) {
        const dup = await query(
          `SELECT 1 FROM engineers WHERE LOWER(TRIM(employee_id)) = LOWER(TRIM(@emp_id)) AND engineer_id != @id AND is_active = 1`,
          { emp_id: fields.employee_id, id: parseInt(req.params.id) }
        );
        if (dup.recordset.length) return res.status(409).json({ error: 'An engineer with this employee ID already exists.' });
      }
      updateFields.push('updated_at = GETDATE()');
      await query(`UPDATE engineers SET ${updateFields.join(', ')} WHERE engineer_id = @id`, params);
      res.json({ message: 'Engineer updated.' });
    } catch (err) {
      console.error('Update engineer error:', err);
      res.status(500).json({ error: 'Failed to update engineer.' });
    }
  }
);

module.exports = router;
