"use client";

import * as React from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";

import { useAuth } from "@/components/auth/auth-provider";
import { isAdmin, isEngineer, isTeamLead } from "@/lib/rbac";
import { AccessDenied } from "@/components/settings/access-denied";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

import { useAuditSettings, useUpdateAuditSettings } from "@/lib/api/settings";
import { useTeamActivity } from "@/lib/api/logs";

const schema = z.object({
  retention_days: z.number().int().min(7, "Minimum 7 days").max(3650, "Maximum 10 years"),
  auto_clean_enabled: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

export default function AuditActivitySettingsPage() {
  const { user } = useAuth();
  const admin = isAdmin(user);
  const teamLead = isTeamLead(user);

  if (isEngineer(user)) {
    return <AccessDenied title="Access denied" description="Engineers don’t have access to Settings." backHref="/dashboard" />;
  }

  const settingsQ = useAuditSettings();
  const updateM = useUpdateAuditSettings();

  const feedQ = useTeamActivity({ teamId: teamLead ? user?.teamId : undefined });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { retention_days: 180, auto_clean_enabled: true },
  });

  React.useEffect(() => {
    if (!settingsQ.data) return;
    form.reset({
      retention_days: settingsQ.data.retention_days ?? 180,
      auto_clean_enabled: Boolean(settingsQ.data.auto_clean_enabled),
    });
  }, [form, settingsQ.data]);

  const submit = async (v: FormValues) => {
    if (!admin) return;
    await updateM.mutateAsync(v);
    toast.success("Audit settings saved");
  };

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Audit retention</CardTitle>
          <CardDescription>Control how long audit and activity data is retained.</CardDescription>
        </CardHeader>
        <CardContent>
          {settingsQ.isLoading ? (
            <div className="grid gap-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <form className="grid gap-5" onSubmit={form.handleSubmit(submit)}>
              <div className="grid gap-2">
                <Label htmlFor="retention">Retention (days)</Label>
                <Input
                  id="retention"
                  type="number"
                  value={String(form.watch("retention_days"))}
                  onChange={(e) => form.setValue("retention_days", Number(e.target.value), { shouldDirty: true })}
                  disabled={!admin}
                />
                {form.formState.errors.retention_days ? (
                  <p className="text-xs text-destructive">{form.formState.errors.retention_days.message}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">Recommended: 180–365 days for operational visibility.</p>
                )}
              </div>

              <div className="flex items-center justify-between rounded-xl border bg-card/60 p-3">
                <div className="grid">
                  <div className="text-sm font-medium">Auto-clean</div>
                  <div className="text-xs text-muted-foreground">Automatically delete audit records beyond the retention window.</div>
                </div>
                <Switch
                  checked={form.watch("auto_clean_enabled")}
                  onCheckedChange={(v) => form.setValue("auto_clean_enabled", Boolean(v), { shouldDirty: true })}
                  disabled={!admin}
                />
              </div>

              <div className="flex items-center justify-between border-t pt-5">
                <div className="text-sm text-muted-foreground">
                  {!admin ? "Only admins can change retention policy." : ""}
                </div>
                <Button type="submit" disabled={!admin || updateM.isPending || !form.formState.isDirty}>
                  {updateM.isPending ? "Saving…" : "Save"}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>Recent activity</CardTitle>
              <CardDescription>
                {admin
                  ? "Visibility across the organization (scoped by server rules)."
                  : "Team-scoped activity feed."}
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => void feedQ.refetch()} disabled={feedQ.isFetching}>
              <RefreshCw className={feedQ.isFetching ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {feedQ.isLoading ? (
            <div className="grid gap-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <div className="space-y-3">
              {(feedQ.data?.items ?? []).slice(0, 20).map((e) => (
                <div key={e.activity_id} className="rounded-xl border bg-card/60 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {e.action ? <Badge variant="secondary">{e.action}</Badge> : null}
                      {e.entity_type ? <Badge variant="outline">{e.entity_type}</Badge> : null}
                      <span className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString()}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {e.actor?.full_name ? (
                        <span className="text-foreground/90">
                          {e.actor.full_name}
                          {e.actor.role_name ? ` · ${e.actor.role_name}` : ""}
                          {e.actor.team_name ? ` · ${e.actor.team_name}` : ""}
                        </span>
                      ) : (
                        "—"
                      )}
                    </div>
                  </div>
                  <div className="mt-2 text-sm">{e.message ?? "Activity recorded"}</div>
                </div>
              ))}

              {(feedQ.data?.items ?? []).length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">No activity yet.</div>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
