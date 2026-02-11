"use client";

import * as React from "react";
import Link from "next/link";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { MoreVertical, Plus, Search } from "lucide-react";
import { toast } from "sonner";

import {
  useConfigList,
  useCreateConfig,
  useDeleteConfig,
  useUpdateConfig,
  type ConfigItem,
} from "@/lib/api/config";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

const schema = z.object({
  name: z.string().min(2, "Name is required"),
  description: z.string().optional().or(z.literal("")),
});

type FormValues = z.infer<typeof schema>;

type Key = Parameters<typeof useConfigList>[0];

function formatRelative(updatedAtMs: number) {
  if (!updatedAtMs) return "—";
  const diff = Date.now() - updatedAtMs;
  const mins = Math.max(0, Math.round(diff / 60000));
  if (mins <= 0) return "Updated just now";
  if (mins === 1) return "Updated 1m ago";
  if (mins < 60) return `Updated ${mins}m ago`;
  const hours = Math.round(mins / 60);
  return hours === 1 ? "Updated 1h ago" : `Updated ${hours}h ago`;
}

export function ConfigTable({
  configKey,
  title,
  description,
  canEdit,
  addLabel,
  learnMoreHref,
}: {
  configKey: Key;
  title: string;
  description: string;
  canEdit: boolean;
  addLabel?: string;
  learnMoreHref?: string;
}) {
  const q = useConfigList(configKey);
  const createM = useCreateConfig(configKey);
  const updateM = useUpdateConfig(configKey);
  const deleteM = useDeleteConfig(configKey);

  const [search, setSearch] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [edit, setEdit] = React.useState<ConfigItem | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", description: "" },
  });

  React.useEffect(() => {
    if (!open) return;
    form.reset({ name: edit?.name ?? "", description: edit?.description ?? "" });
  }, [edit, form, open]);

  const rows = React.useMemo(() => {
    const all = q.data ?? [];
    const needle = search.trim().toLowerCase();
    if (!needle) return all;
    return all.filter((r) => `${r.name} ${r.description ?? ""}`.toLowerCase().includes(needle));
  }, [q.data, search]);

  const submit = async (v: FormValues) => {
    if (!canEdit) return;

    if (edit) {
      await updateM.mutateAsync({ id: edit.id, input: { name: v.name, description: v.description || null } });
      toast.success("Updated");
    } else {
      await createM.mutateAsync({ name: v.name, description: v.description || null });
      toast.success("Created");
    }

    setOpen(false);
  };

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <p className="mt-1 text-sm text-slate-600">{description}</p>
        </div>
        {canEdit ? (
          <Button
            className="h-10 bg-emerald-600 px-4 text-white hover:bg-emerald-700"
            onClick={() => {
              setEdit(null);
              setOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            {addLabel ?? "Add"}
          </Button>
        ) : null}
      </div>

      <div className="w-full max-w-xl">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${title.toLowerCase()}...`}
            className="h-10 pl-9"
          />
        </div>
      </div>

      {q.isLoading ? (
        <div className="grid gap-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-14 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-slate-50">
            <div className="h-5 w-5 rounded-sm border border-slate-300 bg-white" />
          </div>
          <div className="text-sm font-semibold text-slate-900">No {title.toLowerCase()} yet</div>
          <div className="mx-auto mt-1 max-w-md text-sm text-slate-600">
            {canEdit
              ? "Create your first entry to standardize data quality across your infrastructure."
              : "No configuration is available."}
          </div>
          {learnMoreHref ? (
            <div className="mt-4">
              <Link href={learnMoreHref} className="text-sm font-medium text-emerald-700 hover:text-emerald-800">
                Learn about server categorization 
              </Link>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium text-slate-900">{r.name}</TableCell>
                  <TableCell className="text-slate-600">{r.description ?? ""}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label="Config actions">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setEdit(r);
                            setOpen(true);
                          }}
                          disabled={!canEdit}
                        >
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <ConfirmDialog
                          title={`Delete ${r.name}?`}
                          description="This action is audited and cannot be undone. Ensure no critical records depend on this value."
                          confirmText="Delete"
                          confirmVariant="danger"
                          disabled={!canEdit || deleteM.isPending}
                          onConfirm={async () => {
                            if (!canEdit) return;
                            await deleteM.mutateAsync(r.id);
                            toast.success("Deleted");
                          }}
                          trigger={
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onSelect={(e) => e.preventDefault()}
                              disabled={!canEdit}
                            >
                              Delete
                            </DropdownMenuItem>
                          }
                        />
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="border-t border-slate-200 pt-6">
        <div className="mb-4 flex items-center justify-between text-xs text-slate-500">
          <div className="font-semibold uppercase tracking-widest">Resource statistics</div>
          <div>{formatRelative(q.dataUpdatedAt)}</div>
        </div>
        <div className="grid gap-6 rounded-2xl border border-slate-200 bg-white px-6 py-6 md:grid-cols-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Active Definitions</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">{rows.length}</div>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Associated Assets</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">0</div>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Global Compliance</div>
            <div className="mt-2 text-2xl font-semibold text-emerald-600">100%</div>
          </div>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{edit ? `Edit ${title}` : `Add to ${title}`}</DialogTitle>
            <DialogDescription>Keep values concise and stable for reporting and filtering.</DialogDescription>
          </DialogHeader>

          <form className="grid gap-4" onSubmit={form.handleSubmit(submit)}>
            <div className="grid gap-2">
              <Label htmlFor={`${configKey}-name`}>Name</Label>
              <Input id={`${configKey}-name`} {...form.register("name")} disabled={!canEdit} />
              {form.formState.errors.name ? (
                <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
              ) : null}
            </div>

            <div className="grid gap-2">
              <Label htmlFor={`${configKey}-desc`}>Description (optional)</Label>
              <Input id={`${configKey}-desc`} {...form.register("description")} disabled={!canEdit} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={createM.isPending || updateM.isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={!canEdit || createM.isPending || updateM.isPending}>
                {createM.isPending || updateM.isPending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
