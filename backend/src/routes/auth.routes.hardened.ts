import { Router } from "express";
import rateLimit from "express-rate-limit";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import sql from "mssql";
import { z } from "zod";

import { env } from "../config/env";
import { asyncHandler } from "../utils/asyncHandler";
import { validateBody } from "../middleware/validate";
import { HttpError } from "../middleware/error";
import { query } from "../db/sql";
import { queryTx, withTransaction } from "../db/sql";
import { audit } from "../utils/audit";
import { requireAuth } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import { ok } from "../utils/response";
import { permissionsForRole } from "../rbac/permissions";

export const authRouter = Router();

function isLoopbackAddress(ip: string | undefined): boolean {
  const v = String(ip ?? "").trim();
  if (!v) return false;
  // Express may report IPv6-mapped IPv4 addresses like ::ffff:127.0.0.1
  if (v === "::1") return true;
  if (v.startsWith("::ffff:")) {
    const mapped = v.slice("::ffff:".length);
    return mapped.startsWith("127.");
  }
  return v.startsWith("127.");
}

const loginSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1).refine((v) => v.trim().length > 0, "Password is required")
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: "Too many login attempts. Please try again later.", code: "RATE_LIMITED" } }
});

const bootstrapAdminSchema = z.object({
  username: z.string().trim().min(3).max(100),
  password: z.string().min(8).max(200),
  fullName: z.string().trim().min(1).max(200).optional(),
  teamId: z.number().int().positive()
});

const bootstrapAdminCompatSchema = z.object({
  username: z.string().trim().min(1).max(100),
  password: z.string().min(8).max(200),
  fullName: z.string().trim().min(1).max(200).optional(),
  teamId: z.number().int().positive().optional()
});

type DbUserRow = {
  user_id: number;
  username: string;
  password_hash: string | null;
  full_name: string | null;
  team_id: number | null;
  is_active: boolean | number | null;
  role_name: string | null;
};

function toBool(v: unknown, fallback = false) {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  const s = String(v ?? "").trim().toLowerCase();
  if (["true", "1", "yes", "y"].includes(s)) return true;
  if (["false", "0", "no", "n"].includes(s)) return false;
  return fallback;
}

function canonicalRole(roleName: string | null | undefined): "Admin" | "TeamLead" | "Engineer" {
  const v = String(roleName ?? "").trim().toLowerCase();
  if (v === "admin" || v === "administrator") return "Admin";
  if (v === "teamlead" || v === "team lead" || v === "lead") return "TeamLead";
  return "Engineer";
}

authRouter.post(
  "/login",
  loginLimiter,
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const { username, password } = req.body as z.infer<typeof loginSchema>;

    const usernameNorm = String(username).trim().toLowerCase();
    const passwordStr = String(password);

    // Uniform error to avoid username enumeration.
    const invalid = () => {
      throw new HttpError(401, "Invalid credentials", "INVALID_CREDENTIALS");
    };

    const rows = await query<DbUserRow>(
      `
      SELECT TOP (1)
        u.user_id,
        u.username,
        u.password_hash,
        u.full_name,
        u.team_id,
        u.is_active,
        r.role_name
      FROM dbo.Users u
      LEFT JOIN dbo.roles r ON r.role_id = u.role_id
      WHERE LOWER(u.username) = @username
      `,
      (r) => r.input("username", sql.VarChar, usernameNorm)
    );

    const userRow = rows[0];
    if (!userRow) invalid();

    const isActive = toBool(userRow.is_active, true);
    if (!isActive) throw new HttpError(403, "User is disabled", "USER_DISABLED");

    // Team ID is optional for Admin users
    const teamId = Number(userRow.team_id ?? 0);

    const hash = userRow.password_hash;
    if (!hash || String(hash).trim().length === 0) {
      throw new HttpError(
        403,
        "Password is not set for this user. In development, use POST /auth/bootstrap-admin to set it.",
        "PASSWORD_NOT_SET"
      );
    }

    const okPass = await bcrypt.compare(passwordStr, String(hash));
    if (!okPass) invalid();

    const role = canonicalRole(userRow.role_name);
    const roles = [role];

    const permissions = permissionsForRole(role);
    if (role !== "Admin" && permissions.length === 0) {
      throw new HttpError(403, "User has no permissions", "NO_PERMISSIONS");
    }

    const session = {
      userId: Number(userRow.user_id),
      username: usernameNorm,
      fullName: userRow.full_name ?? undefined,
      teamId: teamId > 0 ? teamId : undefined,
      roles,
      permissions
    };

    // IMPORTANT: Keep JWT minimal (identity only). Full RBAC context is reloaded from DB each request.
    const token = jwt.sign({ userId: session.userId }, env.auth.jwtSecret, { expiresIn: env.auth.jwtExpiresIn });

    res.cookie(env.auth.cookieName, token, {
      httpOnly: true,
      secure: env.auth.cookieSecure,
      sameSite: "lax"
    });

    await audit({
      actor: usernameNorm,
      action: "LOGIN",
      entity: "auth",
      entityId: String(userRow.user_id),
      details: { role }
    });

    return ok(res, session);
  })
);

/**
 * POST /auth/bootstrap/admin
 * Dev-only: create the first Admin user and sign in.
 * Guarded by header x-bootstrap-token matching DEV_BOOTSTRAP_TOKEN.
 */
authRouter.post(
  "/bootstrap/admin",
  validateBody(bootstrapAdminSchema),
  asyncHandler(async (req, res) => {
    if (env.nodeEnv === "production") throw new HttpError(404, "Not found", "NOT_FOUND");
    if (!env.auth.devBootstrapToken) throw new HttpError(404, "Not found", "NOT_FOUND");

    const token = String(req.headers["x-bootstrap-token"] ?? "");
    if (!token) throw new HttpError(403, "Bootstrap token required", "BOOTSTRAP_TOKEN_REQUIRED");
    if (token !== env.auth.devBootstrapToken) {
      // Do not log token values.
      // eslint-disable-next-line no-console
      console.warn(
        `Bootstrap token mismatch (provided_len=${token.length}, expected_len=${env.auth.devBootstrapToken.length})`
      );
      throw new HttpError(403, "Bootstrap token invalid", "BOOTSTRAP_TOKEN_INVALID");
    }

    const body = req.body as z.infer<typeof bootstrapAdminSchema>;
    const usernameNorm = String(body.username).trim().toLowerCase();
    const teamId = Number(body.teamId);

    const alreadyHasAdmin = await query<{ has_admin: number }>(
      `
      SELECT TOP (1) 1 as has_admin
      FROM dbo.Users u
      JOIN dbo.roles r ON r.role_id = u.role_id
      WHERE LOWER(r.role_name) IN ('admin','administrator')
      `
    );
    if (alreadyHasAdmin[0]) {
      throw new HttpError(409, "Admin already exists. Use /auth/login and /auth/users.", "ADMIN_ALREADY_EXISTS");
    }

    const passwordHash = await bcrypt.hash(String(body.password), 12);

    const created = await withTransaction(async (tx) => {
      const existing = await queryTx<{ user_id: number }>(
        tx,
        `SELECT TOP (1) user_id FROM dbo.Users WHERE LOWER(username) = @username`,
        (r) => r.input("username", sql.VarChar, usernameNorm)
      );
      if (existing[0]) {
        throw new HttpError(409, "Username already exists", "USERNAME_EXISTS");
      }

      const roleRows = await queryTx<{ role_id: number }>(
        tx,
        `SELECT TOP (1) role_id FROM dbo.roles WHERE LOWER(role_name) IN ('admin','administrator') ORDER BY role_id ASC`
      );
      const roleId = Number(roleRows[0]?.role_id ?? NaN);
      if (!Number.isFinite(roleId) || roleId <= 0) {
        throw new HttpError(500, "Roles are not initialized in the database", "ROLES_NOT_INITIALIZED");
      }

      const rows = await queryTx<{ user_id: number }>(
        tx,
        `
        INSERT INTO dbo.Users (username, password_hash, full_name, team_id, role_id, is_active)
        OUTPUT INSERTED.user_id
        VALUES (@username, @password_hash, @full_name, @team_id, @role_id, 1)
        `,
        (r) => {
          r.input("username", sql.NVarChar(100), usernameNorm);
          r.input("password_hash", sql.NVarChar(200), passwordHash);
          r.input("full_name", sql.NVarChar(200), body.fullName ?? null);
          r.input("team_id", sql.Int, teamId);
          r.input("role_id", sql.Int, roleId);
        }
      );

      const userId = Number(rows[0]?.user_id ?? NaN);
      if (!Number.isFinite(userId) || userId <= 0) {
        throw new HttpError(500, "Failed to create user", "USER_CREATE_FAILED");
      }

      return { userId };
    });

    const session = {
      userId: created.userId,
      username: usernameNorm,
      fullName: body.fullName ?? undefined,
      teamId,
      roles: ["Admin"],
      permissions: permissionsForRole("Admin")
    };

    // IMPORTANT: Keep JWT minimal (identity only). Full RBAC context is reloaded from DB each request.
    const jwtToken = jwt.sign({ userId: session.userId }, env.auth.jwtSecret, { expiresIn: env.auth.jwtExpiresIn });
    res.cookie(env.auth.cookieName, jwtToken, {
      httpOnly: true,
      secure: env.auth.cookieSecure,
      sameSite: "lax"
    });

    await audit({
      actor: "bootstrap",
      action: "CREATE",
      entity: "users",
      entityId: String(created.userId),
      details: { username: usernameNorm, teamId, role: "Admin" }
    });

    return ok(res, session);
  })
);

/**
 * POST /auth/bootstrap-admin
 * Dev-only compatibility endpoint.
 *
 * Why: some setup scripts create an 'admin' user with password_hash = NULL and instruct
 * calling /auth/bootstrap-admin. Without this, /auth/login correctly returns 401.
 *
 * Security: only enabled outside production and only from loopback.
 */
authRouter.post(
  "/bootstrap-admin",
  validateBody(bootstrapAdminCompatSchema),
  asyncHandler(async (req, res) => {
    if (env.nodeEnv === "production") throw new HttpError(404, "Not found", "NOT_FOUND");
    if (!isLoopbackAddress(req.ip) && !isLoopbackAddress(req.socket.remoteAddress)) {
      throw new HttpError(403, "Bootstrap is only allowed from localhost", "BOOTSTRAP_LOCALHOST_ONLY");
    }

    const body = req.body as z.infer<typeof bootstrapAdminCompatSchema>;
    const usernameNorm = String(body.username).trim().toLowerCase();
    const passwordHash = await bcrypt.hash(String(body.password), 12);

    const { userId, teamId } = await withTransaction(async (tx) => {
      const roleRows = await queryTx<{ role_id: number }>(
        tx,
        `
        SELECT TOP (1) role_id
        FROM dbo.roles
        WHERE LOWER(role_name) IN ('admin','administrator')
        ORDER BY role_id ASC
        `
      );
      const adminRoleId = Number(roleRows[0]?.role_id ?? NaN);
      if (!Number.isFinite(adminRoleId) || adminRoleId <= 0) {
        throw new HttpError(500, "Roles are not initialized in the database", "ROLES_NOT_INITIALIZED");
      }

      const existing = await queryTx<{ user_id: number; team_id: number | null }>(
        tx,
        `SELECT TOP (1) user_id, team_id FROM dbo.Users WHERE LOWER(username) = @username`,
        (r) => r.input("username", sql.VarChar, usernameNorm)
      );

      const teamFromBody = body.teamId != null ? Number(body.teamId) : undefined;
      const teamFromExisting = existing[0]?.team_id != null ? Number(existing[0].team_id) : undefined;

      let resolvedTeamId = teamFromBody ?? teamFromExisting;
      if (!resolvedTeamId) {
        const teamRows = await queryTx<{ team_id: number }>(
          tx,
          `SELECT TOP (1) team_id FROM dbo.teams ORDER BY team_id ASC`
        );
        resolvedTeamId = Number(teamRows[0]?.team_id ?? NaN);
      }

      if (!Number.isFinite(resolvedTeamId) || resolvedTeamId <= 0) {
        throw new HttpError(400, "teamId is required", "TEAM_ID_REQUIRED");
      }

      if (existing[0]) {
        const id = Number(existing[0].user_id);
        await queryTx(
          tx,
          `
          UPDATE dbo.Users
          SET
            password_hash = @password_hash,
            full_name = COALESCE(@full_name, full_name),
            team_id = @team_id,
            role_id = @role_id,
            is_active = 1
          WHERE user_id = @user_id
          `,
          (r) => {
            r.input("user_id", sql.Int, id);
            r.input("password_hash", sql.NVarChar(200), passwordHash);
            r.input("full_name", sql.NVarChar(200), body.fullName ?? null);
            r.input("team_id", sql.Int, resolvedTeamId);
            r.input("role_id", sql.Int, adminRoleId);
          }
        );
        return { userId: id, teamId: resolvedTeamId };
      }

      const inserted = await queryTx<{ user_id: number }>(
        tx,
        `
        INSERT INTO dbo.Users (username, password_hash, full_name, team_id, role_id, is_active)
        OUTPUT INSERTED.user_id
        VALUES (@username, @password_hash, @full_name, @team_id, @role_id, 1)
        `,
        (r) => {
          r.input("username", sql.NVarChar(100), usernameNorm);
          r.input("password_hash", sql.NVarChar(200), passwordHash);
          r.input("full_name", sql.NVarChar(200), body.fullName ?? null);
          r.input("team_id", sql.Int, resolvedTeamId);
          r.input("role_id", sql.Int, adminRoleId);
        }
      );

      const id = Number(inserted[0]?.user_id ?? NaN);
      if (!Number.isFinite(id) || id <= 0) {
        throw new HttpError(500, "Failed to create user", "USER_CREATE_FAILED");
      }

      return { userId: id, teamId: resolvedTeamId };
    });

    const session = {
      userId,
      username: usernameNorm,
      fullName: body.fullName ?? undefined,
      teamId,
      roles: ["Admin" as const],
      permissions: permissionsForRole("Admin")
    };

    // IMPORTANT: Keep JWT minimal (identity only). Full RBAC context is reloaded from DB each request.
    const token = jwt.sign({ userId: session.userId }, env.auth.jwtSecret, { expiresIn: env.auth.jwtExpiresIn });
    res.cookie(env.auth.cookieName, token, {
      httpOnly: true,
      secure: env.auth.cookieSecure,
      sameSite: "lax"
    });

    await audit({
      actor: "bootstrap",
      action: "SET_PASSWORD",
      entity: "auth",
      entityId: String(userId),
      details: { username: usernameNorm }
    });

    return ok(res, session);
  })
);

/**
 * GET /auth/bootstrap/status
 * Dev-only helper to confirm whether bootstrap is enabled.
 */
authRouter.get(
  "/bootstrap/status",
  asyncHandler(async (_req, res) => {
    if (env.nodeEnv === "production") throw new HttpError(404, "Not found", "NOT_FOUND");
    return ok(res, {
      enabled: Boolean(env.auth.devBootstrapToken),
      tokenConfigured: Boolean(env.auth.devBootstrapToken),
      tokenLength: env.auth.devBootstrapToken ? env.auth.devBootstrapToken.length : 0
    });
  })
);

const createUserSchema = z.object({
  username: z.string().trim().min(3).max(100),
  password: z.string().min(8).max(200),
  fullName: z.string().trim().min(1).max(200).optional(),
  teamId: z.number().int().positive().optional(),
  role: z.enum(["Admin", "Engineer"]).optional().default("Engineer"),
  isActive: z.boolean().optional().default(true)
});

type CreateUserRow = { user_id: number };

/**
 * POST /auth/users
 * Create a user with username + bcrypt password.
 * Permission: teams.manage (Admin always allowed)
 */
authRouter.post(
  "/users",
  requirePermission("teams.manage"),
  validateBody(createUserSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof createUserSchema>;

    const usernameNorm = String(body.username).trim().toLowerCase();
    const teamId = Number(body.teamId ?? req.user?.teamId);
    if (!Number.isFinite(teamId) || teamId <= 0) {
      throw new HttpError(400, "teamId is required", "TEAM_ID_REQUIRED");
    }

    const role = canonicalRole(body.role);
    const passwordHash = await bcrypt.hash(String(body.password), 12);

    const created = await withTransaction(async (tx) => {
      const existing = await queryTx<{ user_id: number }>(
        tx,
        `SELECT TOP (1) user_id FROM dbo.Users WHERE LOWER(username) = @username`,
        (r) => r.input("username", sql.VarChar, usernameNorm)
      );
      if (existing[0]) {
        throw new HttpError(409, "Username already exists", "USERNAME_EXISTS");
      }

      const roleRows = await queryTx<{ role_id: number }>(
        tx,
        `SELECT TOP (1) role_id FROM dbo.roles WHERE LOWER(role_name) = @role_name`,
        (r) => r.input("role_name", sql.NVarChar(50), role.toLowerCase())
      );
      const roleId = Number(roleRows[0]?.role_id ?? NaN);
      if (!Number.isFinite(roleId) || roleId <= 0) {
        throw new HttpError(500, "Roles are not initialized in the database", "ROLES_NOT_INITIALIZED");
      }

      const rows = await queryTx<CreateUserRow>(
        tx,
        `
        INSERT INTO dbo.Users (username, password_hash, full_name, team_id, role_id, is_active)
        OUTPUT INSERTED.user_id
        VALUES (@username, @password_hash, @full_name, @team_id, @role_id, @is_active)
        `,
        (r) => {
          r.input("username", sql.NVarChar(100), usernameNorm);
          r.input("password_hash", sql.NVarChar(200), passwordHash);
          r.input("full_name", sql.NVarChar(200), body.fullName ?? null);
          r.input("team_id", sql.Int, teamId);
          r.input("role_id", sql.Int, roleId);
          r.input("is_active", sql.Bit, body.isActive ? 1 : 0);
        }
      );

      const userId = Number(rows[0]?.user_id ?? NaN);
      if (!Number.isFinite(userId) || userId <= 0) {
        throw new HttpError(500, "Failed to create user", "USER_CREATE_FAILED");
      }

      return { userId };
    });

    await audit({
      actor: req.user!.username,
      action: "CREATE",
      entity: "users",
      entityId: String(created.userId),
      details: { username: usernameNorm, teamId, role }
    });

    return ok(res, {
      userId: created.userId,
      username: usernameNorm,
      fullName: body.fullName ?? null,
      teamId,
      roles: [role],
      permissions: permissionsForRole(role)
    });
  })
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    return ok(res, req.user);
  })
);

authRouter.post(
  "/logout",
  asyncHandler(async (req, res) => {
    const actor = req.user?.username ?? "unknown";
    res.clearCookie(env.auth.cookieName, {
      httpOnly: true,
      secure: env.auth.cookieSecure,
      sameSite: "lax",
      path: "/"
    });

    // Best-effort audit (only if we know the actor).
    if (req.user) {
      await audit({ actor, action: "LOGOUT", entity: "auth", entityId: actor });
    }
    return ok(res, true);
  })
);
