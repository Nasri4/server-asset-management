"use client";

import * as React from "react";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  Filter,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Server,
  Settings,
  Shield,
  Trash2,
  XCircle,
  Zap,
} from "lucide-react";

import { FadeIn } from "@/components/motion/fade-in";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  PremiumTable,
  PremiumTableHeader,
  PremiumTableHead,
  PremiumTableBody,
  PremiumTableRow,
  PremiumTableCell,
  PremiumStatusBadge,
  PremiumActionButton,
  PremiumTableEmptyState,
  PremiumTableSkeleton,
} from "@/components/tables/premium-table";

export default function V2ShowcasePage() {
  const [loading, setLoading] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [sortField, setSortField] = React.useState<string>("hostname");
  const [sortDirection, setSortDirection] = React.useState<"asc" | "desc">("asc");

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Sample data
  const sampleServers = [
    {
      id: 1,
      hostname: "prod-web-01.hormuud.com",
      ipAddress: "10.20.30.100",
      status: "Active",
      environment: "Production",
      location: "Mogadishu DC1",
      uptime: "99.97%",
      lastSeen: "2 mins ago",
    },
    {
      id: 2,
      hostname: "prod-db-primary.hormuud.com",
      ipAddress: "10.20.30.101",
      status: "Active",
      environment: "Production",
      location: "Mogadishu DC1",
      uptime: "99.99%",
      lastSeen: "1 min ago",
    },
    {
      id: 3,
      hostname: "prod-api-02.hormuud.com",
      ipAddress: "10.20.30.102",
      status: "Warning",
      environment: "Production",
      location: "Mogadishu DC2",
      uptime: "98.50%",
      lastSeen: "5 mins ago",
    },
    {
      id: 4,
      hostname: "staging-web-01.hormuud.com",
      ipAddress: "10.20.40.100",
      status: "Active",
      environment: "Staging",
      location: "Mogadishu DC1",
      uptime: "99.80%",
      lastSeen: "3 mins ago",
    },
    {
      id: 5,
      hostname: "prod-cache-01.hormuud.com",
      ipAddress: "10.20.30.110",
      status: "Maintenance",
      environment: "Production",
      location: "Mogadishu DC1",
      uptime: "95.20%",
      lastSeen: "30 mins ago",
    },
    {
      id: 6,
      hostname: "dev-app-05.hormuud.com",
      ipAddress: "10.20.50.105",
      status: "Offline",
      environment: "Development",
      location: "Mogadishu DC2",
      uptime: "45.00%",
      lastSeen: "2 hours ago",
    },
  ];

  const getStatusVariant = (status: string): "success" | "warning" | "danger" | "secondary" | "info" => {
    const normalized = status.toLowerCase();
    if (normalized === "active") return "success";
    if (normalized === "warning") return "warning";
    if (normalized === "offline") return "danger";
    if (normalized === "maintenance") return "secondary";
    return "info";
  };

  const getEnvironmentStyles = (environment: string) => {
    const normalized = environment.toLowerCase();
    if (normalized === "production") {
      return "bg-red-50 text-red-700 border-red-200/60 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/30";
    }
    if (normalized === "staging") {
      return "bg-violet-50 text-violet-700 border-violet-200/60 dark:bg-violet-950/20 dark:text-violet-400 dark:border-violet-900/30";
    }
    if (normalized === "development") {
      return "bg-blue-50 text-blue-700 border-blue-200/60 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/30";
    }
    return "bg-slate-50 text-slate-700 border-slate-200/60 dark:bg-slate-950/20 dark:text-slate-400 dark:border-slate-900/30";
  };

  const filteredServers = sampleServers.filter((server) =>
    server.hostname.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <FadeIn>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">V2 Premium Showcase</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Enterprise-grade table design inspired by Stripe, Linear, and AWS Console
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add Server
            </Button>
          </div>
        </div>

        {/* Design Features */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">✨ V2 Design Features</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" />
                <div>
                  <span className="font-medium text-slate-900 dark:text-slate-100">Sticky Header</span> with dark background
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" />
                <div>
                  <span className="font-medium text-slate-900 dark:text-slate-100">Uppercase Column Labels</span> with letter spacing
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" />
                <div>
                  <span className="font-medium text-slate-900 dark:text-slate-100">Subtle Row Hover</span> for better UX
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" />
                <div>
                  <span className="font-medium text-slate-900 dark:text-slate-100">Status Pills</span> with colored dots
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" />
                <div>
                  <span className="font-medium text-slate-900 dark:text-slate-100">Circular Action Buttons</span> with hover states
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" />
                <div>
                  <span className="font-medium text-slate-900 dark:text-slate-100">Clean Spacing</span> and professional typography
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Status Badge Examples */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status Badge Variants</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <PremiumStatusBadge variant="success">Active</PremiumStatusBadge>
              <PremiumStatusBadge variant="warning">Warning</PremiumStatusBadge>
              <PremiumStatusBadge variant="danger">Offline</PremiumStatusBadge>
              <PremiumStatusBadge variant="secondary">Maintenance</PremiumStatusBadge>
              <PremiumStatusBadge variant="info">Info</PremiumStatusBadge>
            </div>
          </CardContent>
        </Card>

        {/* Table Controls */}
        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              type="search"
              placeholder="Search servers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Filter className="mr-2 h-4 w-4" />
                  Filter
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Status</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>Active</DropdownMenuItem>
                <DropdownMenuItem>Offline</DropdownMenuItem>
                <DropdownMenuItem>Maintenance</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Settings className="mr-2 h-4 w-4" />
                  Columns
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Visible Columns</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>Hostname</DropdownMenuItem>
                <DropdownMenuItem>IP Address</DropdownMenuItem>
                <DropdownMenuItem>Status</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Premium Table */}
        <PremiumTable>
          <PremiumTableHeader>
            <tr>
              <PremiumTableHead sortable sortDirection={sortField === "hostname" ? sortDirection : null} onSort={() => handleSort("hostname")}>
                Hostname
              </PremiumTableHead>
              <PremiumTableHead>IP Address</PremiumTableHead>
              <PremiumTableHead sortable sortDirection={sortField === "status" ? sortDirection : null} onSort={() => handleSort("status")}>
                Status
              </PremiumTableHead>
              <PremiumTableHead>Environment</PremiumTableHead>
              <PremiumTableHead>Location</PremiumTableHead>
              <PremiumTableHead numeric>Uptime</PremiumTableHead>
              <PremiumTableHead>Last Seen</PremiumTableHead>
              <PremiumTableHead className="w-[100px] text-center">Actions</PremiumTableHead>
            </tr>
          </PremiumTableHeader>
          <PremiumTableBody>
            {loading ? (
              <PremiumTableSkeleton rows={6} cols={8} />
            ) : filteredServers.length === 0 ? (
              <PremiumTableEmptyState
                icon={<Server className="h-12 w-12" />}
                title="No servers found"
                description="Try adjusting your search or filters"
                action={
                  <Button size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Server
                  </Button>
                }
              />
            ) : (
              filteredServers.map((server) => (
                <PremiumTableRow key={server.id}>
                  <PremiumTableCell>
                    <div className="flex items-center gap-2">
                      <Server className="h-4 w-4 text-slate-400" />
                      <span className="font-medium text-slate-900 dark:text-slate-100">{server.hostname}</span>
                    </div>
                  </PremiumTableCell>
                  <PremiumTableCell>
                    <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs dark:bg-slate-900">{server.ipAddress}</code>
                  </PremiumTableCell>
                  <PremiumTableCell>
                    <PremiumStatusBadge variant={getStatusVariant(server.status)}>{server.status}</PremiumStatusBadge>
                  </PremiumTableCell>
                  <PremiumTableCell>
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${getEnvironmentStyles(server.environment)}`}>
                      {server.environment}
                    </span>
                  </PremiumTableCell>
                  <PremiumTableCell>{server.location}</PremiumTableCell>
                  <PremiumTableCell numeric>
                    <span className="font-medium">{server.uptime}</span>
                  </PremiumTableCell>
                  <PremiumTableCell>
                    <span className="text-slate-500 dark:text-slate-400">{server.lastSeen}</span>
                  </PremiumTableCell>
                  <PremiumTableCell>
                    <div className="flex items-center justify-center gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <PremiumActionButton variant="view" icon={<Eye className="h-4 w-4" />} onClick={() => alert(`View ${server.hostname}`)} />
                        </TooltipTrigger>
                        <TooltipContent>View Details</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <PremiumActionButton variant="edit" icon={<Pencil className="h-4 w-4" />} onClick={() => alert(`Edit ${server.hostname}`)} />
                        </TooltipTrigger>
                        <TooltipContent>Edit Server</TooltipContent>
                      </Tooltip>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <PremiumActionButton variant="default" icon={<MoreVertical className="h-4 w-4" />} />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Activity className="mr-2 h-4 w-4" />
                            View Activity
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Shield className="mr-2 h-4 w-4" />
                            Security Settings
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-red-600">
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </PremiumTableCell>
                </PremiumTableRow>
              ))
            )}
          </PremiumTableBody>
        </PremiumTable>

        {/* Footer */}
        <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-400">
          <div>Showing {filteredServers.length} of {sampleServers.length} servers</div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled>
              Next
            </Button>
          </div>
        </div>
      </div>
    </FadeIn>
  );
}
