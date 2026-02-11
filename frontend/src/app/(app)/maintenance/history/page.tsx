"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Download, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { FadeIn } from "@/components/motion/fade-in";
import { EmptyState } from "@/components/data/empty-state";
import { SortableTh, TablePagination, TableToolbar, toSearchText, type SortDir } from "@/components/data/table-controls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/layout/page-header";
import { api } from "@/lib/api/client";
import { buildCsv, downloadCsv } from "@/lib/utils/csv";

type MaintenanceFrequency = "Daily" | "Weekly" | "Monthly";

type MaintenanceHistoryRow = {
  maintenance_id: number;
  server_id: number;
  server_code?: string | null;
  hostname?: string | null;
  maintenance_type?: string | null;
  maintenance_frequency?: MaintenanceFrequency | null;
  next_maintenance?: string | null;
  last_maintenance?: string | null;
  status?: string | null;
  completed_at?: string | null;
  assigned_engineers?: string | null;
};

function toYmd(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function getErrorMessage(err: unknown, fallback: string) {
  if (typeof err === "object" && err && "message" in err && typeof (err as any).message === "string") return (err as any).message;
  return fallback;
}

export default function MaintenanceHistoryPage() {
  const [rows, setRows] = React.useState<MaintenanceHistoryRow[]>([]);
  const [loading, setLoading] = React.useState(true);

  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(25);

  const [sortKey, setSortKey] = React.useState<"completed" | "server" | "type" | "next">("completed");
  const [sortDir, setSortDir] = React.useState<SortDir>("desc");

  const load = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get(`/api/maintenance?status=Complete`, { headers: { "x-sam-silent": "1" } });
      setRows((res.data?.data ?? []) as MaintenanceHistoryRow[]);
    } catch (e) {
      toast.error(getErrorMessage(e, "Failed to load maintenance history"));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const exportCsv = React.useCallback(() => {
    const csv = buildCsv(rows, [
      { key: "maintenance_id", label: "Maintenance ID" },
      { key: "server_id", label: "Server ID" },
      { key: "server_code", label: "Server Code" },
      { key: "hostname", label: "Hostname" },
      { key: "maintenance_type", label: "Type" },
      { key: "maintenance_frequency", label: "Frequency" },
      { key: "status", label: "Status" },
      { key: "completed_at", label: "Completed At" },
      { key: "next_maintenance", label: "Next Maintenance" },
      { key: "assigned_engineers", label: "Assigned Engineers" },
    ]);
    downloadCsv(`maintenance-history-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  }, [rows]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      toSearchText(
        r.maintenance_id,
        r.server_id,
        r.server_code,
        r.hostname,
        r.maintenance_type,
        r.maintenance_frequency,
        r.status,
        toYmd(r.completed_at),
        toYmd(r.next_maintenance),
        r.assigned_engineers
      ).includes(q)
    );
  }, [rows, search]);

  const sorted = React.useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    const getValue = (r: MaintenanceHistoryRow) => {
      switch (sortKey) {
        case "server":
          return (r.server_code ?? r.hostname ?? "").toLowerCase();
        case "type":
          return (r.maintenance_type ?? "").toLowerCase();
        case "next":
          return r.next_maintenance ?? "";
        case "completed":
        default:
          return r.completed_at ?? "";
      }
    };

    return [...filtered].sort((a, b) => {
      const av = getValue(a);
      const bv = getValue(b);
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }, [filtered, sortDir, sortKey]);

  const total = sorted.length;
  const safePage = Math.min(Math.max(page, 1), Math.max(1, Math.ceil(total / pageSize)));
  const start = (safePage - 1) * pageSize;
  const paged = sorted.slice(start, start + pageSize);

  const toggleSort = (key: "completed" | "server" | "type" | "next") => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir("asc");
  };

  return (
    <FadeIn>
      <div className="grid gap-6">
        <PageHeader
          title="Maintenance History"
          description="Completed maintenance records (scoped to your assignments unless you’re a manager/admin)."
          actions={
            <>
              <Button asChild variant="outline">
                <Link href="/maintenance">
                  <ArrowLeft className="h-4 w-4" /> Back
                </Link>
              </Button>
              <Button variant="outline" onClick={() => void load()} disabled={loading}>
                <RefreshCw className="h-4 w-4" /> {loading ? "Refreshing…" : "Refresh"}
              </Button>
              <Button variant="outline" onClick={exportCsv} disabled={loading || rows.length === 0}>
                <Download className="h-4 w-4" /> Export CSV
              </Button>
            </>
          }
        />

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Completed</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <TableToolbar
              search={search}
              onSearch={setSearch}
              placeholder="Search server, type, engineer…"
              right={<div className="text-sm text-muted-foreground">{total ? `${total} records` : ""}</div>}
            />

            {loading ? (
              <div className="grid gap-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : total ? (
              <Table containerClassName="rounded-lg border" className="w-full table-auto">
                <TableHeader className="sticky top-0 bg-muted/60">
                  <TableRow>
                    <TableHead>
                      <SortableTh label="Completed" active={sortKey === "completed"} dir={sortDir} onToggle={() => toggleSort("completed")} />
                    </TableHead>
                    <TableHead>
                      <SortableTh label="Server" active={sortKey === "server"} dir={sortDir} onToggle={() => toggleSort("server")} />
                    </TableHead>
                    <TableHead>
                      <SortableTh label="Type" active={sortKey === "type"} dir={sortDir} onToggle={() => toggleSort("type")} />
                    </TableHead>
                    <TableHead className="hidden md:table-cell">Frequency</TableHead>
                    <TableHead>
                      <SortableTh label="Next" active={sortKey === "next"} dir={sortDir} onToggle={() => toggleSort("next")} />
                    </TableHead>
                    <TableHead className="hidden xl:table-cell">Assigned</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paged.map((r) => (
                    <TableRow key={r.maintenance_id} className="hover:bg-muted/40">
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{toYmd(r.completed_at) || "—"}</TableCell>
                      <TableCell className="font-medium whitespace-normal wrap-break-word">
                        {r.server_code ?? `#${r.server_id}`}
                        {r.hostname ? <span className="text-muted-foreground"> · {r.hostname}</span> : null}
                      </TableCell>
                      <TableCell className="text-sm whitespace-normal wrap-break-word">{r.maintenance_type ?? "—"}</TableCell>
                      <TableCell className="hidden md:table-cell">
                        {r.maintenance_frequency ? <Badge variant="secondary">{r.maintenance_frequency}</Badge> : <span className="text-sm text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{toYmd(r.next_maintenance) || "—"}</TableCell>
                      <TableCell className="hidden xl:table-cell text-sm text-muted-foreground whitespace-normal wrap-break-word">
                        {r.assigned_engineers ?? "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={String(r.status).toLowerCase() === "complete" ? "default" : "secondary"}>{r.status ?? "Complete"}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <EmptyState title="No completed maintenance" description="Completed records will appear here after engineers mark maintenance as complete." />
            )}

            {!loading ? (
              <TablePagination
                page={safePage}
                pageSize={pageSize}
                total={total}
                onPageChange={setPage}
                onPageSizeChange={(n) => {
                  setPageSize(n);
                  setPage(1);
                }}
              />
            ) : null}
          </CardContent>
        </Card>
      </div>
    </FadeIn>
  );
}
