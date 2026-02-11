import type sql from "mssql";
import { queryTx, withTransaction } from "../db/sql";
import { realtimeService } from "../services/realtimeService";

type ActivitiesColumnSupport = {
  server_id: boolean;
  action: boolean;
  meta_json: boolean;
};

async function getActivitiesColumnSupport(tx: sql.Transaction): Promise<ActivitiesColumnSupport> {
  const rows = await queryTx<{ server_id: number; action: number; meta_json: number }>(
    tx,
    `
    SELECT
      CASE WHEN COL_LENGTH('dbo.Activities','server_id') IS NULL THEN 0 ELSE 1 END AS server_id,
      CASE WHEN COL_LENGTH('dbo.Activities','action') IS NULL THEN 0 ELSE 1 END AS action,
      CASE WHEN COL_LENGTH('dbo.Activities','meta_json') IS NULL THEN 0 ELSE 1 END AS meta_json
    `
  );
  const r = rows?.[0];
  return {
    server_id: Boolean(r?.server_id),
    action: Boolean(r?.action),
    meta_json: Boolean(r?.meta_json)
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function inferServerId(params: AuditWriteParams): number | null {
  if (params.serverId !== undefined) return params.serverId ?? null;

  // Common convention: Server entity_id == server_id
  if (params.entityType === "Server") {
    const n = Number(params.entityId);
    return Number.isFinite(n) ? n : null;
  }

  // Common convention: these entities frequently use entity_id == server_id
  if (
    params.entityType === "ServerCredentials" ||
    params.entityType === "ServerHardware" ||
    params.entityType === "ServerSecurity"
  ) {
    const n = Number(params.entityId);
    return Number.isFinite(n) ? n : null;
  }

  const fromAfter = isPlainObject(params.after) ? (params.after as any).server_id : undefined;
  const fromBefore = isPlainObject(params.before) ? (params.before as any).server_id : undefined;
  const candidate = fromAfter ?? fromBefore;
  if (candidate == null) return null;
  const n = Number(candidate);
  return Number.isFinite(n) ? n : null;
}

function computeShallowChanges(before: unknown, after: unknown): Record<string, { from: unknown; to: unknown }> {
  if (!isPlainObject(before) && !isPlainObject(after)) return {};

  const beforeObj = (isPlainObject(before) ? before : {}) as Record<string, unknown>;
  const afterObj = (isPlainObject(after) ? after : {}) as Record<string, unknown>;

  const denyKey = (key: string) =>
    /password|secret|token|credential|_enc|hash/i.test(key);

  const keys = new Set<string>([...Object.keys(beforeObj), ...Object.keys(afterObj)]);
  const changes: Record<string, { from: unknown; to: unknown }> = {};

  let count = 0;
  for (const key of keys) {
    if (denyKey(key)) continue;
    const from = beforeObj[key];
    const to = afterObj[key];
    // Compare JSON representations for stability across types.
    if (safeJson(from) === safeJson(to)) continue;
    changes[key] = { from, to };
    count += 1;
    if (count >= 50) break;
  }

  return changes;
}

function safeJson(value: unknown): string | null {
  if (value === undefined) return null;
  if (value === null) return null;
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify({ _error: "UNSERIALIZABLE" });
  }
}

export type AuditWriteParams = {
  tx?: sql.Transaction;
  actorUserId: number;
  teamId: number | null;
  action: string;
  entityType: string;
  entityId: string | number;
  before?: unknown;
  after?: unknown;
  activityMessage: string;
  activityAction?: string | null;
  activityMeta?: unknown;
  serverId?: number | null;
  ipAddress?: string | null;
  userAgent?: string | null;
};

async function writeAuditAndActivityTx(tx: sql.Transaction, params: AuditWriteParams): Promise<number> {
  const beforeJson = safeJson(params.before);
  const afterJson = safeJson(params.after);
  const inferredServerId = inferServerId(params);
  const computedChanges = computeShallowChanges(params.before, params.after);
  const computedMeta = Object.keys(computedChanges).length ? { changes: computedChanges } : null;

  let metaToWrite: unknown = params.activityMeta;
  if (metaToWrite === undefined || metaToWrite === null) {
    metaToWrite = computedMeta;
  } else if (isPlainObject(metaToWrite) && computedMeta && !("changes" in metaToWrite)) {
    metaToWrite = { ...(metaToWrite as Record<string, unknown>), ...(computedMeta as Record<string, unknown>) };
  }

  const metaJson = safeJson(metaToWrite);

  await queryTx(
    tx,
    `
    INSERT INTO dbo.AuditLogs (
      actor_user_id,
      action,
      entity_type,
      entity_id,
      team_id,
      before_json,
      after_json,
      ip_address,
      user_agent,
      created_at
    )
    VALUES (
      @actor_user_id,
      @action,
      @entity_type,
      @entity_id,
      @team_id,
      @before_json,
      @after_json,
      @ip_address,
      @user_agent,
      SYSUTCDATETIME()
    )
    `,
    (r) => {
      r.input("actor_user_id", params.actorUserId);
      r.input("action", params.action);
      r.input("entity_type", params.entityType);
      r.input("entity_id", String(params.entityId));
      r.input("team_id", params.teamId);
      r.input("before_json", beforeJson);
      r.input("after_json", afterJson);
      r.input("ip_address", params.ipAddress ?? null);
      r.input("user_agent", params.userAgent ?? null);
    }
  );

  const support = await getActivitiesColumnSupport(tx);

  const cols: string[] = ["team_id", "actor_user_id", "message", "entity_type", "entity_id", "created_at"];
  const vals: string[] = ["@team_id", "@actor_user_id", "@message", "@entity_type", "@entity_id", "SYSUTCDATETIME()"];

  if (support.server_id) {
    cols.splice(5, 0, "server_id");
    vals.splice(5, 0, "@server_id");
  }
  if (support.action) {
    cols.splice(5, 0, "action");
    vals.splice(5, 0, "@activity_action");
  }
  if (support.meta_json) {
    cols.splice(5, 0, "meta_json");
    vals.splice(5, 0, "@meta_json");
  }

  const activityRows = await queryTx<{ activity_id: number }>(
    tx,
    `
    INSERT INTO dbo.Activities (
      ${cols.join(",\n      ")}
    )
    OUTPUT INSERTED.activity_id AS activity_id
    VALUES (
      ${vals.join(",\n      ")}
    )
    `,
    (r) => {
      r.input("team_id", params.teamId);
      r.input("actor_user_id", params.actorUserId);
      r.input("message", params.activityMessage);
      r.input("entity_type", params.entityType);
      r.input("entity_id", String(params.entityId));
      if (support.server_id) r.input("server_id", inferredServerId);
      if (support.action) r.input("activity_action", params.activityAction ?? null);
      if (support.meta_json) r.input("meta_json", metaJson);
    }
  );

  return Number(activityRows[0]?.activity_id ?? 0);
}

export async function writeAuditAndActivity(params: AuditWriteParams): Promise<number> {
  if (params.tx) {
    return await writeAuditAndActivityTx(params.tx, params);
  }

  return await withTransaction(async (tx) => {
    return await writeAuditAndActivityTx(tx, params);
  });
}

export async function writeAuditActivityAndEmit(params: AuditWriteParams): Promise<number> {
  const activityId = await writeAuditAndActivity(params);
  try {
    realtimeService.emitActivityEvent(activityId, params.serverId ?? null, {
      activityId,
      serverId: params.serverId ?? null,
      entityType: params.entityType,
      entityId: String(params.entityId),
      action: params.activityAction ?? null
    }, params.teamId ?? undefined);
  } catch {
    // best-effort; never fail the request because realtime couldn't emit
  }
  return activityId;
}
