# Server Asset Management — Production Readiness

This document summarizes the hardening work completed and the remaining items to reach a production-quality internal enterprise deployment.

## Current Security Posture (Implemented)

### Authentication

- Username + password login (no email-based identity required).
- Passwords verified using bcrypt hashes stored in SQL Server (`dbo.Users.password_hash`).
- Session is a JWT stored in an httpOnly cookie.
- Login endpoint is rate-limited to reduce brute-force risk.

### Authorization (RBAC)

- Roles: **Admin** and **Engineer**.
- Permissions are validated server-side on routes.
- Frontend gates UI features using the same permission keys.

### Team Isolation

- For non-admin users, queries are scoped by `team_id` from the session.
- Cross-team access returns **404** (not 403) to avoid data leakage.

### Backend Hardening

- Helmet security headers.
- Request logging via Morgan.
- Centralized error mapping (duplicate key → 409, FK violation → 400) without leaking raw SQL errors.
- Zod request validation helpers (body + query + params).

## Database Hardening (Migration)

A baseline idempotent hardening migration is provided:

- [backend/sql/migrations/2026-01-28_security-hardening-users-rbac-constraints.sql](backend/sql/migrations/2026-01-28_security-hardening-users-rbac-constraints.sql)

It creates/updates:

- `dbo.Users` with `username`, `password_hash`, `team_id`, `is_active`, timestamps
- `dbo.roles` + `dbo.user_roles` with seeds for **Admin** and **Engineer**
- Key uniqueness + indexing (servers/server_code, hostname filtered unique, server_network ip filtered unique)
- Range checks for monitoring thresholds (0–100)

## Fix Plan

### P0 (Required for a manager demo)

- Apply the DB migration above and ensure every login-capable user has:
  - `username` populated
  - a valid bcrypt `password_hash`
  - `team_id` set
  - an entry in `dbo.user_roles` (Admin or Engineer)
- Configure environment:
  - backend: set `JWT_SECRET`, `CORS_ORIGINS`, `CREDENTIALS_ENCRYPTION_KEY`
  - frontend: set `NEXT_PUBLIC_API_BASE_URL`
- Validate end-to-end flows:
  - login → `/auth/me` → core list pages
  - engineer cannot see/modify other team’s assets (404)

### P1 (Production hardening)

- Complete team scoping review for any remaining routes not yet fully scoped.
- Add pagination validation across all list endpoints.
- Add audit coverage where missing (especially security-sensitive operations).
- Replace placeholder SMS sender with real provider integration and safe logging.
- Add CI checks (lint/typecheck/test) and run them in pipeline.

### P2 (Quality / Operational excellence)

- Add structured logging (request id, actor, teamId), log sampling, and retention guidance.
- Add DB-level stored procedures for sensitive writes with TRY/CATCH + transaction + audit.
- Add admin UI for user provisioning + password reset flows.

## Known Issues / Risks

- `npm audit` reports high severity vulnerabilities via a transitive dependency chain (`tar` via `@mapbox/node-pre-gyp`). Address by updating/removing the introducing dependency or migrating to a non-native alternative.
- Existing legacy rows in `dbo.Users` may not have `password_hash` yet; backend login rejects missing/blank hashes.
