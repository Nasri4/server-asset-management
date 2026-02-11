import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../utils/asyncHandler";
import { requirePermission } from "../middleware/permissions";
import { validateBody } from "../middleware/validate";
import { query } from "../db/sql";
import { created, ok } from "../utils/response";
import { audit } from "../utils/audit";
import { HttpError } from "../middleware/error";

export const locationsRouter = Router();

locationsRouter.get(
  "/",
  requirePermission("locations.read"),
  asyncHandler(async (_req, res) => {
    const rows = await query(`SELECT TOP 500 * FROM dbo.locations ORDER BY location_id DESC`);
    return ok(res, rows);
  })
);

const createSchema = z.object({
  site_name: z.string().trim().min(1),
  country: z.string().trim().optional(),
  city: z.string().trim().optional(),
  address: z.string().trim().optional(),
  site_type: z.enum(['Data Center', 'Edge', 'Office', 'Outdoor']).optional(),
  power_source: z.enum(['Grid', 'UPS', 'Generator', 'Solar', 'Hybrid']).optional(),
  cooling_type: z.enum(['HVAC', 'Airflow', 'Liquid', 'None']).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional()
});

/**
 * POST /api/locations
 * Permission: locations.manage
 */
locationsRouter.post(
  "/",
  requirePermission("locations.manage"),
  validateBody(createSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof createSchema>;

    const siteName = String(body.site_name ?? "").trim();
    const existing = await query<{ location_id: number }>(
      `
      SELECT TOP (1) location_id
      FROM dbo.locations
      WHERE LTRIM(RTRIM(site_name)) = @site_name
      `,
      (r) => r.input("site_name", siteName)
    );

    if (existing[0]) {
      throw new HttpError(409, `Site name already exists: ${siteName}`, "SITE_NAME_ALREADY_EXISTS");
    }

    const rows = await query<{ location_id: number }>(
      `
      INSERT INTO dbo.locations (
        site_name, country, city, address, site_type, 
        power_source, cooling_type, latitude, longitude
      )
      OUTPUT INSERTED.location_id
      VALUES (
        @site_name, @country, @city, @address, @site_type,
        @power_source, @cooling_type, @latitude, @longitude
      )
      `,
      (r) => {
        r.input("site_name", siteName);
        r.input("country", body.country ?? null);
        r.input("city", body.city ?? null);
        r.input("address", body.address ?? null);
        r.input("site_type", body.site_type ?? null);
        r.input("power_source", body.power_source ?? null);
        r.input("cooling_type", body.cooling_type ?? null);
        r.input("latitude", body.latitude ?? null);
        r.input("longitude", body.longitude ?? null);
      }
    );

    const locationId = rows?.[0]?.location_id ?? null;

    await audit({
      actor: req.user!.username,
      action: "CREATE",
      entity: "locations",
      entityId: locationId,
      details: body
    });

    return created(res, { location_id: locationId });
  })
);

const updateSchema = z.object({
  site_name: z.string().trim().min(1).optional(),
  country: z.string().trim().optional(),
  city: z.string().trim().optional(),
  address: z.string().trim().optional(),
  site_type: z.enum(['Data Center', 'Edge', 'Office', 'Outdoor']).optional(),
  power_source: z.enum(['Grid', 'UPS', 'Generator', 'Solar', 'Hybrid']).optional(),
  cooling_type: z.enum(['HVAC', 'Airflow', 'Liquid', 'None']).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional()
});

/**
 * PATCH /api/locations/:id
 * Permission: locations.manage
 */
locationsRouter.patch(
  "/:id",
  requirePermission("locations.manage"),
  validateBody(updateSchema),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = req.body as z.infer<typeof updateSchema>;

    await query(
      `
      UPDATE dbo.locations
      SET
        site_name = COALESCE(@site_name, site_name),
        country = COALESCE(@country, country),
        city = COALESCE(@city, city),
        address = COALESCE(@address, address),
        site_type = COALESCE(@site_type, site_type),
        power_source = COALESCE(@power_source, power_source),
        cooling_type = COALESCE(@cooling_type, cooling_type),
        latitude = COALESCE(@latitude, latitude),
        longitude = COALESCE(@longitude, longitude),
        updated_at = GETDATE()
      WHERE location_id = @id
      `,
      (r) => {
        r.input("id", id);
        r.input("site_name", body.site_name ?? null);
        r.input("country", body.country ?? null);
        r.input("city", body.city ?? null);
        r.input("address", body.address ?? null);
        r.input("site_type", body.site_type ?? null);
        r.input("power_source", body.power_source ?? null);
        r.input("cooling_type", body.cooling_type ?? null);
        r.input("latitude", body.latitude ?? null);
        r.input("longitude", body.longitude ?? null);
      }
    );

    await audit({
      actor: req.user!.username,
      action: "UPDATE",
      entity: "locations",
      entityId: id,
      details: body
    });

    return ok(res, true);
  })
);

/**
 * DELETE /api/locations/:id
 * Permission: locations.manage
 */
locationsRouter.delete(
  "/:id",
  requirePermission("locations.manage"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);

    await query(`DELETE FROM dbo.locations WHERE location_id = @id`, (r) => r.input("id", id));

    await audit({
      actor: req.user!.username,
      action: "DELETE",
      entity: "locations",
      entityId: id
    });

    return ok(res, true);
  })
);
