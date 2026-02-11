"use client";

import * as React from "react";
import { Shield, RefreshCw, User } from "lucide-react";

import { useInfiniteServerAudits } from "@/lib/api/logs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/components/auth/auth-provider";
import { isEngineer } from "@/lib/rbac";
import { AccessDenied } from "@/components/settings/access-denied";

const dateTimeFmt = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function fmt(ts: string) {
  const d = new Date(ts);
  if (!Number.isFinite(d.getTime())) return ts;
  return dateTimeFmt.format(d);
}

export function ServerAuditTimeline({ serverId }: { serverId: number }) {
  const { user } = useAuth();

  if (isEngineer(user)) {
    return (
      <AccessDenied
        title="Audits restricted"
        description="Audit logs contain sensitive metadata. Your role can view activity, but not audits by default."
      />
    );
  }

  const q = useInfiniteServerAudits(serverId, 25);
  const items = React.useMemo(() => q.data?.pages.flatMap((p) => p.items) ?? [], [q.data]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              Audit Timeline
            </CardTitle>
            <CardDescription>Immutable audit events for this server.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => void q.refetch()} disabled={q.isFetching}>
            <RefreshCw className={q.isFetching ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} />
            Refresh
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {q.isLoading ? (
          <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">Loading…</div>
        ) : q.isError ? (
          <div className="space-y-3 py-6 text-sm">
            <div className="text-destructive">Failed to load audit logs.</div>
            <Button variant="outline" size="sm" onClick={() => void q.refetch()}>
              Retry
            </Button>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-muted">
              <Shield className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="text-sm font-medium">No audit events yet</div>
            <div className="text-sm text-muted-foreground">Administrative changes will appear here.</div>
          </div>
        ) : (
          <div className="space-y-5">
            {items.map((e) => (
              <div key={e.audit_id} className="relative flex gap-3">
                <div className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-foreground/70 ring-4 ring-foreground/10" />
                <div className="min-w-0 flex-1 rounded-xl border bg-card/60 p-3 shadow-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{e.action}</Badge>
                    <Badge variant="outline">{e.entity_type}</Badge>
                    <span className="text-xs text-muted-foreground">{fmt(e.created_at)}</span>
                  </div>

                  <div className="mt-2 text-sm">
                    {e.entity_id ? (
                      <span>
                        Target: <span className="font-mono text-foreground/90">{e.entity_id}</span>
                      </span>
                    ) : (
                      "Audit recorded"
                    )}
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <User className="h-3.5 w-3.5" />
                    <span className="font-medium text-foreground">
                      {e.actor?.full_name ?? "Unknown"}
                    </span>
                    {e.actor?.role_name ? <span>· {e.actor.role_name}</span> : null}
                    {e.actor?.team_name ? <span>· {e.actor.team_name}</span> : null}
                  </div>
                </div>
              </div>
            ))}

            <div className="pt-2">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => void q.fetchNextPage()}
                disabled={!q.hasNextPage || q.isFetchingNextPage}
              >
                {q.isFetchingNextPage ? "Loading…" : q.hasNextPage ? "Load more" : "End of timeline"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
