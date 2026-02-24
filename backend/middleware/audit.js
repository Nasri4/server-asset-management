const { execute, isDemoMode } = require('../config/db');

async function logAudit(userId, username, action, entityType, entityId, oldValue, newValue, ip, userAgent, isSensitive = false) {
  if (isDemoMode()) return;
  try {
    await execute('sp_InsertAuditLog', {
      user_id: userId,
      username: username,
      action: action,
      entity_type: entityType,
      entity_id: entityId,
      old_value: oldValue ? JSON.stringify(oldValue) : null,
      new_value: newValue ? JSON.stringify(newValue) : null,
      ip_address: ip,
      user_agent: userAgent,
      is_sensitive: isSensitive,
    });
  } catch (err) {
    console.error('Audit log failed:', err.message);
  }
}

function auditMiddleware(action, entityType, isSensitive = false) {
  return (req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = function (body) {
      if (res.statusCode >= 200 && res.statusCode < 300 && req.user) {
        const entityId = req.params.id || body?.id || body?.data?.id;
        logAudit(
          req.user.user_id,
          req.user.username,
          action,
          entityType,
          entityId ? parseInt(entityId) : null,
          req._auditOldValue || null,
          req.body || null,
          req.user.ip,
          req.user.userAgent,
          isSensitive
        );
      }
      return originalJson(body);
    };
    next();
  };
}

module.exports = { logAudit, auditMiddleware };
