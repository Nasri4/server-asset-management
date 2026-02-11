# 🏢 Hormuud Telecom - Enterprise RBAC Quick Start Guide

## Overview

Complete enterprise RBAC implementation with:
- ✅ 3 Roles: **Admin**, **TeamLead**, **Engineer**
- ✅ 31 Granular Permissions
- ✅ Team Scoping (TeamLead sees only their team)
- ✅ Server Scoping (Engineer sees only assigned servers)
- ✅ Automatic Server Status Engine
- ✅ Comprehensive Activity Logging
- ✅ Credential Management with encryption
- ✅ Role-based UI/Sidebar

---

## Step 1: Run Database Migration (5 minutes)

```bash
cd backend
sqlcmd -S localhost -d SERVER_ASSET_MANAGEMENT -i sql/migrations/2026-02-07_hormuud-rbac-schema.sql
```

This creates:
- ✅ `roles` table with Admin, TeamLead, Engineer
- ✅ `permissions` table with 31 permissions
- ✅ `role_permissions` junction table
- ✅ `Users` table enhanced with `role_id`
- ✅ `server_activity` table for comprehensive logging
- ✅ `server_credentials` table with user tracking
- ✅ All FK relationships and indexes

---

## Step 2: Start Backend (1 minute)

```bash
cd backend
npm install
npm run dev
```

**Important**: Make sure you're in the `backend` directory!

---

## Step 3: Integration Checklist

### Backend Files Created ✅

1. **`backend/src/middleware/rbac.ts`**
   - `loadUserRBAC(userId)` - Load user with full permissions
   - `can(user, permission)` - Check permission
   - `requirePermission(permission)` - Middleware
   - `scopedTeamId(user)` - Get team scope
   - `scopedEngineerId(user)` - Get engineer scope
   - `assertServerVisible(user, serverId)` - Check server access
   - `assertServerAssigned(user, serverId)` - Check server assignment
   - `getServersScoped(user, filters)` - Get filtered servers
   - `shouldRedactActivity()` - Activity redaction logic

2. **`backend/src/utils/serverStatusEngine.ts`**
   - `updateServerStatus(serverId, userId, tx)` - Auto-compute status
   - `recomputeServerStatus(serverId, userId)` - Manual recompute

3. **`backend/src/utils/activityLogger.ts`**
   - `logServerActivity()` - Core logging function
   - `getServerActivity()` - Get activity with redaction
   - Helper functions for all activity types

### Backend Integration Points ⏳

#### 1. Update Auth Middleware

**File**: `backend/src/middleware/auth.ts`

```typescript
import { loadUserRBAC, type RBACUser } from "./rbac";

// After JWT verification, load full RBAC context:
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies.token || req.headers.authorization?.replace("Bearer ", "");
    
    if (!token) {
      throw new HttpError(401, "Authentication required", "UNAUTHORIZED");
    }
    
    const decoded = jwt.verify(token, env.jwt.secret) as { userId: number };
    
    // Load full RBAC context
    const user = await loadUserRBAC(decoded.userId);
    
    if (!user) {
      throw new HttpError(401, "User not found or inactive", "UNAUTHORIZED");
    }
    
    req.user = user;
    next();
  } catch (error) {
    throw new HttpError(401, "Invalid token", "UNAUTHORIZED");
  }
}
```

#### 2. Update Servers Router

**File**: `backend/src/routes/servers.routes.ts`

```typescript
import { 
  requirePermission, 
  getServersScoped, 
  assertServerVisible,
  assertServerAssigned,
  type RBACUser 
} from "../middleware/rbac";
import { logServerCreated, logServerUpdated } from "../utils/activityLogger";
import { updateServerStatus } from "../utils/serverStatusEngine";

// GET /api/servers - Scoped list
router.get("/", requireAuth, async (req: RBACRequest, res) => {
  const user = req.user!;
  const search = req.query.search as string | undefined;
  
  const servers = await getServersScoped(user, { search });
  
  // Separate "My Servers" vs "Team Servers" for Engineer
  if (user.roleName === "Engineer") {
    const myServers = servers.filter(s => s.is_assigned_to_me === 1);
    const teamServers = servers.filter(s => s.is_assigned_to_me === 0);
    
    return ok(res, {
      myServers,
      teamServers,
      totalMy: myServers.length,
      totalTeam: teamServers.length
    });
  }
  
  return ok(res, { servers });
});

// POST /api/servers - Create (Admin only)
router.post("/", requirePermission("servers.create"), async (req: RBACRequest, res) => {
  const user = req.user!;
  const body = req.body;
  
  const serverId = await transaction(async (tx) => {
    // Insert server
    const [inserted] = await queryTx<{ server_id: number }>(
      tx,
      `INSERT INTO dbo.servers (...) OUTPUT INSERTED.server_id VALUES (...)`,
      (r) => { /* params */ }
    );
    
    const newId = inserted.server_id;
    
    // Log activity
    await logServerCreated(newId, user.userId, body.server_code, body.hostname, tx);
    
    // Set initial status
    await updateServerStatus(newId, user.userId, tx);
    
    return newId;
  });
  
  return created(res, { server_id: serverId });
});

// GET /api/servers/:id - View server
router.get("/:id", requireAuth, async (req: RBACRequest, res) => {
  const user = req.user!;
  const serverId = parseInt(req.params.id);
  
  // Check visibility
  await assertServerVisible(user, serverId);
  
  // Get server details...
  return ok(res, { server });
});

// GET /api/servers/:id/activity - Activity log
router.get("/:id/activity", requireAuth, async (req: RBACRequest, res) => {
  const user = req.user!;
  const serverId = parseInt(req.params.id);
  
  await assertServerVisible(user, serverId);
  
  const activity = await getServerActivity(
    serverId,
    user.roleName,
    user.userId,
    50,
    0
  );
  
  return ok(res, { activity });
});
```

#### 3. Update Maintenance Router

**File**: `backend/src/routes/maintenance.routes.ts`

```typescript
import { requireAnyPermission, assertServerVisible, type RBACUser } from "../middleware/rbac";
import { logMaintenanceScheduled, logMaintenanceCompleted } from "../utils/activityLogger";
import { updateServerStatus } from "../utils/serverStatusEngine";

// POST /api/maintenance - Schedule (Admin/TeamLead)
router.post(
  "/",
  requireAnyPermission(["maintenance.schedule.all", "maintenance.schedule.team"]),
  async (req: RBACRequest, res) => {
    const user = req.user!;
    const { server_id, assigned_engineer_id, schedule_type, scheduled_start, scheduled_end, notes } = req.body;
    
    // Check server access
    await assertServerVisible(user, server_id);
    
    const maintenanceId = await transaction(async (tx) => {
      const [inserted] = await queryTx<{ maintenance_id: number }>(
        tx,
        `
        INSERT INTO dbo.server_maintenance (
          server_id, scheduled_by_user_id, assigned_engineer_id,
          schedule_type, scheduled_start, scheduled_end,
          status, notes, created_at
        )
        OUTPUT INSERTED.maintenance_id
        VALUES (@server_id, @scheduled_by, @assigned_engineer, @schedule_type,
                @start, @end, 'Scheduled', @notes, GETDATE())
        `,
        (r) => {
          r.input("server_id", server_id);
          r.input("scheduled_by", user.userId);
          r.input("assigned_engineer", assigned_engineer_id || null);
          r.input("schedule_type", schedule_type);
          r.input("start", scheduled_start);
          r.input("end", scheduled_end);
          r.input("notes", notes || null);
        }
      );
      
      const newId = inserted.maintenance_id;
      
      // Log activity
      await logMaintenanceScheduled(
        server_id,
        user.userId,
        newId,
        assigned_engineer_id,
        schedule_type,
        tx
      );
      
      // Update server status
      await updateServerStatus(server_id, user.userId, tx);
      
      return newId;
    });
    
    return created(res, { maintenance_id: maintenanceId });
  }
);

// PATCH /api/maintenance/:id/complete - Complete (Engineer assigned)
router.patch(
  "/:id/complete",
  requirePermission("maintenance.complete.assigned"),
  async (req: RBACRequest, res) => {
    const user = req.user!;
    const maintenanceId = parseInt(req.params.id);
    
    // Get maintenance and verify assignment
    const [maintenance] = await query<{ server_id: number; assigned_engineer_id: number | null }>(
      "SELECT server_id, assigned_engineer_id FROM dbo.server_maintenance WHERE maintenance_id = @id",
      (r) => r.input("id", maintenanceId)
    );
    
    if (!maintenance) {
      throw new HttpError(404, "Maintenance not found", "NOT_FOUND");
    }
    
    // Engineer must be assigned
    if (user.roleName === "Engineer" && maintenance.assigned_engineer_id !== user.engineerId) {
      throw new HttpError(403, "Maintenance not assigned to you", "NOT_ASSIGNED");
    }
    
    await transaction(async (tx) => {
      // Mark as completed
      await queryTx(
        tx,
        `
        UPDATE dbo.server_maintenance
        SET status = 'Completed', completed_at = GETDATE(), updated_at = GETDATE()
        WHERE maintenance_id = @id
        `,
        (r) => r.input("id", maintenanceId)
      );
      
      // Log activity
      await logMaintenanceCompleted(maintenance.server_id, user.userId, maintenanceId, tx);
      
      // Update server status (may return to ACTIVE)
      await updateServerStatus(maintenance.server_id, user.userId, tx);
    });
    
    return ok(res, { success: true });
  }
);
```

#### 4. Update Incidents Router

**File**: `backend/src/routes/incidents.routes.ts`

```typescript
import { requirePermission, assertServerVisible } from "../middleware/rbac";
import { logIncidentCreated, logIncidentResolved } from "../utils/activityLogger";
import { updateServerStatus } from "../utils/serverStatusEngine";

// POST /api/incidents - Create (Admin/TeamLead)
router.post("/", requirePermission("incidents.create"), async (req: RBACRequest, res) => {
  const user = req.user!;
  const { server_id, severity, status, summary } = req.body;
  
  await assertServerVisible(user, server_id);
  
  const incidentId = await transaction(async (tx) => {
    const [inserted] = await queryTx<{ incident_id: number }>(
      tx,
      `
      INSERT INTO dbo.server_incidents (
        server_id, created_by_user_id, severity, status, summary, opened_at
      )
      OUTPUT INSERTED.incident_id
      VALUES (@server_id, @created_by, @severity, @status, @summary, GETDATE())
      `,
      (r) => {
        r.input("server_id", server_id);
        r.input("created_by", user.userId);
        r.input("severity", severity);
        r.input("status", status || "Open");
        r.input("summary", summary);
      }
    );
    
    const newId = inserted.incident_id;
    
    // Log activity
    await logIncidentCreated(server_id, user.userId, newId, severity, summary, tx);
    
    // Update server status (will become INCIDENT)
    await updateServerStatus(server_id, user.userId, tx);
    
    return newId;
  });
  
  return created(res, { incident_id: incidentId });
});

// PATCH /api/incidents/:id/resolve - Resolve
router.patch("/:id/resolve", requirePermission("incidents.update"), async (req: RBACRequest, res) => {
  const user = req.user!;
  const incidentId = parseInt(req.params.id);
  
  const [incident] = await query<{ server_id: number }>(
    "SELECT server_id FROM dbo.server_incidents WHERE incident_id = @id",
    (r) => r.input("id", incidentId)
  );
  
  if (!incident) {
    throw new HttpError(404, "Incident not found", "NOT_FOUND");
  }
  
  await assertServerVisible(user, incident.server_id);
  
  await transaction(async (tx) => {
    // Mark as resolved
    await queryTx(
      tx,
      `
      UPDATE dbo.server_incidents
      SET status = 'Resolved', resolved_at = GETDATE(), updated_at = GETDATE()
      WHERE incident_id = @id
      `,
      (r) => r.input("id", incidentId)
    );
    
    // Log activity
    await logIncidentResolved(incident.server_id, user.userId, incidentId, tx);
    
    // Update server status (may return to ACTIVE)
    await updateServerStatus(incident.server_id, user.userId, tx);
  });
  
  return ok(res, { success: true });
});
```

#### 5. Update Visits Router

**File**: `backend/src/routes/visits.routes.ts`

```typescript
import { requirePermission, assertServerAssigned } from "../middleware/rbac";
import { logVisitCreated, logVisitCompleted } from "../utils/activityLogger";

// POST /api/visits - Create (Engineer for own servers)
router.post("/", requirePermission("visits.create.own"), async (req: RBACRequest, res) => {
  const user = req.user!;
  const { server_id, visit_type, visit_date, notes } = req.body;
  
  // Engineer must be assigned to server
  await assertServerAssigned(user, server_id);
  
  const visitId = await transaction(async (tx) => {
    const [inserted] = await queryTx<{ visit_id: number }>(
      tx,
      `
      INSERT INTO dbo.server_visits (
        server_id, engineer_id, visit_type, visit_date, status, notes, created_at
      )
      OUTPUT INSERTED.visit_id
      VALUES (@server_id, @engineer_id, @visit_type, @visit_date, 'Planned', @notes, GETDATE())
      `,
      (r) => {
        r.input("server_id", server_id);
        r.input("engineer_id", user.engineerId);
        r.input("visit_type", visit_type);
        r.input("visit_date", visit_date);
        r.input("notes", notes || null);
      }
    );
    
    const newId = inserted.visit_id;
    
    // Log activity
    await logVisitCreated(server_id, user.userId, newId, visit_type, tx);
    
    return newId;
  });
  
  return created(res, { visit_id: visitId });
});

// PATCH /api/visits/:id/complete - Complete
router.patch("/:id/complete", requirePermission("visits.complete.own"), async (req: RBACRequest, res) => {
  const user = req.user!;
  const visitId = parseInt(req.params.id);
  
  const [visit] = await query<{ server_id: number; engineer_id: number | null }>(
    "SELECT server_id, engineer_id FROM dbo.server_visits WHERE visit_id = @id",
    (r) => r.input("id", visitId)
  );
  
  if (!visit) {
    throw new HttpError(404, "Visit not found", "NOT_FOUND");
  }
  
  // Engineer must own the visit
  if (user.roleName === "Engineer" && visit.engineer_id !== user.engineerId) {
    throw new HttpError(403, "Visit not assigned to you", "NOT_ASSIGNED");
  }
  
  await transaction(async (tx) => {
    await queryTx(
      tx,
      `
      UPDATE dbo.server_visits
      SET status = 'Completed', completed_at = GETDATE()
      WHERE visit_id = @id
      `,
      (r) => r.input("id", visitId)
    );
    
    // Log activity
    await logVisitCompleted(visit.server_id, user.userId, visitId, tx);
  });
  
  return ok(res, { success: true });
});
```

#### 6. Create Credentials Router

**File**: `backend/src/routes/credentials.routes.ts`

```typescript
import { Router } from "express";
import { requireAuth, requirePermission, assertServerAssigned, type RBACRequest } from "../middleware/rbac";
import { logCredentialsUpdated, logCredentialsRevealed } from "../utils/activityLogger";
import { encryptSecret, decryptSecret } from "../utils/credentialsCrypto";
import { asyncHandler } from "../utils/asyncHandler";
import { ok } from "../utils/response";
import { query, transaction, queryTx } from "../db/sql";

export const credentialsRouter = Router();

// GET /api/servers/:id/credentials - Get metadata only
credentialsRouter.get(
  "/servers/:id/credentials",
  requireAuth,
  asyncHandler(async (req: RBACRequest, res) => {
    const user = req.user!;
    const serverId = parseInt(req.params.id);
    
    await assertServerVisible(user, serverId);
    
    const [cred] = await query<{ credential_id: number; login_username: string; credential_type: string; updated_at: Date }>(
      `
      SELECT credential_id, login_username, credential_type, updated_at
      FROM dbo.server_credentials
      WHERE server_id = @server_id
      `,
      (r) => r.input("server_id", serverId)
    );
    
    return ok(res, { credential: cred || null });
  })
);

// PUT /api/servers/:id/credentials - Update (Engineer for own servers)
credentialsRouter.put(
  "/servers/:id/credentials",
  requirePermission("security.manage.own"),
  asyncHandler(async (req: RBACRequest, res) => {
    const user = req.user!;
    const serverId = parseInt(req.params.id);
    const { login_username, password } = req.body;
    
    // Engineer must be assigned
    await assertServerAssigned(user, serverId);
    
    const passwordEnc = await encryptSecret(password);
    
    await transaction(async (tx) => {
      // Upsert credentials
      await queryTx(
        tx,
        `
        IF EXISTS (SELECT 1 FROM dbo.server_credentials WHERE server_id = @server_id)
          UPDATE dbo.server_credentials
          SET login_username = @username, password_enc = @password_enc,
              updated_by_user_id = @user_id, updated_at = GETDATE()
          WHERE server_id = @server_id
        ELSE
          INSERT INTO dbo.server_credentials (server_id, login_username, password_enc, updated_by_user_id, updated_at, created_at)
          VALUES (@server_id, @username, @password_enc, @user_id, GETDATE(), GETDATE())
        `,
        (r) => {
          r.input("server_id", serverId);
          r.input("username", login_username);
          r.input("password_enc", passwordEnc);
          r.input("user_id", user.userId);
        }
      );
      
      // Log sensitive activity
      await logCredentialsUpdated(serverId, user.userId, tx);
    });
    
    return ok(res, { success: true });
  })
);

// POST /api/servers/:id/credentials/reveal - Reveal password (Engineer for own servers)
credentialsRouter.post(
  "/servers/:id/credentials/reveal",
  requirePermission("security.reveal.own"),
  asyncHandler(async (req: RBACRequest, res) => {
    const user = req.user!;
    const serverId = parseInt(req.params.id);
    
    // Engineer must be assigned
    await assertServerAssigned(user, serverId);
    
    const [cred] = await query<{ password_enc: string }>(
      "SELECT password_enc FROM dbo.server_credentials WHERE server_id = @server_id",
      (r) => r.input("server_id", serverId)
    );
    
    if (!cred || !cred.password_enc) {
      return ok(res, { password: null });
    }
    
    const password = await decryptSecret(cred.password_enc);
    
    // Log sensitive activity
    await logCredentialsRevealed(serverId, user.userId);
    
    return ok(res, { password });
  })
);
```

---

## Step 4: Frontend Integration (Next.js)

### 1. Create RBAC Context

**File**: `frontend/src/contexts/rbac-context.tsx`

```typescript
"use client";

import { createContext, useContext, ReactNode } from "react";
import { useAuth } from "@/components/auth/auth-provider";

export interface RBACUser {
  userId: number;
  username: string;
  fullName?: string;
  roleId: number;
  roleName: string;
  teamId: number | null;
  engineerId: number | null;
  permissions: string[];
}

interface RBACContextValue {
  user: RBACUser | null;
  can: (permission: string) => boolean;
  canAny: (permissions: string[]) => boolean;
  isAdmin: () => boolean;
  isTeamLead: () => boolean;
  isEngineer: () => boolean;
}

const RBACContext = createContext<RBACContextValue | undefined>(undefined);

export function RBACProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  
  const can = (permission: string): boolean => {
    if (!user) return false;
    if (user.roleName === "Admin") return true;
    return user.permissions?.includes(permission) || false;
  };
  
  const canAny = (permissions: string[]): boolean => {
    if (!user) return false;
    if (user.roleName === "Admin") return true;
    return permissions.some(p => user.permissions?.includes(p));
  };
  
  const isAdmin = () => user?.roleName === "Admin";
  const isTeamLead = () => user?.roleName === "TeamLead";
  const isEngineer = () => user?.roleName === "Engineer";
  
  return (
    <RBACContext.Provider value={{ user, can, canAny, isAdmin, isTeamLead, isEngineer }}>
      {children}
    </RBACContext.Provider>
  );
}

export function useRBAC() {
  const context = useContext(RBACContext);
  if (!context) {
    throw new Error("useRBAC must be used within RBACProvider");
  }
  return context;
}
```

### 2. Update Sidebar Configuration

**File**: `frontend/src/config/sidebar-config.ts`

```typescript
export const sidebarConfig = {
  sections: [
    {
      title: "Overview",
      items: [
        {
          title: "Dashboard",
          href: "/dashboard",
          icon: "LayoutDashboard",
          roles: ["Admin", "TeamLead", "Engineer"]
        }
      ]
    },
    {
      title: "Infrastructure",
      items: [
        {
          title: "Servers",
          href: "/servers",
          icon: "Server",
          roles: ["Admin", "TeamLead", "Engineer"]
        },
        {
          title: "Network",
          href: "/network",
          icon: "Network",
          roles: ["Admin", "TeamLead"]
        },
        {
          title: "Hardware",
          href: "/hardware",
          icon: "HardDrive",
          roles: ["Admin", "TeamLead"]
        },
        {
          title: "Security",
          href: "/security",
          icon: "Shield",
          roles: ["Admin", "TeamLead"]
        },
        {
          title: "Locations",
          href: "/locations",
          icon: "MapPin",
          roles: ["Admin", "TeamLead"]
        },
        {
          title: "Racks",
          href: "/racks",
          icon: "Archive",
          roles: ["Admin", "TeamLead"]
        }
      ]
    },
    {
      title: "Operations",
      items: [
        {
          title: "Maintenance",
          href: "/maintenance",
          icon: "Wrench",
          roles: ["Admin", "TeamLead", "Engineer"]
        },
        {
          title: "Incidents",
          href: "/incidents",
          icon: "AlertTriangle",
          roles: ["Admin", "TeamLead", "Engineer"]
        },
        {
          title: "Visits",
          href: "/visits",
          icon: "Users",
          roles: ["Admin", "TeamLead", "Engineer"]
        }
      ]
    },
    {
      title: "People",
      items: [
        {
          title: "Engineers",
          href: "/engineers",
          icon: "UserCog",
          roles: ["Admin", "TeamLead"]
        },
        {
          title: "Teams",
          href: "/teams",
          icon: "Users",
          roles: ["Admin"]
        },
        {
          title: "User Management",
          href: "/users",
          icon: "UserPlus",
          roles: ["Admin", "TeamLead"]
        }
      ]
    },
    {
      title: "System",
      items: [
        {
          title: "Audit Logs",
          href: "/audit",
          icon: "FileText",
          roles: ["Admin"]
        },
        {
          title: "Reports",
          href: "/reports",
          icon: "BarChart",
          roles: ["Admin", "TeamLead", "Engineer"]
        },
        {
          title: "Settings",
          href: "/settings",
          icon: "Settings",
          roles: ["Admin"]
        }
      ]
    }
  ]
};
```

### 3. Update Servers Page with Tabs

**File**: `frontend/src/app/(app)/servers/page.tsx`

```typescript
"use client";

import { useRBAC } from "@/contexts/rbac-context";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ServersPage() {
  const { user, isEngineer } = useRBAC();
  const [servers, setServers] = useState<any[]>([]);
  const [myServers, setMyServers] = useState<any[]>([]);
  const [teamServers, setTeamServers] = useState<any[]>([]);
  
  useEffect(() => {
    fetchServers();
  }, []);
  
  async function fetchServers() {
    const response = await apiClient.get("/api/servers");
    
    if (isEngineer()) {
      setMyServers(response.data.myServers || []);
      setTeamServers(response.data.teamServers || []);
    } else {
      setServers(response.data.servers || []);
    }
  }
  
  if (isEngineer()) {
    return (
      <div className="space-y-6">
        <PageHeader title="Servers" description="Manage your assigned servers" />
        
        <Tabs defaultValue="my-servers">
          <TabsList>
            <TabsTrigger value="my-servers">
              My Servers ({myServers.length})
            </TabsTrigger>
            <TabsTrigger value="team-servers">
              Team Servers ({teamServers.length})
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="my-servers">
            <ServersTable servers={myServers} canModify={true} />
          </TabsContent>
          
          <TabsContent value="team-servers">
            <ServersTable servers={teamServers} canModify={false} readOnly={true} />
          </TabsContent>
        </Tabs>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <PageHeader 
        title="Servers" 
        description="Manage all servers"
        action={<CreateServerButton />}
      />
      <ServersTable servers={servers} canModify={true} />
    </div>
  );
}
```

---

## Step 5: Testing (15 minutes)

### Test 1: Role Creation

```sql
-- Create test users
INSERT INTO dbo.Users (username, email, password_hash, full_name, role_id, team_id, is_active)
VALUES
('admin', 'admin@hormuud.com', 'hash', 'System Admin', 
  (SELECT role_id FROM dbo.roles WHERE role_name = 'Admin'), NULL, 1),
  
('teamlead1', 'teamlead@hormuud.com', 'hash', 'Team Lead 1',
  (SELECT role_id FROM dbo.roles WHERE role_name = 'TeamLead'), 1, 1),
  
('engineer1', 'engineer@hormuud.com', 'hash', 'Engineer 1',
  (SELECT role_id FROM dbo.roles WHERE role_name = 'Engineer'), 1, 1);
```

### Test 2: Server Assignment

```sql
-- Assign engineer to server
UPDATE dbo.servers 
SET engineer_id = 1 
WHERE server_id = 1;
```

### Test 3: API Tests (Postman)

```bash
# Login as Engineer
POST /auth/login
{ "username": "engineer1", "password": "password" }

# Get servers (should see only assigned + team read-only)
GET /api/servers
# Response: { myServers: [...], teamServers: [...] }

# Try to create server (should fail)
POST /api/servers
# Response: 403 Permission Denied

# Create visit for assigned server (should succeed)
POST /api/visits
{ "server_id": 1, "visit_type": "Inspection", "visit_date": "2026-02-08" }
# Response: 201 Created

# Complete maintenance assigned to engineer
PATCH /api/maintenance/1/complete
# Response: 200 OK
# Server status should change from "MAINTENANCE" to "ACTIVE"
```

---

## Summary: What You Get

### ✅ Complete RBAC System
- 3 Roles with 31 granular permissions
- Permission-based route protection
- Team and server scoping

### ✅ Automatic Server Status Engine
- Status derived from incidents/maintenance
- Priority: Incident > Maintenance > Active
- Auto-updates on state changes

### ✅ Comprehensive Activity Logging
- All actions logged to `server_activity`
- Sensitive actions flagged
- Activity redaction for Engineers

### ✅ Secure Credential Management
- Engineers can only manage assigned servers
- Password reveal requires permission + assignment
- All credential actions logged

### ✅ Role-Based UI
- Sidebar shows only authorized pages
- "My Servers" vs "Team Servers" tabs for Engineers
- Server details actions based on role

---

## Need Help?

1. **Database Issues**: Check migration output for errors
2. **Permission Denied**: Verify role has required permission in `role_permissions`
3. **Server Visibility**: Check team_id and engineer_id assignment
4. **Status Not Updating**: Call `updateServerStatus()` after incident/maintenance changes

Your system is now enterprise-ready with full RBAC! 🚀
