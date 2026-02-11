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

export const teamsRouter = Router();

teamsRouter.get(
  "/",
  requirePermission("teams.read"),
  asyncHandler(async (req, res) => {
    const teamId = scopedTeamId(req);
    const rows = await query(
      `
      SELECT 
        t.*,
        (SELECT COUNT(*) FROM dbo.engineers e WHERE e.team_id = t.team_id) AS engineer_count
      FROM dbo.teams t
      WHERE (@team_id IS NULL OR t.team_id = @team_id)
      ORDER BY t.team_id DESC
      `,
      (r) => r.input("team_id", teamId)
    );
    return ok(res, rows);
  })
);

const createSchema = z.object({
  team_name: z.string().trim().min(1),
  department: z.enum(['ICT', 'NOC', 'ISP']).optional(),
  oncall_email: z.string().email().optional().or(z.literal('')),
  oncall_phone: z.string().trim().optional(),
  description: z.string().trim().optional()
});

/**
 * POST /api/teams
 * Permission: teams.manage
 */
teamsRouter.post(
  "/",
  requirePermission("teams.manage"),
  validateBody(createSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof createSchema>;

    const teamName = String(body.team_name ?? "").trim();
    const existing = await query<{ team_id: number }>(
      `
      SELECT TOP (1) team_id
      FROM dbo.teams
      WHERE LTRIM(RTRIM(team_name)) = @team_name
      `,
      (r) => r.input("team_name", teamName)
    );

    if (existing[0]) {
      throw new HttpError(409, `Team name already exists: ${teamName}`, "TEAM_NAME_ALREADY_EXISTS");
    }

    const rows = await query<{ team_id: number }>(
      `
      INSERT INTO dbo.teams (team_name, department, oncall_email, oncall_phone, description)
      OUTPUT INSERTED.team_id
      VALUES (@team_name, @department, @oncall_email, @oncall_phone, @description)
      `,
      (r) => {
        r.input("team_name", teamName);
        r.input("department", body.department ?? null);
        r.input("oncall_email", body.oncall_email || null);
        r.input("oncall_phone", body.oncall_phone ?? null);
        r.input("description", body.description ?? null);
      }
    );

    const teamId = rows?.[0]?.team_id ?? null;

    await audit({
      actor: req.user!.username,
      action: "CREATE",
      entity: "teams",
      entityId: teamId,
      details: body
    });

    return created(res, { team_id: teamId });
  })
);

const updateSchema = z.object({
  team_name: z.string().trim().min(1).optional(),
  department: z.enum(['ICT', 'NOC', 'ISP']).optional(),
  oncall_email: z.string().email().optional().or(z.literal('')),
  oncall_phone: z.string().trim().optional(),
  description: z.string().trim().optional()
});

/**
 * PATCH /api/teams/:id
 * Permission: teams.manage
 */
teamsRouter.patch(
  "/:id",
  requirePermission("teams.manage"),
  validateBody(updateSchema),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = req.body as z.infer<typeof updateSchema>;

    await query(
      `
      UPDATE dbo.teams
      SET
        team_name = COALESCE(@team_name, team_name),
        department = COALESCE(@department, department),
        oncall_email = COALESCE(@oncall_email, oncall_email),
        oncall_phone = COALESCE(@oncall_phone, oncall_phone),
        description = COALESCE(@description, description),
        updated_at = GETDATE()
      WHERE team_id = @id
      `,
      (r) => {
        r.input("id", id);
        r.input("team_name", body.team_name ?? null);
        r.input("department", body.department ?? null);
        r.input("oncall_email", body.oncall_email === '' ? null : body.oncall_email ?? null);
        r.input("oncall_phone", body.oncall_phone ?? null);
        r.input("description", body.description ?? null);
      }
    );

    await audit({
      actor: req.user!.username,
      action: "UPDATE",
      entity: "teams",
      entityId: id,
      details: body
    });

    return ok(res, true);
  })
);

/**
 * DELETE /api/teams/:id
 * Permission: teams.manage
 */
teamsRouter.delete(
  "/:id",
  requirePermission("teams.manage"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);

    await query(`DELETE FROM dbo.teams WHERE team_id = @id`, (r) => r.input("id", id));

    await audit({
      actor: req.user!.username,
      action: "DELETE",
      entity: "teams",
      entityId: id
    });

    return ok(res, true);
  })
);
