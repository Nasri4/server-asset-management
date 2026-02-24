/**
 * In-memory store for demo mode - allows create/read when DB is unavailable.
 */

let idCounter = { location: 100, rack: 100, department: 100, team: 100, engineer: 100, server: 100, incident: 100, maintenance: 100, application: 100 };

const store = {
  locations: [],
  racks: [],
  departments: [],
  teams: [],
  engineers: [],
  servers: [],
  incidents: [],
  maintenance: [],
  applications: [],
};

function nextId(key) {
  return ++idCounter[key];
}

function addLocation(data) {
  const id = nextId('location');
  const item = {
    location_id: id,
    site_name: data.site_name || '',
    country: data.country || '',
    city: data.city || '',
    site_type: data.site_type || null,
    address: data.address || null,
    power_source: data.power_source || null,
    cooling_type: data.cooling_type || null,
    rack_count: 0,
    server_count: 0,
    is_active: 1,
  };
  store.locations.push(item);
  return id;
}

function addRack(data) {
  const id = nextId('rack');
  const loc = store.locations.find(l => l.location_id === parseInt(data.location_id));
  const item = {
    rack_id: id,
    location_id: parseInt(data.location_id),
    rack_code: data.rack_code || `RACK-${id}`,
    rack_name: data.rack_name || null,
    total_u: data.total_u || 42,
    power_circuit_a: data.power_circuit_a || null,
    power_circuit_b: data.power_circuit_b || null,
    server_count: 0,
    site_name: loc?.site_name || '',
    city: loc?.city || '',
    is_active: 1,
  };
  store.racks.push(item);
  if (loc) loc.rack_count = (loc.rack_count || 0) + 1;
  return id;
}

function addDepartment(data) {
  const id = nextId('department');
  const item = {
    department_id: id,
    department_name: data.department_name || '',
    description: data.description || null,
    head_name: data.head_name || null,
    head_email: data.head_email || null,
    head_phone: data.head_phone || null,
    team_count: 0,
    server_count: 0,
    is_active: 1,
  };
  store.departments.push(item);
  return id;
}

function addTeam(data) {
  const id = nextId('team');
  const dept = store.departments.find(d => d.department_id === parseInt(data.department_id));
  const item = {
    team_id: id,
    department_id: parseInt(data.department_id),
    team_name: data.team_name || '',
    description: data.description || null,
    oncall_phone: data.oncall_phone || null,
    oncall_email: data.oncall_email || null,
    department_name: dept?.department_name || '',
    engineer_count: 0,
    server_count: 0,
    is_active: 1,
  };
  store.teams.push(item);
  if (dept) dept.team_count = (dept.team_count || 0) + 1;
  return id;
}

function addEngineer(data) {
  const id = nextId('engineer');
  const team = store.teams.find(t => t.team_id === parseInt(data.team_id));
  const item = {
    engineer_id: id,
    full_name: data.full_name || '',
    phone: data.phone || null,
    email: data.email || null,
    employee_id: data.employee_id || null,
    team_id: data.team_id ? parseInt(data.team_id) : null,
    specialization: data.specialization || null,
    team_name: team?.team_name || '',
    department_name: team ? store.departments.find(d => d.department_id === team.department_id)?.department_name : '',
    assigned_servers: 0,
    is_active: 1,
  };
  store.engineers.push(item);
  if (team) team.engineer_count = (team.engineer_count || 0) + 1;
  return id;
}

function addServer(data) {
  const id = nextId('server');
  const uStart = data.u_position_start ? parseInt(data.u_position_start) : null;
  const uEnd = data.u_position_end ? parseInt(data.u_position_end) : uStart;
  const item = {
    server_id: id,
    server_code: data.server_code || `SRV-${id}`,
    hostname: data.hostname || null,
    server_type: data.server_type || 'Physical',
    environment: data.environment || 'Production',
    role: data.role || null,
    status: data.status || 'Active',
    power_type: data.power_type || 'Single',
    team_id: data.team_id || null,
    department_id: data.department_id || null,
    location_id: data.location_id || null,
    rack_id: data.rack_id || null,
    u_position_start: uStart,
    u_position_end: uEnd,
    install_date: data.install_date || null,
    site_name: null,
    city: null,
    rack_code: null,
    team_name: null,
    assigned_engineer: null,
    vendor: data.vendor || null,
    model: data.model || null,
    serial_number: data.serial_number || null,
    notes: data.notes || null,
    is_active: 1,
  };
  const loc = data.location_id ? store.locations.find(l => l.location_id === parseInt(data.location_id)) : null;
  const rack = data.rack_id ? store.racks.find(r => r.rack_id === parseInt(data.rack_id)) : null;
  const team = data.team_id ? store.teams.find(t => t.team_id === parseInt(data.team_id)) : null;
  if (loc) { item.site_name = loc.site_name; item.city = loc.city; loc.server_count = (loc.server_count || 0) + 1; }
  if (rack) { item.rack_code = rack.rack_code; rack.server_count = (rack.server_count || 0) + 1; }
  if (team) { item.team_name = team.team_name; team.server_count = (team.server_count || 0) + 1; }
  store.servers.push(item);
  return id;
}

function addIncident(data, reportedBy) {
  const id = nextId('incident');
  const server = store.servers.find(s => s.server_id === parseInt(data.server_id));
  const item = {
    incident_id: id,
    server_id: parseInt(data.server_id),
    incident_type: data.incident_type || null,
    title: data.title || '',
    severity: data.severity || 'Medium',
    description: data.description || null,
    status: 'Open',
    server_code: server?.server_code || '',
    hostname: server?.hostname || null,
    assigned_engineer: null,
    reported_at: new Date().toISOString(),
  };
  store.incidents.push(item);
  return id;
}

function addMaintenance(data) {
  const id = nextId('maintenance');
  const server = store.servers.find(s => s.server_id === parseInt(data.server_id));
  const engineer = data.assigned_engineer_id ? store.engineers.find(e => e.engineer_id === parseInt(data.assigned_engineer_id)) : null;
  const item = {
    maintenance_id: id,
    server_id: parseInt(data.server_id),
    maintenance_type: data.maintenance_type || 'Preventive',
    title: data.title || '',
    description: data.description || null,
    scheduled_date: data.scheduled_date || null,
    scheduled_end: data.scheduled_end || null,
    priority: data.priority || 'Medium',
    status: 'Scheduled',
    server_code: server?.server_code || '',
    engineer_name: engineer?.full_name || null,
  };
  store.maintenance.push(item);
  return id;
}

function addApplication(data) {
  const id = nextId('application');
  const item = {
    application_id: id,
    app_name: data.app_name || '',
    app_type: data.app_type || null,
    version: data.version || null,
    criticality: data.criticality || 'Medium',
    sla_level: data.sla_level || null,
    description: data.description || null,
    server_count: 0,
  };
  store.applications.push(item);
  return id;
}

module.exports = {
  store,
  addLocation,
  addRack,
  addDepartment,
  addTeam,
  addEngineer,
  addServer,
  addIncident,
  addMaintenance,
  addApplication,
};
