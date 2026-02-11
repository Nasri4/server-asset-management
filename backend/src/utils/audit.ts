import type sql from "mssql";
import { query, queryTx } from "../db/sql";

export async function audit(params: {
  actor: string;
  action: string;
  entity: string;
  entityId?: string | number | null;
  details?: any;
  tx?: sql.Transaction;
}) {
  const detailsText = params.details ? JSON.stringify(params.details) : null;

  const sqlText = `
    INSERT INTO dbo.audit_logs(actor, action, entity, entity_id, details, created_at, updated_at)
    VALUES(@actor, @action, @entity, @entity_id, @details, GETDATE(), GETDATE())
    `;

  const input = (r: any) => {
      r.input("actor", params.actor);
      r.input("action", params.action);
      r.input("entity", params.entity);
      r.input("entity_id", params.entityId == null ? null : String(params.entityId));
      r.input("details", detailsText);
  };

  if (params.tx) {
    await queryTx(params.tx, sqlText, input);
    return;
  }

  await query(sqlText, input);
}

// Backward-compat helper used by some utilities.
export async function logAudit(
  entity: string,
  entityId: number,
  action: string,
  actorUserId: number | null,
  description: string,
  tx?: sql.Transaction
) {
  await audit({
    actor: actorUserId != null ? `user:${actorUserId}` : "system",
    action,
    entity,
    entityId,
    details: { description },
    tx
  });
}
