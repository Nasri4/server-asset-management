"use client";

import * as React from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { MoreVertical, Plus } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth/auth-provider";
import { isAdmin, isTeamLead } from "@/lib/rbac";
import { useTeams, useCreateTeam, useDeleteTeam, useUpdateTeam, type TeamRow } from "@/lib/api/teams";
import { useUsers } from "@/lib/api/users";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TableToolbar } from "@/components/data/table-controls";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/data/empty-state";

const schema = z.object({
  name: z.string().min(2, "Team name is required"),
  team_lead_user_id: z.number().int().nullable().optional(),
});

type FormValues = z.infer<typeof schema>;

function TeamDialog({
  open,
  onOpenChange,
  initial,
  onSubmit,
  submitting,
  canEditLead,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: TeamRow | null;
  onSubmit: (v: FormValues) => Promise<void>;
  submitting: boolean;
  canEditLead: boolean;
}) {
  const leadsQ = useUsers({ role: "TeamLead", pageSize: 200 });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", team_lead_user_id: null },
  });

  React.useEffect(() => {
    if (!open) return;
    form.reset({
      name: initial?.name ?? "",
      team_lead_user_id: initial?.team_lead_user_id ?? null,
    });
  }, [form, initial, open]);

  const submit = async (v: FormValues) => {
    await onSubmit(v);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? "Edit team" : "Create team"}</DialogTitle>
          <DialogDescription>Teams scope visibility and ownership across servers and work.</DialogDescription>
        </DialogHeader>

        <form className="grid gap-4" onSubmit={form.handleSubmit(submit)}>
          <div className="grid gap-2">
            <Label htmlFor="team_name">Team name</Label>
            <Input id="team_name" placeholder="Core Network" {...form.register("name")} />
            {form.formState.errors.name ? (
              <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
            ) : null}
          </div>

          <div className="grid gap-2">
            <Label>Team lead (optional)</Label>
            <Select
              value={String(form.watch("team_lead_user_id") ?? "")}
              onValueChange={(v) => {
                const next = v === "__unassigned__" ? null : Number(v);
                form.setValue("team_lead_user_id", Number.isFinite(next as any) ? next : null, { shouldDirty: true });
              }}
              disabled={!canEditLead}
            >
              <SelectTrigger>
                <SelectValue placeholder={leadsQ.isLoading ? "Loading…" : "Select a team lead"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__unassigned__">Unassigned</SelectItem>
                {(leadsQ.data?.items ?? []).map((u) => (
                  <SelectItem key={u.user_id} value={String(u.user_id)}>
                    {u.full_name ?? u.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!canEditLead ? (
              <p className="text-xs text-muted-foreground">Only admins can assign or change team leads.</p>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : initial ? "Save changes" : "Create team"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function TeamsSettingsPage() {
  const { user } = useAuth();
  const canAdmin = isAdmin(user);
  const canTeamLead = isTeamLead(user);

  const q = useTeams();
  const createM = useCreateTeam();
  const updateM = useUpdateTeam();
  const deleteM = useDeleteTeam();

  const [qText, setQText] = React.useState("");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [edit, setEdit] = React.useState<TeamRow | null>(null);

  const teams = React.useMemo(() => {
    const all = q.data ?? [];
    const scoped = canAdmin
      ? all
      : canTeamLead
        ? all.filter((t) => t.team_id === user?.teamId)
        : [];

    const needle = qText.trim().toLowerCase();
    if (!needle) return scoped;
    return scoped.filter((t) => (t.name ?? "").toLowerCase().includes(needle));
  }, [canAdmin, canTeamLead, q.data, qText, user?.teamId]);

  const openCreate = () => {
    setEdit(null);
    setDialogOpen(true);
  };

  const openEdit = (row: TeamRow) => {
    setEdit(row);
    setDialogOpen(true);
  };

  const submit = async (values: FormValues) => {
    if (!canAdmin) {
      // Team leads can view their team but do not manage global teams by default.
      toast.error("Only Admin can manage teams");
      return;
    }

    if (edit) {
      await updateM.mutateAsync({ teamId: edit.team_id, input: values });
      toast.success("Team updated");
    } else {
      await createM.mutateAsync(values);
      toast.success("Team created");
    }
  };

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Teams</CardTitle>
              <CardDescription>
                {canAdmin
                  ? "Create and manage teams, assign team leads, and view membership."
                  : "View your team and its current lead assignment."}
              </CardDescription>
            </div>

            {canAdmin ? (
              <Button onClick={openCreate}>
                <Plus className="mr-2 h-4 w-4" />
                New team
              </Button>
            ) : null}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <TableToolbar
            search={qText}
            onSearch={setQText}
            placeholder={canAdmin ? "Search teams…" : "Search your team…"}
          />

          {q.isLoading ? (
            <div className="grid gap-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : teams.length === 0 ? (
            <EmptyState
              title={canAdmin ? "No teams yet" : "No teams available"}
              description={canAdmin ? "Create your first team to scope ownership and access." : "No team data is available for your account."}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Team</TableHead>
                  <TableHead>Lead</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teams.map((t) => (
                  <TableRow key={t.team_id}>
                    <TableCell>
                      <div className="grid">
                        <div className="font-medium">{t.name}</div>
                        <div className="text-xs text-muted-foreground">ID {t.team_id}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {t.team_lead_name ? (
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">TeamLead</Badge>
                          <span className="text-sm">{t.team_lead_name}</span>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label="Team actions">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(t)} disabled={!canAdmin}>
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <ConfirmDialog
                            title="Delete team"
                            description="This action cannot be undone. Ensure no critical resources depend on this team."
                            confirmText="Delete"
                            confirmVariant="danger"
                            disabled={!canAdmin}
                            onConfirm={async () => {
                              if (!canAdmin) return;
                              await deleteM.mutateAsync(t.team_id);
                              toast.success("Team deleted");
                            }}
                            trigger={
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onSelect={(e) => e.preventDefault()}
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
          )}
        </CardContent>
      </Card>

      <TeamDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={edit}
        onSubmit={submit}
        submitting={createM.isPending || updateM.isPending}
        canEditLead={canAdmin}
      />
    </div>
  );
}
