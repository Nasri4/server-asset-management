/**
 * Test database connection - run from backend folder: node scripts/test-db-connection.js
 * Helps debug "Login failed" or connection errors.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const sql = require('mssql');

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

const envPath = require('path').join(__dirname, '..', '.env');
const fs = require('fs');
const hasEnvFile = fs.existsSync(envPath);

console.log('Attempting connection with:');
console.log('  Server:', serverName);
console.log('  Instance:', instanceName || '(default)');
console.log('  Port:', config.port !== undefined ? config.port : '(from instance)');
console.log('  Database:', config.database);
console.log('  User:', config.user);
console.log('  Password set:', !!config.password);
console.log('  .env file:', hasEnvFile ? envPath : 'NOT FOUND');
console.log('');

if (!config.password) {
  console.error('✗ No DB_PASSWORD found.');
  if (!hasEnvFile) {
    console.error('  Create backend/.env (copy from .env.example) and set:');
    console.error('  DB_USER=nasri_x4');
    console.error('  DB_PASSWORD=YourActualPassword');
    console.error('  If password has special chars use quotes: DB_PASSWORD="Nasri55@"');
  } else {
    console.error('  Add DB_PASSWORD=YourActualPassword to backend/.env');
    console.error('  If password has special chars use quotes: DB_PASSWORD="Nasri55@"');
  }
  process.exit(1);
}

sql.connect(config)
  .then((pool) => {
    return pool.request().query('SELECT @@VERSION AS version');
  })
  .then((result) => {
    console.log('✓ Connected successfully!');
    console.log('  SQL Server:', (result.recordset[0].version || '').split('\n')[0]);
    process.exit(0);
  })
  .catch((err) => {
    console.error('✗ Connection failed:');
    console.error('  ', err.message);
    if (/Login failed for user/i.test(err.message)) {
      console.error('\n  Fix:');
      console.error('  1. In SSMS, confirm you can log in with this user and password.');
      console.error('  2. If password has special chars (@ # $), put it in quotes in .env: DB_PASSWORD="Nasri55@"');
      console.error('  3. SQL Server must be in "Mixed Mode" (SQL + Windows auth) for SQL logins.');
      console.error('  4. User needs access to database:', config.database, '- add as user in that DB.');
    }
    if (/ECONNREFUSED|ETIMEDOUT/i.test(err.message)) {
      console.error('\n  Fix: Check DB_SERVER and port. For Express use: DB_SERVER=localhost\\SQLEXPRESS or DB_INSTANCE=SQLEXPRESS');
    }
    process.exit(1);
  });
