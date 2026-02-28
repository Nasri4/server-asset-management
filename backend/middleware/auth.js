const jwt = require('jsonwebtoken');
const { query, isConnectionError } = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';

async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    if (decoded.demo) {
      return res.status(401).json({ error: 'Invalid token. Please log in again.' });
    }

    const result = await query(
      `SELECT u.user_id, u.username, u.full_name, u.email, u.phone,
              u.department_id, u.section_id, u.team_id, u.engineer_id as linked_engineer_id, u.is_active,
              r.role_name, r.role_id, r.level as role_level,
              COALESCE(u.engineer_id, e.engineer_id) AS engineer_id
       FROM users u
       JOIN roles r ON u.role_id = r.role_id
       LEFT JOIN engineers e ON e.user_id = u.user_id
       WHERE u.user_id = @user_id AND u.is_active = 1`,
      { user_id: decoded.userId }
    );

    if (!result.recordset.length) {
      return res.status(401).json({ error: 'User not found or inactive.' });
    }

    req.user = result.recordset[0];
    req.user.ip = req.ip || req.connection?.remoteAddress;
    req.user.userAgent = req.headers['user-agent'];
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired. Please login again.' });
    }
    if (isConnectionError(err)) {
      return res.status(503).json({ error: 'Database unavailable. Try again later.' });
    }
    return res.status(401).json({ error: 'Invalid token.' });
  }
}

module.exports = { authenticate };
