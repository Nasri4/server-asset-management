"use client";

import * as React from "react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth/auth-provider";
import { AccessDenied } from "@/components/settings/access-denied";
import { isAdmin, isEngineer } from "@/lib/rbac";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "../../../../../components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";

import { useResetOperationalData, type ResetTarget } from "@/lib/api/settings";

const RESET_PHRASE = "RESET" as const;

const TARGETS: Array<{ key: ResetTarget; label: string; description: string }> = [
  { key: "Servers", label: "Servers", description: "Deletes server records (inventory)." },
  { key: "Maintenances", label: "Maintenances", description: "Deletes maintenance schedules and history." },
  { key: "Activities", label: "Activities", description: "Deletes activity feed entries." },
  { key: "AuditLogs", label: "Audit logs", description: "Deletes audit trail entries." },
];

export default function DataManagementSettingsPage() {
  const { user } = useAuth();
  const resetM = useResetOperationalData();

  if (isEngineer(user)) {
    return <AccessDenied title="Access denied" description="Engineers don’t have access to Settings." backHref="/dashboard" />;
  }

  if (!isAdmin(user)) {
    return <AccessDenied title="Admin only" description="This section is restricted to administrators." backHref="/settings" />;
  }

  const [selected, setSelected] = React.useState<ResetTarget[]>([]);
  const [confirm, setConfirm] = React.useState("");

  const canReset = selected.length > 0 && confirm.trim() === RESET_PHRASE && !resetM.isPending;

  const toggle = (t: ResetTarget) => {
    setSelected((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  };

  const onReset = async () => {
    if (!canReset) return;
    const res = await resetM.mutateAsync({ targets: selected, confirm: confirm.trim() });
    toast.success(res.job_id ? `Reset started (job ${res.job_id})` : "Reset completed");
    setSelected([]);
    setConfirm("");
  };

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Data Management</CardTitle>
          <CardDescription>Exports and destructive operational resets.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          <Alert variant="destructive">
            <AlertTitle>Danger zone</AlertTitle>
            <AlertDescription>These actions are irreversible. Use only for staging resets or emergency recovery.</AlertDescription>
          </Alert>

          <div className="grid gap-3">
            {TARGETS.map((t) => (
              <div
                key={t.key}
                role="button"
                tabIndex={0}
                className="flex cursor-pointer items-start gap-3 rounded-xl border bg-card/60 p-3 text-left transition hover:bg-accent/30 focus:outline-none focus:ring-2 focus:ring-ring/40"
                onClick={() => toggle(t.key)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggle(t.key);
                  }
                }}
              >
                <div onClick={(e) => e.stopPropagation()}>
                  <Checkbox checked={selected.includes(t.key)} onCheckedChange={() => toggle(t.key)} />
                </div>
                <div className="grid gap-1">
                  <div className="text-sm font-medium">{t.label}</div>
                  <div className="text-xs text-muted-foreground">{t.description}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="confirm">Type {RESET_PHRASE} to confirm</Label>
            <Input
              id="confirm"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder={RESET_PHRASE}
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">Select at least one target, then type {RESET_PHRASE}.</p>
          </div>

          <div className="flex items-center justify-end border-t pt-5">
            <Button variant="destructive" onClick={() => void onReset()} disabled={!canReset}>
              {resetM.isPending ? "Resetting…" : "Reset selected data"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
