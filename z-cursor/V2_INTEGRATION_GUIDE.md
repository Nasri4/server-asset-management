# Server Asset Management V2 - Integration Guide

## Overview

This guide provides step-by-step instructions to integrate V2 enhancements into your existing Server Asset Management System.

## Architecture Summary

### Core V2 Components

1. **Database Schema V2** - Enhanced schema with proper relations and indexes
2. **Status Engine V2** - Priority-based status computation with business rules
3. **Real-time Service** - SSE (Server-Sent Events) for live updates
4. **Activity Timeline** - Unified event feed per server
5. **Enhanced APIs** - Status recomputation, activity endpoints
6. **Frontend Components** - Tabbed server details, real-time subscriptions

---

## Part 1: Backend Integration

### Step 1: Run Database Migration

```bash
# Connect to SQL Server and run:
sqlcmd -S localhost -d SERVER_ASSET_MANAGEMENT -i backend/sql/migrations/2026-02-06_v2-complete-schema-verification.sql
```

This migration:

- ✅ Adds `health_status`, `status_override` columns to `servers`
- ✅ Creates/verifies `server_security` table with hardening fields
- ✅ Adds engineer assignments to incidents/maintenance/visits
- ✅ Creates `activity_log` table for unified timeline
- ✅ Creates all necessary indexes for performance
- ✅ Idempotent - safe to run multiple times

### Step 2: Install Node Dependencies

```bash
cd backend
npm install uuid
npm install --save-dev @types/uuid
```

### Step 3: Integrate Real-time Events in Routers

#### For `maintenance.routes.ts`:

```typescript
// Add import at top
import { emitMaintenanceEvent } from "../middleware/realtimeEmitter";

// After creating maintenance (in withTransaction callback):
await emitMaintenanceEvent(
  "created",
  maintenanceId,
  body.server_id,
  {
    maintenance_type: body.maintenance_type,
    status: body.status || "Scheduled",
    scheduled_start: body.scheduled_start,
  },
  serverRow?.team_id,
  req.user?.userId,
  tx
);

// After updating maintenance:
await emitMaintenanceEvent(
  "updated",
  maintenanceId,
  serverId,
  { ...body },
  serverRow?.team_id,
  req.user?.userId,
  tx
);

// After completing maintenance:
await emitMaintenanceEvent(
  "completed",
  maintenanceId,
  serverId,
  { completed_at: new Date() },
  serverRow?.team_id,
  req.user?.userId,
  tx
);
```

#### For `visits.routes.ts`:

```typescript
// Add import at top
import { emitVisitEvent } from "../middleware/realtimeEmitter";

// After creating visit:
await emitVisitEvent(
  "created",
  visitId,
  body.server_id,
  {
    visit_type: body.visit_type,
    scheduled_at: body.scheduled_at,
    status: body.status || "Scheduled",
  },
  serverRow?.team_id,
  req.user?.userId,
  tx
);

// After updating visit:
await emitVisitEvent(
  "updated",
  visitId,
  serverId,
  { ...body },
  serverRow?.team_id,
  req.user?.userId,
  tx
);

// After completing visit:
await emitVisitEvent(
  "completed",
  visitId,
  serverId,
  { completed_at: new Date() },
  serverRow?.team_id,
  req.user?.userId,
  tx
);
```

#### For `monitoring.routes.ts`:

```typescript
// Add import at top
import { updateMonitoringHealth } from "../utils/serverStatusV2";
import { emitMonitoringEvent } from "../middleware/realtimeEmitter";

// After updating monitoring:
await updateMonitoringHealth(serverId, body.health_status, {
  cpu_usage: body.cpu_usage,
  memory_usage: body.memory_usage,
  disk_usage: body.disk_usage,
});

await emitMonitoringEvent(
  serverId,
  {
    health_status: body.health_status,
    cpu_usage: body.cpu_usage,
    memory_usage: body.memory_usage,
    disk_usage: body.disk_usage,
  },
  serverRow?.team_id,
  req.user?.userId
);
```

#### For `security.routes.ts`:

```typescript
// Add import at top
import { emitSecurityEvent } from "../middleware/realtimeEmitter";

// After updating security:
await emitSecurityEvent(
  serverId,
  {
    hardening_status: body.hardening_status,
    compliance_framework: body.compliance_framework,
    // ... other fields
  },
  serverRow?.team_id
);
```

### Step 4: Test Backend

```bash
# Start the server
cd backend
npm run dev

# Test SSE connection
curl -N -H "Cookie: token=YOUR_JWT_TOKEN" http://localhost:4000/api/realtime/events

# Test status recomputation
curl -X POST -H "Cookie: token=YOUR_JWT_TOKEN" http://localhost:4000/api/servers/1/status/recompute

# Test activity timeline
curl -H "Cookie: token=YOUR_JWT_TOKEN" http://localhost:4000/api/servers/1/activity
```

---

## Part 2: Frontend Integration

### Step 1: Create SSE Client Hook

Create `frontend/src/hooks/useRealtime.ts`:

```typescript
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/components/auth/auth-provider";

export type RealtimeEvent = {
  type: string;
  data: any;
};

export function useRealtime() {
  const { token } = useAuth();
  const [connected, setConnected] = useState(false);
  const [eventSource, setEventSource] = useState<EventSource | null>(null);
  const [listeners, setListeners] = useState<
    Map<string, Set<(data: any) => void>>
  >(new Map());

  // Connect to SSE
  useEffect(() => {
    if (!token) return;

    const es = new EventSource("/api/realtime/events", {
      withCredentials: true,
    });

    es.onopen = () => {
      console.log("[SSE] Connected");
      setConnected(true);
    };

    es.onerror = (error) => {
      console.error("[SSE] Error:", error);
      setConnected(false);
    };

    // Listen to all event types
    const eventTypes = [
      "server.created",
      "server.updated",
      "server.deleted",
      "server.status.changed",
      "incident.created",
      "incident.updated",
      "incident.resolved",
      "maintenance.created",
      "maintenance.updated",
      "maintenance.completed",
      "visit.created",
      "visit.updated",
      "visit.completed",
      "security.updated",
      "monitoring.updated",
      "activity.created",
      "connection.established",
      "system.ping",
    ];

    eventTypes.forEach((eventType) => {
      es.addEventListener(eventType, (event: MessageEvent) => {
        const data = JSON.parse(event.data);
        console.log(`[SSE] ${eventType}:`, data);

        // Notify all listeners for this event type
        const eventListeners = listeners.get(eventType);
        if (eventListeners) {
          eventListeners.forEach((callback) => callback(data));
        }
      });
    });

    setEventSource(es);

    return () => {
      console.log("[SSE] Disconnecting");
      es.close();
      setConnected(false);
    };
  }, [token]);

  // Subscribe to event
  const subscribe = useCallback(
    (eventType: string, callback: (data: any) => void) => {
      setListeners((prev) => {
        const newListeners = new Map(prev);
        if (!newListeners.has(eventType)) {
          newListeners.set(eventType, new Set());
        }
        newListeners.get(eventType)!.add(callback);
        return newListeners;
      });

      // Return unsubscribe function
      return () => {
        setListeners((prev) => {
          const newListeners = new Map(prev);
          const eventListeners = newListeners.get(eventType);
          if (eventListeners) {
            eventListeners.delete(callback);
            if (eventListeners.size === 0) {
              newListeners.delete(eventType);
            }
          }
          return newListeners;
        });
      };
    },
    []
  );

  return {
    connected,
    subscribe,
  };
}
```

### Step 2: Update Server List Page with Real-time

Update `frontend/src/app/(app)/servers/page.tsx`:

```typescript
"use client";

import { useRealtime } from "@/hooks/useRealtime";
import { useEffect } from "react";

export default function ServersPage() {
  const { subscribe } = useRealtime();
  const [servers, setServers] = useState([]);

  // Subscribe to server events
  useEffect(() => {
    const unsubscribeCreated = subscribe("server.created", (data) => {
      console.log("Server created:", data);
      // Refetch servers or add to list
      fetchServers();
    });

    const unsubscribeUpdated = subscribe("server.updated", (data) => {
      console.log("Server updated:", data);
      // Update specific server in list
      setServers((prev) =>
        prev.map((s) => (s.server_id === data.serverId ? { ...s, ...data } : s))
      );
    });

    const unsubscribeStatusChanged = subscribe(
      "server.status.changed",
      (data) => {
        console.log("Server status changed:", data);
        // Update server status in list
        setServers((prev) =>
          prev.map((s) =>
            s.server_id === data.serverId ? { ...s, status: data.newStatus } : s
          )
        );
      }
    );

    return () => {
      unsubscribeCreated();
      unsubscribeUpdated();
      unsubscribeStatusChanged();
    };
  }, [subscribe]);

  // ... rest of component
}
```

### Step 3: Create Tabbed Server Details Page

Create `frontend/src/app/(app)/servers/[id]/page.tsx`:

```typescript
"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useRealtime } from "@/hooks/useRealtime";

export default function ServerDetailsPage() {
  const params = useParams();
  const serverId = parseInt(params.id as string);
  const { subscribe } = useRealtime();
  const [server, setServer] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");

  // Subscribe to server events
  useEffect(() => {
    const unsubscribe = subscribe("server.updated", (data) => {
      if (data.serverId === serverId) {
        console.log("Server updated:", data);
        fetchServerDetails();
      }
    });

    const unsubscribeStatus = subscribe("server.status.changed", (data) => {
      if (data.serverId === serverId) {
        console.log("Server status changed:", data);
        setServer((prev) =>
          prev ? { ...prev, status: data.newStatus } : null
        );
      }
    });

    return () => {
      unsubscribe();
      unsubscribeStatus();
    };
  }, [serverId, subscribe]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={server?.hostname || "Server Details"}
        description={`Server Code: ${server?.server_code || "Loading..."}`}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-11">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="network">Network</TabsTrigger>
          <TabsTrigger value="hardware">Hardware</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
          <TabsTrigger value="incidents">Incidents</TabsTrigger>
          <TabsTrigger value="visits">Visits</TabsTrigger>
          <TabsTrigger value="applications">Applications</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <ServerOverviewTab serverId={serverId} server={server} />
        </TabsContent>

        <TabsContent value="network">
          <ServerNetworkTab serverId={serverId} />
        </TabsContent>

        <TabsContent value="hardware">
          <ServerHardwareTab serverId={serverId} />
        </TabsContent>

        <TabsContent value="security">
          <ServerSecurityTab serverId={serverId} />
        </TabsContent>

        <TabsContent value="monitoring">
          <ServerMonitoringTab serverId={serverId} />
        </TabsContent>

        <TabsContent value="maintenance">
          <ServerMaintenanceTab serverId={serverId} />
        </TabsContent>

        <TabsContent value="incidents">
          <ServerIncidentsTab serverId={serverId} />
        </TabsContent>

        <TabsContent value="visits">
          <ServerVisitsTab serverId={serverId} />
        </TabsContent>

        <TabsContent value="applications">
          <ServerApplicationsTab serverId={serverId} />
        </TabsContent>

        <TabsContent value="activity">
          <ServerActivityTab serverId={serverId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

### Step 4: Create Server Activity Tab Component

Create `frontend/src/components/server/server-activity-tab.tsx`:

```typescript
"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api/client";
import { useRealtime } from "@/hooks/useRealtime";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";

export function ServerActivityTab({ serverId }: { serverId: number }) {
  const { subscribe } = useRealtime();
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchActivities = async () => {
    try {
      const response = await apiClient.get(
        `/api/servers/${serverId}/activity?limit=100`
      );
      if (response.data?.activities) {
        setActivities(response.data.activities);
      }
    } catch (error) {
      console.error("Failed to fetch activities:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();

    // Subscribe to activity events
    const unsubscribe = subscribe("activity.created", (data) => {
      if (data.serverId === serverId) {
        console.log("New activity:", data);
        fetchActivities(); // Or prepend to list
      }
    });

    return () => unsubscribe();
  }, [serverId, subscribe]);

  if (loading) {
    return <div className="text-center py-8">Loading activity...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Server Activity Timeline</CardTitle>
        <CardDescription>
          Real-time activity feed for this server
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No activity recorded yet
            </div>
          ) : (
            activities.map((activity: any) => (
              <div
                key={activity.activity_id}
                className="flex items-start gap-4 border-l-2 border-primary/20 pl-4 py-2"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={getActionVariant(activity.action)}>
                      {activity.action}
                    </Badge>
                    <span className="text-sm font-medium">
                      {activity.entity_type}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(activity.created_at), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {activity.description}
                  </p>
                  {activity.actor_name && (
                    <p className="text-xs text-muted-foreground mt-1">
                      by {activity.actor_name}
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function getActionVariant(action: string) {
  switch (action) {
    case "created":
      return "default";
    case "updated":
      return "secondary";
    case "deleted":
      return "destructive";
    case "status_changed":
      return "outline";
    case "resolved":
      return "success";
    default:
      return "default";
  }
}
```

### Step 5: Update Dashboard with Real-time

Update `frontend/src/app/(app)/dashboard/page.tsx`:

```typescript
"use client";

import { useRealtime } from "@/hooks/useRealtime";
import { useEffect, useState } from "react";

export default function DashboardPage() {
  const { subscribe, connected } = useRealtime();
  const [stats, setStats] = useState({
    totalServers: 0,
    activeServers: 0,
    maintenanceServers: 0,
    incidentServers: 0,
    offlineServers: 0,
  });

  // Subscribe to all server events
  useEffect(() => {
    const unsubscribeCreated = subscribe("server.created", () => {
      console.log("Server created, refreshing stats");
      fetchStats();
    });

    const unsubscribeStatusChanged = subscribe(
      "server.status.changed",
      (data) => {
        console.log("Server status changed:", data);
        // Optimistically update stats or refetch
        fetchStats();
      }
    );

    const unsubscribeIncident = subscribe("incident.created", () => {
      fetchStats();
    });

    const unsubscribeMaintenance = subscribe("maintenance.created", () => {
      fetchStats();
    });

    return () => {
      unsubscribeCreated();
      unsubscribeStatusChanged();
      unsubscribeIncident();
      unsubscribeMaintenance();
    };
  }, [subscribe]);

  // ... rest of dashboard implementation

  return (
    <div>
      {/* Real-time indicator */}
      <div className="flex items-center gap-2 mb-4">
        <div
          className={`h-2 w-2 rounded-full ${
            connected ? "bg-green-500 animate-pulse" : "bg-gray-300"
          }`}
        />
        <span className="text-xs text-muted-foreground">
          {connected ? "Live updates enabled" : "Connecting..."}
        </span>
      </div>

      {/* Dashboard content */}
      {/* ... */}
    </div>
  );
}
```

---

## Part 3: Testing & Validation

### Database Verification

```sql
-- Verify schema
USE SERVER_ASSET_MANAGEMENT;

-- Check servers table has new columns
SELECT COL_LENGTH('dbo.servers', 'health_status') AS health_status_col,
       COL_LENGTH('dbo.servers', 'status_override') AS status_override_col;

-- Check server_security table exists
SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_NAME = 'server_security';

-- Check activity_log table exists
SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_NAME = 'activity_log';

-- Check indexes
SELECT name, type_desc FROM sys.indexes
WHERE object_id = OBJECT_ID('dbo.servers')
AND name LIKE 'IX_%';
```

### API Testing

```bash
# Test status recomputation
curl -X POST http://localhost:4000/api/servers/1/status/recompute \
  -H "Cookie: token=YOUR_JWT" \
  -H "Content-Type: application/json"

# Test status override
curl -X POST http://localhost:4000/api/servers/1/status/override \
  -H "Cookie: token=YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{"status":"Maintenance","reason":"Manual override for testing"}'

# Test activity timeline
curl http://localhost:4000/api/servers/1/activity?limit=20 \
  -H "Cookie: token=YOUR_JWT"

# Test SSE connection
curl -N http://localhost:4000/api/realtime/events \
  -H "Cookie: token=YOUR_JWT"
```

### Status Engine Testing

1. **Create an incident** → Server status should become "Down" (Critical) or "Degraded" (Major)
2. **Resolve the incident** → Server status should recompute to "Active"
3. **Create maintenance** → Server status should become "Maintenance"
4. **Complete maintenance** → Server status should return to "Active"
5. **Test priority**: Create incident + maintenance → Incident should win (higher priority)

### Real-time Testing

1. Open dashboard in one browser tab
2. Create an incident in another tab
3. Dashboard should update instantly without refresh
4. Status badges should update in real-time

---

## Part 4: Performance Optimization

### Database Indexes

Already created by migration:

- ✅ `IX_servers_status_health`
- ✅ `IX_server_incidents_status_severity`
- ✅ `IX_server_maintenance_status_scheduled`
- ✅ `IX_server_visits_status_scheduled`
- ✅ `IX_activity_log_server_id`
- ✅ `IX_audit_logs_entity`

### SSE Connection Management

- Keep-alive every 15 seconds
- Auto-reconnect on disconnect
- Client-side event buffering

### Query Optimization

- Use `TOP` for large result sets
- Pagination for activity logs
- Filtered queries by team_id (RBAC scoping)

---

## Troubleshooting

### "Column does not exist" Error

Run the V2 migration script again - it's idempotent.

### SSE Not Connecting

1. Check CORS settings in `backend/src/app.ts`
2. Verify `/api/realtime/events` is accessible
3. Check browser console for connection errors
4. Ensure cookies are being sent (`withCredentials: true`)

### Status Not Recomputing

1. Check if `recomputeServerStatus` is being called after operations
2. Verify status priority logic in `serverStatusV2.ts`
3. Check audit logs for status changes

### Real-time Events Not Received

1. Verify SSE connection is established
2. Check backend console for event emissions
3. Verify team scoping isn't filtering events
4. Check event listener registration

---

## Next Steps

1. ✅ Run database migration
2. ✅ Integrate real-time emitters in remaining routers
3. ✅ Implement frontend SSE hook
4. ✅ Update server details page with tabs
5. ✅ Update dashboard with real-time stats
6. ⏳ Test status engine thoroughly
7. ⏳ Test real-time updates
8. ⏳ Performance testing with multiple clients

---

## Support

For issues or questions:

1. Check backend logs for errors
2. Check frontend console for SSE connection status
3. Verify database migration completed successfully
4. Review audit logs for status changes
