/**
 * Unlock all user accounts and ensure developer admin exists.
 * Run from backend folder: node scripts/seed-developer.js
 *
 * Developer user: username=developer, password=Nasri123 (8 chars min)
 * full_name=sys developer, email=nasrix01@gmail.com, role=Admin, otp_method=sms
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const sql = require('mssql');
const bcrypt = require('bcrypt');

const DEVELOPER_USERNAME = 'developer';
const DEVELOPER_PASSWORD = 'Nasri123';
const DEVELOPER_FULL_NAME = 'sys developer';
const DEVELOPER_EMAIL = 'nasrix01@gmail.com';
const OTP_METHOD = 'sms';

let serverName = process.env.DB_SERVER || 'localhost';
let instanceName = process.env.DB_INSTANCE || null;
if (serverName.includes('\\')) {
  const parts = serverName.split('\\');
  serverName = parts[0];
  if (parts[1]) instanceName = parts[1];
}

const config = {
  server: serverName,
  database: process.env.DB_DATABASE || 'TELCO_ASSET_MGMT',
  user: process.env.DB_USER || 'nasri_x4',
  password: (() => {
    const raw = process.env.DB_PASSWORD || '';
    return (raw.startsWith('"') && raw.endsWith('"') ? raw.slice(1, -1) : raw).trim();
  })(),
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_CERT !== 'false',
    enableArithAbort: true,
    connectTimeout: 15000,
    ...(instanceName ? { instanceName } : {}),
  },
  ...(!instanceName && { port: parseInt(process.env.DB_PORT) || 1433 }),
};

async function main() {
  let pool;
  try {
    pool = await sql.connect(config);

    // 1) Unlock all users
    await pool.request().query(`
      UPDATE users SET failed_attempts = 0, locked_until = NULL
    `);
    console.log('Unlocked all user accounts.');

    // 2) Check if developer exists
    const check = await pool.request()
      .input('username', sql.NVarChar(100), DEVELOPER_USERNAME)
      .query('SELECT user_id FROM users WHERE username = @username');

    if (check.recordset.length) {
      // Update password and ensure email/name/otp_method
      const hash = await bcrypt.hash(DEVELOPER_PASSWORD, 12);
      await pool.request()
        .input('username', sql.NVarChar(100), DEVELOPER_USERNAME)
        .input('hash', sql.NVarChar(255), hash)
        .input('full_name', sql.NVarChar(100), DEVELOPER_FULL_NAME)
        .input('email', sql.NVarChar(100), DEVELOPER_EMAIL)
        .input('otp_method', sql.NVarChar(20), OTP_METHOD)
        .query(`
          UPDATE users SET password_hash = @hash, full_name = @full_name, email = @email, otp_method = @otp_method,
            failed_attempts = 0, locked_until = NULL, updated_at = GETDATE()
          WHERE username = @username
        `);
      console.log('Updated developer user. Login: username=developer, password=Nasri123');
    } else {
      // Insert developer (Admin role)
      const roleResult = await pool.request().query('SELECT TOP 1 role_id FROM roles ORDER BY level DESC');
      if (!roleResult.recordset.length) {
        console.error('No roles in database. Run database/seed-data.sql or seed-roles-only.sql first.');
        process.exit(1);
      }
      const roleId = roleResult.recordset[0].role_id;
      const hash = await bcrypt.hash(DEVELOPER_PASSWORD, 12);
      await pool.request()
        .input('username', sql.NVarChar(100), DEVELOPER_USERNAME)
        .input('hash', sql.NVarChar(255), hash)
        .input('full_name', sql.NVarChar(100), DEVELOPER_FULL_NAME)
        .input('email', sql.NVarChar(100), DEVELOPER_EMAIL)
        .input('role_id', sql.Int, roleId)
        .input('otp_method', sql.NVarChar(20), OTP_METHOD)
        .query(`
          INSERT INTO users (username, password_hash, full_name, email, phone, role_id, otp_method)
          VALUES (@username, @hash, @full_name, @email, NULL, @role_id, @otp_method)
        `);
      console.log('Created developer user. Login: username=developer, password=Nasri123');
    }

    console.log('Done. You can log in with username=developer and password=Nasri123');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    if (pool) await pool.close();
  }
}

main();
