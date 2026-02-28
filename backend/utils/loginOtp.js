const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { query } = require('../config/db');
const { sendSMS } = require('./sms');

const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = parseInt(process.env.OTP_EXPIRY_MINUTES, 10) || 5;
const OTP_MAX_ATTEMPTS = 50;
const OTP_REQUESTS_PER_HOUR = parseInt(process.env.OTP_MAX_REQUESTS_PER_HOUR, 10) || 20;
const OTP_RESEND_COOLDOWN_SECONDS = 0; // no cooldown
const TEMP_AUTH_EXPIRES_IN = process.env.OTP_TEMP_AUTH_EXPIRES_IN || '10m';
const LOGIN_OTP_PURPOSE = 'login_2fa';

function generateOtpCode(length = OTP_LENGTH) {
  const digits = '0123456789';
  let otp = '';
  for (let index = 0; index < length; index += 1) {
    otp += digits[crypto.randomInt(0, digits.length)];
  }
  return otp;
}

function normalizeIp(ip) {
  if (!ip) return null;
  if (typeof ip === 'string' && ip.startsWith('::ffff:')) {
    return ip.replace('::ffff:', '');
  }
  return ip;
}

function createTempAuthId(userId) {
  const secret = process.env.JWT_SECRET || 'demo-secret';
  return jwt.sign(
    {
      type: 'login_otp',
      userId,
    },
    secret,
    { expiresIn: TEMP_AUTH_EXPIRES_IN }
  );
}

function verifyTempAuthId(tempAuthId) {
  const secret = process.env.JWT_SECRET || 'demo-secret';
  const payload = jwt.verify(tempAuthId, secret);
  if (payload?.type !== 'login_otp' || !payload?.userId) {
    throw new Error('Invalid temp auth token');
  }
  return payload;
}

async function ensureOtpRequestAllowed(userId, ipAddress) {
  const result = await query(
    `SELECT COUNT(*) AS total
     FROM otp_log
     WHERE created_at > DATEADD(HOUR, -1, GETDATE())
       AND purpose = @purpose
       AND (user_id = @user_id OR (@phone_number IS NOT NULL AND phone_number = @phone_number))`,
    {
      user_id: userId,
      phone_number: ipAddress || null,
      purpose: LOGIN_OTP_PURPOSE,
    }
  );

  const total = result?.recordset?.[0]?.total || 0;
  if (total >= OTP_REQUESTS_PER_HOUR) {
    return {
      allowed: false,
      error: 'Too many OTP requests. Please try again later.',
      statusCode: 429,
    };
  }

  return { allowed: true };
}

async function invalidateOpenOtps(userId) {
  await query(
    `UPDATE otp_log
     SET status = 'Expired'
     WHERE user_id = @user_id AND purpose = @purpose AND status = 'Pending'`,
    { user_id: userId, purpose: LOGIN_OTP_PURPOSE }
  );
}

async function sendLoginOtp({ userId, phone, ipAddress }) {
  const normalizedIp = normalizeIp(ipAddress);

  if (!phone) {
    return { success: false, statusCode: 400, error: 'No phone number configured for this account.' };
  }

  const rateCheck = await ensureOtpRequestAllowed(userId, phone || normalizedIp);
  if (!rateCheck.allowed) return rateCheck;

  const otpCode = generateOtpCode();

  await invalidateOpenOtps(userId);

  const insertResult = await query(
    `INSERT INTO otp_log (user_id, otp_code, purpose, phone_number, status, attempts, max_attempts, expires_at)
     OUTPUT INSERTED.otp_id
     VALUES (@user_id, @otp_code, @purpose, @phone_number, 'Pending', 0, @max_attempts, DATEADD(MINUTE, @expiry_minutes, GETDATE()))`,
    {
      user_id: userId,
      otp_code: otpCode,
      purpose: LOGIN_OTP_PURPOSE,
      phone_number: phone,
      max_attempts: OTP_MAX_ATTEMPTS,
      expiry_minutes: OTP_EXPIRY_MINUTES,
    }
  );
  const otpId = insertResult.recordset[0]?.otp_id;

  // Fire-and-forget SMS — do NOT await, respond to user immediately
  const message = `TELCO ASSET MGMT: Your login OTP is ${otpCode}. Valid for ${OTP_EXPIRY_MINUTES} minutes. Do not share.`;
  sendSMS(phone, message, 'auth_otp', 'user', userId)
    .then(smsResult => {
      if (!smsResult.success && otpId) {
        query(
          `UPDATE otp_log SET status = 'Failed' WHERE otp_id = @otp_id`,
          { otp_id: otpId }
        ).catch(() => {});
      }
    })
    .catch(() => {
      if (otpId) {
        query(
          `UPDATE otp_log SET status = 'Failed' WHERE otp_id = @otp_id`,
          { otp_id: otpId }
        ).catch(() => {});
      }
    });

  const tempAuthId = createTempAuthId(userId);
  return {
    success: true,
    tempAuthId,
    message: 'OTP sent',
  };
}

async function resendLoginOtp({ userId, phone, ipAddress, force = false }) {
  if (!force) {
    const cooldownResult = await query(
      `SELECT TOP 1 created_at
       FROM otp_log
       WHERE user_id = @user_id
         AND purpose = @purpose
       ORDER BY created_at DESC`,
      { user_id: userId, purpose: LOGIN_OTP_PURPOSE }
    );

    if (cooldownResult.recordset.length) {
      const createdAt = new Date(cooldownResult.recordset[0].created_at);
      const elapsedSeconds = Math.floor((Date.now() - createdAt.getTime()) / 1000);
      if (elapsedSeconds < OTP_RESEND_COOLDOWN_SECONDS) {
        return {
          success: false,
          statusCode: 429,
          error: `Please wait ${OTP_RESEND_COOLDOWN_SECONDS - elapsedSeconds}s before requesting another OTP.`,
        };
      }
    }
  }

  return sendLoginOtp({ userId, phone, ipAddress });
}

async function verifyLoginOtp({ userId, otpCode }) {
  const otpResult = await query(
    `SELECT TOP 1 otp_id, otp_code, expires_at, status, attempts, max_attempts
     FROM otp_log
     WHERE user_id = @user_id
       AND purpose = @purpose
     ORDER BY created_at DESC`,
    { user_id: userId, purpose: LOGIN_OTP_PURPOSE }
  );

  if (!otpResult.recordset.length) {
    return { success: false, statusCode: 400, error: 'OTP session expired. Please log in again.' };
  }

  const otpRecord = otpResult.recordset[0];

  if (otpRecord.status !== 'Pending' || new Date(otpRecord.expires_at) <= new Date()) {
    return { success: false, statusCode: 400, error: 'OTP expired. Please log in again.' };
  }

  const maxAttempts = otpRecord.max_attempts || OTP_MAX_ATTEMPTS;
  if ((otpRecord.attempts || 0) >= maxAttempts) {
    await query(
      `UPDATE otp_log SET status = 'Blocked' WHERE otp_id = @otp_id`,
      { otp_id: otpRecord.otp_id }
    );
    return { success: false, statusCode: 400, error: 'Maximum OTP attempts exceeded. Please log in again.' };
  }

  const isValid = String(otpRecord.otp_code || '') === String(otpCode || '');

  if (!isValid) {
    const nextAttempts = (otpRecord.attempts || 0) + 1;
    const nextStatus = nextAttempts >= maxAttempts ? 'Blocked' : 'Pending';
    await query(
      `UPDATE otp_log
       SET attempts = @attempts, status = @status
       WHERE otp_id = @otp_id`,
      {
        attempts: nextAttempts,
        status: nextStatus,
        otp_id: otpRecord.otp_id,
      }
    );

    if (nextStatus === 'Blocked') {
      return { success: false, statusCode: 400, error: 'Maximum OTP attempts exceeded. Please log in again.', blocked: true };
    }

    const attemptsLeft = maxAttempts - nextAttempts;
    return { success: false, statusCode: 400, error: 'Invalid OTP. Please try again.', attemptsLeft };
  }

  await query(
    `UPDATE otp_log
     SET status = 'Verified', verified_at = GETDATE()
     WHERE otp_id = @otp_id`,
    { otp_id: otpRecord.otp_id }
  );

  return { success: true };
}

module.exports = {
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_COOLDOWN_SECONDS,
  OTP_REQUESTS_PER_HOUR,
  sendLoginOtp,
  resendLoginOtp,
  verifyLoginOtp,
  verifyTempAuthId,
};