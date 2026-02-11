"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useAuth } from "@/components/auth/auth-provider";
import { AccessDenied } from "@/components/settings/access-denied";
import { visibleSettingsNav } from "@/components/settings/settings-nav-items";
import { isAdmin, isEngineer, isTeamLead } from "@/lib/rbac";
import { cn } from "@/lib/utils";

import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ArrowRight, ChevronRight, Loader2 } from "lucide-react";

function RoleBadge({ role }: { role: "Admin" | "TeamLead" | "Engineer" | "Unknown" }) {
  const variant = role === "Admin" ? "success" : role === "TeamLead" ? "info" : role === "Engineer" ? "warning" : "secondary";
  return <Badge variant={variant}>{role}</Badge>;
}

function SectionCard({
  href,
  title,
  description,
  icon: Icon,
  readOnly,
}: {
  href: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  readOnly?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group relative overflow-hidden rounded-2xl border bg-card/60 p-4 shadow-sm transition",
        "hover:bg-accent/25 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/35"
      )}
    >
      <div className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full bg-emerald-500/10 blur-2xl" />
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border bg-background/40">
            <Icon className="h-5 w-5 text-foreground/80" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <div className="truncate text-sm font-semibold">{title}</div>
              {readOnly ? <Badge variant="outline">View-only</Badge> : null}
            </div>
            <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{description}</div>
          </div>
        </div>

        <div className="flex h-9 w-9 items-center justify-center rounded-full border bg-background/30 text-muted-foreground transition group-hover:text-foreground/80">
          <ChevronRight className="h-4 w-4" />
        </div>
      </div>
    </Link>
  );
}

function RedirectingState({
  targetHref,
  targetLabel,
  onCancel,
}: {
  targetHref: string;
  targetLabel: string;
  onCancel: () => void;
}) {
  return (
    <Card className="relative overflow-hidden rounded-2xl">
      <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-emerald-500/10 via-transparent to-cyan-500/10" />
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-foreground/70" />
          Redirecting…
        </CardTitle>
        <CardDescription>Opening {targetLabel}.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild size="sm">
            <Link href={targetHref}>
              Continue now
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={onCancel}>
            Stay on overview
          </Button>
        </div>

        <div className="text-xs text-muted-foreground">Tip: Use the sidebar to jump between sections.</div>
      </CardContent>
    </Card>
  );
}

export default function SettingsIndexPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [canceled, setCanceled] = React.useState(false);

  const nav = React.useMemo(() => visibleSettingsNav(user), [user]);
  const role: "Admin" | "TeamLead" | "Engineer" | "Unknown" = React.useMemo(() => {
    if (!user) return "Unknown";
    if (isAdmin(user)) return "Admin";
    if (isTeamLead(user)) return "TeamLead";
    if (isEngineer(user)) return "Engineer";
    return "Unknown";
  }, [user]);

  const target = nav[0] ?? null;

  React.useEffect(() => {
    if (loading) return;
    if (!user) return;
    if (!target) return;
    if (canceled) return;

    const timer = setTimeout(() => {
      router.replace(target.href);
    }, 350);

    return () => clearTimeout(timer);
  }, [canceled, loading, router, target, user]);

  if (loading) return null;
  if (!user) return null;

  if (isEngineer(user) || nav.length === 0) {
    return (
      <AccessDenied
        title="Access denied"
        description="Engineers don’t have access to Settings."
        backHref="/dashboard"
      />
    );
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Settings"
        description={
          <span>
            Manage your organization settings, team permissions, and system configurations. {" "}
            <span className="inline-flex items-center gap-2">
              <span className="text-muted-foreground">Signed in as</span> <RoleBadge role={role} />
            </span>
          </span>
        }
      />

      {!canceled && target ? (
        <RedirectingState
          targetHref={target.href}
          targetLabel={target.title}
          onCancel={() => setCanceled(true)}
        />
      ) : null}

      <Alert>
        <AlertTitle>Quick start</AlertTitle>
        <AlertDescription>
          Use the cards below to open a section instantly. Admins can edit everything; Team Leads see a reduced view and some pages are view-only.
        </AlertDescription>
      </Alert>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {nav.map((i) => (
          <SectionCard
            key={i.key}
            href={i.href}
            title={i.title}
            description={i.description}
            icon={i.icon}
            readOnly={Boolean(i.teamLeadReadOnly) && isTeamLead(user) && !isAdmin(user)}
          />
        ))}
      </div>
    </div>
  );
}