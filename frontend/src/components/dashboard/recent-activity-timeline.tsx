"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Activity, Server, Wrench, AlertTriangle, CheckCircle, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface ActivityItem {
  id: string;
  type: "server" | "maintenance" | "incident" | "success";
  user: string;
  action: string;
  target: string;
  timestamp: Date;
}

interface RecentActivityTimelineProps {
  loading?: boolean;
}

// Mock recent activity data
const generateActivityData = (): ActivityItem[] => {
  const now = new Date();
  const activities: ActivityItem[] = [
    {
      id: "1",
      type: "server",
      user: "John Smith",
      action: "Added new server",
      target: "SRV-PROD-045",
      timestamp: new Date(now.getTime() - 5 * 60000), // 5 minutes ago
    },
    {
      id: "2",
      type: "maintenance",
      user: "Sarah Johnson",
      action: "Completed maintenance",
      target: "SRV-DEV-023",
      timestamp: new Date(now.getTime() - 15 * 60000), // 15 minutes ago
    },
    {
      id: "3",
      type: "incident",
      user: "Mike Chen",
      action: "Reported incident",
      target: "SRV-PROD-012",
      timestamp: new Date(now.getTime() - 45 * 60000), // 45 minutes ago
    },
    {
      id: "4",
      type: "success",
      user: "Emily Davis",
      action: "Resolved incident",
      target: "SRV-PROD-008",
      timestamp: new Date(now.getTime() - 90 * 60000), // 1.5 hours ago
    },
    {
      id: "5",
      type: "maintenance",
      user: "Alex Kumar",
      action: "Scheduled maintenance",
      target: "SRV-CLOUD-056",
      timestamp: new Date(now.getTime() - 120 * 60000), // 2 hours ago
    },
  ];
  return activities;
};

const getActivityIcon = (type: ActivityItem["type"]): LucideIcon => {
  switch (type) {
    case "server":
      return Server;
    case "maintenance":
      return Wrench;
    case "incident":
      return AlertTriangle;
    case "success":
      return CheckCircle;
    default:
      return Activity;
  }
};

const getActivityColor = (type: ActivityItem["type"]) => {
  switch (type) {
    case "server":
      return {
        bg: "bg-blue-50 dark:bg-blue-950",
        border: "border-blue-200 dark:border-blue-800",
        icon: "text-blue-600 dark:text-blue-400",
      };
    case "maintenance":
      return {
        bg: "bg-amber-50 dark:bg-amber-950",
        border: "border-amber-200 dark:border-amber-800",
        icon: "text-amber-600 dark:text-amber-400",
      };
    case "incident":
      return {
        bg: "bg-rose-50 dark:bg-rose-950",
        border: "border-rose-200 dark:border-rose-800",
        icon: "text-rose-600 dark:text-rose-400",
      };
    case "success":
      return {
        bg: "bg-emerald-50 dark:bg-emerald-950",
        border: "border-emerald-200 dark:border-emerald-800",
        icon: "text-emerald-600 dark:text-emerald-400",
      };
    default:
      return {
        bg: "bg-slate-50 dark:bg-slate-950",
        border: "border-slate-200 dark:border-slate-800",
        icon: "text-slate-600 dark:text-slate-400",
      };
  }
};

const formatTimestamp = (date: Date): string => {
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 60000); // difference in minutes

  if (diff < 1) return "Just now";
  if (diff < 60) return `${diff}m ago`;
  if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
  return date.toLocaleDateString();
};

export function RecentActivityTimeline({ loading }: RecentActivityTimelineProps) {
  const [activities] = React.useState<ActivityItem[]>(generateActivityData);

  if (loading) {
    return (
      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-slate-500" />
            <CardTitle className="text-lg font-semibold">Recent Activity</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={`activity-skeleton-${i}`} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-slate-500" />
          <CardTitle className="text-lg font-semibold">Recent Activity</CardTitle>
        </div>
        <p className="text-xs text-slate-500 mt-1">Latest system events and changes</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.map((activity, index) => {
            const Icon = getActivityIcon(activity.type);
            const colors = getActivityColor(activity.type);
            const isLast = index === activities.length - 1;

            return (
              <div key={activity.id} className="relative">
                {/* Timeline line */}
                {!isLast && (
                  <div className="absolute left-5 top-10 bottom-0 w-px bg-slate-200 dark:bg-slate-700" />
                )}

                <div className="flex gap-3">
                  {/* Icon */}
                  <div
                    className={`flex-shrink-0 w-10 h-10 rounded-full ${colors.bg} border ${colors.border} flex items-center justify-center z-10`}
                  >
                    <Icon className={`h-5 w-5 ${colors.icon}`} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 pt-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-white">
                          {activity.action}
                        </p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <div className="flex items-center gap-1.5 text-xs text-slate-500">
                            <User className="h-3 w-3" />
                            <span>{activity.user}</span>
                          </div>
                          <span className="text-slate-400">•</span>
                          <Badge
                            variant="outline"
                            className="text-xs font-mono bg-slate-50 dark:bg-slate-800"
                          >
                            {activity.target}
                          </Badge>
                        </div>
                      </div>
                      <span className="text-xs text-slate-500 flex-shrink-0">
                        {formatTimestamp(activity.timestamp)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
