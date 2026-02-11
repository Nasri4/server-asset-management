# Server Asset Management (SAM) – Frontend

Enterprise dashboard for Hormuud Telecom (Somalia). The backend already exists and exposes secure REST APIs (cookie-based session + RBAC permissions). This frontend is intentionally calm and infrastructure-oriented: clear hierarchy, readable spacing, and minimal motion.

## Tech Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS + shadcn/ui
- next-themes (Light/Dark)
- axios (with credentials)
- react-hook-form + zod
- sonner (toasts)
- framer-motion (subtle fade-in only)
- lucide-react icons

## Getting Started

1. Configure API base URL:

Create `.env.local`:

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001
```

This should point to the Express backend origin (the cookie session is set by the backend).

2. Install and run:

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## App Structure

- `src/app/(app)/*` – Authenticated application routes (App Shell)
- `src/app/login` – Login screen
- `src/components/layout/*` – Topbar + Sidebar + shell
- `src/lib/api/client.ts` – Axios client (`withCredentials`, baseURL, global error handling + 401 redirect)
- `src/lib/nav.ts` + `src/lib/rbac.ts` – Role-aware navigation and permission checks

## RBAC + Role Behavior

- The UI hides unauthorized navigation/actions (does not render disabled buttons).
- Admin
  - Full navigation (incl. Audit Logs + Settings)
  - Can create/update based on permission keys
- ICT
  - Audit Logs and Settings are hidden
  - No delete actions are shown anywhere
  - Maintenance and Security sections are treated as read-only

The backend is the source of truth for permissions; the UI uses `user.permissions` from `/auth/me`.

## Design Notes

- Typography: Inter (system-friendly, readable)
- Palette: deep indigo primary + slate/neutral surfaces; muted amber reserved for warnings
- Components: shadcn/ui with CSS variable tokens (light/dark)
- Motion: only subtle page fade-in; no heavy transitions/spinners

## Pages Implemented

- Dashboard: summary cards, recent incidents table (auto-populates if a GET incidents endpoint exists)
- Servers: searchable inventory table
- Server Details: tabs + editable overview (PATCH `/api/servers/:id`)

## Backend Endpoints Used

- `POST /auth/login`, `GET /auth/me`, `POST /auth/logout`
- `GET /api/servers`, `GET /api/servers/:id`, `POST /api/servers`, `PATCH /api/servers/:id`
- `GET /api/audit` (Admin)
- `POST /api/incidents` (if permission allows)

## Notes

- If `NEXT_PUBLIC_API_BASE_URL` is missing or wrong, requests will fail and login won’t work.
- Cookies require `withCredentials: true` (already configured in the axios client).
