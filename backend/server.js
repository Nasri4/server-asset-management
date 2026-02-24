require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { getPool } = require('./config/db');

const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const serversRoutes = require('./routes/servers');
const securityRoutes = require('./routes/security');
const hardwareRoutes = require('./routes/hardware');
const networkRoutes = require('./routes/network');
const monitoringRoutes = require('./routes/monitoring');
const maintenanceRoutes = require('./routes/maintenance');
const incidentsRoutes = require('./routes/incidents');
const applicationsRoutes = require('./routes/applications');
const engineersRoutes = require('./routes/engineers');
const teamsRoutes = require('./routes/teams');
const reportsRoutes = require('./routes/reports');
const notificationsRoutes = require('./routes/notifications');
const auditRoutes = require('./routes/audit');
const departmentsRoutes = require('./routes/departments');
const racksRoutes = require('./routes/racks');
const locationsRoutes = require('./routes/locations');
const dashboardRoutes = require('./routes/dashboard');
const otpRoutes = require('./routes/otp');
const visitsRoutes = require('./routes/visits');
const searchRoutes = require('./routes/search');

const app = express();
const PORT = process.env.PORT || 5000;

// CORS first so preflight and responses get correct headers
const allowedOrigins = [
  'http://localhost:3000', 'http://127.0.0.1:3000',
  'http://localhost:3001', 'http://127.0.0.1:3001',
  'http://localhost:5001', 'http://127.0.0.1:5001',
];
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200,
}));
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
}));
app.use(morgan('dev'));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/servers', serversRoutes);
app.use('/api/security', securityRoutes);
app.use('/api/hardware', hardwareRoutes);
app.use('/api/network', networkRoutes);
app.use('/api/monitoring', monitoringRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/incidents', incidentsRoutes);
app.use('/api/applications', applicationsRoutes);
app.use('/api/engineers', engineersRoutes);
app.use('/api/teams', teamsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/audit-log', auditRoutes);
app.use('/api/departments', departmentsRoutes);
app.use('/api/racks', racksRoutes);
app.use('/api/locations', locationsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/otp', otpRoutes);
app.use('/api/visits', visitsRoutes);
app.use('/api/search', searchRoutes);

app.get('/api/health', async (req, res) => {
  try {
    await getPool();
    res.json({ ok: true, message: 'TELCO Asset Management API', database: 'connected' });
  } catch (err) {
    res.status(503).json({ ok: false, message: 'Database unavailable', database: 'error' });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const { isSmsConfigured } = require('./utils/sms');

async function startServer() {
  try {
    await getPool();
  } catch (err) {
    console.error('Database connection failed:', err.message || err);
    console.error('Server will start but API may fail until database is available.');
  }
  const server = app.listen(PORT, () => {
    console.log('API running on http://localhost:' + PORT);
    if (isSmsConfigured()) {
      console.log('SMS: Hormuud env set – maintenance/OTP SMS will be sent when recipients have phone numbers.');
    } else {
      console.warn('SMS: not configured. Set SMS_API_TOKEN_URL, SMS_API_SEND_URL, SMS_API_USERNAME, SMS_API_PASSWORD in .env to send SMS.');
    }
  });
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error('Port ' + PORT + ' is already in use. Stop the other process using this port or set PORT to a different number in .env.');
      process.exit(1);
    }
    throw err;
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
