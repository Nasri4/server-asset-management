/**
 * Frontend validation utilities - uniqueness checks and form validation.
 * Use with existing data from API to prevent duplicate submissions.
 */

const normalize = (s) => (typeof s === 'string' ? s.trim().toLowerCase() : '');

/** Check if site_name already exists (case-insensitive) */
export function isDuplicateSiteName(siteName, locations, excludeId = null) {
  const name = normalize(siteName);
  if (!name) return false;
  return locations.some(
    (l) => normalize(l.site_name) === name && (!excludeId || l.location_id !== excludeId)
  );
}

/** Check if department_name already exists */
export function isDuplicateDepartmentName(name, departments, excludeId = null) {
  const n = normalize(name);
  if (!n) return false;
  return departments.some(
    (d) => normalize(d.department_name) === n && (!excludeId || d.department_id !== excludeId)
  );
}

/** Check if team_name already exists within same department */
export function isDuplicateTeamName(teamName, departmentId, teams, excludeId = null) {
  const n = normalize(teamName);
  if (!n || !departmentId) return false;
  return teams.some(
    (t) =>
      normalize(t.team_name) === n &&
      t.department_id === parseInt(departmentId, 10) &&
      (!excludeId || t.team_id !== excludeId)
  );
}

/** Check if rack_code already exists within same location */
export function isDuplicateRackCode(rackCode, locationId, racks, excludeId = null) {
  const code = normalize(rackCode);
  if (!code || !locationId) return false;
  return racks.some(
    (r) =>
      normalize(r.rack_code) === code &&
      r.location_id === parseInt(locationId, 10) &&
      (!excludeId || r.rack_id !== excludeId)
  );
}

/** Check if server_code already exists */
export function isDuplicateServerCode(serverCode, servers, excludeId = null) {
  const code = normalize(serverCode);
  if (!code) return false;
  return servers.some(
    (s) => normalize(s.server_code) === code && (!excludeId || s.server_id !== excludeId)
  );
}

/** Check if app_name already exists */
export function isDuplicateAppName(appName, applications, excludeId = null) {
  const n = normalize(appName);
  if (!n) return false;
  return applications.some(
    (a) => normalize(a.app_name) === n && (!excludeId || a.application_id !== excludeId)
  );
}

/** Check if employee_id already exists (when provided) */
export function isDuplicateEmployeeId(employeeId, engineers, excludeId = null) {
  if (!employeeId || !String(employeeId).trim()) return false;
  const id = String(employeeId).trim().toLowerCase();
  return engineers.some(
    (e) => e.employee_id && String(e.employee_id).toLowerCase() === id && (!excludeId || e.engineer_id !== excludeId)
  );
}

/** Validate server_code format (alphanumeric, hyphens, underscores) */
export function isValidServerCode(code) {
  if (!code || !code.trim()) return false;
  return /^[A-Za-z0-9_-]+$/.test(code.trim());
}
