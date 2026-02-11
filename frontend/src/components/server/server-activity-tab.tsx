/**
 * SERVER ACTIVITY TAB COMPONENT
 * 
 * Displays real-time activity timeline for a server
 */

"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api/client";
import { useRealtime } from "@/hooks/useRealtime";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Clock, User, Activity as ActivityIcon } from "lucide-react";

const dateTimeFmt = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false
});

const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

function formatDateTime(date: Date): string {
  if (!Number.isFinite(date.getTime())) return "Invalid date";
  return dateTimeFmt.format(date);
}

function formatDistanceToNowSafe(date: Date): string {
  const ms = date.getTime();
  if (!Number.isFinite(ms)) return "";

  const diffSeconds = Math.round((ms - Date.now()) / 1000);
  const abs = Math.abs(diffSeconds);

  const choose = (unit: Intl.RelativeTimeFormatUnit, value: number) => rtf.format(value, unit);

  if (abs < 60) return choose("second", diffSeconds);
  const diffMinutes = Math.round(diffSeconds / 60);
  if (Math.abs(diffMinutes) < 60) return choose("minute", diffMinutes);
  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) return choose("hour", diffHours);
  const diffDays = Math.round(diffHours / 24);
  if (Math.abs(diffDays) < 30) return choose("day", diffDays);
  const diffMonths = Math.round(diffDays / 30);
  if (Math.abs(diffMonths) < 12) return choose("month", diffMonths);
  const diffYears = Math.round(diffMonths / 12);
  return choose("year", diffYears);
}

interface ActivityLogEntry {
  activity_id: number;
  entity_type: string;
  entity_id: number | string;
  server_id?: number | null;

  // Legacy/alternate shape (activity_log-style)
  action?: string;
  actor_type?: "user" | "system";
  actor_id?: number | null;
  actor_name?: string | null;
  description?: string | null;
  old_value?: string | null;
  new_value?: string | null;
  metadata?: string | null;

  // Current per-server activity feed (dbo.Activities-style)
  message?: string | null;
  actor?: {
    user_id: number;
    full_name: string | null;
    role_name?: string | null;
    team_id?: number | null;
    team_name?: string | null;
  } | null;
  created_at: string;
}

interface ServerActivityTabProps {
  serverId: number;
}

export function ServerActivityTab({ serverId }: ServerActivityTabProps) {
  const { subscribe } = useRealtime();
  const [activities, setActivities] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [limit] = useState(100);
  const [offset, setOffset] = useState(0);

  const fetchActivities = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get(
        `/api/servers/${serverId}/activity?limit=${limit}&offset=${offset}`
      );
      
      const payload = response.data?.data ?? response.data;

      if (payload?.activities) {
        setActivities(payload.activities);
        setTotal(payload.pagination?.total || 0);
      } else if (Array.isArray(payload)) {
        setActivities(payload);
        setTotal(payload.length);
      }
    } catch (err: any) {
      console.error("Failed to fetch activities:", err);
      setError(err.message || "Failed to load activities");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();

    // Subscribe to activity events for this server
    const unsubscribe = subscribe("activity.created", (data) => {
      if (data.serverId === serverId) {
        console.log("New activity for this server:", data);
        // Refetch activities to include new event
        fetchActivities();
      }
    });

    return () => unsubscribe();
  }, [serverId, subscribe, offset]);

  if (loading && activities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Server Activity Timeline</CardTitle>
          <CardDescription>Loading activity...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Server Activity Timeline</CardTitle>
          <CardDescription>Error loading activities</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <p className="text-sm text-destructive mb-4">{error}</p>
            <Button onClick={fetchActivities} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Server Activity Timeline</CardTitle>
            <CardDescription>
              Real-time activity feed ({total} total events)
            </CardDescription>
          </div>
          <Button
            onClick={fetchActivities}
            variant="outline"
            size="sm"
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">
            <ActivityIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="font-medium">No activity recorded yet</p>
            <p className="text-sm mt-2">Events will appear here as they occur</p>
          </div>
        ) : (
          <div className="space-y-6">
            {activities.map((activity) => (
              <div
                key={activity.activity_id}
                className="relative flex items-start gap-4 border-l-2 border-primary/30 pl-4 py-3 hover:bg-accent/50 rounded-r-lg transition-colors"
              >
                {/* Icon based on entity type */}
                <div className="shrink-0 mt-1">
                  {getEntityIcon(activity.entity_type)}
                </div>

                {/* Activity Content */}
                <div className="flex-1 space-y-1">
                  <div className="flex items-center flex-wrap gap-2">
                    {activity.action ? (
                      <Badge variant={getActionVariant(activity.action)}>
                        {formatAction(activity.action)}
                      </Badge>
                    ) : (
                      <Badge variant="outline">Activity</Badge>
                    )}
                    <span className="text-sm font-medium text-muted-foreground">
                      {formatEntityType(activity.entity_type)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      #{activity.entity_id}
                    </span>
                  </div>

                  {(activity.description || activity.message) && (
                    <p className="text-sm">{activity.description || activity.message}</p>
                  )}

                  {(() => {
                    const raw = (activity as any).meta_json ?? activity.metadata;
                    if (!raw) return null;
                    try {
                      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
                      const changes = parsed?.changes;
                      if (!changes || typeof changes !== "object") return null;
                      const keys = Object.keys(changes);
                      if (keys.length === 0) return null;

                      return (
                        <div className="text-xs text-muted-foreground bg-muted/40 p-2 rounded space-y-1">
                          {keys.slice(0, 6).map((k) => (
                            <div key={k} className="flex gap-2">
                              <span className="font-mono">{k}</span>
                              <span className="opacity-70">:</span>
                              <span className="font-mono opacity-80">{String((changes as any)[k]?.from ?? "")}</span>
                              <span className="opacity-70">→</span>
                              <span className="font-mono">{String((changes as any)[k]?.to ?? "")}</span>
                            </div>
                          ))}
                          {keys.length > 6 ? <div className="opacity-70">…and {keys.length - 6} more</div> : null}
                        </div>
                      );
                    } catch {
                      return null;
                    }
                  })()}

                  {/* Show value changes if present */}
                  {activity.old_value && activity.new_value && (
                    <div className="text-xs text-muted-foreground font-mono bg-muted/50 p-2 rounded">
                      <span className="text-destructive">{activity.old_value}</span>
                      {" → "}
                      <span className="text-green-600">{activity.new_value}</span>
                    </div>
                  )}

                  {/* Actor and timestamp */}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1">
                    {getActorName(activity) ? (
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {getActorName(activity)}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <ActivityIcon className="h-3 w-3" />
                        System
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNowSafe(new Date(activity.created_at))}
                    </span>
                    <span className="text-[10px] opacity-50">
                      {formatDateTime(new Date(activity.created_at))}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Helper functions
function getActionVariant(action?: string): "default" | "secondary" | "destructive" | "outline" {
  if (!action) return "secondary";
  switch (action) {
    case "created":
      return "default";
    case "updated":
      return "secondary";
    case "deleted":
      return "destructive";
    case "status_changed":
    case "status_override_set":
    case "status_override_cleared":
      return "outline";
    default:
      return "secondary";
  }
}

function formatAction(action?: string): string {
  if (!action) return "Activity";
  return action
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatEntityType(entityType: string): string {
  if (!entityType) return "Entity";
  const normalized = String(entityType).toLowerCase();
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function getEntityIcon(entityType: string) {
  const iconClass = "h-5 w-5 text-muted-foreground";

  const normalized = String(entityType || "").toLowerCase();
  
  switch (normalized) {
    case "server":
      return <div className={iconClass}>🖥️</div>;
    case "incident":
      return <div className={iconClass}>⚠️</div>;
    case "maintenance":
      return <div className={iconClass}>🔧</div>;
    case "visit":
      return <div className={iconClass}>👤</div>;
    case "security":
      return <div className={iconClass}>🔒</div>;
    case "monitoring":
      return <div className={iconClass}>📊</div>;
    case "hardware":
      return <div className={iconClass}>💾</div>;
    case "network":
      return <div className={iconClass}>🌐</div>;
    case "application":
      return <div className={iconClass}>📦</div>;
    default:
      return <ActivityIcon className={iconClass} />;
  }
}

function getActorName(activity: ActivityLogEntry): string | null {
  const fromNested = activity.actor?.full_name?.trim();
  if (fromNested) return fromNested;
  const fromFlat = activity.actor_name?.trim();
  if (fromFlat) return fromFlat;
  return null;
}
