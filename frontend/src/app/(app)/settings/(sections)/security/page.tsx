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

import { useSecuritySettings, useUpdateSecuritySettings } from "@/lib/api/settings";

const schema = z.object({
  min_password_length: z.number().int().min(8).max(128),
  require_numbers: z.boolean(),
  require_symbols: z.boolean(),
  session_timeout_minutes: z.number().int().min(5).max(1440),
  login_attempt_limit: z.number().int().min(3).max(25),
});

type FormValues = z.infer<typeof schema>;

export default function SecuritySettingsPage() {
  const { user } = useAuth();
  const admin = isAdmin(user);
  const readOnly = isTeamLead(user) && !admin;

  if (isEngineer(user)) {
    return <AccessDenied title="Access denied" description="Engineers don’t have access to Settings." backHref="/dashboard" />;
  }

  const q = useSecuritySettings();
  const updateM = useUpdateSecuritySettings();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      min_password_length: 10,
      require_numbers: true,
      require_symbols: false,
      session_timeout_minutes: 240,
      login_attempt_limit: 8,
    },
  });

  React.useEffect(() => {
    if (!q.data) return;
    form.reset({
      min_password_length: q.data.min_password_length ?? 10,
      require_numbers: Boolean(q.data.require_numbers),
      require_symbols: Boolean(q.data.require_symbols),
      session_timeout_minutes: q.data.session_timeout_minutes ?? 240,
      login_attempt_limit: q.data.login_attempt_limit ?? 8,
    });
  }, [form, q.data]);

  const submit = async (v: FormValues) => {
    if (!admin) return;
    await updateM.mutateAsync(v);
    toast.success("Security settings saved");
  };

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Security</CardTitle>
          <CardDescription>Password policy and session controls.</CardDescription>
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
              <div className="grid gap-2">
                <Label htmlFor="minLen">Minimum password length</Label>
                <Input
                  id="minLen"
                  type="number"
                  value={String(form.watch("min_password_length"))}
                  onChange={(e) => form.setValue("min_password_length", Number(e.target.value), { shouldDirty: true })}
                  disabled={!admin}
                />
              </div>

              <div className="flex items-center justify-between rounded-xl border bg-card/60 p-3">
                <div className="grid">
                  <div className="text-sm font-medium">Require numbers</div>
                  <div className="text-xs text-muted-foreground">Enforce digits in passwords.</div>
                </div>
                <Switch
                  checked={form.watch("require_numbers")}
                  onCheckedChange={(v) => form.setValue("require_numbers", Boolean(v), { shouldDirty: true })}
                  disabled={!admin}
                />
              </div>

              <div className="flex items-center justify-between rounded-xl border bg-card/60 p-3">
                <div className="grid">
                  <div className="text-sm font-medium">Require symbols</div>
                  <div className="text-xs text-muted-foreground">Enforce special characters in passwords.</div>
                </div>
                <Switch
                  checked={form.watch("require_symbols")}
                  onCheckedChange={(v) => form.setValue("require_symbols", Boolean(v), { shouldDirty: true })}
                  disabled={!admin}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="session">Session timeout (minutes)</Label>
                <Input
                  id="session"
                  type="number"
                  value={String(form.watch("session_timeout_minutes"))}
                  onChange={(e) => form.setValue("session_timeout_minutes", Number(e.target.value), { shouldDirty: true })}
                  disabled={!admin}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="attempts">Login attempt limit</Label>
                <Input
                  id="attempts"
                  type="number"
                  value={String(form.watch("login_attempt_limit"))}
                  onChange={(e) => form.setValue("login_attempt_limit", Number(e.target.value), { shouldDirty: true })}
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
