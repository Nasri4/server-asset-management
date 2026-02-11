"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lock } from "lucide-react";

import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth/auth-provider";
import { Badge } from "@/components/ui/badge";
import { visibleSettingsNav } from "@/components/settings/settings-nav-items";

function groupItems<T extends { group: string }>(items: T[]) {
  const groups = items.reduce<Record<string, T[]>>((acc, item) => {
    (acc[item.group] ??= []).push(item);
    return acc;
  }, {});

  const order = ["Global Settings", "Team Settings", "Operations", "Security", "Data"];
  return order
    .filter((g) => (groups[g]?.length ?? 0) > 0)
    .map((g) => ({ title: g, items: groups[g]! }));
}

export function SettingsNav({
  onNavigate,
  variant = "desktop",
}: {
  onNavigate?: () => void;
  variant?: "desktop" | "mobile";
}) {
  const pathname = usePathname();
  const { user } = useAuth();
  const items = React.useMemo(() => visibleSettingsNav(user), [user]);

  const grouped = React.useMemo(() => groupItems(items), [items]);

  return (
    <nav className="grid gap-6">
      {grouped.map((group) => (
        <div key={group.title} className="grid gap-2">
          <div className="px-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
            {group.title}
          </div>
          <div className="grid gap-1">
            {group.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              const Icon = item.icon;
              const showReadOnly = !active && Boolean(item.teamLeadReadOnly) && !item.adminOnly;

              return (
                <Link
                  key={item.key}
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                    active
                      ? "bg-emerald-50 text-emerald-700"
                      : "text-slate-700 hover:bg-slate-50"
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  <span
                    className={cn(
                      "absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-transparent",
                      active && "bg-emerald-500"
                    )}
                  />

                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0",
                      active ? "text-emerald-600" : "text-slate-400 group-hover:text-slate-500"
                    )}
                  />

                  <span className="min-w-0 flex-1 truncate font-medium">
                    {item.title}
                  </span>

                  {showReadOnly ? (
                    <Badge variant="outline" className="h-5 border-slate-200 bg-white px-2 text-[11px] text-slate-600">
                      <Lock className="mr-1 h-3 w-3" />
                      View-only
                    </Badge>
                  ) : null}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
