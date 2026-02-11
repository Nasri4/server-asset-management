// src/app/servers/[id]/edit/page.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, Server as ServerIcon } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/api/client";
import { FadeIn } from "@/components/motion/fade-in";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

import { EditServerDialog } from "../ui/edit-server-dialog";

function unwrapData(res: any) {
  const d1 = res?.data;
  const d2 = d1?.data;
  return d2 !== undefined ? d2 : d1;
}

function getErrorMessage(err: unknown, fallback: string) {
  const e = err as any;
  return e?.response?.data?.error?.message || e?.message || fallback;
}

export default function EditServerPage() {
  const params = useParams();
  const router = useRouter();

  const idParam = React.useMemo(() => {
    const raw = (params as any)?.id;
    return Array.isArray(raw) ? raw[0] : raw;
  }, [params]);

  const serverId = React.useMemo(() => {
    const n = Number.parseInt(String(idParam ?? ""), 10);
    return Number.isFinite(n) ? n : null;
  }, [idParam]);

  const [loading, setLoading] = React.useState(true);
  const [server, setServer] = React.useState<Record<string, unknown> | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    if (!serverId) {
      setError("Invalid server id in URL");
      setServer(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await api.get(`/api/servers/${serverId}`, {
        headers: { "x-sam-silent": "1" },
      });

      const payload = unwrapData(res);
      const s = payload?.server ?? payload?.data?.server ?? payload;

      if (!s?.server_id) throw new Error("Server not found");

      setServer(s);
    } catch (err) {
      const msg = getErrorMessage(err, "Failed to load server");
      setError(msg);
      setServer(null);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [serverId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <FadeIn>
        <div className="space-y-4">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </FadeIn>
    );
  }

  if (error || !serverId) {
    return (
      <FadeIn>
        <Card>
          <CardContent className="p-10 text-center space-y-3">
            <div className="text-sm text-muted-foreground">{error || "Not found"}</div>
            <Button variant="outline" onClick={() => router.push("/servers")}>
              <ChevronLeft className="h-4 w-4 mr-2" />
              Back to Servers
            </Button>
          </CardContent>
        </Card>
      </FadeIn>
    );
  }

  return (
    <FadeIn>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/servers/${serverId}/edit`}>
                <ChevronLeft className="h-4 w-4 mr-2" />
                Back
              </Link>
            </Button>

            <div>
              <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
                <ServerIcon className="h-6 w-6 text-muted-foreground" />
                Edit Server
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Update server metadata. Changes are audited.
              </p>
            </div>
          </div>

          {/* This uses YOUR existing dialog component */}
          <EditServerDialog
            id={serverId}
            server={server}
            onUpdated={async () => {
              await load();
              router.push(`/servers/${serverId}`);
            }}
          />
        </div>

        {/* Preview card */}
        <Card>
          <CardHeader className="border-b bg-muted/20">
            <CardTitle className="text-base font-semibold">Current Values</CardTitle>
          </CardHeader>
          <CardContent className="p-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div>
              <div className="text-xs text-muted-foreground">Server Code</div>
              <div className="font-mono font-semibold">{String(server?.["server_code"] ?? "—")}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Hostname</div>
              <div className="font-medium">{String(server?.["hostname"] ?? "—")}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Environment</div>
              <div className="font-medium">{String(server?.["environment"] ?? "—")}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Role</div>
              <div className="font-medium">{String(server?.["role"] ?? "—")}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Status</div>
              <div className="font-medium">{String(server?.["status"] ?? "—")}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Team</div>
              <div className="font-medium">{String(server?.["team_name"] ?? "—")}</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </FadeIn>
  );
}
