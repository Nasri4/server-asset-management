const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { query } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { requireRole, requirePermission } = require('../middleware/rbac');
const { auditMiddleware, logAudit } = require('../middleware/audit');

const BCRYPT_ROUNDS = 12;

function classifyRole(roleName = '') {
  const name = String(roleName || '').toLowerCase();
  if (name.includes('admin')) return 'admin';
  if (name.includes('department')) return 'department';
  if (name.includes('team') || name.includes('section')) return 'team_or_section';
  if (name.includes('engineer')) return 'engineer';
  return 'other';
}

function enforceActorScope(actor, departmentId, teamId) {
  const actorRole = classifyRole(actor?.role_name || actor?.role);

  if (actorRole === 'admin') return null;

  if (actorRole === 'department') {
    if (!actor.department_id || !departmentId || parseInt(departmentId, 10) !== parseInt(actor.department_id, 10)) {
      return 'Forbidden: outside your department scope.';
    }
    return null;
  }

  if (actorRole === 'team_or_section' || actorRole === 'engineer') {
    if (!actor.department_id || !actor.team_id) {
      return 'Forbidden: your account scope is not configured.';
    }

    if (!departmentId || parseInt(departmentId, 10) !== parseInt(actor.department_id, 10)) {
      return 'Forbidden: outside your department scope.';
    }

    if (!teamId || parseInt(teamId, 10) !== parseInt(actor.team_id, 10)) {
      return 'Forbidden: outside your team scope.';
    }

    return null;
  }

  return 'Forbidden: your role cannot manage users.';
}

async function getRoleById(roleId) {
  const result = await query(
    `SELECT role_id, role_name
     FROM roles
     WHERE role_id = @role_id`,
    { role_id: roleId }
  );
  return result.recordset[0] || null;
}

async function getTeamWithDepartment(teamId) {
  if (!teamId) return null;
  const result = await query(
    `SELECT team_id, department_id
     FROM teams
     WHERE team_id = @team_id AND is_active = 1`,
    { team_id: teamId }
  );
  return result.recordset[0] || null;
}

async function getEngineerById(engineerId) {
  if (!engineerId) return null;
  const result = await query(
    `SELECT e.engineer_id, e.full_name, e.is_active, e.user_id,
            e.team_id,
            COALESCE(e.department_id, t.department_id) AS department_id
     FROM engineers e
     LEFT JOIN teams t ON t.team_id = e.team_id
     WHERE e.engineer_id = @engineer_id`,
    { engineer_id: engineerId }
  );
  return result.recordset[0] || null;
}

async function ensureEngineerIsUnlinked(engineerId, excludeUserId = null) {
  const linkedUser = await query(
    `SELECT TOP 1 user_id
     FROM users
     WHERE engineer_id = @engineer_id
       AND (@exclude_user_id IS NULL OR user_id <> @exclude_user_id)`,
    { engineer_id: engineerId, exclude_user_id: excludeUserId }
  );

  if (linkedUser.recordset.length) {
    return 'Selected engineer is already linked to another user.';
  }

  const legacyLinked = await query(
    `SELECT TOP 1 user_id
     FROM engineers
     WHERE engineer_id = @engineer_id
       AND user_id IS NOT NULL
       AND (@exclude_user_id IS NULL OR user_id <> @exclude_user_id)`,
    { engineer_id: engineerId, exclude_user_id: excludeUserId }
  );

  if (legacyLinked.recordset.length) {
    return 'Selected engineer is already linked to another user.';
  }

  return null;
}

async function validateUserAssignment({ actor, roleRow, departmentId, teamId, engineerId, sectionId, excludeUserId = null }) {
  const roleType = classifyRole(roleRow.role_name);
  let finalDepartmentId = departmentId ? parseInt(departmentId, 10) : null;
  let finalTeamId = teamId ? parseInt(teamId, 10) : null;
  const finalSectionId = sectionId ? parseInt(sectionId, 10) : null;
  const finalEngineerId = engineerId ? parseInt(engineerId, 10) : null;
  let engineerSummary = null;

  if (roleType === 'department') {
    if (!finalDepartmentId) {
      return { error: 'department_id is required for department role.', statusCode: 400 };
    }
    if (finalTeamId) {
      return { error: 'team_id must be null for department role.', statusCode: 400 };
    }
  }

  if (roleType === 'team_or_section') {
    if (!finalTeamId) {
      return { error: 'team_id is required for team/section role.', statusCode: 400 };
    }
  }

  if (roleType === 'engineer' && !finalEngineerId) {
    return { error: 'engineer_id is required for engineer role.', statusCode: 400 };
  }

  if (finalEngineerId && roleType !== 'engineer') {
    return { error: 'engineer_id can only be used with Engineer role.', statusCode: 400 };
  }

  if (finalEngineerId) {
    const engineer = await getEngineerById(finalEngineerId);
    if (!engineer || !engineer.is_active) {
      return { error: 'Selected engineer not found or inactive.', statusCode: 400 };
    }

    const linkError = await ensureEngineerIsUnlinked(finalEngineerId, excludeUserId);
    if (linkError) {
      return { error: linkError, statusCode: 409 };
    }

    if (finalDepartmentId && parseInt(finalDepartmentId, 10) !== parseInt(engineer.department_id, 10)) {
      return { error: 'department_id does not match selected engineer.', statusCode: 400 };
    }
    if (finalTeamId && parseInt(finalTeamId, 10) !== parseInt(engineer.team_id, 10)) {
      return { error: 'team_id does not match selected engineer.', statusCode: 400 };
    }

    finalDepartmentId = engineer.department_id;
    finalTeamId = engineer.team_id;
    engineerSummary = { engineer_id: engineer.engineer_id, full_name: engineer.full_name };
  }

  if (finalTeamId) {
    const team = await getTeamWithDepartment(finalTeamId);
    if (!team) {
      return { error: 'Invalid team selected.', statusCode: 400 };
    }
    if (finalDepartmentId && parseInt(finalDepartmentId, 10) !== parseInt(team.department_id, 10)) {
      return { error: 'Selected team does not belong to selected department.', statusCode: 400 };
    }
    finalDepartmentId = team.department_id;
  }

  const scopeError = enforceActorScope(actor, finalDepartmentId, finalTeamId);
  if (scopeError) {
    return { error: scopeError, statusCode: 403 };
  }

  return {
    finalDepartmentId,
    finalTeamId,
    finalSectionId,
    finalEngineerId,
    engineerSummary,
  };
}

// Users management
router.get('/users', authenticate, requirePermission('admin.users'), async (req, res) => {
  try {
    const actorRole = classifyRole(req.user.role_name || req.user.role);
    let where = ' WHERE 1=1 ';
    const params = {};

    if (actorRole === 'department') {
      where += ' AND u.department_id = @scope_department_id ';
      params.scope_department_id = req.user.department_id || null;
    } else if (actorRole === 'team_or_section' || actorRole === 'engineer') {
      where += ' AND u.department_id = @scope_department_id AND u.team_id = @scope_team_id ';
      params.scope_department_id = req.user.department_id || null;
      params.scope_team_id = req.user.team_id || null;
    } else if (actorRole !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Insufficient scope.' });
    }

    const result = await query(
      `SELECT u.user_id, u.username, u.full_name, u.email, u.phone,
        u.is_active, u.last_login, u.created_at,
        u.department_id, u.team_id, u.section_id, u.engineer_id,
        r.role_name, d.department_name, t.team_name,
        e.full_name AS engineer_name
       FROM users u
       JOIN roles r ON u.role_id = r.role_id
       LEFT JOIN departments d ON u.department_id = d.department_id
       LEFT JOIN teams t ON u.team_id = t.team_id
       LEFT JOIN engineers e ON e.engineer_id = u.engineer_id
       ${where}
       ORDER BY u.full_name`,
      params
    );
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users.' });
  }
});

router.post('/users', authenticate, requirePermission('admin.users'),
  auditMiddleware('CREATE', 'user'),
  async (req, res) => {
    try {
      const { username, password, full_name, email, phone, role_id, department_id, section_id, team_id, engineer_id } = req.body;
      if (!username || !password || !full_name || !role_id) {
        return res.status(400).json({ error: 'Username, password, full name, and role are required.' });
      }
      if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters.' });
      }

      const roleRow = await getRoleById(parseInt(role_id, 10));
      if (!roleRow) return res.status(400).json({ error: 'Invalid role selected.' });

      const validation = await validateUserAssignment({
        actor: req.user,
        roleRow,
        departmentId: department_id,
        teamId: team_id,
        sectionId: section_id,
        engineerId: engineer_id,
      });
      if (validation.error) {
        return res.status(validation.statusCode || 400).json({ error: validation.error });
      }

      const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
      const result = await query(
        `INSERT INTO users (username, password_hash, full_name, email, phone, role_id, department_id, section_id, team_id, engineer_id)
         OUTPUT INSERTED.user_id, INSERTED.username, INSERTED.full_name, INSERTED.department_id, INSERTED.team_id, INSERTED.engineer_id
         VALUES (@username, @hash, @full_name, @email, @phone, @role_id, @department_id, @section_id, @team_id, @engineer_id)`,
        {
          username,
          hash,
          full_name,
          email: email || null,
          phone: phone || null,
          role_id: parseInt(role_id, 10),
          department_id: validation.finalDepartmentId,
          section_id: validation.finalSectionId,
          team_id: validation.finalTeamId,
          engineer_id: validation.finalEngineerId,
        }
      );

      const created = result.recordset[0];
      if (validation.finalEngineerId) {
        await query(
          `UPDATE engineers
           SET user_id = @user_id, updated_at = GETDATE()
           WHERE engineer_id = @engineer_id`,
          { user_id: created.user_id, engineer_id: validation.finalEngineerId }
        );
      }

      res.status(201).json({
        id: created.user_id,
        message: 'User created.',
        user: {
          user_id: created.user_id,
          username: created.username,
          full_name: created.full_name,
          department_id: created.department_id,
          team_id: created.team_id,
          engineer: validation.engineerSummary,
        },
      });
    } catch (err) {
      if (err.message && err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Username already exists.' });
      res.status(500).json({ error: 'Failed to create user.' });
    }
  }
);

router.put('/users/:id', authenticate, requirePermission('admin.users'),
  auditMiddleware('UPDATE', 'user', true),
  async (req, res) => {
    try {
      const userId = parseInt(req.params.id, 10);
      if (isNaN(userId)) return res.status(400).json({ error: 'Invalid user ID.' });

      const currentUserResult = await query(
        `SELECT user_id, role_id, department_id, section_id, team_id, engineer_id
         FROM users
         WHERE user_id = @id`,
        { id: userId }
      );
      if (!currentUserResult.recordset.length) {
        return res.status(404).json({ error: 'User not found.' });
      }
      const currentUser = currentUserResult.recordset[0];

      const fields = req.body;
      const allowed = ['full_name', 'email', 'phone', 'role_id', 'department_id', 'section_id', 'team_id', 'engineer_id', 'is_active'];
      const updateFields = [];
      const params = { id: userId };

      const mergedRoleId = fields.role_id !== undefined ? parseInt(fields.role_id, 10) : currentUser.role_id;
      const mergedDepartmentId = fields.department_id !== undefined ? fields.department_id : currentUser.department_id;
      const mergedSectionId = fields.section_id !== undefined ? fields.section_id : currentUser.section_id;
      const mergedTeamId = fields.team_id !== undefined ? fields.team_id : currentUser.team_id;
      const mergedEngineerId = fields.engineer_id !== undefined ? fields.engineer_id : currentUser.engineer_id;

      const roleRow = await getRoleById(mergedRoleId);
      if (!roleRow) return res.status(400).json({ error: 'Invalid role selected.' });

      const validation = await validateUserAssignment({
        actor: req.user,
        roleRow,
        departmentId: mergedDepartmentId,
        teamId: mergedTeamId,
        sectionId: mergedSectionId,
        engineerId: mergedEngineerId,
        excludeUserId: userId,
      });

      if (validation.error) {
        return res.status(validation.statusCode || 400).json({ error: validation.error });
      }

      for (const f of allowed) {
        if (fields[f] !== undefined) { updateFields.push(`${f} = @${f}`); params[f] = fields[f]; }
      }

      params.role_id = mergedRoleId;
      params.department_id = validation.finalDepartmentId;
      params.section_id = validation.finalSectionId;
      params.team_id = validation.finalTeamId;
      params.engineer_id = validation.finalEngineerId;

      ['role_id', 'department_id', 'section_id', 'team_id', 'engineer_id'].forEach((col) => {
        if (!updateFields.includes(`${col} = @${col}`)) updateFields.push(`${col} = @${col}`);
      });

      if (fields.password) {
        const hash = await bcrypt.hash(fields.password, BCRYPT_ROUNDS);
        updateFields.push('password_hash = @hash');
        params.hash = hash;
      }
      if (!updateFields.length) return res.status(400).json({ error: 'No fields to update.' });
      updateFields.push('updated_at = GETDATE()');
      await query(`UPDATE users SET ${updateFields.join(', ')} WHERE user_id = @id`, params);

      if (currentUser.engineer_id && currentUser.engineer_id !== validation.finalEngineerId) {
        await query(
          `UPDATE engineers
           SET user_id = NULL, updated_at = GETDATE()
           WHERE engineer_id = @engineer_id AND user_id = @user_id`,
          { engineer_id: currentUser.engineer_id, user_id: userId }
        );
      }

      if (validation.finalEngineerId) {
        await query(
          `UPDATE engineers
           SET user_id = @user_id, updated_at = GETDATE()
           WHERE engineer_id = @engineer_id`,
          { user_id: userId, engineer_id: validation.finalEngineerId }
        );
      }

      if (fields.role_id !== undefined) {
        await logAudit(req.user.user_id, req.user.username, 'ROLE_CHANGE', 'user',
          userId, null, { role_id: fields.role_id }, req.user.ip, req.user.userAgent, true);
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
