"use client";

import * as React from "react";
import {
  AlertTriangle,
  Calendar,
  ChevronDown,
  Download,
  Eye,
  FileText,
  Filter,
  Search,
  Settings,
  Shield,
  User,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { FadeIn } from "@/components/motion/fade-in";
import { EmptyState } from "@/components/data/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { buildCsv, downloadCsv } from "@/lib/utils/csv";

type AuditRow = {
  audit_id: number;
  actor?: string;
  action?: string;
  entity?: string;
  entity_id?: number;
  details?: string;
  ip_address?: string;
  user_agent?: string;
  created_at?: string;
};

// Action Badge
function ActionBadge({ action }: { action?: string }) {
  const config: Record<string, { color: string; bg: string; border: string }> = {
    CREATE: {
      color: "text-emerald-600",
      bg: "bg-emerald-50 dark:bg-emerald-900/30",
      border: "border-emerald-200 dark:border-emerald-800",
    },
    UPDATE: {
      color: "text-blue-600",
      bg: "bg-blue-50 dark:bg-blue-900/30",
      border: "border-blue-200 dark:border-blue-800",
    },
    DELETE: {
      color: "text-rose-600",
      bg: "bg-rose-50 dark:bg-rose-900/30",
      border: "border-rose-200 dark:border-rose-800",
    },
    LOGIN: {
      color: "text-purple-600",
      bg: "bg-purple-50 dark:bg-purple-900/30",
      border: "border-purple-200 dark:border-purple-800",
    },
    LOGOUT: {
      color: "text-slate-600",
      bg: "bg-slate-50 dark:bg-slate-800/50",
      border: "border-slate-200 dark:border-slate-700",
    },
  };

  if (!action) return <span className="text-muted-foreground">—</span>;

  const cfg = config[action.toUpperCase()] || {
    color: "text-slate-600",
    bg: "bg-slate-50 dark:bg-slate-800/50",
    border: "border-slate-200 dark:border-slate-700",
  };

  return (
    <span
      className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.color} ${cfg.border}`}
    >
      {action.toUpperCase()}
    </span>
  );
}

// Entity Badge
function EntityBadge({ entity }: { entity?: string }) {
  if (!entity) return <span className="text-muted-foreground">—</span>;

  return (
    <span className="inline-flex items-center rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-2.5 py-0.5 text-xs font-medium text-slate-600">
      {entity}
    </span>
  );
}

export default function AuditPage() {
  const { user } = useAuth();
  const [rows, setRows] = React.useState<AuditRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  // Search and filters
  const [searchQuery, setSearchQuery] = React.useState("");
  const [actionFilter, setActionFilter] = React.useState<string>("all");
  const [entityFilter, setEntityFilter] = React.useState<string>("all");
  const [sortField, setSortField] = React.useState<string>("created_at");
  const [sortDirection, setSortDirection] = React.useState<"asc" | "desc">("desc");

  // Column visibility
  const [visibleColumns, setVisibleColumns] = React.useState({
    timestamp: true,
    actor: true,
    action: true,
    entity: true,
    entity_id: true,
    details: true,
  });

  const [page, setPage] = React.useState(1);
  const pageSize = 20;

  // Detail drawer
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [selectedRow, setSelectedRow] = React.useState<AuditRow | null>(null);

  const load = React.useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const res = await api.get("/api/audit", { headers: { "x-sam-silent": "1" } });
      setRows((res.data?.data ?? []) as AuditRow[]);
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.message || "Failed to load audit logs";
      setLoadError(msg);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const openDetail = React.useCallback((row: AuditRow) => {
    setSelectedRow(row);
    setDetailOpen(true);
  }, []);

  // Get unique actions and entities for filters
  const uniqueActions = React.useMemo(() => {
    const actions = new Set<string>();
    rows.forEach((r) => {
      if (r.action) actions.add(r.action.toUpperCase());
    });
    return Array.from(actions).sort();
  }, [rows]);

  const uniqueEntities = React.useMemo(() => {
    const entities = new Set<string>();
    rows.forEach((r) => {
      if (r.entity) entities.add(r.entity);
    });
    return Array.from(entities).sort();
  }, [rows]);

  // Filter and sort
  const filteredRows = React.useMemo(() => {
    let result = [...rows];

    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((r) => {
        const actor = (r.actor ?? "").toLowerCase();
        const action = (r.action ?? "").toLowerCase();
        const entity = (r.entity ?? "").toLowerCase();
        const details = (r.details ?? "").toLowerCase();
        return actor.includes(q) || action.includes(q) || entity.includes(q) || details.includes(q);
      });
    }

    // Action filter
    if (actionFilter && actionFilter !== "all") {
      result = result.filter((r) => r.action?.toUpperCase() === actionFilter);
    }

    // Entity filter
    if (entityFilter && entityFilter !== "all") {
      result = result.filter((r) => r.entity === entityFilter);
    }

    // Sort
    result.sort((a, b) => {
      let aVal: any = a[sortField as keyof AuditRow];
      let bVal: any = b[sortField as keyof AuditRow];

      if (aVal == null) aVal = "";
      if (bVal == null) bVal = "";

      if (typeof aVal === "string") aVal = aVal.toLowerCase();
      if (typeof bVal === "string") bVal = bVal.toLowerCase();

      return sortDirection === "asc" ? (aVal > bVal ? 1 : -1) : aVal < bVal ? 1 : -1;
    });

    return result;
  }, [rows, searchQuery, actionFilter, entityFilter, sortField, sortDirection]);

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
  }, [searchQuery, actionFilter, entityFilter]);

  const exportCsv = React.useCallback(() => {
    const headers = [
      "Timestamp",
      "Actor",
      "Action",
      "Entity",
      "Entity ID",
      "Details",
      "IP Address",
    ];
    const data = filteredRows.map((r) => [
      r.created_at ? new Date(r.created_at).toLocaleString() : "",
      r.actor ?? "",
      r.action ?? "",
      r.entity ?? "",
      r.entity_id?.toString() ?? "",
      r.details ?? "",
      r.ip_address ?? "",
    ]);
    // Fix: buildCsv expects array of objects, not array of arrays
    // We need to transform data to array of objects where keys are headers
    const dataObjects = filteredRows.map((r) => ({
      "Timestamp": r.created_at ? new Date(r.created_at).toLocaleString() : "",
      "Actor": r.actor ?? "",
      "Action": r.action ?? "",
      "Entity": r.entity ?? "",
      "Entity ID": r.entity_id?.toString() ?? "",
      "Details": r.details ?? "",
      "IP Address": r.ip_address ?? "",
    }));
    const csv = buildCsv(headers, dataObjects);
    downloadCsv(csv, `audit-log-export-${new Date().toISOString().split("T")[0]}.csv`);
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

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return null;
    return (
      <ChevronDown
        className={`ml-1 inline h-4 w-4 transition-transform ${sortDirection === "desc" ? "rotate-180" : ""}`}
      />
    );
  };

  return (
    <FadeIn>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Audit Log</h1>
            <p className="mt-1.5 text-sm text-muted-foreground max-w-2xl">
              System activity and security audit trail for compliance monitoring
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

        {/* Main Table Card */}
        <Card>
          <CardHeader className="border-b bg-muted/20">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Activity Log</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  {total} {total === 1 ? "entry" : "entries"} recorded
                </p>
              </div>

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
                      checked={visibleColumns.timestamp}
                      onCheckedChange={(checked) =>
                        setVisibleColumns((prev) => ({ ...prev, timestamp: checked }))
                      }
                    >
                      Timestamp
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={visibleColumns.actor}
                      onCheckedChange={(checked) =>
                        setVisibleColumns((prev) => ({ ...prev, actor: checked }))
                      }
                    >
                      Actor
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={visibleColumns.action}
                      onCheckedChange={(checked) =>
                        setVisibleColumns((prev) => ({ ...prev, action: checked }))
                      }
                    >
                      Action
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={visibleColumns.entity}
                      onCheckedChange={(checked) =>
                        setVisibleColumns((prev) => ({ ...prev, entity: checked }))
                      }
                    >
                      Entity
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={visibleColumns.entity_id}
                      onCheckedChange={(checked) =>
                        setVisibleColumns((prev) => ({ ...prev, entity_id: checked }))
                      }
                    >
                      Entity ID
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={visibleColumns.details}
                      onCheckedChange={(checked) =>
                        setVisibleColumns((prev) => ({ ...prev, details: checked }))
                      }
                    >
                      Details
                    </DropdownMenuCheckboxItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Search and Filters */}
            <div className="mt-4 space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search by actor, action, entity, or details..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>

                <div className="flex gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="min-w-[130px] justify-between">
                        <span>{actionFilter === "all" ? "All Actions" : actionFilter}</span>
                        <ChevronDown className="h-4 w-4 opacity-50" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setActionFilter("all")}>
                        All Actions
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {uniqueActions.map((action) => (
                        <DropdownMenuItem key={action} onClick={() => setActionFilter(action)}>
                          <ActionBadge action={action} />
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="min-w-[130px] justify-between">
                        <span>{entityFilter === "all" ? "All Entities" : entityFilter}</span>
                        <ChevronDown className="h-4 w-4 opacity-50" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setEntityFilter("all")}>
                        All Entities
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {uniqueEntities.map((entity) => (
                        <DropdownMenuItem key={entity} onClick={() => setEntityFilter(entity)}>
                          {entity}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Active Filters Display */}
              {(searchQuery || actionFilter !== "all" || entityFilter !== "all") && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">Active filters:</span>
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
                  {actionFilter !== "all" && (
                    <Badge variant="secondary" className="gap-1">
                      Action: {actionFilter}
                      <button
                        onClick={() => setActionFilter("all")}
                        className="hover:text-foreground"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  )}
                  {entityFilter !== "all" && (
                    <Badge variant="secondary" className="gap-1">
                      Entity: {entityFilter}
                      <button
                        onClick={() => setEntityFilter("all")}
                        className="hover:text-foreground"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  )}
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setActionFilter("all");
                      setEntityFilter("all");
                    }}
                    className="text-xs text-muted-foreground hover:text-foreground underline"
                  >
                    Clear all
                  </button>
                </div>
              )}
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : loadError ? (
              <div className="p-12">
                <EmptyState
                  icon={<AlertTriangle className="h-12 w-12 text-muted-foreground" />}
                  title="Failed to load"
                  description={loadError}
                  action={
                    <Button onClick={load} variant="outline">
                      Retry
                    </Button>
                  }
                />
              </div>
            ) : pagedRows.length === 0 ? (
              <div className="p-12">
                <EmptyState
                  icon={<FileText className="h-12 w-12 text-muted-foreground" />}
                  title="No audit logs"
                  description={
                    searchQuery || actionFilter !== "all" || entityFilter !== "all"
                      ? "Try adjusting your search or filters"
                      : "No audit logs have been recorded"
                  }
                />
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        {visibleColumns.timestamp && (
                          <TableHead>
                            <button
                              onClick={() => toggleSort("created_at")}
                              className="flex items-center font-semibold hover:text-foreground"
                            >
                              Timestamp
                              <SortIcon field="created_at" />
                            </button>
                          </TableHead>
                        )}
                        {visibleColumns.actor && (
                          <TableHead>
                            <button
                              onClick={() => toggleSort("actor")}
                              className="flex items-center font-semibold hover:text-foreground"
                            >
                              Actor
                              <SortIcon field="actor" />
                            </button>
                          </TableHead>
                        )}
                        {visibleColumns.action && (
                          <TableHead>
                            <button
                              onClick={() => toggleSort("action")}
                              className="flex items-center font-semibold hover:text-foreground"
                            >
                              Action
                              <SortIcon field="action" />
                            </button>
                          </TableHead>
                        )}
                        {visibleColumns.entity && (
                          <TableHead>
                            <button
                              onClick={() => toggleSort("entity")}
                              className="flex items-center font-semibold hover:text-foreground"
                            >
                              Entity
                              <SortIcon field="entity" />
                            </button>
                          </TableHead>
                        )}
                        {visibleColumns.entity_id && (
                          <TableHead className="font-semibold">Entity ID</TableHead>
                        )}
                        {visibleColumns.details && (
                          <TableHead className="font-semibold">Details</TableHead>
                        )}
                        <TableHead className="text-right font-semibold">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pagedRows.map((row) => (
                        <TableRow
                          key={row.audit_id}
                          className="group cursor-pointer"
                          onClick={() => openDetail(row)}
                        >
                          {visibleColumns.timestamp && (
                            <TableCell className="text-xs">
                              {row.created_at ? (
                                <div className="space-y-1">
                                  <div className="font-medium">
                                    {new Date(row.created_at).toLocaleDateString()}
                                  </div>
                                  <div className="text-muted-foreground">
                                    {new Date(row.created_at).toLocaleTimeString([], {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                      second: "2-digit",
                                    })}
                                  </div>
                                </div>
                              ) : (
                                "—"
                              )}
                            </TableCell>
                          )}
                          {visibleColumns.actor && (
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <User className="h-3.5 w-3.5 text-muted-foreground" />
                                {row.actor || "—"}
                              </div>
                            </TableCell>
                          )}
                          {visibleColumns.action && (
                            <TableCell>
                              <ActionBadge action={row.action} />
                            </TableCell>
                          )}
                          {visibleColumns.entity && (
                            <TableCell>
                              <EntityBadge entity={row.entity} />
                            </TableCell>
                          )}
                          {visibleColumns.entity_id && (
                            <TableCell className="text-muted-foreground text-sm">
                              {row.entity_id ? `#${row.entity_id}` : "—"}
                            </TableCell>
                          )}
                          {visibleColumns.details && (
                            <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                              {row.details || "—"}
                            </TableCell>
                          )}
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => openDetail(row)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between border-t px-6 py-4">
                    <div className="text-sm text-muted-foreground">
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
              </>
            )}
          </CardContent>
        </Card>

        {/* Detail Drawer */}
        <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
          <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Audit Log Details</SheetTitle>
            </SheetHeader>

            {selectedRow && (
              <div className="mt-6 space-y-6">
                {/* Action & Entity */}
                <div className="flex items-center gap-3">
                  <ActionBadge action={selectedRow.action} />
                  <EntityBadge entity={selectedRow.entity} />
                </div>

                {/* Timestamp */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground">Timestamp</h3>
                  <div className="rounded-lg border p-4">
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      {selectedRow.created_at
                        ? new Date(selectedRow.created_at).toLocaleString()
                        : "—"}
                    </div>
                  </div>
                </div>

                {/* Actor */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground">Actor</h3>
                  <div className="rounded-lg border p-4">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <User className="h-4 w-4 text-muted-foreground" />
                      {selectedRow.actor || "—"}
                    </div>
                  </div>
                </div>

                {/* Entity Info */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground">Target</h3>
                  <div className="space-y-2 rounded-lg border p-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Entity Type</span>
                      <EntityBadge entity={selectedRow.entity} />
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Entity ID</span>
                      <span className="font-medium">
                        {selectedRow.entity_id ? `#${selectedRow.entity_id}` : "—"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Details */}
                {selectedRow.details && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-muted-foreground">Details</h3>
                    <div className="rounded-lg border p-4">
                      <pre className="text-xs whitespace-pre-wrap break-words font-mono">
                        {selectedRow.details}
                      </pre>
                    </div>
                  </div>
                )}

                {/* Technical Info */}
                {(selectedRow.ip_address || selectedRow.user_agent) && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-muted-foreground">
                      Technical Information
                    </h3>
                    <div className="space-y-2 rounded-lg border p-4">
                      {selectedRow.ip_address && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">IP Address</span>
                          <span className="font-mono text-xs">{selectedRow.ip_address}</span>
                        </div>
                      )}
                      {selectedRow.user_agent && (
                        <div className="pt-2 border-t">
                          <div className="text-xs text-muted-foreground mb-1">User Agent</div>
                          <p className="text-xs font-mono break-all">{selectedRow.user_agent}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </FadeIn>
  );
}
