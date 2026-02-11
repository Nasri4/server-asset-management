"use client";

import * as React from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";

import { ConfigTable } from "@/components/settings/config-table";
import { RbacGuard } from "@/components/auth/rbac-guard";
import { useAuth } from "@/components/auth/auth-provider";
import { isAdmin, isTeamLead } from "@/lib/rbac";
import {
  useMaintenancePolicySettings,
  useUpdateMaintenancePolicySettings,
  type MaintenancePolicySettings,
} from "@/lib/api/settings";

const schema = z.object({
  default_duration_minutes: z.number().int().min(5, "Minimum 5 minutes").max(24 * 60, "Maximum 24 hours"),
  approval_required: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

function toForm(v: MaintenancePolicySettings): FormValues {
  return {
    default_duration_minutes: v.default_duration_minutes ?? 60,
    approval_required: Boolean(v.approval_required),
  };
}

export default function MaintenanceConfigSettingsPage() {
  const { user } = useAuth();
  const canEdit = isAdmin(user);

  const q = useMaintenancePolicySettings();
  const m = useUpdateMaintenancePolicySettings();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { default_duration_minutes: 60, approval_required: true },
  });

  React.useEffect(() => {
    if (!q.data) return;
    form.reset(toForm(q.data));
  }, [form, q.data]);

  const submit = async (v: FormValues) => {
    if (!canEdit) return;
    await m.mutateAsync(v);
    toast.success("Maintenance policy saved");
  };

  return (
    <RbacGuard roles={["Admin", "TeamLead"]}>
      <div className="grid gap-6">
        <Tabs defaultValue="types">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="types">Maintenance Types</TabsTrigger>
            <TabsTrigger value="policy">Policy</TabsTrigger>
          </TabsList>

          <TabsContent value="types" className="mt-4">
            <ConfigTable
              configKey="maintenance-types"
              title="Maintenance Types"
              description={canEdit ? "Standardize maintenance classification." : "View-only. Contact an admin to request changes."}
              canEdit={canEdit}
            />
          </TabsContent>

          <TabsContent value="policy" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Maintenance policy</CardTitle>
                <CardDescription>Default duration and approval behavior for new maintenance records.</CardDescription>
              </CardHeader>
              <CardContent>
                {q.isLoading ? (
                  <div className="grid gap-2">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : (
                  <form className="grid gap-5" onSubmit={form.handleSubmit(submit)}>
                    <div className="grid gap-2">
                      <Label htmlFor="default_duration">Default duration (minutes)</Label>
                      <Input
                        id="default_duration"
                        type="number"
                        value={String(form.watch("default_duration_minutes"))}
                        onChange={(e) => form.setValue("default_duration_minutes", Number(e.target.value), { shouldDirty: true })}
                        disabled={!canEdit}
                      />
                      {form.formState.errors.default_duration_minutes ? (
                        <p className="text-xs text-destructive">{form.formState.errors.default_duration_minutes.message}</p>
                      ) : (
                        <p className="text-xs text-muted-foreground">Used as a smart default during scheduling.</p>
                      )}
                    </div>

                    <div className="flex items-center justify-between rounded-xl border bg-card/60 p-3">
                      <div className="grid">
                        <div className="text-sm font-medium">Approval required</div>
                        <div className="text-xs text-muted-foreground">Require approval before marking maintenance as active.</div>
                      </div>
                      <Switch
                        checked={form.watch("approval_required")}
                        onCheckedChange={(v) => form.setValue("approval_required", Boolean(v), { shouldDirty: true })}
                        disabled={!canEdit}
                      />
                    </div>

                    <div className="flex items-center justify-between border-t pt-5">
                      <div className="text-sm text-muted-foreground">
                        {isTeamLead(user) && !isAdmin(user) ? "Team leads can view policy, but edits are restricted to admins." : ""}
                      </div>
                      <Button type="submit" disabled={!canEdit || m.isPending || !form.formState.isDirty}>
                        {m.isPending ? "Saving…" : "Save policy"}
                      </Button>
                    </div>
                  </form>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </RbacGuard>
  );
}
