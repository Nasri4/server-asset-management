const crypto = require('crypto');
const { query } = require('../config/db');
const { sendSMS } = require('./sms');
const { sendOTPEmail } = require('./email');

function generateOTP(length = 6) {
  const digits = '0123456789';
  let otp = '';
  for (let i = 0; i < length; i++) {
    otp += digits[crypto.randomInt(0, digits.length)];
  }
  return otp;
}

function looksLikeEmail(v) {
  return v && typeof v === 'string' && v.includes('@');
}

/**
 * Create and send OTP via SMS and/or email.
 * @param {number} userId - User ID
 * @param {{ phone?: string, email?: string }} delivery - Phone and/or email
 * @param {string} purpose - OTP purpose
 * @returns {Promise<{ success: boolean, message?: string, error?: string, devOtp?: string }>}
 */
async function createAndSendOTP(userId, delivery, purpose) {
  const phoneNumber = typeof delivery === 'object' && delivery !== null ? delivery.phone : null;
  const emailAddress = typeof delivery === 'object' && delivery !== null ? delivery.email : null;
  const deliveryTarget = phoneNumber || emailAddress;
  if (!deliveryTarget) {
    return { success: false, error: 'Add phone or email to your profile for OTP delivery.' };
  }

  const otpLength = parseInt(process.env.OTP_LENGTH) || 6;
  const expiryMinutes = parseInt(process.env.OTP_EXPIRY_MINUTES) || 5;
  const maxAttempts = parseInt(process.env.OTP_MAX_ATTEMPTS) || 3;

  // Dev bypass: return OTP in response when SMS/Email not configured (for testing only)
  const devBypass = process.env.OTP_DEV_BYPASS === '1' || process.env.OTP_DEV_BYPASS === 'true';

  let activeOtp;
  try {
    activeOtp = await query(
      `SELECT COUNT(*) as count FROM otp_log
       WHERE user_id = @user_id AND purpose = @purpose
         AND status = 'Pending' AND expires_at > GETDATE()
         AND created_at > DATEADD(MINUTE, -2, GETDATE())`,
      { user_id: userId, purpose }
    );

    if (activeOtp.recordset[0].count > 0) {
      return { success: false, error: 'An active OTP already exists. Wait 2 minutes before requesting a new one.' };
    }

    const otp = generateOTP(otpLength);

    await query(
      `UPDATE otp_log SET status = 'Expired'
       WHERE user_id = @user_id AND purpose = @purpose AND status = 'Pending'`,
      { user_id: userId, purpose }
    );

    await query(
      `INSERT INTO otp_log (user_id, otp_code, purpose, phone_number, max_attempts, expires_at)
       VALUES (@user_id, @otp, @purpose, @delivery, @max_attempts, DATEADD(MINUTE, @expiry, GETDATE()))`,
      {
        user_id: userId,
        otp,
        purpose,
        delivery: deliveryTarget,
        max_attempts: maxAttempts,
        expiry: expiryMinutes,
      }
    );

    // Dev bypass: skip send, return OTP for testing
    if (devBypass) {
      console.warn(`[OTP DEV] Purpose: ${purpose}, OTP: ${otp} (valid ${expiryMinutes} min)`);
      return { success: true, message: 'OTP generated (dev mode). Check server console.', devOtp: otp };
    }

    // Try SMS first if phone provided and Hormuud configured
    if (phoneNumber && process.env.SMS_API_TOKEN_URL) {
    const message = `TELCO Asset Mgmt: Your OTP is ${otp}. Valid for ${expiryMinutes} minutes. Do not share.`;
    const smsResult = await sendSMS(phoneNumber, message, 'otp', 'user', userId);
    if (smsResult.success) {
      return { success: true, message: 'OTP sent via SMS.', method: 'sms' };
    }
  }

  // Fallback to email if configured and address available
  const emailToUse = emailAddress || (looksLikeEmail(deliveryTarget) ? deliveryTarget : null);
  if (emailToUse && process.env.SMTP_HOST) {
    const emailResult = await sendOTPEmail(emailToUse, otp, expiryMinutes);
    if (emailResult.success) {
      return { success: true, message: 'OTP sent via email.', method: 'email' };
    }
  }

  return {
    success: false,
    error: 'OTP delivery not configured. Add SMS_API_TOKEN_URL (Hormuud) or SMTP_HOST (email) to .env. For testing, set OTP_DEV_BYPASS=1.',
  };
  } catch (err) {
    console.error('OTP error:', err.message);
    if (err.message?.includes('Invalid object name') || err.code === 'ETIMEDOUT' || err.code === 'ESOCKET') {
      return { success: false, error: 'OTP service unavailable. Ensure database is connected and otp_log table exists.' };
    }
    return { success: false, error: err.message || 'Failed to create OTP.' };
  }
}

async function verifyOTP(userId, otpCode, purpose) {
  const result = await query(
    `SELECT * FROM otp_log
     WHERE user_id = @user_id AND purpose = @purpose AND status = 'Pending'
       AND expires_at > GETDATE()
     ORDER BY created_at DESC`,
    { user_id: userId, purpose }
  );

  if (!result.recordset.length) {
    return { success: false, error: 'No active OTP found. Request a new one.' };
  }

  const otpRecord = result.recordset[0];

  if (otpRecord.attempts >= otpRecord.max_attempts) {
    await query(
      `UPDATE otp_log SET status = 'Blocked' WHERE otp_id = @otp_id`,
      { otp_id: otpRecord.otp_id }
    );
    return { success: false, error: 'Maximum attempts exceeded. Request a new OTP.' };
  }

  await query(
    `UPDATE otp_log SET attempts = attempts + 1 WHERE otp_id = @otp_id`,
    { otp_id: otpRecord.otp_id }
  );

  if (otpRecord.otp_code !== otpCode) {
    return { success: false, error: 'Invalid OTP code.' };
  }

  await query(
    `UPDATE otp_log SET status = 'Verified', verified_at = GETDATE() WHERE otp_id = @otp_id`,
    { otp_id: otpRecord.otp_id }
  );

  return { success: true, message: 'OTP verified successfully.' };
}

module.exports = { createAndSendOTP, verifyOTP };
