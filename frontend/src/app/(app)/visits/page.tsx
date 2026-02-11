"use client";

import * as React from "react";
import { Download, Pencil, RefreshCw, Search, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { requiredText } from "@/lib/validation";

import { FadeIn } from "@/components/motion/fade-in";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
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
import { api } from "@/lib/api/client";
import { useAuth } from "@/components/auth/auth-provider";
import { can } from "@/lib/rbac";
import { ServerSelect } from "@/components/forms/server-select";
import { EngineerSelect } from "@/components/forms/engineer-select";
import { buildCsv, downloadCsv } from "@/lib/utils/csv";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type VisitRow = {
  visit_id: number;
  server_id: number;
  server_code?: string;
  hostname?: string;
  visit_type?: string;
  visit_date?: string;
  engineer_id?: number | null;
  engineer_name?: string | null;
  visit_notes?: string | null;
  created_at?: string;
  updated_at?: string;
};

function getErrorMessage(err: unknown, fallback: string) {
  const maybe = err as {
    response?: { data?: { error?: { message?: string } } };
    message?: string;
  };

  return maybe?.response?.data?.error?.message || maybe?.message || fallback;
}

function toYmd(value: string | null | undefined): string {
  if (!value) return "";
  // Most common: "YYYY-MM-DD" or ISO string "YYYY-MM-DDTHH:mm:ss.sssZ"
  const match = String(value).match(/\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : String(value);
}

async function fetchServerTeamId(serverId: number): Promise<number | undefined> {
  if (!serverId) return undefined;
  const res = await api.get(`/api/servers/${serverId}`, { headers: { "x-sam-silent": "1" } });
  const server = (res.data?.data?.server ?? null) as any;
  const teamId = Number(server?.team_id ?? 0);
  return Number.isFinite(teamId) && teamId > 0 ? teamId : undefined;
}

const VISIT_TYPE_OPTIONS = ["Routine", "Maintenance", "Incident", "Inspection"] as const;

// Helper function to map visit type to PremiumStatusBadge variant
function getVisitTypeVariant(type: string | null | undefined): "success" | "warning" | "danger" | "info" | "secondary" {
  if (!type) return "secondary";
  const normalized = type.toLowerCase();
  if (normalized === "routine") return "info";
  if (normalized === "maintenance") return "success";
  if (normalized === "incident") return "danger";
  if (normalized === "inspection") return "warning";
  return "secondary";
}

const schema = z.object({
  server_id: z.number().int().positive({ message: "Select a server" }),
  visit_type: requiredText("Visit type is required"),
  visit_date: requiredText("Visit date is required"),
  engineer_id: z.number().int().positive({ message: "Select an engineer" }),
  visit_notes: requiredText("Notes are required"),
});

type FormValues = z.infer<typeof schema>;

export default function VisitsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const canManage = can(user, "visits.manage");

  const [rows, setRows] = React.useState<VisitRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [query, setQuery] = React.useState("");

  const [serverTeamId, setServerTeamId] = React.useState<number | undefined>(undefined);

  const [editOpen, setEditOpen] = React.useState(false);
  const [editRow, setEditRow] = React.useState<VisitRow | null>(null);
  const [editSaving, setEditSaving] = React.useState(false);
  const [editServerId, setEditServerId] = React.useState<number>(0);
  const [editVisitType, setEditVisitType] = React.useState<string>(VISIT_TYPE_OPTIONS[0]);
  const [editVisitDate, setEditVisitDate] = React.useState<string>("");
  const [editEngineerId, setEditEngineerId] = React.useState<number | undefined>(undefined);
  const [editNotes, setEditNotes] = React.useState<string>("");
  const [editTeamId, setEditTeamId] = React.useState<number | undefined>(undefined);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      server_id: 0,
      visit_type: VISIT_TYPE_OPTIONS[0],
      visit_date: new Date().toISOString().slice(0, 10),
      engineer_id: 0,
      visit_notes: "",
    },
  });

  const serverId = watch("server_id");

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const teamId = await fetchServerTeamId(serverId);
        if (!alive) return;
        setServerTeamId(teamId);
        // reset engineer selection when server changes
        setValue("engineer_id", 0, { shouldValidate: true });
      } catch {
        if (!alive) return;
        setServerTeamId(undefined);
      }
    })();

    return () => {
      alive = false;
    };
  }, [serverId, setValue]);

  const load = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/api/visits", { headers: { "x-sam-silent": "1" } });
      setRows((res.data?.data ?? []) as VisitRow[]);
    } catch {
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
          "/api/visits",
          {
            ...values,
            engineer_id: Number(values.engineer_id),
          },
          { headers: { "x-sam-silent": "1" } }
        );
        const maintenanceUrl = `/maintenance?server_id=${values.server_id}`;

        if (values.visit_type === "Maintenance") {
          toast.success("Visit created", {
            action: {
              label: "Open Maintenance",
              onClick: () => router.push(maintenanceUrl),
            },
          });
        } else {
          toast.success("Visit created");
        }
        reset({ ...values, visit_notes: "" });
        await load();
      } catch (err) {
        toast.error(getErrorMessage(err, "Failed to create visit"));
      }
    },
    [load, reset, router]
  );

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [
        r.visit_id,
        r.server_code,
        r.hostname,
        r.visit_type,
        r.visit_date,
        r.engineer_name,
        r.visit_notes,
      ]
        .map((v) => String(v ?? "").toLowerCase())
        .join(" ")
        .includes(q)
    );
  }, [query, rows]);

  const exportCsv = React.useCallback(() => {
    const csv = buildCsv(filtered.slice(0, 500), [
      { key: "visit_id", label: "Visit ID" },
      { key: "server_id", label: "Server ID" },
      { key: "server_code", label: "Server Code" },
      { key: "hostname", label: "Hostname" },
      { key: "visit_type", label: "Visit Type" },
      { key: "visit_date", label: "Visit Date" },
      { key: "engineer_name", label: "Engineer" },
      { key: "visit_notes", label: "Notes" },
      { key: "created_at", label: "Created At" },
    ]);
    downloadCsv(`visits-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  }, [filtered]);

  const openEdit = React.useCallback((row: VisitRow) => {
    setEditRow(row);
    setEditServerId(Number(row.server_id));
    setEditVisitType(String(row.visit_type ?? VISIT_TYPE_OPTIONS[0]));
    setEditVisitDate(toYmd(row.visit_date ?? ""));
    setEditEngineerId(typeof row.engineer_id === "number" ? row.engineer_id : undefined);
    setEditNotes(String(row.visit_notes ?? ""));
    setEditOpen(true);

    void (async () => {
      try {
        const teamId = await fetchServerTeamId(Number(row.server_id));
        setEditTeamId(teamId);
      } catch {
        setEditTeamId(undefined);
      }
    })();
  }, []);

  const submitEdit = React.useCallback(async () => {
    if (!editRow) return;
    try {
      setEditSaving(true);
      await api.patch(
        `/api/visits/${editRow.visit_id}`,
        {
          visit_type: editVisitType?.trim() || null,
          visit_date: editVisitDate?.trim() || null,
          engineer_id: editEngineerId ?? null,
          visit_notes: editNotes?.trim() || null,
        },
        { headers: { "x-sam-silent": "1" } }
      );
      toast.success("Visit updated");
      setEditOpen(false);
      await load();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to update visit"));
    } finally {
      setEditSaving(false);
    }
  }, [editEngineerId, editNotes, editRow, editVisitDate, editVisitType, load]);

  return (
    <FadeIn>
      <div className="space-y-6">
        {/* V2 Header Style */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Visits</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Engineers visiting servers and what they observed
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              {loading ? "Refreshing…" : "Refresh"}
            </Button>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={loading || filtered.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* V2 Clean Controls - No Cards */}
        {canManage ? (
          <div className="rounded-lg border border-slate-200/60 bg-white p-6 shadow-sm dark:border-slate-800/60 dark:bg-slate-950">
            <h2 className="mb-4 text-base font-semibold text-slate-900 dark:text-slate-100">Log Visit</h2>
            <form className="grid gap-4" onSubmit={handleSubmit(onSubmit)}>
              <ServerSelect value={serverId} onChange={(id) => setValue("server_id", id, { shouldValidate: true })} showSearch={false} />
              <input type="hidden" {...register("server_id", { valueAsNumber: true })} />
              {errors.server_id ? <div className="text-xs text-destructive">{errors.server_id.message}</div> : null}

              <EngineerSelect
                teamId={serverTeamId}
                value={watch("engineer_id") ? Number(watch("engineer_id")) : undefined}
                onChange={(id) => setValue("engineer_id", Number(id ?? 0), { shouldValidate: true })}
                showSearch={false}
              />
              <input type="hidden" {...register("engineer_id", { valueAsNumber: true })} />
              {errors.engineer_id ? <div className="text-xs text-destructive">{errors.engineer_id.message}</div> : null}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="visit_type">Visit Type</Label>
                  <select
                    id="visit_type"
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    {...register("visit_type")}
                    defaultValue={VISIT_TYPE_OPTIONS[0]}
                  >
                    {VISIT_TYPE_OPTIONS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  {errors.visit_type ? <div className="text-xs text-destructive">{errors.visit_type.message}</div> : null}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="visit_date">Visit Date</Label>
                  <Input id="visit_date" type="date" {...register("visit_date")} />
                  {errors.visit_date ? <div className="text-xs text-destructive">{errors.visit_date.message}</div> : null}
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="visit_notes">Notes (what was seen)</Label>
                <Textarea id="visit_notes" rows={4} {...register("visit_notes")} />
                {errors.visit_notes ? <div className="text-xs text-destructive">{errors.visit_notes.message}</div> : null}
              </div>

              <div className="flex items-center justify-end pt-2">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Creating…" : "Create"}
                </Button>
              </div>
            </form>
          </div>
        ) : null}

        {/* Search Controls */}
        <div className="flex flex-col gap-3">
          <div className="relative flex-1 min-w-[250px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              type="search"
              placeholder="Search visits by server, engineer, type, date, or notes..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9 pr-9"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Premium Table */}
        <PremiumTable>
          <PremiumTableHeader>
            <tr>
              <PremiumTableHead>Server</PremiumTableHead>
              <PremiumTableHead>Engineer</PremiumTableHead>
              <PremiumTableHead>Type</PremiumTableHead>
              <PremiumTableHead>Date</PremiumTableHead>
              <PremiumTableHead>Notes</PremiumTableHead>
              <PremiumTableHead className="w-[120px] text-center">Actions</PremiumTableHead>
            </tr>
          </PremiumTableHeader>
          <PremiumTableBody>
            {loading ? (
              <PremiumTableSkeleton rows={5} cols={6} />
            ) : filtered.length ? (
              <>
                {filtered.slice(0, 500).map((r) => (
                  <PremiumTableRow key={r.visit_id}>
                    <PremiumTableCell>
                      <div className="font-medium text-slate-900 dark:text-slate-100">
                        {r.server_code ?? `#${r.server_id}`}
                        {r.hostname ? <span className="ml-1 text-sm text-slate-500 dark:text-slate-400">· {r.hostname}</span> : null}
                      </div>
                    </PremiumTableCell>
                    <PremiumTableCell>
                      <span className="text-slate-600 dark:text-slate-400">{r.engineer_name ?? (r.engineer_id ? `#${r.engineer_id}` : "—")}</span>
                    </PremiumTableCell>
                    <PremiumTableCell>
                      {r.visit_type ? (
                        <PremiumStatusBadge variant={getVisitTypeVariant(r.visit_type)}>
                          {r.visit_type}
                        </PremiumStatusBadge>
                      ) : (
                        <span className="text-slate-500 dark:text-slate-400">—</span>
                      )}
                    </PremiumTableCell>
                    <PremiumTableCell>
                      <span className="text-slate-600 dark:text-slate-400">{r.visit_date ? toYmd(r.visit_date) : "—"}</span>
                    </PremiumTableCell>
                    <PremiumTableCell>
                      <span className="text-sm text-slate-600 dark:text-slate-400">{r.visit_notes ?? "—"}</span>
                    </PremiumTableCell>
                    <PremiumTableCell onClick={(e) => e.stopPropagation()}>
                      {canManage ? (
                        <div className="flex items-center justify-center gap-1">
                          <PremiumActionButton
                            variant="edit"
                            icon={<Pencil className="h-4 w-4" />}
                            onClick={() => openEdit(r)}
                            tooltip="Edit visit"
                          />
                          <ConfirmDialog
                            title="Delete visit"
                            description={`Delete visit #${r.visit_id}? This cannot be undone.`}
                            confirmText="Delete"
                            confirmVariant="danger"
                            onConfirm={async () => {
                              await api.delete(`/api/visits/${r.visit_id}`);
                              toast.success("Visit deleted");
                              await load();
                            }}
                            trigger={
                              <PremiumActionButton
                                variant="delete"
                                icon={<Trash2 className="h-4 w-4" />}
                                tooltip="Delete visit"
                              />
                            }
                          />
                        </div>
                      ) : (
                        <span className="text-sm text-slate-500 dark:text-slate-400">—</span>
                      )}
                    </PremiumTableCell>
                  </PremiumTableRow>
                ))}
              </>
            ) : (
              <PremiumTableEmptyState
                title="No visits found"
                description={canManage ? "Create a visit record to see it listed here." : "You do not have permission to manage visits."}
              />
            )}
          </PremiumTableBody>
        </PremiumTable>

        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Visit</DialogTitle>
            </DialogHeader>

            <div className="grid gap-4">
              <ServerSelect value={editServerId} onChange={(id) => {
                setEditServerId(id);
                setEditEngineerId(undefined);
                void (async () => {
                  try {
                    const teamId = await fetchServerTeamId(id);
                    setEditTeamId(teamId);
                  } catch {
                    setEditTeamId(undefined);
                  }
                })();
              }} showSearch={false} />

              <EngineerSelect
                teamId={editTeamId}
                value={editEngineerId}
                onChange={(id) => setEditEngineerId(id)}
                showSearch={false}
              />

              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="edit_visit_type">Visit Type</Label>
                  <select
                    id="edit_visit_type"
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    value={editVisitType}
                    onChange={(e) => setEditVisitType(e.target.value)}
                  >
                    {VISIT_TYPE_OPTIONS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="edit_visit_date">Visit Date</Label>
                  <Input id="edit_visit_date" type="date" value={editVisitDate} onChange={(e) => setEditVisitDate(e.target.value)} />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit_visit_notes">Notes</Label>
                <Textarea id="edit_visit_notes" rows={4} value={editNotes} onChange={(e) => setEditNotes(e.target.value)} />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setEditOpen(false)} disabled={editSaving}>
                Cancel
              </Button>
              <Button variant="default" onClick={() => void submitEdit()} disabled={editSaving || !editRow}>
                {editSaving ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </FadeIn>
  );
}
