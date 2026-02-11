"use client";

import * as React from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Server,
  Wrench,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  RefreshCw,
  Calendar,
  CheckCircle2,
  Clock,
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
import { ServerStatusDonutChart } from "@/components/dashboard/server-status-donut-chart";
import { MaintenanceTrendChart } from "@/components/dashboard/maintenance-trend-chart";
import { ServerDistributionChart } from "@/components/dashboard/server-distribution-chart";
import { RecentActivityTimeline } from "@/components/dashboard/recent-activity-timeline";

// Premium Trend Indicator
function TrendIndicator({ value, label }: { value: number; label: string }) {
  const isPositive = value >= 0;
  
  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${
      isPositive 
        ? "bg-emerald-50 text-emerald-700 border border-emerald-200" 
        : "bg-rose-50 text-rose-700 border border-rose-200"
    }`}>
      {isPositive ? (
        <ArrowUpRight className="h-3 w-3" />
      ) : (
        <ArrowDownRight className="h-3 w-3" />
      )}
      <span>{Math.abs(value)}%</span>
      <span className="text-slate-500 ml-1">{label}</span>
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
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: { value: number; label: string };
  color?: "blue" | "green" | "amber" | "red" | "purple" | "slate";
  gradient?: string;
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
    >
      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${gradient}`} />
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
  const cfg = config[status] || config.Major;

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

// Mock data
const mockStats = {
  total_servers: 247,
  active_incidents: 3,
  maintenance_due: 12,
  healthy_servers_percent: 94,
  engineers_on_duty: 8,
};

const mockServerStatusCounts = {
  Active: 180,
  Maintenance: 42,
  Degraded: 15,
  Warning: 7,
  Down: 3,
};

const mockIncidents = [
  {
    incident_id: 1,
    server_code: "SRV-PROD-045",
    incident_type: "High CPU Usage",
    severity: "Critical",
    status: "Open",
    reported_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    incident_id: 2,
    server_code: "SRV-DEV-023",
    incident_type: "Memory Leak",
    severity: "Major",
    status: "In Progress",
    reported_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
  },
];

const mockMaintenance = [
  {
    schedule_id: 1,
    server_code: "SRV-CLOUD-056",
    maintenance_type: "OS Update",
    scheduled_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    status: "Scheduled",
  },
  {
    schedule_id: 2,
    server_code: "SRV-PROD-012",
    maintenance_type: "Hardware Inspection",
    scheduled_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    status: "Scheduled",
  },
];

export default function DashboardShowcasePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {/* Banner */}
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-900">
            <strong>Dashboard Showcase</strong> - This is a preview of the redesigned dashboard with enterprise-grade charts and analytics.
          </p>
        </div>

        {/* Modern Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
              <div className="mt-2 flex items-center gap-3 text-sm text-slate-600">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-emerald-500"></div>
                  <span>Welcome back, Administrator</span>
                </div>
                <span className="text-slate-400">•</span>
                <span className="text-xs bg-slate-100 px-2 py-1 rounded">
                  Updated {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                className="border-slate-300 hover:border-slate-400"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
              <Button 
                size="sm" 
                className="bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white border-0 shadow-md hover:shadow-lg transition-shadow duration-200 font-medium"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Server
              </Button>
            </div>
          </div>
        </div>

        {/* Main KPI Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <PremiumMetricCard
            title="Total Servers"
            value={mockStats.total_servers}
            subtitle="Infrastructure Assets"
            icon={Server}
            trend={{ value: 5.2, label: "vs last month" }}
            color="blue"
            gradient="from-blue-500 to-cyan-500"
          />

          <PremiumMetricCard
            title="Active Incidents"
            value={mockStats.active_incidents}
            subtitle="Requires Attention"
            icon={AlertTriangle}
            trend={{ value: -25, label: "vs last week" }}
            color="red"
            gradient="from-rose-500 to-pink-500"
          />

          <PremiumMetricCard
            title="Maintenance Due"
            value={mockStats.maintenance_due}
            subtitle="Scheduled Tasks"
            icon={Wrench}
            trend={{ value: 8, label: "this week" }}
            color="amber"
            gradient="from-amber-500 to-orange-500"
          />

          <PremiumMetricCard
            title="System Health"
            value={`${mockStats.healthy_servers_percent}%`}
            subtitle="Operational Status"
            icon={Activity}
            trend={{ value: 2.1, label: "improvement" }}
            color="green"
            gradient="from-emerald-500 to-green-500"
          />
        </div>

        {/* Analytics & Charts Section */}
        <div className="mb-8">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Analytics Overview</h2>
            <p className="text-sm text-slate-500">Visual insights into your infrastructure</p>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Server Status Donut Chart */}
            <ServerStatusDonutChart data={mockServerStatusCounts} loading={false} />
            
            {/* Maintenance Trend Chart */}
            <MaintenanceTrendChart loading={false} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Server Distribution Bar Chart */}
            <ServerDistributionChart loading={false} />
            
            {/* Recent Activity Timeline */}
            <RecentActivityTimeline loading={false} />
          </div>
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
                  <Button variant="ghost" size="sm">
                    <span className="text-sm">View All</span>
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {mockIncidents.map((incident, index) => (
                    <div
                      key={`incident-${incident.incident_id}-${index}`}
                      className="block p-3 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all duration-200"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="text-sm font-medium text-slate-900">
                              {incident.incident_type}
                            </h4>
                            <StatusBadge status={incident.severity} />
                          </div>
                          <div className="flex items-center gap-3 text-xs text-slate-500">
                            <span className="flex items-center gap-1">
                              <Server className="h-3 w-3" />
                              {incident.server_code}
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(incident.reported_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <StatusBadge status={incident.status} />
                      </div>
                    </div>
                  ))}
                </div>
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
                  <Button variant="ghost" size="sm">
                    <span className="text-sm">View All</span>
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {mockMaintenance.map((item, index) => (
                    <div
                      key={`maintenance-${item.schedule_id}-${index}`}
                      className="block p-3 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all duration-200"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="text-sm font-medium text-slate-900">
                              {item.maintenance_type}
                            </h4>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-slate-500">
                            <span className="flex items-center gap-1">
                              <Server className="h-3 w-3" />
                              {item.server_code}
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(item.scheduled_date).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <StatusBadge status={item.status} />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Quick Stats */}
          <div className="space-y-6">
            {/* Quick Stats Card */}
            <QuickStatsCard
              title="System Overview"
              icon={Globe}
              stats={[
                { label: "Engineers on Duty", value: mockStats.engineers_on_duty },
                { label: "Active Servers", value: mockServerStatusCounts.Active },
                { label: "Uptime Rate", value: `${mockStats.healthy_servers_percent}%` },
                { label: "Response Time", value: "≤ 5min" },
              ]}
            />

            {/* Quick Actions Card */}
            <Card className="border-emerald-100 bg-gradient-to-b from-emerald-50 to-white">
              <CardHeader>
                <CardTitle className="text-sm font-semibold text-slate-900">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Button 
                    variant="outline" 
                    className="w-full justify-start border-emerald-200 hover:border-emerald-300 hover:bg-emerald-50"
                  >
                    <Server className="mr-2 h-4 w-4" />
                    View All Servers
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start border-slate-200 hover:border-slate-300"
                  >
                    <Activity className="mr-2 h-4 w-4" />
                    Live Monitoring
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start border-slate-200 hover:border-slate-300"
                  >
                    <BarChart3 className="mr-2 h-4 w-4" />
                    Generate Report
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Environment Cards Row */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-white">
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
                <span className="text-2xl font-bold text-blue-900">108</span>
                <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-200">
                  Stable
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-white">
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
                <span className="text-2xl font-bold text-purple-900">54</span>
                <Badge variant="outline" className="bg-purple-100 text-purple-700 border-purple-200">
                  Active
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-gradient-to-br from-slate-50 to-white">
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
                <span className="text-2xl font-bold text-slate-900">18</span>
                <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-200">
                  Standby
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Back to login link */}
        <div className="mt-8 text-center">
          <Link href="/login" className="text-sm text-primary hover:underline">
            ← Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}
