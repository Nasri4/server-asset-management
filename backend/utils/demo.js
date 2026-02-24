/**
 * Demo mode - allows the app to run without SQL Server.
 * Set DEMO_MODE=1 in .env or it auto-activates when DB connection fails.
 */

const DEMO_USER = {
  user_id: 1,
  username: 'admin',
  full_name: 'System Administrator (Demo)',
  email: 'nasrix01@gmail.com',
  phone: '+252612666888',
  role_name: 'Admin',
  role_id: 1,
  role_level: 100,
  department_id: null,
  team_id: null,
  engineer_id: null,
};

// Admin has all permissions
const DEMO_PERMISSIONS = [
  'servers.create', 'servers.read', 'servers.update', 'servers.delete', 'servers.credentials',
  'incidents.create', 'incidents.read', 'incidents.update', 'incidents.delete',
  'maintenance.create', 'maintenance.read', 'maintenance.update', 'maintenance.delete',
  'engineers.create', 'engineers.read', 'engineers.update', 'engineers.delete',
  'teams.create', 'teams.read', 'teams.update', 'teams.delete',
  'departments.create', 'departments.read', 'departments.update', 'departments.delete',
  'reports.read', 'reports.export', 'audit.read', 'admin.users', 'admin.roles', 'admin.settings',
];

function getDemoDashboard() {
  const { store } = require('./demoStore');
  const servers = store.servers;
  const total = servers.length;
  const active = servers.filter(s => s.status === 'Active').length;
  const incidents = store.incidents;
  const bySeverity = ['Critical', 'High', 'Medium', 'Low'].map(sev => ({
    severity: sev,
    count: incidents.filter(i => i.severity === sev && i.status === 'Open').length,
  })).filter(s => s.count > 0);
  const maintenance = store.maintenance;
  const now = new Date();
  const upcoming = maintenance.filter(m => m.status === 'Scheduled' && new Date(m.scheduled_date) >= now).slice(0, 5);
  const overdue = maintenance.filter(m => m.status === 'Scheduled' && new Date(m.scheduled_date) < now).length;
  return {
    serverStats: { total_servers: total, active_servers: active, inactive_servers: total - active, maintenance_servers: 0, decommissioned_servers: 0 },
    incidentsBySeverity: bySeverity.length ? bySeverity : [{ severity: 'Medium', count: 0 }],
    upcomingMaintenance: upcoming,
    overdueCount: overdue,
    expiringWarranties: 0,
    recentActivity: [],
  };
}

module.exports = { DEMO_USER, DEMO_PERMISSIONS, getDemoDashboard };
