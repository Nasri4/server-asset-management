const express = require('express');
const router = express.Router();
const { query } = require('../config/db');
const { authenticate } = require('../middleware/auth');

// GET /api/notifications - Recent activity for current user (from audit_log)
router.get('/', authenticate, async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    const userId = req.user.user_id;
    const isAdmin = req.user.role_name === 'Admin';

    const topN = Math.min(parseInt(limit) || 20, 50);
    let sql = `SELECT TOP (${topN}) log_id, user_id, username, action, entity_type, entity_id, performed_at, is_sensitive
       FROM audit_log WHERE is_sensitive = 0`;
    const params = {};
    if (!isAdmin) {
      sql += ' AND user_id = @user_id';
      params.user_id = userId;
    }
    sql += ' ORDER BY performed_at DESC';

    const result = await query(sql, params);
    const notifications = (result.recordset || []).map(r => ({
      id: r.log_id,
      action: r.action,
      entity_type: r.entity_type,
      entity_id: r.entity_id,
      performed_at: r.performed_at,
      message: `${r.action} ${r.entity_type}${r.entity_id ? ` #${r.entity_id}` : ''}`,
      username: r.username,
    }));

    res.json({ notifications, unread: 0 });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch notifications.' });
  }
});

module.exports = router;
