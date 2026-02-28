const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { query } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { logAudit } = require('../middleware/audit');
const {
  sendLoginOtp,
  resendLoginOtp,
  verifyLoginOtp,
  verifyTempAuthId,
} = require('../utils/loginOtp');

const BCRYPT_ROUNDS = 12;

function getClientIp(req) {
  return req.ip || req.connection?.remoteAddress || null;
}

function buildToken(user) {
  return jwt.sign(
    { userId: user.user_id, username: user.username, role: user.role_name },
    process.env.JWT_SECRET || 'demo-secret',
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );
}

function buildUserPayload(user) {
  return {
    user_id: user.user_id,
    username: user.username,
    full_name: user.full_name,
    email: user.email,
    phone: user.phone,
    role: user.role_name,
    role_name: user.role_name,
    role_level: user.role_level,
    department_id: user.department_id,
    team_id: user.team_id,
    engineer_id: user.engineer_id ?? null,
  };
}

async function getUserForLogin(username) {
  const result = await query(
    `SELECT u.user_id, u.username, u.full_name, u.email, u.phone, u.department_id, u.team_id,
            u.password_hash, u.is_active, u.failed_attempts, u.locked_until,
            r.role_name, r.level as role_level, COALESCE(u.engineer_id, e.engineer_id) AS engineer_id
     FROM users u
     JOIN roles r ON u.role_id = r.role_id
     LEFT JOIN engineers e ON e.user_id = u.user_id
     WHERE u.username = @username`,
    { username }
  );

  return result.recordset[0] || null;
}

// POST /api/auth/bootstrap - Create first user when no users exist (e.g. from Postman). No auth.
router.post('/bootstrap', async (req, res) => {
  try {
    const countResult = await query('SELECT COUNT(*) AS n FROM users');
    const n = countResult.recordset[0].n;
    if (n > 0) {
      return res.status(403).json({ error: 'Bootstrap only allowed when no users exist. Use POST /api/admin/users with an existing admin token to add more users.' });
    }

    const rolesResult = await query('SELECT TOP 1 role_id FROM roles ORDER BY level DESC');
    if (!rolesResult.recordset.length) {
      return res.status(400).json({ error: 'Database has no roles. Run database/schema.sql and database/seed-data.sql (at least roles/permissions) first.' });
    }
    const defaultRoleId = rolesResult.recordset[0].role_id;

    const { username, password, full_name, email, phone, role_id } = req.body;
    if (!username || !password || !full_name) {
      return res.status(400).json({ error: 'Username, password, and full_name are required.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }

    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const finalRoleId = role_id != null ? role_id : defaultRoleId;
    const result = await query(
      `INSERT INTO users (username, password_hash, full_name, email, phone, role_id)
       OUTPUT INSERTED.user_id
       VALUES (@username, @hash, @full_name, @email, @phone, @role_id)`,
      { username, hash, full_name, email: email || null, phone: phone || null, role_id: finalRoleId }
    );

    const userId = result.recordset[0].user_id;
    res.status(201).json({
      message: 'First user created. You can now login with this username and password.',
      user_id: userId,
      username,
    });
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Username already exists.' });
    }
    console.error('Bootstrap error:', err);
    res.status(500).json({ error: 'Bootstrap failed.' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const user = await getUserForLogin(username);
    const genericError = 'Invalid username or password.';

    if (!user) {
      await logAudit(0, username, 'LOGIN_FAILURE', 'auth', null, null, null, getClientIp(req), req.headers['user-agent'], true);
      return res.status(401).json({ error: genericError });
    }

    if (!user.is_active) {
      await logAudit(user.user_id, user.username, 'LOGIN_FAILURE', 'auth', user.user_id, null, null, getClientIp(req), req.headers['user-agent'], true);
      return res.status(401).json({ error: genericError });
    }

    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      await logAudit(user.user_id, user.username, 'ACCOUNT_LOCKED', 'auth', user.user_id, null, null, getClientIp(req), req.headers['user-agent'], true);
      return res.status(423).json({ error: 'Account is temporarily locked. Try again later.' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      const newAttempts = (user.failed_attempts || 0) + 1;
      const lockUntil = newAttempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;
      await query(
        `UPDATE users
         SET failed_attempts = @attempts, locked_until = @locked
         WHERE user_id = @user_id`,
        { attempts: newAttempts, locked: lockUntil, user_id: user.user_id }
      );

      const action = lockUntil ? 'ACCOUNT_LOCKED' : 'LOGIN_FAILURE';
      await logAudit(user.user_id, user.username, action, 'auth', user.user_id, null, null, getClientIp(req), req.headers['user-agent'], true);
      return res.status(401).json({ error: genericError });
    }

    await query(
      `UPDATE users
       SET failed_attempts = 0, locked_until = NULL
       WHERE user_id = @user_id`,
      { user_id: user.user_id }
    );

    const otpResult = await sendLoginOtp({
      userId: user.user_id,
      phone: user.phone,
      ipAddress: getClientIp(req),
    });

    if (!otpResult.success) {
      await logAudit(user.user_id, user.username, 'OTP_REQUEST_FAILED', 'auth', user.user_id, null, null, getClientIp(req), req.headers['user-agent'], true);
      return res.status(otpResult.statusCode || 400).json({ error: otpResult.error || 'Failed to send OTP.' });
    }

    await logAudit(user.user_id, user.username, 'OTP_REQUESTED', 'auth', user.user_id, null, null, getClientIp(req), req.headers['user-agent'], true);

    return res.json({
      requiresOtp: true,
      tempAuthId: otpResult.tempAuthId,
      message: otpResult.message || 'OTP sent',
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed.' });
  }
});

// POST /api/auth/verify-otp
router.post('/verify-otp', async (req, res) => {
  try {
    const { otp, tempAuthId } = req.body;
    if (!otp || !tempAuthId) {
      return res.status(400).json({ error: 'OTP and tempAuthId are required.' });
    }

    let tempPayload;
    try {
      tempPayload = verifyTempAuthId(tempAuthId);
    } catch {
      return res.status(401).json({ error: 'OTP session is invalid or expired. Please log in again.' });
    }

    const userId = Number(tempPayload.userId);
    const otpResult = await verifyLoginOtp({ userId, otpCode: String(otp).trim() });
    if (!otpResult.success) {
      await logAudit(userId, 'unknown', 'OTP_VERIFY_FAILED', 'auth', userId, null, null, getClientIp(req), req.headers['user-agent'], true);
      return res.status(otpResult.statusCode || 400).json({
        error: otpResult.error || 'OTP verification failed.',
        attemptsLeft: otpResult.attemptsLeft,
        blocked: otpResult.blocked || false,
      });
    }

    await query(
      `UPDATE users
       SET failed_attempts = 0, locked_until = NULL, last_login = GETDATE()
       WHERE user_id = @user_id`,
      { user_id: userId }
    );

    const user = await query(
      `SELECT u.user_id, u.username, u.full_name, u.email, u.phone, u.department_id, u.team_id,
              r.role_name, r.level as role_level, COALESCE(u.engineer_id, e.engineer_id) AS engineer_id
       FROM users u
       JOIN roles r ON u.role_id = r.role_id
       LEFT JOIN engineers e ON e.user_id = u.user_id
       WHERE u.user_id = @user_id AND u.is_active = 1`,
      { user_id: userId }
    );

    if (!user.recordset.length) {
      return res.status(401).json({ error: 'User not found or inactive.' });
    }

    const userRow = user.recordset[0];
    const token = buildToken(userRow);

    await logAudit(userId, userRow.username, 'OTP_VERIFIED', 'auth', userId, null, null, getClientIp(req), req.headers['user-agent'], true);
    await logAudit(userId, userRow.username, 'LOGIN_SUCCESS', 'auth', userId, null, null, getClientIp(req), req.headers['user-agent'], false);

    return res.json({ success: true, token, user: buildUserPayload(userRow) });
  } catch (err) {
    console.error('Verify OTP error:', err);
    return res.status(500).json({ error: 'OTP verification failed.' });
  }
});

// POST /api/auth/resend-otp
router.post('/resend-otp', async (req, res) => {
  try {
    const { tempAuthId } = req.body;
    if (!tempAuthId) {
      return res.status(400).json({ error: 'tempAuthId is required.' });
    }

    let tempPayload;
    try {
      tempPayload = verifyTempAuthId(tempAuthId);
    } catch {
      return res.status(401).json({ error: 'OTP session is invalid or expired. Please log in again.' });
    }

    const userId = Number(tempPayload.userId);
    const userResult = await query(
      `SELECT user_id, username, phone, is_active
       FROM users
       WHERE user_id = @user_id`,
      { user_id: userId }
    );

    if (!userResult.recordset.length || !userResult.recordset[0].is_active) {
      return res.status(401).json({ error: 'User not found or inactive.' });
    }

    const user = userResult.recordset[0];
    const force = req.body.force === true;
    const resendResult = await resendLoginOtp({
      userId: user.user_id,
      phone: user.phone,
      ipAddress: getClientIp(req),
      force,
    });

    if (!resendResult.success) {
      await logAudit(user.user_id, user.username, 'OTP_REQUEST_FAILED', 'auth', user.user_id, null, null, getClientIp(req), req.headers['user-agent'], true);
      return res.status(resendResult.statusCode || 400).json({ error: resendResult.error || 'Failed to resend OTP.' });
    }

    await logAudit(user.user_id, user.username, 'OTP_REQUESTED', 'auth', user.user_id, null, null, getClientIp(req), req.headers['user-agent'], true);

    return res.json({
      requiresOtp: true,
      tempAuthId: resendResult.tempAuthId,
      message: resendResult.message || 'OTP resent',
    });
  } catch (err) {
    console.error('Resend OTP error:', err);
    return res.status(500).json({ error: 'Failed to resend OTP.' });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  try {
    const perms = await query(
      `SELECT p.permission_name FROM role_permissions rp
       JOIN permissions p ON rp.permission_id = p.permission_id
       WHERE rp.role_id = @role_id`,
      { role_id: req.user.role_id }
    );
    res.json({
      user: req.user,
      permissions: perms.recordset.map(p => p.permission_name),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user info.' });
  }
});

// POST /api/auth/change-password
router.post('/change-password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new passwords are required.' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters.' });
    }

    const result = await query(
      'SELECT password_hash FROM users WHERE user_id = @user_id',
      { user_id: req.user.user_id }
    );

    const valid = await bcrypt.compare(currentPassword, result.recordset[0].password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }

    const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await query(
      'UPDATE users SET password_hash = @hash, updated_at = GETDATE() WHERE user_id = @user_id',
      { hash, user_id: req.user.user_id }
    );

    await logAudit(req.user.user_id, req.user.username, 'PASSWORD_CHANGE', 'user',
      req.user.user_id, null, null, req.user.ip, req.user.userAgent, true);

    res.json({ message: 'Password changed successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to change password.' });
  }
});

module.exports = router;
