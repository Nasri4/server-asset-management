"use client";

import * as React from "react";
import { PlusCircle, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api/client";
import { useAuth } from "@/components/auth/auth-provider";
import { can } from "@/lib/rbac";

type MaintenanceType = {
  maintenance_type_id: number;
  name: string;
  description?: string | null;
  is_active?: boolean;
  checklist_count?: number;
};

type ChecklistItem = { checklist_item_id?: number; label: string; sort_order: number; is_active?: boolean };

function getErrorMessage(err: unknown, fallback: string) {
  const maybe = err as { response?: { data?: { error?: { message?: string } } }; message?: string };
  return maybe?.response?.data?.error?.message || maybe?.message || fallback;
}

export default function MaintenanceOpsTemplatesPage() {
  const { user } = useAuth();
  const canManage = can(user, "maintenance.manage");

  const [rows, setRows] = React.useState<MaintenanceType[]>([]);
  const [loading, setLoading] = React.useState(true);

  const [editOpen, setEditOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [editId, setEditId] = React.useState<number | null>(null);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [itemsText, setItemsText] = React.useState("");

  const load = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/api/maintenance-ops/types", { headers: { "x-sam-silent": "1" } });
      setRows((res.data?.data ?? []) as MaintenanceType[]);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to load maintenance types"));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const openCreate = React.useCallback(() => {
    setEditId(null);
    setName("");
    setDescription("");
    setItemsText(
      [
        "Confirm approved maintenance window",
        "Take backup/snapshot",
        "Execute maintenance steps",
        "Validate services",
        "Update ticket/record",
      ].join("\n")
    );
    setEditOpen(true);
  }, []);

  const openEdit = React.useCallback(async (id: number) => {
    try {
      const res = await api.get(`/api/maintenance-ops/types/${id}`, { headers: { "x-sam-silent": "1" } });
      const type = res.data?.data?.type as MaintenanceType;
      const items = (res.data?.data?.checklist_items ?? []) as Array<{ label: string; sort_order: number }>;
      setEditId(id);
      setName(String(type?.name ?? ""));
      setDescription(String(type?.description ?? ""));
      setItemsText(items.sort((a, b) => a.sort_order - b.sort_order).map((i) => i.label).join("\n"));
      setEditOpen(true);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to load type"));
    }
  }, []);

  const save = React.useCallback(async () => {
    if (!canManage) return;
    const n = name.trim();
    if (!n) {
      toast.error("Name is required");
      return;
    }

    const labels = itemsText
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    const checklist_items: ChecklistItem[] = labels.map((label, i) => ({ label, sort_order: i + 1, is_active: true }));

    try {
      setSaving(true);
      if (editId) {
        await api.patch(`/api/maintenance-ops/types/${editId}`, {
          name: n,
          description: description.trim() || null,
          checklist_items,
        });
        toast.success("Type updated");
      } else {
        await api.post(`/api/maintenance-ops/types`, {
          name: n,
          description: description.trim() || null,
          checklist_items,
        });
        toast.success("Type created");
      }
      setEditOpen(false);
      await load();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to save type"));
    } finally {
      setSaving(false);
    }
  }, [canManage, description, editId, itemsText, load, name]);

  const remove = React.useCallback(
    async (id: number) => {
      if (!canManage) return;
      try {
        await api.delete(`/api/maintenance-ops/types/${id}`);
        toast.success("Type deleted");
        await load();
      } catch (err) {
        toast.error(getErrorMessage(err, "Failed to delete"));
      }
    },
    [canManage, load]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Maintenance Types"
        description="Admin-managed checklist templates used by recurring schedules."
        actions={
          canManage ? (
            <Button onClick={openCreate}>
              <PlusCircle className="mr-2 h-4 w-4" /> New Type
            </Button>
          ) : null
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Types</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Checklist</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                    No maintenance types yet.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.maintenance_type_id}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.description ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{Number(r.checklist_count ?? 0)} items</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => openEdit(r.maintenance_type_id)}>
                          Edit
                        </Button>
                        {canManage ? (
                          <Button variant="outline" size="sm" onClick={() => remove(r.maintenance_type_id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit Maintenance Type" : "Create Maintenance Type"}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <div className="text-sm font-medium">Name</div>
              <Input value={name} onChange={(e) => setName(e.target.value)} disabled={saving} />
            </div>

            <div className="grid gap-2">
              <div className="text-sm font-medium">Description</div>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} disabled={saving} />
            </div>

            <div className="grid gap-2">
              <div className="text-sm font-medium">Checklist template (one item per line)</div>
              <Textarea value={itemsText} onChange={(e) => setItemsText(e.target.value)} disabled={saving} className="min-h-48" />
              <div className="text-xs text-muted-foreground">
                Saved as ordered checklist items. Existing schedules keep history via per-run label snapshots.
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving || !canManage}>
              <Save className="mr-2 h-4 w-4" /> Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
