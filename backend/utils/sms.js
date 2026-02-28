const axios = require('axios');
const { query, isDemoMode } = require('../config/db');

let cachedToken = null;
let tokenExpiry = null;

// Hard timeouts so a slow/dead provider never blocks the thread
const TOKEN_TIMEOUT_MS = 4000;
const SEND_TIMEOUT_MS  = 5000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableError(err) {
  const status = err?.response?.status;
  if (!status) return true;
  return status >= 500 || status === 429;
}

function isSmsConfigured() {
  const url = process.env.SMS_API_TOKEN_URL;
  const sendUrl = process.env.SMS_API_SEND_URL;
  const username = process.env.SMS_API_USERNAME;
  const password = process.env.SMS_API_PASSWORD;
  return !!(url && sendUrl && username && password);
}

async function getToken() {
  if (!isSmsConfigured()) {
    throw new Error('SMS not configured: set SMS_API_TOKEN_URL, SMS_API_SEND_URL, SMS_API_USERNAME, SMS_API_PASSWORD in .env');
  }
  if (cachedToken && tokenExpiry && new Date() < tokenExpiry) {
    return cachedToken;
  }

  const maxAttempts = 2;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await axios.post(
        process.env.SMS_API_TOKEN_URL,
        new URLSearchParams({
          grant_type: 'password',
          username: process.env.SMS_API_USERNAME,
          password: process.env.SMS_API_PASSWORD,
        }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: TOKEN_TIMEOUT_MS }
      );

      cachedToken = response.data.access_token;
      const expiresIn = Number(response.data.expires_in) || 300;
      tokenExpiry = new Date(Date.now() + Math.max(expiresIn - 60, 30) * 1000);
      return cachedToken;
    } catch (err) {
      const status = err?.response?.status || 'NO_STATUS';
      console.error(`SMS token fetch failed (attempt ${attempt}/${maxAttempts}, status: ${status})`);

      if (attempt < maxAttempts && isRetryableError(err)) {
        await sleep(100 * attempt); // was 300 * attempt
        continue;
      }

      throw new Error('SMS authentication failed');
    }
  }

  throw new Error('SMS authentication failed');
}

async function sendSMS(recipient, message, smsType = 'general', entityType = null, entityId = null) {
  if (!recipient || !message) {
    console.error('SMS: recipient and message are required');
    return { success: false, error: 'Missing recipient or message' };
  }
  if (!isSmsConfigured()) {
    console.warn('SMS: skipped (env not set). Set SMS_API_TOKEN_URL, SMS_API_SEND_URL, SMS_API_USERNAME, SMS_API_PASSWORD in .env');
    return { success: false, error: 'SMS not configured' };
  }
  try {
    let response = null;
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const token = await getToken();
        response = await axios.post(
          process.env.SMS_API_SEND_URL,
          {
            mobile: recipient,
            message: message,
            senderid: process.env.SMS_SENDER_ID || 'TELCO_MGMT',
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            timeout: SEND_TIMEOUT_MS,
          }
        );
        break;
      } catch (sendErr) {
        const status = sendErr?.response?.status;

        if (status === 401) {
          cachedToken = null;
          tokenExpiry = null;
        }

        if (attempt < maxAttempts && isRetryableError(sendErr)) {
          await sleep(100 * attempt); // was 300 * attempt
          continue;
        }

        throw sendErr;
      }
    }

    if (!isDemoMode()) {
      // fire-and-forget — don't block the caller on a DB log write
      query(
          `INSERT INTO sms_log (recipient, message, sms_type, status, provider_response, related_entity, entity_id)
           VALUES (@recipient, @message, @sms_type, @status, @response, @entity, @entity_id)`,
          {
            recipient,
            message,
            sms_type: smsType,
            status: 'Sent',
            response: JSON.stringify(response.data),
            entity: entityType,
            entity_id: entityId,
          }
        ).catch(logErr => console.error('SMS log insert failed:', logErr.message));
    }

    return { success: true, data: response?.data };
  } catch (err) {
    if (!isDemoMode()) {
      try {
        await query(
          `INSERT INTO sms_log (recipient, message, sms_type, status, provider_response, related_entity, entity_id)
           VALUES (@recipient, @message, @sms_type, 'Failed', @response, @entity, @entity_id)`,
          {
            recipient,
            message,
            sms_type: smsType,
            response: `status=${err?.response?.status || 'NO_STATUS'}`,
            entity: entityType,
            entity_id: entityId,
          }
        );
      } catch (logErr) {
        console.error('SMS log insert failed:', logErr.message);
      }
    }
    console.error(`SMS send failed (status: ${err?.response?.status || 'NO_STATUS'})`);
    return { success: false, error: 'SMS provider error' };
  }
}

module.exports = { sendSMS, isSmsConfigured };

// Pre-warm the auth token at startup so the first OTP send is instant
if (isSmsConfigured()) {
  getToken().catch(() => {});
}
