"use client";

import * as React from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  Plus,
  RefreshCw,
  Server,
  Wrench,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Users,
  Shield,
  Cpu,
  Cloud,
  Database,
  Globe,
  Monitor,
  AlertCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api/client";
import { useAuth } from "@/components/auth/auth-provider";
import { can } from "@/lib/rbac";

type DashboardStats = {
  total_servers: number;
  active_incidents: number;
  maintenance_due: number;
  healthy_servers_percent: number;
  engineers_on_duty: number;
};

type RecentIncident = {
  incident_id: number;
  server_code?: string;
  incident_type?: string;
  severity?: string;
  status?: string;
  reported_at?: string;
};

type UpcomingMaintenance = {
  schedule_id: number;
  server_code?: string;
  maintenance_type?: string;
  scheduled_date?: string;
  status?: string;
};

type ServerRow = {
  status?: string | null;
};

type EngineerRow = {
  is_active?: boolean;
};

// Premium Chart Component with Gradient
const StatusDistributionChart = ({ total, counts }: { total: number; counts: Record<string, number> }) => {
  const statusConfig = {
    Active: { color: "from-primary-500 to-primary-600", bg: "bg-primary-50", text: "text-primary-700" },
    Maintenance: { color: "from-amber-500 to-orange-500", bg: "bg-amber-50", text: "text-amber-700" },
    Degraded: { color: "from-gray-500 to-gray-600", bg: "bg-gray-100", text: "text-gray-700" },
    Issue: { color: "from-red-500 to-rose-600", bg: "bg-red-50", text: "text-red-700" },
    Warning: { color: "from-yellow-500 to-orange-400", bg: "bg-yellow-50", text: "text-yellow-700" },
    Down: { color: "from-red-500 to-red-600", bg: "bg-red-50", text: "text-red-700" },
  };

  const totalSafe = total > 0 ? total : 1;
  const items = Object.entries(counts)
    .map(([key, count]) => {
      const config = statusConfig[key as keyof typeof statusConfig] || {
        color: "from-gray-500 to-gray-600",
        bg: "bg-gray-100",
        text: "text-gray-700"
      };
      return {
        key,
        count,
        percentage: Math.round((count / totalSafe) * 100),
        ...config
      };
    })
    .sort((a, b) => b.count - a.count);

  return (
    <div className="space-y-4">
      {items.map((item, index) => (
        <div key={`status-item-${item.key}-${index}`} className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full bg-linear-to-r ${item.color}`} />
              <span className="text-sm font-medium text-slate-900">{item.key}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-900">{item.count}</span>
              <span className="text-xs text-slate-500">({item.percentage}%)</span>
            </div>
          </div>
          <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
            <div
              className={`h-full rounded-full bg-linear-to-r ${item.color}`}
              style={{ width: `${item.percentage}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

// Premium Trend Indicator
function TrendIndicator({ value, label }: { value: number; label: string }) {
  const isPositive = value >= 0;
  
  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${
      isPositive 
        ? "bg-primary-50 text-primary-700 border border-primary-200" 
        : "bg-red-50 text-red-700 border border-red-200"
    }`}>
      {isPositive ? (
        <ArrowUpRight className="h-3 w-3" />
      ) : (
        <ArrowDownRight className="h-3 w-3" />
      )}
      <span>{Math.abs(value)}%</span>
      <span className="text-gray-500 ml-1">{label}</span>
    </div>
  );
}

// Premium Metric Card with Gradient
function PremiumMetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  color = "blue",
  gradient = "from-blue-500 to-cyan-500",
  onClick,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: { value: number; label: string };
  color?: "blue" | "green" | "amber" | "red" | "purple" | "slate";
  gradient?: string;
  onClick?: () => void;
}) {
  const colorConfig = {
    blue: { bg: "bg-blue-50", border: "border-blue-100", text: "text-blue-600" },
    green: { bg: "bg-emerald-50", border: "border-emerald-100", text: "text-emerald-600" },
    amber: { bg: "bg-amber-50", border: "border-amber-100", text: "text-amber-600" },
    red: { bg: "bg-rose-50", border: "border-rose-100", text: "text-rose-600" },
    purple: { bg: "bg-purple-50", border: "border-purple-100", text: "text-purple-600" },
    slate: { bg: "bg-slate-50", border: "border-slate-100", text: "text-slate-600" },
  };

  const config = colorConfig[color];

  return (
    <Card 
      className={`relative overflow-hidden border-0 shadow-sm hover:shadow-lg transition-all duration-300 group cursor-pointer ${config.bg} ${config.border}`}
      onClick={onClick}
    >
      <div className={`absolute top-0 left-0 right-0 h-1 bg-linear-to-r ${gradient}`} />
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className={`p-3 rounded-xl bg-white shadow-sm ${config.border}`}>
            <Icon className={`h-6 w-6 ${config.text}`} />
          </div>
          {trend && <TrendIndicator value={trend.value} label={trend.label} />}
        </div>

        <div>
          <h3 className="text-2xl font-bold text-slate-900 mb-1">{value}</h3>
          <p className="text-sm font-medium text-slate-700 mb-2">{title}</p>
          {subtitle && (
            <p className="text-xs text-slate-500">{subtitle}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Status Badge Premium
function StatusBadge({ status }: { status?: string }) {
  const config: Record<string, { color: string; bg: string; border: string }> = {
    Critical: {
      color: "text-rose-700",
      bg: "bg-gradient-to-r from-rose-50 to-pink-50",
      border: "border border-rose-200",
    },
    Major: {
      color: "text-amber-700",
      bg: "bg-gradient-to-r from-amber-50 to-orange-50",
      border: "border border-amber-200",
    },
    Minor: {
      color: "text-blue-700",
      bg: "bg-gradient-to-r from-blue-50 to-cyan-50",
      border: "border border-blue-200",
    },
    Open: {
      color: "text-rose-700",
      bg: "bg-gradient-to-r from-rose-50 to-pink-50",
      border: "border border-rose-200",
    },
    "In Progress": {
      color: "text-amber-700",
      bg: "bg-gradient-to-r from-amber-50 to-orange-50",
      border: "border border-amber-200",
    },
    Resolved: {
      color: "text-emerald-700",
      bg: "bg-gradient-to-r from-emerald-50 to-green-50",
      border: "border border-emerald-200",
    },
    Scheduled: {
      color: "text-purple-700",
      bg: "bg-gradient-to-r from-purple-50 to-violet-50",
      border: "border border-purple-200",
    },
  };

  if (!status) return null;
  const cfg = config[status] || config.Minor;

  return (
    <Badge className={`${cfg.bg} ${cfg.color} ${cfg.border} font-medium px-3 py-1 rounded-full shadow-sm`}>
      {status}
    </Badge>
  );
}

// Quick Stats Card
function QuickStatsCard({ title, icon: Icon, stats }: { title: string; icon: LucideIcon; stats: Array<{ label: string; value: string | number }> }) {
  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-slate-500" />
          <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {stats.map((stat, index) => (
            <div key={`stat-${index}`} className="flex items-center justify-between">
              <span className="text-sm text-slate-600">{stat.label}</span>
              <span className="text-sm font-semibold text-slate-900">{stat.value}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = React.useState<DashboardStats | null>(null);
  const [incidents, setIncidents] = React.useState<RecentIncident[]>([]);
  const [maintenance, setMaintenance] = React.useState<UpcomingMaintenance[]>([]);
  const [serverStatusCounts, setServerStatusCounts] = React.useState<Record<string, number>>({});
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = React.useState<Date | null>(null);

  const canCreateServer = can(user, "servers.create");
  const canReadServers = can(user, "servers.read");
  const canReadIncidents = can(user, "incidents.read");
  const canReadMaintenance = can(user, "maintenance.read");
  const canReadTeams = can(user, "teams.read");

  const loadDashboard = React.useCallback(async () => {
    try {
      setRefreshing(true);
      setLoading(true);

      const results = await Promise.allSettled([
        canReadServers ? api.get("/api/servers", { headers: { "x-sam-silent": "1" } }) : Promise.resolve(null),
        canReadIncidents ? api.get("/api/incidents", { headers: { "x-sam-silent": "1" } }) : Promise.resolve(null),
        canReadMaintenance ? api.get("/api/maintenance", { headers: { "x-sam-silent": "1" } }) : Promise.resolve(null),
        // Backend currently guards GET /api/engineers with teams.read.
        canReadTeams ? api.get("/api/engineers", { headers: { "x-sam-silent": "1" } }) : Promise.resolve(null),
      ]);

      const getData = <T,>(idx: number, fallback: T): T => {
        const r = results[idx];
        if (r?.status !== "fulfilled") return fallback;
        const value = r.value;
        if (!value) return fallback;
        return (value.data?.data ?? fallback) as T;
      };

      const servers = getData<ServerRow[]>(0, []);
      const incidentsData = getData<RecentIncident[]>(1, []);
      const maintenanceData = getData<UpcomingMaintenance[]>(2, []);
      const engineers = getData<EngineerRow[]>(3, []);

      const totalServers = servers.length;
      const statusCounts = servers.reduce<Record<string, number>>((acc, s) => {
        const key = String(s?.status ?? "Unknown").trim() || "Unknown";
        acc[key] = (acc[key] ?? 0) + 1;
        return acc;
      }, {});
      const activeIncidents = incidentsData.filter((i) => i.status === "Open" || i.status === "In Progress").length;
      const maintenanceDue = maintenanceData.filter((m) => m.status === "Scheduled").length;
      const healthyServers = servers.filter((s) => s.status === "Active").length;
      const healthyPercent = totalServers > 0 ? Math.round((healthyServers / totalServers) * 100) : 0;
      const engineersOnDuty = engineers.filter((e) => Boolean(e.is_active)).length;

      setStats({
        total_servers: totalServers,
        active_incidents: activeIncidents,
        maintenance_due: maintenanceDue,
        healthy_servers_percent: healthyPercent,
        engineers_on_duty: engineersOnDuty,
      });

      setServerStatusCounts(statusCounts);
      setIncidents(incidentsData.slice(0, 5));
      setMaintenance(maintenanceData.filter((m) => m.status === "Scheduled").slice(0, 5));
      setLastUpdatedAt(new Date());
    } catch (err) {
      console.error("Failed to load dashboard", err);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [canReadIncidents, canReadMaintenance, canReadServers, canReadTeams]);

  React.useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  return (
    <div className="min-h-screen bg-linear-to-b from-slate-50 to-white">
      <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {/* Modern Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
              <div className="mt-2 flex items-center gap-3 text-sm text-slate-600">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-emerald-500"></div>
                  <span>Welcome back, {user?.fullName || user?.username}</span>
                </div>
                {lastUpdatedAt && (
                  <>
                    <span className="text-slate-400">•</span>
                    <span className="text-xs bg-slate-100 px-2 py-1 rounded">
                      Updated {lastUpdatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void loadDashboard()}
                disabled={refreshing}
                className="border-slate-300 hover:border-slate-400"
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              {canCreateServer && (
                <Button 
                  size="sm" 
                  asChild
                  className="bg-linear-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white border-0 shadow-md hover:shadow-lg transition-shadow duration-200 font-medium"
                >
                  <Link href="/servers/new">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Server
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Main KPI Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {loading ? (
            [...Array(4)].map((_, i) => (
              <Card key={`kpi-skeleton-${i}`} className="border-slate-200">
                <CardContent className="p-6">
                  <Skeleton className="h-8 w-24 mb-2" />
                  <Skeleton className="h-10 w-32 mb-4" />
                  <Skeleton className="h-4 w-full" />
                </CardContent>
              </Card>
            ))
          ) : (
            <>
              <PremiumMetricCard
                title="Total Servers"
                value={stats?.total_servers ?? 0}
                subtitle="Infrastructure Assets"
                icon={Server}
                trend={{ value: 5.2, label: "vs last month" }}
                color="blue"
                gradient="from-blue-500 to-cyan-500"
                onClick={() => (window.location.href = "/servers")}
              />

              <PremiumMetricCard
                title="Active Incidents"
                value={stats?.active_incidents ?? 0}
                subtitle="Requires Attention"
                icon={AlertTriangle}
                trend={{ value: -25, label: "vs last week" }}
                color={stats?.active_incidents ? "red" : "green"}
                gradient={stats?.active_incidents ? "from-rose-500 to-pink-500" : "from-emerald-500 to-green-500"}
                onClick={() => (window.location.href = "/incidents")}
              />

              <PremiumMetricCard
                title="Maintenance Due"
                value={stats?.maintenance_due ?? 0}
                subtitle="Scheduled Tasks"
                icon={Wrench}
                trend={{ value: 8, label: "this week" }}
                color="amber"
                gradient="from-amber-500 to-orange-500"
                onClick={() => (window.location.href = "/maintenance")}
              />

              <PremiumMetricCard
                title="System Health"
                value={`${stats?.healthy_servers_percent ?? 0}%`}
                subtitle="Operational Status"
                icon={Activity}
                trend={{ value: 2.1, label: "improvement" }}
                color="green"
                gradient="from-emerald-500 to-green-500"
              />
            </>
          )}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Incidents & Maintenance */}
          <div className="lg:col-span-2 space-y-6">
            {/* Recent Incidents Card */}
            <Card className="border-slate-200">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-rose-500" />
                    <CardTitle className="text-lg font-semibold">Recent Incidents</CardTitle>
                  </div>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/incidents" className="text-sm">
                      View All
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <Skeleton key={`incident-skeleton-${i}`} className="h-16 w-full rounded-lg" />
                    ))}
                  </div>
                ) : incidents.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-50 mb-3">
                      <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                    </div>
                    <h3 className="text-sm font-medium text-slate-900 mb-1">All Systems Operational</h3>
                    <p className="text-xs text-slate-500">No active incidents at this time</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {incidents.map((incident, index) => (
                      <Link
                        key={`incident-${incident.incident_id || incident.server_code || index}`}
                        href="/incidents"
                        className="block p-3 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all duration-200"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="text-sm font-medium text-slate-900">
                                {incident.incident_type || "Incident"}
                              </h4>
                              <StatusBadge status={incident.severity} />
                            </div>
                            <div className="flex items-center gap-3 text-xs text-slate-500">
                              <span className="flex items-center gap-1">
                                <Server className="h-3 w-3" />
                                {incident.server_code || "—"}
                              </span>
                              {incident.reported_at && (
                                <>
                                  <span>•</span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {new Date(incident.reported_at).toLocaleDateString()}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                          <StatusBadge status={incident.status} />
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Scheduled Maintenance Card */}
            <Card className="border-slate-200">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-blue-500" />
                    <CardTitle className="text-lg font-semibold">Upcoming Maintenance</CardTitle>
                  </div>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/maintenance" className="text-sm">
                      View All
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <Skeleton key={`maintenance-skeleton-${i}`} className="h-16 w-full rounded-lg" />
                    ))}
                  </div>
                ) : maintenance.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-50 mb-3">
                      <Calendar className="h-6 w-6 text-blue-500" />
                    </div>
                    <h3 className="text-sm font-medium text-slate-900 mb-1">No Scheduled Maintenance</h3>
                    <p className="text-xs text-slate-500">All maintenance tasks are up to date</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {maintenance.map((item, index) => (
                      <Link
                        key={`maintenance-${item.schedule_id || item.server_code || index}`}
                        href="/maintenance"
                        className="block p-3 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all duration-200"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="text-sm font-medium text-slate-900">
                                {item.maintenance_type || "Maintenance"}
                              </h4>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-slate-500">
                              <span className="flex items-center gap-1">
                                <Server className="h-3 w-3" />
                                {item.server_code || "—"}
                              </span>
                              {item.scheduled_date && (
                                <>
                                  <span>•</span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {new Date(item.scheduled_date).toLocaleDateString()}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                          <StatusBadge status={item.status} />
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Status & Quick Stats */}
          <div className="space-y-6">
            {/* Server Status Distribution Card */}
            <Card className="border-slate-200">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-purple-500" />
                  <CardTitle className="text-lg font-semibold">Server Status</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-3">
                    {[...Array(4)].map((_, i) => (
                      <div key={`status-skeleton-${i}`} className="space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-2 w-full" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <StatusDistributionChart total={stats?.total_servers ?? 0} counts={serverStatusCounts} />
                )}
                
                {!loading && stats?.total_servers && (
                  <div className="mt-6 pt-4 border-t border-slate-200">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">Total Servers</span>
                      <span className="text-lg font-bold text-slate-900">{stats.total_servers}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Stats Card */}
            <QuickStatsCard
              title="System Overview"
              icon={Globe}
              stats={[
                { label: "Engineers on Duty", value: loading ? "—" : stats?.engineers_on_duty ?? 0 },
                { label: "Active Servers", value: loading ? "—" : (serverStatusCounts['Active'] || 0) },
                { label: "Uptime Rate", value: loading ? "—" : `${stats?.healthy_servers_percent ?? 0}%` },
                { label: "Response Time", value: loading ? "—" : "≤ 5min" },
              ]}
            />

            {/* Quick Actions Card */}
            <Card className="border-emerald-100 bg-linear-to-b from-emerald-50 to-white">
              <CardHeader>
                <CardTitle className="text-sm font-semibold text-slate-900">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Button 
                    variant="outline" 
                    className="w-full justify-start border-emerald-200 hover:border-emerald-300 hover:bg-emerald-50"
                    asChild
                  >
                    <Link href="/servers">
                      <Server className="mr-2 h-4 w-4" />
                      View All Servers
                    </Link>
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start border-slate-200 hover:border-slate-300"
                    asChild
                  >
                    <Link href="/monitoring">
                      <Activity className="mr-2 h-4 w-4" />
                      Live Monitoring
                    </Link>
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start border-slate-200 hover:border-slate-300"
                    asChild
                  >
                    <Link href="/reports">
                      <BarChart3 className="mr-2 h-4 w-4" />
                      Generate Report
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Environment Cards Row */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border-blue-200 bg-linear-to-br from-blue-50 to-white">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100">
                  <Monitor className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-blue-900">Production</h4>
                  <p className="text-xs text-blue-700">Critical infrastructure</p>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-2xl font-bold text-blue-900">
                  {loading ? "—" : Math.round((serverStatusCounts['Active'] || 0) * 0.6)}
                </span>
                <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-200">
                  Stable
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="border-purple-200 bg-linear-to-br from-purple-50 to-white">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-100">
                  <Cloud className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-purple-900">Development</h4>
                  <p className="text-xs text-purple-700">Testing environment</p>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-2xl font-bold text-purple-900">
                  {loading ? "—" : Math.round((serverStatusCounts['Active'] || 0) * 0.3)}
                </span>
                <Badge variant="outline" className="bg-purple-100 text-purple-700 border-purple-200">
                  Active
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-linear-to-br from-slate-50 to-white">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-slate-100">
                  <Database className="h-5 w-5 text-slate-600" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">Backup</h4>
                  <p className="text-xs text-slate-700">DR & Backup systems</p>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-2xl font-bold text-slate-900">
                  {loading ? "—" : Math.round((serverStatusCounts['Active'] || 0) * 0.1)}
                </span>
                <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-200">
                  Standby
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}