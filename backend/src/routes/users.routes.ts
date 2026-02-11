/**
 * USER MANAGEMENT ROUTES
 * Admin: Manage all users
 * TeamLead: Manage engineers in their team
 */

import type { Request } from "express";
import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcrypt";
import sql from "mssql";
import { asyncHandler } from "../utils/asyncHandler";
import { ok, created } from "../utils/response";
import { requireAuth } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import { validateBody } from "../middleware/validate";
import { query, withTransaction, queryTx } from "../db/sql";
import { audit } from "../utils/audit";
import { HttpError } from "../middleware/error";

export const usersRouter = Router();

const createUserSchema = z.object({
  username: z.string().min(3).max(100),
  email: z.string().email().optional(),
  password: z.string().min(6),
  full_name: z.string().min(1),
  role_id: z.number().int().positive(),
  team_id: z.number().int().positive().optional().nullable()
});

const updateUserSchema = z.object({
  email: z.string().email().optional(),
  full_name: z.string().min(1).optional(),
  role_id: z.number().int().positive().optional(),
  team_id: z.number().int().positive().optional().nullable(),
  is_active: z.boolean().optional()
});

/**
 * GET /api/users - List users (scoped)
 */
usersRouter.get(
  "/",
  requireAuth,
  requirePermission("teams.manage"),
  asyncHandler(async (req: Request, res) => {
    const roles = (req.user?.roles ?? []).map((r) => String(r).trim().toLowerCase());
    const isAdmin = roles.includes("admin") || roles.includes("administrator");
    const isTeamLead = roles.includes("teamlead") || roles.includes("team lead");
    const teamId = req.user?.teamId ?? null;

    const sqlText = `
      SELECT 
        u.user_id,
        u.username,
        u.email,
        u.full_name,
        u.role_id,
        r.role_name,
        u.team_id,
        t.team_name,
        u.is_active,
        u.created_at
      FROM dbo.Users u
      JOIN dbo.roles r ON u.role_id = r.role_id
      LEFT JOIN dbo.teams t ON u.team_id = t.team_id
      WHERE (
        @is_admin = 1
        OR (
          @is_teamlead = 1
          AND @team_id IS NOT NULL
          AND u.team_id = @team_id
          AND LOWER(r.role_name) = 'engineer'
        )
      )
      ORDER BY u.created_at DESC
    `;

    const users = await query(sqlText, (r) => {
      r.input("is_admin", sql.Int, isAdmin ? 1 : 0);
      r.input("is_teamlead", sql.Int, isTeamLead ? 1 : 0);
      r.input("team_id", sql.Int, teamId);
    });

    ok(res, { users });
  })
);

/**
 * GET /api/users/roles - Get available roles
 */
usersRouter.get(
  "/roles",
  requireAuth,
  requirePermission("teams.manage"),
  asyncHandler(async (_req: Request, res) => {
    const roles = await query("SELECT role_id, role_name, description FROM dbo.roles");
    
    ok(res, { roles });
  })
);

/**
 * POST /api/users - Create user
 */
usersRouter.post(
  "/",
  requireAuth,
  requirePermission("teams.manage"),
  validateBody(createUserSchema),
  asyncHandler(async (req: Request, res) => {
    const body = req.body as z.infer<typeof createUserSchema>;

    const roles = (req.user?.roles ?? []).map((r) => String(r).trim().toLowerCase());
    const isAdmin = roles.includes("admin") || roles.includes("administrator");
    const isTeamLead = roles.includes("teamlead") || roles.includes("team lead");
    const actorTeamId = req.user?.teamId ?? null;
    
    // Check if username exists
    const [existing] = await query<{ user_id: number }>(
      "SELECT user_id FROM dbo.Users WHERE username = @username",
      (r) => r.input("username", sql.VarChar, body.username)
    );
    
    if (existing) {
      throw new HttpError(400, "Username already exists", "USERNAME_EXISTS");
    }
    
    // Hash password
    const passwordHash = await bcrypt.hash(body.password, 10);

    // Normalize requested values based on actor role.
    // - Admin may create any role; team_id may be null.
    // - TeamLead may only create Engineers for their own team.
    let effectiveTeamId: number | null | undefined = body.team_id ?? null;
    if (isTeamLead) {
      if (!actorTeamId) throw new HttpError(400, "TeamLead must belong to a team", "TEAM_REQUIRED");
      effectiveTeamId = actorTeamId;
    }

    // Resolve role name for additional rules.
    const [roleRow] = await query<{ role_name: string }>(
      "SELECT role_name FROM dbo.roles WHERE role_id = @role_id",
      (r) => r.input("role_id", sql.Int, body.role_id)
    );
    const roleName = String(roleRow?.role_name ?? "").trim();
    const roleLower = roleName.toLowerCase();
    if (!roleName) throw new HttpError(400, "Invalid role", "INVALID_ROLE");

    if (isTeamLead && roleLower !== "engineer") {
      throw new HttpError(403, "TeamLead can only create Engineers", "ROLE_NOT_ALLOWED");
    }

    // Enforce team relation for engineers.
    if (roleLower === "engineer" && !effectiveTeamId) {
      throw new HttpError(400, "Engineer user must be assigned to a team", "TEAM_REQUIRED");
    }
    
    const userId = await withTransaction(async (tx) => {
      const [inserted] = await queryTx<{ user_id: number }>(
        tx,
        `
        INSERT INTO dbo.Users (
          username, email, password_hash, full_name, 
          role_id, team_id, is_active, created_at, updated_at
        )
        OUTPUT INSERTED.user_id
        VALUES (
          @username, @email, @password_hash, @full_name,
          @role_id, @team_id, 1, GETDATE(), GETDATE()
        )
        `,
        (r) => {
          r.input("username", sql.VarChar, body.username);
          r.input("email", sql.VarChar, body.email ?? null);
          r.input("password_hash", sql.VarChar, passwordHash);
          r.input("full_name", sql.VarChar, body.full_name);
          r.input("role_id", sql.Int, body.role_id);
          r.input("team_id", sql.Int, effectiveTeamId ?? null);
        }
      );
      
      const newUserId = inserted.user_id;
      
      // If creating Engineer, also create engineer profile
      if (roleLower === "engineer") {
        // Check if user_id column exists in engineers table
        const hasUserIdCol = await queryTx<{ has_col: number }>(
          tx,
          "SELECT CASE WHEN COL_LENGTH('dbo.engineers', 'user_id') IS NOT NULL THEN 1 ELSE 0 END AS has_col"
        );
        
        if (hasUserIdCol[0]?.has_col === 1) {
          await queryTx(
            tx,
            `
            INSERT INTO dbo.engineers (
              user_id, full_name, email, team_id, is_active, created_at, updated_at
            )
            VALUES (
              @user_id, @full_name, @email, @team_id, 1, GETDATE(), GETDATE()
            )
            `,
            (r) => {
              r.input("user_id", sql.Int, newUserId);
              r.input("full_name", sql.VarChar, body.full_name);
              r.input("email", sql.VarChar, body.email ?? null);
              r.input("team_id", sql.Int, effectiveTeamId ?? null);
            }
          );
        } else {
          // Legacy schema without user_id
          await queryTx(
            tx,
            `
            INSERT INTO dbo.engineers (
              full_name, email, team_id, is_active, created_at, updated_at
            )
            VALUES (
              @full_name, @email, @team_id, 1, GETDATE(), GETDATE()
            )
            `,
            (r) => {
              r.input("full_name", sql.VarChar, body.full_name);
              r.input("email", sql.VarChar, body.email ?? null);
              r.input("team_id", sql.Int, effectiveTeamId ?? null);
            }
          );
        }
      }
      
      await audit({
        actor: req.user?.username ?? "unknown",
        action: "CREATE",
        entity: "users",
        entityId: newUserId,
        details: { username: body.username, role_id: body.role_id },
        tx
      });
      
      return newUserId;
    });
    
    created(res, { user_id: userId });
  })
);

/**
 * PATCH /api/users/:id - Update user
 */
usersRouter.patch(
  "/:id",
  requireAuth,
  requirePermission("teams.manage"),
  validateBody(updateUserSchema),
  asyncHandler(async (req: Request, res) => {
    const userId = parseInt(req.params.id);
    const body = req.body as z.infer<typeof updateUserSchema>;

    const actorRoles = (req.user?.roles ?? []).map((r) => String(r).trim().toLowerCase());
    const actorIsAdmin = actorRoles.includes("admin") || actorRoles.includes("administrator");
    const actorIsTeamLead = actorRoles.includes("teamlead") || actorRoles.includes("team lead");
    const actorTeamId = req.user?.teamId ?? null;
    
    // Get target user
    const [targetUser] = await query<{ team_id: number | null; role_name: string }>(
      `
      SELECT u.team_id, r.role_name
      FROM dbo.Users u
      JOIN dbo.roles r ON u.role_id = r.role_id
      WHERE u.user_id = @user_id
      `,
      (r) => r.input("user_id", userId)
    );
    
    if (!targetUser) {
      throw new HttpError(404, "User not found", "NOT_FOUND");
    }

    if (actorIsTeamLead && !actorIsAdmin) {
      if (!actorTeamId) throw new HttpError(400, "TeamLead must belong to a team", "TEAM_REQUIRED");
      const targetRoleLower = String(targetUser.role_name ?? "").trim().toLowerCase();
      if (targetUser.team_id !== actorTeamId || targetRoleLower !== "engineer") {
        throw new HttpError(403, "TeamLead can only manage Engineers in their own team", "TEAM_SCOPE_VIOLATION");
      }
      if (body.role_id !== undefined || body.team_id !== undefined) {
        throw new HttpError(403, "TeamLead cannot change user role/team", "USER_UPDATE_NOT_ALLOWED");
      }
    }
    
    await withTransaction(async (tx) => {
      const setParts: string[] = [];
      
      if (body.email !== undefined) setParts.push("email = @email");
      if (body.full_name !== undefined) setParts.push("full_name = @full_name");
      if (body.role_id !== undefined) setParts.push("role_id = @role_id");
      if (body.team_id !== undefined) setParts.push("team_id = @team_id");
      if (body.is_active !== undefined) setParts.push("is_active = @is_active");
      
      if (setParts.length > 0) {
        setParts.push("updated_at = GETDATE()");
        
        await queryTx(
          tx,
          `UPDATE dbo.Users SET ${setParts.join(", ")} WHERE user_id = @user_id`,
          (r) => {
            r.input("user_id", userId);
            r.input("email", body.email ?? null);
            r.input("full_name", body.full_name ?? null);
            r.input("role_id", body.role_id ?? null);
            r.input("team_id", body.team_id ?? null);
            r.input("is_active", body.is_active ?? null);
          }
        );
      }
      
      await audit({
        actor: req.user?.username ?? "unknown",
        action: "UPDATE",
        entity: "users",
        entityId: userId,
        details: body,
        tx
      });
    });
    
    ok(res, { success: true });
  })
);

/**
 * DELETE /api/users/:id - Delete user (Admin only)
 */
usersRouter.delete(
  "/:id",
  requireAuth,
  requirePermission("teams.manage"),
  asyncHandler(async (req: Request, res) => {
    const userId = parseInt(req.params.id);
    
    // Cannot delete yourself
    if (userId === req.user?.userId) {
      throw new HttpError(400, "Cannot delete yourself", "CANNOT_DELETE_SELF");
    }
    
    const actorRoles = (req.user?.roles ?? []).map((r) => String(r).trim().toLowerCase());
    const actorIsAdmin = actorRoles.includes("admin") || actorRoles.includes("administrator");
    const actorIsTeamLead = actorRoles.includes("teamlead") || actorRoles.includes("team lead");
    const actorTeamId = req.user?.teamId ?? null;

    if (actorIsTeamLead && !actorIsAdmin) {
      if (!actorTeamId) throw new HttpError(400, "TeamLead must belong to a team", "TEAM_REQUIRED");
      const [targetUser] = await query<{ team_id: number | null; role_name: string }>(
        `
        SELECT u.team_id, r.role_name
        FROM dbo.Users u
        JOIN dbo.roles r ON u.role_id = r.role_id
        WHERE u.user_id = @user_id
        `,
        (r) => r.input("user_id", userId)
      );
      if (!targetUser) throw new HttpError(404, "User not found", "NOT_FOUND");
      const targetRoleLower = String(targetUser.role_name ?? "").trim().toLowerCase();
      if (targetUser.team_id !== actorTeamId || targetRoleLower !== "engineer") {
        throw new HttpError(403, "TeamLead can only delete Engineers in their own team", "TEAM_SCOPE_VIOLATION");
      }
    }

    await withTransaction(async (tx) => {
      await queryTx(
        tx,
        "DELETE FROM dbo.Users WHERE user_id = @user_id",
        (r) => r.input("user_id", userId)
      );
      
      await audit({
        actor: req.user?.username ?? "unknown",
        action: "DELETE",
        entity: "users",
        entityId: userId,
        tx
      });
    });
    
    ok(res, { success: true });
  })
);

export default usersRouter;
