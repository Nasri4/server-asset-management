"use client";

import * as React from "react";
import {
  AlertTriangle,
  Building2,
  ChevronDown,
  Download,
  Mail,
  MoreVertical,
  Pencil,
  Phone,
  Plus,
  Search,
  Settings,
  Shield,
  Trash2,
  Users,
  Wrench,
  X,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api/client";
import { useAuth } from "@/components/auth/auth-provider";
import { can } from "@/lib/rbac";
import { buildCsv, downloadCsv } from "@/lib/utils/csv";

type TeamRow = {
  team_id: number;
  team_name?: string;
  department?: string;
  oncall_email?: string;
  oncall_phone?: string;
  description?: string;
  engineer_count?: number;
  created_at?: string;
  updated_at?: string;
};

const schema = z.object({
  team_name: requiredText("Team name is required"),
  department: z.enum(["ICT", "NOC", "ISP"]).optional(),
  oncall_email: z.string().email("Invalid email").optional().or(z.literal("")),
  oncall_phone: z.string().trim().optional(),
  description: z.string().trim().optional(),
});

type FormValues = z.infer<typeof schema>;

// Helper function to map department to PremiumStatusBadge variant
function getDepartmentVariant(department?: string): "success" | "warning" | "danger" | "secondary" | "info" {
  if (!department) return "secondary";
  const dept = department.toUpperCase();
  if (dept === "ICT") return "info";
  if (dept === "NOC") return "success";
  if (dept === "ISP") return "warning";
  return "secondary";
}

export default function TeamsPage() {
  const { user } = useAuth();
  const [rows, setRows] = React.useState<TeamRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  // Search and filters
  const [searchQuery, setSearchQuery] = React.useState("");
  const [departmentFilter, setDepartmentFilter] = React.useState<string>("all");
  const [sortField, setSortField] = React.useState<string>("team_name");
  const [sortDirection, setSortDirection] = React.useState<"asc" | "desc">("asc");

  // Column visibility
  const [visibleColumns, setVisibleColumns] = React.useState({
    team_name: true,
    department: true,
    oncall_email: true,
    oncall_phone: true,
    engineer_count: true,
    created: true,
  });

  const [page, setPage] = React.useState(1);
  const pageSize = 15;

  const canManage = can(user, "teams.manage");

  // Add/Edit dialog
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editTeam, setEditTeam] = React.useState<TeamRow | null>(null);

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

  const department = watch("department");

  const load = React.useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const res = await api.get("/api/teams", { headers: { "x-sam-silent": "1" } });
      setRows((res.data?.data ?? []) as TeamRow[]);
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.message || "Failed to load teams";
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
    (team?: TeamRow) => {
      if (team) {
        setEditTeam(team);
        reset({
          team_name: team.team_name ?? "",
          department: team.department as any,
          oncall_email: team.oncall_email ?? "",
          oncall_phone: team.oncall_phone ?? "",
          description: team.description ?? "",
        });
      } else {
        setEditTeam(null);
        reset({
          team_name: "",
          department: undefined,
          oncall_email: "",
          oncall_phone: "",
          description: "",
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
          oncall_email: values.oncall_email || undefined,
        };

        if (editTeam) {
          await api.patch(`/api/teams/${editTeam.team_id}`, payload, {
            headers: { "x-sam-silent": "1" },
          });
          toast.success("Team updated successfully");
        } else {
          await api.post("/api/teams", payload, { headers: { "x-sam-silent": "1" } });
          toast.success("Team created successfully");
        }

        setDialogOpen(false);
        await load();
      } catch (e: any) {
        const status = e?.response?.status;
        const code = e?.response?.data?.error?.code;
        const msg =
          e?.response?.data?.error?.message ??
          e?.message ??
          `Failed to ${editTeam ? "update" : "create"} team`;
        if (status === 409 && code === "TEAM_NAME_ALREADY_EXISTS") {
          toast.error(msg);
          await load();
          return;
        }
        toast.error(msg);
      }
    },
    [editTeam, load]
  );

  const deleteTeam = React.useCallback(
    async (team: TeamRow) => {
      if (!confirm(`Delete team "${team.team_name}"? This cannot be undone.`)) {
        return;
      }

      try {
        await api.delete(`/api/teams/${team.team_id}`, {
          headers: { "x-sam-silent": "1" },
        });
        toast.success("Team deleted successfully");
        await load();
      } catch (e: any) {
        toast.error(
          e?.response?.data?.error?.message ?? e?.message ?? "Failed to delete team"
        );
      }
    },
    [load]
  );

  // Filter and search
  const filteredRows = React.useMemo(() => {
    let result = [...rows];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (r) =>
          r.team_name?.toLowerCase().includes(query) ||
          r.department?.toLowerCase().includes(query) ||
          r.oncall_email?.toLowerCase().includes(query) ||
          r.oncall_phone?.toLowerCase().includes(query) ||
          r.description?.toLowerCase().includes(query)
      );
    }

    // Department filter
    if (departmentFilter && departmentFilter !== "all") {
      result = result.filter((r) => r.department === departmentFilter);
    }

    // Sort
    result.sort((a, b) => {
      let aVal: any = a[sortField as keyof TeamRow];
      let bVal: any = b[sortField as keyof TeamRow];

      if (aVal == null) aVal = "";
      if (bVal == null) bVal = "";

      if (typeof aVal === "string") aVal = aVal.toLowerCase();
      if (typeof bVal === "string") bVal = bVal.toLowerCase();

      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [rows, searchQuery, departmentFilter, sortField, sortDirection]);

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
  }, [searchQuery, departmentFilter]);

  const exportCsv = React.useCallback(() => {
    const headers = [
      "Team Name",
      "Department",
      "On-call Email",
      "On-call Phone",
      "Engineers",
    ];
    const data = filteredRows.map((r) => [
      r.team_name ?? "",
      r.department ?? "",
      r.oncall_email ?? "",
      r.oncall_phone ?? "",
      String(r.engineer_count ?? 0),
    ]);
    const csv = buildCsv(headers, data);
    downloadCsv(csv, `teams-export-${new Date().toISOString().split("T")[0]}.csv`);
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
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Teams</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Manage operational and infrastructure teams responsible for server ownership
            </p>
          </div>

          <div className="flex items-center gap-2">
            {canManage && (
              <Button size="sm" onClick={() => openDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Add Team
              </Button>
            )}

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
                  checked={visibleColumns.team_name}
                  onCheckedChange={(checked) =>
                    setVisibleColumns((prev) => ({ ...prev, team_name: checked }))
                  }
                >
                  Team Name
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={visibleColumns.department}
                  onCheckedChange={(checked) =>
                    setVisibleColumns((prev) => ({ ...prev, department: checked }))
                  }
                >
                  Department
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={visibleColumns.oncall_email}
                  onCheckedChange={(checked) =>
                    setVisibleColumns((prev) => ({ ...prev, oncall_email: checked }))
                  }
                >
                  On-call Email
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={visibleColumns.oncall_phone}
                  onCheckedChange={(checked) =>
                    setVisibleColumns((prev) => ({ ...prev, oncall_phone: checked }))
                  }
                >
                  On-call Phone
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={visibleColumns.engineer_count}
                  onCheckedChange={(checked) =>
                    setVisibleColumns((prev) => ({ ...prev, engineer_count: checked }))
                  }
                >
                  Engineers
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
                placeholder="Search by name, department, email, or phone..."
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
                <Button variant="outline" size="sm" className="min-w-[160px] justify-between">
                  <span>
                    {departmentFilter === "all"
                      ? "All Departments"
                      : departmentFilter}
                  </span>
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setDepartmentFilter("all")}>
                  All Departments
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setDepartmentFilter("ICT")}>
                  <Building2 className="mr-2 h-4 w-4 text-blue-600" /> ICT
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setDepartmentFilter("NOC")}>
                  <Shield className="mr-2 h-4 w-4 text-emerald-600" /> NOC
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setDepartmentFilter("ISP")}>
                  <Wrench className="mr-2 h-4 w-4 text-purple-600" /> ISP
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Active Filters Display */}
          {(searchQuery || departmentFilter !== "all") && (
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
              {departmentFilter !== "all" && (
                <Badge variant="secondary" className="gap-1">
                  Department: {departmentFilter}
                  <button onClick={() => setDepartmentFilter("all")} className="hover:text-foreground">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              <button
                onClick={() => {
                  setSearchQuery("");
                  setDepartmentFilter("all");
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
              {visibleColumns.team_name && (
                <PremiumTableHead
                  sortable
                  sortDirection={sortField === "team_name" ? sortDirection : null}
                  onSort={() => toggleSort("team_name")}
                >
                  Team Name
                </PremiumTableHead>
              )}
              {visibleColumns.department && (
                <PremiumTableHead>Department</PremiumTableHead>
              )}
              {visibleColumns.oncall_email && (
                <PremiumTableHead>On-call Email</PremiumTableHead>
              )}
              {visibleColumns.oncall_phone && (
                <PremiumTableHead>On-call Phone</PremiumTableHead>
              )}
              {visibleColumns.engineer_count && (
                <PremiumTableHead>Engineers</PremiumTableHead>
              )}
              {visibleColumns.created && (
                <PremiumTableHead>Created</PremiumTableHead>
              )}
              <PremiumTableHead className="w-[120px] text-center">Actions</PremiumTableHead>
            </tr>
          </PremiumTableHeader>
          <PremiumTableBody>
            {loading ? (
              <PremiumTableSkeleton rows={5} cols={7} />
            ) : loadError ? (
              <tr>
                <td colSpan={100} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <AlertTriangle className="h-12 w-12 text-slate-400" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Unable to load teams</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{loadError}</p>
                    </div>
                  </div>
                </td>
              </tr>
            ) : total > 0 ? (
              <>
                {pagedRows.map((team) => (
                  <PremiumTableRow key={team.team_id}>
                    {visibleColumns.team_name && (
                      <PremiumTableCell>
                        <div className="font-semibold">{team.team_name || "—"}</div>
                        {team.description && (
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                            {team.description}
                          </div>
                        )}
                      </PremiumTableCell>
                    )}
                    {visibleColumns.department && (
                      <PremiumTableCell>
                        {team.department ? (
                          <PremiumStatusBadge variant={getDepartmentVariant(team.department)}>
                            {team.department}
                          </PremiumStatusBadge>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </PremiumTableCell>
                    )}
                    {visibleColumns.oncall_email && (
                      <PremiumTableCell>
                        {team.oncall_email ? (
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-slate-400" />
                            <a
                              href={`mailto:${team.oncall_email}`}
                              className="text-blue-600 hover:underline dark:text-blue-400"
                            >
                              {team.oncall_email}
                            </a>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </PremiumTableCell>
                    )}
                    {visibleColumns.oncall_phone && (
                      <PremiumTableCell>
                        {team.oncall_phone ? (
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-slate-400" />
                            <a
                              href={`tel:${team.oncall_phone}`}
                              className="text-blue-600 hover:underline dark:text-blue-400"
                            >
                              {team.oncall_phone}
                            </a>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </PremiumTableCell>
                    )}
                    {visibleColumns.engineer_count && (
                      <PremiumTableCell>
                        <Badge variant="secondary" className="font-mono">
                          {team.engineer_count ?? 0}
                        </Badge>
                      </PremiumTableCell>
                    )}
                    {visibleColumns.created && (
                      <PremiumTableCell>
                        {team.created_at
                          ? new Date(team.created_at).toLocaleDateString()
                          : "—"}
                      </PremiumTableCell>
                    )}
                    <PremiumTableCell onClick={(e) => e.stopPropagation()}>
                      {canManage ? (
                        <div className="flex items-center justify-center gap-1">
                          <PremiumActionButton
                            variant="edit"
                            icon={<Pencil className="h-4 w-4" />}
                            onClick={() => openDialog(team)}
                            tooltip="Edit team"
                          />
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <PremiumActionButton
                                variant="default"
                                icon={<MoreVertical className="h-4 w-4" />}
                              />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => openDialog(team)}>
                                <Pencil className="mr-2 h-4 w-4" /> Edit Team
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => deleteTeam(team)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
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
                icon={<Users className="h-12 w-12 text-slate-400" />}
                title="No teams found"
                description={
                  searchQuery || departmentFilter !== "all"
                    ? "Try adjusting your search or filters"
                    : canManage
                    ? "Create your first team to start managing infrastructure ownership"
                    : "No team records are available"
                }
                action={
                  canManage &&
                  !searchQuery &&
                  departmentFilter === "all" ? (
                    <Button onClick={() => openDialog()}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add First Team
                    </Button>
                  ) : undefined
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
              {total === 1 ? "team" : "teams"}
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

              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }).map((_, idx) => {
                  let p = idx + 1;
                  if (totalPages > 5) {
                    if (idx === 0) p = 1;
                    else if (idx === 1 && safePage > 3) p = safePage - 1;
                    else if (idx === 1) p = 2;
                    else if (idx === 2) p = safePage > 3 ? safePage : 3;
                    else if (idx === 3 && safePage < totalPages - 2) p = safePage + 1;
                    else if (idx === 3) p = totalPages - 1;
                    else p = totalPages;
                  }

                  const active = p === safePage;
                  return (
                    <Button
                      key={idx}
                      variant={active ? "default" : "outline"}
                      size="sm"
                      onClick={() => setPage(p)}
                    >
                      {p}
                    </Button>
                  );
                })}
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

        {/* Add/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editTeam ? "Edit Team" : "Add New Team"}</DialogTitle>
            </DialogHeader>

            <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
              {/* Section 1: Team Identity */}
              <div className="space-y-4">
                <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Team Identity
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="team_name">
                      Team Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="team_name"
                      placeholder="e.g. ICT Operations"
                      {...register("team_name")}
                    />
                    {errors.team_name && (
                      <div className="text-xs text-destructive">{errors.team_name.message}</div>
                    )}
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="department">Department</Label>
                    <Select
                      value={department}
                      onValueChange={(value) =>
                        setValue("department", value as any, { shouldValidate: true })
                      }
                    >
                      <SelectTrigger id="department">
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ICT">ICT</SelectItem>
                        <SelectItem value="NOC">NOC</SelectItem>
                        <SelectItem value="ISP">ISP</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Section 2: On-Call Contact */}
              <div className="space-y-4">
                <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  On-Call Contact
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="oncall_email">On-call Email</Label>
                    <Input
                      id="oncall_email"
                      type="email"
                      placeholder="oncall@example.com"
                      {...register("oncall_email")}
                    />
                    {errors.oncall_email && (
                      <div className="text-xs text-destructive">
                        {errors.oncall_email.message}
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="oncall_phone">On-call Phone</Label>
                    <Input
                      id="oncall_phone"
                      type="tel"
                      placeholder="+252 xxx xxx xxx"
                      {...register("oncall_phone")}
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: Optional Metadata */}
              <div className="space-y-4">
                <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Optional Metadata
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description / Notes</Label>
                  <Textarea
                    id="description"
                    placeholder="Team responsibilities and notes"
                    rows={3}
                    {...register("description")}
                  />
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
                  {isSubmitting
                    ? editTeam
                      ? "Updating…"
                      : "Creating…"
                    : editTeam
                    ? "Update Team"
                    : "Create Team"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </FadeIn>
  );
}
