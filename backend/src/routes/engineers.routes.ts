import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../utils/asyncHandler";
import { requirePermission } from "../middleware/permissions";
import { validateBody } from "../middleware/validate";
import { query } from "../db/sql";
import { created, ok } from "../utils/response";
import { audit } from "../utils/audit";
import { HttpError } from "../middleware/error";
import { scopedTeamId } from "../utils/teamScope";
import { isAdmin } from "../middleware/auth";

export const engineersRouter = Router();

async function hasServersEngineerIdColumn() {
  const rows = await query<{ len: number | null }>(
    "SELECT COL_LENGTH('dbo.servers','engineer_id') AS len"
  );
  return rows?.[0]?.len != null;
}

engineersRouter.get(
  "/",
  requirePermission("teams.read"),
  asyncHandler(async (req, res) => {
    const scopeTeamId = scopedTeamId(req);
    const teamIdRaw = (req.query.team_id as string | undefined)?.trim();
    const requestedTeamId = teamIdRaw ? Number(teamIdRaw) : null;
    const teamId = isAdmin(req.user) ? requestedTeamId : scopeTeamId;

    const hasEngineer = await hasServersEngineerIdColumn();

    const serverFields = hasEngineer
      ? `
        (
          SELECT COUNT(1)
          FROM dbo.servers s
          WHERE s.engineer_id = e.engineer_id
        ) AS server_count,
        NULLIF(
          STUFF((
            SELECT ', ' + ISNULL(NULLIF(LTRIM(RTRIM(s.hostname)), ''), s.server_code)
            FROM dbo.servers s
            WHERE s.engineer_id = e.engineer_id
            ORDER BY s.hostname
            FOR XML PATH(''), TYPE
          ).value('.', 'nvarchar(max)'), 1, 2, ''),
          ''
        ) AS server_names,
      `
      : `
        CAST(0 AS int) AS server_count,
        CAST(NULL AS nvarchar(max)) AS server_names,
      `;

    const rows = await query(
      `
      SELECT TOP 1000
        e.engineer_id,
        e.full_name,
        e.phone,
        e.email,
        e.team_id,
        t.team_name,
        t.department,
        ${serverFields}
        e.is_active,
        e.created_at,
        e.updated_at
      FROM dbo.engineers e
      LEFT JOIN dbo.teams t ON t.team_id = e.team_id
      WHERE (@team_id IS NULL OR e.team_id = @team_id)
      ORDER BY e.engineer_id DESC
      `,
      (r) => r.input("team_id", teamId)
    );

    return ok(res, rows);
  })
);

const createSchema = z.object({
  full_name: z.string().trim().min(1),
  phone: z.string().trim().min(1).nullable().optional(),
  email: z.string().trim().min(1).nullable().optional(),
  team_id: z.number().int().positive(),
  is_active: z.boolean().optional()
});

/**
 * POST /api/engineers
 * Permission: engineers.manage
 */
engineersRouter.post(
  "/",
  requirePermission("teams.manage"),
  validateBody(createSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof createSchema>;
    const scopeTeamId = scopedTeamId(req);
    if (!isAdmin(req.user) && body.team_id !== scopeTeamId) {
      throw new HttpError(403, "TeamLead can only manage engineers in their own team", "TEAM_SCOPE_VIOLATION");
    }

    const fullName = String(body.full_name ?? "").trim();
    const phone = body.phone ? String(body.phone).trim() : null;
    const email = body.email ? String(body.email).trim() : null;

    if (email) {
      const existing = await query<{ engineer_id: number }>(
        `
        SELECT TOP (1) engineer_id
        FROM dbo.engineers
        WHERE LTRIM(RTRIM(email)) = @email
        `,
        (r) => r.input("email", email)
      );

      if (existing[0]) {
        throw new HttpError(409, `Engineer email already exists: ${email}`, "ENGINEER_EMAIL_ALREADY_EXISTS");
      }
    }

    const rows = await query<{ engineer_id: number }>(
      `
      INSERT INTO dbo.engineers (full_name, phone, email, team_id, is_active)
      OUTPUT INSERTED.engineer_id
      VALUES (@full_name, @phone, @email, @team_id, @is_active)
      `,
      (r) => {
        r.input("full_name", fullName);
        r.input("phone", phone);
        r.input("email", email);
        r.input("team_id", body.team_id);
        r.input("is_active", body.is_active ?? true);
      }
    );

    const engineerId = rows?.[0]?.engineer_id ?? null;

    await audit({
      actor: req.user!.username,
      action: "CREATE",
      entity: "engineers",
      entityId: engineerId,
      details: body
    });

    return created(res, { engineer_id: engineerId });
  })
);

const updateSchema = z.object({
  full_name: z.string().trim().min(1).optional(),
  phone: z.string().trim().min(1).nullable().optional(),
  email: z.string().trim().min(1).nullable().optional(),
  team_id: z.number().int().positive().optional(),
  is_active: z.boolean().optional()
});

/**
 * PATCH /api/engineers/:id
 * Permission: engineers.manage
 */
engineersRouter.patch(
  "/:id",
  requirePermission("teams.manage"),
  validateBody(updateSchema),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = req.body as z.infer<typeof updateSchema>;

    const scopeTeamId = scopedTeamId(req);
    const admin = isAdmin(req.user);

    const current = await query<{ team_id: number | null }>(
      `SELECT TOP (1) team_id FROM dbo.engineers WHERE engineer_id = @id`,
      (r) => r.input("id", id)
    );
    if (!current[0]) {
      throw new HttpError(404, "Engineer not found", "ENGINEER_NOT_FOUND");
    }
    if (!admin && current[0].team_id !== scopeTeamId) {
      throw new HttpError(403, "TeamLead can only manage engineers in their own team", "TEAM_SCOPE_VIOLATION");
    }
    if (!admin && body.team_id !== undefined && body.team_id !== scopeTeamId) {
      throw new HttpError(403, "TeamLead cannot move engineers to another team", "TEAM_SCOPE_VIOLATION");
    }

    const email = body.email != null ? String(body.email ?? "").trim() : undefined;
    if (email) {
      const existing = await query<{ engineer_id: number }>(
        `
        SELECT TOP (1) engineer_id
        FROM dbo.engineers
        WHERE LTRIM(RTRIM(email)) = @email
          AND engineer_id <> @id
        `,
        (r) => {
          r.input("email", email);
          r.input("id", id);
        }
      );

      if (existing[0]) {
        throw new HttpError(409, `Engineer email already exists: ${email}`, "ENGINEER_EMAIL_ALREADY_EXISTS");
      }
    }

    await query(
      `
      UPDATE dbo.engineers
      SET
        full_name = COALESCE(@full_name, full_name),
        phone = COALESCE(@phone, phone),
        email = COALESCE(@email, email),
        team_id = COALESCE(@team_id, team_id),
        is_active = COALESCE(@is_active, is_active),
        updated_at = GETDATE()
      WHERE engineer_id = @id
      `,
      (r) => {
        r.input("id", id);
        r.input("full_name", body.full_name ?? null);
        r.input("phone", body.phone ?? null);
        r.input("email", body.email ?? null);
        r.input("team_id", body.team_id ?? null);
        r.input("is_active", body.is_active ?? null);
      }
    );

    await audit({
      actor: req.user!.username,
      action: "UPDATE",
      entity: "engineers",
      entityId: id,
      details: body
    });

    return ok(res, true);
  })
);

/**
 * DELETE /api/engineers/:id
 * Permission: engineers.manage
 */
engineersRouter.delete(
  "/:id",
  requirePermission("teams.manage"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);

    const scopeTeamId = scopedTeamId(req);
    const admin = isAdmin(req.user);

    const current = await query<{ team_id: number | null }>(
      `SELECT TOP (1) team_id FROM dbo.engineers WHERE engineer_id = @id`,
      (r) => r.input("id", id)
    );
    if (!current[0]) {
      throw new HttpError(404, "Engineer not found", "ENGINEER_NOT_FOUND");
    }
    if (!admin && current[0].team_id !== scopeTeamId) {
      throw new HttpError(403, "TeamLead can only manage engineers in their own team", "TEAM_SCOPE_VIOLATION");
    }

    await query(`DELETE FROM dbo.engineers WHERE engineer_id = @id`, (r) => r.input("id", id));

    await audit({
      actor: req.user!.username,
      action: "DELETE",
      entity: "engineers",
      entityId: id
    });

    return ok(res, true);
  })
);
