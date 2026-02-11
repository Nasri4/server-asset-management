import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../utils/asyncHandler";
import { requirePermission } from "../middleware/permissions";
import { validateBody } from "../middleware/validate";
import { query, queryTx, withTransaction } from "../db/sql";
import { ok } from "../utils/response";
import { HttpError } from "../middleware/error";
import { writeAuditActivityAndEmit } from "../services/auditService";
import { diffFields, summarizeChangeMessage } from "../utils/fieldDiff";

export const securityRouter = Router();

/**
 * GET /api/security
 * Optional: ?server_id=
 * Permission: security.read
 */
securityRouter.get(
  "/",
  requirePermission("security.read"),
  asyncHandler(async (req, res) => {
    const serverId = req.query.server_id ? Number(req.query.server_id) : null;

    const rows = await query(
      `
      SELECT
        sec.security_id,
        sec.server_id,
        s.server_code,
        s.hostname,
        sec.os_name AS os,
        sec.os_version,
        sec.hardening_status,
        sec.ssh_key_only,
        sec.antivirus_installed,
        sec.backup_enabled,
        sec.backup_frequency,
        sec.log_retention_days,
        sec.compliance AS compliance_status,
        sec.updated_at AS last_security_scan,
        sec.created_at,
        sec.updated_at
      FROM dbo.server_security sec
      JOIN dbo.servers s ON s.server_id = sec.server_id
      WHERE (@server_id IS NULL OR sec.server_id = @server_id)
      ORDER BY sec.security_id DESC
      `,
      (r) => r.input("server_id", serverId)
    );

    return ok(res, rows);
  })
);

/**
 * GET /api/security/server/:serverId
 * Permission: security.read
 */
securityRouter.get(
  "/server/:serverId",
  requirePermission("security.read"),
  asyncHandler(async (req, res) => {
    const serverId = Number(req.params.serverId);

    const rows = await query(
      `
      SELECT *
      FROM dbo.server_security
      WHERE server_id = @server_id
      `,
      (r) => r.input("server_id", serverId)
    );

    return ok(res, rows[0] ?? null);
  })
);

/**
 * UPSERT schema (same structure, no new columns)
 */
const upsertSchema = z.object({
  server_id: z.number().int().positive(),
  os_name: z.string().trim().min(1),
  os_version: z.string().trim().min(1),
  hardening_status: z.string().trim().min(1),
  ssh_key_only: z.boolean(),
  antivirus_installed: z.boolean(),
  backup_enabled: z.boolean(),
  backup_frequency: z.string().trim().min(1),
  log_retention_days: z.number().int().min(1),
  compliance: z.string().trim().min(1)
});

const updateSchema = upsertSchema.omit({ server_id: true });

/**
 * POST /api/security
 * Permission: security.manage
 * Upsert security info for a server
 */
securityRouter.post(
  "/",
  requirePermission("security.manage"),
  validateBody(upsertSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof upsertSchema>;

    const existed = await query<{ has_row: number }>(
      `SELECT TOP (1) 1 as has_row FROM dbo.server_security WHERE server_id = @server_id`,
      (r) => r.input("server_id", body.server_id)
    );

    if (existed[0]) {
      throw new HttpError(409, "This server already has security. Use Edit to update it.", "SECURITY_ALREADY_EXISTS");
    }
    await withTransaction(async (tx) => {
      const inserted = await queryTx<{ security_id: number }>(
        tx,
        `
        INSERT INTO dbo.server_security
        (
          server_id,
          os_name,
          os_version,
          hardening_status,
          ssh_key_only,
          antivirus_installed,
          backup_enabled,
          backup_frequency,
          log_retention_days,
          compliance,
          created_at,
          updated_at
        )
        OUTPUT INSERTED.security_id AS security_id
        VALUES
        (
          @server_id,
          @os_name,
          @os_version,
          @hardening_status,
          @ssh_key_only,
          @antivirus_installed,
          @backup_enabled,
          @backup_frequency,
          @log_retention_days,
          @compliance,
          GETDATE(),
          GETDATE()
        );
        `,
        (r) => {
          r.input("server_id", body.server_id);
          r.input("os_name", body.os_name ?? null);
          r.input("os_version", body.os_version ?? null);
          r.input("hardening_status", body.hardening_status ?? null);
          r.input("ssh_key_only", body.ssh_key_only ?? null);
          r.input("antivirus_installed", body.antivirus_installed ?? null);
          r.input("backup_enabled", body.backup_enabled ?? null);
          r.input("backup_frequency", body.backup_frequency ?? null);
          r.input("log_retention_days", body.log_retention_days ?? null);
          r.input("compliance", body.compliance ?? null);
        }
      );

      const securityId = Number(inserted[0]?.security_id ?? 0);
      const afterRows = await queryTx<any>(
        tx,
        `SELECT TOP (1) * FROM dbo.server_security WHERE security_id = @id`,
        (r) => r.input("id", securityId)
      );
      const after = afterRows[0] ?? null;

      const fields = [
        "os_name",
        "os_version",
        "hardening_status",
        "ssh_key_only",
        "antivirus_installed",
        "backup_enabled",
        "backup_frequency",
        "log_retention_days",
        "compliance"
      ];

      const changes = diffFields(null, after, fields);

      await writeAuditActivityAndEmit({
        tx,
        actorUserId: req.user!.userId,
        teamId: req.user!.teamId,
        action: "CREATE",
        entityType: "Security",
        entityId: securityId || body.server_id,
        before: null,
        after,
        activityMessage: "Security profile created",
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
 * PATCH /api/security/:id
 * Update security by security_id
 * Permission: security.manage
 */
const patchSchema = z.object({
  os: z.string().trim().optional(),
  os_version: z.string().trim().optional(),
  hardening_status: z.enum(["Secure", "Partial", "Risk"]).optional(),
  ssh_key_only: z.boolean().optional(),
  antivirus_installed: z.boolean().optional(),
  backup_enabled: z.boolean().optional(),
  compliance_status: z.enum(["Compliant", "Partial", "Non-Compliant"]).optional(),
});

securityRouter.patch(
  "/:id",
  requirePermission("security.manage"),
  validateBody(patchSchema),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = req.body as z.infer<typeof patchSchema>;

    await withTransaction(async (tx) => {
      const beforeRows = await queryTx<any>(
        tx,
        `SELECT TOP (1) * FROM dbo.server_security WHERE security_id = @id`,
        (r) => r.input("id", id)
      );
      const before = beforeRows[0];
      if (!before) throw new HttpError(404, "Security profile not found.", "SECURITY_NOT_FOUND");

      await queryTx(
        tx,
        `
        UPDATE dbo.server_security
        SET
          os_name = COALESCE(@os, os_name),
          os_version = COALESCE(@os_version, os_version),
          hardening_status = COALESCE(@hardening_status, hardening_status),
          ssh_key_only = COALESCE(@ssh_key_only, ssh_key_only),
          antivirus_installed = COALESCE(@antivirus_installed, antivirus_installed),
          backup_enabled = COALESCE(@backup_enabled, backup_enabled),
          compliance = COALESCE(@compliance_status, compliance),
          updated_at = GETDATE()
        WHERE security_id = @id
        `,
        (r) => {
          r.input("id", id);
          r.input("os", body.os ?? null);
          r.input("os_version", body.os_version ?? null);
          r.input("hardening_status", body.hardening_status ?? null);
          r.input("ssh_key_only", body.ssh_key_only ?? null);
          r.input("antivirus_installed", body.antivirus_installed ?? null);
          r.input("backup_enabled", body.backup_enabled ?? null);
          r.input("compliance_status", body.compliance_status ?? null);
        }
      );

      const afterRows = await queryTx<any>(
        tx,
        `SELECT TOP (1) * FROM dbo.server_security WHERE security_id = @id`,
        (r) => r.input("id", id)
      );
      const after = afterRows[0] ?? null;

      const fields = [
        "os_name",
        "os_version",
        "hardening_status",
        "ssh_key_only",
        "antivirus_installed",
        "backup_enabled",
        "backup_frequency",
        "log_retention_days",
        "compliance"
      ];

      const changes = diffFields(before, after, fields);
      const msg = summarizeChangeMessage("Security", changes);

      await writeAuditActivityAndEmit({
        tx,
        actorUserId: req.user!.userId,
        teamId: req.user!.teamId,
        action: "UPDATE",
        entityType: "Security",
        entityId: id,
        before,
        after,
        activityMessage: msg,
        activityAction: "updated",
        activityMeta: { changes },
        serverId: Number(before.server_id ?? null),
        ipAddress: req.ip,
        userAgent: String(req.headers["user-agent"] ?? "") || null
      });
    });

    return ok(res, { message: "Security updated" });
  })
);

/**
 * PATCH /api/security/server/:serverId
 * Permission: security.manage
 */
securityRouter.patch(
  "/server/:serverId",
  requirePermission("security.manage"),
  validateBody(updateSchema),
  asyncHandler(async (req, res) => {
    const serverId = Number(req.params.serverId);
    const body = req.body as z.infer<typeof updateSchema>;

    const existing = await query<{ has_row: number }>(
      `SELECT TOP (1) 1 as has_row FROM dbo.server_security WHERE server_id = @server_id`,
      (r) => r.input("server_id", serverId)
    );

    if (!existing[0]) {
      throw new HttpError(404, "Security profile not found for this server.", "SECURITY_NOT_FOUND");
    }

    await withTransaction(async (tx) => {
      const beforeRows = await queryTx<any>(
        tx,
        `SELECT TOP (1) * FROM dbo.server_security WHERE server_id = @server_id`,
        (r) => r.input("server_id", serverId)
      );
      const before = beforeRows[0];
      if (!before) throw new HttpError(404, "Security profile not found for this server.", "SECURITY_NOT_FOUND");

      await queryTx(
        tx,
        `
        UPDATE dbo.server_security
        SET
          os_name = @os_name,
          os_version = @os_version,
          hardening_status = @hardening_status,
          ssh_key_only = @ssh_key_only,
          antivirus_installed = @antivirus_installed,
          backup_enabled = @backup_enabled,
          backup_frequency = @backup_frequency,
          log_retention_days = @log_retention_days,
          compliance = @compliance,
          updated_at = GETDATE()
        WHERE server_id = @server_id
        `,
        (r) => {
          r.input("server_id", serverId);
          r.input("os_name", body.os_name);
          r.input("os_version", body.os_version);
          r.input("hardening_status", body.hardening_status);
          r.input("ssh_key_only", body.ssh_key_only);
          r.input("antivirus_installed", body.antivirus_installed);
          r.input("backup_enabled", body.backup_enabled);
          r.input("backup_frequency", body.backup_frequency);
          r.input("log_retention_days", body.log_retention_days);
          r.input("compliance", body.compliance);
        }
      );

      const afterRows = await queryTx<any>(
        tx,
        `SELECT TOP (1) * FROM dbo.server_security WHERE server_id = @server_id`,
        (r) => r.input("server_id", serverId)
      );
      const after = afterRows[0] ?? null;

      const fields = [
        "os_name",
        "os_version",
        "hardening_status",
        "ssh_key_only",
        "antivirus_installed",
        "backup_enabled",
        "backup_frequency",
        "log_retention_days",
        "compliance"
      ];
      const changes = diffFields(before, after, fields);
      const msg = summarizeChangeMessage("Security", changes);

      await writeAuditActivityAndEmit({
        tx,
        actorUserId: req.user!.userId,
        teamId: req.user!.teamId,
        action: "UPDATE",
        entityType: "Security",
        entityId: serverId,
        before,
        after,
        activityMessage: msg,
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
 * DELETE /api/security/server/:serverId
 * Permission: security.manage
 */
securityRouter.delete(
  "/server/:serverId",
  requirePermission("security.manage"),
  asyncHandler(async (req, res) => {
    const serverId = Number(req.params.serverId);

    await withTransaction(async (tx) => {
      const beforeRows = await queryTx<any>(
        tx,
        `SELECT TOP (1) * FROM dbo.server_security WHERE server_id = @server_id`,
        (r) => r.input("server_id", serverId)
      );
      const before = beforeRows[0] ?? null;

      await queryTx(
        tx,
        `DELETE FROM dbo.server_security WHERE server_id = @server_id`,
        (r) => r.input("server_id", serverId)
      );

      await writeAuditActivityAndEmit({
        tx,
        actorUserId: req.user!.userId,
        teamId: req.user!.teamId,
        action: "DELETE",
        entityType: "Security",
        entityId: serverId,
        before,
        after: null,
        activityMessage: "Security profile deleted",
        activityAction: "deleted",
        activityMeta: { changes: diffFields(before, null, [
          "os_name",
          "os_version",
          "hardening_status",
          "ssh_key_only",
          "antivirus_installed",
          "backup_enabled",
          "backup_frequency",
          "log_retention_days",
          "compliance"
        ]) },
        serverId,
        ipAddress: req.ip,
        userAgent: String(req.headers["user-agent"] ?? "") || null
      });
    });

    return ok(res, true);
  })
);
