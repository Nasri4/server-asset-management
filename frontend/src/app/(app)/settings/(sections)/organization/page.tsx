"use client";

import * as React from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/components/auth/auth-provider";
import { isAdmin, isTeamLead } from "@/lib/rbac";
import {
  useOrganizationSettings,
  useUpdateOrganizationSettings,
  type OrganizationSettings,
} from "@/lib/api/settings";

const schema = z.object({
  name: z.string().min(2, "Organization name is required"),
  logo_url: z.string().url("Logo must be a valid URL").optional().or(z.literal("")),
  timezone: z.string().min(2, "Timezone is required"),
  default_theme: z.enum(["system", "light", "dark"]),
});

type FormValues = z.infer<typeof schema>;

const TIMEZONES = [
  "UTC",
  "Africa/Mogadishu",
  "Africa/Nairobi",
  "Europe/London",
  "Europe/Paris",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "America/New_York",
  "America/Los_Angeles",
] as const;

function toForm(s: OrganizationSettings): FormValues {
  return {
    name: s.name ?? "",
    logo_url: s.logo_url ?? "",
    timezone: s.timezone ?? "UTC",
    default_theme: s.default_theme ?? "system",
  };
}

export default function OrganizationSettingsPage() {
  const { user } = useAuth();
  const canEdit = isAdmin(user);
  const readOnly = isTeamLead(user) && !canEdit;

  const q = useOrganizationSettings();
  const m = useUpdateOrganizationSettings();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", logo_url: "", timezone: "UTC", default_theme: "system" },
  });

  React.useEffect(() => {
    if (!q.data) return;
    form.reset(toForm(q.data));
  }, [q.data, form]);

  const onSubmit = async (values: FormValues) => {
    if (!canEdit) return;
    await m.mutateAsync({
      name: values.name,
      logo_url: values.logo_url ? values.logo_url : null,
      timezone: values.timezone,
      default_theme: values.default_theme,
    });
    toast.success("Organization settings saved");
  };

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Organization</CardTitle>
          <CardDescription>Identity and defaults applied across the platform.</CardDescription>
        </CardHeader>
        <CardContent>
          {q.isLoading ? (
            <div className="grid gap-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <form className="grid gap-5" onSubmit={form.handleSubmit(onSubmit)}>
              <div className="grid gap-2">
                <Label htmlFor="org_name">Organization name</Label>
                <Input id="org_name" placeholder="Hormuud Telecom" {...form.register("name")} disabled={!canEdit} />
                {form.formState.errors.name ? (
                  <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
                ) : null}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="org_logo">Logo URL (optional)</Label>
                <Input id="org_logo" placeholder="https://…" {...form.register("logo_url")} disabled={!canEdit} />
                {form.formState.errors.logo_url ? (
                  <p className="text-xs text-destructive">{form.formState.errors.logo_url.message}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">Store a hosted logo URL. File upload can be added later.</p>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Timezone</Label>
                  <Select
                    value={form.watch("timezone")}
                    onValueChange={(v) => form.setValue("timezone", v, { shouldDirty: true })}
                    disabled={!canEdit}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select timezone" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEZONES.map((tz) => (
                        <SelectItem key={tz} value={tz}>
                          {tz}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label>Default theme</Label>
                  <Select
                    value={form.watch("default_theme")}
                    onValueChange={(v) => form.setValue("default_theme", v as any, { shouldDirty: true })}
                    disabled={!canEdit}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Theme" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="system">System</SelectItem>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="dark">Dark</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-5">
                <div className="text-sm text-muted-foreground">
                  {readOnly ? "Team leads can view organization defaults, but cannot edit." : ""}
                </div>
                <Button type="submit" disabled={!canEdit || m.isPending || !form.formState.isDirty}>
                  {m.isPending ? "Saving…" : "Save changes"}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
