const { query } = require('../config/db');

function inferRoleGroup(roleName = '') {
  const normalized = String(roleName || '').toLowerCase();
  if (normalized.includes('admin')) return 'admin';
  if (normalized.includes('department')) return 'department';
  if (normalized.includes('team') || normalized.includes('section')) return 'team_or_section';
  if (normalized.includes('engineer')) return 'engineer';
  if (normalized.includes('viewer')) return 'department';
  return 'restricted_other';
}

function buildScope(moduleName) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required.' });
      }

      const roleId = req.user.role_id;
      if (!roleId) {
        return res.status(403).json({ error: 'Access denied. Role information missing.' });
      }

      const permission = await query(
        `SELECT TOP 1 can_read
         FROM roles_permissions
         WHERE role_id = @role_id AND module = @module`,
        {
          role_id: roleId,
          module: moduleName,
        }
      );

      if (!permission.recordset.length || !permission.recordset[0].can_read) {
        return res.status(403).json({ error: 'Access denied for this module.' });
      }

      const roleGroup = inferRoleGroup(req.user.role_name || req.user.role);
      const conditions = [];
      const params = {};

      if (roleGroup === 'admin') {
        req.scope = { conditions: [], params: {} };
        return next();
      }

      if (roleGroup === 'department') {
        if (!req.user.department_id) {
          return res.status(403).json({ error: 'Access scope is not configured for this account.' });
        }

        conditions.push('s.department_id = @scope_department_id');
        params.scope_department_id = req.user.department_id;
      }

      if (roleGroup === 'team_or_section') {
        const hasTeam = !!req.user.team_id;
        const hasSection = !!req.user.section_id;

        if (!hasTeam && !hasSection) {
          return res.status(403).json({ error: 'Access scope is not configured for this account.' });
        }

        if (hasTeam && hasSection) {
          conditions.push('(s.team_id = @scope_team_id OR s.section_id = @scope_section_id)');
          params.scope_team_id = req.user.team_id;
          params.scope_section_id = req.user.section_id;
        } else if (hasTeam) {
          conditions.push('s.team_id = @scope_team_id');
          params.scope_team_id = req.user.team_id;
        } else {
          conditions.push('s.section_id = @scope_section_id');
          params.scope_section_id = req.user.section_id;
        }
      }

      if (roleGroup === 'engineer') {
        const hasTeam = !!req.user.team_id;
        const hasSection = !!req.user.section_id;
        const hasEngineerId = !!req.user.engineer_id;

        if (!hasTeam && !hasSection && !hasEngineerId) {
          return res.status(403).json({ error: 'Access scope is not configured for this account.' });
        }

        if (hasTeam) {
          conditions.push('s.team_id = @scope_team_id');
          params.scope_team_id = req.user.team_id;
        }

        if (req.user.section_id) {
          conditions.push('s.section_id = @scope_section_id');
          params.scope_section_id = req.user.section_id;
        }

        if (req.user.engineer_id) {
          conditions.push('EXISTS (SELECT 1 FROM server_assignments sa WHERE sa.server_id = s.server_id AND sa.engineer_id = @scope_engineer_id AND sa.unassigned_at IS NULL)');
          params.scope_engineer_id = req.user.engineer_id;
        }
      }

      if (roleGroup === 'restricted_other') {
        return res.status(403).json({ error: 'Access denied for this role.' });
      }

      req.scope = {
        conditions,
        params,
      };

      return next();
    } catch (err) {
      return res.status(500).json({ error: 'Failed to evaluate access scope.' });
    }
  };
}

module.exports = { buildScope };
