export { authRouter } from "./auth.routes.hardened";

/*
Legacy implementation (company/local/OTP/passwordless) is intentionally disabled.
We keep this file name as a stable import path.

DO NOT re-enable without a full security review.

-- BEGIN LEGACY --

import { Router } from "express";
import axios from "axios";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { z } from "zod";
import sql from "mssql";
import { env } from "../config/env";
import { asyncHandler } from "../utils/asyncHandler";
import { validateBody } from "../middleware/validate";
import { HttpError } from "../middleware/error";
import { execProc } from "../db/sql";
import { query } from "../db/sql";
import { audit } from "../utils/audit";
import { requireAuth } from "../middleware/auth";
import { ok } from "../utils/response";

export const authRouter = Router();

type OtpEntry = {
  hash: string;
  expiresAtMs: number;
  attempts: number;
};

const otpStore = new Map<string, OtpEntry>();

function otpKey(username: string) {
  return String(username ?? "").trim().toLowerCase();
}

function generateOtpCode(): string {
  const n = crypto.randomInt(0, 1_000_000);
  return String(n).padStart(6, "0");
}

function hashOtp(usernameKey: string, code: string) {
  // Salt with JWT secret so stored hashes are not reusable across envs.
  const salt = env.auth.jwtSecret;
  return crypto.createHash("sha256").update(`${usernameKey}:${code}:${salt}`).digest("hex");
}

function safeEqHex(a: string, b: string) {
  const ba = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function requireOtpIfEnabled(username: string, otp: string | undefined) {
  if (env.auth.otp.mode === "off") return;
  if (env.nodeEnv === "production") {
    // Never allow virtual OTP in production.
    throw new HttpError(500, "OTP is not configured", "OTP_NOT_CONFIGURED");
  }
  if (env.auth.otp.mode !== "virtual") return;

  const key = otpKey(username);
  const entry = otpStore.get(key);
  if (!entry) throw new HttpError(401, "OTP required. Request a code first.", "OTP_REQUIRED");
  if (!otp) throw new HttpError(401, "OTP is required", "OTP_REQUIRED");

  if (Date.now() > entry.expiresAtMs) {
    otpStore.delete(key);
    throw new HttpError(401, "OTP expired. Request a new code.", "OTP_EXPIRED");
  }
  if (entry.attempts >= env.auth.otp.maxAttempts) {
    otpStore.delete(key);
    throw new HttpError(429, "Too many OTP attempts. Request a new code.", "OTP_TOO_MANY_ATTEMPTS");
  }

  const candidate = hashOtp(key, String(otp).trim());
  if (!safeEqHex(entry.hash, candidate)) {
    otpStore.set(key, { ...entry, attempts: entry.attempts + 1 });
    throw new HttpError(401, "Invalid OTP", "OTP_INVALID");
  }

  otpStore.delete(key);
}

function isAdminUserContext(email: string, roles: unknown[]) {
  const emailLower = String(email ?? "").trim().toLowerCase();
  const hasAdminRole = (roles ?? []).some((r) => {
    const v = String(r ?? "").trim().toLowerCase();
    return v === "admin" || v === "administrator";
  });
  return hasAdminRole || env.auth.adminEmails.includes(emailLower);
}

const defaultDevUserPermissions = [
  "servers.read",
  "teams.read",
  "locations.read",
  "racks.read",
  "maintenance.read",
  "security.read",
  "incidents.create"
] as const;

const loginSchema = z.object({
  username: z.string().trim().min(1),
  // Allow empty passwords so DB passwordless mode can work (guarded in handler).
  password: z.string()
});

const otpRequestSchema = z.object({
  username: z.string().trim().min(1)
});

authRouter.post(
  "/otp/request",
  validateBody(otpRequestSchema),
  asyncHandler(async (req, res) => {
    if (env.nodeEnv === "production") {
      throw new HttpError(404, "Not found", "NOT_FOUND");
    }
    if (env.auth.otp.mode !== "virtual") {
      throw new HttpError(400, "OTP is disabled", "OTP_DISABLED");
    }

    const { username } = req.body as z.infer<typeof otpRequestSchema>;
    const key = otpKey(username);
    const code = generateOtpCode();
    const expiresAtMs = Date.now() + Math.max(30, env.auth.otp.ttlSeconds) * 1000;

    otpStore.set(key, {
      hash: hashOtp(key, code),
      expiresAtMs,
      attempts: 0
    });

    // Virtual OTP: return it directly (dev only). In real mode, send via SMS/Email.
    return ok(res, { otp: code, expires_at: new Date(expiresAtMs).toISOString() });
  })
);

const otpVerifySchema = z.object({
  username: z.string().trim().min(1),
  otp: z.string().trim().min(1)
});

authRouter.post(
  "/otp/verify",
  validateBody(otpVerifySchema),
  asyncHandler(async (req, res) => {
    if (env.nodeEnv === "production") {
      throw new HttpError(404, "Not found", "NOT_FOUND");
    }
    const { username, otp } = req.body as z.infer<typeof otpVerifySchema>;
    try {
      requireOtpIfEnabled(username, otp);
      return ok(res, true);
    } catch (err: any) {
      // Important UX: the frontend globally redirects to /login on any 401.
      // OTP verification failures should NOT log the user out, so map OTP auth errors to 400/429.
      const status = Number(err?.status ?? 500);
      const code = String(err?.code ?? "");
      if (code.startsWith("OTP_") && status === 401) {
        throw new HttpError(400, err?.message ?? "Invalid OTP", code);
      }
      throw err;
    }
  })
);

authRouter.post(
  "/login",
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const { username, password } = req.body as { username: string; password: string };

    // Prevent empty-password attempts in modes where it is never valid.
    // DB mode can allow empty password only when explicitly enabled.
    const passwordStr = String(password ?? "");
    const isPasswordBlank = passwordStr.trim().length === 0;
    if (
      isPasswordBlank &&
      !(env.nodeEnv !== "production" && env.auth.mode === "db" && env.auth.dbAllowPasswordlessLogin)
    ) {
      throw new HttpError(400, "Password is required", "PASSWORD_REQUIRED");
    }

    // Used only as a safe fallback when the DB returns zero permissions for a non-admin.
    const limitedPermissionsFallback = new Set<string>([
      "servers.read",
      "teams.read",
      "locations.read",
      "racks.read",
      "maintenance.read",
      "security.read",
      "audit.read",
      "applications.read",
      "visits.read",
      "incidents.create"
    ]);

    // Local auth mode (Admin + User) for development
    if (env.nodeEnv !== "production" && env.auth.mode === "local") {
      const uRaw = String(username ?? "").trim();
      const p = passwordStr;

      const norm = (v: string) => v.trim().toLowerCase();
      const u = norm(uRaw);

      const adminU = env.auth.local.adminUsername;
      const adminP = env.auth.local.adminPassword;
      const ictU = env.auth.local.ictUsername;
      const ictP = env.auth.local.ictPassword;

      // If we're in admin-only mode, ICT credentials are optional.
      if (!adminU || !adminP || (!env.auth.adminOnly && (!ictU || !ictP))) {
        throw new HttpError(
          500,
          "Local auth is enabled but credentials are not configured",
          "LOCAL_AUTH_NOT_CONFIGURED"
        );
      }

      const adminUsernames = [adminU, `${adminU}@local.dev`].map((x) => norm(String(x ?? "")));
      const ictUsernames = ictU ? [ictU, `${ictU}@local.dev`].map((x) => norm(String(x ?? ""))) : [];

      const isAdminUser = adminUsernames.includes(u) && String(adminP) === p;
      const isIctUser = ictUsernames.includes(u) && String(ictP ?? "") === p;

      if (!isAdminUser && !isIctUser) {
        throw new HttpError(401, "Invalid credentials", "INVALID_CREDENTIALS");
      }

      const email = uRaw.includes("@") ? norm(uRaw) : `${u}@local.dev`;
      const fullName = isAdminUser ? "Local Admin" : "Local ICT";
      const roles = [isAdminUser ? "Admin" : "ICT"];

      if (env.auth.adminOnly && !isAdminUserContext(email, roles)) {
        throw new HttpError(403, "Admin only", "ADMIN_ONLY");
      }

      // Admin is allowed universally by middleware; User uses explicit permissions.
      const permissions = isAdminUser ? ([] as string[]) : Array.from(limitedPermissionsFallback);

      const token = jwt.sign({ email, fullName, roles, permissions }, env.auth.jwtSecret, { expiresIn: "8h" });

      res.cookie(env.auth.cookieName, token, {
        httpOnly: true,
        secure: env.auth.cookieSecure,
        sameSite: "lax"
      });

      return ok(res, { email, fullName, roles, permissions });
    }

    // Database auth mode (dev/testing)
    // - Validates user exists in dbo.Users
    // - If a password is present in the row, it must match the provided password
    // - If password is NULL/empty, login can be allowed only when DB_ALLOW_PASSWORDLESS_LOGIN=true
    // - Roles/permissions are still loaded from dbo.sp_get_user_permissions
    if (env.nodeEnv !== "production" && env.auth.mode === "db") {
      const identifierRaw = String(username ?? "").trim();
      const identifier = identifierRaw.toLowerCase();
      const isEmail = identifier.includes("@");

      // Our permissions proc keys users by email (dbo.users.email). Keep DB login consistent.
      // If you want username-based login, add a stable username column and update the proc.
      if (!isEmail) {
        throw new HttpError(400, "Username must be an email address", "INVALID_USERNAME");
      }

      let rows = await query<any>(
        "SELECT TOP (1) * FROM dbo.Users WHERE LOWER(email) = @email",
        (r) => r.input("email", sql.VarChar, identifier)
      );

      let userRow = rows[0];
      if (!userRow) {
        // Dev convenience: auto-create the user row (mirrors company auth upsert behavior).
        try {
          await execProc("dbo.sp_upsert_user_from_login", (r) => {
            r.input("email", identifier);
            r.input("full_name", null);
          });
          rows = await query<any>(
            "SELECT TOP (1) * FROM dbo.Users WHERE LOWER(email) = @email",
            (r) => r.input("email", sql.VarChar, identifier)
          );
          userRow = rows[0];
        } catch {
          // ignore; will throw the USER_NOT_FOUND error below
        }
      }

      if (!userRow) {
        throw new HttpError(401, "User not found in dbo.Users for the provided email", "USER_NOT_FOUND");
      }

      const getStr = (obj: any, keys: string[]): string | undefined => {
        for (const k of keys) {
          const v = obj?.[k];
          if (v === null || v === undefined) continue;
          const s = String(v).trim();
          if (s) return s;
        }
        return undefined;
      };

      const getBool = (obj: any, keys: string[], fallback: boolean): boolean => {
        for (const k of keys) {
          const v = obj?.[k];
          if (v === null || v === undefined) continue;
          if (typeof v === "boolean") return v;
          if (typeof v === "number") return v !== 0;
          const s = String(v).trim().toLowerCase();
          if (["true", "1", "yes", "y"].includes(s)) return true;
          if (["false", "0", "no", "n"].includes(s)) return false;
        }
        return fallback;
      };

      const isActive = getBool(userRow, ["is_active", "isActive", "active", "Active", "enabled", "Enabled"], true);
      if (!isActive) throw new HttpError(403, "User is disabled", "USER_DISABLED");

      const dbEmailRaw = getStr(userRow, ["email", "Email"]) ?? (isEmail ? identifierRaw : undefined);
      const dbEmail = String(dbEmailRaw ?? "").trim();
      const dbEmailLower = dbEmail.toLowerCase();

      if (!dbEmail || !dbEmail.includes("@")) {
        throw new HttpError(
          400,
          "User record is missing a valid email (dbo.Users.email). This is required for permissions lookup.",
          "MISSING_EMAIL"
        );
      }
      const fullName = getStr(userRow, ["full_name", "fullName", "FullName", "name", "Name"]);

      const dbPassword = getStr(userRow, ["password", "Password"]);
      const providedPassword = passwordStr;

      // Security rule:
      // - If a password exists in DB, it must match exactly.
      // - If no password exists in DB, only allow login when passwordless mode is explicitly enabled
      //   AND the user provided an empty password. This prevents "wrong password" logins.
      if (dbPassword) {
        if (dbPassword !== providedPassword) {
          throw new HttpError(
            401,
            "Invalid credentials (password mismatch)",
            "INVALID_CREDENTIALS"
          );
        }
      } else {
        if (!env.auth.dbAllowPasswordlessLogin || !isPasswordBlank) {
          throw new HttpError(
            401,
            "Invalid credentials (user has no password set; use blank password or set one in dbo.Users)",
            "INVALID_CREDENTIALS"
          );
        }
      }


      let roles: string[] = [];
      let permissions: string[] = [];
      try {
        const permResult = await execProc<any>("dbo.sp_get_user_permissions", (r) => {
          // Use original casing from the DB/email input; some DBs use case-sensitive collation.
          r.input("email", dbEmail);
        });
        const recordsets = permResult.recordsets as any[];
        const toCanonicalRole = (role: unknown) => {
          const r = String(role ?? "").trim();
          const v = r.toLowerCase();
          if (v === "admin") return "Admin";
          if (v === "administrator") return "Admin";
          if (v === "user") return "User";
          if (v === "ict") return "ICT";
          return r;
        };

        roles = (recordsets[0] ?? []).map((x: any) => toCanonicalRole(x.role_name)).filter(Boolean);
        permissions = (recordsets[1] ?? []).map((x: any) => String(x.permission_key));
      } catch {
        throw new HttpError(
          500,
          "Failed to load roles/permissions (missing dbo.sp_get_user_permissions?)",
          "PERMISSIONS_LOAD_FAILED"
        );
      }

      const emailLower = dbEmailLower;
      const isAdminOverride = env.auth.adminEmails.includes(emailLower);

      // Dev convenience: if ADMIN_EMAILS contains the email, treat user as Admin.
      if (isAdminOverride && !roles.some((r) => String(r).trim().toLowerCase() === "admin")) {
        roles = [...roles, "Admin"];
      }

      // Dev convenience: if the permissions stored procedure returns no rows,
      // fall back to a minimal, safe set so dev accounts can still use the app.
      if (roles.length === 0) {
        const localPart = emailLower.split("@")[0] ?? "";
        roles = [localPart.startsWith("ict") ? "ICT" : "User"];
      }
      const isAdmin = roles.some((r) => String(r ?? "").trim().toLowerCase() === "admin");
      if (!isAdmin && permissions.length === 0) {
        // If the permissions proc returns nothing, fall back to a minimal safe set.
        permissions = Array.from(limitedPermissionsFallback);
      }

      const allowed = roles.some((r) => {
        const v = String(r ?? "").trim().toLowerCase();
        return v === "admin" || v === "administrator" || v === "user" || v === "ict";
      });
      if (!allowed) throw new HttpError(403, "User has no allowed role", "ROLE_NOT_ALLOWED");

      if (env.auth.adminOnly && !isAdminUserContext(dbEmail, roles)) {
        throw new HttpError(403, "Admin only", "ADMIN_ONLY");
      }

      const token = jwt.sign({ email: dbEmailLower, fullName, roles, permissions }, env.auth.jwtSecret, { expiresIn: "8h" });
      res.cookie(env.auth.cookieName, token, {
        httpOnly: true,
        secure: env.auth.cookieSecure,
        sameSite: "lax"
      });

      await audit({
        actor: dbEmailLower,
        action: "LOGIN",
        entity: "auth",
        entityId: dbEmailLower,
        details: { provider: "db_users" }
      });

      return ok(res, { email: dbEmailLower, fullName, roles, permissions });
    }

    // 1) Company login
    let companyUser: any;
    try {
      const r = await axios.post(env.company.loginUrl, { username, password }, { timeout: 15000 });
      companyUser = r.data;
    } catch {
      throw new HttpError(401, "Company login failed", "COMPANY_LOGIN_FAILED");
    }

    // 2) Extract identity
    const email = String(companyUser?.email ?? username).trim().toLowerCase();
    const fullName = String(companyUser?.name ?? companyUser?.full_name ?? "").trim() || undefined;

    if (!email) throw new HttpError(401, "Missing user identity", "IDENTITY_MISSING");

    // 3) Upsert user in our DB
    try {
      await execProc("dbo.sp_upsert_user_from_login", (r) => {
        r.input("email", email);
        r.input("full_name", fullName ?? null);
      });
    } catch {
      if (env.nodeEnv === "production") {
        throw new HttpError(
          500,
          "Failed to upsert user (missing dbo.sp_upsert_user_from_login?)",
          "USER_UPSERT_FAILED"
        );
      }
      // Dev fallback: allow login even if the proc isn't installed yet.
    }

    // 4) Load roles & permissions (2 recordsets)
    let roles: string[] = [];
    let permissions: string[] = [];
    try {
      const permResult = await execProc<any>("dbo.sp_get_user_permissions", (r) => {
        r.input("email", email);
      });

      const recordsets = permResult.recordsets as any[];
      roles = (recordsets[0] ?? []).map((x: any) => String(x.role_name));
      permissions = (recordsets[1] ?? []).map((x: any) => String(x.permission_key));
    } catch {
      if (env.nodeEnv === "production") {
        throw new HttpError(
          500,
          "Failed to load roles/permissions (missing dbo.sp_get_user_permissions?)",
          "PERMISSIONS_LOAD_FAILED"
        );
      }

      const isAdminUser = isAdminUserContext(email, []);
      roles = [isAdminUser ? "Admin" : "User"];
      permissions = isAdminUser ? ([] as string[]) : Array.from(limitedPermissionsFallback);
    }

    // V1 rule: only Admin/User/ICT are allowed (Administrator is accepted as Admin)
    const allowed = roles.some((r: unknown) => {
      const v = String(r ?? "").trim().toLowerCase();
      return v === "admin" || v === "administrator" || v === "user" || v === "ict";
    });
    if (!allowed) throw new HttpError(403, "User has no allowed role", "ROLE_NOT_ALLOWED");

    const companyIsAdmin = roles.some((r: unknown) => {
      const v = String(r ?? "").trim().toLowerCase();
      return v === "admin" || v === "administrator";
    });
    const finalPermissions = permissions;
    // Note: For non-admin users, "limited access" should be controlled by the permissions
    // returned from dbo.sp_get_user_permissions (role_permissions table). We do not hard-filter
    // permission keys here, otherwise we can accidentally disable intended capabilities.

    if (env.auth.adminOnly && !isAdminUserContext(email, roles)) {
      throw new HttpError(403, "Admin only", "ADMIN_ONLY");
    }

    // 5) Create cookie JWT session
    const token = jwt.sign(
      { email, fullName, roles, permissions: finalPermissions },
      env.auth.jwtSecret,
      { expiresIn: "8h" }
    );

    res.cookie(env.auth.cookieName, token, {
      httpOnly: true,
      secure: env.auth.cookieSecure,
      sameSite: "lax"
    });

    await audit({
      actor: email,
      action: "LOGIN",
      entity: "auth",
      entityId: email,
      details: { provider: "company_login_api" }
    });

    return ok(res, { email, fullName, roles, permissions: finalPermissions });
  })
);

// Dev-only utility: set/update a DB user's password.
// Requires DEV_BOOTSTRAP_TOKEN to be set and passed via `x-bootstrap-token` header.
const devSetPasswordSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  fullName: z.string().optional()
});

authRouter.post(
  "/dev/set-password",
  validateBody(devSetPasswordSchema),
  asyncHandler(async (req, res) => {
    if (env.nodeEnv === "production") throw new HttpError(404, "Not found", "NOT_FOUND");
    if (env.auth.mode !== "db") throw new HttpError(400, "AUTH_MODE must be 'db'", "INVALID_AUTH_MODE");
    if (!env.auth.devBootstrapToken) throw new HttpError(404, "Not found", "NOT_FOUND");

    const token = String(req.headers["x-bootstrap-token"] ?? "");
    if (token !== env.auth.devBootstrapToken) throw new HttpError(403, "Forbidden", "FORBIDDEN");

    const body = req.body as z.infer<typeof devSetPasswordSchema>;
    const email = body.email.trim().toLowerCase();
    const fullName = body.fullName?.trim() || undefined;

    // Ensure user exists
    await execProc("dbo.sp_upsert_user_from_login", (r) => {
      r.input("email", email);
      r.input("full_name", fullName ?? null);
    });

    // Update password. Also try to activate account if the column exists.
    try {
      await query(
        "UPDATE dbo.Users SET password = @password, is_active = 1 WHERE LOWER(email) = @email",
        (r) => {
          r.input("email", sql.VarChar, email);
          r.input("password", sql.VarChar, body.password);
        }
      );
    } catch {
      await query(
        "UPDATE dbo.Users SET password = @password WHERE LOWER(email) = @email",
        (r) => {
          r.input("email", sql.VarChar, email);
          r.input("password", sql.VarChar, body.password);
        }
      );
    }

    await audit({
      actor: email,
      action: "UPDATE",
      entity: "Users",
      entityId: email,
      details: { setPassword: true }
    });

    return ok(res, true);
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
  requireAuth,
  asyncHandler(async (req, res) => {
    const actor = req.user?.email ?? "unknown";
    res.clearCookie(env.auth.cookieName);
    await audit({ actor, action: "LOGOUT", entity: "auth", entityId: actor });
    return ok(res, true);
  })
);

-- END LEGACY --
*/
