"use client";

import * as React from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { useAuth } from "@/components/auth/auth-provider";
import { AccessDenied } from "@/components/settings/access-denied";
import { isAdmin, isEngineer, isTeamLead } from "@/lib/rbac";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";

import { useNotificationSettings, useUpdateNotificationSettings } from "@/lib/api/settings";

const schema = z.object({
  email_enabled: z.boolean(),
  smtp_host: z.string().trim().nullable().optional(),
  smtp_user: z.string().trim().nullable().optional(),
  from_email: z.string().trim().email("Invalid email").nullable().optional(),
  team_notifications_enabled: z.boolean().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function NotificationsSettingsPage() {
  const { user } = useAuth();
  const admin = isAdmin(user);
  const readOnly = isTeamLead(user) && !admin;

  if (isEngineer(user)) {
    return <AccessDenied title="Access denied" description="Engineers don’t have access to Settings." backHref="/dashboard" />;
  }

  const q = useNotificationSettings();
  const updateM = useUpdateNotificationSettings();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      email_enabled: true,
      smtp_host: null,
      smtp_user: null,
      from_email: null,
      team_notifications_enabled: true,
    },
  });

  React.useEffect(() => {
    if (!q.data) return;
    form.reset({
      email_enabled: Boolean(q.data.email_enabled),
      smtp_host: q.data.smtp_host ?? null,
      smtp_user: q.data.smtp_user ?? null,
      from_email: q.data.from_email ?? null,
      team_notifications_enabled: Boolean(q.data.team_notifications_enabled ?? true),
    });
  }, [form, q.data]);

  const submit = async (v: FormValues) => {
    if (!admin) return;
    await updateM.mutateAsync(v);
    toast.success("Notification settings saved");
  };

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>Configure email delivery and team notifications.</CardDescription>
        </CardHeader>
        <CardContent>
          {q.isLoading ? (
            <div className="grid gap-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <form className="grid gap-5" onSubmit={form.handleSubmit(submit)}>
              <div className="flex items-center justify-between rounded-xl border bg-card/60 p-3">
                <div className="grid">
                  <div className="text-sm font-medium">Email notifications</div>
                  <div className="text-xs text-muted-foreground">Enable/disable email delivery.</div>
                </div>
                <Switch
                  checked={form.watch("email_enabled")}
                  onCheckedChange={(v) => form.setValue("email_enabled", Boolean(v), { shouldDirty: true })}
                  disabled={!admin}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="smtp_host">SMTP host</Label>
                <Input
                  id="smtp_host"
                  value={form.watch("smtp_host") ?? ""}
                  onChange={(e) => form.setValue("smtp_host", e.target.value || null, { shouldDirty: true })}
                  disabled={!admin || !form.watch("email_enabled")}
                  placeholder="smtp.example.com"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="smtp_user">SMTP user</Label>
                <Input
                  id="smtp_user"
                  value={form.watch("smtp_user") ?? ""}
                  onChange={(e) => form.setValue("smtp_user", e.target.value || null, { shouldDirty: true })}
                  disabled={!admin || !form.watch("email_enabled")}
                  placeholder="no-reply@example.com"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="from_email">From email</Label>
                <Input
                  id="from_email"
                  value={form.watch("from_email") ?? ""}
                  onChange={(e) => form.setValue("from_email", e.target.value || null, { shouldDirty: true })}
                  disabled={!admin || !form.watch("email_enabled")}
                  placeholder="no-reply@example.com"
                />
                {form.formState.errors.from_email ? (
                  <p className="text-xs text-destructive">{form.formState.errors.from_email.message}</p>
                ) : null}
              </div>

              <div className="flex items-center justify-between rounded-xl border bg-card/60 p-3">
                <div className="grid">
                  <div className="text-sm font-medium">Team notifications</div>
                  <div className="text-xs text-muted-foreground">Notify team leads about server changes.</div>
                </div>
                <Switch
                  checked={Boolean(form.watch("team_notifications_enabled"))}
                  onCheckedChange={(v) => form.setValue("team_notifications_enabled", Boolean(v), { shouldDirty: true })}
                  disabled={!admin}
                />
              </div>

              <div className="flex items-center justify-between border-t pt-5">
                <div className="text-sm text-muted-foreground">{readOnly ? "View-only for Team Leads." : ""}</div>
                <Button type="submit" disabled={!admin || updateM.isPending || !form.formState.isDirty}>
                  {updateM.isPending ? "Saving…" : "Save"}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
