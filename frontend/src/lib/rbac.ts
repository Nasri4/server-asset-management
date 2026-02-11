import type { AuthUser, Role } from "@/lib/api/types";

export function hasRole(user: AuthUser | null | undefined, role: Role) {
  const target = String(role ?? "").trim().toLowerCase();
  if (!target) return false;

  const roleValue = (r: unknown) => String(r ?? "").trim().toLowerCase();

  // Treat Administrator as Admin (common naming in some backends/DBs).
  if (target === "admin" || target === "administrator") {
    return Boolean(user?.roles?.some((r) => {
      const v = roleValue(r);
      return v === "admin" || v === "administrator";
    }));
  }

  return Boolean(user?.roles?.some((r) => roleValue(r) === target));
}

export function can(user: AuthUser | null | undefined, permission: string) {
  // Match backend behavior: Admin can do everything.
  if (isAdmin(user)) return true;
  return Boolean(user?.permissions?.includes(permission));
}

export function isAdmin(user: AuthUser | null | undefined) {
  return hasRole(user, "Admin");
}

export function isTeamLead(user: AuthUser | null | undefined) {
  return hasRole(user, "TeamLead");
}

export function isEngineer(user: AuthUser | null | undefined) {
  return hasRole(user, "Engineer");
}

// Product rule: non-admin users are always read-only for these modules.
export function isReadOnlyModuleForUser(user: AuthUser | null | undefined, moduleKey: "maintenance" | "security") {
  if (!user) return true;
  if (isAdmin(user)) return false;
  if (isEngineer(user)) return true;
  return true;
}
