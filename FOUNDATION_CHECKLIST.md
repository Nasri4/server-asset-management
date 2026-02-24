# Foundation Completion Checklist

**Goal:** Make the system fully complete, consistent, and production-ready in its current scope. No new big features until this is done.

---

## 1. Port / startup (DONE)
- [x] EADDRINUSE: server now logs a clear message and exits. To free port 5000 on Windows: `netstat -ano | findstr :5000` then `taskkill /PID <pid> /F`.
- [x] Single "Database connected successfully" log (from `config/db.js` on first connect).

---

## 2. Page-by-page audit

| Area | List page | Detail page | Create/Edit | Notes |
|------|-----------|-------------|-------------|--------|
| Servers | /servers | /servers/[id], /servers/[id]/edit | /servers/register | Tabs: Overview, Hardware, Network, Security, Apps, Maintenance, Incidents, Visits, Activity, Credentials |
| Engineers | /engineers | /engineers/[id] | Modal create/edit | Search, filter, View/Edit. No delete (backend has no DELETE). |
| Locations | /locations | /locations/[id] | Modal create/edit/delete | Search added. View/Edit/Delete. |
| Racks | /racks | /racks/[id] | Inline create/edit | View → detail, Edit. |
| Teams | /teams | /teams/[id], /departments/[id] | Modal create/edit | Department View → /departments/[id] (fixed). |
| Applications | /applications | /applications/[id] | Modal create/edit/delete | View/Edit/Delete. |
| Maintenance | /maintenance | — | Create from list, Edit inline | Server column links to /servers/[id]. |
| Incidents | /incidents | — | Create from list, Edit inline | Server column links to /servers/[id]. |
| Monitoring | /monitoring | — | — | |
| Security | /security | — | — | |
| Reports | /reports | — | — | |
| Audit log | /audit-log | — | — | |
| Admin | /admin | — | — | |

---

## 3. List pages – standard (DONE where applicable)
- [x] Clean table/list layout, correct columns.
- [x] Search + filters where appropriate (servers, engineers, locations, incidents, maintenance).
- [x] Pagination (servers).
- [x] Actions: View (→ detail), Edit, Delete (with confirm) on list pages that support it.
- No “View opens messy card dialog”; View = navigate to detail page.

---

## 4. Detail pages – standard
- Complete information, clear sections/tabs.
- Edit button visible.
- Child records visible and manageable (e.g. server → hardware, network, maintenance, incidents).

---

## 5. Create / Edit flows
- Create persists to DB.
- Edit loads existing data and updates correctly.
- Delete confirms and removes.
- Form validation + user feedback (toast/error messages).

---

## 6. Module connections (DONE)
- [x] Servers ↔ Hardware, Network, Security, Apps, Maintenance, Incidents, Visits (via server detail and APIs).
- [x] Engineers ↔ Users (linked identities).
- [x] Department/Teams ↔ Engineers and Servers. Department View → /departments/[id] created so link is valid.
- [x] Locations ↔ Racks ↔ Servers.
- [x] Maintenance/Incidents: Server column links to /servers/[id].
- [x] No broken routes: /departments/[id] page added.

---

## 7. UI consistency
- Standard table design, dialogs, form layout, buttons (hover/active/disabled/loading).
- Hidden Create/Edit/Delete fixed; actions consistent across pages.

---

## 8. Production behavior
- No mock/demo UI; everything DB-backed.
- Proper error handling (no demo fallback).

---

## 9. Final QA
- Navigate entire app without confusion.
- No broken routes or incomplete pages.
- Every module usable end-to-end.

---

*Stop when all existing pages and flows are complete and stable. Do not add new big features until then.*
