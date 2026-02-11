"use client";

import * as React from "react";
import { 
  AlertCircle, 
  AlertTriangle, 
  Calendar, 
  CheckCircle2, 
  ChevronRight,
  Clock, 
  Download, 
  Eye,
  Filter, 
  History, 
  Loader2,
  MoreVertical,
  Plus, 
  RefreshCw, 
  Send, 
  Server as ServerIcon,
  Trash2,
  User,
  Users,
  Wrench,
  X,
} from "lucide-react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { FadeIn } from "@/components/motion/fade-in";
import { EmptyState } from "@/components/data/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { api } from "@/lib/api/client";
import { useAuth } from "@/components/auth/auth-provider";
import { can } from "@/lib/rbac";
import { ServerSelect } from "@/components/forms/server-select";
import { EngineerSelect } from "@/components/forms/engineer-select";

// Types
type Frequency = "Daily" | "Weekly" | "Monthly";
type RunStatus = "Active" | "Incomplete" | "Overdue" | "Complete";

type MaintenanceRun = {
  run_id: number;
  schedule_id: number;
  due_date: string;
  status: RunStatus;
  completed_at: string | null;
  note: string | null;
  frequency: Frequency;
  server_id: number;
  server_code: string | null;
  hostname: string | null;
  team_id?: number | null;
  team_name?: string | null;
  maintenance_type: string;
  total_tasks: number;
  done_tasks: number;
  assigned_engineers: string | null;
};

type MaintenanceType = {
  maintenance_type_id: number;
  name: string;
  description: string | null;
  is_active: boolean;
  checklist_count: number;
};

type RunDetail = {
  run: {
    run_id: number;
    schedule_id: number;
    due_date: string;
    status: RunStatus;
    completed_at: string | null;
    note: string | null;
    frequency: Frequency;
    server_id: number;
    server_code: string | null;
    hostname: string | null;
    maintenance_type: string;
  };
  engineers: Array<{
    engineer_id: number;
    full_name: string;
    email: string | null;
    phone: string | null;
  }>;
  checklist: Array<{
    checklist_item_id: number;
  label: string;
    is_done: boolean;
    done_at: string | null;
  }>;
  progress: {
    done: number;
    total: number;
    percent: number;
  };
};

type HistoryRun = {
  run_id: number;
  schedule_id: number;
  due_date: string;
  status: RunStatus;
  completed_at: string | null;
  note: string | null;
  total_tasks: number;
  done_tasks: number;
  created_at: string;
  frequency: Frequency;
  maintenance_type: string;
};

// Helper functions
function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString();
  } catch {
    return String(dateStr);
  }
}

function getDueDays(dueDate: string): number {
  const due = new Date(dueDate + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffTime = due.getTime() - today.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

// Status Badge Component - Map to PremiumStatusBadge variants
function getStatusVariant(status: RunStatus): "success" | "warning" | "danger" | "secondary" {
  switch (status) {
    case "Active":
      return "success";
    case "Incomplete":
      return "warning";
    case "Overdue":
      return "danger";
    case "Complete":
      return "success";
    default:
      return "secondary";
  }
}

function getStatusLabel(status: RunStatus): string {
  switch (status) {
    case "Active":
      return "Active";
    case "Incomplete":
      return "In Progress";
    case "Overdue":
      return "Overdue";
    case "Complete":
      return "Complete";
    default:
      return status;
  }
}

// Frequency Badge Component - Premium Style
function FrequencyBadge({ frequency }: { frequency: Frequency }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-700 dark:border-slate-900/30 dark:bg-slate-950/20 dark:text-slate-400">
      <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
      {frequency}
    </span>
  );
}

// Due Date Badge Component
function DueDateBadge({ dueDate, status }: { dueDate: string; status: RunStatus }) {
  if (status === "Complete") return null;

  const days = getDueDays(dueDate);

  if (days < 0) {
    return (
      <Badge variant="destructive">
        <AlertCircle className="mr-1 h-3 w-3" />
        {Math.abs(days)}d overdue
      </Badge>
    );
  }

  if (days === 0) {
    return (
      <Badge variant="warning">
        <Clock className="mr-1 h-3 w-3" />
        Due today
      </Badge>
    );
  }

  if (days === 1) {
    return (
      <Badge variant="outline">
        <Calendar className="mr-1 h-3 w-3" />
        Due tomorrow
      </Badge>
    );
  }

  if (days <= 3) {
    return (
      <Badge variant="outline">
        <Calendar className="mr-1 h-3 w-3" />
        Due in {days}d
      </Badge>
    );
  }

  return null;
}

// Progress Bar Component
function ProgressBar({ done, total }: { done: number; total: number }) {
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div 
          className="h-full bg-emerald-500 transition-all" 
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="text-xs font-medium text-muted-foreground tabular-nums">
        {done}/{total}
      </span>
    </div>
  );
}

export default function MaintenanceOperationsPage() {
  const { user } = useAuth();
  const canManage = can(user, "maintenance.manage");

  // State
  const [activeTab, setActiveTab] = React.useState<"active" | "completed">("active");
  const [activeRuns, setActiveRuns] = React.useState<MaintenanceRun[]>([]);
  const [completedRuns, setCompletedRuns] = React.useState<MaintenanceRun[]>([]);
  const [loading, setLoading] = React.useState(true);

  // Search & Filter
  const [searchQuery, setSearchQuery] = React.useState("");
  const [serverFilter, setServerFilter] = React.useState<number>(0);

  // Dialogs
  const [createOpen, setCreateOpen] = React.useState(false);
  const [detailRun, setDetailRun] = React.useState<RunDetail | null>(null);
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const [historyData, setHistoryData] = React.useState<HistoryRun[]>([]);
  const [historyScheduleId, setHistoryScheduleId] = React.useState<number | null>(null);

  // Types
  const [types, setTypes] = React.useState<MaintenanceType[]>([]);

  // Create schedule form
  const [createServerId, setCreateServerId] = React.useState<number>(0);
  const [createTypeIds, setCreateTypeIds] = React.useState<number[]>([]);
  const [createFrequency, setCreateFrequency] = React.useState<Frequency>("Daily");
  const [createDueDate, setCreateDueDate] = React.useState<string>("");
  const [createEngineerIds, setCreateEngineerIds] = React.useState<number[]>([]);
  const [creating, setCreating] = React.useState(false);
  const [engineers, setEngineers] = React.useState<Array<{ engineer_id: number; full_name: string; email: string | null; team_id?: number | null }>>([]);
  const [typeChecklistsById, setTypeChecklistsById] = React.useState<Record<number, Array<{ checklist_item_id: number; label: string }>>>({});
  const [loadingChecklist, setLoadingChecklist] = React.useState(false);
  const [customChecklistByTypeId, setCustomChecklistByTypeId] = React.useState<Record<number, string[]>>({});
  const [customDraftByTypeId, setCustomDraftByTypeId] = React.useState<Record<number, string>>({});
  const [serverEngineers, setServerEngineers] = React.useState<number[]>([]);

  // Load data
  const loadActiveRuns = React.useCallback(async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (searchQuery) params.q = searchQuery;
      if (serverFilter > 0) params.server_id = serverFilter;

      const res = await api.get("/api/maintenance-ops/runs/active", { 
        params,
        headers: { "x-sam-silent": "1" } 
      });
      setActiveRuns(res.data?.data?.rows ?? []);
    } catch (error: any) {
      toast.error(error?.response?.data?.error?.message ?? "Failed to load active runs");
    } finally {
      setLoading(false);
    }
  }, [searchQuery, serverFilter]);

  const loadCompletedRuns = React.useCallback(async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (searchQuery) params.q = searchQuery;
      if (serverFilter > 0) params.server_id = serverFilter;

      const res = await api.get("/api/maintenance-ops/runs/completed", { 
        params,
        headers: { "x-sam-silent": "1" } 
      });
      setCompletedRuns(res.data?.data?.rows ?? []);
    } catch (error: any) {
      toast.error(error?.response?.data?.error?.message ?? "Failed to load completed runs");
    } finally {
      setLoading(false);
    }
  }, [searchQuery, serverFilter]);

  const loadTypes = React.useCallback(async () => {
    try {
      const res = await api.get("/api/maintenance-ops/types", { headers: { "x-sam-silent": "1" } });
      setTypes(res.data?.data ?? []);
    } catch (error: any) {
      toast.error(error?.response?.data?.error?.message ?? "Failed to load maintenance types");
    }
  }, []);

  const loadEngineers = React.useCallback(async () => {
    try {
      const res = await api.get("/api/engineers", { headers: { "x-sam-silent": "1" } });
      setEngineers(res.data?.data ?? []);
    } catch (error: any) {
      console.error("Failed to load engineers:", error);
    }
  }, []);

  const loadTypeChecklist = React.useCallback(async (typeId: number) => {
    try {
      const res = await api.get(`/api/maintenance-ops/types/${typeId}`, { headers: { "x-sam-silent": "1" } });
      const items = (res.data?.data?.checklist_items ?? []) as Array<{ checklist_item_id: number; label: string }>;
      setTypeChecklistsById((prev) => ({ ...prev, [typeId]: items }));
    } catch (error: any) {
      console.error("Failed to load checklist:", error);
      setTypeChecklistsById((prev) => ({ ...prev, [typeId]: [] }));
    }
  }, []);

  const loadServerAndAutoSelectEngineers = React.useCallback(async (serverId: number) => {
    if (serverId === 0) {
      setServerEngineers([]);
      setCreateEngineerIds([]);
        return;
      }

    try {
      // Get server details to find assigned engineer
      const res = await api.get(`/api/servers/${serverId}`, { headers: { "x-sam-silent": "1" } });
      const serverData = res.data?.data?.server;
      
      // Get the assigned engineer ID from the server (single engineer)
      const engineerId = serverData?.engineer_id;
      const assignedEngineerIds = engineerId ? [engineerId] : [];
      
      setServerEngineers(assignedEngineerIds);
      setCreateEngineerIds(assignedEngineerIds); // Auto-select them
    } catch (error: any) {
      console.error("Failed to load server details:", error);
      setServerEngineers([]);
      setCreateEngineerIds([]);
    }
  }, []);

  // Filter engineers to show only those assigned to the selected server
  const filteredEngineers = React.useMemo(() => {
    if (createServerId === 0 || serverEngineers.length === 0) {
      return []; // Show none if no server selected or no engineers assigned
    }
    return engineers.filter(eng => serverEngineers.includes(eng.engineer_id));
  }, [engineers, serverEngineers, createServerId]);

  React.useEffect(() => {
    if (activeTab === "active") {
      loadActiveRuns();
      } else {
      loadCompletedRuns();
    }
  }, [activeTab, loadActiveRuns, loadCompletedRuns]);

  React.useEffect(() => {
    loadTypes();
    loadEngineers();
  }, [loadTypes, loadEngineers]);

  React.useEffect(() => {
    if (!createOpen) return;
    let alive = true;
    (async () => {
      try {
        setLoadingChecklist(true);
        const ids = Array.from(new Set(createTypeIds)).filter((n) => n > 0);

        // prune removed types
        setTypeChecklistsById((prev) => {
          const next: Record<number, Array<{ checklist_item_id: number; label: string }>> = {};
          for (const id of ids) next[id] = prev[id] ?? [];
          return next;
        });
        setCustomChecklistByTypeId((prev) => {
          const next: Record<number, string[]> = {};
          for (const id of ids) next[id] = prev[id] ?? [];
          return next;
        });
        setCustomDraftByTypeId((prev) => {
          const next: Record<number, string> = {};
          for (const id of ids) next[id] = prev[id] ?? "";
          return next;
        });

        await Promise.all(ids.map((id) => loadTypeChecklist(id)));
      } finally {
        if (alive) setLoadingChecklist(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [createTypeIds, createOpen, loadTypeChecklist]);

  // View run details
  const viewRunDetails = React.useCallback(async (runId: number) => {
    try {
      const res = await api.get(`/api/maintenance-ops/runs/${runId}`, { headers: { "x-sam-silent": "1" } });
      setDetailRun(res.data?.data ?? null);
    } catch (error: any) {
      toast.error(error?.response?.data?.error?.message ?? "Failed to load run details");
    }
  }, []);

  // View history
  const viewHistory = React.useCallback(async (serverId: number) => {
    try {
      setHistoryScheduleId(serverId);
      const res = await api.get(`/api/maintenance-ops/servers/${serverId}/history`, { 
        headers: { "x-sam-silent": "1" } 
      });
      setHistoryData(res.data?.data ?? []);
      setHistoryOpen(true);
    } catch (error: any) {
      toast.error(error?.response?.data?.error?.message ?? "Failed to load history");
    }
  }, []);

  // Complete run
  const completeRun = React.useCallback(async (runId: number, dueDate?: string) => {
    // Validate that we can only complete on or after the due date
    if (dueDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Reset to start of day
      
      const due = new Date(dueDate);
      due.setHours(0, 0, 0, 0); // Reset to start of day
      
      if (today < due) {
        toast.error(
          `Cannot complete maintenance before due date. Due date is ${formatDate(dueDate)}.`,
          { duration: 5000 }
        );
        return;
      }
    }

    if (!confirm("Mark this maintenance run as complete? This will auto-create the next scheduled run.")) {
      return;
    }

    try {
      const res = await api.post(`/api/maintenance-ops/runs/${runId}/complete`, {}, { 
        headers: { "x-sam-silent": "1" } 
      });
      
      const result = res.data?.data;
      
      if (result?.renewed && result?.next_due_date) {
        toast.success(
          `✓ Run completed! Next run auto-scheduled for ${formatDate(result.next_due_date)}`,
          { duration: 5000 }
        );
      } else {
        toast.success("Run marked complete");
      }

      setDetailRun(null);
      if (activeTab === "active") {
        loadActiveRuns();
      } else {
        loadCompletedRuns();
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.error?.message ?? "Failed to complete run");
    }
  }, [activeTab, loadActiveRuns, loadCompletedRuns]);

  const deleteRun = React.useCallback(async (runId: number) => {
    if (!confirm("Are you sure you want to delete this maintenance run? This action cannot be undone.")) {
      return;
    }

    try {
      await api.delete(`/api/maintenance-ops/runs/${runId}`, { 
        headers: { "x-sam-silent": "1" } 
      });
      
      toast.success("Maintenance run deleted successfully");
      
      setDetailRun(null);
      if (activeTab === "active") {
        loadActiveRuns();
      } else {
        loadCompletedRuns();
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.error?.message ?? "Failed to delete run");
    }
  }, [activeTab, loadActiveRuns, loadCompletedRuns]);

  // Toggle checklist item
  const toggleChecklistItem = React.useCallback(async (runId: number, itemId: number, isDone: boolean) => {
    try {
      await api.patch(
        `/api/maintenance-ops/runs/${runId}/checklist/${itemId}`,
        { is_done: !isDone },
        { headers: { "x-sam-silent": "1" } }
      );
      
      // Reload run details
      await viewRunDetails(runId);
      
      toast.success(isDone ? "Task unmarked" : "Task completed");
    } catch (error: any) {
      toast.error(error?.response?.data?.error?.message ?? "Failed to update task");
    }
  }, [viewRunDetails]);

  // Create schedule
  const createSchedule = React.useCallback(async () => {
    // Validation
    if (createServerId === 0) {
      toast.error("Please select a server");
      return;
    }
    if (createTypeIds.length === 0) {
      toast.error("Please select at least one maintenance type");
      return;
    }
    if (!createDueDate) {
      toast.error("Please select a due date");
      return;
    }
    if (createEngineerIds.length === 0) {
      toast.error("Please assign at least one engineer");
        return;
      }

      try {
      setCreating(true);
      const customItems = Object.entries(customChecklistByTypeId).flatMap(([typeId, labels]) =>
        (labels ?? []).map((label) => ({ maintenance_type_id: Number(typeId), label }))
      );
      await api.post("/api/maintenance-ops/schedules", {
        server_id: createServerId,
        maintenance_type_ids: createTypeIds,
        frequency: createFrequency,
        next_due_date: createDueDate,
        engineer_ids: createEngineerIds,
        custom_checklist_items: customItems.length ? customItems : undefined,
      });

      toast.success("Maintenance schedule created successfully!");
      setCreateOpen(false);
      
      // Reset form
      setCreateServerId(0);
      setCreateTypeIds([]);
      setCreateFrequency("Daily");
      setCreateDueDate("");
      setCreateEngineerIds([]);
      setTypeChecklistsById({});
      setCustomChecklistByTypeId({});
      setCustomDraftByTypeId({});
      
      // Reload data
      if (activeTab === "active") {
        loadActiveRuns();
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.error?.message ?? "Failed to create schedule");
    } finally {
      setCreating(false);
    }
  }, [createServerId, createTypeIds, createFrequency, createDueDate, createEngineerIds, customChecklistByTypeId, activeTab, loadActiveRuns]);

  // Export CSV
  const exportCsv = React.useCallback(() => {
    const rows = activeTab === "active" ? activeRuns : completedRuns;
    
    const headers = [
      "Server Code",
      "Hostname",
      "Type",
      "Frequency",
      "Due Date",
      "Status",
      "Progress",
      "Engineers",
    ];

    const csvData = rows.map(r => [
      r.server_code || "",
      r.hostname || "",
      r.maintenance_type,
      r.frequency,
      r.due_date,
      r.status,
      `${r.done_tasks}/${r.total_tasks}`,
      r.assigned_engineers || "",
    ]);

    const csvContent = [
      headers.join(","),
      ...csvData.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `maintenance-${activeTab}-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [activeTab, activeRuns, completedRuns]);

  const currentRuns = activeTab === "active" ? activeRuns : completedRuns;

  return (
    <FadeIn>
      <div className="space-y-6">
        {/* V2 Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Maintenance Operations</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Automated maintenance scheduling and tracking system
            </p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => activeTab === "active" ? loadActiveRuns() : loadCompletedRuns()}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>

            {canManage && (
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Schedule Maintenance
              </Button>
            )}
          </div>
        </div>

        {/* V2 Filters & Search - Clean, no cards */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[250px]">
            <Input
              type="search"
              placeholder="Search by server, type..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
            <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          </div>

          <ServerSelect
            value={serverFilter}
            onChange={setServerFilter}
            allowEmpty
            emptyLabel="All Servers"
            showSearch={false}
          />

          {(searchQuery || serverFilter > 0) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchQuery("");
                setServerFilter(0);
              }}
            >
              <X className="mr-1 h-3 w-3" />
              Clear
            </Button>
          )}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "active" | "completed")}>
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="active">
              <Clock className="mr-2 h-4 w-4" />
              Active ({activeRuns.length})
            </TabsTrigger>
            <TabsTrigger value="completed">
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Completed ({completedRuns.length})
            </TabsTrigger>
                </TabsList>

          {/* Active Tab */}
          <TabsContent value="active" className="mt-6">
            {loading ? (
              <PremiumTable>
                <PremiumTableBody>
                  <PremiumTableSkeleton rows={5} cols={8} />
                </PremiumTableBody>
              </PremiumTable>
            ) : currentRuns.length === 0 ? (
              <PremiumTable>
                <PremiumTableBody>
                  <PremiumTableEmptyState
                    icon={<Wrench className="h-8 w-8" />}
                    title="No active maintenance runs"
                    description="Create a maintenance schedule to get started"
                  />
                </PremiumTableBody>
              </PremiumTable>
            ) : (
              <PremiumTable>
                <PremiumTableHeader>
                  <tr>
                    <PremiumTableHead>Server</PremiumTableHead>
                    <PremiumTableHead>Type</PremiumTableHead>
                    <PremiumTableHead>Frequency</PremiumTableHead>
                    <PremiumTableHead>Due Date</PremiumTableHead>
                    <PremiumTableHead>Status</PremiumTableHead>
                    <PremiumTableHead>Progress</PremiumTableHead>
                    <PremiumTableHead>Engineers</PremiumTableHead>
                    <PremiumTableHead className="w-[120px] text-center">Actions</PremiumTableHead>
                  </tr>
                </PremiumTableHeader>
                <PremiumTableBody>
                  {currentRuns.map((run) => (
                    <PremiumTableRow 
                      key={run.run_id}
                      className={run.status === "Overdue" ? "bg-rose-50/50 dark:bg-rose-950/10" : undefined}
                    >
                      <PremiumTableCell>
                        <div className="flex flex-col">
                          <span className="font-mono text-sm font-semibold">{run.server_code}</span>
                          <span className="text-xs text-muted-foreground">{run.hostname}</span>
                        </div>
                      </PremiumTableCell>
                      <PremiumTableCell>
                        <span className="text-sm font-medium">{run.maintenance_type}</span>
                      </PremiumTableCell>
                      <PremiumTableCell>
                        <FrequencyBadge frequency={run.frequency} />
                      </PremiumTableCell>
                      <PremiumTableCell>
                        <div className="flex flex-col gap-1">
                          <span className="text-sm">{formatDate(run.due_date)}</span>
                          <DueDateBadge dueDate={run.due_date} status={run.status} />
                        </div>
                      </PremiumTableCell>
                      <PremiumTableCell>
                        <PremiumStatusBadge variant={getStatusVariant(run.status)}>
                          {getStatusLabel(run.status)}
                        </PremiumStatusBadge>
                      </PremiumTableCell>
                      <PremiumTableCell>
                        <ProgressBar done={run.done_tasks} total={run.total_tasks} />
                      </PremiumTableCell>
                      <PremiumTableCell>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Users className="h-3 w-3" />
                          {run.assigned_engineers || "—"}
                        </div>
                      </PremiumTableCell>
                      <PremiumTableCell>
                        <div className="flex items-center justify-center gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <PremiumActionButton
                                variant="view"
                                icon={<Eye className="h-4 w-4" />}
                                onClick={() => viewRunDetails(run.run_id)}
                              />
                            </TooltipTrigger>
                            <TooltipContent>View Details</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <PremiumActionButton
                                variant="default"
                                icon={<History className="h-4 w-4" />}
                                onClick={() => viewHistory(run.server_id)}
                              />
                            </TooltipTrigger>
                            <TooltipContent>View Server History</TooltipContent>
                          </Tooltip>
                          {canManage && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <PremiumActionButton
                                  variant="delete"
                                  icon={<Trash2 className="h-4 w-4" />}
                                  onClick={() => deleteRun(run.run_id)}
                                />
                              </TooltipTrigger>
                              <TooltipContent>Delete Run</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </PremiumTableCell>
                    </PremiumTableRow>
                  ))}
                </PremiumTableBody>
              </PremiumTable>
            )}
          </TabsContent>

          {/* Completed Tab */}
          <TabsContent value="completed" className="mt-6">
            {loading ? (
              <PremiumTable>
                <PremiumTableBody>
                  <PremiumTableSkeleton rows={5} cols={7} />
                </PremiumTableBody>
              </PremiumTable>
            ) : currentRuns.length === 0 ? (
              <PremiumTable>
                <PremiumTableBody>
                  <PremiumTableEmptyState
                    icon={<CheckCircle2 className="h-8 w-8" />}
                    title="No completed runs"
                    description="Completed maintenance runs will appear here"
                  />
                </PremiumTableBody>
              </PremiumTable>
            ) : (
              <PremiumTable>
                <PremiumTableHeader>
                  <tr>
                    <PremiumTableHead>Server</PremiumTableHead>
                    <PremiumTableHead>Type</PremiumTableHead>
                    <PremiumTableHead>Frequency</PremiumTableHead>
                    <PremiumTableHead>Completed</PremiumTableHead>
                    <PremiumTableHead>Progress</PremiumTableHead>
                    <PremiumTableHead>Engineers</PremiumTableHead>
                    <PremiumTableHead className="w-[120px] text-center">Actions</PremiumTableHead>
                  </tr>
                </PremiumTableHeader>
                <PremiumTableBody>
                  {currentRuns.map((run) => (
                    <PremiumTableRow key={run.run_id}>
                      <PremiumTableCell>
                        <div className="flex flex-col">
                          <span className="font-mono text-sm font-semibold">{run.server_code}</span>
                          <span className="text-xs text-muted-foreground">{run.hostname}</span>
                        </div>
                      </PremiumTableCell>
                      <PremiumTableCell>
                        <span className="text-sm font-medium">{run.maintenance_type}</span>
                      </PremiumTableCell>
                      <PremiumTableCell>
                        <FrequencyBadge frequency={run.frequency} />
                      </PremiumTableCell>
                      <PremiumTableCell>
                        <div className="flex flex-col gap-1">
                          <span className="text-sm">{formatDate(run.completed_at)}</span>
                          <PremiumStatusBadge variant={getStatusVariant(run.status)}>
                            {getStatusLabel(run.status)}
                          </PremiumStatusBadge>
                        </div>
                      </PremiumTableCell>
                      <PremiumTableCell>
                        <ProgressBar done={run.done_tasks} total={run.total_tasks} />
                      </PremiumTableCell>
                      <PremiumTableCell>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Users className="h-3 w-3" />
                          {run.assigned_engineers || "—"}
                        </div>
                      </PremiumTableCell>
                      <PremiumTableCell>
                        <div className="flex items-center justify-center gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <PremiumActionButton
                                variant="view"
                                icon={<Eye className="h-4 w-4" />}
                                onClick={() => viewRunDetails(run.run_id)}
                              />
                            </TooltipTrigger>
                            <TooltipContent>View Details</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <PremiumActionButton
                                variant="default"
                                icon={<History className="h-4 w-4" />}
                                onClick={() => viewHistory(run.server_id)}
                              />
                            </TooltipTrigger>
                            <TooltipContent>View Server History</TooltipContent>
                          </Tooltip>
                          {canManage && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <PremiumActionButton
                                  variant="delete"
                                  icon={<Trash2 className="h-4 w-4" />}
                                  onClick={() => deleteRun(run.run_id)}
                                />
                              </TooltipTrigger>
                              <TooltipContent>Delete Run</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </PremiumTableCell>
                    </PremiumTableRow>
                  ))}
                </PremiumTableBody>
              </PremiumTable>
            )}
          </TabsContent>
        </Tabs>

        {/* Run Detail Dialog */}
        <Dialog open={!!detailRun} onOpenChange={() => setDetailRun(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            {detailRun && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-3">
                    <Wrench className="h-5 w-5" />
                    Maintenance Run Details
                  </DialogTitle>
                  <DialogDescription>
                    {detailRun.run.server_code} - {detailRun.run.maintenance_type}
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-6">
                  {/* Run Info */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                        Run Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-xs text-muted-foreground">Server</Label>
                          <div className="mt-1">
                            <div className="font-mono text-sm font-semibold">{detailRun.run.server_code}</div>
                            <div className="text-xs text-muted-foreground">{detailRun.run.hostname}</div>
                    </div>
                    </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Type</Label>
                          <div className="mt-1 text-sm font-medium">{detailRun.run.maintenance_type}</div>
                  </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Frequency</Label>
                          <div className="mt-1">
                            <FrequencyBadge frequency={detailRun.run.frequency} />
              </div>
                  </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Status</Label>
                          <div className="mt-1">
                            <PremiumStatusBadge variant={getStatusVariant(detailRun.run.status)}>
                              {getStatusLabel(detailRun.run.status)}
                            </PremiumStatusBadge>
                              </div>
                              </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Due Date</Label>
                          <div className="mt-1 text-sm">{formatDate(detailRun.run.due_date)}</div>
                              </div>
                        {detailRun.run.completed_at && (
                          <div>
                            <Label className="text-xs text-muted-foreground">Completed</Label>
                            <div className="mt-1 text-sm">{formatDate(detailRun.run.completed_at)}</div>
                              </div>
                        )}
                            </div>

                      {/* Engineers */}
                      <div>
                        <Label className="text-xs text-muted-foreground">Assigned Engineers</Label>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {detailRun.engineers.map((eng) => (
                            <Badge key={eng.engineer_id} variant="outline">
                              <User className="mr-1 h-3 w-3" />
                              {eng.full_name}
                            </Badge>
                          ))}
                          </div>
                        </div>
                    </CardContent>
                  </Card>

                  {/* Checklist */}
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                          Task Checklist
                        </CardTitle>
                        <div className="text-sm font-semibold text-emerald-600">
                          {detailRun.progress.percent}% Complete ({detailRun.progress.done}/{detailRun.progress.total})
                            </div>
                          </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {detailRun.checklist.map((item) => (
                          <div
                            key={item.checklist_item_id}
                            className="flex items-start gap-3 rounded-lg border p-3 hover:bg-muted/50"
                          >
                            <button
                              onClick={() => 
                                detailRun.run.status !== "Complete" && 
                                toggleChecklistItem(detailRun.run.run_id, item.checklist_item_id, item.is_done)
                              }
                              disabled={detailRun.run.status === "Complete"}
                              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors ${
                                item.is_done
                                  ? "border-emerald-500 bg-emerald-500"
                                  : "border-muted-foreground/30 hover:border-emerald-500"
                              } ${detailRun.run.status === "Complete" ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
                            >
                              {item.is_done && <CheckCircle2 className="h-3 w-3 text-white" />}
                            </button>
                            <div className="flex-1">
                              <div className={`text-sm ${item.is_done ? "text-muted-foreground line-through" : ""}`}>
                                {item.label}
                            </div>
                              {item.done_at && (
                                <div className="mt-1 text-xs text-muted-foreground">
                                  Completed {formatDate(item.done_at)}
                            </div>
                              )}
                            </div>
                            </div>
                        ))}
                          </div>
                    </CardContent>
                  </Card>

                  {/* Notes */}
                  {detailRun.run.note && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                          Notes
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground">{detailRun.run.note}</p>
                      </CardContent>
                    </Card>
                  )}
                                  </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setDetailRun(null)}>
                    Close
                  </Button>
                  {detailRun.run.status !== "Complete" && (() => {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const dueDate = new Date(detailRun.run.due_date);
                    dueDate.setHours(0, 0, 0, 0);
                    const canComplete = today >= dueDate;

                                return (
                      <Button 
                        onClick={() => completeRun(detailRun.run.run_id, detailRun.run.due_date)}
                        disabled={!canComplete}
                        title={!canComplete ? `Can only mark complete on or after ${formatDate(detailRun.run.due_date)}` : ''}
                      >
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Mark Complete
                      </Button>
                    );
                  })()}
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* History Dialog */}
        <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <History className="h-5 w-5" />
                Server Maintenance History
              </DialogTitle>
              <DialogDescription>
                Complete timeline of all maintenance runs for this server (all schedules)
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              {historyData.length === 0 ? (
                <EmptyState title="No history" description="No maintenance runs found" />
              ) : (
                historyData.map((run, idx) => (
                  <Card key={run.run_id}>
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
                            <span className="text-sm font-semibold text-muted-foreground">
                              #{historyData.length - idx}
                            </span>
                          </div>
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold">{run.maintenance_type}</span>
                              <FrequencyBadge frequency={run.frequency} />
                              <PremiumStatusBadge variant={getStatusVariant(run.status)}>
                                {getStatusLabel(run.status)}
                              </PremiumStatusBadge>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>Due: {formatDate(run.due_date)}</span>
                              {run.completed_at && (
                                <>
                                  <span>•</span>
                                  <span>Completed: {formatDate(run.completed_at)}</span>
                                </>
                            )}
                          </div>
                            {run.note && (
                              <div className="text-sm text-muted-foreground">{run.note}</div>
                            )}
                            <div className="pt-1">
                              <ProgressBar done={run.done_tasks} total={run.total_tasks} />
                        </div>
                      </div>
                            </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setHistoryOpen(false);
                            viewRunDetails(run.run_id);
                          }}
                        >
                          <Eye className="mr-1 h-3 w-3" />
                          View
                              </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
                          </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setHistoryOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create Schedule Dialog */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Schedule Maintenance
              </DialogTitle>
              <DialogDescription>
                Create a new recurring maintenance schedule with automatic renewal
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              {/* Server Selection */}
              <div className="space-y-2">
                <Label htmlFor="create-server">
                  Server <span className="text-rose-500">*</span>
                </Label>
                <ServerSelect
                  value={createServerId}
                  onChange={(serverId) => {
                    setCreateServerId(serverId);
                    loadServerAndAutoSelectEngineers(serverId);
                  }}
                  showSearch={false}
                  label=""
                />
                            </div>

              {/* Maintenance Types (multi-select) */}
              <div className="space-y-2">
                <Label>
                  Maintenance Types <span className="text-rose-500">*</span>
                </Label>
                <Card>
                  <CardContent className="pt-6">
                    {types.length === 0 ? (
                      <div className="text-sm text-muted-foreground">No maintenance types found.</div>
                    ) : (
                      <div className="grid gap-2 max-h-56 overflow-y-auto">
                        {types.map((type) => {
                          const id = type.maintenance_type_id;
                          const checked = createTypeIds.includes(id);
                          return (
                            <label
                              key={id}
                              className="flex items-start gap-3 rounded-md border p-3 hover:bg-muted/30 cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  const next = e.target.checked;
                                  setCreateTypeIds((prev) => (next ? Array.from(new Set([...prev, id])) : prev.filter((x) => x !== id)));
                                }}
                                className="mt-1 h-4 w-4 rounded border-gray-300"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-medium">
                                  {type.name}
                                  {type.checklist_count > 0 ? (
                                    <span className="ml-2 text-xs text-muted-foreground">({type.checklist_count} tasks)</span>
                                  ) : null}
                                </div>
                                {type.description ? (
                                  <div className="text-xs text-muted-foreground mt-1">{type.description}</div>
                                ) : null}
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Frequency */}
              <div className="space-y-2">
                <Label htmlFor="create-frequency">
                  Frequency <span className="text-rose-500">*</span>
                </Label>
                <div className="grid grid-cols-3 gap-2">
                  {(["Daily", "Weekly", "Monthly"] as Frequency[]).map((freq) => (
                    <button
                      key={freq}
                      type="button"
                      onClick={() => setCreateFrequency(freq)}
                      className={`flex items-center justify-center gap-2 rounded-md border-2 px-4 py-3 text-sm font-medium transition-colors ${
                        createFrequency === freq
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-muted bg-background hover:border-muted-foreground/50"
                      }`}
                    >
                      <RefreshCw className="h-4 w-4" />
                      {freq}
                    </button>
                  ))}
                          </div>
                          </div>

              {/* First Due Date */}
              <div className="space-y-2">
                <Label htmlFor="create-due-date">
                  First Due Date <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="create-due-date"
                  type="date"
                  value={createDueDate}
                  onChange={(e) => setCreateDueDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                />
                        </div>

              {/* Engineer Assignment */}
              <div className="space-y-2">
                <Label>
                  Assign Engineers <span className="text-rose-500">*</span>
                </Label>
                {createServerId === 0 ? (
                  <div className="rounded-md border bg-muted/20 p-4 text-center">
                    <p className="text-sm text-muted-foreground">
                      Please select a server first to see available engineers
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="rounded-md border p-4 space-y-2 max-h-48 overflow-y-auto">
                      {filteredEngineers.length === 0 ? (
                        <div className="text-sm text-muted-foreground text-center py-4">
                          No engineer assigned to this server
                        </div>
                      ) : (
                        filteredEngineers.map((eng) => (
                          <label
                            key={eng.engineer_id}
                            className="flex items-center gap-3 p-2 rounded hover:bg-muted/50 cursor-pointer"
                          >
                                <input
                                  type="checkbox"
                              checked={createEngineerIds.includes(eng.engineer_id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setCreateEngineerIds([...createEngineerIds, eng.engineer_id]);
                                } else {
                                  setCreateEngineerIds(createEngineerIds.filter(id => id !== eng.engineer_id));
                                }
                              }}
                              className="h-4 w-4 rounded border-gray-300"
                            />
                            <div className="flex-1">
                              <div className="text-sm font-medium">{eng.full_name}</div>
                              {eng.email && (
                                <div className="text-xs text-muted-foreground">{eng.email}</div>
                              )}
                            </div>
                              </label>
                        ))
                      )}
                          </div>
                    {createEngineerIds.length > 0 ? (
                      <p className="text-xs text-emerald-600 dark:text-emerald-400">
                        ✓ {createEngineerIds.length} engineer(s) selected
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Select at least one engineer
                      </p>
                    )}
                  </>
                        )}
                      </div>

              {/* Checklist Preview + Custom Items */}
              {createTypeIds.length > 0 && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    Checklist
                    {loadingChecklist && <Loader2 className="h-3 w-3 animate-spin" />}
                  </Label>

                  <div className="grid gap-4">
                    {createTypeIds.map((typeId) => {
                      const type = types.find((t) => t.maintenance_type_id === typeId);
                      const templateItems = typeChecklistsById[typeId] ?? [];
                      const customItems = customChecklistByTypeId[typeId] ?? [];
                      const draft = customDraftByTypeId[typeId] ?? "";
                      const total = templateItems.length + customItems.length;

                      return (
                        <Card key={typeId}>
                          <CardContent className="pt-6 space-y-3">
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-sm font-semibold">
                                {type?.name ?? `Type #${typeId}`}
                                <span className="ml-2 text-xs text-muted-foreground">({total} items)</span>
                              </div>
                            </div>

                            {/* Add custom item */}
                            <div className="flex gap-2">
                              <Input
                                value={draft}
                                onChange={(e) => setCustomDraftByTypeId((prev) => ({ ...prev, [typeId]: e.target.value }))}
                                placeholder="Add custom checklist item…"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                  const label = String(draft).trim();
                                  if (!label) return;
                                  setCustomChecklistByTypeId((prev) => ({
                                    ...prev,
                                    [typeId]: [...(prev[typeId] ?? []), label],
                                  }));
                                  setCustomDraftByTypeId((prev) => ({ ...prev, [typeId]: "" }));
                                }}
                              >
                                Add
                              </Button>
                            </div>

                            {/* Items list */}
                            {total === 0 ? (
                              <div className="text-sm text-muted-foreground">No checklist items for this type.</div>
                            ) : (
                              <div className="rounded-md border overflow-hidden">
                                <div className="max-h-56 overflow-auto">
                                  <ul className="divide-y">
                                    {templateItems.map((item) => (
                                      <li key={item.checklist_item_id} className="flex items-center justify-between gap-3 p-3 text-sm">
                                        <div className="min-w-0">{item.label}</div>
                                        <input type="checkbox" disabled className="h-4 w-4" />
                                      </li>
                                    ))}
                                    {customItems.map((label, idx) => (
                                      <li key={`${typeId}-custom-${idx}`} className="flex items-center justify-between gap-3 p-3 text-sm">
                                        <div className="min-w-0">
                                          {label} <span className="text-xs text-muted-foreground">(custom)</span>
                                        </div>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8"
                                          onClick={() => {
                                            setCustomChecklistByTypeId((prev) => ({
                                              ...prev,
                                              [typeId]: (prev[typeId] ?? []).filter((_, i) => i !== idx),
                                            }));
                                          }}
                                          aria-label="Remove custom checklist item"
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Summary */}
              {createServerId > 0 && createTypeIds.length > 0 && createDueDate && createEngineerIds.length > 0 && (
                <Card className="border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/20">
                  <CardContent className="pt-6">
                    <div className="space-y-2 text-sm">
                      <div className="font-semibold text-emerald-900 dark:text-emerald-100">
                        Schedule Summary
                      </div>
                      <div className="space-y-1 text-emerald-700 dark:text-emerald-300">
                        <div>• First run: {formatDate(createDueDate)}</div>
                        <div>• Frequency: {createFrequency}</div>
                        <div>
                          • Tasks:{" "}
                          {createTypeIds.reduce(
                            (sum, id) =>
                              sum + (typeChecklistsById[id]?.length ?? 0) + (customChecklistByTypeId[id]?.length ?? 0),
                            0
                          )}{" "}
                          checklist items
                        </div>
                        <div>• Engineers: {createEngineerIds.length} assigned</div>
                        <div>• Auto-renewal: Enabled</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setCreateOpen(false)}
                disabled={creating}
              >
                Cancel
                </Button>
              <Button 
                onClick={createSchedule}
                disabled={creating || createServerId === 0 || createTypeIds.length === 0 || !createDueDate || createEngineerIds.length === 0}
              >
                {creating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Calendar className="mr-2 h-4 w-4" />
                    Create Schedule
                  </>
                )}
                      </Button>
              </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </FadeIn>
  );
}
