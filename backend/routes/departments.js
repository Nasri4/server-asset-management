const express = require('express');
const router = express.Router();
const { query } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const { auditMiddleware } = require('../middleware/audit');

router.get('/', authenticate, requirePermission('departments.read'), async (req, res) => {
  try {
    const result = await query(
      `SELECT d.*,
        (SELECT COUNT(*) FROM teams WHERE department_id = d.department_id AND is_active = 1) as team_count,
        (SELECT COUNT(*) FROM servers WHERE department_id = d.department_id) as server_count
       FROM departments d WHERE d.is_active = 1 ORDER BY d.department_name`
    );
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch departments.' });
  }
});

router.get('/:id', authenticate, requirePermission('departments.read'), async (req, res) => {
  try {
    const result = await query('SELECT * FROM departments WHERE department_id = @id', { id: parseInt(req.params.id) });
    if (!result.recordset.length) return res.status(404).json({ error: 'Department not found.' });
    const teams = await query(
      `SELECT t.*, (SELECT COUNT(*) FROM engineers WHERE team_id = t.team_id AND is_active = 1) as engineer_count
       FROM teams t WHERE t.department_id = @id AND t.is_active = 1`, { id: parseInt(req.params.id) });
    res.json({ department: result.recordset[0], teams: teams.recordset });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch department.' });
  }
});

router.post('/', authenticate, requirePermission('departments.create'),
  auditMiddleware('CREATE', 'department'),
  async (req, res) => {
    try {
      const { department_name, description, head_name, head_email, head_phone } = req.body;
      if (!department_name || typeof department_name !== 'string' || !department_name.trim()) {
        return res.status(400).json({ error: 'Department name is required.' });
      }
      const existing = await query(
        `SELECT 1 FROM departments WHERE LOWER(TRIM(department_name)) = LOWER(TRIM(@name)) AND is_active = 1`,
        { name: department_name }
      );
      if (existing.recordset.length) {
        return res.status(409).json({ error: 'A department with this name already exists.' });
      }
      const result = await query(
        `INSERT INTO departments (department_name, description, head_name, head_email, head_phone)
         OUTPUT INSERTED.department_id VALUES (@name, @desc, @head, @email, @phone)`,
        {
          name: (department_name || '').trim(),
          desc: description && String(description).trim() ? description.trim() : null,
          head: head_name && String(head_name).trim() ? head_name.trim() : null,
          email: head_email && String(head_email).trim() ? head_email.trim() : null,
          phone: head_phone && String(head_phone).trim() ? head_phone.trim() : null,
        }
      );
      res.status(201).json({ id: result.recordset[0].department_id, message: 'Department created.' });
    } catch (err) {
      res.status(500).json({ error: 'Failed to create department.' });
    }
  }
);

router.put('/:id', authenticate, requirePermission('departments.update'),
  auditMiddleware('UPDATE', 'department'),
  async (req, res) => {
    try {
      const fields = req.body;
      const allowed = ['department_name', 'description', 'head_name', 'head_email', 'head_phone', 'is_active'];
      const updateFields = [];
      const params = { id: parseInt(req.params.id) };
      for (const f of allowed) {
        if (fields[f] !== undefined) { updateFields.push(`${f} = @${f}`); params[f] = fields[f]; }
      }
      if (!updateFields.length) return res.status(400).json({ error: 'No fields to update.' });
      if (fields.department_name) {
        const dup = await query(
          `SELECT 1 FROM departments WHERE LOWER(TRIM(department_name)) = LOWER(TRIM(@name)) AND department_id != @id AND is_active = 1`,
          { name: fields.department_name, id: parseInt(req.params.id) }
        );
        if (dup.recordset.length) return res.status(409).json({ error: 'A department with this name already exists.' });
      }
      updateFields.push('updated_at = GETDATE()');
      await query(`UPDATE departments SET ${updateFields.join(', ')} WHERE department_id = @id`, params);
      res.json({ message: 'Department updated.' });
    } catch (err) {
      console.error('Update department error:', err);
      res.status(500).json({ error: 'Failed to update department.' });
    }
  }
);

module.exports = router;
