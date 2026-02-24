const sql = require('mssql');
require('dotenv').config();

// Build config: support SQL Server Express (DB_INSTANCE=SQLEXPRESS or server\instance in DB_SERVER)
let serverName = process.env.DB_SERVER || 'localhost';
let instanceName = process.env.DB_INSTANCE || null;
if (serverName.includes('\\')) {
  const parts = serverName.split('\\');
  serverName = parts[0];
  if (parts[1]) instanceName = parts[1];
}
const rawPassword = process.env.DB_PASSWORD || '';
const dbConfig = {
  server: serverName,
  database: process.env.DB_DATABASE || 'TELCO_ASSET_MGMT',
  user: (process.env.DB_USER || 'nasri_x4').trim(),
  password: (rawPassword.startsWith('"') && rawPassword.endsWith('"') ? rawPassword.slice(1, -1) : rawPassword).trim(),
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_CERT !== 'false',
    enableArithAbort: true,
    connectTimeout: 15000,
    requestTimeout: 30000,
    ...(instanceName ? { instanceName } : {}),
  },
  ...(!instanceName && { port: parseInt(process.env.DB_PORT) || 1433 }),
  pool: {
    max: 20,
    min: 2,
    idleTimeoutMillis: 30000,
  },
};

let pool = null;
let poolError = null;

async function getPool() {
  if (pool) return pool;
  if (poolError) throw poolError;
  try {
    pool = await sql.connect(dbConfig);
    poolError = null;
    console.log('Database connected successfully');
    return pool;
  } catch (err) {
    poolError = err;
    const msg = err.message || err.code || String(err);
    console.error('Database connection failed:', msg);
    throw err;
  }
}

function isConnectionError(err) {
  if (!err) return false;
  return err.code === 'ESOCKET' || err.code === 'ETIMEDOUT' ||
    err.code === 'ECONNRESET' || (err.message && err.message.includes('Failed to connect'));
}

function isDemoMode() {
  return process.env.DEMO_MODE === 'true' || process.env.DEMO_MODE === '1';
}

async function query(queryText, params = {}) {
  const p = await getPool();
  const request = p.request();
  for (const [key, value] of Object.entries(params)) {
    request.input(key, value === undefined ? null : value);
  }
  return request.query(queryText);
}

async function execute(procedureName, params = {}) {
  const p = await getPool();
  const request = p.request();
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined && val !== null) {
      request.input(key, val);
    }
  }
  return request.execute(procedureName);
}

module.exports = { sql, getPool, query, execute, dbConfig, isConnectionError, isDemoMode };
