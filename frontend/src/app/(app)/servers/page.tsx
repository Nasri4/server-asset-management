"use client";

import * as React from "react";
import Link from "next/link";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ChevronDown,
  Download,
  Eye,
  Filter,
  MoreVertical,
  Pencil,
  Plus,
  Server as ServerIcon,
  Settings,
  ShieldAlert,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { FadeIn } from "@/components/motion/fade-in";
import { EmptyState } from "@/components/data/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  PremiumTable,
  PremiumTableHeader,
  PremiumTableHead,
  PremiumTableBody,
  PremiumTableRow,
  PremiumTableCell,
  PremiumActionButton,
} from "@/components/tables/premium-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { api } from "@/lib/api/client";
import type { ServerListItem } from "@/lib/api/types";
import { useAuth } from "@/components/auth/auth-provider";
import { can } from "@/lib/rbac";
import { EditServerDialog } from "./[id]/ui/edit-server-dialog";

function normalize(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function getStatusVariant(status: unknown): "success" | "warning" | "danger" | "neutral" {
  const v = normalize(status);
  if (["active", "up", "online", "running", "ok", "healthy"].includes(v)) return "success";
  if (["maintenance", "degraded", "warning"].includes(v)) return "warning";
  if (["offline", "down", "critical", "failed"].includes(v)) return "danger";
  return "neutral";
}

function getStatusBadgeClass(status: unknown) {
  const variant = getStatusVariant(status);
  
  if (variant === "success") {
    return "bg-green-100 text-green-700";
  }
  
  if (variant === "warning") {
    return "bg-yellow-100 text-yellow-700";
  }
  
  if (variant === "danger") {
    return "bg-red-100 text-red-700";
  }
  
  return "bg-gray-100 text-gray-700";
}

function EnvironmentBadge({ environment }: { environment: unknown }) {
  const env = normalize(environment);
  let className = "bg-gray-200 text-gray-800";

  if (env.includes("prod")) {
    className = "bg-red-200 text-red-800";
  } else if (env.includes("dev") || env.includes("test") || env.includes("qa")) {
    className = "bg-blue-200 text-blue-800";
  } else if (env.includes("eng") || env.includes("stage")) {
    className = "bg-purple-200 text-purple-800";
  }

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${className}`}>
      {String(environment || "Unknown")}
    </span>
  );
}

export default function ServersPage() {
  const { user } = useAuth();
  const canCreate = can(user, "servers.create");
  const canUpdate = can(user, "servers.update");
  const canDelete = can(user, "servers.delete");
  const canManageSecurity = can(user, "security.manage");

  const mountedRef = React.useRef(false);
  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const [rows, setRows] = React.useState<ServerListItem[]>([]);
  const [loading, setLoading] = React.useState(true);

  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [environmentFilter, setEnvironmentFilter] = React.useState<string>("all");
  const [sortField, setSortField] = React.useState<string>("server_code");
  const [sortDirection, setSortDirection] = React.useState<"asc" | "desc">("asc");

  const [visibleColumns, setVisibleColumns] = React.useState({
    serverCode: true,
    hostname: true,
    role: true,
    environment: true,
    location: true,
    team: true,
    status: true,
  });

  const [page, setPage] = React.useState(1);
  const pageSize = 15;

  const [deleteTarget, setDeleteTarget] = React.useState<ServerListItem | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const [editTarget, setEditTarget] = React.useState<ServerListItem | null>(null);

  const loadServers = React.useCallback(async () => {
    try {
      setLoading(true);
      const serversRes = await api.get("/api/servers");
      setRows(serversRes.data?.data || []);
    } catch (error) {
      toast.error("Failed to load servers");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadServers();
  }, [loadServers]);

  const filteredRows = React.useMemo(() => {
    let result = [...rows];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.server_code?.toLowerCase().includes(query) ||
          s.hostname?.toLowerCase().includes(query) ||
          s.team_name?.toLowerCase().includes(query) ||
          s.role?.toLowerCase().includes(query)
      );
    }

    if (statusFilter && statusFilter !== "all") {
      result = result.filter((s) => getStatusVariant(s.status) === statusFilter);
    }

    if (environmentFilter && environmentFilter !== "all") {
      result = result.filter((s) => normalize(s.environment).includes(environmentFilter.toLowerCase()));
    }

    result.sort((a, b) => {
      let aVal = a[sortField as keyof ServerListItem] ?? "";
      let bVal = b[sortField as keyof ServerListItem] ?? "";

      if (typeof aVal === "string") aVal = aVal.toLowerCase();
      if (typeof bVal === "string") bVal = bVal.toLowerCase();

      return aVal < bVal ? (sortDirection === "asc" ? -1 : 1) : aVal > bVal ? (sortDirection === "asc" ? 1 : -1) : 0;
    });

    return result;
  }, [rows, searchQuery, statusFilter, environmentFilter, sortField, sortDirection]);

  const total = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedRows = filteredRows.slice((safePage - 1) * pageSize, safePage * pageSize);

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
      <div className="space-y-6 p-6 bg-gray-50">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-800">Server Inventory</h1>
            <p className="mt-1 text-sm text-gray-500">Manage your infrastructure assets</p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => { /* export functionality */ }}>
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>

            {canCreate && (
              <Button size="sm" variant="gradient" asChild>
                <Link href="/servers/new" className="flex items-center">
                  <Plus className="mr-2 h-4 w-4" />
                  Register
                </Link>
              </Button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 mb-4">
          <Input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search servers..."
            className="flex-1"
          />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                {statusFilter === "all" ? "All Status" : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}
                <ChevronDown className="ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setStatusFilter("all")}>All Status</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter("success")}>Active</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter("warning")}>Maintenance</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter("danger")}>Offline</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Column visibility toggle */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
              <DropdownMenuCheckboxItem checked={visibleColumns.serverCode} onCheckedChange={() => setVisibleColumns((prev) => ({ ...prev, serverCode: !prev.serverCode }))}>
                Server Code
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={visibleColumns.hostname} onCheckedChange={() => setVisibleColumns((prev) => ({ ...prev, hostname: !prev.hostname }))}>
                Hostname
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={visibleColumns.role} onCheckedChange={() => setVisibleColumns((prev) => ({ ...prev, role: !prev.role }))}>
                Role
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={visibleColumns.environment} onCheckedChange={() => setVisibleColumns((prev) => ({ ...prev, environment: !prev.environment }))}>
                Environment
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={visibleColumns.location} onCheckedChange={() => setVisibleColumns((prev) => ({ ...prev, location: !prev.location }))}>
                Location
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={visibleColumns.team} onCheckedChange={() => setVisibleColumns((prev) => ({ ...prev, team: !prev.team }))}>
                Team
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={visibleColumns.status} onCheckedChange={() => setVisibleColumns((prev) => ({ ...prev, status: !prev.status }))}>
                Status
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Results Count */}
        <div className="text-sm text-gray-500">
          {total} {total === 1 ? "server" : "servers"} found
        </div>

        {loading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : total > 0 ? (
          <PremiumTable>
            <PremiumTableHeader>
              <tr>
                {visibleColumns.serverCode && (
                  <PremiumTableHead sortable onSort={() => toggleSort("server_code")}>
                    Server Code
                  </PremiumTableHead>
                )}
                {visibleColumns.hostname && (
                  <PremiumTableHead sortable onSort={() => toggleSort("hostname")}>
                    Hostname
                  </PremiumTableHead>
                )}
                {visibleColumns.role && <PremiumTableHead>Role</PremiumTableHead>}
                {visibleColumns.environment && <PremiumTableHead>Environment</PremiumTableHead>}
                {visibleColumns.status && (
                  <PremiumTableHead sortable onSort={() => toggleSort("status")}>
                    Status
                  </PremiumTableHead>
                )}
                {visibleColumns.location && <PremiumTableHead>Location</PremiumTableHead>}
                {visibleColumns.team && <PremiumTableHead>Team</PremiumTableHead>}
                <PremiumTableHead className="text-center">Actions</PremiumTableHead>
              </tr>
            </PremiumTableHeader>

            <PremiumTableBody>
              {pagedRows.map((server) => (
                <PremiumTableRow key={server.server_id}>
                  {visibleColumns.serverCode && (
                    <PremiumTableCell>
                      <Link href={`/servers/${server.server_id}`} className="font-medium text-gray-800 hover:text-blue-600">
                        {server.server_code}
                      </Link>
                    </PremiumTableCell>
                  )}
                  {visibleColumns.hostname && (
                    <PremiumTableCell>
                      <div className="flex items-center gap-2">
                        <ServerIcon className="h-4 w-4 text-gray-500" />
                        <span>{server.hostname || "—"}</span>
                      </div>
                    </PremiumTableCell>
                  )}
                  {visibleColumns.role && <PremiumTableCell>{server.role || "—"}</PremiumTableCell>}
                  {visibleColumns.environment && <PremiumTableCell><EnvironmentBadge environment={server.environment} /></PremiumTableCell>}
                  {visibleColumns.status && (
                    <PremiumTableCell>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${getStatusBadgeClass(server.status)}`}>
                        {server.status}
                      </span>
                    </PremiumTableCell>
                  )}
                  {visibleColumns.location && <PremiumTableCell>{server.site_name || "—"}</PremiumTableCell>}
                  {visibleColumns.team && <PremiumTableCell>{server.team_name || "—"}</PremiumTableCell>}
                  <PremiumTableCell>
                    <div className="flex items-center justify-center gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Link href={`/servers/${server.server_id}`}>
                            <PremiumActionButton variant="view" icon={<Eye className="h-4 w-4" />} />
                          </Link>
                        </TooltipTrigger>
                        <TooltipContent>View details</TooltipContent>
                      </Tooltip>

                      {canUpdate && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <PremiumActionButton 
                              variant="edit" 
                              icon={<Pencil className="h-4 w-4" />}
                              onClick={() => setEditTarget(server)}
                            />
                          </TooltipTrigger>
                          <TooltipContent>Edit server</TooltipContent>
                        </Tooltip>
                      )}

                      {canDelete && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <PremiumActionButton 
                              variant="default" 
                              icon={<MoreVertical className="h-4 w-4" />}
                              onClick={() => setDeleteTarget(server)}
                            />
                          </TooltipTrigger>
                          <TooltipContent>More actions</TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </PremiumTableCell>
                </PremiumTableRow>
              ))}
            </PremiumTableBody>
          </PremiumTable>
        ) : (
          <div className="p-12">
            <EmptyState
              icon={<ServerIcon className="h-5 w-5 text-gray-400" />}
              title="No servers found"
              description={searchQuery ? "Try adjusting your search" : "Get started by registering your first server"}
              action={
                canCreate ? (
                  <Button asChild>
                    <Link href="/servers/new">
                      <Plus className="h-4 w-4 mr-2" /> Register Server
                    </Link>
                  </Button>
                ) : undefined
              }
            />
          </div>
        )}

        {/* Pagination Controls */}
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-500">
            Showing {total ? ((safePage - 1) * pageSize + 1) : 0} to {Math.min(total, safePage * pageSize)} of {total} servers
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage <= 1}>
              Previous
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages}>
              Next
            </Button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Server</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete server <span className="font-semibold">{deleteTarget?.server_code}</span>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (!deleteTarget) return;
                try {
                  setDeleting(true);
                  await api.delete(`/api/servers/${deleteTarget.server_id}`);
                  setRows((prev) => prev.filter((x) => x.server_id !== deleteTarget.server_id));
                  toast.success("Server deleted successfully");
                  setDeleteTarget(null);
                } catch (e: any) {
                  toast.error(e?.response?.data?.error?.message ?? "Failed to delete server");
                } finally {
                  setDeleting(false);
                }
              }}
            >
              {deleting ? "Deleting…" : "Delete Server"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Server Dialog */}
      {editTarget && (
        <EditServerDialog
          server={editTarget}
          open={!!editTarget}
          onOpenChange={(open) => {
            if (!open) setEditTarget(null);
          }}
          onUpdated={loadServers}
        />
      )}
    </FadeIn>
  );
}
