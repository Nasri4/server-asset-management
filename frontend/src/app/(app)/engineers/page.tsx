"use client";

import * as React from "react";
import {
  Activity,
  AlertTriangle,
  ChevronDown,
  Download,
  Mail,
  Pencil,
  Phone,
  Plus,
  Search,
  Settings,
  Shield,
  Trash2,
  User,
  Users,
  Wrench,
  X,
  Building2,
} from "lucide-react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { requiredText } from "@/lib/validation";

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
import { api } from "@/lib/api/client";
import { useAuth } from "@/components/auth/auth-provider";
import { can } from "@/lib/rbac";
import { buildCsv, downloadCsv } from "@/lib/utils/csv";
import { TeamSelect } from "@/components/forms/team-select";

type EngineerRow = {
  engineer_id: number;
  full_name?: string;
  phone?: string;
  email?: string;
  team_id?: number;
  team_name?: string;
  department?: string;
  is_active?: boolean;
  server_count?: number;
  created_at?: string;
  updated_at?: string;
};

const schema = z.object({
  full_name: requiredText("Full name is required"),
  team_id: z.number().int().positive("Team is required"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().trim().optional(),
  is_active: z.boolean().optional(),
});

type FormValues = z.infer<typeof schema>;

// Team badge component - Premium Style
function TeamBadge({ team, department }: { team?: string; department?: string }) {
  if (!team) return <span className="text-muted-foreground text-xs">—</span>;

  const config: Record<string, { icon: any; className: string; dot: string }> = {
    ICT: {
      icon: Building2,
      className: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/30",
      dot: "bg-blue-500",
    },
    NOC: {
      icon: Shield,
      className: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30",
      dot: "bg-emerald-500",
    },
    ISP: {
      icon: Wrench,
      className: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/20 dark:text-purple-400 dark:border-purple-900/30",
      dot: "bg-purple-500",
    },
  };

  const dept = department || "";
  const cfg = config[dept] || {
    icon: Users,
    className: "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-950/20 dark:text-slate-400 dark:border-slate-900/30",
    dot: "bg-slate-400",
  };
  const Icon = cfg.icon;

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${cfg.className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      <Icon className="h-3 w-3" />
      {team}
    </span>
  );
}

// Helper function to map engineer status to PremiumStatusBadge variant
function getEngineerStatusVariant(active?: boolean): "success" | "secondary" {
  if (active === undefined || active === null) {
    return "secondary";
  }
  return active ? "success" : "secondary";
}

function getEngineerStatusLabel(active?: boolean): string {
  if (active === undefined || active === null) {
    return "—";
  }
  return active ? "Active" : "Inactive";
}

export default function EngineersPage() {
  const { user } = useAuth();
  const [rows, setRows] = React.useState<EngineerRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  // Search and filters
  const [searchQuery, setSearchQuery] = React.useState("");
  const [teamFilter, setTeamFilter] = React.useState<string>("all");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [sortField, setSortField] = React.useState<string>("full_name");
  const [sortDirection, setSortDirection] = React.useState<"asc" | "desc">("asc");

  // Column visibility
  const [visibleColumns, setVisibleColumns] = React.useState({
    full_name: true,
    team: true,
    email: true,
    phone: true,
    status: true,
    created: true,
  });

  const [page, setPage] = React.useState(1);
  const pageSize = 15;

  const canManage = can(user, "engineers.manage");

  // Add/Edit dialog
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editEngineer, setEditEngineer] = React.useState<EngineerRow | null>(null);
  const [deleteId, setDeleteId] = React.useState<number | null>(null);

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

  const teamId = watch("team_id");
  const isActive = watch("is_active");

  const load = React.useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const res = await api.get("/api/engineers", { headers: { "x-sam-silent": "1" } });
      setRows((res.data?.data ?? []) as EngineerRow[]);
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.message || "Failed to load engineers";
      setLoadError(msg);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const openDialog = React.useCallback(
    (engineer?: EngineerRow) => {
      if (engineer) {
        setEditEngineer(engineer);
        reset({
          full_name: engineer.full_name ?? "",
          team_id: engineer.team_id ?? 0,
          email: engineer.email ?? "",
          phone: engineer.phone ?? "",
          is_active: engineer.is_active ?? true,
        });
      } else {
        setEditEngineer(null);
        reset({
          full_name: "",
          team_id: 0,
          email: "",
          phone: "",
          is_active: true,
        });
      }
      setDialogOpen(true);
    },
    [reset]
  );

  const onSubmit = React.useCallback(
    async (values: FormValues) => {
      try {
        const payload = {
          ...values,
          email: values.email || null,
          phone: values.phone || null,
          is_active: values.is_active ?? true,
        };

        if (editEngineer) {
          await api.patch(`/api/engineers/${editEngineer.engineer_id}`, payload, {
            headers: { "x-sam-silent": "1" },
          });
          toast.success("Engineer updated");
        } else {
          await api.post("/api/engineers", payload, { headers: { "x-sam-silent": "1" } });
          toast.success("Engineer created");
        }

        setDialogOpen(false);
        await load();
      } catch (err: any) {
        const msg = err?.response?.data?.error?.message || err?.message || "Failed to save engineer";
        toast.error(msg);
      }
    },
    [editEngineer, load]
  );

  const handleDelete = React.useCallback(
    async (id: number) => {
      try {
        await api.delete(`/api/engineers/${id}`, { headers: { "x-sam-silent": "1" } });
        toast.success("Engineer deleted");
        setDeleteId(null);
        await load();
      } catch (err: any) {
        const msg = err?.response?.data?.error?.message || err?.message || "Failed to delete engineer";
        toast.error(msg);
      }
    },
    [load]
  );

  // Filter and sort
  const filteredRows = React.useMemo(() => {
    let result = [...rows];

    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((r) => {
        const name = (r.full_name ?? "").toLowerCase();
        const email = (r.email ?? "").toLowerCase();
        const phone = (r.phone ?? "").toLowerCase();
        const team = (r.team_name ?? "").toLowerCase();
        return name.includes(q) || email.includes(q) || phone.includes(q) || team.includes(q);
      });
    }

    // Team filter
    if (teamFilter && teamFilter !== "all") {
      result = result.filter((r) => r.team_name === teamFilter);
    }

    // Status filter
    if (statusFilter && statusFilter !== "all") {
      const targetStatus = statusFilter === "active";
      result = result.filter((r) => r.is_active === targetStatus);
    }

    // Sort
    result.sort((a, b) => {
      let aVal: any = a[sortField as keyof EngineerRow];
      let bVal: any = b[sortField as keyof EngineerRow];

      if (aVal == null) aVal = "";
      if (bVal == null) bVal = "";

      if (typeof aVal === "string") aVal = aVal.toLowerCase();
      if (typeof bVal === "string") bVal = bVal.toLowerCase();

      return sortDirection === "asc" ? (aVal > bVal ? 1 : -1) : aVal < bVal ? 1 : -1;
    });

    return result;
  }, [rows, searchQuery, teamFilter, statusFilter, sortField, sortDirection]);

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
  }, [searchQuery, teamFilter, statusFilter]);

  const exportCsv = React.useCallback(() => {
    const headers = ["Full Name", "Team", "Email", "Phone", "Status"];
    const data = filteredRows.map((r) => [
      r.full_name ?? "",
      r.team_name ?? "",
      r.email ?? "",
      r.phone ?? "",
      r.is_active ? "Active" : "Inactive",
    ]);
    const csv = buildCsv(headers, data);
    downloadCsv(csv, `engineers-export-${new Date().toISOString().split("T")[0]}.csv`);
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

  // Get unique teams for filter
  const uniqueTeams = React.useMemo(() => {
    const teams = new Set<string>();
    rows.forEach((r) => {
      if (r.team_name) teams.add(r.team_name);
    });
    return Array.from(teams).sort();
  }, [rows]);

  return (
    <FadeIn>
      <div className="space-y-6">
        {/* V2 Page Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Engineers</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Manage technical staff and field engineers responsible for infrastructure
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

            {canManage && (
              <Button size="sm" onClick={() => openDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Add Engineer
              </Button>
            )}
          </div>
        </div>

        {/* Clean Controls */}
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
                  checked={visibleColumns.full_name}
                  onCheckedChange={(checked) =>
                    setVisibleColumns((prev) => ({ ...prev, full_name: checked }))
                  }
                >
                  Full Name
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={visibleColumns.team}
                  onCheckedChange={(checked) =>
                    setVisibleColumns((prev) => ({ ...prev, team: checked }))
                  }
                >
                  Team
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={visibleColumns.email}
                  onCheckedChange={(checked) =>
                    setVisibleColumns((prev) => ({ ...prev, email: checked }))
                  }
                >
                  Email
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={visibleColumns.phone}
                  onCheckedChange={(checked) =>
                    setVisibleColumns((prev) => ({ ...prev, phone: checked }))
                  }
                >
                  Phone
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
                  checked={visibleColumns.created}
                  onCheckedChange={(checked) =>
                    setVisibleColumns((prev) => ({ ...prev, created: checked }))
                  }
                >
                  Created Date
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
                placeholder="Search engineers by name, email, phone, or team..."
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
                  <span>{teamFilter === "all" ? "All Teams" : teamFilter}</span>
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setTeamFilter("all")}>
                  All Teams
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {uniqueTeams.map((team) => (
                  <DropdownMenuItem key={team} onClick={() => setTeamFilter(team)}>
                    {team}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="min-w-[140px] justify-between">
                  <span>
                    {statusFilter === "all"
                      ? "All Status"
                      : statusFilter === "active"
                      ? "Active"
                      : "Inactive"}
                  </span>
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setStatusFilter("all")}>
                  All Status
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setStatusFilter("active")}>
                  <Activity className="mr-2 h-4 w-4 text-emerald-600" /> Active
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("inactive")}>
                  <Activity className="mr-2 h-4 w-4 text-slate-600" /> Inactive
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Active Filters Display */}
          {(searchQuery || teamFilter !== "all" || statusFilter !== "all") && (
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
              {teamFilter !== "all" && (
                <Badge variant="secondary" className="gap-1">
                  Team: {teamFilter}
                  <button onClick={() => setTeamFilter("all")} className="hover:text-foreground">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {statusFilter !== "all" && (
                <Badge variant="secondary" className="gap-1">
                  Status: {statusFilter === "active" ? "Active" : "Inactive"}
                  <button
                    onClick={() => setStatusFilter("all")}
                    className="hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              <button
                onClick={() => {
                  setSearchQuery("");
                  setTeamFilter("all");
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
              {visibleColumns.full_name && (
                <PremiumTableHead
                  sortable
                  sortDirection={sortField === "full_name" ? sortDirection : null}
                  onSort={() => toggleSort("full_name")}
                >
                  Full Name
                </PremiumTableHead>
              )}
              {visibleColumns.team && (
                <PremiumTableHead
                  sortable
                  sortDirection={sortField === "team_name" ? sortDirection : null}
                  onSort={() => toggleSort("team_name")}
                >
                  Team
                </PremiumTableHead>
              )}
              {visibleColumns.email && <PremiumTableHead>Email</PremiumTableHead>}
              {visibleColumns.phone && <PremiumTableHead>Phone</PremiumTableHead>}
              {visibleColumns.status && (
                <PremiumTableHead
                  sortable
                  sortDirection={sortField === "is_active" ? sortDirection : null}
                  onSort={() => toggleSort("is_active")}
                >
                  Status
                </PremiumTableHead>
              )}
              {visibleColumns.created && (
                <PremiumTableHead
                  sortable
                  sortDirection={sortField === "created_at" ? sortDirection : null}
                  onSort={() => toggleSort("created_at")}
                >
                  Created
                </PremiumTableHead>
              )}
              <PremiumTableHead className="w-[120px] text-center">Actions</PremiumTableHead>
            </tr>
          </PremiumTableHeader>
          <PremiumTableBody>
            {loading ? (
              <PremiumTableSkeleton rows={5} cols={7} />
            ) : loadError ? (
              <PremiumTableEmptyState
                icon={<AlertTriangle className="h-12 w-12 text-slate-400 dark:text-slate-600" />}
                title="Failed to load"
                description={loadError}
                action={
                  <Button onClick={load} variant="outline" size="sm">
                    Retry
                  </Button>
                }
              />
            ) : pagedRows.length === 0 ? (
              <PremiumTableEmptyState
                icon={<Users className="h-12 w-12 text-slate-400 dark:text-slate-600" />}
                title="No engineers found"
                description={
                  searchQuery || teamFilter !== "all" || statusFilter !== "all"
                    ? "Try adjusting your search or filters"
                    : canManage
                    ? "Create your first engineer to start managing technical staff"
                    : "No engineer records are available"
                }
                action={
                  canManage &&
                  !searchQuery &&
                  teamFilter === "all" &&
                  statusFilter === "all" ? (
                    <Button onClick={() => openDialog()} size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Add First Engineer
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <>
                {pagedRows.map((row) => (
                  <PremiumTableRow key={row.engineer_id}>
                    {visibleColumns.full_name && (
                      <PremiumTableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-slate-400" />
                          <span className="font-medium">{row.full_name || "—"}</span>
                        </div>
                      </PremiumTableCell>
                    )}
                    {visibleColumns.team && (
                      <PremiumTableCell>
                        <TeamBadge team={row.team_name} department={row.department} />
                      </PremiumTableCell>
                    )}
                    {visibleColumns.email && (
                      <PremiumTableCell>
                        {row.email ? (
                          <a
                            href={`mailto:${row.email}`}
                            className="flex items-center gap-2 text-blue-600 hover:underline dark:text-blue-400"
                          >
                            <Mail className="h-3.5 w-3.5" />
                            {row.email}
                          </a>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </PremiumTableCell>
                    )}
                    {visibleColumns.phone && (
                      <PremiumTableCell>
                        {row.phone ? (
                          <a
                            href={`tel:${row.phone}`}
                            className="flex items-center gap-2 text-blue-600 hover:underline dark:text-blue-400"
                          >
                            <Phone className="h-3.5 w-3.5" />
                            {row.phone}
                          </a>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </PremiumTableCell>
                    )}
                    {visibleColumns.status && (
                      <PremiumTableCell>
                        {row.is_active !== undefined && row.is_active !== null ? (
                          <PremiumStatusBadge variant={getEngineerStatusVariant(row.is_active)}>
                            {getEngineerStatusLabel(row.is_active)}
                          </PremiumStatusBadge>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </PremiumTableCell>
                    )}
                    {visibleColumns.created && (
                      <PremiumTableCell>
                        {row.created_at ? (
                          <span className="text-slate-500">
                            {new Date(row.created_at).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </PremiumTableCell>
                    )}
                    <PremiumTableCell onClick={(e) => e.stopPropagation()}>
                      {canManage && (
                        <div className="flex items-center justify-center gap-1">
                          <PremiumActionButton
                            variant="edit"
                            icon={<Pencil className="h-4 w-4" />}
                            onClick={() => openDialog(row)}
                            tooltip="Edit engineer"
                          />
                          <PremiumActionButton
                            variant="delete"
                            icon={<Trash2 className="h-4 w-4" />}
                            onClick={() => setDeleteId(row.engineer_id)}
                            tooltip="Delete engineer"
                          />
                        </div>
                      )}
                    </PremiumTableCell>
                  </PremiumTableRow>
                ))}

                {/* Pagination */}
                {totalPages > 1 && (
                  <tr>
                    <td colSpan={100} className="border-t border-slate-200 dark:border-slate-800 px-4 py-4">
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-slate-500 dark:text-slate-400">
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
                          <div className="text-sm text-slate-600 dark:text-slate-400">
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
                    </td>
                  </tr>
                )}
              </>
            )}
          </PremiumTableBody>
        </PremiumTable>

        {/* Add/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-[550px]">
            <DialogHeader>
              <DialogTitle>{editEngineer ? "Edit Engineer" : "Add Engineer"}</DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Section 1: Identity */}
              <div className="space-y-4">
                <div className="text-sm font-medium text-muted-foreground">Identity</div>
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="full_name">
                      Full Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="full_name"
                      placeholder="e.g. Ahmed Ali"
                      {...register("full_name")}
                    />
                    {errors.full_name && (
                      <p className="text-xs text-destructive">{errors.full_name.message}</p>
                    )}
                  </div>

                  <div className="grid gap-2">
                    <TeamSelect
                      value={teamId || undefined}
                      onChange={(id) => {
                        if (id === undefined) return;
                        setValue("team_id", id, { shouldValidate: true });
                      }}
                      showSearch={false}
                    />
                    <input type="hidden" {...register("team_id", { valueAsNumber: true })} />
                    {errors.team_id && (
                      <p className="text-xs text-destructive">{errors.team_id.message}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Section 2: Contact */}
              <div className="space-y-4">
                <div className="text-sm font-medium text-muted-foreground">Contact</div>
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="engineer@example.com"
                      {...register("email")}
                    />
                    {errors.email && (
                      <p className="text-xs text-destructive">{errors.email.message}</p>
                    )}
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input id="phone" placeholder="+252612345678" {...register("phone")} />
                  </div>
                </div>
              </div>

              {/* Section 3: Status */}
              <div className="space-y-4">
                <div className="text-sm font-medium text-muted-foreground">Status</div>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="is_active"
                    className="h-4 w-4 rounded border-gray-300"
                    {...register("is_active")}
                  />
                  <Label htmlFor="is_active" className="cursor-pointer">
                    Active Engineer
                  </Label>
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : editEngineer ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Engineer</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete this engineer? This action cannot be undone.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteId(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (deleteId) handleDelete(deleteId);
                }}
              >
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </FadeIn>
  );
}
