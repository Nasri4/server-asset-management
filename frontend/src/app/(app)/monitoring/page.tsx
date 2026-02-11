"use client";

import * as React from "react";
import {
  Activity,
  AlertTriangle,
  ChevronDown,
  Cpu,
  Download,
  Eye,
  HardDrive,
  MemoryStick,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  X,
} from "lucide-react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { FadeIn } from "@/components/motion/fade-in";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { api } from "@/lib/api/client";
import { useAuth } from "@/components/auth/auth-provider";
import { can } from "@/lib/rbac";
import { buildCsv, downloadCsv } from "@/lib/utils/csv";
import { ServerSelect } from "@/components/forms/server-select";

type MonitoringRow = {
  monitoring_id: number;
  server_id: number;
  server_code?: string;
  hostname?: string;
  location_name?: string;
  team_name?: string;
  monitoring_tool?: string | null;
  cpu_threshold?: number | null;
  ram_threshold?: number | null;
  disk_threshold?: number | null;
  health_status: string;
  uptime_percent: number;
  last_health_check?: string | null;
  created_at?: string;
  updated_at?: string;
};

const schema = z.object({
  server_id: z.number().int().positive("Server is required").optional(),
  monitoring_tool: z.string().trim().optional(),
  cpu_threshold: z.number().min(0).max(100),
  ram_threshold: z.number().min(0).max(100),
  disk_threshold: z.number().min(0).max(100),
  health_status: z.enum(["Healthy", "Warning", "Critical", "Unknown"]),
  uptime_percent: z.number().min(0).max(100),
});

type FormValues = z.infer<typeof schema>;

// Helper function to map health status to PremiumStatusBadge variant
function getHealthStatusVariant(status?: string): "success" | "warning" | "danger" | "secondary" | "info" {
  if (!status) return "secondary";
  const normalized = status.toLowerCase();
  if (normalized === "healthy") return "success";
  if (normalized === "warning") return "warning";
  if (normalized === "critical") return "danger";
  return "secondary";
}

export default function MonitoringPage() {
  const { user } = useAuth();
  const [rows, setRows] = React.useState<MonitoringRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  // Search and filters
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [sortField, setSortField] = React.useState<string>("server_code");
  const [sortDirection, setSortDirection] = React.useState<"asc" | "desc">("asc");

  // Column visibility
  const [visibleColumns, setVisibleColumns] = React.useState({
    server_code: true,
    hostname: true,
    monitoring_tool: true,
    cpu_threshold: true,
    ram_threshold: true,
    disk_threshold: true,
    uptime_percent: true,
    last_health_check: true,
    health_status: true,
  });

  const [page, setPage] = React.useState(1);
  const pageSize = 15;

  const canUpdate = can(user, "monitoring.update");

  // Detail drawer
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [selectedRow, setSelectedRow] = React.useState<MonitoringRow | null>(null);

  // Edit dialog
  const [editOpen, setEditOpen] = React.useState(false);
  const [editRow, setEditRow] = React.useState<MonitoringRow | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const serverId = watch("server_id");

  const load = React.useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const res = await api.get("/api/monitoring", { headers: { "x-sam-silent": "1" } });
      setRows((res.data?.data ?? []) as MonitoringRow[]);
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.message || "Failed to load monitoring data";
      setLoadError(msg);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const openDetail = React.useCallback((row: MonitoringRow) => {
    setSelectedRow(row);
    setDetailOpen(true);
  }, []);

  const openEdit = React.useCallback(
    (row: MonitoringRow | null) => {
      setEditRow(row);
      if (row) {
        reset({
          server_id: row.server_id,
          monitoring_tool: row.monitoring_tool || "",
          cpu_threshold: row.cpu_threshold ?? 80,
          ram_threshold: row.ram_threshold ?? 80,
          disk_threshold: row.disk_threshold ?? 90,
          health_status: (row.health_status as any) || "Healthy",
          uptime_percent: row.uptime_percent ?? 99.9,
        });
      } else {
        reset({
          server_id: 0,
          monitoring_tool: "",
          cpu_threshold: 80,
          ram_threshold: 80,
          disk_threshold: 90,
          health_status: "Healthy",
          uptime_percent: 99.9,
        });
      }
      setEditOpen(true);
    },
    [reset]
  );

  const onSubmit = React.useCallback(
    async (values: FormValues) => {
      try {
        if (editRow) {
          // Update existing monitoring
          await api.patch(`/api/monitoring/${editRow.monitoring_id}`, values, {
            headers: { "x-sam-silent": "1" },
          });
          toast.success("Monitoring updated");
        } else {
          // Create new monitoring
          if (!values.server_id) {
            toast.error("Please select a server");
            return;
          }
          await api.post("/api/monitoring", values, {
            headers: { "x-sam-silent": "1" },
          });
          toast.success("Monitoring created");
        }
        setEditOpen(false);
        await load();
      } catch (err: any) {
        const msg = err?.response?.data?.error?.message || err?.message || "Failed to save monitoring";
        toast.error(msg);
      }
    },
    [editRow, load]
  );

  // Filter and sort
  const filteredRows = React.useMemo(() => {
    let result = [...rows];

    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((r) => {
        const code = (r.server_code ?? "").toLowerCase();
        const hostname = (r.hostname ?? "").toLowerCase();
        const tool = (r.monitoring_tool ?? "").toLowerCase();
        return code.includes(q) || hostname.includes(q) || tool.includes(q);
      });
    }

    // Status filter
    if (statusFilter && statusFilter !== "all") {
      result = result.filter((r) => r.health_status === statusFilter);
    }

    // Sort
    result.sort((a, b) => {
      let aVal: any = a[sortField as keyof MonitoringRow];
      let bVal: any = b[sortField as keyof MonitoringRow];

      if (aVal == null) aVal = "";
      if (bVal == null) bVal = "";

      if (typeof aVal === "string") aVal = aVal.toLowerCase();
      if (typeof bVal === "string") bVal = bVal.toLowerCase();

      return sortDirection === "asc" ? (aVal > bVal ? 1 : -1) : aVal < bVal ? 1 : -1;
    });

    return result;
  }, [rows, searchQuery, statusFilter, sortField, sortDirection]);

  // Pagination
  const total = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const endIndex = Math.min(total, startIndex + pageSize);
  const pagedRows = filteredRows.slice(startIndex, endIndex);

  // Reset page when filters change
  React.useEffect(() => {
    setPage(1);
  }, [searchQuery, statusFilter]);

  const exportCsv = React.useCallback(() => {
    const headers = [
      "Server Code",
      "Hostname",
      "Monitoring Tool",
      "CPU Threshold",
      "RAM Threshold",
      "Disk Threshold",
      "Uptime %",
      "Health Status",
    ];
    const data = filteredRows.map((r) => [
      r.server_code ?? "",
      r.hostname ?? "",
      r.monitoring_tool ?? "",
      r.cpu_threshold ?? "",
      r.ram_threshold ?? "",
      r.disk_threshold ?? "",
      r.uptime_percent ?? "",
      r.health_status ?? "",
    ]);
    const csv = buildCsv(headers, data);
    downloadCsv(csv, `monitoring-export-${new Date().toISOString().split("T")[0]}.csv`);
    toast.success("Exported successfully");
  }, [filteredRows]);

  const toggleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  return (
    <FadeIn>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Monitoring & Health</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Server health, performance thresholds, and uptime tracking
            </p>
          </div>

          <div className="flex items-center gap-2">
            {canUpdate && (
              <Button size="sm" onClick={() => openEdit(null)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Monitoring
              </Button>
            )}

            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={exportCsv}
              disabled={loading || rows.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* Table Controls */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Settings className="h-4 w-4 mr-2" />
                  Columns
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={visibleColumns.server_code}
                  onCheckedChange={(checked) =>
                    setVisibleColumns((prev) => ({ ...prev, server_code: checked }))
                  }
                >
                  Server Code
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={visibleColumns.hostname}
                  onCheckedChange={(checked) =>
                    setVisibleColumns((prev) => ({ ...prev, hostname: checked }))
                  }
                >
                  Hostname
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={visibleColumns.monitoring_tool}
                  onCheckedChange={(checked) =>
                    setVisibleColumns((prev) => ({ ...prev, monitoring_tool: checked }))
                  }
                >
                  Monitoring Tool
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={visibleColumns.cpu_threshold}
                  onCheckedChange={(checked) =>
                    setVisibleColumns((prev) => ({ ...prev, cpu_threshold: checked }))
                  }
                >
                  CPU Threshold
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={visibleColumns.ram_threshold}
                  onCheckedChange={(checked) =>
                    setVisibleColumns((prev) => ({ ...prev, ram_threshold: checked }))
                  }
                >
                  RAM Threshold
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={visibleColumns.disk_threshold}
                  onCheckedChange={(checked) =>
                    setVisibleColumns((prev) => ({ ...prev, disk_threshold: checked }))
                  }
                >
                  Disk Threshold
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={visibleColumns.uptime_percent}
                  onCheckedChange={(checked) =>
                    setVisibleColumns((prev) => ({ ...prev, uptime_percent: checked }))
                  }
                >
                  Uptime %
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={visibleColumns.last_health_check}
                  onCheckedChange={(checked) =>
                    setVisibleColumns((prev) => ({ ...prev, last_health_check: checked }))
                  }
                >
                  Last Health Check
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={visibleColumns.health_status}
                  onCheckedChange={(checked) =>
                    setVisibleColumns((prev) => ({ ...prev, health_status: checked }))
                  }
                >
                  Health Status
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search by server code, hostname, or tool..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-9"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="min-w-[140px] justify-between">
                  <span>
                    {statusFilter === "all"
                      ? "All Status"
                      : statusFilter}
                  </span>
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setStatusFilter("all")}>
                  All Status
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setStatusFilter("Healthy")}>
                  <ShieldCheck className="mr-2 h-4 w-4 text-emerald-600" /> Healthy
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("Warning")}>
                  <AlertTriangle className="mr-2 h-4 w-4 text-amber-600" /> Warning
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("Critical")}>
                  <AlertTriangle className="mr-2 h-4 w-4 text-rose-600" /> Critical
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("Unknown")}>
                  <Activity className="mr-2 h-4 w-4 text-slate-600" /> Unknown
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Active Filters Display */}
          {(searchQuery || statusFilter !== "all") && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-500 dark:text-slate-400">Active filters:</span>
              {searchQuery && (
                <Badge variant="secondary" className="gap-1">
                  Search: {searchQuery}
                  <button onClick={() => setSearchQuery("")} className="hover:text-foreground">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {statusFilter !== "all" && (
                <Badge variant="secondary" className="gap-1">
                  Status: {statusFilter}
                  <button onClick={() => setStatusFilter("all")} className="hover:text-foreground">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              <button
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("all");
                }}
                className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 underline"
              >
                Clear all
              </button>
            </div>
          )}
        </div>

        {/* Premium Table */}
        <PremiumTable>
          <PremiumTableHeader>
            <tr>
              {visibleColumns.server_code && (
                <PremiumTableHead
                  sortable
                  sortDirection={sortField === "server_code" ? sortDirection : null}
                  onSort={() => toggleSort("server_code")}
                >
                  Server Code
                </PremiumTableHead>
              )}
              {visibleColumns.hostname && (
                <PremiumTableHead
                  sortable
                  sortDirection={sortField === "hostname" ? sortDirection : null}
                  onSort={() => toggleSort("hostname")}
                >
                  Hostname
                </PremiumTableHead>
              )}
              {visibleColumns.monitoring_tool && (
                <PremiumTableHead>Monitoring Tool</PremiumTableHead>
              )}
              {visibleColumns.cpu_threshold && (
                <PremiumTableHead>
                  <div className="flex items-center gap-1">
                    <Cpu className="h-3.5 w-3.5" />
                    CPU %
                  </div>
                </PremiumTableHead>
              )}
              {visibleColumns.ram_threshold && (
                <PremiumTableHead>
                  <div className="flex items-center gap-1">
                    <MemoryStick className="h-3.5 w-3.5" />
                    RAM %
                  </div>
                </PremiumTableHead>
              )}
              {visibleColumns.disk_threshold && (
                <PremiumTableHead>
                  <div className="flex items-center gap-1">
                    <HardDrive className="h-3.5 w-3.5" />
                    Disk %
                  </div>
                </PremiumTableHead>
              )}
              {visibleColumns.uptime_percent && (
                <PremiumTableHead
                  sortable
                  sortDirection={sortField === "uptime_percent" ? sortDirection : null}
                  onSort={() => toggleSort("uptime_percent")}
                >
                  Uptime %
                </PremiumTableHead>
              )}
              {visibleColumns.last_health_check && (
                <PremiumTableHead>Last Check</PremiumTableHead>
              )}
              {visibleColumns.health_status && (
                <PremiumTableHead
                  sortable
                  sortDirection={sortField === "health_status" ? sortDirection : null}
                  onSort={() => toggleSort("health_status")}
                >
                  Health Status
                </PremiumTableHead>
              )}
              <PremiumTableHead className="w-[120px] text-center">Actions</PremiumTableHead>
            </tr>
          </PremiumTableHeader>
          <PremiumTableBody>
            {loading ? (
              <PremiumTableSkeleton rows={5} cols={10} />
            ) : loadError ? (
              <tr>
                <td colSpan={100} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <AlertTriangle className="h-12 w-12 text-slate-400" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Unable to load monitoring data</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{loadError}</p>
                    </div>
                    <Button onClick={load} variant="outline" size="sm">
                      Retry
                    </Button>
                  </div>
                </td>
              </tr>
            ) : total > 0 ? (
              <>
                {pagedRows.map((row) => (
                  <PremiumTableRow key={row.monitoring_id} onClick={() => openDetail(row)}>
                    {visibleColumns.server_code && (
                      <PremiumTableCell>
                        <div className="font-semibold">{row.server_code || "—"}</div>
                      </PremiumTableCell>
                    )}
                    {visibleColumns.hostname && (
                      <PremiumTableCell>
                        <span className="text-slate-500 dark:text-slate-400">{row.hostname || "—"}</span>
                      </PremiumTableCell>
                    )}
                    {visibleColumns.monitoring_tool && (
                      <PremiumTableCell>{row.monitoring_tool || "—"}</PremiumTableCell>
                    )}
                    {visibleColumns.cpu_threshold && (
                      <PremiumTableCell numeric>
                        <span className="text-sm font-mono">
                          {row.cpu_threshold ?? "—"}
                          {row.cpu_threshold != null && "%"}
                        </span>
                      </PremiumTableCell>
                    )}
                    {visibleColumns.ram_threshold && (
                      <PremiumTableCell numeric>
                        <span className="text-sm font-mono">
                          {row.ram_threshold ?? "—"}
                          {row.ram_threshold != null && "%"}
                        </span>
                      </PremiumTableCell>
                    )}
                    {visibleColumns.disk_threshold && (
                      <PremiumTableCell numeric>
                        <span className="text-sm font-mono">
                          {row.disk_threshold ?? "—"}
                          {row.disk_threshold != null && "%"}
                        </span>
                      </PremiumTableCell>
                    )}
                    {visibleColumns.uptime_percent && (
                      <PremiumTableCell numeric>
                        <span className="text-sm font-mono font-medium">
                          {row.uptime_percent?.toFixed(1) ?? "0"}%
                        </span>
                      </PremiumTableCell>
                    )}
                    {visibleColumns.last_health_check && (
                      <PremiumTableCell>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {row.last_health_check
                            ? new Date(row.last_health_check).toLocaleString()
                            : "—"}
                        </span>
                      </PremiumTableCell>
                    )}
                    {visibleColumns.health_status && (
                      <PremiumTableCell>
                        <PremiumStatusBadge variant={getHealthStatusVariant(row.health_status)}>
                          {row.health_status || "Unknown"}
                        </PremiumStatusBadge>
                      </PremiumTableCell>
                    )}
                    <PremiumTableCell onClick={(e) => e.stopPropagation()}>
                      {canUpdate ? (
                        <div className="flex items-center justify-center gap-1">
                          <PremiumActionButton
                            variant="view"
                            icon={<Eye className="h-4 w-4" />}
                            onClick={() => openDetail(row)}
                            tooltip="View details"
                          />
                          <PremiumActionButton
                            variant="edit"
                            icon={<Pencil className="h-4 w-4" />}
                            onClick={() => openEdit(row)}
                            tooltip="Update thresholds"
                          />
                        </div>
                      ) : (
                        <span className="text-sm text-slate-400">—</span>
                      )}
                    </PremiumTableCell>
                  </PremiumTableRow>
                ))}
              </>
            ) : (
              <PremiumTableEmptyState
                icon={<Activity className="h-12 w-12 text-slate-400" />}
                title="No monitoring data"
                description={
                  searchQuery || statusFilter !== "all"
                    ? "Try adjusting your search or filters"
                    : "No monitoring records are available"
                }
              />
            )}
          </PremiumTableBody>
        </PremiumTable>

        {/* Pagination */}
        {total > 0 && (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-slate-500 dark:text-slate-400">
              Showing {total ? startIndex + 1 : 0} to {endIndex} of {total}{" "}
              {total === 1 ? "server" : "servers"} monitored
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
              >
                Previous
              </Button>

              <div className="text-sm text-slate-500 dark:text-slate-400">
                Page {safePage} of {totalPages}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}

        {/* Detail Drawer */}
        <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
          <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Monitoring Details</SheetTitle>
            </SheetHeader>

            {selectedRow && (
              <div className="mt-6 space-y-6">
                {/* Server Overview */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground">Server Overview</h3>
                  <div className="space-y-2 rounded-lg border p-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Server Code</span>
                      <span className="font-medium">{selectedRow.server_code || "—"}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Hostname</span>
                      <span className="font-medium">{selectedRow.hostname || "—"}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Location</span>
                      <span className="font-medium">{selectedRow.location_name || "—"}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Team</span>
                      <span className="font-medium">{selectedRow.team_name || "—"}</span>
                    </div>
                  </div>
                </div>

                {/* Monitoring Configuration */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground">
                    Monitoring Configuration
                  </h3>
                  <div className="space-y-2 rounded-lg border p-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Monitoring Tool</span>
                      <span className="font-medium">{selectedRow.monitoring_tool || "—"}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Cpu className="h-3.5 w-3.5" /> CPU Threshold
                      </span>
                      <span className="font-mono font-medium">
                        {selectedRow.cpu_threshold ?? "—"}
                        {selectedRow.cpu_threshold != null && "%"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <MemoryStick className="h-3.5 w-3.5" /> RAM Threshold
                      </span>
                      <span className="font-mono font-medium">
                        {selectedRow.ram_threshold ?? "—"}
                        {selectedRow.ram_threshold != null && "%"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <HardDrive className="h-3.5 w-3.5" /> Disk Threshold
                      </span>
                      <span className="font-mono font-medium">
                        {selectedRow.disk_threshold ?? "—"}
                        {selectedRow.disk_threshold != null && "%"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Health Info */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground">Health Information</h3>
                  <div className="space-y-2 rounded-lg border p-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Current Uptime</span>
                      <span className="font-mono font-medium">
                        {selectedRow.uptime_percent?.toFixed(1) ?? "0"}%
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Last Health Check</span>
                      <span className="font-medium text-xs">
                        {selectedRow.last_health_check
                          ? new Date(selectedRow.last_health_check).toLocaleString()
                          : "—"}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm items-center">
                      <span className="text-muted-foreground">Health Status</span>
                      <PremiumStatusBadge variant={getHealthStatusVariant(selectedRow.health_status)}>
                        {selectedRow.health_status || "Unknown"}
                      </PremiumStatusBadge>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                {canUpdate && (
                  <div className="pt-4">
                    <Button
                      className="w-full"
                      onClick={() => {
                        setDetailOpen(false);
                        openEdit(selectedRow);
                      }}
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      Update Thresholds
                    </Button>
                  </div>
                )}
              </div>
            )}
          </SheetContent>
        </Sheet>

        {/* Edit Dialog */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editRow ? "Update Monitoring" : "Create Monitoring"}</DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Server Selection (Create Mode Only) */}
              {!editRow && (
                <div className="space-y-4">
                  <div className="text-sm font-medium text-muted-foreground">Server</div>
                  <div className="grid gap-2">
                    <ServerSelect
                      value={serverId || undefined}
                      onChange={(id) => {
                        if (id === undefined) return;
                        setValue("server_id", id, { shouldValidate: true });
                      }}
                      showSearch={false}
                    />
                    <input type="hidden" {...register("server_id", { valueAsNumber: true })} />
                    {errors.server_id && (
                      <p className="text-xs text-destructive">{errors.server_id.message}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Monitoring Tool */}
              <div className="space-y-4">
                <div className="text-sm font-medium text-muted-foreground">Monitoring Tool</div>
                <div className="grid gap-2">
                  <Label htmlFor="monitoring_tool">Tool Name</Label>
                  <Input
                    id="monitoring_tool"
                    placeholder="e.g. Zabbix, Prometheus, Nagios"
                    {...register("monitoring_tool")}
                  />
                </div>
              </div>

              {/* Thresholds */}
              <div className="space-y-4">
                <div className="text-sm font-medium text-muted-foreground">Resource Thresholds</div>
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="cpu_threshold">CPU Threshold (%)</Label>
                    <Input
                      id="cpu_threshold"
                      type="number"
                      min="0"
                      max="100"
                      {...register("cpu_threshold", { valueAsNumber: true })}
                    />
                    {errors.cpu_threshold && (
                      <p className="text-xs text-destructive">{errors.cpu_threshold.message}</p>
                    )}
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="ram_threshold">RAM Threshold (%)</Label>
                    <Input
                      id="ram_threshold"
                      type="number"
                      min="0"
                      max="100"
                      {...register("ram_threshold", { valueAsNumber: true })}
                    />
                    {errors.ram_threshold && (
                      <p className="text-xs text-destructive">{errors.ram_threshold.message}</p>
                    )}
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="disk_threshold">Disk Threshold (%)</Label>
                    <Input
                      id="disk_threshold"
                      type="number"
                      min="0"
                      max="100"
                      {...register("disk_threshold", { valueAsNumber: true })}
                    />
                    {errors.disk_threshold && (
                      <p className="text-xs text-destructive">{errors.disk_threshold.message}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Health Status */}
              <div className="space-y-4">
                <div className="text-sm font-medium text-muted-foreground">Health & Uptime</div>
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="health_status">Health Status</Label>
                    <select
                      id="health_status"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      {...register("health_status")}
                    >
                      <option value="Healthy">Healthy</option>
                      <option value="Warning">Warning</option>
                      <option value="Critical">Critical</option>
                      <option value="Unknown">Unknown</option>
                    </select>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="uptime_percent">Uptime (%)</Label>
                    <Input
                      id="uptime_percent"
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      {...register("uptime_percent", { valueAsNumber: true })}
                    />
                    {errors.uptime_percent && (
                      <p className="text-xs text-destructive">{errors.uptime_percent.message}</p>
                    )}
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting 
                    ? editRow ? "Updating..." : "Creating..."
                    : editRow ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </FadeIn>
  );
}
