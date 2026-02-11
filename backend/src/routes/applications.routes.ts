import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../utils/asyncHandler";
import { created, ok } from "../utils/response";
import { requirePermission } from "../middleware/permissions";
import { validateBody } from "../middleware/validate";
import { query, queryTx, withTransaction } from "../db/sql";
import { writeAuditActivityAndEmit } from "../services/auditService";
import { diffFields, summarizeChangeMessage } from "../utils/fieldDiff";

export const applicationsRouter = Router();

async function hasApplicationsColumn(name: string) {
  const rows = await query<{ len: number | null }>(
    "SELECT COL_LENGTH('dbo.applications', @col) AS len",
    (r) => r.input("col", name)
  );
  return rows?.[0]?.len != null;
}

async function hasServerApplicationsColumn(name: string) {
  const rows = await query<{ len: number | null }>(
    "SELECT COL_LENGTH('dbo.server_applications', @col) AS len",
    (r) => r.input("col", name)
  );
  return rows?.[0]?.len != null;
}

/**
 * GET /api/applications?search=
 * Permission: applications.read
 */
applicationsRouter.get(
  "/",
  requirePermission("applications.read"),
  asyncHandler(async (req, res) => {
    const search = (req.query.search as string | undefined)?.trim() ?? null;

    const hasAppName = await hasApplicationsColumn("app_name");
    const hasAppType = await hasApplicationsColumn("app_type");
    const hasVersion = await hasApplicationsColumn("version");
    const hasCriticality = await hasApplicationsColumn("criticality");
    const hasSla = await hasApplicationsColumn("sla_level");

    // Legacy compatibility
    const hasName = await hasApplicationsColumn("name");
    const hasDescription = await hasApplicationsColumn("description");
    const hasStatus = await hasApplicationsColumn("status");
    const hasOwnerTeam = await hasApplicationsColumn("owner_team_id");

    const selectCols: string[] = ["a.application_id"];

    if (hasAppName) selectCols.push("a.app_name");
    else if (hasName) selectCols.push("a.name AS app_name");
    else selectCols.push("CAST(NULL AS NVARCHAR(200)) AS app_name");

    if (hasAppType) selectCols.push("a.app_type");
    else selectCols.push("CAST(NULL AS NVARCHAR(100)) AS app_type");

    if (hasVersion) selectCols.push("a.version");
    else selectCols.push("CAST(NULL AS NVARCHAR(50)) AS version");

    if (hasCriticality) selectCols.push("a.criticality");
    else if (hasStatus) selectCols.push("a.status AS criticality");
    else selectCols.push("CAST(NULL AS NVARCHAR(50)) AS criticality");

    if (hasSla) selectCols.push("a.sla_level");
    else selectCols.push("CAST(NULL AS NVARCHAR(50)) AS sla_level");

    if (hasOwnerTeam) selectCols.push("a.owner_team_id");
    else selectCols.push("CAST(NULL AS INT) AS owner_team_id");
    
    if (hasDescription) selectCols.push("a.description");
    if (hasStatus) selectCols.push("a.status");

    selectCols.push("a.created_at", "a.updated_at");

    const nameExpr = hasAppName ? "a.app_name" : hasName ? "a.name" : "NULL";
    const descExpr = hasDescription ? "a.description" : "NULL";

    const rows = await query(
      `
      SELECT TOP 200
        ${selectCols.join(",\n        ")},
        ${hasOwnerTeam ? "t.team_name" : "CAST(NULL AS NVARCHAR(200))"} AS owner_team_name,
        (SELECT TOP 1 sa.server_id 
         FROM dbo.server_applications sa 
         WHERE sa.application_id = a.application_id 
         ORDER BY sa.created_at ASC) AS server_id,
        (SELECT TOP 1 s.server_code 
         FROM dbo.server_applications sa 
         JOIN dbo.servers s ON s.server_id = sa.server_id 
         WHERE sa.application_id = a.application_id 
         ORDER BY sa.created_at ASC) AS server_code,
        (SELECT TOP 1 s.hostname 
         FROM dbo.server_applications sa 
         JOIN dbo.servers s ON s.server_id = sa.server_id 
         WHERE sa.application_id = a.application_id 
         ORDER BY sa.created_at ASC) AS hostname
      FROM dbo.applications a
      ${hasOwnerTeam ? "LEFT JOIN dbo.teams t ON t.team_id = a.owner_team_id" : ""}
      WHERE (
        @search IS NULL
        OR ${nameExpr} LIKE '%' + @search + '%'
        OR ${descExpr} LIKE '%' + @search + '%'
      )
      ORDER BY a.application_id DESC
      `,
      (r) => r.input("search", search)
    );

    return ok(res, rows);
  })
);

/**
 * GET /api/applications/:id
 * Permission: applications.read
 */
applicationsRouter.get(
  "/:id",
  requirePermission("applications.read"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);

    const rows = await query(
      `SELECT TOP 1 * FROM dbo.applications WHERE application_id=@id`,
      (r) => r.input("id", id)
    );

    return ok(res, rows[0] ?? null);
  })
);

const createSchema = z.object({
  app_name: z.string().trim().min(1),
  app_type: z.string().trim().min(1).optional(),
  version: z.string().trim().min(1).optional(),
  criticality: z.string().trim().min(1).optional(),
  sla_level: z.string().trim().min(1).optional(),
  // Legacy fields (optional)
  description: z.string().trim().min(1).optional(),
  owner_team_id: z.number().int().positive().optional(),
  status: z.string().trim().min(1).optional(),
  // Server assignment
  server_id: z.number().int().positive().optional(),
});

/**
 * POST /api/applications
 * Permission: applications.create
 */
applicationsRouter.post(
  "/",
  requirePermission("applications.manage"),
  validateBody(createSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof createSchema>;

    const hasAppName = await hasApplicationsColumn("app_name");
    const hasAppType = await hasApplicationsColumn("app_type");
    const hasVersion = await hasApplicationsColumn("version");
    const hasCriticality = await hasApplicationsColumn("criticality");
    const hasSla = await hasApplicationsColumn("sla_level");

    const hasName = await hasApplicationsColumn("name");
    const hasDescription = await hasApplicationsColumn("description");
    const hasOwnerTeam = await hasApplicationsColumn("owner_team_id");
    const hasStatus = await hasApplicationsColumn("status");

    const cols: string[] = [];
    const vals: string[] = [];

    // Prefer new schema columns when present.
    if (hasAppName) {
      cols.push("app_name");
      vals.push("@app_name");
    } else if (hasName) {
      cols.push("name");
      vals.push("@app_name");
    }

    if (hasAppType) {
      cols.push("app_type");
      vals.push("@app_type");
    }
    if (hasVersion) {
      cols.push("version");
      vals.push("@version");
    }
    if (hasCriticality) {
      cols.push("criticality");
      vals.push("@criticality");
    } else if (hasStatus && body.criticality) {
      cols.push("status");
      vals.push("@criticality");
    }
    if (hasSla) {
      cols.push("sla_level");
      vals.push("@sla_level");
    }

    if (hasDescription) {
      cols.push("description");
      vals.push("@description");
    }
    if (hasOwnerTeam) {
      cols.push("owner_team_id");
      vals.push("@owner_team_id");
    }
    if (hasStatus && body.status) {
      cols.push("status");
      vals.push("@status");
    }

    cols.push("created_at", "updated_at");
    vals.push("GETDATE()", "GETDATE()");

    const applicationId = await withTransaction(async (tx) => {
      const rows = await queryTx<{ application_id: number }>(
        tx,
        `
        INSERT INTO dbo.applications
          (${cols.join(", ")})
        OUTPUT INSERTED.application_id
        VALUES
          (${vals.join(", ")})
        `,
        (r) => {
          r.input("app_name", body.app_name);
          r.input("app_type", body.app_type ?? null);
          r.input("version", body.version ?? null);
          r.input("criticality", body.criticality ?? null);
          r.input("sla_level", body.sla_level ?? null);
          r.input("description", body.description ?? null);
          r.input("owner_team_id", body.owner_team_id ?? null);
          r.input("status", body.status ?? null);
        }
      );

      const newId = Number(rows?.[0]?.application_id ?? 0);

      if (newId && body.server_id) {
        const hasPorts = await hasServerApplicationsColumn("ports");
        const hasDbType = await hasServerApplicationsColumn("database_type");
        const hasOwnerTeam = await hasServerApplicationsColumn("owner_team_id");

        const linkCols: string[] = ["server_id", "application_id", "created_at", "updated_at"];
        const linkVals: string[] = ["@server_id", "@application_id", "GETDATE()", "GETDATE()"];

        if (hasPorts) {
          linkCols.splice(2, 0, "ports");
          linkVals.splice(2, 0, "NULL");
        }
        if (hasDbType) {
          linkCols.splice(2, 0, "database_type");
          linkVals.splice(2, 0, "NULL");
        }
        if (hasOwnerTeam && body.owner_team_id) {
          linkCols.splice(2, 0, "owner_team_id");
          linkVals.splice(2, 0, "@owner_team_id");
        }

        await queryTx(
          tx,
          `
          INSERT INTO dbo.server_applications
            (${linkCols.join(", ")})
          VALUES
            (${linkVals.join(", ")})
          `,
          (r) => {
            r.input("server_id", body.server_id);
            r.input("application_id", newId);
            r.input("owner_team_id", body.owner_team_id ?? null);
          }
        );
      }

      const afterRows = await queryTx<any>(
        tx,
        `SELECT TOP (1) * FROM dbo.applications WHERE application_id = @id`,
        (r) => r.input("id", newId)
      );
      const after = afterRows[0] ?? null;

      const changes = diffFields(null, after, [
        "app_name",
        "name",
        "app_type",
        "version",
        "criticality",
        "sla_level",
        "description",
        "owner_team_id",
        "status"
      ]);

      await writeAuditActivityAndEmit({
        tx,
        actorUserId: req.user!.userId,
        teamId: req.user!.teamId,
        action: "CREATE",
        entityType: "Application",
        entityId: newId,
        before: null,
        after,
        activityMessage: "Application created",
        activityAction: "created",
        activityMeta: { changes },
        serverId: body.server_id ?? null,
        ipAddress: req.ip,
        userAgent: String(req.headers["user-agent"] ?? "") || null
      });

      if (body.server_id) {
        await writeAuditActivityAndEmit({
          tx,
          actorUserId: req.user!.userId,
          teamId: req.user!.teamId,
          action: "CREATE",
          entityType: "ApplicationLink",
          entityId: `link:${body.server_id}:${newId}`,
          before: null,
          after: { server_id: body.server_id, application_id: newId },
          activityMessage: `Application linked to server (#${body.server_id})`,
          activityAction: "created",
          activityMeta: { changes: { server_id: { from: null, to: body.server_id }, application_id: { from: null, to: newId } } },
          serverId: body.server_id,
          ipAddress: req.ip,
          userAgent: String(req.headers["user-agent"] ?? "") || null
        });
      }

      return newId;
    });

    return created(res, { application_id: applicationId });
  })
);

const updateSchema = z.object({
  app_name: z.string().trim().min(1).optional(),
  app_type: z.string().trim().min(1).optional(),
  version: z.string().trim().min(1).optional(),
  criticality: z.string().trim().min(1).optional(),
  sla_level: z.string().trim().min(1).optional(),
  // Legacy fields (optional)
  description: z.string().trim().min(1).optional(),
  owner_team_id: z.number().int().positive().optional(),
  status: z.string().trim().min(1).optional(),
  // Server assignment
  server_id: z.number().int().positive().optional(),
});

/**
 * PATCH /api/applications/:id
 * Permission: applications.update
 */
applicationsRouter.patch(
  "/:id",
  requirePermission("applications.manage"),
  validateBody(updateSchema),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = req.body as z.infer<typeof updateSchema>;

    const hasAppName = await hasApplicationsColumn("app_name");
    const hasAppType = await hasApplicationsColumn("app_type");
    const hasVersion = await hasApplicationsColumn("version");
    const hasCriticality = await hasApplicationsColumn("criticality");
    const hasSla = await hasApplicationsColumn("sla_level");

    const hasName = await hasApplicationsColumn("name");
    const hasDescription = await hasApplicationsColumn("description");
    const hasOwnerTeam = await hasApplicationsColumn("owner_team_id");
    const hasStatus = await hasApplicationsColumn("status");

    const sets: string[] = [];

    if (hasAppName) sets.push("app_name = COALESCE(@app_name, app_name)");
    else if (hasName) sets.push("name = COALESCE(@app_name, name)");

    if (hasAppType) sets.push("app_type = COALESCE(@app_type, app_type)");
    if (hasVersion) sets.push("version = COALESCE(@version, version)");
    if (hasCriticality) sets.push("criticality = COALESCE(@criticality, criticality)");
    else if (hasStatus) sets.push("status = COALESCE(@criticality, status)");

    if (hasSla) sets.push("sla_level = COALESCE(@sla_level, sla_level)");

    if (hasDescription) sets.push("description = COALESCE(@description, description)");
    if (hasOwnerTeam) sets.push("owner_team_id = COALESCE(@owner_team_id, owner_team_id)");
    if (hasStatus) sets.push("status = COALESCE(@status, status)");

    sets.push("updated_at = GETDATE()");

    await withTransaction(async (tx) => {
      const beforeRows = await queryTx<any>(
        tx,
        `SELECT TOP (1) * FROM dbo.applications WHERE application_id = @id`,
        (r) => r.input("id", id)
      );
      const before = beforeRows[0] ?? null;

      const beforeLinkRows = await queryTx<any>(
        tx,
        `SELECT TOP (1) * FROM dbo.server_applications WHERE application_id = @id ORDER BY updated_at DESC`,
        (r) => r.input("id", id)
      );
      const beforeLink = beforeLinkRows[0] ?? null;
      const beforeServerId: number | null = beforeLink?.server_id != null ? Number(beforeLink.server_id) : null;

      await queryTx(
        tx,
        `
        UPDATE dbo.applications
        SET
          ${sets.join(",\n          ")}
        WHERE application_id = @id
        `,
        (r) => {
          r.input("id", id);
          r.input("app_name", body.app_name ?? null);
          r.input("app_type", body.app_type ?? null);
          r.input("version", body.version ?? null);
          r.input("criticality", body.criticality ?? null);
          r.input("sla_level", body.sla_level ?? null);
          r.input("description", body.description ?? null);
          r.input("owner_team_id", body.owner_team_id ?? null);
          r.input("status", body.status ?? null);
        }
      );

      // If server_id is provided, update the server_applications link
      if (body.server_id !== undefined) {
        await queryTx(
          tx,
          `DELETE FROM dbo.server_applications WHERE application_id = @id`,
          (r) => r.input("id", id)
        );

        if (body.server_id) {
          const hasPorts = await hasServerApplicationsColumn("ports");
          const hasDbType = await hasServerApplicationsColumn("database_type");
          const hasOwnerTeam = await hasServerApplicationsColumn("owner_team_id");

          const linkCols: string[] = ["server_id", "application_id", "created_at", "updated_at"];
          const linkVals: string[] = ["@server_id", "@application_id", "GETDATE()", "GETDATE()"];

          if (hasPorts) {
            linkCols.splice(2, 0, "ports");
            linkVals.splice(2, 0, "NULL");
          }
          if (hasDbType) {
            linkCols.splice(2, 0, "database_type");
            linkVals.splice(2, 0, "NULL");
          }
          if (hasOwnerTeam && body.owner_team_id) {
            linkCols.splice(2, 0, "owner_team_id");
            linkVals.splice(2, 0, "@owner_team_id");
          }

          await queryTx(
            tx,
            `
            INSERT INTO dbo.server_applications
              (${linkCols.join(", ")})
            VALUES
              (${linkVals.join(", ")})
            `,
            (r) => {
              r.input("server_id", body.server_id);
              r.input("application_id", id);
              r.input("owner_team_id", body.owner_team_id ?? null);
            }
          );
        }
      }

      const afterRows = await queryTx<any>(
        tx,
        `SELECT TOP (1) * FROM dbo.applications WHERE application_id = @id`,
        (r) => r.input("id", id)
      );
      const after = afterRows[0] ?? null;

      const changes = diffFields(before, after, [
        "app_name",
        "name",
        "app_type",
        "version",
        "criticality",
        "sla_level",
        "description",
        "owner_team_id",
        "status"
      ]);

      const activityServerId = body.server_id ?? beforeServerId ?? null;

      await writeAuditActivityAndEmit({
        tx,
        actorUserId: req.user!.userId,
        teamId: req.user!.teamId,
        action: "UPDATE",
        entityType: "Application",
        entityId: id,
        before,
        after,
        activityMessage: summarizeChangeMessage("Application updated", changes),
        activityAction: "updated",
        activityMeta: { changes },
        serverId: activityServerId,
        ipAddress: req.ip,
        userAgent: String(req.headers["user-agent"] ?? "") || null
      });

      if (body.server_id !== undefined && beforeServerId !== body.server_id) {
        if (beforeServerId) {
          await writeAuditActivityAndEmit({
            tx,
            actorUserId: req.user!.userId,
            teamId: req.user!.teamId,
            action: "DELETE",
            entityType: "ApplicationLink",
            entityId: `link:${beforeServerId}:${id}`,
            before: { server_id: beforeServerId, application_id: id },
            after: null,
            activityMessage: `Application unlinked from server (#${beforeServerId})`,
            activityAction: "deleted",
            activityMeta: { changes: { server_id: { from: beforeServerId, to: null }, application_id: { from: id, to: null } } },
            serverId: beforeServerId,
            ipAddress: req.ip,
            userAgent: String(req.headers["user-agent"] ?? "") || null
          });
        }

        if (body.server_id) {
          await writeAuditActivityAndEmit({
            tx,
            actorUserId: req.user!.userId,
            teamId: req.user!.teamId,
            action: "CREATE",
            entityType: "ApplicationLink",
            entityId: `link:${body.server_id}:${id}`,
            before: null,
            after: { server_id: body.server_id, application_id: id },
            activityMessage: `Application linked to server (#${body.server_id})`,
            activityAction: "created",
            activityMeta: { changes: { server_id: { from: null, to: body.server_id }, application_id: { from: null, to: id } } },
            serverId: body.server_id,
            ipAddress: req.ip,
            userAgent: String(req.headers["user-agent"] ?? "") || null
          });
        }
      }
    });

    return ok(res, true);
  })
);

/**
 * DELETE /api/applications/:id
 * Permission: applications.delete
 */
applicationsRouter.delete(
  "/:id",
  requirePermission("applications.manage"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);

    await withTransaction(async (tx) => {
      const beforeRows = await queryTx<any>(
        tx,
        `SELECT TOP (1) * FROM dbo.applications WHERE application_id = @id`,
        (r) => r.input("id", id)
      );
      const before = beforeRows[0] ?? null;

      const beforeLinkRows = await queryTx<any>(
        tx,
        `SELECT TOP (1) * FROM dbo.server_applications WHERE application_id = @id ORDER BY updated_at DESC`,
        (r) => r.input("id", id)
      );
      const beforeLink = beforeLinkRows[0] ?? null;
      const activityServerId: number | null = beforeLink?.server_id != null ? Number(beforeLink.server_id) : null;

      await queryTx(tx, `DELETE FROM dbo.applications WHERE application_id=@id`, (r) => r.input("id", id));

      const changes = diffFields(before, null, [
        "app_name",
        "name",
        "app_type",
        "version",
        "criticality",
        "sla_level",
        "description",
        "owner_team_id",
        "status"
      ]);

      await writeAuditActivityAndEmit({
        tx,
        actorUserId: req.user!.userId,
        teamId: req.user!.teamId,
        action: "DELETE",
        entityType: "Application",
        entityId: id,
        before,
        after: null,
        activityMessage: "Application deleted",
        activityAction: "deleted",
        activityMeta: { changes },
        serverId: activityServerId,
        ipAddress: req.ip,
        userAgent: String(req.headers["user-agent"] ?? "") || null
      });
    });

    return ok(res, true);
  })
);

const assignSchema = z.object({
  server_id: z.number().int(),
  application_id: z.number().int(),
  ports: z.string().trim().min(1).optional(),
  database_type: z.string().trim().min(1).optional(),
  owner_team_id: z.number().int().positive().optional(),
});

/**
 * POST /api/applications/assign
 * Permission: applications.assign
 * Links an application to a server (server_applications table).
 */
applicationsRouter.post(
  "/assign",
  requirePermission("server_applications.manage"),
  validateBody(assignSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof assignSchema>;

    const hasPorts = await hasServerApplicationsColumn("ports");
    const hasDbType = await hasServerApplicationsColumn("database_type");
    const hasOwnerTeam = await hasServerApplicationsColumn("owner_team_id");
    const hasLinkId = await hasServerApplicationsColumn("server_application_id");

    const cols: string[] = ["server_id", "application_id", "created_at", "updated_at"];
    const vals: string[] = ["@server_id", "@application_id", "GETDATE()", "GETDATE()"];

    if (hasPorts) {
      cols.splice(2, 0, "ports");
      vals.splice(2, 0, "@ports");
    }
    if (hasDbType) {
      cols.splice(2, 0, "database_type");
      vals.splice(2, 0, "@database_type");
    }
    if (hasOwnerTeam) {
      cols.splice(2, 0, "owner_team_id");
      vals.splice(2, 0, "@owner_team_id");
    }

    const outputExpr = hasLinkId ? "OUTPUT INSERTED.server_application_id" : "";

    const linkId = await withTransaction(async (tx) => {
      const rows = await queryTx<{ server_application_id: number }>(
        tx,
        `
        INSERT INTO dbo.server_applications
          (${cols.join(", ")})
        ${outputExpr}
        VALUES
          (${vals.join(", ")})
        `,
        (r) => {
          r.input("server_id", body.server_id);
          r.input("application_id", body.application_id);
          r.input("ports", body.ports ?? null);
          r.input("database_type", body.database_type ?? null);
          r.input("owner_team_id", body.owner_team_id ?? null);
        }
      );

      const newLinkId = rows?.[0]?.server_application_id ?? null;
      const entityId = newLinkId ?? `link:${body.server_id}:${body.application_id}`;

      const afterLinkRows = newLinkId
        ? await queryTx<any>(
            tx,
            `SELECT TOP (1) * FROM dbo.server_applications WHERE server_application_id = @id`,
            (r) => r.input("id", newLinkId)
          )
        : await queryTx<any>(
            tx,
            `
            SELECT TOP (1) *
            FROM dbo.server_applications
            WHERE server_id = @server_id AND application_id = @application_id
            ORDER BY updated_at DESC
            `,
            (r) => {
              r.input("server_id", body.server_id);
              r.input("application_id", body.application_id);
            }
          );
      const afterLink = afterLinkRows[0] ?? { server_id: body.server_id, application_id: body.application_id };

      const changes = diffFields(null, afterLink, [
        "server_id",
        "application_id",
        "ports",
        "database_type",
        "owner_team_id"
      ]);

      await writeAuditActivityAndEmit({
        tx,
        actorUserId: req.user!.userId,
        teamId: req.user!.teamId,
        action: "CREATE",
        entityType: "ApplicationLink",
        entityId,
        before: null,
        after: afterLink,
        activityMessage: `Application linked to server (#${body.server_id})`,
        activityAction: "created",
        activityMeta: { changes },
        serverId: body.server_id,
        ipAddress: req.ip,
        userAgent: String(req.headers["user-agent"] ?? "") || null
      });

      return newLinkId;
    });

    return created(res, { server_application_id: linkId });
  })
);

/**
 * GET /api/applications/links?server_id=
 * Permission: applications.read
 */
applicationsRouter.get(
  "/links",
  requirePermission("applications.read"),
  asyncHandler(async (req, res) => {
    const serverId = req.query.server_id ? Number(req.query.server_id) : null;

    const hasPorts = await hasServerApplicationsColumn("ports");
    const hasDbType = await hasServerApplicationsColumn("database_type");
    const hasOwnerTeam = await hasServerApplicationsColumn("owner_team_id");
    const hasLinkId = await hasServerApplicationsColumn("server_application_id");

    const hasAppName = await hasApplicationsColumn("app_name");
    const hasName = await hasApplicationsColumn("name");

    const appNameExpr = hasAppName ? "a.app_name" : hasName ? "a.name" : "NULL";

    const cols: string[] = [];
    if (hasLinkId) cols.push("sa.server_application_id");
    cols.push(
      "sa.server_id",
      "sa.application_id",
      `${appNameExpr} AS app_name`,
      "sa.created_at",
      "sa.updated_at"
    );
    if (hasPorts) cols.splice(3, 0, "sa.ports");
    if (hasDbType) cols.splice(3, 0, "sa.database_type");
    if (hasOwnerTeam) cols.splice(3, 0, "sa.owner_team_id", "t.team_name AS owner_team_name");

    const rows = await query(
      `
      SELECT TOP 500
        ${cols.join(",\n        ")}
      FROM dbo.server_applications sa
      LEFT JOIN dbo.applications a ON a.application_id = sa.application_id
      LEFT JOIN dbo.teams t ON t.team_id = sa.owner_team_id
      WHERE (@server_id IS NULL OR sa.server_id = @server_id)
      ORDER BY sa.updated_at DESC
      `,
      (r) => r.input("server_id", serverId)
    );

    return ok(res, rows);
  })
);

/**
 * DELETE /api/applications/links
 * Permission: applications.assign
 * Removes a server<->application link.
 */
applicationsRouter.delete(
  "/links",
  requirePermission("server_applications.manage"),
  asyncHandler(async (req, res) => {
    const serverId = req.query.server_id ? Number(req.query.server_id) : null;
    const applicationId = req.query.application_id ? Number(req.query.application_id) : null;
    const linkId = req.query.server_application_id ? Number(req.query.server_application_id) : null;

    const hasLinkId = await hasServerApplicationsColumn("server_application_id");

    const deleted = await withTransaction(async (tx) => {
      let beforeLink: any | null = null;

      if (hasLinkId && linkId) {
        const rows = await queryTx<any>(
          tx,
          `SELECT TOP (1) * FROM dbo.server_applications WHERE server_application_id = @id`,
          (r) => r.input("id", linkId)
        );
        beforeLink = rows[0] ?? null;

        await queryTx(
          tx,
          `DELETE FROM dbo.server_applications WHERE server_application_id = @id`,
          (r) => r.input("id", linkId)
        );
      } else {
        if (!serverId || !applicationId) {
          return false;
        }

        const rows = await queryTx<any>(
          tx,
          `
          SELECT TOP (1) *
          FROM dbo.server_applications
          WHERE server_id = @server_id AND application_id = @application_id
          ORDER BY updated_at DESC
          `,
          (r) => {
            r.input("server_id", serverId);
            r.input("application_id", applicationId);
          }
        );
        beforeLink = rows[0] ?? { server_id: serverId, application_id: applicationId };

        await queryTx(
          tx,
          `DELETE FROM dbo.server_applications WHERE server_id = @server_id AND application_id = @application_id`,
          (r) => {
            r.input("server_id", serverId);
            r.input("application_id", applicationId);
          }
        );
      }

      const activityServerId: number | null = beforeLink?.server_id != null ? Number(beforeLink.server_id) : serverId;
      const entityId = hasLinkId && linkId ? linkId : `link:${serverId}:${applicationId}`;

      const changes = diffFields(beforeLink, null, [
        "server_id",
        "application_id",
        "ports",
        "database_type",
        "owner_team_id"
      ]);

      await writeAuditActivityAndEmit({
        tx,
        actorUserId: req.user!.userId,
        teamId: req.user!.teamId,
        action: "DELETE",
        entityType: "ApplicationLink",
        entityId,
        before: beforeLink,
        after: null,
        activityMessage: activityServerId ? `Application unlinked from server (#${activityServerId})` : "Application unlinked from server",
        activityAction: "deleted",
        activityMeta: { changes },
        serverId: activityServerId,
        ipAddress: req.ip,
        userAgent: String(req.headers["user-agent"] ?? "") || null
      });

      return true;
    });

    if (!deleted) {
      return ok(res, false);
    }

    return ok(res, true);
  })
);
