const express = require('express');
const router = express.Router();
const { query } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');

router.get('/', authenticate, requirePermission('audit.read'), async (req, res) => {
  try {
    const { user_id, entity_type, action, is_sensitive, start_date, end_date, page = 1, page_size = 50 } = req.query;
    const p = Math.max(1, parseInt(page, 10) || 1);
    const ps = Math.min(100, Math.max(1, parseInt(page_size, 10) || 50));
    const offset = (p - 1) * ps;

    let baseSql = 'SELECT * FROM audit_log WHERE 1=1';
    const params = {};

    if (user_id) { baseSql += ' AND user_id = @user_id'; params.user_id = parseInt(user_id, 10); }
    if (entity_type) { baseSql += ' AND entity_type = @entity_type'; params.entity_type = entity_type; }
    if (action) { baseSql += ' AND action = @action'; params.action = action; }
    if (is_sensitive === 'true') { baseSql += ' AND is_sensitive = 1'; }
    if (start_date) { baseSql += ' AND performed_at >= @start_date'; params.start_date = start_date; }
    if (end_date) { baseSql += ' AND performed_at <= @end_date'; params.end_date = end_date; }

    const countSql = baseSql.replace(/SELECT \*/, 'SELECT COUNT(*) as total');
    const countResult = await query(countSql, params);
    const total = countResult.recordset[0]?.total ?? 0;

    const listSql = baseSql + ' ORDER BY performed_at DESC OFFSET @offset ROWS FETCH NEXT @page_size ROWS ONLY';
    params.offset = offset;
    params.page_size = ps;
    const result = await query(listSql, params);

    res.json({
      logs: result.recordset,
      total: Number(total),
      page: p,
      page_size: ps,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch audit logs.' });
  }
});

module.exports = router;
