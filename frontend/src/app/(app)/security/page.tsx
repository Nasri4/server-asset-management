"use client";

import * as React from "react";
import {
  AlertTriangle,
  ChevronDown,
  Download,
  Eye,
  Key,
  Pencil,
  Search,
  Server,
  Settings,
  Shield,
  ShieldAlert,
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

type SecurityRow = {
  security_id: number;
  server_id: number;
  server_code?: string;
  hostname?: string;
  os?: string;
  os_version?: string;
  hardening_status?: string;
  ssh_key_only?: boolean;
  antivirus_installed?: boolean;
  backup_enabled?: boolean;
  compliance_status?: string;
  last_security_scan?: string;
  created_at?: string;
  updated_at?: string;
};

const schema = z.object({
  os: z.string().trim().optional(),
  os_version: z.string().trim().optional(),
  hardening_status: z.enum(["Secure", "Partial", "Risk"]).optional(),
  ssh_key_only: z.boolean().optional(),
  antivirus_installed: z.boolean().optional(),
  backup_enabled: z.boolean().optional(),
  compliance_status: z.enum(["Compliant", "Partial", "Non-Compliant"]).optional(),
});

type FormValues = z.infer<typeof schema>;

// Helper function to map hardening status to PremiumStatusBadge variant
function getHardeningStatusVariant(status?: string): "success" | "warning" | "danger" | "secondary" | "info" {
  if (!status) return "secondary";
  const normalized = status.toLowerCase();
  if (normalized === "secure") return "success";
  if (normalized === "partial") return "warning";
  if (normalized === "risk") return "danger";
  return "secondary";
}

// Helper function to map compliance status to PremiumStatusBadge variant
function getComplianceStatusVariant(status?: string): "success" | "warning" | "danger" | "secondary" | "info" {
  if (!status) return "secondary";
  const normalized = status.toLowerCase();
  if (normalized === "compliant") return "success";
  if (normalized === "partial") return "warning";
  if (normalized === "non-compliant") return "danger";
  return "secondary";
}

export default function SecurityPage() {
  const { user } = useAuth();
  const [rows, setRows] = React.useState<SecurityRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  // Search and filters
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [sortField, setSortField] = React.useState<string>("server_code");
  const [sortDirection, setSortDirection] = React.useState<"asc" | "desc">("asc");

  // Column visibility
  const [visibleColumns, setVisibleColumns] = React.useState({
    server: true,
    os: true,
    hardening_status: true,
    ssh_key_only: true,
    antivirus: true,
    backup: true,
    compliance: true,
    last_scan: true,
  });

  const [page, setPage] = React.useState(1);
  const pageSize = 15;

  const canRead = can(user, "security.read");
  const canUpdate = can(user, "security.update");

  // Detail drawer
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [selectedRow, setSelectedRow] = React.useState<SecurityRow | null>(null);

  // Edit dialog
  const [editOpen, setEditOpen] = React.useState(false);
  const [editRow, setEditRow] = React.useState<SecurityRow | null>(null);

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
    if (!canRead) {
      setRows([]);
      setLoadError("You don't have permission to view security data.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setLoadError(null);
      const res = await api.get("/api/security", { headers: { "x-sam-silent": "1" } });
      setRows((res.data?.data ?? []) as SecurityRow[]);
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.message || "Failed to load security data";
      setLoadError(msg);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [canRead]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const openDetail = React.useCallback((row: SecurityRow) => {
    setSelectedRow(row);
    setDetailOpen(true);
  }, []);

  const openEdit = React.useCallback(
    (row: SecurityRow) => {
      setEditRow(row);
      reset({
        os: row.os || "",
        os_version: row.os_version || "",
        hardening_status: (row.hardening_status as any) || undefined,
        ssh_key_only: row.ssh_key_only ?? false,
        antivirus_installed: row.antivirus_installed ?? false,
        backup_enabled: row.backup_enabled ?? false,
        compliance_status: (row.compliance_status as any) || undefined,
      });
      setEditOpen(true);
    },
    [reset]
  );

  const onSubmit = React.useCallback(
    async (values: FormValues) => {
      if (!editRow) return;

      try {
        await api.patch(`/api/security/${editRow.security_id}`, values, {
          headers: { "x-sam-silent": "1" },
        });
        toast.success("Security updated");
        setEditOpen(false);
        await load();
      } catch (err: any) {
        const msg = err?.response?.data?.error?.message || err?.message || "Failed to update security";
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
        const os = (r.os ?? "").toLowerCase();
        return code.includes(q) || hostname.includes(q) || os.includes(q);
      });
    }

    // Status filter
    if (statusFilter && statusFilter !== "all") {
      result = result.filter((r) => r.hardening_status === statusFilter);
    }

    // Sort
    result.sort((a, b) => {
      let aVal: any = a[sortField as keyof SecurityRow];
      let bVal: any = b[sortField as keyof SecurityRow];

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
      "OS",
      "Hardening Status",
      "SSH Key Only",
      "Antivirus",
      "Backup",
      "Compliance",
    ];
    const data = filteredRows.map((r) => [
      r.server_code ?? "",
      r.hostname ?? "",
      r.os ?? "",
      r.hardening_status ?? "",
      r.ssh_key_only ? "Yes" : "No",
      r.antivirus_installed ? "Yes" : "No",
      r.backup_enabled ? "Yes" : "No",
      r.compliance_status ?? "",
    ]);
    const csv = buildCsv(headers, data);
    downloadCsv(csv, `security-export-${new Date().toISOString().split("T")[0]}.csv`);
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
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Security & Compliance</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Server security posture, hardening status, and compliance monitoring
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
                  checked={visibleColumns.server}
                  onCheckedChange={(checked) =>
                    setVisibleColumns((prev) => ({ ...prev, server: checked }))
                  }
                >
                  Server
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={visibleColumns.os}
                  onCheckedChange={(checked) =>
                    setVisibleColumns((prev) => ({ ...prev, os: checked }))
                  }
                >
                  OS
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={visibleColumns.hardening_status}
                  onCheckedChange={(checked) =>
                    setVisibleColumns((prev) => ({ ...prev, hardening_status: checked }))
                  }
                >
                  Hardening Status
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={visibleColumns.ssh_key_only}
                  onCheckedChange={(checked) =>
                    setVisibleColumns((prev) => ({ ...prev, ssh_key_only: checked }))
                  }
                >
                  SSH Key Only
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={visibleColumns.antivirus}
                  onCheckedChange={(checked) =>
                    setVisibleColumns((prev) => ({ ...prev, antivirus: checked }))
                  }
                >
                  Antivirus
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={visibleColumns.backup}
                  onCheckedChange={(checked) =>
                    setVisibleColumns((prev) => ({ ...prev, backup: checked }))
                  }
                >
                  Backup
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={visibleColumns.compliance}
                  onCheckedChange={(checked) =>
                    setVisibleColumns((prev) => ({ ...prev, compliance: checked }))
                  }
                >
                  Compliance
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={visibleColumns.last_scan}
                  onCheckedChange={(checked) =>
                    setVisibleColumns((prev) => ({ ...prev, last_scan: checked }))
                  }
                >
                  Last Scan
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
                placeholder="Search by server code, hostname, or OS..."
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
                <Button variant="outline" size="sm" className="min-w-35 justify-between">
                  <span>{statusFilter === "all" ? "All Status" : statusFilter}</span>
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setStatusFilter("all")}>
                  All Status
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setStatusFilter("Secure")}>
                  <ShieldCheck className="mr-2 h-4 w-4 text-emerald-600" /> Secure
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("Partial")}>
                  <ShieldAlert className="mr-2 h-4 w-4 text-amber-600" /> Partial
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("Risk")}>
                  <AlertTriangle className="mr-2 h-4 w-4 text-rose-600" /> Risk
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
              {visibleColumns.server && (
                <PremiumTableHead
                  sortable
                  sortDirection={sortField === "server_code" ? sortDirection : null}
                  onSort={() => toggleSort("server_code")}
                >
                  Server
                </PremiumTableHead>
              )}
              {visibleColumns.os && (
                <PremiumTableHead>OS</PremiumTableHead>
              )}
              {visibleColumns.hardening_status && (
                <PremiumTableHead
                  sortable
                  sortDirection={sortField === "hardening_status" ? sortDirection : null}
                  onSort={() => toggleSort("hardening_status")}
                >
                  Hardening Status
                </PremiumTableHead>
              )}
              {visibleColumns.ssh_key_only && (
                <PremiumTableHead>
                  <div className="flex items-center gap-1">
                    <Key className="h-3.5 w-3.5" />
                    SSH Key Only
                  </div>
                </PremiumTableHead>
              )}
              {visibleColumns.antivirus && (
                <PremiumTableHead>Antivirus</PremiumTableHead>
              )}
              {visibleColumns.backup && (
                <PremiumTableHead>Backup</PremiumTableHead>
              )}
              {visibleColumns.compliance && (
                <PremiumTableHead>Compliance</PremiumTableHead>
              )}
              {visibleColumns.last_scan && (
                <PremiumTableHead>Last Scan</PremiumTableHead>
              )}
              <PremiumTableHead className="w-30 text-center">Actions</PremiumTableHead>
            </tr>
          </PremiumTableHeader>
          <PremiumTableBody>
            {loading ? (
              <PremiumTableSkeleton rows={5} cols={9} />
            ) : loadError ? (
              <tr>
                <td colSpan={100} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <AlertTriangle className="h-12 w-12 text-slate-400" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Unable to load security data</p>
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
                  <PremiumTableRow key={row.security_id} onClick={() => openDetail(row)}>
                    {visibleColumns.server && (
                      <PremiumTableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Server className="h-4 w-4 text-slate-400" />
                            <span className="font-semibold">{row.server_code || "—"}</span>
                          </div>
                          {row.hostname && (
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              {row.hostname}
                            </div>
                          )}
                        </div>
                      </PremiumTableCell>
                    )}
                    {visibleColumns.os && (
                      <PremiumTableCell>
                        <div className="space-y-1">
                          <div className="font-medium">{row.os || "—"}</div>
                          {row.os_version && (
                            <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                              {row.os_version}
                            </div>
                          )}
                        </div>
                      </PremiumTableCell>
                    )}
                    {visibleColumns.hardening_status && (
                      <PremiumTableCell>
                        <PremiumStatusBadge variant={getHardeningStatusVariant(row.hardening_status)}>
                          {row.hardening_status || "Unknown"}
                        </PremiumStatusBadge>
                      </PremiumTableCell>
                    )}
                    {visibleColumns.ssh_key_only && (
                      <PremiumTableCell>
                        {row.ssh_key_only === undefined || row.ssh_key_only === null ? (
                          <span className="text-xs text-slate-400">—</span>
                        ) : row.ssh_key_only ? (
                          <PremiumStatusBadge variant="success">Yes</PremiumStatusBadge>
                        ) : (
                          <PremiumStatusBadge variant="secondary">No</PremiumStatusBadge>
                        )}
                      </PremiumTableCell>
                    )}
                    {visibleColumns.antivirus && (
                      <PremiumTableCell>
                        {row.antivirus_installed === undefined || row.antivirus_installed === null ? (
                          <span className="text-xs text-slate-400">—</span>
                        ) : row.antivirus_installed ? (
                          <PremiumStatusBadge variant="success">Installed</PremiumStatusBadge>
                        ) : (
                          <PremiumStatusBadge variant="secondary">Not Installed</PremiumStatusBadge>
                        )}
                      </PremiumTableCell>
                    )}
                    {visibleColumns.backup && (
                      <PremiumTableCell>
                        {row.backup_enabled === undefined || row.backup_enabled === null ? (
                          <span className="text-xs text-slate-400">—</span>
                        ) : row.backup_enabled ? (
                          <PremiumStatusBadge variant="success">Enabled</PremiumStatusBadge>
                        ) : (
                          <PremiumStatusBadge variant="secondary">Disabled</PremiumStatusBadge>
                        )}
                      </PremiumTableCell>
                    )}
                    {visibleColumns.compliance && (
                      <PremiumTableCell>
                        <PremiumStatusBadge variant={getComplianceStatusVariant(row.compliance_status)}>
                          {row.compliance_status || "Unknown"}
                        </PremiumStatusBadge>
                      </PremiumTableCell>
                    )}
                    {visibleColumns.last_scan && (
                      <PremiumTableCell>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {row.last_security_scan
                            ? new Date(row.last_security_scan).toLocaleDateString()
                            : "—"}
                        </span>
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
                            tooltip="Update security"
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
                icon={<Shield className="h-12 w-12 text-slate-400" />}
                title="No security data"
                description={
                  searchQuery || statusFilter !== "all"
                    ? "Try adjusting your search or filters"
                    : "No security records are available"
                }
              />
            )}
          </PremiumTableBody>
        </PremiumTable>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t pt-4">
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
              <div className="text-sm text-slate-500 dark:text-slate-400">
                Page <span className="font-medium text-slate-900 dark:text-slate-100">{safePage}</span> / {totalPages}
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
          <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Security Details</SheetTitle>
            </SheetHeader>

            {selectedRow && (
              <div className="mt-6 space-y-6">
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

                {/* OS Info */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground">
                    Operating System
                  </h3>
                  <div className="space-y-2 rounded-lg border p-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">OS</span>
                      <span className="font-medium">{selectedRow.os || "—"}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Version</span>
                      <span className="font-mono font-medium text-xs">
                        {selectedRow.os_version || "—"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Security Status */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground">
                    Security Status
                  </h3>
                  <div className="space-y-2 rounded-lg border p-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Hardening Status</span>
                      <PremiumStatusBadge variant={getHardeningStatusVariant(selectedRow.hardening_status)}>
                        {selectedRow.hardening_status || "Unknown"}
                      </PremiumStatusBadge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">SSH Key Only</span>
                      {selectedRow.ssh_key_only === undefined || selectedRow.ssh_key_only === null ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : selectedRow.ssh_key_only ? (
                        <PremiumStatusBadge variant="success">Yes</PremiumStatusBadge>
                      ) : (
                        <PremiumStatusBadge variant="secondary">No</PremiumStatusBadge>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Antivirus</span>
                      {selectedRow.antivirus_installed === undefined || selectedRow.antivirus_installed === null ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : selectedRow.antivirus_installed ? (
                        <PremiumStatusBadge variant="success">Installed</PremiumStatusBadge>
                      ) : (
                        <PremiumStatusBadge variant="secondary">Not Installed</PremiumStatusBadge>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Backup</span>
                      {selectedRow.backup_enabled === undefined || selectedRow.backup_enabled === null ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : selectedRow.backup_enabled ? (
                        <PremiumStatusBadge variant="success">Enabled</PremiumStatusBadge>
                      ) : (
                        <PremiumStatusBadge variant="secondary">Disabled</PremiumStatusBadge>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Compliance</span>
                      <PremiumStatusBadge variant={getComplianceStatusVariant(selectedRow.compliance_status)}>
                        {selectedRow.compliance_status || "Unknown"}
                      </PremiumStatusBadge>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Last Scan</span>
                      <span className="font-medium text-xs">
                        {selectedRow.last_security_scan
                          ? new Date(selectedRow.last_security_scan).toLocaleString()
                          : "—"}
                      </span>
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
                      Update Security
                    </Button>
                  </div>
                )}
              </div>
            )}
          </SheetContent>
        </Sheet>

        {/* Edit Dialog */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="sm:max-w-125 max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Update Security</DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* OS Info */}
              <div className="space-y-4">
                <div className="text-sm font-medium text-muted-foreground">Operating System</div>
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="os">OS</Label>
                    <Input id="os" placeholder="e.g. Ubuntu, CentOS" {...register("os")} />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="os_version">Version</Label>
                    <Input id="os_version" placeholder="e.g. 22.04" {...register("os_version")} />
                  </div>
                </div>
              </div>

              {/* Security Status */}
              <div className="space-y-4">
                <div className="text-sm font-medium text-muted-foreground">Security Status</div>
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="hardening_status">Hardening Status</Label>
                    <select
                      id="hardening_status"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      {...register("hardening_status")}
                    >
                      <option value="">Select status</option>
                      <option value="Secure">Secure</option>
                      <option value="Partial">Partial</option>
                      <option value="Risk">Risk</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="ssh_key_only"
                      className="h-4 w-4 rounded border-gray-300"
                      {...register("ssh_key_only")}
                    />
                    <Label htmlFor="ssh_key_only" className="cursor-pointer">
                      SSH Key Only (Password auth disabled)
                    </Label>
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="antivirus_installed"
                      className="h-4 w-4 rounded border-gray-300"
                      {...register("antivirus_installed")}
                    />
                    <Label htmlFor="antivirus_installed" className="cursor-pointer">
                      Antivirus Installed
                    </Label>
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="backup_enabled"
                      className="h-4 w-4 rounded border-gray-300"
                      {...register("backup_enabled")}
                    />
                    <Label htmlFor="backup_enabled" className="cursor-pointer">
                      Backup Enabled
                    </Label>
                  </div>
                </div>
              </div>

              {/* Compliance */}
              <div className="space-y-4">
                <div className="text-sm font-medium text-muted-foreground">Compliance</div>
                <div className="grid gap-2">
                  <Label htmlFor="compliance_status">Compliance Status</Label>
                  <select
                    id="compliance_status"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    {...register("compliance_status")}
                  >
                    <option value="">Select status</option>
                    <option value="Compliant">Compliant</option>
                    <option value="Partial">Partial</option>
                    <option value="Non-Compliant">Non-Compliant</option>
                  </select>
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
                  {isSubmitting ? "Updating..." : "Update"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </FadeIn>
  );
}
