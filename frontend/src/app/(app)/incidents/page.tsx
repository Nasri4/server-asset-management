"use client";

import * as React from "react";
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  Download,
  Eye,
  FileText,
  Filter,
  Info,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Server,
  Settings,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { FadeIn } from "@/components/motion/fade-in";
import { EmptyState } from "@/components/data/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
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
  DialogDescription,
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { api } from "@/lib/api/client";
import { useAuth } from "@/components/auth/auth-provider";
import { can } from "@/lib/rbac";
import { buildCsv, downloadCsv } from "@/lib/utils/csv";
import { ServerSelect } from "@/components/forms/server-select";
import { EngineerSelect } from "@/components/forms/engineer-select";

type IncidentRow = {
  incident_id: number;
  server_id: number;
  server_code?: string;
  hostname?: string;
  incident_type?: string;
  severity?: string;
  status?: string;
  description?: string;
  reported_at?: string;
  resolved_at?: string;
  engineer_id?: number;
  engineer_name?: string;
  root_cause?: string;
  resolution?: string;
  created_at?: string;
  updated_at?: string;
};

type IncidentStatusUi = "Open" | "In Progress" | "Resolved" | "Closed";
type IncidentStatusApi = "Open" | "InProgress" | "Resolved" | "Closed";
type IncidentSeverityUi = "Critical" | "Major" | "Medium" | "Low";

type IncidentsView = "active" | "history";

function normalizeIncidentStatusUi(status?: string): IncidentStatusUi | undefined {
  if (!status) return undefined;
  if (status === "InProgress") return "In Progress";
  if (status === "In Progress") return "In Progress";
  if (status === "Open" || status === "Resolved" || status === "Closed") return status;
  return undefined;
}

function incidentStatusUiToApi(status?: string): IncidentStatusApi | undefined {
  const ui = normalizeIncidentStatusUi(status);
  if (!ui) return undefined;
  if (ui === "In Progress") return "InProgress";
  return ui;
}

function isHistoryStatus(status?: string) {
  const s = normalizeIncidentStatusUi(status) ?? status;
  return s === "Resolved" || s === "Closed";
}

function normalizeIncidentSeverityUi(severity?: string): IncidentSeverityUi | undefined {
  if (!severity) return undefined;
  if (severity === "Minor") return "Low";
  if (severity === "Critical" || severity === "Major" || severity === "Medium" || severity === "Low") return severity;
  return undefined;
}

const schema = z.object({
  server_id: z.number().int().positive({ message: "Server is required" }),
  incident_type: z.string().trim().min(1, "Incident type is required"),
  severity: z.enum(["Critical", "Major", "Medium", "Low"]),
  description: z.string().trim().min(1, "Description is required"),
  root_cause: z.string().trim().optional(),
  resolution: z.string().trim().optional(),
  engineer_id: z.number().int().positive({ message: "Engineer is required" }),
});

type FormValues = z.infer<typeof schema>;

// Helper functions for PremiumStatusBadge variants
function getSeverityVariant(severity?: string): "success" | "warning" | "danger" | "secondary" | "info" {
  if (!severity) return "secondary";
  const normalized = normalizeIncidentSeverityUi(severity) ?? severity;
  if (normalized === "Critical") return "danger";
  if (normalized === "Major") return "warning";
  if (normalized === "Medium") return "info";
  return "secondary";
}

function getStatusVariant(status?: string): "success" | "warning" | "danger" | "secondary" | "info" {
  if (!status) return "secondary";
  const normalized = normalizeIncidentStatusUi(status) ?? status;
  if (normalized === "Open") return "danger";
  if (normalized === "In Progress") return "warning";
  if (normalized === "Resolved") return "success";
  if (normalized === "Closed") return "secondary";
  return "secondary";
}

// Severity Badge (keeping for backward compatibility in detail drawer)
function SeverityBadge({ severity }: { severity?: string }) {
  const config: Record<string, { color: string; bg: string; border: string; dot: string }> = {
    Critical: {
      color: "text-rose-700 dark:text-rose-400",
      bg: "bg-rose-50 dark:bg-rose-950/20",
      border: "border-rose-200 dark:border-rose-900/30",
      dot: "bg-rose-500",
    },
    Major: {
      color: "text-amber-700 dark:text-amber-400",
      bg: "bg-amber-50 dark:bg-amber-950/20",
      border: "border-amber-200 dark:border-amber-900/30",
      dot: "bg-amber-500",
    },
    Medium: {
      color: "text-sky-700 dark:text-sky-400",
      bg: "bg-sky-50 dark:bg-sky-950/20",
      border: "border-sky-200 dark:border-sky-900/30",
      dot: "bg-sky-500",
    },
    Low: {
      color: "text-blue-700 dark:text-blue-400",
      bg: "bg-blue-50 dark:bg-blue-950/20",
      border: "border-blue-200 dark:border-blue-900/30",
      dot: "bg-blue-500",
    },
    Minor: {
      color: "text-blue-700 dark:text-blue-400",
      bg: "bg-blue-50 dark:bg-blue-950/20",
      border: "border-blue-200 dark:border-blue-900/30",
      dot: "bg-blue-500",
    },
  };

  if (!severity) return <span className="text-muted-foreground text-xs">—</span>;

  const cfg = config[severity] || config.Minor;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${cfg.bg} ${cfg.color} ${cfg.border}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {severity}
    </span>
  );
}

// Status Badge
function StatusBadge({ status }: { status?: string }) {
  const config: Record<string, { color: string; bg: string; border: string; dot: string }> = {
    Open: {
      color: "text-rose-700 dark:text-rose-400",
      bg: "bg-rose-50 dark:bg-rose-950/20",
      border: "border-rose-200 dark:border-rose-900/30",
      dot: "bg-rose-500",
    },
    InProgress: {
      color: "text-amber-700 dark:text-amber-400",
      bg: "bg-amber-50 dark:bg-amber-950/20",
      border: "border-amber-200 dark:border-amber-900/30",
      dot: "bg-amber-500",
    },
    "In Progress": {
      color: "text-amber-700 dark:text-amber-400",
      bg: "bg-amber-50 dark:bg-amber-950/20",
      border: "border-amber-200 dark:border-amber-900/30",
      dot: "bg-amber-500",
    },
    Resolved: {
      color: "text-emerald-700 dark:text-emerald-400",
      bg: "bg-emerald-50 dark:bg-emerald-950/20",
      border: "border-emerald-200 dark:border-emerald-900/30",
      dot: "bg-emerald-500",
    },
    Closed: {
      color: "text-slate-700 dark:text-slate-400",
      bg: "bg-slate-50 dark:bg-slate-950/20",
      border: "border-slate-200 dark:border-slate-900/30",
      dot: "bg-slate-400",
    },
  };

  if (!status) return <span className="text-muted-foreground text-xs">—</span>;

  const display = normalizeIncidentStatusUi(status) ?? status;
  const cfg = config[status ?? ""] || config[display ?? ""] || config.Open;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${cfg.bg} ${cfg.color} ${cfg.border}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {display ?? status}
    </span>
  );
}

export default function IncidentsPage() {
  const { user } = useAuth();
  const [rows, setRows] = React.useState<IncidentRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  // Search and filters
  const [view, setView] = React.useState<IncidentsView>("active");
  const [serverFilterId, setServerFilterId] = React.useState<number>(0);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [severityFilter, setSeverityFilter] = React.useState<string>("all");
  const [sortField, setSortField] = React.useState<string>("reported_at");
  const [sortDirection, setSortDirection] = React.useState<"asc" | "desc">("desc");

  // Column visibility
  const [visibleColumns, setVisibleColumns] = React.useState({
    server: true,
    type: true,
    severity: true,
    status: true,
    reported_at: true,
    resolved_at: true,
    engineer: true,
  });

  const [page, setPage] = React.useState(1);
  const pageSize = 15;

  const canCreate = can(user, "incidents.create");
  const canUpdate = can(user, "incidents.update");
  const canDelete = can(user, "incidents.update");

  // Detail drawer
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [selectedRow, setSelectedRow] = React.useState<IncidentRow | null>(null);

  // Create/Edit dialog
  const [editOpen, setEditOpen] = React.useState(false);
  const [editRow, setEditRow] = React.useState<IncidentRow | null>(null);

  // Solve dialog
  const [solveOpen, setSolveOpen] = React.useState(false);
  const [solveRow, setSolveRow] = React.useState<IncidentRow | null>(null);
  const [solveRootCause, setSolveRootCause] = React.useState("");
  const [solveResolution, setSolveResolution] = React.useState("");
  const [solving, setSolving] = React.useState(false);

  // Delete confirmation
  const [deleteId, setDeleteId] = React.useState<number | null>(null);
  const [deleting, setDeleting] = React.useState(false);

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

  const load = React.useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const res = await api.get("/api/incidents", { headers: { "x-sam-silent": "1" } });
      setRows((res.data?.data ?? []) as IncidentRow[]);
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.message || "Failed to load incidents";
      setLoadError(msg);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const openDetail = React.useCallback((row: IncidentRow) => {
    setSelectedRow(row);
    setDetailOpen(true);
  }, []);

  const openDialog = React.useCallback(
    (row?: IncidentRow) => {
      setEditRow(row || null);
      if (row) {
        const severity = normalizeIncidentSeverityUi(row.severity) ?? "Low";
        reset({
          server_id: row.server_id,
          incident_type: row.incident_type || "",
          severity: severity as any,
          description: row.description || "",
          root_cause: row.root_cause || "",
          resolution: row.resolution || "",
          engineer_id: row.engineer_id || 0,
        });
      } else {
        reset({
          server_id: 0,
          incident_type: "",
          severity: "Low",
          description: "",
          root_cause: "",
          resolution: "",
          engineer_id: 0,
        });
      }
      setEditOpen(true);
    },
    [reset]
  );

  const openSolve = React.useCallback((row: IncidentRow) => {
    setSolveRow(row);
    setSolveRootCause(row.root_cause || "");
    setSolveResolution("");
    setSolveOpen(true);
  }, []);

  const onSubmit = React.useCallback(
    async (values: FormValues) => {
      try {
        const payload: any = {
          server_id: values.server_id,
          incident_type: values.incident_type,
          severity: values.severity,
          description: values.description,
          engineer_id: values.engineer_id,
          root_cause: values.root_cause,
          resolution: values.resolution,
        };

        if (editRow) {
          await api.patch(`/api/incidents/${editRow.incident_id}`, payload, {
            headers: { "x-sam-silent": "1" },
          });
          toast.success("Incident updated");
        } else {
          delete payload.status;
          await api.post("/api/incidents", payload, { headers: { "x-sam-silent": "1" } });
          toast.success("Incident logged");
        }
        setEditOpen(false);
        await load();
      } catch (err: any) {
        const msg = err?.response?.data?.error?.message || err?.message || "Failed to save incident";
        toast.error(msg);
      }
    },
    [editRow, load]
  );

  const submitSolve = React.useCallback(async () => {
    if (!solveRow) return;
    const resolution = solveResolution.trim();
    if (!resolution) {
      toast.error("Resolution is required");
      return;
    }

    try {
      setSolving(true);
      await api.post(
        `/api/incidents/${solveRow.incident_id}/resolve`,
        {
          root_cause: solveRootCause.trim() || undefined,
          resolution,
        },
        { headers: { "x-sam-silent": "1" } }
      );
      toast.success("Incident solved");
      setSolveOpen(false);
      setDetailOpen(false);
      setView("history");
      await load();
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.message || "Failed to solve incident";
      toast.error(msg);
    } finally {
      setSolving(false);
    }
  }, [solveRow, solveRootCause, solveResolution, load]);

  const confirmDelete = React.useCallback(async () => {
    if (!deleteId) return;

    try {
      setDeleting(true);
      await api.delete(`/api/incidents/${deleteId}`, { headers: { "x-sam-silent": "1" } });
      toast.success("Incident deleted");
      setDeleteId(null);
      await load();
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.message || "Failed to delete incident";
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  }, [deleteId, load]);

  // Filter and sort
  const filteredRows = React.useMemo(() => {
    let result = [...rows];

    // View filter (Active vs History)
    if (view !== "history") {
      result = result.filter((r) => !isHistoryStatus(r.status));
    }

    // Server filter (mainly used for History)
    if (serverFilterId) {
      result = result.filter((r) => Number(r.server_id) === Number(serverFilterId));
    }

    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((r) => {
        const code = (r.server_code ?? "").toLowerCase();
        const hostname = (r.hostname ?? "").toLowerCase();
        const type = (r.incident_type ?? "").toLowerCase();
        const desc = (r.description ?? "").toLowerCase();
        return code.includes(q) || hostname.includes(q) || type.includes(q) || desc.includes(q);
      });
    }

    // Status filter
    if (statusFilter && statusFilter !== "all") {
      result = result.filter((r) => (normalizeIncidentStatusUi(r.status) ?? r.status) === statusFilter);
    }

    // Severity filter
    if (severityFilter && severityFilter !== "all") {
      result = result.filter((r) => (normalizeIncidentSeverityUi(r.severity) ?? r.severity) === severityFilter);
    }

    // Sort
    result.sort((a, b) => {
      let aVal: any = a[sortField as keyof IncidentRow];
      let bVal: any = b[sortField as keyof IncidentRow];

      if (aVal == null) aVal = "";
      if (bVal == null) bVal = "";

      if (typeof aVal === "string") aVal = aVal.toLowerCase();
      if (typeof bVal === "string") bVal = bVal.toLowerCase();

      return sortDirection === "asc" ? (aVal > bVal ? 1 : -1) : aVal < bVal ? 1 : -1;
    });

    return result;
  }, [rows, view, serverFilterId, searchQuery, statusFilter, severityFilter, sortField, sortDirection]);

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
  }, [view, serverFilterId, searchQuery, statusFilter, severityFilter]);

  const exportCsv = React.useCallback(() => {
    const csv = buildCsv(filteredRows, [
      { key: "server_code", label: "Server Code", format: (v) => String(v ?? "") },
      { key: "hostname", label: "Hostname", format: (v) => String(v ?? "") },
      { key: "incident_type", label: "Incident Type", format: (v) => String(v ?? "") },
      { key: "severity", label: "Severity", format: (v) => String(v ?? "") },
      { key: "status", label: "Status", format: (v) => String(v ?? "") },
      {
        key: "reported_at",
        label: "Reported At",
        format: (v) => (v ? new Date(String(v)).toLocaleString() : ""),
      },
      {
        key: "resolved_at",
        label: "Resolved At",
        format: (v) => (v ? new Date(String(v)).toLocaleString() : ""),
      },
      { key: "engineer_name", label: "Engineer", format: (v) => String(v ?? "") },
    ]);
    downloadCsv(`incidents-export-${new Date().toISOString().split("T")[0]}.csv`, csv);
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
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Incidents</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Track outages, failures, and infrastructure issues
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={exportCsv}
              disabled={loading || rows.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            {canCreate && (
              <Button
                size="sm"
                onClick={() => openDialog()}
              >
                <Plus className="h-4 w-4 mr-2" />
                Log Incident
              </Button>
            )}
          </div>
        </div>

        {/* Table Controls */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-md border bg-background p-1">
              <Button
                type="button"
                size="sm"
                variant={view === "active" ? "default" : "ghost"}
                className="h-8"
                onClick={() => {
                  setView("active");
                  setStatusFilter("all");
                  setServerFilterId(0);
                }}
              >
                Active
              </Button>
              <Button
                type="button"
                size="sm"
                variant={view === "history" ? "default" : "ghost"}
                className="h-8"
                onClick={() => {
                  setView("history");
                  setStatusFilter("all");
                }}
              >
                History
              </Button>
            </div>
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
                  checked={visibleColumns.server}
                  onCheckedChange={(checked) =>
                    setVisibleColumns((prev) => ({ ...prev, server: checked }))
                  }
                >
                  Server
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={visibleColumns.type}
                  onCheckedChange={(checked) =>
                    setVisibleColumns((prev) => ({ ...prev, type: checked }))
                  }
                >
                  Incident Type
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={visibleColumns.severity}
                  onCheckedChange={(checked) =>
                    setVisibleColumns((prev) => ({ ...prev, severity: checked }))
                  }
                >
                  Severity
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={visibleColumns.status}
                  onCheckedChange={(checked) =>
                    setVisibleColumns((prev) => ({ ...prev, status: checked }))
                  }
                >
                  Status
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={visibleColumns.reported_at}
                  onCheckedChange={(checked) =>
                    setVisibleColumns((prev) => ({ ...prev, reported_at: checked }))
                  }
                >
                  Reported At
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={visibleColumns.resolved_at}
                  onCheckedChange={(checked) =>
                    setVisibleColumns((prev) => ({ ...prev, resolved_at: checked }))
                  }
                >
                  Resolved At
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={visibleColumns.engineer}
                  onCheckedChange={(checked) =>
                    setVisibleColumns((prev) => ({ ...prev, engineer: checked }))
                  }
                >
                  Engineer
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
                placeholder="Search by server, type, or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="flex gap-2 flex-wrap">
              {view === "history" ? (
                <div className="min-w-64">
                  <ServerSelect
                    label="Server"
                    value={serverFilterId}
                    onChange={setServerFilterId}
                    allowEmpty
                    emptyLabel="All servers"
                    showSearch={false}
                  />
                </div>
              ) : null}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="min-w-32.5 justify-between">
                    <span>{statusFilter === "all" ? "All Status" : statusFilter}</span>
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setStatusFilter("all")}>
                    All Status
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {view === "history" ? (
                    <>
                      <DropdownMenuItem onClick={() => setStatusFilter("Open")}>
                        <AlertCircle className="mr-2 h-4 w-4 text-rose-600" /> Open
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setStatusFilter("In Progress")}>
                        <Clock className="mr-2 h-4 w-4 text-amber-600" /> In Progress
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setStatusFilter("Resolved")}>
                        <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-600" /> Resolved
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setStatusFilter("Closed")}>
                        <CheckCircle2 className="mr-2 h-4 w-4 text-slate-600" /> Closed
                      </DropdownMenuItem>
                    </>
                  ) : (
                    <>
                      <DropdownMenuItem onClick={() => setStatusFilter("Open")}>
                        <AlertCircle className="mr-2 h-4 w-4 text-rose-600" /> Open
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setStatusFilter("In Progress")}>
                        <Clock className="mr-2 h-4 w-4 text-amber-600" /> In Progress
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="min-w-32.5 justify-between">
                    <span>{severityFilter === "all" ? "All Severity" : severityFilter}</span>
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setSeverityFilter("all")}>
                    All Severity
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setSeverityFilter("Critical")}>
                    <AlertCircle className="mr-2 h-4 w-4 text-rose-600" /> Critical
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSeverityFilter("Major")}>
                    <AlertTriangle className="mr-2 h-4 w-4 text-amber-600" /> Major
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSeverityFilter("Medium")}>
                    <Info className="mr-2 h-4 w-4 text-sky-600" /> Medium
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSeverityFilter("Low")}>
                    <Info className="mr-2 h-4 w-4 text-blue-600" /> Low
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Active Filters Display */}
          {(searchQuery || serverFilterId || statusFilter !== "all" || severityFilter !== "all") && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-500 dark:text-slate-400">Active filters:</span>
              {searchQuery && (
                <Badge variant="secondary" className="gap-1">
                  Search: {searchQuery}
                  <button
                    onClick={() => setSearchQuery("")}
                    className="hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {serverFilterId ? (
                <Badge variant="secondary" className="gap-1">
                  Server: #{serverFilterId}
                  <button onClick={() => setServerFilterId(0)} className="hover:text-foreground">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ) : null}
              {statusFilter !== "all" && (
                <Badge variant="secondary" className="gap-1">
                  Status: {statusFilter}
                  <button
                    onClick={() => setStatusFilter("all")}
                    className="hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {severityFilter !== "all" && (
                <Badge variant="secondary" className="gap-1">
                  Severity: {severityFilter}
                  <button
                    onClick={() => setSeverityFilter("all")}
                    className="hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              <button
                onClick={() => {
                  setSearchQuery("");
                  setServerFilterId(0);
                  setStatusFilter("all");
                  setSeverityFilter("all");
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
              {visibleColumns.server && (
                <PremiumTableHead
                  sortable
                  sortDirection={sortField === "server_code" ? sortDirection : null}
                  onSort={() => toggleSort("server_code")}
                >
                  Server
                </PremiumTableHead>
              )}
              {visibleColumns.type && (
                <PremiumTableHead>Incident Type</PremiumTableHead>
              )}
              {visibleColumns.severity && (
                <PremiumTableHead
                  sortable
                  sortDirection={sortField === "severity" ? sortDirection : null}
                  onSort={() => toggleSort("severity")}
                >
                  Severity
                </PremiumTableHead>
              )}
              {visibleColumns.status && (
                <PremiumTableHead
                  sortable
                  sortDirection={sortField === "status" ? sortDirection : null}
                  onSort={() => toggleSort("status")}
                >
                  Status
                </PremiumTableHead>
              )}
              {visibleColumns.reported_at && (
                <PremiumTableHead
                  sortable
                  sortDirection={sortField === "reported_at" ? sortDirection : null}
                  onSort={() => toggleSort("reported_at")}
                >
                  Reported At
                </PremiumTableHead>
              )}
              {visibleColumns.resolved_at && (
                <PremiumTableHead>Resolved At</PremiumTableHead>
              )}
              {visibleColumns.engineer && (
                <PremiumTableHead>Engineer</PremiumTableHead>
              )}
              <PremiumTableHead className="w-30 text-center">Actions</PremiumTableHead>
            </tr>
          </PremiumTableHeader>
          <PremiumTableBody>
            {loading ? (
              <PremiumTableSkeleton rows={5} cols={8} />
            ) : loadError ? (
              <tr>
                <td colSpan={100} className="py-16 text-center">
                  <EmptyState
                    icon={<AlertTriangle className="h-12 w-12 text-slate-400" />}
                    title="Failed to load"
                    description={loadError}
                    action={
                      <Button onClick={load} variant="outline">
                        Retry
                      </Button>
                    }
                  />
                </td>
              </tr>
            ) : pagedRows.length === 0 ? (
              <PremiumTableEmptyState
                icon={<FileText className="h-12 w-12" />}
                title="No incidents"
                description={
                  searchQuery || statusFilter !== "all" || severityFilter !== "all"
                    ? "Try adjusting your search or filters"
                    : "No incidents have been logged"
                }
                action={
                  canCreate && !searchQuery && statusFilter === "all" && severityFilter === "all" ? (
                    <Button onClick={() => openDialog()}>
                      <Plus className="mr-2 h-4 w-4" />
                      Log Incident
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              pagedRows.map((row) => (
                <PremiumTableRow
                  key={row.incident_id}
                  interactive
                  onClick={() => openDetail(row)}
                >
                  {visibleColumns.server && (
                    <PremiumTableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Server className="h-4 w-4 text-slate-400" />
                          <span className="font-medium text-slate-900 dark:text-slate-100">
                            {row.server_code || "—"}
                          </span>
                        </div>
                        {row.hostname && (
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {row.hostname}
                          </div>
                        )}
                      </div>
                    </PremiumTableCell>
                  )}
                  {visibleColumns.type && (
                    <PremiumTableCell>
                      <div className="flex items-center gap-2">
                        <Zap className="h-3.5 w-3.5 text-slate-400" />
                        <span className="font-medium">{row.incident_type || "—"}</span>
                      </div>
                    </PremiumTableCell>
                  )}
                  {visibleColumns.severity && (
                    <PremiumTableCell>
                      <PremiumStatusBadge variant={getSeverityVariant(row.severity)}>
                        {normalizeIncidentSeverityUi(row.severity) || row.severity || "—"}
                      </PremiumStatusBadge>
                    </PremiumTableCell>
                  )}
                  {visibleColumns.status && (
                    <PremiumTableCell>
                      <PremiumStatusBadge variant={getStatusVariant(row.status)}>
                        {normalizeIncidentStatusUi(row.status) || row.status || "—"}
                      </PremiumStatusBadge>
                    </PremiumTableCell>
                  )}
                  {visibleColumns.reported_at && (
                    <PremiumTableCell>
                      {row.reported_at ? (
                        <div className="space-y-1">
                          <div className="font-medium">
                            {new Date(row.reported_at).toLocaleDateString()}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {new Date(row.reported_at).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        </div>
                      ) : (
                        "—"
                      )}
                    </PremiumTableCell>
                  )}
                  {visibleColumns.resolved_at && (
                    <PremiumTableCell>
                      {row.resolved_at ? (
                        <div className="space-y-1">
                          <div className="font-medium">
                            {new Date(row.resolved_at).toLocaleDateString()}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {new Date(row.resolved_at).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-500 dark:text-slate-400">Ongoing</span>
                      )}
                    </PremiumTableCell>
                  )}
                  {visibleColumns.engineer && (
                    <PremiumTableCell>
                      {row.engineer_name || "—"}
                    </PremiumTableCell>
                  )}
                  <PremiumTableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-center gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <PremiumActionButton
                            variant="view"
                            icon={<Eye className="h-4 w-4" />}
                            onClick={() => openDetail(row)}
                          />
                        </TooltipTrigger>
                        <TooltipContent>View Details</TooltipContent>
                      </Tooltip>
                      {canUpdate && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <PremiumActionButton
                              variant="edit"
                              icon={<Pencil className="h-4 w-4" />}
                              onClick={() => openDialog(row)}
                            />
                          </TooltipTrigger>
                          <TooltipContent>Edit</TooltipContent>
                        </Tooltip>
                      )}
                      {canDelete && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <PremiumActionButton
                              variant="delete"
                              icon={<Trash2 className="h-4 w-4" />}
                              onClick={() => setDeleteId(row.incident_id)}
                            />
                          </TooltipTrigger>
                          <TooltipContent>Delete</TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </PremiumTableCell>
                </PremiumTableRow>
              ))
            )}
          </PremiumTableBody>
        </PremiumTable>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-400">
            <div>
              Showing {startIndex + 1}-{endIndex} of {total}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage === 1}
              >
                Previous
              </Button>
              <div className="text-sm">
                Page {safePage} of {totalPages}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}

        {/* Detail Drawer */}
        <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
          <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Incident Details</SheetTitle>
            </SheetHeader>

            {selectedRow && (
              <div className="mt-6 space-y-6">
                {/* Status & Severity */}
                <div className="flex items-center gap-3">
                  <StatusBadge status={selectedRow.status} />
                  <SeverityBadge severity={selectedRow.severity} />
                </div>

                {/* Server Info */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground">Server</h3>
                  <div className="space-y-2 rounded-lg border p-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Server Code</span>
                      <span className="font-medium">{selectedRow.server_code || "—"}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Hostname</span>
                      <span className="font-medium">{selectedRow.hostname || "—"}</span>
                    </div>
                  </div>
                </div>

                {/* Incident Info */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground">Incident</h3>
                  <div className="space-y-2 rounded-lg border p-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Type</span>
                      <span className="font-medium">{selectedRow.incident_type || "—"}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Severity</span>
                      <SeverityBadge severity={selectedRow.severity} />
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Status</span>
                      <StatusBadge status={selectedRow.status} />
                    </div>
                    {selectedRow.description && (
                      <div className="pt-2 border-t">
                        <div className="text-xs text-muted-foreground mb-1">Description</div>
                        <p className="text-sm">{selectedRow.description}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Timeline */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground">Timeline</h3>
                  <div className="space-y-3 rounded-lg border p-4">
                    {selectedRow.reported_at && (
                      <div className="flex items-start gap-3">
                        <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-900/30">
                          <AlertCircle className="h-4 w-4 text-rose-600" />
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-medium">Incident Reported</div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(selectedRow.reported_at).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    )}

                    {selectedRow.status === "In Progress" && (
                      <div className="flex items-start gap-3">
                        <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                          <Clock className="h-4 w-4 text-amber-600" />
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-medium">Investigation In Progress</div>
                          <div className="text-xs text-muted-foreground">
                            Assigned to {selectedRow.engineer_name || "engineer"}
                          </div>
                        </div>
                      </div>
                    )}

                    {selectedRow.resolved_at && (
                      <div className="flex items-start gap-3">
                        <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-medium">Incident Resolved</div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(selectedRow.resolved_at).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Assignment */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground">Assignment</h3>
                  <div className="space-y-2 rounded-lg border p-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Assigned Engineer</span>
                      <span className="font-medium">{selectedRow.engineer_name || "—"}</span>
                    </div>
                  </div>
                </div>

                {/* Root Cause & Resolution */}
                {(selectedRow.root_cause || selectedRow.resolution) && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-muted-foreground">
                      Root Cause & Resolution
                    </h3>
                    <div className="space-y-3 rounded-lg border p-4">
                      {selectedRow.root_cause && (
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">Root Cause</div>
                          <p className="text-sm">{selectedRow.root_cause}</p>
                        </div>
                      )}
                      {selectedRow.resolution && (
                        <div className={selectedRow.root_cause ? "pt-3 border-t" : ""}>
                          <div className="text-xs text-muted-foreground mb-1">Resolution</div>
                          <p className="text-sm">{selectedRow.resolution}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Actions */}
                {canUpdate && (
                  <div className="pt-4">
                    {selectedRow.status !== "Resolved" && selectedRow.status !== "Closed" ? (
                      <Button
                        variant="default"
                        className="w-full"
                        onClick={() => openSolve(selectedRow)}
                      >
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Solve Incident
                      </Button>
                    ) : null}
                    <Button
                      className={selectedRow.status !== "Resolved" && selectedRow.status !== "Closed" ? "w-full mt-2" : "w-full"}
                      onClick={() => {
                        setDetailOpen(false);
                        openDialog(selectedRow);
                      }}
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit Incident
                    </Button>
                  </div>
                )}
              </div>
            )}
          </SheetContent>
        </Sheet>

        {/* Create/Edit Dialog */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="sm:max-w-150 max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editRow ? "Edit Incident" : "Log Incident"}</DialogTitle>
              <DialogDescription className="sr-only">
                {editRow ? "Update incident details." : "Log a new incident for a server."}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Server Selection */}
              <div className="space-y-4">
                <div className="text-sm font-medium text-muted-foreground">Server & Type</div>
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="server_id">
                      Server <span className="text-rose-600">*</span>
                    </Label>
                    <ServerSelect
                      value={watch("server_id") || 0}
                      onChange={(v) => setValue("server_id", v)}
                      error={errors.server_id?.message}
                      showSearch={false}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="incident_type">
                      Incident Type <span className="text-rose-600">*</span>
                    </Label>
                    <Input
                      id="incident_type"
                      placeholder="e.g. Server Outage, Network Failure, Disk Full"
                      {...register("incident_type")}
                    />
                    {errors.incident_type && (
                      <p className="text-xs text-rose-600">{errors.incident_type.message}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Severity, Status & Description */}
              <div className="space-y-4">
                <div className="text-sm font-medium text-muted-foreground">
                  Severity & Description
                </div>
                <div className="grid gap-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="severity">
                        Severity <span className="text-rose-600">*</span>
                      </Label>
                      <select
                        id="severity"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        {...register("severity")}
                      >
                        <option value="Critical">Critical</option>
                        <option value="Major">Major</option>
                        <option value="Medium">Medium</option>
                        <option value="Low">Low</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="description">
                      Description <span className="text-rose-600">*</span>
                    </Label>
                    <Textarea
                      id="description"
                      placeholder="Describe the incident..."
                      rows={4}
                      {...register("description")}
                    />
                    {errors.description && (
                      <p className="text-xs text-rose-600">{errors.description.message}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Root Cause & Resolution (for updates) */}
              {editRow && (
                <div className="space-y-4">
                  <div className="text-sm font-medium text-muted-foreground">
                    Root Cause & Resolution
                  </div>
                  <div className="grid gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="root_cause">Root Cause</Label>
                      <Textarea
                        id="root_cause"
                        placeholder="What caused this incident?"
                        rows={3}
                        {...register("root_cause")}
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="resolution">Resolution</Label>
                      <Textarea
                        id="resolution"
                        placeholder="How was this incident resolved?"
                        rows={3}
                        {...register("resolution")}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Assignment */}
              <div className="space-y-4">
                <div className="text-sm font-medium text-muted-foreground">Assignment</div>
                <div className="grid gap-2">
                  <Label htmlFor="engineer_id">
                    Assign to Engineer <span className="text-rose-600">*</span>
                  </Label>
                  <EngineerSelect
                    value={watch("engineer_id") || undefined}
                    onChange={(v) => setValue("engineer_id", v || 0)}
                    showSearch={false}
                  />
                  {errors.engineer_id && (
                    <p className="text-xs text-rose-600">{errors.engineer_id.message}</p>
                  )}
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
                  {isSubmitting ? "Saving..." : editRow ? "Update" : "Log Incident"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Solve Dialog */}
        <Dialog open={solveOpen} onOpenChange={setSolveOpen}>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Solve Incident</DialogTitle>
              <DialogDescription className="sr-only">
                Provide root cause and resolution, then mark the incident as solved.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                {solveRow?.server_code || solveRow?.hostname ? (
                  <span>
                    {solveRow.server_code ? `${solveRow.server_code}` : ""}
                    {solveRow.server_code && solveRow.hostname ? " · " : ""}
                    {solveRow.hostname ? solveRow.hostname : ""}
                  </span>
                ) : null}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="solve_root_cause">Root Cause</Label>
                <Textarea
                  id="solve_root_cause"
                  rows={3}
                  placeholder="What caused this incident?"
                  value={solveRootCause}
                  onChange={(e) => setSolveRootCause(e.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="solve_resolution">
                  Resolution <span className="text-rose-600">*</span>
                </Label>
                <Textarea
                  id="solve_resolution"
                  rows={4}
                  placeholder="How was this incident resolved?"
                  value={solveResolution}
                  onChange={(e) => setSolveResolution(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSolveOpen(false)} disabled={solving}>
                Cancel
              </Button>
              <Button type="button" onClick={submitSolve} disabled={solving}>
                {solving ? "Saving..." : "Mark as Solved"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <Dialog
          open={deleteId !== null}
          onOpenChange={(open) => {
            if (!open) setDeleteId(null);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Incident</DialogTitle>
              <DialogDescription className="sr-only">
                Confirm deletion of this incident.
              </DialogDescription>
            </DialogHeader>
            <DialogDescription>
              Are you sure you want to delete this incident? This action cannot be undone.
            </DialogDescription>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDeleteId(null)} disabled={deleting}>
                Cancel
              </Button>
              <Button type="button" variant="destructive" onClick={() => void confirmDelete()} disabled={deleting}>
                {deleting ? "Deleting..." : "Delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </FadeIn>
  );
}
