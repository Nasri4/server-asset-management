"use client";

import * as React from "react";
import { Activity, RefreshCw, User } from "lucide-react";

import { useInfiniteServerActivity } from "@/lib/api/logs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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

export function ServerActivityTimeline({ serverId }: { serverId: number }) {
  const q = useInfiniteServerActivity(serverId, 25);
  const items = React.useMemo(() => q.data?.pages.flatMap((p) => p.items) ?? [], [q.data]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              Recent Activity
            </CardTitle>
            <CardDescription>Operational timeline for this server.</CardDescription>
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
            <div className="text-destructive">Failed to load activity.</div>
            <Button variant="outline" size="sm" onClick={() => void q.refetch()}>
              Retry
            </Button>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-muted">
              <Activity className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="text-sm font-medium">No activity yet</div>
            <div className="text-sm text-muted-foreground">Changes and events will appear here.</div>
          </div>
        ) : (
          <div className="space-y-5">
            {items.map((e) => (
              <div key={e.activity_id} className="relative flex gap-3">
                <div className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-primary/70 ring-4 ring-primary/15" />
                <div className="min-w-0 flex-1 rounded-xl border bg-card/60 p-3 shadow-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    {e.action ? <Badge variant="secondary">{e.action}</Badge> : null}
                    {e.entity_type ? <Badge variant="outline">{e.entity_type}</Badge> : null}
                    <span className="text-xs text-muted-foreground">{fmt(e.created_at)}</span>
                  </div>

                  <div className="mt-2 text-sm">{e.message ?? "Activity recorded"}</div>

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
