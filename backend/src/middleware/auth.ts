import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { HttpError } from "./error";
import { loadUserRBAC, type RBACUser } from "./rbac";

// NOTE: This is the canonical request user type used across routes.
// JWT is used only to carry the subject (userId). All RBAC info is reloaded
// from the database on each request to avoid stale/forged permissions.
export type SessionUser = RBACUser & {
  roles: string[];
  permissions: string[];
  teamId: number | null;
};

declare global {
  namespace Express {
    interface Request {
      user?: SessionUser;
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const authHeader = String(req.headers.authorization ?? "").trim();
  const bearer = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
  const cookieToken = req.cookies?.[env.auth.cookieName];
  const token = bearer || cookieToken;
  if (!token) throw new HttpError(401, "Not authenticated", "AUTH_REQUIRED");

  const fromCookie = !bearer && Boolean(cookieToken);

  (async () => {
    try {
      const payload = jwt.verify(token, env.auth.jwtSecret) as { userId?: number };
      const userId = Number(payload?.userId ?? NaN);
      if (!Number.isFinite(userId) || userId <= 0) {
        throw new HttpError(401, "Invalid session", "AUTH_INVALID");
      }

      const rbacUser = await loadUserRBAC(userId);
      if (!rbacUser) throw new HttpError(401, "Invalid session", "AUTH_INVALID");

      // Back-compat fields used by existing codepaths.
      const roles = [rbacUser.roleName];

      req.user = {
        ...rbacUser,
        roles,
        permissions: rbacUser.permissions,
        teamId: rbacUser.teamId
      } as SessionUser;

      next();
    } catch (e: any) {
      // If the cookie contains an invalid/old JWT (e.g. secret changed), clear it.
      // This prevents a hard redirect loop between /dashboard -> /login -> /dashboard.
      if (fromCookie) {
        _res.clearCookie(env.auth.cookieName, {
          httpOnly: true,
          secure: env.auth.cookieSecure,
          sameSite: "lax",
          path: "/"
        });
      }
      if (e instanceof HttpError) throw e;
      throw new HttpError(401, "Invalid session", "AUTH_INVALID");
    }
  })().catch(next);
}

export function isAdmin(user: SessionUser | undefined) {
  const roles = user?.roles ?? [];
  return roles.some((r) => String(r ?? "").trim().toLowerCase() === "admin");
}

// Alias for backward compatibility
export const authenticate = requireAuth;
