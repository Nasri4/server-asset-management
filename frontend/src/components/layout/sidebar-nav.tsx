"use client";

import Link from "next/link";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import { navForUser } from "@/lib/nav";
import { useAuth } from "@/components/auth/auth-provider";
import { cn } from "@/lib/utils";

export function SidebarNav({ pathname, collapsed = false }: { pathname: string; collapsed?: boolean }) {
  const { user } = useAuth();
  const items = navForUser(user);

  const groups = items.reduce<Record<string, typeof items>>((acc, item) => {
    const key = item.section ?? "";
    if (!acc[key]) acc[key] = [];
    acc[key]!.push(item);
    return acc;
  }, {});

  const orderedSections = [
    "Overview",
    "Infrastructure",
    "Operations",
    "Governance",
    "Admin",
    "",
  ].filter((s) => groups[s]?.length);

  return (
    <TooltipProvider delayDuration={350}>
      <nav className="grid gap-2">
      {orderedSections.map((section) => (
        <div key={section} className="grid gap-1">
          {section ? (
            <div className={cn(
              "px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-sidebar-foreground/60",
              collapsed && "hidden"
            )}>{section}</div>
          ) : null}

          {groups[section]!.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            const link = (
              <Link
                key={item.key}
                href={item.href}
                className={cn(
                  "group relative flex h-9 items-center gap-2 rounded-md px-2.5 text-sm transition-[background-color,color] duration-150",
                  "text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                  active && "bg-sidebar-accent text-sidebar-foreground"
                )}
              >
                {active ? (
                  <span aria-hidden className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r bg-sidebar-primary" />
                ) : null}
                <item.icon
                  className={cn(
                    "h-4 w-4",
                    active ? "text-sidebar-foreground" : "text-sidebar-foreground/75",
                    !collapsed && "transition-transform duration-150 group-hover:translate-x-0.5"
                  )}
                />
                <span className={cn("truncate", collapsed && "hidden", active && "font-semibold")}>{item.label}</span>
              </Link>
            );

            if (!collapsed) return link;

            return (
              <Tooltip key={item.key}>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right" className="border-sidebar-border bg-sidebar text-sidebar-foreground">
                  {item.label}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      ))}
      </nav>
    </TooltipProvider>
  );
}