# Server Asset Management: Relation Map + Status Scenarios

## Status Model (Single Source of Truth)

`dbo.servers.status` is derived (not manually set) from operational tables.

Priority (highest → lowest):

1. Open Incident (severity = `Critical`) → `Offline`
2. Any other Open Incident → `Degraded`
3. Active/Scheduled Maintenance → `Maintenance`
4. Otherwise → `Active`

Canonical enums used by backend + DB constraints:

- `dbo.servers.status`: `Active | Maintenance | Degraded | Offline`
- `dbo.server_incidents.status`: `Open | InProgress | Resolved | Closed`
- `dbo.server_incidents.severity`: `Critical | Major | Medium | Low`
- `dbo.server_maintenance.status`: `Scheduled | InProgress | Completed | Cancelled`

## Relation Mapping (FK → referenced table → cardinality)

### Core

| Table           | FK Column     | References                   | Cardinality                            |
| --------------- | ------------- | ---------------------------- | -------------------------------------- |
| `dbo.servers`   | `team_id`     | `dbo.teams(team_id)`         | many servers → one team (nullable)     |
| `dbo.servers`   | `engineer_id` | `dbo.engineers(engineer_id)` | many servers → one engineer (nullable) |
| `dbo.servers`   | `location_id` | `dbo.locations(location_id)` | many servers → one location (nullable) |
| `dbo.servers`   | `rack_id`     | `dbo.racks(rack_id)`         | many servers → one rack (nullable)     |
| `dbo.engineers` | `team_id`     | `dbo.teams(team_id)`         | many engineers → one team (nullable)   |
| `dbo.racks`     | `location_id` | `dbo.locations(location_id)` | many racks → one location (nullable)   |

### Operational (all depend on servers)

| Table                    | FK Column   | References               | Cardinality                                       |
| ------------------------ | ----------- | ------------------------ | ------------------------------------------------- |
| `dbo.server_maintenance` | `server_id` | `dbo.servers(server_id)` | many maintenance → one server                     |
| `dbo.server_incidents`   | `server_id` | `dbo.servers(server_id)` | many incidents → one server                       |
| `dbo.server_network`     | `server_id` | `dbo.servers(server_id)` | many network rows → one server                    |
| `dbo.server_visits`      | `server_id` | `dbo.servers(server_id)` | many visits → one server                          |
| `dbo.server_monitoring`  | `server_id` | `dbo.servers(server_id)` | one monitoring row → one server (PK = server_id)  |
| `dbo.server_security`    | `server_id` | `dbo.servers(server_id)` | one security row → one server (PK = server_id)    |
| `dbo.server_hardware`    | `server_id` | `dbo.servers(server_id)` | one hardware row → one server (PK = server_id)    |
| `dbo.server_credentials` | `server_id` | `dbo.servers(server_id)` | one credentials row → one server (PK = server_id) |

### Logging

| Table            | FK Column | References | Cardinality                                                          |
| ---------------- | --------- | ---------- | -------------------------------------------------------------------- |
| `dbo.audit_logs` | _(none)_  | _(N/A)_    | audit is append-only; references entities via `entity` + `entity_id` |

## Test Scenarios (Expected Outcomes)

These scenarios validate `recalculateServerStatus(server_id)`.

1. **Maintenance Open → Maintenance**
   - Create `server_maintenance` with `status=InProgress` (or `Scheduled` for today)
   - Expect `servers.status = Maintenance`

2. **Maintenance Complete → Active (no incident)**
   - Given no open incidents
   - Update maintenance to `Completed`
   - Expect `servers.status = Active`

3. **Critical Incident Open → Offline**
   - Create `server_incidents` with `status=Open`, `severity=Critical`
   - Expect `servers.status = Offline`

4. **Non-critical Incident Open → Degraded**
   - Create `server_incidents` with `status=Open`, `severity=Major|Medium|Low`
   - Expect `servers.status = Degraded`

5. **Resolved Incident → Active (no maintenance)**
   - Given no active/scheduled maintenance
   - Update incident to `Resolved` (or `Closed`)
   - Expect `servers.status = Active`

6. **Incident + Maintenance Open → Incident Priority Wins**
   - Create maintenance `InProgress`
   - Create incident `Open`:
     - `Critical` → expect `Offline`
     - otherwise → expect `Degraded`

7. **Multi-record Reality: latest open records**
   - Create multiple incidents, ensure at least one is `Open`
   - Create multiple maintenance records
   - Expect:
     - if any incident is open and critical → `Offline`
     - else if any incident is open → `Degraded`
     - else if any maintenance is active/scheduled → `Maintenance`
     - else → `Active`
