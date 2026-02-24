const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { query } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { auditMiddleware, logAudit } = require('../middleware/audit');

// Users management
router.get('/users', authenticate, requireRole('Admin'), async (req, res) => {
  try {
    const result = await query(
      `SELECT u.user_id, u.username, u.full_name, u.email, u.phone,
        u.is_active, u.last_login, u.created_at,
        r.role_name, d.department_name, t.team_name
       FROM users u
       JOIN roles r ON u.role_id = r.role_id
       LEFT JOIN departments d ON u.department_id = d.department_id
       LEFT JOIN teams t ON u.team_id = t.team_id
       ORDER BY u.full_name`
    );
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users.' });
  }
});

router.post('/users', authenticate, requireRole('Admin'),
  auditMiddleware('CREATE', 'user'),
  async (req, res) => {
    try {
      const { username, password, full_name, email, phone, role_id, department_id, team_id } = req.body;
      if (!username || !password || !full_name || !role_id) {
        return res.status(400).json({ error: 'Username, password, full name, and role are required.' });
      }
      if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters.' });
      }

      const hash = await bcrypt.hash(password, 12);
      const result = await query(
        `INSERT INTO users (username, password_hash, full_name, email, phone, role_id, department_id, team_id)
         OUTPUT INSERTED.user_id
         VALUES (@username, @hash, @full_name, @email, @phone, @role_id, @dept_id, @team_id)`,
        { username, hash, full_name, email: email || null, phone: phone || null, role_id, dept_id: department_id || null, team_id: team_id || null }
      );

      res.status(201).json({ id: result.recordset[0].user_id, message: 'User created.' });
    } catch (err) {
      if (err.message && err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Username already exists.' });
      res.status(500).json({ error: 'Failed to create user.' });
    }
  }
);

router.put('/users/:id', authenticate, requireRole('Admin'),
  auditMiddleware('UPDATE', 'user', true),
  async (req, res) => {
    try {
      const fields = req.body;
      const allowed = ['full_name', 'email', 'phone', 'role_id', 'department_id', 'team_id', 'is_active'];
      const updateFields = [];
      const params = { id: parseInt(req.params.id) };
      for (const f of allowed) {
        if (fields[f] !== undefined) { updateFields.push(`${f} = @${f}`); params[f] = fields[f]; }
      }
      if (fields.password) {
        const hash = await bcrypt.hash(fields.password, 12);
        updateFields.push('password_hash = @hash');
        params.hash = hash;
      }
      if (!updateFields.length) return res.status(400).json({ error: 'No fields to update.' });
      updateFields.push('updated_at = GETDATE()');
      await query(`UPDATE users SET ${updateFields.join(', ')} WHERE user_id = @id`, params);

      if (fields.role_id !== undefined) {
        await logAudit(req.user.user_id, req.user.username, 'ROLE_CHANGE', 'user',
          parseInt(req.params.id), null, { role_id: fields.role_id }, req.user.ip, req.user.userAgent, true);
      }

      res.json({ message: 'User updated.' });
    } catch (err) {
      res.status(500).json({ error: 'Failed to update user.' });
    }
  }
);

// Roles
router.get('/roles', authenticate, requireRole('Admin'), async (req, res) => {
  try {
    const result = await query('SELECT * FROM roles ORDER BY level DESC');
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch roles.' });
  }
});

// Permissions
router.get('/permissions', authenticate, requireRole('Admin'), async (req, res) => {
  try {
    const result = await query('SELECT * FROM permissions ORDER BY module, action');
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch permissions.' });
  }
});

router.get('/roles/:id/permissions', authenticate, requireRole('Admin'), async (req, res) => {
  try {
    const result = await query(
      `SELECT p.* FROM role_permissions rp
       JOIN permissions p ON rp.permission_id = p.permission_id
       WHERE rp.role_id = @id ORDER BY p.module, p.action`,
      { id: parseInt(req.params.id) }
    );
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch role permissions.' });
  }
});

// PUT /api/admin/roles/:id/permissions - Update role permissions (checkbox assignment)
router.put('/roles/:id/permissions', authenticate, requireRole('Admin'),
  auditMiddleware('UPDATE', 'role', true),
  async (req, res) => {
    try {
      const roleId = parseInt(req.params.id);
      const { permission_ids } = req.body;
      if (!Array.isArray(permission_ids)) {
        return res.status(400).json({ error: 'permission_ids array is required.' });
      }

      await query('DELETE FROM role_permissions WHERE role_id = @role_id', { role_id: roleId });
      for (const pid of permission_ids) {
        if (pid != null) await query(
          'INSERT INTO role_permissions (role_id, permission_id) VALUES (@role_id, @permission_id)',
          { role_id: roleId, permission_id: parseInt(pid) }
        );
      }
      await logAudit(req.user.user_id, req.user.username, 'PERMISSIONS_UPDATE', 'role', roleId, null, { permission_ids }, req.user.ip, req.user.userAgent, true);
      res.json({ message: 'Role permissions updated.' });
    } catch (err) {
      res.status(500).json({ error: 'Failed to update role permissions.' });
    }
  }
);

// Settings
router.get('/settings', authenticate, requireRole('Admin'), async (req, res) => {
  try {
    const result = await query('SELECT * FROM system_settings ORDER BY category, setting_key');
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch settings.' });
  }
});

router.put('/settings/:key', authenticate, requireRole('Admin'),
  auditMiddleware('UPDATE', 'setting', true),
  async (req, res) => {
    try {
      const { value } = req.body;
      await query(
        `UPDATE system_settings SET setting_value = @value, updated_by = @user_id, updated_at = GETDATE()
         WHERE setting_key = @key`,
        { value, user_id: req.user.user_id, key: req.params.key }
      );
      res.json({ message: 'Setting updated.' });
    } catch (err) {
      res.status(500).json({ error: 'Failed to update setting.' });
    }
  }
);

module.exports = router;
