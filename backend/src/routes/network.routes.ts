import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../utils/asyncHandler";
import { requirePermission } from "../middleware/permissions";
import { validateBody } from "../middleware/validate";
import { execProc, execProcTx, query, queryTx, withTransaction } from "../db/sql";
import { created, ok } from "../utils/response";
import { HttpError } from "../middleware/error";
import { scopedTeamId } from "../utils/teamScope";
import { writeAuditActivityAndEmit } from "../services/auditService";
import { diffFields, summarizeChangeMessage } from "../utils/fieldDiff";

export const networkRouter = Router();

let cachedAssignIpParams: Set<string> | null = null;
async function getAssignIpProcParams(): Promise<Set<string> | null> {
  if (cachedAssignIpParams) return cachedAssignIpParams;

  try {
    const rows = await query<{ name: string }>(
      `
      SELECT p.name
      FROM sys.parameters p
      WHERE p.object_id = OBJECT_ID(@proc_name)
      `,
      (r) => r.input("proc_name", "dbo.sp_assign_ip")
    );

    const set = new Set(
      rows
        .map((r) => String(r.name ?? "").trim())
        .filter(Boolean)
        .map((n) => (n.startsWith("@") ? n.slice(1) : n))
    );

    cachedAssignIpParams = set;
    return set;
  } catch {
    // If the DB user cannot read sys.parameters, fall back to sending all params.
    return null;
  }
}

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
 * GET /api/network?server_id=
 * Permission: network.read
 */
networkRouter.get(
  "/",
  requirePermission("network.read"),
  asyncHandler(async (req, res) => {
    const serverId = req.query.server_id ? Number(req.query.server_id) : null;
    const teamId = scopedTeamId(req);

    const rows = await query(
      `
      SELECT TOP 500
        n.network_id,
        n.server_id,
        s.server_code,
        s.hostname,
        n.ip_address,
        n.secondary_ip,
        n.ipv6,
        n.subnet,
        n.vlan,
        n.gateway,
        n.dns_type,
        n.network_type,
        n.bandwidth,
        n.firewall_enabled,
        n.nat_enabled,
        n.created_at,
        n.updated_at
      FROM dbo.server_network n
      LEFT JOIN dbo.servers s ON s.server_id = n.server_id
      WHERE (@team_id IS NULL OR s.team_id = @team_id)
        AND (@server_id IS NULL OR n.server_id = @server_id)
      ORDER BY n.network_id DESC
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
 * GET /api/network/server/:serverId
 */
networkRouter.get(
  "/server/:serverId",
  requirePermission("network.read"),
  asyncHandler(async (req, res) => {
    const serverId = Number(req.params.serverId);
    const teamId = scopedTeamId(req);
    await assertServerVisible(serverId, teamId);

    const rows = await query(
      `
      SELECT TOP 200 *
      FROM dbo.server_network
      WHERE server_id = @server_id
      ORDER BY network_id DESC
      `,
      (r) => r.input("server_id", serverId)
    );

    return ok(res, rows);
  })
);

const schema = z.object({
  server_id: z.number().int().positive(),
  ip_address: z.string().trim().min(1),
  secondary_ip: z.string().trim().optional().nullable(),
  ipv6: z.string().trim().optional().nullable(),
  subnet: z.string().trim().min(1),
  vlan: z.string().trim().optional().nullable(),
  gateway: z.string().trim().optional().nullable(),
  dns_type: z.string().trim().optional().nullable(),
  network_type: z.string().trim().min(1),
  bandwidth: z.string().trim().optional().nullable(),
  firewall_enabled: z.boolean().default(false),
  nat_enabled: z.boolean().default(false)
});

networkRouter.post(
  "/assign-ip",
  requirePermission("network.assign_ip"),
  validateBody(schema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof schema>;
    const teamId = scopedTeamId(req);
    await assertServerVisible(body.server_id, teamId);

    // Friendly duplicate checks (before stored proc throws).
    const ip = body.ip_address.trim();
    const existing = await query<{ network_id: number; server_id: number }>(
      `
      SELECT TOP (1) network_id, server_id
      FROM dbo.server_network
      WHERE LTRIM(RTRIM(ip_address)) = @ip_address
      ORDER BY network_id DESC
      `,
      (r) => r.input("ip_address", ip)
    );

    if (existing[0]) {
      if (existing[0].server_id === body.server_id) {
        throw new HttpError(409, `Network record already exists for this server and IP: ${ip}`, "NETWORK_ALREADY_EXISTS");
      }
      throw new HttpError(409, `IP address already assigned to another server: ${ip}`, "IP_ADDRESS_ALREADY_ASSIGNED");
    }

    const procParams = await getAssignIpProcParams();

    const networkId = await withTransaction(async (tx) => {
      const result = await execProcTx<{ network_id: number }>(tx, "dbo.sp_assign_ip", (r) => {
        const wants = (name: string) => !procParams || procParams.has(name);

        if (wants("server_id")) r.input("server_id", body.server_id);
        if (wants("ip_address")) r.input("ip_address", body.ip_address);

        // Legacy schemas sometimes use these names.
        if (wants("subnet")) r.input("subnet", body.subnet);
        if (wants("subnet_mask")) r.input("subnet_mask", body.subnet);

        if (wants("secondary_ip")) r.input("secondary_ip", body.secondary_ip ?? null);
        if (wants("ipv6")) r.input("ipv6", body.ipv6 ?? null);
        if (wants("vlan")) r.input("vlan", body.vlan ?? null);
        if (wants("gateway")) r.input("gateway", body.gateway ?? null);
        if (wants("dns_type")) r.input("dns_type", body.dns_type ?? null);
        if (wants("network_type")) r.input("network_type", body.network_type);
        if (wants("bandwidth")) r.input("bandwidth", body.bandwidth ?? null);
        if (wants("firewall_enabled")) r.input("firewall_enabled", body.firewall_enabled ?? false);
        if (wants("nat_enabled")) r.input("nat_enabled", body.nat_enabled ?? false);

        // Older tables/procs may require mac_address; we don't collect it in the UI yet.
        if (wants("mac_address")) r.input("mac_address", null);
      });

      const newId = Number(result.recordset?.[0]?.network_id ?? 0);
      const afterRows = await queryTx<any>(
        tx,
        `SELECT TOP (1) * FROM dbo.server_network WHERE network_id = @id`,
        (r) => r.input("id", newId)
      );
      const after = afterRows[0] ?? null;

      const fields = [
        "ip_address",
        "secondary_ip",
        "ipv6",
        "subnet",
        "vlan",
        "gateway",
        "dns_type",
        "network_type",
        "bandwidth",
        "firewall_enabled",
        "nat_enabled"
      ];
      const changes = diffFields(null, after, fields);

      await writeAuditActivityAndEmit({
        tx,
        actorUserId: req.user!.userId,
        teamId: req.user!.teamId,
        action: "CREATE",
        entityType: "Network",
        entityId: newId || body.server_id,
        before: null,
        after,
        activityMessage: "Network assigned",
        activityAction: "created",
        activityMeta: { changes },
        serverId: body.server_id,
        ipAddress: req.ip,
        userAgent: String(req.headers["user-agent"] ?? "") || null
      });

      return newId;
    });

    return created(res, { network_id: networkId });
  })
);

/**
 * PATCH /api/network/:id
 * Permission: network.assign_ip
 */
networkRouter.patch(
  "/:id",
  requirePermission("network.assign_ip"),
  validateBody(schema),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = req.body as z.infer<typeof schema>;

    const ip = body.ip_address.trim();
    const dup = await query<{ network_id: number }>(
      `
      SELECT TOP (1) network_id
      FROM dbo.server_network
      WHERE LTRIM(RTRIM(ip_address)) = @ip_address
        AND network_id <> @id
      `,
      (r) => {
        r.input("ip_address", ip);
        r.input("id", id);
      }
    );

    if (dup[0]) {
      throw new HttpError(409, `IP address already exists: ${ip}`, "IP_ADDRESS_ALREADY_ASSIGNED");
    }

    await withTransaction(async (tx) => {
      const beforeRows = await queryTx<any>(
        tx,
        `SELECT TOP (1) * FROM dbo.server_network WHERE network_id = @id`,
        (r) => r.input("id", id)
      );
      const before = beforeRows[0];
      if (!before) throw new HttpError(404, "Network record not found", "NETWORK_NOT_FOUND");

      await queryTx(
        tx,
        `
        UPDATE dbo.server_network
        SET
          server_id = @server_id,
          ip_address = @ip_address,
          secondary_ip = @secondary_ip,
          ipv6 = @ipv6,
          subnet = @subnet,
          vlan = @vlan,
          gateway = @gateway,
          dns_type = @dns_type,
          network_type = @network_type,
          bandwidth = @bandwidth,
          firewall_enabled = @firewall_enabled,
          nat_enabled = @nat_enabled,
          updated_at = GETDATE()
        WHERE network_id = @id
        `,
        (r) => {
          r.input("id", id);
          r.input("server_id", body.server_id);
          r.input("ip_address", ip);
          r.input("secondary_ip", body.secondary_ip ?? null);
          r.input("ipv6", body.ipv6 ?? null);
          r.input("subnet", body.subnet);
          r.input("vlan", body.vlan ?? null);
          r.input("gateway", body.gateway ?? null);
          r.input("dns_type", body.dns_type ?? null);
          r.input("network_type", body.network_type);
          r.input("bandwidth", body.bandwidth ?? null);
          r.input("firewall_enabled", body.firewall_enabled ?? false);
          r.input("nat_enabled", body.nat_enabled ?? false);
        }
      );

      const afterRows = await queryTx<any>(
        tx,
        `SELECT TOP (1) * FROM dbo.server_network WHERE network_id = @id`,
        (r) => r.input("id", id)
      );
      const after = afterRows[0] ?? null;

      const fields = [
        "ip_address",
        "secondary_ip",
        "ipv6",
        "subnet",
        "vlan",
        "gateway",
        "dns_type",
        "network_type",
        "bandwidth",
        "firewall_enabled",
        "nat_enabled"
      ];
      const changes = diffFields(before, after, fields);
      const msg = summarizeChangeMessage("Network", changes);

      await writeAuditActivityAndEmit({
        tx,
        actorUserId: req.user!.userId,
        teamId: req.user!.teamId,
        action: "UPDATE",
        entityType: "Network",
        entityId: id,
        before,
        after,
        activityMessage: msg,
        activityAction: "updated",
        activityMeta: { changes },
        serverId: Number(after?.server_id ?? before.server_id ?? body.server_id ?? null),
        ipAddress: req.ip,
        userAgent: String(req.headers["user-agent"] ?? "") || null
      });
    });

    return ok(res, true);
  })
);

/**
 * DELETE /api/network/:id
 * Permission: network.assign_ip
 */
networkRouter.delete(
  "/:id",
  requirePermission("network.assign_ip"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);

    await withTransaction(async (tx) => {
      const beforeRows = await queryTx<any>(
        tx,
        `SELECT TOP (1) * FROM dbo.server_network WHERE network_id = @id`,
        (r) => r.input("id", id)
      );
      const before = beforeRows[0] ?? null;

      await queryTx(
        tx,
        `DELETE FROM dbo.server_network WHERE network_id = @id`,
        (r) => r.input("id", id)
      );

      await writeAuditActivityAndEmit({
        tx,
        actorUserId: req.user!.userId,
        teamId: req.user!.teamId,
        action: "DELETE",
        entityType: "Network",
        entityId: id,
        before,
        after: null,
        activityMessage: "Network record deleted",
        activityAction: "deleted",
        activityMeta: before ? { changes: diffFields(before, null, [
          "ip_address",
          "secondary_ip",
          "ipv6",
          "subnet",
          "vlan",
          "gateway",
          "dns_type",
          "network_type",
          "bandwidth",
          "firewall_enabled",
          "nat_enabled"
        ]) } : null,
        serverId: Number(before?.server_id ?? null),
        ipAddress: req.ip,
        userAgent: String(req.headers["user-agent"] ?? "") || null
      });
    });

    return ok(res, true);
  })
);
