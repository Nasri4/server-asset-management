import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../utils/asyncHandler";
import { requirePermission } from "../middleware/permissions";
import { validateBody } from "../middleware/validate";
import { query } from "../db/sql";
import { created, ok } from "../utils/response";
import { audit } from "../utils/audit";
import { HttpError } from "../middleware/error";

export const racksRouter = Router();

racksRouter.get(
  "/",
  requirePermission("racks.read"),
  asyncHandler(async (_req, res) => {
    const rows = await query(`
      SELECT 
        r.rack_id,
        r.rack_code,
        r.location_id,
        r.total_u,
        r.created_at,
        r.updated_at,
        l.site_name
      FROM dbo.racks r
      LEFT JOIN dbo.locations l ON l.location_id = r.location_id
      ORDER BY r.rack_id DESC
    `);
    return ok(res, rows);
  })
);

const createSchema = z.object({
  rack_code: z.string().trim().min(1),
  location_id: z.number().int().positive()
});

/**
 * POST /api/racks
 * Permission: racks.manage
 */
racksRouter.post(
  "/",
  requirePermission("racks.manage"),
  validateBody(createSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof createSchema>;

    const rackCode = String(body.rack_code ?? "").trim();

    // Treat rack_code as globally unique (matches most deployments).
    // If you want uniqueness per-location instead, add `AND location_id = @location_id`.
    const existing = await query<{ rack_id: number }>(
      `
      SELECT TOP (1) rack_id
      FROM dbo.racks
      WHERE LTRIM(RTRIM(rack_code)) = @rack_code
      `,
      (r) => r.input("rack_code", rackCode)
    );

    if (existing[0]) {
      throw new HttpError(409, `Rack code already exists: ${rackCode}`, "RACK_CODE_ALREADY_EXISTS");
    }

    const rows = await query<{ rack_id: number }>(
      `
      INSERT INTO dbo.racks (rack_code, location_id)
      OUTPUT INSERTED.rack_id
      VALUES (@rack_code, @location_id)
      `,
      (r) => {
        r.input("rack_code", rackCode);
        r.input("location_id", body.location_id);
      }
    );

    const rackId = rows?.[0]?.rack_id ?? null;

    await audit({
      actor: req.user!.username,
      action: "CREATE",
      entity: "racks",
      entityId: rackId,
      details: body
    });

    return created(res, { rack_id: rackId });
  })
);

const updateSchema = z.object({
  rack_code: z.string().trim().min(1).optional(),
  location_id: z.number().int().nullable().optional()
});

/**
 * PATCH /api/racks/:id
 * Permission: racks.manage
 */
racksRouter.patch(
  "/:id",
  requirePermission("racks.manage"),
  validateBody(updateSchema),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = req.body as z.infer<typeof updateSchema>;

    await query(
      `
      UPDATE dbo.racks
      SET
        rack_code = COALESCE(@rack_code, rack_code),
        location_id = COALESCE(@location_id, location_id),
        updated_at = GETDATE()
      WHERE rack_id = @id
      `,
      (r) => {
        r.input("id", id);
        r.input("rack_code", body.rack_code ?? null);
        r.input("location_id", body.location_id ?? null);
      }
    );

    await audit({
      actor: req.user!.username,
      action: "UPDATE",
      entity: "racks",
      entityId: id,
      details: body
    });

    return ok(res, true);
  })
);

/**
 * DELETE /api/racks/:id
 * Permission: racks.manage
 */
racksRouter.delete(
  "/:id",
  requirePermission("racks.manage"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);

    await query(`DELETE FROM dbo.racks WHERE rack_id = @id`, (r) => r.input("id", id));

    await audit({
      actor: req.user!.username,
      action: "DELETE",
      entity: "racks",
      entityId: id
    });

    return ok(res, true);
  })
);
