export const OFFICIAL_PERMISSION_KEYS = [
  "servers.read",
  "servers.create",
  "servers.update",
  "servers.delete",
  "hardware.read",
  "hardware.upsert",
  "network.read",
  "network.assign_ip",
  "applications.read",
  "applications.manage",
  "server_applications.manage",
  "security.read",
  "security.manage",
  "monitoring.read",
  "monitoring.update",
  "maintenance.read",
  "maintenance.manage",
  "visits.read",
  "visits.manage",
  "incidents.read",
  "incidents.create",
  "incidents.update",
  "incidents.resolve",
  "teams.read",
  "teams.manage",
  "locations.read",
  "locations.manage",
  "racks.read",
  "racks.manage",
  "audit.read"
] as const;

export type PermissionKey = (typeof OFFICIAL_PERMISSION_KEYS)[number];

export const ENGINEER_ALLOWED_PERMISSIONS: readonly PermissionKey[] = [
  "servers.read",
  "hardware.read",
  "network.read",
  "monitoring.read",
  "maintenance.read",
  "visits.read",
  "visits.manage",
  "incidents.read",
  "incidents.create"
] as const;

export const TEAMLEAD_ALLOWED_PERMISSIONS: readonly PermissionKey[] = [
  ...ENGINEER_ALLOWED_PERMISSIONS,
  "teams.read",
  "teams.manage",
  "incidents.update",
  "maintenance.manage",
  "servers.create",
  "servers.update"
] as const;

export function permissionsForRole(roleName: string): PermissionKey[] {
  const role = String(roleName ?? "").trim().toLowerCase();
  if (role === "admin" || role === "administrator") return [...OFFICIAL_PERMISSION_KEYS];
  if (role === "teamlead" || role === "team lead") return [...TEAMLEAD_ALLOWED_PERMISSIONS];
  if (role === "engineer") return [...ENGINEER_ALLOWED_PERMISSIONS];
  return [];
}
