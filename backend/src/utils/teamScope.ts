import type { Request } from "express";
import { HttpError } from "../middleware/error";
import { isAdmin } from "../middleware/auth";

export function scopedTeamId(req: Request): number | null {
  if (isAdmin(req.user)) return null;
  const teamId = Number((req.user as any)?.teamId ?? NaN);
  if (!Number.isFinite(teamId) || teamId <= 0) {
    // A non-admin must always be assigned to a team.
    // Treat this as a forbidden/invalid-account state, not an internal server error.
    throw new HttpError(403, "Team assignment required", "TEAM_REQUIRED");
  }
  return teamId;
}
