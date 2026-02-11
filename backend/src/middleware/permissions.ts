import { Request, Response, NextFunction } from "express";
import { HttpError } from "./error";
import { requireAuth } from "./auth";

const PERMISSION_ALIASES: Record<string, string[]> = {
  // New (required) codes -> legacy keys
  SERVER_VIEW: ["servers.read"],
  SERVER_CREATE: ["servers.create"],
  SERVER_UPDATE: ["servers.update"],
  SERVER_DELETE: ["servers.delete"],
  SERVER_NOTES_UPDATE: ["servers.update"],
  SERVER_STATUS_UPDATE: ["servers.update"],
  MAINTENANCE_VIEW: ["maintenance.read"],
  MAINTENANCE_CREATE: ["maintenance.manage"],
  MAINTENANCE_UPDATE: ["maintenance.manage"],
  MAINTENANCE_APPROVE: ["maintenance.manage"],
  MAINTENANCE_CLOSE: ["maintenance.manage"],
  USER_VIEW: ["teams.manage"],
  USER_CREATE_ENGINEER: ["teams.manage"],
  USER_UPDATE: ["teams.manage"],
  USER_DISABLE: ["teams.manage"],
  AUDIT_VIEW: ["audit.read"],
  ACTIVITY_VIEW: ["servers.read"],
};

function hasRole(roles: unknown[], roleName: string) {
  const target = String(roleName ?? "").trim().toLowerCase();
  if (!target) return false;

  // Normalize common role aliases.
  const roleValue = (r: unknown) => String(r ?? "").trim().toLowerCase();

  // Treat Administrator as Admin (common naming in some DBs).
  if (target === "admin" || target === "administrator") {
    return roles.some((r) => {
      const v = roleValue(r);
      return v === "admin" || v === "administrator";
    });
  }

  return roles.some((r) => roleValue(r) === target);
}

export function requireRole(roleName: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    requireAuth(req, res, (err?: any) => {
      if (err) return next(err);
      const roles = req.user?.roles ?? [];
      if (!hasRole(roles, roleName)) return next(new HttpError(403, "Role required", "ROLE_REQUIRED"));
      return next();
    });
  };
}

export function requirePermission(permissionKey: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    requireAuth(req, res, (err?: any) => {
      if (err) return next(err);
      const perms = req.user?.permissions ?? [];
      const roles = req.user?.roles ?? [];
      // Product rule: Admin has full access.
      if (hasRole(roles, "Admin")) return next();

      const direct = perms.includes(permissionKey);
      const aliased = (PERMISSION_ALIASES[permissionKey] ?? []).some((k) => perms.includes(k));
      if (!direct && !aliased) return next(new HttpError(403, "Permission denied", "PERMISSION_DENIED"));
      return next();
    });
  };
}

// Backward-compat: some routes import checkPermissions from older code.
// This enforces that the user has ALL of the provided permissions (with aliases).
export function checkPermissions(required: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    requireAuth(req, res, (err?: any) => {
      if (err) return next(err);
      const perms = req.user?.permissions ?? [];
      const roles = req.user?.roles ?? [];
      if (hasRole(roles, "Admin")) return next();

      for (const key of required) {
        const direct = perms.includes(key);
        const aliased = (PERMISSION_ALIASES[key] ?? []).some((k) => perms.includes(k));
        if (!direct && !aliased) {
          return next(new HttpError(403, "Permission denied", "PERMISSION_DENIED"));
        }
      }

      return next();
    });
  };
}
