import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../utils/asyncHandler";
import { created, ok } from "../utils/response";
import { audit } from "../utils/audit";
import { requirePermission } from "../middleware/permissions";
import { validateBody } from "../middleware/validate";
import { execProc, execProcTx, query, queryTx, withTransaction } from "../db/sql";
import { HttpError } from "../middleware/error";
import { env } from "../config/env";
import { decryptSecret, encryptSecret } from "../utils/credentialsCrypto";
import { scopedTeamId } from "../utils/teamScope";
import { serversV2EnhancementsRouter } from "./servers.routes.v2-enhancements";
import { writeAuditActivityAndEmit, writeAuditAndActivity } from "../services/auditService";

export const serversRouter = Router();

// Mount V2 enhancements (status recompute, activity timeline, etc.)
serversRouter.use(serversV2EnhancementsRouter);

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

async function hasServersEngineerIdColumn() {
  const rows = await query<{ len: number | null }>(
    "SELECT COL_LENGTH('dbo.servers','engineer_id') AS len"
  );
  return rows?.[0]?.len != null;
}

async function hasServersPowerColumn() {
  const rows = await query<{ len: number | null }>(
    "SELECT COL_LENGTH('dbo.servers','power') AS len"
  );
  return rows?.[0]?.len != null;
}

async function hasServersNotesColumn() {
  const rows = await query<{ len: number | null }>(
    "SELECT COL_LENGTH('dbo.servers','notes') AS len"
  );
  return rows?.[0]?.len != null;
}

serversRouter.get(
  "/",
  requirePermission("SERVER_VIEW"),
  asyncHandler(async (req, res) => {
    const search = (req.query.search as string | undefined)?.trim() ?? null;
    const teamId = scopedTeamId(req);

    const hasEngineer = await hasServersEngineerIdColumn();
    const hasPower = await hasServersPowerColumn();

    const derivedStatusCaseSql = `
      CASE
        WHEN EXISTS (
          SELECT 1
          FROM dbo.server_incidents i
          WHERE i.server_id = s.server_id
            AND LOWER(LTRIM(RTRIM(ISNULL(i.status,'')))) IN (
              'open','inprogress','in progress','investigating','mitigating'
            )
            AND LTRIM(RTRIM(ISNULL(i.severity,''))) = 'Critical'
        ) THEN 'Down'
        WHEN EXISTS (
          SELECT 1
          FROM dbo.server_incidents i
          WHERE i.server_id = s.server_id
            AND LOWER(LTRIM(RTRIM(ISNULL(i.status,'')))) IN (
              'open','inprogress','in progress','investigating','mitigating'
            )
            AND LTRIM(RTRIM(ISNULL(i.severity,''))) IN ('High','Major')
        ) THEN 'Degraded'
        WHEN EXISTS (
          SELECT 1
          FROM dbo.server_incidents i
          WHERE i.server_id = s.server_id
            AND LOWER(LTRIM(RTRIM(ISNULL(i.status,'')))) IN (
              'open','inprogress','in progress','investigating','mitigating'
            )
            AND LTRIM(RTRIM(ISNULL(i.severity,''))) = 'Medium'
        ) THEN 'Issue'
        WHEN EXISTS (
          SELECT 1
          FROM dbo.server_incidents i
          WHERE i.server_id = s.server_id
            AND LOWER(LTRIM(RTRIM(ISNULL(i.status,'')))) IN (
              'open','inprogress','in progress','investigating','mitigating'
            )
            AND LTRIM(RTRIM(ISNULL(i.severity,''))) = 'Low'
        ) THEN 'Warning'
        WHEN (
          EXISTS (
            SELECT 1
            FROM dbo.server_maintenance m
            WHERE m.server_id = s.server_id
              AND (
                (m.status = 'InProgress')
                OR (
                  m.status = 'Scheduled'
                  AND m.scheduled_start IS NOT NULL
                  AND CAST(m.scheduled_start AS DATE) = @today
                )
              )
          )
          OR EXISTS (
            SELECT 1
            FROM dbo.maintenance_runs r
            JOIN dbo.maintenance_schedules ms ON ms.schedule_id = r.schedule_id
            WHERE ms.server_id = s.server_id
              AND r.status IN ('Active','Incomplete','Overdue')
              AND CAST(r.due_date AS date) = @today
          )
        ) THEN 'Maintenance'
        ELSE 'Active'
      END
    `;

    const sqlText = hasEngineer
      ? `
        DECLARE @today DATE = CAST(GETDATE() AS DATE);

        SELECT TOP 200
          s.server_id, s.server_code, s.hostname, s.server_type, s.environment, s.role,
          ${derivedStatusCaseSql} AS status,
          ${hasPower ? "s.power," : "CAST(NULL AS nvarchar(20)) AS power,"}
          s.team_id, t.team_name,
          s.engineer_id, e.full_name AS engineer_name,
          s.location_id, l.site_name,
          s.rack_id, r.rack_code,
          s.u_position, s.install_date,
          s.created_at, s.updated_at
        FROM dbo.servers s
        LEFT JOIN dbo.teams t ON t.team_id = s.team_id
        LEFT JOIN dbo.engineers e ON e.engineer_id = s.engineer_id
        LEFT JOIN dbo.locations l ON l.location_id = s.location_id
        LEFT JOIN dbo.racks r ON r.rack_id = s.rack_id
        WHERE (@team_id IS NULL OR s.team_id = @team_id)
          AND (@search IS NULL OR s.server_code LIKE '%' + @search + '%' OR s.hostname LIKE '%' + @search + '%')
        ORDER BY s.server_id DESC
        `
      : `
        DECLARE @today DATE = CAST(GETDATE() AS DATE);

        SELECT TOP 200
          s.server_id, s.server_code, s.hostname, s.server_type, s.environment, s.role,
          ${derivedStatusCaseSql} AS status,
          ${hasPower ? "s.power," : "CAST(NULL AS nvarchar(20)) AS power,"}
          s.team_id, t.team_name,
          s.location_id, l.site_name,
          s.rack_id, r.rack_code,
          s.u_position, s.install_date,
          s.created_at, s.updated_at
        FROM dbo.servers s
        LEFT JOIN dbo.teams t ON t.team_id = s.team_id
        LEFT JOIN dbo.locations l ON l.location_id = s.location_id
        LEFT JOIN dbo.racks r ON r.rack_id = s.rack_id
        WHERE (@team_id IS NULL OR s.team_id = @team_id)
          AND (@search IS NULL OR s.server_code LIKE '%' + @search + '%' OR s.hostname LIKE '%' + @search + '%')
        ORDER BY s.server_id DESC
        `;

    const rows = await query(sqlText, (r) => {
      r.input("search", search);
      r.input("team_id", teamId);
    });

    return ok(res, rows);
  })
);

serversRouter.get(
  "/:id",
  requirePermission("SERVER_VIEW"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const teamId = scopedTeamId(req);

    const hasEngineer = await hasServersEngineerIdColumn();

    const derivedStatusSelect = `
      DECLARE @today DATE = CAST(GETDATE() AS DATE);

      SELECT
        CASE
          WHEN EXISTS (
            SELECT 1
            FROM dbo.server_incidents i
            WHERE i.server_id = s.server_id
              AND LOWER(LTRIM(RTRIM(ISNULL(i.status,'')))) IN (
                'open','inprogress','in progress','investigating','mitigating'
              )
              AND LTRIM(RTRIM(ISNULL(i.severity,''))) = 'Critical'
          ) THEN 'Down'
          WHEN EXISTS (
            SELECT 1
            FROM dbo.server_incidents i
            WHERE i.server_id = s.server_id
              AND LOWER(LTRIM(RTRIM(ISNULL(i.status,'')))) IN (
                'open','inprogress','in progress','investigating','mitigating'
              )
              AND LTRIM(RTRIM(ISNULL(i.severity,''))) IN ('High','Major')
          ) THEN 'Degraded'
          WHEN EXISTS (
            SELECT 1
            FROM dbo.server_incidents i
            WHERE i.server_id = s.server_id
              AND LOWER(LTRIM(RTRIM(ISNULL(i.status,'')))) IN (
                'open','inprogress','in progress','investigating','mitigating'
              )
              AND LTRIM(RTRIM(ISNULL(i.severity,''))) = 'Medium'
          ) THEN 'Issue'
          WHEN EXISTS (
            SELECT 1
            FROM dbo.server_incidents i
            WHERE i.server_id = s.server_id
              AND LOWER(LTRIM(RTRIM(ISNULL(i.status,'')))) IN (
                'open','inprogress','in progress','investigating','mitigating'
              )
              AND LTRIM(RTRIM(ISNULL(i.severity,''))) = 'Low'
          ) THEN 'Warning'
          WHEN (
            EXISTS (
              SELECT 1
              FROM dbo.server_maintenance m
              WHERE m.server_id = s.server_id
                AND (
                  (m.status = 'InProgress')
                  OR (
                    m.status = 'Scheduled'
                    AND m.scheduled_start IS NOT NULL
                    AND CAST(m.scheduled_start AS DATE) = @today
                  )
                )
            )
            OR EXISTS (
              SELECT 1
              FROM dbo.maintenance_runs r
              JOIN dbo.maintenance_schedules ms ON ms.schedule_id = r.schedule_id
              WHERE ms.server_id = s.server_id
                AND r.status IN ('Active','Incomplete','Overdue')
                AND CAST(r.due_date AS date) = @today
            )
          ) THEN 'Maintenance'
          ELSE 'Active'
        END AS derived_status
    `;

    const serverSql = hasEngineer
      ? `
        ${derivedStatusSelect},
          s.*,
          t.team_name,
          e.full_name AS engineer_name,
          l.site_name,
          r.rack_code
        FROM dbo.servers s
        LEFT JOIN dbo.teams t ON t.team_id = s.team_id
        LEFT JOIN dbo.engineers e ON e.engineer_id = s.engineer_id
        LEFT JOIN dbo.locations l ON l.location_id = s.location_id
        LEFT JOIN dbo.racks r ON r.rack_id = s.rack_id
        WHERE s.server_id = @id
          AND (@team_id IS NULL OR s.team_id = @team_id)
        `
      : `
        ${derivedStatusSelect},
          s.*,
          t.team_name,
          l.site_name,
          r.rack_code
        FROM dbo.servers s
        LEFT JOIN dbo.teams t ON t.team_id = s.team_id
        LEFT JOIN dbo.locations l ON l.location_id = s.location_id
        LEFT JOIN dbo.racks r ON r.rack_id = s.rack_id
        WHERE s.server_id = @id
          AND (@team_id IS NULL OR s.team_id = @team_id)
        `;

    const server = await query(serverSql, (r) => {
      r.input("id", id);
      r.input("team_id", teamId);
    });
    if (!server[0]) throw new HttpError(404, "Server not found", "SERVER_NOT_FOUND");

    const hardware = await query(`SELECT * FROM dbo.server_hardware WHERE server_id=@id`, (r) => r.input("id", id));
    const network = await query(`SELECT * FROM dbo.server_network WHERE server_id=@id ORDER BY network_id DESC`, (r) => r.input("id", id));
    const monitoring = await query(`SELECT * FROM dbo.server_monitoring WHERE server_id=@id`, (r) => r.input("id", id));
    const security = await query(`SELECT * FROM dbo.server_security WHERE server_id=@id`, (r) => r.input("id", id));
    const incidents = await query(`SELECT TOP 100 * FROM dbo.server_incidents WHERE server_id=@id ORDER BY incident_id DESC`, (r) => r.input("id", id));
    const maintenance = await query(`SELECT TOP 100 * FROM dbo.server_maintenance WHERE server_id=@id ORDER BY maintenance_id DESC`, (r) => r.input("id", id));

    const visits = await query(
      `
      IF OBJECT_ID('dbo.server_visits','U') IS NULL
      BEGIN
        SELECT TOP 0 CAST(NULL AS int) AS visit_id;
      END
      ELSE
      BEGIN
        SELECT TOP 100 *
        FROM dbo.server_visits
        WHERE server_id=@id
        ORDER BY visit_id DESC
      END
      `,
      (r) => r.input("id", id)
    );

    const applications = await query(
      `
      IF OBJECT_ID('dbo.server_applications','U') IS NULL OR OBJECT_ID('dbo.applications','U') IS NULL
      BEGIN
        SELECT TOP 0 CAST(NULL AS int) AS application_id;
      END
      ELSE
      BEGIN
        SELECT TOP 200
          a.*
        FROM dbo.server_applications sa
        JOIN dbo.applications a ON a.application_id = sa.application_id
        WHERE sa.server_id = @id
        ORDER BY a.application_id DESC
      END
      `,
      (r) => r.input("id", id)
    );

    const serverRow: any = server[0] ?? null;
    if (serverRow && typeof serverRow.derived_status === "string") {
      serverRow.status = serverRow.derived_status;
      delete serverRow.derived_status;
    }

    return ok(res, {
      server: serverRow,
      hardware: hardware[0] ?? null,
      network,
      monitoring: monitoring[0] ?? null,
      security: security[0] ?? null,
      incidents,
      maintenance,
      visits,
      applications
    });
  })
);

const createServerSchema = z.object({
  server_code: z.string().trim().min(1),
  hostname: z.string().trim().min(1),
  server_type: z.string().trim().min(1),
  environment: z.string().trim().min(1),
  role: z.string().trim().min(1),
  power: z.enum(["Single", "Double", "Triple", "Quad"]).optional(),
  team_id: z.number().int().positive(),
  engineer_id: z.number().int().positive(),
  location_id: z.number().int().positive(),
  rack_id: z.number().int().positive(),

  // Optional server login credentials.
  login_username: z.string().trim().min(1).nullable().optional(),
  login_password: z
    .string()
    .min(1)
    .refine((v) => v.trim().length > 0, "Password is required")
    .nullable()
    .optional()
});

serversRouter.post(
  "/",
  requirePermission("SERVER_CREATE"),
  validateBody(createServerSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof createServerSchema>;
    const serverCode = String(body.server_code ?? "").trim();

    const actorUserId = Number((req.user as any)?.userId ?? NaN);
    const roleName = String((req.user as any)?.roleName ?? "").trim().toLowerCase();
    const isAdmin = roleName === "admin" || roleName === "administrator";
    const userTeamId = Number((req.user as any)?.teamId ?? NaN);
    if (!Number.isFinite(actorUserId) || actorUserId <= 0) {
      throw new HttpError(401, "User ID required", "UNAUTHORIZED");
    }

    const effectiveTeamId = isAdmin
      ? body.team_id
      : (() => {
          if (!Number.isFinite(userTeamId) || userTeamId <= 0) {
            throw new HttpError(403, "Team assignment required", "TEAM_REQUIRED");
          }
          if (body.team_id !== userTeamId) {
            throw new HttpError(403, "Cannot create servers outside your team", "TEAM_SCOPE_VIOLATION");
          }
          return userTeamId;
        })();

    const hasEngineer = await hasServersEngineerIdColumn();
    if (!hasEngineer) {
      throw new HttpError(
        400,
        "Engineer assignment is not supported by the current database schema. Add dbo.servers.engineer_id and a FK to dbo.engineers.",
        "ENGINEER_ASSIGNMENT_NOT_SUPPORTED"
      );
    }

    const eng = await query<{ engineer_id: number; team_id: number | null }>(
      `
      SELECT engineer_id, team_id
      FROM dbo.engineers
      WHERE engineer_id = @engineer_id
      `,
      (r) => r.input("engineer_id", body.engineer_id)
    );

    if (!eng[0]) throw new HttpError(404, "Engineer not found", "ENGINEER_NOT_FOUND");
    if (eng[0].team_id != null && eng[0].team_id !== effectiveTeamId) {
      throw new HttpError(400, "Engineer must belong to the selected team", "ENGINEER_TEAM_MISMATCH");
    }

    // If a password was provided, we must have an encryption key configured.
    // Validate this *before* creating the server to avoid partial creates.
    if (body.login_password && !env.credentials.encryptionKey) {
      throw new HttpError(
        400,
        "Server credentials encryption is not configured. Set CREDENTIALS_ENCRYPTION_KEY (backend) or remove the password field.",
        "CREDENTIALS_ENCRYPTION_NOT_CONFIGURED"
      );
    }

    // Friendly, deterministic error instead of a raw SQL unique constraint exception.
    // SQL Server comparisons treat trailing spaces as equal, so compare on LTRIM/RTRIM.
    const existing = await query<{ server_id: number }>(
      `
      SELECT TOP (1) server_id
      FROM dbo.servers
      WHERE LTRIM(RTRIM(server_code)) = @server_code
      `,
      (r) => r.input("server_code", serverCode)
    );

    if (existing[0]) {
      throw new HttpError(
        409,
        `Server code already exists: ${serverCode}. Please choose a unique server code.`,
        "SERVER_CODE_ALREADY_EXISTS"
      );
    }

    const serverId = await withTransaction(async (tx) => {
      const hasPower = await hasServersPowerColumn();
      let result;
      try {
        result = await execProcTx<{ server_id: number }>(tx, "dbo.sp_register_server", (r) => {
          r.input("server_code", serverCode);
          r.input("hostname", body.hostname);
          r.input("server_type", body.server_type);
          r.input("environment", body.environment);
          r.input("role", body.role);
          r.input("team_id", effectiveTeamId);
          r.input("location_id", body.location_id);
        });
      } catch (err: any) {
        const msg = String(err?.message ?? "");
        const num = Number(err?.number ?? err?.originalError?.number ?? NaN);
        const isUnique = num === 2627 || num === 2601 || /duplicate key|unique key constraint/i.test(msg);
        if (isUnique) {
          throw new HttpError(
            409,
            `Server code already exists: ${serverCode}. Please choose a unique server code.`,
            "SERVER_CODE_ALREADY_EXISTS"
          );
        }
        throw err;
      }

      const newServerId = result.recordset?.[0]?.server_id ?? null;
      if (!newServerId) throw new HttpError(500, "Failed to create server", "CREATE_FAILED");

      // Set rack_id as part of creation (proc does not handle it).
      const updateSql = hasEngineer
        ? `
          UPDATE dbo.servers
          SET rack_id = @rack_id,
              engineer_id = COALESCE(@engineer_id, engineer_id),
              ${hasPower ? "power = COALESCE(@power, power)," : ""}
              updated_at = GETDATE()
          WHERE server_id = @server_id
          `
        : `
          UPDATE dbo.servers
          SET rack_id = @rack_id,
              ${hasPower ? "power = COALESCE(@power, power)," : ""}
              updated_at = GETDATE()
          WHERE server_id = @server_id
          `;

      await queryTx(tx, updateSql, (r) => {
        r.input("server_id", newServerId);
        r.input("rack_id", body.rack_id);
        if (hasEngineer) r.input("engineer_id", body.engineer_id ?? null);
        if (hasPower) r.input("power", body.power ?? null);
      });

      await audit({
        actor: req.user!.username,
        action: "UPDATE",
        entity: "servers",
        entityId: newServerId,
        details: { rack_id: body.rack_id, engineer_id: body.engineer_id ?? null },
        tx
      });

      // Store credentials if provided.
      if (body.login_username || body.login_password) {
        const passwordEnc = body.login_password
          ? encryptSecret(body.login_password, env.credentials.encryptionKey)
          : null;

        await queryTx(
          tx,
          `
          IF EXISTS (SELECT 1 FROM dbo.server_credentials WHERE server_id = @server_id)
          BEGIN
            UPDATE dbo.server_credentials
            SET
              login_username = COALESCE(@login_username, login_username),
              password_enc = COALESCE(@password_enc, password_enc),
              updated_at = GETDATE()
            WHERE server_id = @server_id;
          END
          ELSE
          BEGIN
            INSERT INTO dbo.server_credentials (server_id, login_username, password_enc)
            VALUES (@server_id, @login_username, @password_enc);
          END
          `,
          (r) => {
            r.input("server_id", newServerId);
            r.input("login_username", body.login_username ?? null);
            r.input("password_enc", passwordEnc);
          }
        );

        await audit({
          actor: req.user!.username,
          action: "UPSERT",
          entity: "server_credentials",
          entityId: newServerId,
          details: {
            login_username: body.login_username ?? null,
            password_set: Boolean(body.login_password)
          },
          tx
        });

        await writeAuditAndActivity({
          tx,
          actorUserId,
          teamId: effectiveTeamId,
          action: "SERVER_CREDENTIALS_UPSERT",
          entityType: "ServerCredentials",
          entityId: String(newServerId),
          before: null,
          after: { login_username: body.login_username ?? null, password_set: Boolean(body.login_password) },
          activityMessage: "Server credentials updated",
          ipAddress: req.ip,
          userAgent: String(req.headers["user-agent"] ?? "") || null
        });
      }

      await audit({
        actor: req.user!.username,
        action: "CREATE",
        entity: "servers",
        entityId: newServerId,
        details: {
          ...body,
          login_password: body.login_password ? "***" : null
        },
        tx
      });

      const afterServer = await queryTx<any>(
        tx,
        `SELECT TOP 1 * FROM dbo.servers WHERE server_id=@id`,
        (r) => r.input("id", newServerId)
      );

      await writeAuditAndActivity({
        tx,
        actorUserId,
        teamId: effectiveTeamId,
        action: "SERVER_CREATE",
        entityType: "Server",
        entityId: String(newServerId),
        before: null,
        after: afterServer[0] ?? null,
        activityMessage: `Server created (${serverCode})`,
        ipAddress: req.ip,
        userAgent: String(req.headers["user-agent"] ?? "") || null
      });

      return newServerId;
    });

    return created(res, { server_id: serverId });
  })
);

const updateServerSchema = z.object({
  hostname: z.string().trim().min(1).optional(),
  server_type: z.string().trim().min(1).optional(),
  environment: z.string().trim().min(1).optional(),
  role: z.string().trim().min(1).optional(),
  power: z.enum(["Single", "Double", "Triple", "Quad"]).optional(),
  team_id: z.number().int().optional(),
  engineer_id: z.number().int().optional(),
  location_id: z.number().int().optional(),
  rack_id: z.number().int().optional(),
  u_position: z.string().trim().min(1).optional(),
  install_date: z.string().trim().min(1).optional()
});

const upsertCredentialsSchema = z.object({
  login_username: z.string().trim().min(1).nullable().optional(),
  login_password: z
    .string()
    .min(1)
    .refine((v) => v.trim().length > 0, "Password is required")
    .nullable()
    .optional()
});

/**
 * GET /api/servers/:id/credentials
 * Permission: security.manage
 * Returns metadata only (no password).
 */
serversRouter.get(
  "/:id/credentials",
  requirePermission("security.manage"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const teamId = scopedTeamId(req);
    await assertServerVisible(id, teamId);

    const rows = await query<{
      login_username: string | null;
      password_enc: string | null;
      updated_at: Date;
    }>(
      `
      SELECT login_username, password_enc, updated_at
      FROM dbo.server_credentials
      WHERE server_id = @id
      `,
      (r) => r.input("id", id)
    );

    if (!rows[0]) {
      return ok(res, {
        login_username: null,
        has_password: false,
        updated_at: null
      });
    }

    return ok(res, {
      login_username: rows[0].login_username ?? null,
      has_password: Boolean(rows[0].password_enc),
      updated_at: rows[0].updated_at ?? null
    });
  })
);

/**
 * PUT /api/servers/:id/credentials
 * Permission: security.manage
 * Upserts username and/or password (password stored encrypted).
 */
serversRouter.put(
  "/:id/credentials",
  requirePermission("security.manage"),
  validateBody(upsertCredentialsSchema),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = req.body as z.infer<typeof upsertCredentialsSchema>;
    const teamId = scopedTeamId(req);
    await assertServerVisible(id, teamId);

    const actorUserId = Number((req.user as any)?.userId ?? NaN);
    if (!Number.isFinite(actorUserId) || actorUserId <= 0) {
      throw new HttpError(401, "User ID required", "UNAUTHORIZED");
    }

    const serverRow = await query<{ team_id: number | null }>(
      `SELECT TOP 1 team_id FROM dbo.servers WHERE server_id=@id`,
      (r) => r.input("id", id)
    );
    const serverTeamId = serverRow[0]?.team_id ?? null;

    const before = await query<{ login_username: string | null; password_enc: string | null; updated_at: Date | null }>(
      `SELECT TOP 1 login_username, password_enc, updated_at FROM dbo.server_credentials WHERE server_id=@id`,
      (r) => r.input("id", id)
    );

    if (!env.credentials.encryptionKey && body.login_password) {
      throw new HttpError(
        400,
        "Server credentials encryption is not configured. Set CREDENTIALS_ENCRYPTION_KEY (backend) or omit the password field.",
        "CREDENTIALS_ENCRYPTION_NOT_CONFIGURED"
      );
    }

    const passwordEnc = body.login_password
      ? encryptSecret(body.login_password, env.credentials.encryptionKey)
      : null;

    await query(
      `
      IF EXISTS (SELECT 1 FROM dbo.server_credentials WHERE server_id = @server_id)
      BEGIN
        UPDATE dbo.server_credentials
        SET
          login_username = COALESCE(@login_username, login_username),
          password_enc = COALESCE(@password_enc, password_enc),
          updated_at = GETDATE()
        WHERE server_id = @server_id;
      END
      ELSE
      BEGIN
        INSERT INTO dbo.server_credentials (server_id, login_username, password_enc)
        VALUES (@server_id, @login_username, @password_enc);
      END
      `,
      (r) => {
        r.input("server_id", id);
        r.input("login_username", body.login_username ?? null);
        r.input("password_enc", passwordEnc);
      }
    );

    await audit({
      actor: req.user!.username,
      action: "UPSERT",
      entity: "server_credentials",
      entityId: id,
      details: {
        login_username: body.login_username ?? undefined,
        password_set: Boolean(body.login_password)
      }
    });

    const after = await query<{ login_username: string | null; password_enc: string | null; updated_at: Date | null }>(
      `SELECT TOP 1 login_username, password_enc, updated_at FROM dbo.server_credentials WHERE server_id=@id`,
      (r) => r.input("id", id)
    );

    await writeAuditAndActivity({
      actorUserId,
      teamId: serverTeamId,
      action: "SERVER_CREDENTIALS_UPSERT",
      entityType: "ServerCredentials",
      entityId: String(id),
      before: before[0]
        ? {
            login_username: before[0].login_username ?? null,
            has_password: Boolean(before[0].password_enc),
            updated_at: before[0].updated_at ?? null
          }
        : null,
      after: after[0]
        ? {
            login_username: after[0].login_username ?? null,
            has_password: Boolean(after[0].password_enc),
            updated_at: after[0].updated_at ?? null
          }
        : null,
      activityMessage: "Server credentials updated",
      ipAddress: req.ip,
      userAgent: String(req.headers["user-agent"] ?? "") || null
    });

    return ok(res, true);
  })
);

/**
 * POST /api/servers/:id/credentials/reveal
 * Permission: security.manage
 * Returns the decrypted password.
 */
serversRouter.post(
  "/:id/credentials/reveal",
  requirePermission("security.manage"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const teamId = scopedTeamId(req);
    await assertServerVisible(id, teamId);

    if (!env.credentials.encryptionKey) {
      throw new HttpError(
        500,
        "Server credentials encryption is not configured.",
        "CREDENTIALS_ENCRYPTION_NOT_CONFIGURED"
      );
    }

    const rows = await query<{
      login_username: string | null;
      password_enc: string | null;
    }>(
      `
      SELECT login_username, password_enc
      FROM dbo.server_credentials
      WHERE server_id = @id
      `,
      (r) => r.input("id", id)
    );

    if (!rows[0]) throw new HttpError(404, "Credentials not found", "CREDENTIALS_NOT_FOUND");
    if (!rows[0].password_enc) throw new HttpError(404, "Password not set", "PASSWORD_NOT_SET");

    const password = decryptSecret(rows[0].password_enc, env.credentials.encryptionKey);

    await audit({
      actor: req.user!.username,
      action: "REVEAL",
      entity: "server_credentials",
      entityId: id,
      details: { revealed: true }
    });

    const serverRow = await query<{ team_id: number | null }>(
      `SELECT TOP 1 team_id FROM dbo.servers WHERE server_id=@id`,
      (r) => r.input("id", id)
    );
    const serverTeamId = serverRow[0]?.team_id ?? null;

    await writeAuditActivityAndEmit({
      actorUserId: req.user!.userId,
      teamId: serverTeamId,
      action: "REVEAL",
      entityType: "ServerCredentials",
      entityId: String(id),
      before: null,
      after: { revealed: true },
      activityMessage: "Server credentials revealed",
      activityAction: "revealed",
      serverId: id,
      ipAddress: req.ip,
      userAgent: String(req.headers["user-agent"] ?? "") || null
    });

    return ok(res, {
      login_username: rows[0].login_username ?? null,
      password
    });
  })
);

serversRouter.patch(
  "/:id",
  requirePermission("SERVER_UPDATE"),
  validateBody(updateServerSchema),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = req.body as z.infer<typeof updateServerSchema>;
    const teamId = scopedTeamId(req);
    await assertServerVisible(id, teamId);

    const actorUserId = Number((req.user as any)?.userId ?? NaN);
    if (!Number.isFinite(actorUserId) || actorUserId <= 0) {
      throw new HttpError(401, "User ID required", "UNAUTHORIZED");
    }

    // TeamLead cannot move servers across teams; Admin can.
    const roleName = String((req.user as any)?.roleName ?? "").trim().toLowerCase();
    const isAdmin = roleName === "admin" || roleName === "administrator";

    // Engineers may only update notes/status via dedicated endpoints.
    if (roleName === "engineer") {
      throw new HttpError(403, "Engineers cannot update server fields", "ENGINEER_SERVER_UPDATE_DENIED");
    }
    if (!isAdmin && body.team_id != null) {
      throw new HttpError(403, "Changing server team is not allowed", "SERVER_TEAM_CHANGE_DENIED");
    }

    const hasEngineer = await hasServersEngineerIdColumn();
    const hasPower = await hasServersPowerColumn();

    if (body.engineer_id != null) {
      if (!hasEngineer) {
        throw new HttpError(
          400,
          "Engineer assignment is not supported by the current database schema. Add dbo.servers.engineer_id and a FK to dbo.engineers.",
          "ENGINEER_ASSIGNMENT_NOT_SUPPORTED"
        );
      }

      const current = await query<{ team_id: number | null }>(
        `SELECT team_id FROM dbo.servers WHERE server_id = @id`,
        (r) => r.input("id", id)
      );

      if (!current[0]) throw new HttpError(404, "Server not found", "SERVER_NOT_FOUND");

      const effectiveTeamId = body.team_id != null ? body.team_id : current[0].team_id;
      if (effectiveTeamId == null) {
        throw new HttpError(400, "Server team must be set before assigning an engineer", "TEAM_REQUIRED_FOR_ENGINEER");
      }
      const eng = await query<{ engineer_id: number; team_id: number | null }>(
        `
        SELECT engineer_id, team_id
        FROM dbo.engineers
        WHERE engineer_id = @engineer_id
        `,
        (r) => r.input("engineer_id", body.engineer_id)
      );

      if (!eng[0]) throw new HttpError(404, "Engineer not found", "ENGINEER_NOT_FOUND");
      if (effectiveTeamId != null && eng[0].team_id != null && eng[0].team_id !== effectiveTeamId) {
        throw new HttpError(400, "Engineer must belong to the selected team", "ENGINEER_TEAM_MISMATCH");
      }
    }

    const updateSql = `
      UPDATE dbo.servers
      SET
        hostname = COALESCE(@hostname, hostname),
        server_type = COALESCE(@server_type, server_type),
        environment = COALESCE(@environment, environment),
        role = COALESCE(@role, role),
        ${hasPower ? "power = COALESCE(@power, power)," : ""}
        team_id = COALESCE(@team_id, team_id),
        ${hasEngineer ? "engineer_id = COALESCE(@engineer_id, engineer_id)," : ""}
        location_id = COALESCE(@location_id, location_id),
        rack_id = COALESCE(@rack_id, rack_id),
        u_position = COALESCE(@u_position, u_position),
        install_date = COALESCE(@install_date, install_date),
        updated_at = GETDATE()
      WHERE server_id = @id
      `;

    await withTransaction(async (tx) => {
      const before = await queryTx<any>(
        tx,
        `SELECT TOP 1 * FROM dbo.servers WHERE server_id=@id`,
        (r) => r.input("id", id)
      );

      await queryTx(tx, updateSql, (r) => {
        r.input("id", id);
        r.input("hostname", body.hostname ?? null);
        r.input("server_type", body.server_type ?? null);
        r.input("environment", body.environment ?? null);
        r.input("role", body.role ?? null);
        if (hasPower) r.input("power", body.power ?? null);
        r.input("team_id", body.team_id ?? null);
        if (hasEngineer) r.input("engineer_id", body.engineer_id ?? null);
        r.input("location_id", body.location_id ?? null);
        r.input("rack_id", body.rack_id ?? null);
        r.input("u_position", body.u_position ?? null);
        r.input("install_date", body.install_date ?? null);
      });

      await audit({
        actor: req.user!.username,
        action: "UPDATE",
        entity: "servers",
        entityId: id,
        details: body,
        tx
      });

      const after = await queryTx<any>(
        tx,
        `SELECT TOP 1 * FROM dbo.servers WHERE server_id=@id`,
        (r) => r.input("id", id)
      );

      const serverTeamId = Number(after?.[0]?.team_id ?? before?.[0]?.team_id ?? NaN);

      await writeAuditAndActivity({
        tx,
        actorUserId,
        teamId: Number.isFinite(serverTeamId) ? serverTeamId : null,
        action: "SERVER_UPDATE",
        entityType: "Server",
        entityId: String(id),
        before: before[0] ?? null,
        after: after[0] ?? null,
        activityMessage: `Server updated (#${id})`,
        ipAddress: req.ip,
        userAgent: String(req.headers["user-agent"] ?? "") || null
      });
    });

    return ok(res, true);
  })
);

const updateServerNotesSchema = z.object({
  notes: z.string().max(4000).nullable().optional()
});

/**
 * PATCH /api/servers/:id/notes
 * Permission: SERVER_NOTES_UPDATE
 */
serversRouter.patch(
  "/:id/notes",
  requirePermission("SERVER_NOTES_UPDATE"),
  validateBody(updateServerNotesSchema),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = req.body as z.infer<typeof updateServerNotesSchema>;
    const teamId = scopedTeamId(req);
    await assertServerVisible(id, teamId);

    const actorUserId = Number((req.user as any)?.userId ?? NaN);
    if (!Number.isFinite(actorUserId) || actorUserId <= 0) {
      throw new HttpError(401, "User ID required", "UNAUTHORIZED");
    }

    const hasNotes = await hasServersNotesColumn();
    if (!hasNotes) {
      throw new HttpError(400, "Server notes are not supported by the current database schema", "NOTES_NOT_SUPPORTED");
    }

    await withTransaction(async (tx) => {
      const before = await queryTx<any>(
        tx,
        `SELECT TOP 1 * FROM dbo.servers WHERE server_id=@id`,
        (r) => r.input("id", id)
      );

      await queryTx(
        tx,
        `UPDATE dbo.servers SET notes = @notes, updated_at = GETDATE() WHERE server_id = @id`,
        (r) => {
          r.input("id", id);
          r.input("notes", body.notes ?? null);
        }
      );

      const after = await queryTx<any>(
        tx,
        `SELECT TOP 1 * FROM dbo.servers WHERE server_id=@id`,
        (r) => r.input("id", id)
      );

      const serverTeamId = Number(after?.[0]?.team_id ?? before?.[0]?.team_id ?? NaN);
      await writeAuditAndActivity({
        tx,
        actorUserId,
        teamId: Number.isFinite(serverTeamId) ? serverTeamId : null,
        action: "SERVER_NOTES_UPDATE",
        entityType: "Server",
        entityId: String(id),
        before: before[0] ?? null,
        after: after[0] ?? null,
        activityMessage: `Server notes updated (#${id})`,
        ipAddress: req.ip,
        userAgent: String(req.headers["user-agent"] ?? "") || null
      });
    });

    return ok(res, true);
  })
);

/**
 * DELETE /api/servers/:id
 * Permission: servers.delete
 */
serversRouter.delete(
  "/:id",
  requirePermission("SERVER_DELETE"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const teamId = scopedTeamId(req);
    await assertServerVisible(id, teamId);

    const actorUserId = Number((req.user as any)?.userId ?? NaN);
    if (!Number.isFinite(actorUserId) || actorUserId <= 0) {
      throw new HttpError(401, "User ID required", "UNAUTHORIZED");
    }

    await withTransaction(async (tx) => {
      const before = await queryTx<any>(
        tx,
        `SELECT TOP 1 * FROM dbo.servers WHERE server_id=@id`,
        (r) => r.input("id", id)
      );

      // Keep this list aligned with tables that reference dbo.servers(server_id).
      // If your DB uses ON DELETE CASCADE everywhere, these become redundant but remain safe.
      await queryTx(tx, `DELETE FROM dbo.server_network WHERE server_id = @id;`, (r) => r.input("id", id));
      await queryTx(tx, `DELETE FROM dbo.server_monitoring WHERE server_id = @id;`, (r) => r.input("id", id));
      await queryTx(tx, `DELETE FROM dbo.server_security WHERE server_id = @id;`, (r) => r.input("id", id));
      await queryTx(tx, `DELETE FROM dbo.server_hardware WHERE server_id = @id;`, (r) => r.input("id", id));
      await queryTx(tx, `DELETE FROM dbo.server_incidents WHERE server_id = @id;`, (r) => r.input("id", id));
      await queryTx(tx, `DELETE FROM dbo.server_maintenance WHERE server_id = @id;`, (r) => r.input("id", id));
      await queryTx(tx, `DELETE FROM dbo.server_visits WHERE server_id = @id;`, (r) => r.input("id", id));
      await queryTx(tx, `DELETE FROM dbo.server_credentials WHERE server_id = @id;`, (r) => r.input("id", id));

      await queryTx(tx, `DELETE FROM dbo.servers WHERE server_id = @id;`, (r) => r.input("id", id));

      await audit({
        actor: req.user!.username,
        action: "DELETE",
        entity: "servers",
        entityId: id,
        tx
      });

      const serverTeamId = Number(before?.[0]?.team_id ?? NaN);
      await writeAuditAndActivity({
        tx,
        actorUserId,
        teamId: Number.isFinite(serverTeamId) ? serverTeamId : null,
        action: "SERVER_DELETE",
        entityType: "Server",
        entityId: String(id),
        before: before[0] ?? null,
        after: null,
        activityMessage: `Server deleted (#${id})`,
        ipAddress: req.ip,
        userAgent: String(req.headers["user-agent"] ?? "") || null
      });
    });

    return ok(res, true);
  })
);
