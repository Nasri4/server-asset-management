import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, unwrap } from "@/lib/api/axios";

export type OrganizationSettings = {
  name: string;
  logo_url?: string | null;
  timezone: string;
  default_theme: "system" | "light" | "dark";
};

export async function getOrganizationSettings() {
  const res = await api.get("/api/settings/organization", { headers: { "x-sam-silent": "1" } });
  return unwrap(res.data) as OrganizationSettings;
}

export async function updateOrganizationSettings(input: Partial<OrganizationSettings>) {
  const res = await api.patch("/api/settings/organization", input);
  return unwrap(res.data) as { ok: true };
}

export type AuditSettings = {
  retention_days: number;
  auto_clean_enabled: boolean;
};

export async function getAuditSettings() {
  const res = await api.get("/api/settings/audit", { headers: { "x-sam-silent": "1" } });
  return unwrap(res.data) as AuditSettings;
}

export async function updateAuditSettings(input: Partial<AuditSettings>) {
  const res = await api.patch("/api/settings/audit", input);
  return unwrap(res.data) as { ok: true };
}

export type NotificationSettings = {
  email_enabled: boolean;
  smtp_host?: string | null;
  smtp_user?: string | null;
  from_email?: string | null;
  team_notifications_enabled?: boolean;
};

export async function getNotificationSettings() {
  const res = await api.get("/api/settings/notifications", { headers: { "x-sam-silent": "1" } });
  return unwrap(res.data) as NotificationSettings;
}

export async function updateNotificationSettings(input: Partial<NotificationSettings>) {
  const res = await api.patch("/api/settings/notifications", input);
  return unwrap(res.data) as { ok: true };
}

export type SecuritySettings = {
  min_password_length: number;
  require_numbers: boolean;
  require_symbols: boolean;
  session_timeout_minutes: number;
  login_attempt_limit: number;
};

export type MaintenancePolicySettings = {
  default_duration_minutes: number;
  approval_required: boolean;
};

export async function getSecuritySettings() {
  const res = await api.get("/api/settings/security", { headers: { "x-sam-silent": "1" } });
  return unwrap(res.data) as SecuritySettings;
}

export async function updateSecuritySettings(input: Partial<SecuritySettings>) {
  const res = await api.patch("/api/settings/security", input);
  return unwrap(res.data) as { ok: true };
}

export async function getMaintenancePolicySettings() {
  const res = await api.get("/api/settings/maintenance", { headers: { "x-sam-silent": "1" } });
  return unwrap(res.data) as MaintenancePolicySettings;
}

export async function updateMaintenancePolicySettings(input: Partial<MaintenancePolicySettings>) {
  const res = await api.patch("/api/settings/maintenance", input);
  return unwrap(res.data) as { ok: true };
}

export type ResetTarget = "Servers" | "Maintenances" | "Activities" | "AuditLogs";

export async function resetOperationalData(input: { targets: ResetTarget[]; confirm: string }) {
  const res = await api.post("/api/settings/data/reset", input);
  return unwrap(res.data) as { ok: true; job_id?: string };
}

export function useOrganizationSettings() {
  return useQuery({ queryKey: ["settings", "org"], queryFn: getOrganizationSettings });
}

export function useUpdateOrganizationSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateOrganizationSettings,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["settings", "org"] });
    },
  });
}

export function useAuditSettings() {
  return useQuery({ queryKey: ["settings", "audit"], queryFn: getAuditSettings });
}

export function useUpdateAuditSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateAuditSettings,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["settings", "audit"] });
    },
  });
}

export function useNotificationSettings() {
  return useQuery({ queryKey: ["settings", "notifications"], queryFn: getNotificationSettings });
}

export function useUpdateNotificationSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateNotificationSettings,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["settings", "notifications"] });
    },
  });
}

export function useSecuritySettings() {
  return useQuery({ queryKey: ["settings", "security"], queryFn: getSecuritySettings });
}

export function useUpdateSecuritySettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateSecuritySettings,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["settings", "security"] });
    },
  });
}

export function useMaintenancePolicySettings() {
  return useQuery({ queryKey: ["settings", "maintenance"], queryFn: getMaintenancePolicySettings });
}

export function useUpdateMaintenancePolicySettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateMaintenancePolicySettings,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["settings", "maintenance"] });
    },
  });
}

export function useResetOperationalData() {
  return useMutation({ mutationFn: resetOperationalData });
}

// =========================
// RBAC / Permissions matrix
// =========================

export type RbacRole = {
  role: "Admin" | "TeamLead" | "Engineer";
  label: string;
};

export type RbacPermission = {
  key: string;
  label: string;
  description?: string | null;
  group?: string | null;
};

export type PermissionMatrix = {
  roles: RbacRole[];
  permissions: RbacPermission[];
  // map: permissionKey -> role -> boolean
  grants: Record<string, Record<string, boolean>>;
};

export async function getPermissionMatrix() {
  const res = await api.get("/api/rbac/matrix", { headers: { "x-sam-silent": "1" } });
  return unwrap(res.data) as PermissionMatrix;
}

export async function updatePermissionMatrix(input: { grants: PermissionMatrix["grants"] }) {
  const res = await api.put("/api/rbac/matrix", input);
  return unwrap(res.data) as { ok: true };
}

export async function createPermission(input: { key: string; label: string; description?: string | null; group?: string | null }) {
  const res = await api.post("/api/rbac/permissions", input);
  return unwrap(res.data) as { ok: true };
}

export function usePermissionMatrix() {
  return useQuery({ queryKey: ["rbac", "matrix"], queryFn: getPermissionMatrix });
}

export function useUpdatePermissionMatrix() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updatePermissionMatrix,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["rbac", "matrix"] });
    },
  });
}

export function useCreatePermission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createPermission,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["rbac", "matrix"] });
    },
  });
}
