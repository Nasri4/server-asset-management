import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { requirePermission } from "../middleware/permissions";
import { query } from "../db/sql";
import { ok } from "../utils/response";

export const auditRouter = Router();

auditRouter.get(
  "/",
  requirePermission("audit.read"),
  asyncHandler(async (_req, res) => {
    const rows = await query(`SELECT TOP 500 * FROM dbo.audit_logs ORDER BY audit_id DESC`);
    return ok(res, rows);
  })
);
