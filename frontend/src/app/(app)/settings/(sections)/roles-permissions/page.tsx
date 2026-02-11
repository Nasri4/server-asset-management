"use client";

import * as React from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Plus, Save } from "lucide-react";

import { RbacGuard } from "@/components/auth/rbac-guard";
import {
  usePermissionMatrix,
  useUpdatePermissionMatrix,
  useCreatePermission,
  type PermissionMatrix,
} from "@/lib/api/settings";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

const createPermissionSchema = z.object({
  key: z
    .string()
    .min(3, "Key is required")
    .regex(/^[a-z0-9_.:-]+$/i, "Use a stable key like servers.create or settings.audit.update"),
  label: z.string().min(2, "Label is required"),
  group: z.string().optional().or(z.literal("")),
  description: z.string().optional().or(z.literal("")),
});

type CreatePermissionValues = z.infer<typeof createPermissionSchema>;

function makeDraft(m: PermissionMatrix) {
  // Deep copy grants to allow local edits.
  return JSON.parse(JSON.stringify(m.grants)) as PermissionMatrix["grants"];
}

export default function RolesPermissionsPage() {
  const q = usePermissionMatrix();
  const saveM = useUpdatePermissionMatrix();
  const createM = useCreatePermission();

  const [draft, setDraft] = React.useState<PermissionMatrix["grants"] | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);

  React.useEffect(() => {
    if (!q.data) return;
    setDraft(makeDraft(q.data));
  }, [q.data]);

  const dirty = React.useMemo(() => {
    if (!q.data || !draft) return false;
    return JSON.stringify(q.data.grants) !== JSON.stringify(draft);
  }, [draft, q.data]);

  const toggle = (permKey: string, role: string) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = { ...prev, [permKey]: { ...(prev[permKey] ?? {}) } };
      next[permKey][role] = !Boolean(next[permKey][role]);
      return next;
    });
  };

  const save = async () => {
    if (!draft) return;
    await saveM.mutateAsync({ grants: draft });
    toast.success("Permissions updated");
  };

  const createForm = useForm<CreatePermissionValues>({
    resolver: zodResolver(createPermissionSchema),
    defaultValues: { key: "", label: "", group: "", description: "" },
  });

  const submitCreate = async (v: CreatePermissionValues) => {
    await createM.mutateAsync({
      key: v.key,
      label: v.label,
      group: v.group || null,
      description: v.description || null,
    });
    toast.success("Permission added");
    setCreateOpen(false);
    createForm.reset();
  };

  return (
    <RbacGuard roles="Admin">
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>Roles & Permissions</CardTitle>
                <CardDescription>
                  Manage permissions safely. Changes are audited and should be reviewed.
                </CardDescription>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" onClick={() => setCreateOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add permission
                </Button>
                <Button onClick={() => void save()} disabled={!dirty || saveM.isPending}>
                  <Save className="mr-2 h-4 w-4" />
                  {saveM.isPending ? "Saving…" : "Save changes"}
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {q.isLoading || !q.data || !draft ? (
              <div className="grid gap-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Permission</TableHead>
                    {q.data.roles.map((r) => (
                      <TableHead key={r.role} className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Badge variant={r.role === "Admin" ? "default" : r.role === "TeamLead" ? "secondary" : "outline"}>
                            {r.label}
                          </Badge>
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {q.data.permissions.map((p) => (
                    <TableRow key={p.key}>
                      <TableCell>
                        <div className="grid">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs text-muted-foreground">{p.key}</span>
                            {p.group ? <Badge variant="outline">{p.group}</Badge> : null}
                          </div>
                          <div className="font-medium">{p.label}</div>
                          {p.description ? <div className="text-xs text-muted-foreground">{p.description}</div> : null}
                        </div>
                      </TableCell>

                      {q.data.roles.map((r) => {
                        const checked = Boolean(draft?.[p.key]?.[r.role]);
                        const locked = r.role === "Admin";
                        return (
                          <TableCell key={r.role} className="text-center">
                            <div className="inline-flex items-center justify-center">
                              <Checkbox
                                checked={checked}
                                onCheckedChange={() => {
                                  if (locked) return;
                                  toggle(p.key, r.role);
                                }}
                                disabled={locked}
                                aria-label={`Toggle ${p.key} for ${r.role}`}
                              />
                            </div>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add permission</DialogTitle>
              <DialogDescription>
                Use stable keys. Don’t delete or rename without a migration plan.
              </DialogDescription>
            </DialogHeader>

            <form className="grid gap-4" onSubmit={createForm.handleSubmit(submitCreate)}>
              <div className="grid gap-2">
                <Label htmlFor="perm_key">Key</Label>
                <Input id="perm_key" placeholder="servers.update" {...createForm.register("key")} />
                {createForm.formState.errors.key ? (
                  <p className="text-xs text-destructive">{createForm.formState.errors.key.message}</p>
                ) : null}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="perm_label">Label</Label>
                <Input id="perm_label" placeholder="Update servers" {...createForm.register("label")} />
                {createForm.formState.errors.label ? (
                  <p className="text-xs text-destructive">{createForm.formState.errors.label.message}</p>
                ) : null}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="perm_group">Group (optional)</Label>
                <Input id="perm_group" placeholder="Servers" {...createForm.register("group")} />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="perm_desc">Description (optional)</Label>
                <Input id="perm_desc" placeholder="Controls access to server updates" {...createForm.register("description")} />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} disabled={createM.isPending}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createM.isPending}>
                  {createM.isPending ? "Adding…" : "Add permission"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </RbacGuard>
  );
}
