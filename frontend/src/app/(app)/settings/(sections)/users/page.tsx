"use client";

import * as React from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { MoreVertical, Plus } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth/auth-provider";
import { isAdmin, isEngineer, isTeamLead } from "@/lib/rbac";
import {
  useUsers,
  useCreateUser,
  useDisableUser,
  useResetUserPassword,
  type UserRole,
  type UserRow,
} from "@/lib/api/users";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";
import { TablePagination, TableToolbar } from "@/components/data/table-controls";
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
import { TeamSelect } from "@/components/forms/team-select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/data/empty-state";
import { AccessDenied } from "@/components/settings/access-denied";

const schema = z.object({
  full_name: z.string().min(2, "Name is required"),
  email: z.string().email("Valid email is required"),
  role: z.enum(["Engineer", "TeamLead"]),
  team_id: z.number().int().min(1, "Team is required"),
});

type FormValues = z.infer<typeof schema>;

function RoleBadge({ role }: { role: UserRole }) {
  const v = String(role);
  const variant = v === "Admin" ? "default" : v === "TeamLead" ? "secondary" : "outline";
  return <Badge variant={variant as any}>{v}</Badge>;
}

function CreateUserDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { user } = useAuth();
  const admin = isAdmin(user);
  const teamLead = isTeamLead(user);

  const m = useCreateUser();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      full_name: "",
      email: "",
      role: "Engineer",
      team_id: teamLead ? user?.teamId ?? 0 : 0,
    },
  });

  React.useEffect(() => {
    if (!open) return;
    form.reset({
      full_name: "",
      email: "",
      role: teamLead ? "Engineer" : "Engineer",
      team_id: teamLead ? user?.teamId ?? 0 : 0,
    });
  }, [form, open, teamLead, user?.teamId]);

  const canCreate = admin || teamLead;

  const allowedRoles: Array<"Engineer" | "TeamLead"> = admin ? ["Engineer", "TeamLead"] : ["Engineer"];

  const submit = async (values: FormValues) => {
    if (!canCreate) return;

    const forcedTeamId = teamLead ? user?.teamId : values.team_id;
    if (!forcedTeamId) {
      toast.error("Team is required");
      return;
    }

    const forcedRole: "Engineer" | "TeamLead" = teamLead ? "Engineer" : values.role;

    await m.mutateAsync({
      full_name: values.full_name,
      email: values.email,
      role: forcedRole,
      team_id: forcedTeamId,
    });

    toast.success("User created");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create user</DialogTitle>
          <DialogDescription>
            Admins can create TeamLeads or Engineers. TeamLeads can create Engineers for their own team.
          </DialogDescription>
        </DialogHeader>

        <form className="grid gap-4" onSubmit={form.handleSubmit(submit)}>
          <div className="grid gap-2">
            <Label htmlFor="full_name">Full name</Label>
            <Input id="full_name" placeholder="Ayaan Mohamed" {...form.register("full_name")} />
            {form.formState.errors.full_name ? (
              <p className="text-xs text-destructive">{form.formState.errors.full_name.message}</p>
            ) : null}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" placeholder="ayaan@company.com" {...form.register("email")} />
            {form.formState.errors.email ? (
              <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
            ) : null}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label>User type</Label>
              <Select
                value={form.watch("role")}
                onValueChange={(v) => form.setValue("role", v as any, { shouldDirty: true })}
                disabled={!admin}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {allowedRoles.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!admin ? <p className="text-xs text-muted-foreground">TeamLeads can only invite Engineers.</p> : null}
            </div>

            <div className="grid gap-2">
              <Label>Team</Label>
              <TeamSelect
                value={form.watch("team_id") || undefined}
                onChange={(id) => form.setValue("team_id", id ?? 0, { shouldDirty: true })}
                allowEmpty={!teamLead}
                emptyLabel="Select team"
                showSearch
              />
              <input type="hidden" {...form.register("team_id", { valueAsNumber: true })} />
              {teamLead ? (
                <p className="text-xs text-muted-foreground">Team is forced to your team.</p>
              ) : null}
              {form.formState.errors.team_id ? (
                <p className="text-xs text-destructive">{form.formState.errors.team_id.message}</p>
              ) : null}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={m.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={m.isPending}>
              {m.isPending ? "Creating…" : "Create user"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function UsersSettingsPage() {
  const { user } = useAuth();

  if (isEngineer(user)) {
    return <AccessDenied title="Settings unavailable" description="Engineers don’t have access to Settings." backHref="/dashboard" />;
  }

  const admin = isAdmin(user);
  const teamLead = isTeamLead(user);

  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(20);

  const scopedTeamId = teamLead ? user?.teamId : undefined;

  const q = useUsers({
    q: search || undefined,
    teamId: scopedTeamId,
    page,
    pageSize,
  });

  const disableM = useDisableUser();
  const resetM = useResetUserPassword();

  const [createOpen, setCreateOpen] = React.useState(false);

  const rows = q.data?.items ?? [];

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Users</CardTitle>
              <CardDescription>
                {admin
                  ? "Create and manage users across the organization."
                  : "Manage users within your team."}
              </CardDescription>
            </div>

            {admin || teamLead ? (
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create user
              </Button>
            ) : null}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <TableToolbar
            search={search}
            onSearch={(v) => {
              setSearch(v);
              setPage(1);
            }}
            placeholder={admin ? "Search users…" : "Search your team…"}
          />

          {q.isLoading ? (
            <div className="grid gap-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              title="No users found"
              description={admin ? "Invite your first users to start managing assets." : "No users are visible in your team scope."}
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((u: UserRow) => (
                    <TableRow key={u.user_id}>
                      <TableCell className="font-medium">{u.full_name ?? "—"}</TableCell>
                      <TableCell>{u.email}</TableCell>
                      <TableCell>
                        <RoleBadge role={u.role} />
                      </TableCell>
                      <TableCell>{u.team_name ?? (u.team_id ? `#${u.team_id}` : "—")}</TableCell>
                      <TableCell>
                        <StatusBadge status={u.status} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label="User actions">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem disabled>Edit</DropdownMenuItem>
                            <DropdownMenuSeparator />

                            <ConfirmDialog
                              title="Disable user"
                              description="The user will lose access immediately. This action is logged."
                              confirmText="Disable"
                              confirmVariant="danger"
                              disabled={!(admin || teamLead) || disableM.isPending}
                              onConfirm={async () => {
                                await disableM.mutateAsync(u.user_id);
                                toast.success("User disabled");
                              }}
                              trigger={
                                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                  Disable
                                </DropdownMenuItem>
                              }
                            />

                            <ConfirmDialog
                              title="Reset password"
                              description="This will invalidate the user’s current password and issue a reset flow."
                              confirmText="Reset"
                              confirmVariant="danger"
                              disabled={!admin || resetM.isPending}
                              onConfirm={async () => {
                                await resetM.mutateAsync(u.user_id);
                                toast.success("Password reset initiated");
                              }}
                              trigger={
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onSelect={(e) => e.preventDefault()}
                                  disabled={!admin}
                                >
                                  Reset password
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

              <TablePagination
                page={page}
                pageSize={pageSize}
                total={q.data?.total ?? rows.length}
                onPageChange={setPage}
                onPageSizeChange={(n) => {
                  setPageSize(n);
                  setPage(1);
                }}
              />
            </>
          )}
        </CardContent>
      </Card>

      <CreateUserDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
