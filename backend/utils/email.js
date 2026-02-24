/**
 * Email utility for OTP and notifications.
 * Uses nodemailer with SMTP (Gmail, Outlook, or custom).
 */
const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (!transporter) {
    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = parseInt(process.env.SMTP_PORT) || 587;
    const secure = process.env.SMTP_SECURE === 'true';
    transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: process.env.SMTP_USER && process.env.SMTP_PASS ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      } : undefined,
    });
  }
  return transporter;
}

async function sendEmail(to, subject, html, text = null) {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@telco-mgmt.com';
  try {
    await getTransporter().sendMail({
      from,
      to,
      subject,
      text: text || html.replace(/<[^>]*>/g, ''),
      html,
    });
    return { success: true };
  } catch (err) {
    console.error('Email send failed:', err.message);
    return { success: false, error: err.message };
  }
}

async function sendOTPEmail(to, otp, expiryMinutes) {
  const subject = 'TELCO Asset Mgmt - Your OTP Code';
  const html = `
    <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto;">
      <h2 style="color: #0F4C81;">TELCO Asset Management</h2>
      <p>Your one-time password (OTP) is:</p>
      <p style="font-size: 24px; font-weight: bold; letter-spacing: 4px; color: #0F4C81;">${otp}</p>
      <p style="color: #64748b; font-size: 14px;">Valid for ${expiryMinutes} minutes. Do not share.</p>
      <hr style="border: none; border-top: 1px solid #e2e8f0;" />
      <p style="color: #94a3b8; font-size: 12px;">This is an automated message. Please do not reply.</p>
    </div>
  `;
  return sendEmail(to, subject, html);
}

module.exports = { sendEmail, sendOTPEmail };
