const { query, isConnectionError } = require('../config/db');

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    const role = req.user.role_name || req.user.role || '';
    if (!role || !allowedRoles.includes(role)) {
      return res.status(403).json({ error: 'Access denied. Insufficient role.' });
    }
    next();
  };
}

function requirePermission(permissionName) {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    if (!req.user.role_id) {
      return res.status(403).json({ error: 'Access denied. Role information missing.' });
    }
    try {
      const result = await query(
        `SELECT 1 FROM role_permissions rp
         JOIN permissions p ON rp.permission_id = p.permission_id
         WHERE rp.role_id = @role_id AND p.permission_name = @permission`,
        { role_id: req.user.role_id, permission: permissionName }
      );
      if (!result.recordset.length) {
        return res.status(403).json({ error: 'Access denied. Missing permission: ' + permissionName });
      }
      next();
    } catch (err) {
      if (isConnectionError(err)) {
        return res.status(503).json({ error: 'Service temporarily unavailable.' });
      }
      return res.status(500).json({ error: 'Permission check failed.' });
    }
  };
}

function scopeFilter(req) {
  const user = req.user;
  const filter = {};
  const role = user?.role_name || user?.role;

  switch (role) {
    case 'Admin':
      break;
    case 'Department Head':
      filter.department_id = user.department_id;
      break;
    case 'Team Leader':
      filter.team_id = user.team_id;
      break;
    case 'Engineer':
      filter.engineer_id = user.engineer_id;
      filter.team_id = user.team_id;
      break;
    case 'Viewer':
      filter.department_id = user.department_id;
      break;
  }

  return filter;
}

module.exports = { requireRole, requirePermission, scopeFilter };
