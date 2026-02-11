import type { Request, Response, NextFunction } from "express";
import { HttpError } from "./error";
import { isAdmin } from "./auth";

export type TeamScopedEntity = {
  teamId: number | null;
};

export type EntityFetcher<T extends TeamScopedEntity> = (req: Request) => Promise<T | null>;

export function enforceTeamScope<T extends TeamScopedEntity>(
  fetchEntity: EntityFetcher<T>,
  opts?: { allowAdminBypass?: boolean }
) {
  const allowAdminBypass = opts?.allowAdminBypass !== false;

  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (allowAdminBypass && isAdmin(req.user as any)) return next();

      const userTeamId = Number((req.user as any)?.teamId ?? NaN);
      if (!Number.isFinite(userTeamId) || userTeamId <= 0) {
        throw new HttpError(403, "Team assignment required", "TEAM_REQUIRED");
      }

      const entity = await fetchEntity(req);
      if (!entity) throw new HttpError(404, "Not found", "NOT_FOUND");

      if (entity.teamId !== userTeamId) {
        // Do not leak existence across teams.
        throw new HttpError(404, "Not found", "NOT_FOUND");
      }

      next();
    } catch (e) {
      next(e);
    }
  };
}
