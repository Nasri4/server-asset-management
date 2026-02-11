# V2 Testing & Validation Checklist

## Pre-Testing Setup

- [ ] Database migration completed successfully
- [ ] Backend server running without errors
- [ ] Frontend development server running
- [ ] Browser console open for debugging
- [ ] Network tab open to monitor SSE connection

---

## 1. Database Schema Verification

### Tables

- [ ] `servers` table has `health_status` column
- [ ] `servers` table has `status_override` column
- [ ] `servers` table has `status_override_by` column
- [ ] `servers` table has `status_override_at` column
- [ ] `server_security` table exists with all required columns
- [ ] `activity_log` table exists with `server_id` column
- [ ] All tables have proper foreign keys

### Indexes

- [ ] `IX_servers_status_health` exists
- [ ] `IX_server_incidents_status_severity` exists
- [ ] `IX_server_maintenance_status_scheduled` exists
- [ ] `IX_server_visits_status_scheduled` exists
- [ ] `IX_activity_log_server_id` exists
- [ ] `IX_audit_logs_entity` exists

### Constraints

- [ ] `CK_servers_status` includes new statuses (Down, Issue, Warning, etc.)
- [ ] `CK_servers_health_status` exists
- [ ] `CK_server_security_hardening_status` exists

---

## 2. Backend API Testing

### Server Status Engine

#### Test 1: Critical Incident → Down

- [ ] Create server with status "Active"
- [ ] Create incident with severity "Critical" and status "Open"
- [ ] Verify server status changes to "Down"
- [ ] Check `audit_logs` for status change
- [ ] Check `activity_log` for status change event

#### Test 2: Major Incident → Degraded

- [ ] Create server with status "Active"
- [ ] Create incident with severity "Major" and status "Open"
- [ ] Verify server status changes to "Degraded"

#### Test 3: Incident Resolution

- [ ] Server in "Down" status due to critical incident
- [ ] Resolve the incident (status = "Resolved")
- [ ] Verify server status changes back to "Active"

#### Test 4: Maintenance → Maintenance Status

- [ ] Create server with status "Active"
- [ ] Create maintenance with status "InProgress"
- [ ] Verify server status changes to "Maintenance"

#### Test 5: Maintenance Completion

- [ ] Server in "Maintenance" status
- [ ] Complete the maintenance (completed_at = NOW)
- [ ] Verify server status changes back to "Active"

#### Test 6: Priority Order (Incident > Maintenance)

- [ ] Create server with status "Active"
- [ ] Create maintenance with status "InProgress" → status = "Maintenance"
- [ ] Create incident with severity "Critical" and status "Open"
- [ ] Verify server status changes to "Down" (incident wins)
- [ ] Resolve incident
- [ ] Verify server status changes to "Maintenance" (maintenance still active)
- [ ] Complete maintenance
- [ ] Verify server status changes to "Active"

#### Test 7: Manual Status Override

- [ ] Create server with active incident (status should be "Down")
- [ ] Set status override to "Active" via POST `/api/servers/:id/status/override`
- [ ] Verify server status is "Active" despite incident
- [ ] Check `status_override`, `status_override_by`, `status_override_at` fields
- [ ] Clear status override via DELETE `/api/servers/:id/status/override`
- [ ] Verify server status recomputes back to "Down"

#### Test 8: Status Recomputation Endpoint

- [ ] Create server with incident
- [ ] Manually call POST `/api/servers/:id/status/recompute`
- [ ] Verify response shows correct status and reason
- [ ] Verify `changed` flag is correct

#### Test 9: Monitoring Health → Status

- [ ] Create server with status "Active"
- [ ] Update monitoring health_status to "Critical"
- [ ] Verify server status changes to "Degraded"
- [ ] Update monitoring health_status to "Down"
- [ ] Verify server status changes to "Down"

### Activity Timeline

- [ ] GET `/api/servers/:id/activity` returns activities
- [ ] Activities are sorted by `created_at DESC`
- [ ] Pagination works (limit, offset)
- [ ] Activities include actor_name for user actions
- [ ] Activities include "System" for automated actions
- [ ] All entity types are recorded (incident, maintenance, visit, security, etc.)

### Real-time Endpoints

- [ ] GET `/api/realtime/events` establishes SSE connection
- [ ] Connection sends `connection.established` event with clientId
- [ ] Health check (system.ping) is sent every 30 seconds
- [ ] GET `/api/realtime/stats` returns connected clients count
- [ ] POST `/api/realtime/subscribe/:serverId` works
- [ ] POST `/api/realtime/unsubscribe/:serverId` works

---

## 3. Real-time Event Testing

### Server Events

#### Test: server.created

- [ ] Open SSE connection in browser
- [ ] Create new server via API or UI
- [ ] Verify `server.created` event is received
- [ ] Event data includes server_code, hostname, status

#### Test: server.updated

- [ ] Open SSE connection
- [ ] Update existing server
- [ ] Verify `server.updated` event is received
- [ ] Event data includes changes array

#### Test: server.status.changed

- [ ] Open SSE connection
- [ ] Create incident that changes server status
- [ ] Verify `server.status.changed` event is received
- [ ] Event data includes oldStatus, newStatus, reason, source

#### Test: server.deleted

- [ ] Open SSE connection
- [ ] Delete a server
- [ ] Verify `server.deleted` event is received

### Incident Events

- [ ] `incident.created` event fires when incident created
- [ ] `incident.updated` event fires when incident updated
- [ ] `incident.resolved` event fires when incident resolved
- [ ] Events include incidentId, serverId, severity, description

### Maintenance Events

- [ ] `maintenance.created` event fires when maintenance created
- [ ] `maintenance.updated` event fires when maintenance updated
- [ ] `maintenance.completed` event fires when maintenance completed
- [ ] Events include maintenanceId, serverId, maintenance_type, status

### Visit Events

- [ ] `visit.created` event fires when visit created
- [ ] `visit.updated` event fires when visit updated
- [ ] `visit.completed` event fires when visit completed

### Security Events

- [ ] `security.updated` event fires when security updated
- [ ] Event includes serverId, hardening_status, compliance data

### Monitoring Events

- [ ] `monitoring.updated` event fires when monitoring updated
- [ ] Event includes serverId, health_status, cpu/memory/disk usage

### Activity Events

- [ ] `activity.created` event fires when activity logged
- [ ] Event includes activityId, serverId, entity_type, action

---

## 4. Frontend Real-time Testing

### SSE Connection

- [ ] Open dashboard page
- [ ] Check browser console for "[SSE] Connecting..." message
- [ ] Verify "[SSE] Connected successfully" appears
- [ ] Verify real-time indicator shows green dot with "Live updates enabled"
- [ ] Check Network tab shows `realtime/events` with status "pending" (persistent)

### Server List Real-time Updates

- [ ] Open servers page in Tab A
- [ ] Create new server in Tab B (or via API)
- [ ] Verify new server appears in Tab A without refresh
- [ ] Update server status in Tab B
- [ ] Verify status badge updates in Tab A without refresh
- [ ] Delete server in Tab B
- [ ] Verify server disappears from Tab A without refresh

### Server Details Real-time Updates

- [ ] Open server details page in Tab A (e.g., `/servers/1`)
- [ ] Update server in Tab B
- [ ] Verify details update in Tab A without refresh
- [ ] Create incident for server in Tab B
- [ ] Verify status changes in Tab A
- [ ] Verify activity tab shows new activity

### Dashboard Real-time Updates

- [ ] Open dashboard in Tab A
- [ ] Create server in Tab B
- [ ] Verify "Total Servers" count increments in Tab A without refresh
- [ ] Create critical incident in Tab B
- [ ] Verify "Servers Down" count increments
- [ ] Verify "Open Incidents" count increments
- [ ] Create maintenance in Tab B
- [ ] Verify "Servers in Maintenance" count updates

### Activity Tab Real-time Updates

- [ ] Open server details → Activity tab
- [ ] Perform actions (update server, create incident, etc.)
- [ ] Verify new activities appear at top without refresh
- [ ] Verify timestamps show relative time ("2 seconds ago")
- [ ] Verify actor names are displayed correctly
- [ ] Verify activity types have correct icons and badges

### Reconnection Handling

- [ ] Establish SSE connection
- [ ] Stop backend server
- [ ] Verify "[SSE] Connection error" in console
- [ ] Verify reconnection attempts with exponential backoff
- [ ] Restart backend server
- [ ] Verify "[SSE] Connected successfully" appears
- [ ] Verify real-time updates work after reconnection

---

## 5. Integration Testing

### End-to-End: Incident Lifecycle

1. [ ] Create server "SRV-001" with status "Active"
2. [ ] Open server details page
3. [ ] Create critical incident via Incidents tab
4. [ ] **Verify** status badge changes to "Down" (real-time)
5. [ ] **Verify** activity tab shows "Incident Created" event
6. [ ] **Verify** dashboard "Servers Down" count increases
7. [ ] Resolve incident
8. [ ] **Verify** status badge changes to "Active" (real-time)
9. [ ] **Verify** activity tab shows "Incident Resolved" event
10. [ ] **Verify** dashboard "Servers Down" count decreases

### End-to-End: Maintenance Lifecycle

1. [ ] Create server "SRV-002" with status "Active"
2. [ ] Create maintenance with status "InProgress"
3. [ ] **Verify** server status changes to "Maintenance" (real-time)
4. [ ] **Verify** dashboard "Servers in Maintenance" count increases
5. [ ] Complete maintenance
6. [ ] **Verify** server status changes to "Active" (real-time)
7. [ ] **Verify** activity tab shows "Maintenance Completed" event

### End-to-End: Priority Testing

1. [ ] Create server "SRV-003"
2. [ ] Create maintenance (InProgress) → status = "Maintenance"
3. [ ] Create critical incident → **Verify** status changes to "Down"
4. [ ] Resolve incident → **Verify** status changes to "Maintenance"
5. [ ] Complete maintenance → **Verify** status changes to "Active"
6. [ ] **Verify** all transitions recorded in activity log

### Multi-Client Real-time

1. [ ] Open dashboard in Browser A
2. [ ] Open dashboard in Browser B
3. [ ] Create incident in Browser A
4. [ ] **Verify** Browser B updates without refresh
5. [ ] Create maintenance in Browser B
6. [ ] **Verify** Browser A updates without refresh

---

## 6. Performance Testing

### Database Performance

- [ ] Query servers list with 100+ servers → response < 500ms
- [ ] Query server details with relations → response < 300ms
- [ ] Status recomputation → completes < 100ms
- [ ] Activity log query (100 records) → response < 200ms
- [ ] Indexes are being used (check execution plan)

### SSE Performance

- [ ] Connect 10 clients simultaneously
- [ ] Broadcast event → all clients receive within 100ms
- [ ] Server memory usage remains stable
- [ ] No connection leaks (clients disconnect properly)
- [ ] Health check (ping) every 30 seconds works

### Frontend Performance

- [ ] Server list page loads < 1 second
- [ ] Server details page loads < 800ms
- [ ] Dashboard loads < 1 second
- [ ] Real-time updates don't cause jank
- [ ] Activity tab pagination works smoothly

---

## 7. Edge Cases & Error Handling

### Backend

- [ ] Recompute status for non-existent server → 404 error
- [ ] Create incident with invalid severity → validation error
- [ ] Set status override without permission → 403 error
- [ ] Clear status override when none set → no error
- [ ] Multiple concurrent status updates → no race conditions
- [ ] Database connection failure → graceful error

### Frontend

- [ ] SSE connection fails → shows "Connecting..." indicator
- [ ] Network error during fetch → shows error message
- [ ] Server deleted while viewing details → redirects or shows error
- [ ] Real-time event for different team → not displayed (team scoping)

---

## 8. Security Testing

### RBAC

- [ ] User without `servers.update` permission cannot recompute status
- [ ] User without `servers.update` permission cannot set status override
- [ ] User can only see servers from their team (non-admin)
- [ ] Admin can see all servers across teams

### CORS & Authentication

- [ ] SSE connection requires valid JWT token
- [ ] SSE connection respects CORS policy
- [ ] Expired token → SSE disconnects and reconnects after re-auth

### Data Validation

- [ ] Status override with invalid status → validation error
- [ ] Activity endpoint with negative offset → validation error
- [ ] Malformed JSON in request → 400 error

---

## 9. Documentation & Code Quality

- [ ] All new functions have TypeScript types
- [ ] All new API endpoints have JSDoc comments
- [ ] V2_INTEGRATION_GUIDE.md is complete and accurate
- [ ] V2_TESTING_CHECKLIST.md is complete
- [ ] No console.error in production code
- [ ] No TODO comments left in code

---

## 10. Production Readiness

- [ ] All migrations tested on staging database
- [ ] Database backup taken before production migration
- [ ] Environment variables configured
- [ ] Logging configured for production
- [ ] Error tracking configured (Sentry, etc.)
- [ ] Health check endpoint works
- [ ] Monitoring alerts configured
- [ ] Load testing completed
- [ ] Rollback plan documented

---

## Test Results Summary

| Category             | Tests Passed | Tests Failed | Notes |
| -------------------- | ------------ | ------------ | ----- |
| Database Schema      | /            | /            |       |
| Backend API          | /            | /            |       |
| Real-time Events     | /            | /            |       |
| Frontend Real-time   | /            | /            |       |
| Integration          | /            | /            |       |
| Performance          | /            | /            |       |
| Edge Cases           | /            | /            |       |
| Security             | /            | /            |       |
| Documentation        | /            | /            |       |
| Production Readiness | /            | /            |       |

**Overall Status**: ⏳ PENDING / ✅ PASSED / ❌ FAILED

---

## Sign-off

- [ ] QA Lead Approval
- [ ] Technical Lead Approval
- [ ] Product Owner Approval
- [ ] Ready for Production Deployment

---

**Testing Completed By**: ************\_\_\_************

**Date**: ************\_\_\_************

**Signature**: ************\_\_\_************
