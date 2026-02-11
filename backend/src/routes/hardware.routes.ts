import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../utils/asyncHandler";
import { requirePermission } from "../middleware/permissions";
import { validateBody } from "../middleware/validate";
import { query, queryTx, withTransaction } from "../db/sql";
import { ok } from "../utils/response";
import { HttpError } from "../middleware/error";
import { scopedTeamId } from "../utils/teamScope";
import { writeAuditActivityAndEmit } from "../services/auditService";
import { diffFields, summarizeChangeMessage } from "../utils/fieldDiff";

export const hardwareRouter = Router();

async function assertServerVisible(serverId: number, teamId: number | null) {
  const rows = await query<{ server_id: number }>(
    `
    SELECT TOP (1) server_id
    FROM dbo.servers
    WHERE server_id = @server_id
      AND (@team_id IS NULL OR team_id = @team_id)
    `,
    (r) => {
      r.input("server_id", serverId);
      r.input("team_id", teamId);
    }
  );
  if (!rows[0]) throw new HttpError(404, "Server not found", "SERVER_NOT_FOUND");
}

/**
 * GET /api/hardware?server_id=
 * Permission: hardware.read
 */
hardwareRouter.get(
  "/",
  requirePermission("hardware.read"),
  asyncHandler(async (req, res) => {
    const serverId = req.query.server_id ? Number(req.query.server_id) : null;
    const teamId = scopedTeamId(req);

    const rows = await query(
      `
      SELECT TOP 500
        h.*, 
        s.server_code,
        s.hostname
      FROM dbo.server_hardware h
      LEFT JOIN dbo.servers s ON s.server_id = h.server_id
      WHERE (@team_id IS NULL OR s.team_id = @team_id)
        AND (@server_id IS NULL OR h.server_id = @server_id)
      ORDER BY h.server_id DESC
      `,
      (r) => {
        r.input("server_id", serverId);
        r.input("team_id", teamId);
      }
    );

    return ok(res, rows);
  })
);

/**
 * GET /api/hardware/server/:serverId
 */
hardwareRouter.get(
  "/server/:serverId",
  requirePermission("hardware.read"),
  asyncHandler(async (req, res) => {
    const serverId = Number(req.params.serverId);
    const teamId = scopedTeamId(req);
    await assertServerVisible(serverId, teamId);

    const rows = await query(
      `SELECT TOP 1 * FROM dbo.server_hardware WHERE server_id = @server_id`,
      (r) => r.input("server_id", serverId)
    );

    return ok(res, rows[0] ?? null);
  })
);

const schema = z.object({
  server_id: z.number().int().positive(),
  vendor: z.string().trim().min(1),
  model: z.string().trim().min(1),
  serial_number: z.string().trim().min(1),
  cpu_model: z.string().trim().min(1),
  cpu_cores: z.number().int().positive(),
  ram_gb: z.number().int().positive(),
  storage_tb: z.number().positive(),
  raid_level: z.string().trim().optional().nullable(),
  nic_count: z.number().int().positive().optional().nullable(),
  power_supply: z.string().trim().optional().nullable(),
  warranty_expiry: z.string().optional().nullable() // ISO date string
});

const updateSchema = schema.omit({ server_id: true });

hardwareRouter.post(
  "/",
  requirePermission("hardware.upsert"),
  validateBody(schema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof schema>;
    const teamId = scopedTeamId(req);
    await assertServerVisible(body.server_id, teamId);

    const existing = await query<{ has_row: number }>(
      `SELECT TOP (1) 1 as has_row FROM dbo.server_hardware WHERE server_id = @server_id`,
      (r) => r.input("server_id", body.server_id)
    );

    if (existing[0]) {
      throw new HttpError(409, "This server already has hardware. Use Edit to update it.", "HARDWARE_ALREADY_EXISTS");
    }

    await withTransaction(async (tx) => {
      await queryTx(
        tx,
        `
        INSERT INTO dbo.server_hardware
          (server_id, vendor, model, serial_number, cpu_model, cpu_cores, ram_gb, storage_tb, 
           raid_level, nic_count, power_supply, warranty_expiry, created_at, updated_at)
        VALUES
          (@server_id, @vendor, @model, @serial_number, @cpu_model, @cpu_cores, @ram_gb, @storage_tb,
           @raid_level, @nic_count, @power_supply, @warranty_expiry, GETDATE(), GETDATE())
        `,
        (r) => {
          r.input("server_id", body.server_id);
          r.input("vendor", body.vendor);
          r.input("model", body.model);
          r.input("serial_number", body.serial_number);
          r.input("cpu_model", body.cpu_model);
          r.input("cpu_cores", body.cpu_cores);
          r.input("ram_gb", body.ram_gb);
          r.input("storage_tb", body.storage_tb);
          r.input("raid_level", body.raid_level ?? null);
          r.input("nic_count", body.nic_count ?? null);
          r.input("power_supply", body.power_supply ?? null);
          r.input("warranty_expiry", body.warranty_expiry ?? null);
        }
      );

      const afterRows = await queryTx<any>(
        tx,
        `SELECT TOP (1) * FROM dbo.server_hardware WHERE server_id = @server_id`,
        (r) => r.input("server_id", body.server_id)
      );
      const after = afterRows[0] ?? null;

      const changes = diffFields(null, after, [
        "vendor",
        "model",
        "serial_number",
        "cpu_model",
        "cpu_cores",
        "ram_gb",
        "storage_tb",
        "raid_level",
        "nic_count",
        "power_supply",
        "warranty_expiry"
      ]);

      await writeAuditActivityAndEmit({
        tx,
        actorUserId: req.user!.userId,
        teamId: req.user!.teamId,
        action: "CREATE",
        entityType: "ServerHardware",
        entityId: body.server_id,
        before: null,
        after,
        activityMessage: summarizeChangeMessage("Hardware created", changes),
        activityAction: "created",
        activityMeta: { changes },
        serverId: body.server_id,
        ipAddress: req.ip,
        userAgent: String(req.headers["user-agent"] ?? "") || null
      });
    });

    return ok(res, { created: true });
  })
);

/**
 * PATCH /api/hardware/server/:serverId
 * Permission: hardware.upsert
 */
hardwareRouter.patch(
  "/server/:serverId",
  requirePermission("hardware.upsert"),
  validateBody(updateSchema),
  asyncHandler(async (req, res) => {
    const serverId = Number(req.params.serverId);
    const body = req.body as z.infer<typeof updateSchema>;
    const teamId = scopedTeamId(req);
    await assertServerVisible(serverId, teamId);

    const existing = await query<{ has_row: number }>(
      `SELECT TOP (1) 1 as has_row FROM dbo.server_hardware WHERE server_id = @server_id`,
      (r) => r.input("server_id", serverId)
    );

    if (!existing[0]) {
      throw new HttpError(404, "Hardware not found for this server.", "HARDWARE_NOT_FOUND");
    }

    await withTransaction(async (tx) => {
      const beforeRows = await queryTx<any>(
        tx,
        `SELECT TOP (1) * FROM dbo.server_hardware WHERE server_id = @server_id`,
        (r) => r.input("server_id", serverId)
      );
      const before = beforeRows[0] ?? null;

      await queryTx(
        tx,
        `
        UPDATE dbo.server_hardware
        SET
          vendor = @vendor,
          model = @model,
          serial_number = @serial_number,
          cpu_model = @cpu_model,
          cpu_cores = @cpu_cores,
          ram_gb = @ram_gb,
          storage_tb = @storage_tb,
          raid_level = @raid_level,
          nic_count = @nic_count,
          power_supply = @power_supply,
          warranty_expiry = @warranty_expiry,
          updated_at = GETDATE()
        WHERE server_id = @server_id
        `,
        (r) => {
          r.input("server_id", serverId);
          r.input("vendor", body.vendor);
          r.input("model", body.model);
          r.input("serial_number", body.serial_number);
          r.input("cpu_model", body.cpu_model);
          r.input("cpu_cores", body.cpu_cores);
          r.input("ram_gb", body.ram_gb);
          r.input("storage_tb", body.storage_tb);
          r.input("raid_level", body.raid_level ?? null);
          r.input("nic_count", body.nic_count ?? null);
          r.input("power_supply", body.power_supply ?? null);
          r.input("warranty_expiry", body.warranty_expiry ?? null);
        }
      );

      const afterRows = await queryTx<any>(
        tx,
        `SELECT TOP (1) * FROM dbo.server_hardware WHERE server_id = @server_id`,
        (r) => r.input("server_id", serverId)
      );
      const after = afterRows[0] ?? null;

      const changes = diffFields(before, after, [
        "vendor",
        "model",
        "serial_number",
        "cpu_model",
        "cpu_cores",
        "ram_gb",
        "storage_tb",
        "raid_level",
        "nic_count",
        "power_supply",
        "warranty_expiry"
      ]);

      await writeAuditActivityAndEmit({
        tx,
        actorUserId: req.user!.userId,
        teamId: req.user!.teamId,
        action: "UPDATE",
        entityType: "ServerHardware",
        entityId: serverId,
        before,
        after,
        activityMessage: summarizeChangeMessage("Hardware updated", changes),
        activityAction: "updated",
        activityMeta: { changes },
        serverId,
        ipAddress: req.ip,
        userAgent: String(req.headers["user-agent"] ?? "") || null
      });
    });

    return ok(res, true);
  })
);

/**
 * DELETE /api/hardware/server/:serverId
 * Permission: hardware.upsert
 */
hardwareRouter.delete(
  "/server/:serverId",
  requirePermission("hardware.upsert"),
  asyncHandler(async (req, res) => {
    const serverId = Number(req.params.serverId);
    const teamId = scopedTeamId(req);
    await assertServerVisible(serverId, teamId);

    await withTransaction(async (tx) => {
      const beforeRows = await queryTx<any>(
        tx,
        `SELECT TOP (1) * FROM dbo.server_hardware WHERE server_id = @server_id`,
        (r) => r.input("server_id", serverId)
      );
      const before = beforeRows[0] ?? null;

      await queryTx(
        tx,
        `DELETE FROM dbo.server_hardware WHERE server_id = @server_id`,
        (r) => r.input("server_id", serverId)
      );

      const changes = diffFields(before, null, [
        "vendor",
        "model",
        "serial_number",
        "cpu_model",
        "cpu_cores",
        "ram_gb",
        "storage_tb",
        "raid_level",
        "nic_count",
        "power_supply",
        "warranty_expiry"
      ]);

      await writeAuditActivityAndEmit({
        tx,
        actorUserId: req.user!.userId,
        teamId: req.user!.teamId,
        action: "DELETE",
        entityType: "ServerHardware",
        entityId: serverId,
        before,
        after: null,
        activityMessage: "Hardware deleted",
        activityAction: "deleted",
        activityMeta: { changes },
        serverId,
        ipAddress: req.ip,
        userAgent: String(req.headers["user-agent"] ?? "") || null
      });
    });

    return ok(res, true);
  })
);
