const axios = require('axios');
const { query, isDemoMode } = require('../config/db');

let cachedToken = null;
let tokenExpiry = null;

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

  try {
    const response = await axios.post(
      process.env.SMS_API_TOKEN_URL,
      new URLSearchParams({
        grant_type: 'password',
        username: process.env.SMS_API_USERNAME,
        password: process.env.SMS_API_PASSWORD,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    cachedToken = response.data.access_token;
    tokenExpiry = new Date(Date.now() + (response.data.expires_in - 60) * 1000);
    return cachedToken;
  } catch (err) {
    console.error('SMS token fetch failed:', err.message);
    if (err.response?.data) console.error('SMS API response:', err.response.data);
    throw new Error('SMS authentication failed');
  }
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
    const token = await getToken();

    const response = await axios.post(
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
      }
    );

    if (!isDemoMode()) {
      try {
        await query(
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
        );
      } catch (logErr) {
        console.error('SMS log insert failed:', logErr.message);
      }
    }

    return { success: true, data: response.data };
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
            response: err.message,
            entity: entityType,
            entity_id: entityId,
          }
        );
      } catch (logErr) {
        console.error('SMS log insert failed:', logErr.message);
      }
    }
    console.error('SMS send failed:', err.message);
    return { success: false, error: err.message };
  }
}

module.exports = { sendSMS, isSmsConfigured };
