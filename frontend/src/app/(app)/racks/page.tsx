"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Download,
  Grid3x3,
  MapPin,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Server as ServerIcon,
  Settings,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { requiredText } from "@/lib/validation";

import { FadeIn } from "@/components/motion/fade-in";
import { EmptyState } from "@/components/data/empty-state";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/lib/api/client";
import { useAuth } from "@/components/auth/auth-provider";
import { can } from "@/lib/rbac";
import { LocationSelect } from "@/components/forms/location-select";
import { buildCsv, downloadCsv } from "@/lib/utils/csv";

type RackRow = {
  rack_id: number;
  rack_code?: string;
  location_id?: number;
  site_name?: string; // Site/location name from locations table
  total_u?: number; // Total rack units
  used_u?: number; // Future: used rack units
  status?: string; // active, maintenance, disabled
  created_at?: string;
  updated_at?: string;
};

const schema = z.object({
  rack_code: requiredText("Rack code is required"),
  location_id: z.number().int().positive("Location is required"),
  total_u: z.number().int().positive().optional(),
});

type FormValues = z.infer<typeof schema>;

// Helper function to map rack status to PremiumStatusBadge variant
function getRackStatusVariant(rack: RackRow): "success" | "warning" | "danger" | "secondary" | "info" {
  if (rack.status) {
    const status = rack.status.toLowerCase();
    if (status === "active") return "success";
    if (status === "maintenance") return "warning";
    if (status === "disabled") return "danger";
  }
  
  // Default: Assume active if rack_code exists
  return rack.rack_code ? "success" : "info";
}

function getRackStatusLabel(rack: RackRow): string {
  if (rack.status) {
    const status = rack.status.toLowerCase();
    if (status === "active") return "Active";
    if (status === "maintenance") return "Maintenance";
    if (status === "disabled") return "Disabled";
  }
  
  return rack.rack_code ? "Active" : "Pending";
}

export default function RacksPage() {
  const { user } = useAuth();
  const [rows, setRows] = React.useState<RackRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const tableRef = React.useRef<HTMLDivElement | null>(null);

  // Search and filter state
  const [searchQuery, setSearchQuery] = React.useState("");
  const [locationFilter, setLocationFilter] = React.useState<number | string>("all");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [sortField, setSortField] = React.useState<string>("rack_code");
  const [sortDirection, setSortDirection] = React.useState<"asc" | "desc">("asc");

  // Column visibility
  const [visibleColumns, setVisibleColumns] = React.useState({
    rack_code: true,
    site_name: true,
    total_u: true,
    status: true,
  });

  const [page, setPage] = React.useState(1);
  const pageSize = 15;

  const canManage = can(user, "racks.manage");

  const [createOpen, setCreateOpen] = React.useState(false);

  const [editOpen, setEditOpen] = React.useState(false);
  const [editRack, setEditRack] = React.useState<RackRow | null>(null);
  const [editRackCode, setEditRackCode] = React.useState("");
  const [editLocationId, setEditLocationId] = React.useState<number | undefined>(undefined);
  const [editTotalU, setEditTotalU] = React.useState<number>(42); // Default rack units
  const [editSaving, setEditSaving] = React.useState(false);

  const [deleteTarget, setDeleteTarget] = React.useState<RackRow | null>(null);
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
    defaultValues: { rack_code: "", location_id: 0, total_u: 42 },
  });

  const locationId = watch("location_id");

  const load = React.useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const res = await api.get("/api/racks", { headers: { "x-sam-silent": "1" } });
      setRows((res.data?.data ?? []) as RackRow[]);
    } catch (err: any) {
      const msg =
        (err?.response?.data?.error?.message as string | undefined) ||
        (err?.message as string | undefined) ||
        "Failed to load racks";
      setLoadError(msg);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const onSubmit = React.useCallback(
    async (values: FormValues) => {
      try {
        await api.post(
          "/api/racks",
          {
            rack_code: values.rack_code,
            location_id: values.location_id,
            total_u: values.total_u || 42, // Future: Send to backend
          },
          { headers: { "x-sam-silent": "1" } }
        );
        toast.success("Rack created successfully");
        setCreateOpen(false);
        reset({ rack_code: "", location_id: values.location_id, total_u: 42 });
        await load();
        tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      } catch (e: any) {
        const status = e?.response?.status;
        const code = e?.response?.data?.error?.code;
        const msg = e?.response?.data?.error?.message ?? e?.message ?? "Failed to create rack";
        if (status === 409 && code === "RACK_CODE_ALREADY_EXISTS") {
          toast.error(msg);
          await load();
          return;
        }
        toast.error(msg);
      }
    },
    [load, reset]
  );

  const openEdit = React.useCallback((rack: RackRow) => {
    setEditRack(rack);
    setEditRackCode(String(rack.rack_code ?? ""));
    setEditLocationId(rack.location_id ?? undefined);
    setEditTotalU(rack.total_u ?? 42);
    setEditOpen(true);
  }, []);

  const submitEdit = React.useCallback(async () => {
    if (!editRack) return;
    try {
      setEditSaving(true);
      await api.patch(
        `/api/racks/${editRack.rack_id}`,
        {
          rack_code: editRackCode.trim() || null,
          location_id: editLocationId ?? null,
          total_u: editTotalU, // Future: Send to backend
        },
        { headers: { "x-sam-silent": "1" } }
      );
      toast.success("Rack updated successfully");
      setEditOpen(false);
      await load();
    } catch (e: any) {
      const status = e?.response?.status;
      const code = e?.response?.data?.error?.code;
      const msg = e?.response?.data?.error?.message ?? e?.message ?? "Failed to update rack";
      if (status === 409 && code === "RACK_CODE_ALREADY_EXISTS") {
        toast.error(msg);
        return;
      }
      toast.error(msg);
    } finally {
      setEditSaving(false);
    }
  }, [editLocationId, editRack, editRackCode, editTotalU, load]);

  const deleteRack = React.useCallback(async (rack: RackRow) => {
    if (!rack) return;
    try {
      setDeleting(true);
      await api.delete(`/api/racks/${rack.rack_id}`, { headers: { "x-sam-silent": "1" } });
      toast.success("Rack deleted successfully");
      setDeleteTarget(null);
      await load();
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message ?? e?.message ?? "Failed to delete rack");
    } finally {
      setDeleting(false);
    }
  }, [load]);

  // Calculate metrics
  const totalRacks = rows.length;
  const uniqueLocations = new Set(rows.filter(r => r.location_id).map(r => r.location_id)).size;
  
  // Future: Calculate from actual server assignments
  const racksWithServers = 0; // Placeholder
  const emptyRacks = totalRacks - racksWithServers;

  // Get unique locations for filter
  const uniqueLocationIds = React.useMemo(() => {
    const ids = new Set(rows.map((r) => r.location_id).filter(Boolean));
    return Array.from(ids).sort((a, b) => a! - b!);
  }, [rows]);

  // Filter and search
  const filteredRows = React.useMemo(() => {
    let result = [...rows];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (r) =>
          r.rack_code?.toLowerCase().includes(query) ||
          r.site_name?.toLowerCase().includes(query) ||
          String(r.location_id).includes(query)
      );
    }

    // Location filter
    if (locationFilter && locationFilter !== "all") {
      result = result.filter((r) => r.location_id === Number(locationFilter));
    }

    // Status filter
    if (statusFilter && statusFilter !== "all") {
      result = result.filter((r) => {
        const statusLabel = getRackStatusLabel(r);
        return statusLabel.toLowerCase() === statusFilter.toLowerCase();
      });
    }

    // Sort
    result.sort((a, b) => {
      let aVal: any = a[sortField as keyof RackRow];
      let bVal: any = b[sortField as keyof RackRow];

      if (aVal == null) aVal = "";
      if (bVal == null) bVal = "";

      if (typeof aVal === "string") aVal = aVal.toLowerCase();
      if (typeof bVal === "string") bVal = bVal.toLowerCase();

      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [rows, searchQuery, locationFilter, statusFilter, sortField, sortDirection]);

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
  }, [searchQuery, locationFilter, statusFilter]);

  const exportCsv = React.useCallback(() => {
    const headers = ["Rack Code", "Site Name", "Total U", "Status"];
    const data = filteredRows.map((r) => [
      r.rack_code ?? "",
      r.site_name ?? "",
      String(r.total_u ?? 42),
      getRackStatusLabel(r),
    ]);
    const csv = buildCsv(headers, data);
    downloadCsv(csv, `racks-export-${new Date().toISOString().split("T")[0]}.csv`);
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
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Racks</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Rack inventory and placement management for datacenter infrastructure
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
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Rack
              </Button>
            )}
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
                  checked={visibleColumns.rack_code}
                  onCheckedChange={(checked) =>
                    setVisibleColumns((prev) => ({ ...prev, rack_code: checked }))
                  }
                >
                  Rack Code
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={visibleColumns.site_name}
                  onCheckedChange={(checked) =>
                    setVisibleColumns((prev) => ({ ...prev, site_name: checked }))
                  }
                >
                  Site Name
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={visibleColumns.total_u}
                  onCheckedChange={(checked) =>
                    setVisibleColumns((prev) => ({ ...prev, total_u: checked }))
                  }
                >
                  Total U
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={visibleColumns.status}
                  onCheckedChange={(checked) =>
                    setVisibleColumns((prev) => ({ ...prev, status: checked }))
                  }
                >
                  Status
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
                placeholder="Search by rack code or location..."
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

            {uniqueLocationIds.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="min-w-[140px] justify-between">
                    <span>
                      {locationFilter === "all"
                        ? "All Locations"
                        : `Location ${locationFilter}`}
                    </span>
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setLocationFilter("all")}>
                    All Locations
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {uniqueLocationIds.map((locId) => (
                    <DropdownMenuItem
                      key={locId}
                      onClick={() => setLocationFilter(locId!)}
                    >
                      <MapPin className="mr-2 h-4 w-4" /> Location {locId}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

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
                <DropdownMenuItem onClick={() => setStatusFilter("active")}>
                  <CheckCircle2 className="mr-2 h-4 w-4 text-green-600" /> Active
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("maintenance")}>
                  <AlertTriangle className="mr-2 h-4 w-4 text-amber-600" /> Maintenance
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("disabled")}>
                  <XCircle className="mr-2 h-4 w-4 text-red-600" /> Disabled
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Active Filters Display */}
          {(searchQuery || locationFilter !== "all" || statusFilter !== "all") && (
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
              {locationFilter !== "all" && (
                <Badge variant="secondary" className="gap-1">
                  Location: {locationFilter}
                  <button onClick={() => setLocationFilter("all")} className="hover:text-foreground">
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
                  setLocationFilter("all");
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
        <div ref={tableRef}>
          <PremiumTable>
            <PremiumTableHeader>
              <tr>
                {visibleColumns.rack_code && (
                  <PremiumTableHead
                    sortable
                    sortDirection={sortField === "rack_code" ? sortDirection : null}
                    onSort={() => toggleSort("rack_code")}
                  >
                    Rack Code
                  </PremiumTableHead>
                )}
                {visibleColumns.site_name && (
                  <PremiumTableHead
                    sortable
                    sortDirection={sortField === "site_name" ? sortDirection : null}
                    onSort={() => toggleSort("site_name")}
                  >
                    Site Name
                  </PremiumTableHead>
                )}
                {visibleColumns.total_u && (
                  <PremiumTableHead>Total U</PremiumTableHead>
                )}
                {visibleColumns.status && (
                  <PremiumTableHead>Status</PremiumTableHead>
                )}
                <PremiumTableHead className="w-[120px] text-center">Actions</PremiumTableHead>
              </tr>
            </PremiumTableHeader>
            <PremiumTableBody>
              {loading ? (
                <PremiumTableSkeleton rows={5} cols={5} />
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
              ) : total > 0 ? (
                <>
                  {pagedRows.map((rack) => (
                    <PremiumTableRow key={rack.rack_id}>
                      {visibleColumns.rack_code && (
                        <PremiumTableCell>
                          <div className="font-mono font-semibold">
                            {rack.rack_code || "—"}
                          </div>
                        </PremiumTableCell>
                      )}
                      {visibleColumns.site_name && (
                        <PremiumTableCell>
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-slate-400" />
                            <span>{rack.site_name || "—"}</span>
                          </div>
                        </PremiumTableCell>
                      )}
                      {visibleColumns.total_u && (
                        <PremiumTableCell>
                          <Badge variant="secondary" className="font-mono">
                            {rack.total_u || 42}U
                          </Badge>
                        </PremiumTableCell>
                      )}
                      {visibleColumns.status && (
                        <PremiumTableCell>
                          <PremiumStatusBadge variant={getRackStatusVariant(rack)}>
                            {getRackStatusLabel(rack)}
                          </PremiumStatusBadge>
                        </PremiumTableCell>
                      )}
                      <PremiumTableCell onClick={(e) => e.stopPropagation()}>
                        {canManage ? (
                          <div className="flex items-center justify-center gap-1">
                            <PremiumActionButton
                              variant="edit"
                              icon={<Pencil className="h-4 w-4" />}
                              onClick={() => openEdit(rack)}
                              tooltip="Edit rack"
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
                                <DropdownMenuItem onClick={() => openEdit(rack)}>
                                  <Pencil className="mr-2 h-4 w-4" /> Edit Rack
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                  <Link href={`/servers?rack=${rack.rack_id}`}>
                                    <ServerIcon className="mr-2 h-4 w-4" /> View Servers
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => setDeleteTarget(rack)}
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
                  icon={<Grid3x3 className="h-12 w-12 text-slate-400" />}
                  title="No racks found"
                  description={
                    searchQuery || locationFilter !== "all" || statusFilter !== "all"
                      ? "Try adjusting your search or filters"
                      : "Create your first rack to start organizing your datacenter infrastructure"
                  }
                  action={
                    canManage ? (
                      <Button size="sm" onClick={() => setCreateOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Create Rack
                      </Button>
                    ) : undefined
                  }
                />
              )}
            </PremiumTableBody>
          </PremiumTable>

          {/* Pagination */}
          {total > 0 && (
            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm text-slate-500 dark:text-slate-400">
                Showing {total ? startIndex + 1 : 0} to {endIndex} of {total}{" "}
                {total === 1 ? "rack" : "racks"}
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
        </div>
      </div>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Rack</DialogTitle>
          </DialogHeader>

          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2 md:col-span-1">
                <Label htmlFor="rack_code">Rack Code <span className="text-destructive">*</span></Label>
                <Input id="rack_code" placeholder="e.g. DC1-RACK-01" {...register("rack_code")} />
                {errors.rack_code && <div className="text-xs text-destructive">{errors.rack_code.message}</div>}
              </div>
              <div className="space-y-2 md:col-span-1">
                <LocationSelect
                  label="Location"
                  value={locationId || undefined}
                  onChange={(id) => {
                    if (id === undefined) return;
                    setValue("location_id", id, { shouldDirty: true, shouldValidate: true });
                  }}
                  showSearch={false}
                />
                <input type="hidden" {...register("location_id", { valueAsNumber: true })} />
                {errors.location_id && (
                  <div className="text-xs text-destructive">{errors.location_id.message}</div>
                )}
              </div>
              <div className="space-y-2 md:col-span-1">
                <Label htmlFor="total_u">Total U (Rack Units)</Label>
                <Input
                  id="total_u"
                  type="number"
                  placeholder="e.g. 42"
                  {...register("total_u", { valueAsNumber: true })}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creating…" : "Create Rack"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Rack</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit_rack_code">Rack Code</Label>
              <Input
                id="edit_rack_code"
                value={editRackCode}
                onChange={(e) => setEditRackCode(e.target.value)}
                placeholder="e.g. DC1-RACK-01"
              />
            </div>

            <div className="space-y-2">
              <LocationSelect
                label="Location"
                allowEmpty
                emptyLabel="No location"
                value={editLocationId}
                onChange={(id) => setEditLocationId(id)}
                showSearch={false}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_total_u">Total U (Rack Units)</Label>
              <Input
                id="edit_total_u"
                type="number"
                value={editTotalU}
                onChange={(e) => setEditTotalU(Number(e.target.value))}
                placeholder="e.g. 42"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={editSaving}>
              Cancel
            </Button>
            <Button variant="default" onClick={() => void submitEdit()} disabled={editSaving || !editRack}>
              {editSaving ? "Saving…" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Rack</DialogTitle>
            <p className="text-sm text-muted-foreground mt-2">
              Are you sure you want to delete rack{" "}
              <span className="font-semibold font-mono">
                {deleteTarget?.rack_code ?? `#${deleteTarget?.rack_id}`}
              </span>
              ? This action cannot be undone.
            </p>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => void deleteRack(deleteTarget!)}
              disabled={!deleteTarget || deleting}
            >
              {deleting ? "Deleting…" : "Delete Rack"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </FadeIn>
  );
}
