/**
 * HORMUUD TELECOM - RBAC MIDDLEWARE
 * 
 * Enterprise-grade role-based access control with team and server scoping
 */

import type { Request, Response, NextFunction } from "express";
import { query } from "../db/sql";
import { HttpError } from "./error";

/**
 * Extended user type with full RBAC info
 */
export interface RBACUser {
  userId: number;
  username: string;
  fullName?: string;
  roleId: number;
  roleName: string;
  teamId: number | null;
  engineerId: number | null;
  permissions: string[];
  isActive: boolean;
}


/**
 * Load user with full RBAC context
 */
export async function loadUserRBAC(userId: number): Promise<RBACUser | null> {
  const sqlText = `
    SELECT 
      u.user_id,
      u.username,
      u.full_name,
      COALESCE(
        u.role_id,
        (SELECT TOP (1) role_id FROM dbo.roles WHERE LOWER(role_name) = 'engineer'),
        0
      ) AS role_id,
      COALESCE(
        r.role_name,
        'Engineer'
      ) AS role_name,
      u.team_id,
      u.is_active
    FROM dbo.Users u
    LEFT JOIN dbo.roles r
      ON r.role_id = COALESCE(
        u.role_id,
        (SELECT TOP (1) role_id FROM dbo.roles WHERE LOWER(role_name) = 'engineer'),
        0
      )
    WHERE u.user_id = @user_id AND u.is_active = 1
  `;
  
  const users = await query<{
    user_id: number;
    username: string;
    full_name: string | null;
    role_id: number;
    role_name: string;
    team_id: number | null;
    is_active: boolean;
  }>(sqlText, (r) => r.input("user_id", userId));
  
  if (!users[0]) return null;
  
  const user = users[0];

  // Engineers table may not exist in some legacy DBs; don't hard-fail auth when it's missing.
  let engineerId: number | null = null;
  try {
    const exists = await query<{ id: number | null }>(
      "SELECT OBJECT_ID('dbo.engineers', 'U') AS id"
    );
    if (exists[0]?.id) {
      const engineerRows = await query<{ engineer_id: number }>(
        "SELECT TOP (1) engineer_id FROM dbo.engineers WHERE user_id = @user_id AND is_active = 1",
        (r) => r.input("user_id", userId)
      );
      engineerId = engineerRows[0]?.engineer_id ?? null;
    }
  } catch {
    engineerId = null;
  }
  
  // Load permissions
  const permissionsSql = `
    SELECT DISTINCT
      COALESCE(p.code, p.permission_key, rp.permission_key) AS permission_code
    FROM dbo.role_permissions rp
    LEFT JOIN dbo.permissions p ON rp.permission_id = p.permission_id
    WHERE rp.role_id = @role_id
  `;
  
  const perms = await query<{ permission_code: string }>(
    permissionsSql,
    (r) => r.input("role_id", user.role_id)
  );
  
  return {
    userId: user.user_id,
    username: user.username,
    fullName: user.full_name || undefined,
    roleId: user.role_id,
    roleName: user.role_name,
    teamId: user.team_id,
    engineerId,
    permissions: perms.map((p) => String(p.permission_code ?? "").trim()).filter(Boolean),
    isActive: user.is_active
  };
}

/**
 * Middleware: Require authentication and load RBAC context
 */
export function requireRBACAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // User should be set by auth middleware already
  // This middleware enhances it with RBAC context
  
  if (!req.user) {
    throw new HttpError(401, "Authentication required", "UNAUTHORIZED");
  }
  
  next();
}

/**
 * Check if user has a specific permission
 */
export function can(user: RBACUser, permission: string): boolean {
  // Admin has all permissions
  if (user.roleName === "Admin") {
    return true;
  }
  
  return user.permissions.includes(permission);
}

/**
 * Check if user has ANY of the given permissions
 */
export function canAny(user: RBACUser, permissions: string[]): boolean {
  if (user.roleName === "Admin") {
    return true;
  }
  
  return permissions.some(p => user.permissions.includes(p));
}

/**
 * Check if user has ALL of the given permissions
 */
export function canAll(user: RBACUser, permissions: string[]): boolean {
  if (user.roleName === "Admin") {
    return true;
  }
  
  return permissions.every(p => user.permissions.includes(p));
}

/**
 * Middleware: Require specific permission
 */
export function requirePermission(permission: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new HttpError(401, "Authentication required", "UNAUTHORIZED");
    }
    
    if (!can(req.user, permission)) {
      throw new HttpError(
        403,
        `Permission denied: ${permission}`,
        "PERMISSION_DENIED"
      );
    }
    
    next();
  };
}

/**
 * Middleware: Require ANY of the given permissions
 */
export function requireAnyPermission(permissions: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new HttpError(401, "Authentication required", "UNAUTHORIZED");
    }
    
    if (!canAny(req.user, permissions)) {
      throw new HttpError(
        403,
        `Permission denied: requires one of [${permissions.join(", ")}]`,
        "PERMISSION_DENIED"
      );
    }
    
    next();
  };
}

/**
 * Middleware: Require specific role
 */
export function requireRole(roleName: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new HttpError(401, "Authentication required", "UNAUTHORIZED");
    }
    
    if (req.user.roleName !== roleName) {
      throw new HttpError(
        403,
        `Role required: ${roleName}`,
        "ROLE_DENIED"
      );
    }
    
    next();
  };
}

/**
 * Get scoped team ID based on user role
 * - Admin: null (all teams)
 * - TeamLead/Engineer: their team_id
 */
export function scopedTeamId(user: RBACUser): number | null {
  if (user.roleName === "Admin") {
    return null; // Admin sees all teams
  }
  
  return user.teamId;
}

/**
 * Get scoped engineer ID based on user role
 * - Admin/TeamLead: null (all engineers)
 * - Engineer: their engineer_id
 */
export function scopedEngineerId(user: RBACUser): number | null {
  if (user.roleName === "Admin" || user.roleName === "TeamLead") {
    return null; // Can see all engineers (within team scope)
  }
  
  return user.engineerId;
}

/**
 * Assert server is visible to user based on their scope
 * Throws 404 if not visible
 */
export async function assertServerVisible(
  user: RBACUser,
  serverId: number
): Promise<void> {
  let sqlText: string;
  
  if (user.roleName === "Admin") {
    // Admin can see all servers
    sqlText = `
      SELECT TOP 1 server_id 
      FROM dbo.servers 
      WHERE server_id = @server_id
    `;
  } else if (user.roleName === "TeamLead") {
    // TeamLead can see team servers
    sqlText = `
      SELECT TOP 1 server_id 
      FROM dbo.servers 
      WHERE server_id = @server_id 
        AND team_id = @team_id
    `;
  } else {
    // Engineer can see assigned servers OR team servers (read-only)
    sqlText = `
      SELECT TOP 1 server_id 
      FROM dbo.servers 
      WHERE server_id = @server_id 
        AND (engineer_id = @engineer_id OR team_id = @team_id)
    `;
  }
  
  const rows = await query<{ server_id: number }>(sqlText, (r) => {
    r.input("server_id", serverId);
    if (user.roleName !== "Admin") {
      r.input("team_id", user.teamId);
    }
    if (user.roleName === "Engineer") {
      r.input("engineer_id", user.engineerId);
    }
  });
  
  if (!rows[0]) {
    throw new HttpError(404, "Server not found", "SERVER_NOT_FOUND");
  }
}

/**
 * Assert server is assigned to user (for modifications)
 * Throws 403 if not assigned
 */
export async function assertServerAssigned(
  user: RBACUser,
  serverId: number
): Promise<void> {
  if (user.roleName === "Admin") {
    // Admin can modify any server
    await assertServerVisible(user, serverId);
    return;
  }
  
  if (user.roleName === "TeamLead") {
    // TeamLead can modify team servers
    await assertServerVisible(user, serverId);
    return;
  }
  
  // Engineer must be assigned to the server
  const sqlText = `
    SELECT TOP 1 server_id 
    FROM dbo.servers 
    WHERE server_id = @server_id 
      AND engineer_id = @engineer_id
  `;
  
  const rows = await query<{ server_id: number }>(sqlText, (r) => {
    r.input("server_id", serverId);
    r.input("engineer_id", user.engineerId);
  });
  
  if (!rows[0]) {
    throw new HttpError(
      403,
      "Server not assigned to you",
      "SERVER_NOT_ASSIGNED"
    );
  }
}

/**
 * Get server list with proper scoping
 */
export async function getServersScoped(user: RBACUser, filters?: {
  search?: string;
  status?: string;
  environment?: string;
}): Promise<any[]> {
  let whereClause = "WHERE 1=1";
  
  // Apply scope
  if (user.roleName === "TeamLead") {
    whereClause += ` AND s.team_id = ${user.teamId}`;
  } else if (user.roleName === "Engineer") {
    whereClause += ` AND (s.engineer_id = ${user.engineerId} OR s.team_id = ${user.teamId})`;
  }
  
  // Apply filters
  if (filters?.search) {
    whereClause += ` AND (s.server_code LIKE '%${filters.search}%' OR s.hostname LIKE '%${filters.search}%')`;
  }
  
  if (filters?.status) {
    whereClause += ` AND s.status = '${filters.status}'`;
  }
  
  if (filters?.environment) {
    whereClause += ` AND s.environment = '${filters.environment}'`;
  }
  
  const sqlText = `
    SELECT 
      s.server_id,
      s.server_code,
      s.hostname,
      s.server_type,
      s.environment,
      s.role AS server_role,
      s.status,
      s.team_id,
      t.team_name,
      s.engineer_id,
      e.full_name AS engineer_name,
      s.location_id,
      l.site_name AS location_name,
      s.rack_id,
      r.rack_code,
      s.created_at,
      s.updated_at,
      CASE WHEN s.engineer_id = @engineer_id THEN 1 ELSE 0 END AS is_assigned_to_me
    FROM dbo.servers s
    LEFT JOIN dbo.teams t ON s.team_id = t.team_id
    LEFT JOIN dbo.engineers e ON s.engineer_id = e.engineer_id
    LEFT JOIN dbo.locations l ON s.location_id = l.location_id
    LEFT JOIN dbo.racks r ON s.rack_id = r.rack_id
    ${whereClause}
    ORDER BY s.server_code
  `;
  
  return query(sqlText, (r) => {
    r.input("engineer_id", user.engineerId || null);
  });
}

/**
 * Check if activity should be redacted for user
 */
export function shouldRedactActivity(
  user: RBACUser,
  activity: { is_sensitive: boolean; actor_user_id: number | null }
): boolean {
  // Admin sees everything
  if (user.roleName === "Admin") {
    return false;
  }
  
  // TeamLead sees everything in their team
  if (user.roleName === "TeamLead") {
    return false;
  }
  
  // Engineer sees:
  // - Their own actions (never redacted)
  // - Non-sensitive actions by others
  if (activity.actor_user_id === user.userId) {
    return false;
  }
  
  return activity.is_sensitive;
}

/**
 * Redact sensitive activity message
 */
export function redactActivityMessage(message: string): string {
  return "[Sensitive action - details hidden]";
}
