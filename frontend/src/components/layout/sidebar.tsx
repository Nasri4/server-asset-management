"use client";

import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";

import { SidebarNav } from "@/components/layout/sidebar-nav";
import { useAuth } from "@/components/auth/auth-provider";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

function initials(email?: string) {
  const e = String(email ?? "").trim();
  if (!e) return "?";
  const left = e.split("@")[0] ?? e;
  const parts = left.split(/[._\-\s]+/).filter(Boolean);
  const a = parts[0]?.[0] ?? left[0] ?? "?";
  const b = parts[1]?.[0] ?? "";
  return (a + b).toUpperCase();
}

export function Sidebar({ collapsed }: { collapsed: boolean }) {
  const pathname = usePathname() ?? "";
  const { user, logout } = useAuth();

  return (
    <aside
      className={cn(
        "sam-shadow hidden h-[calc(100dvh-3.5rem)] shrink-0 border-r border-sidebar-border/80 bg-sidebar md:block",
        collapsed ? "w-16" : "w-65"
      )}
    >
      <div className="flex h-full flex-col">
        <div className={cn("flex-1 overflow-y-auto px-0 pt-4 pb-2")}>
          <div className={cn("flex min-h-full flex-col", collapsed && "[&_a]:justify-center")}>
            <SidebarNav pathname={pathname} collapsed={collapsed} />
          </div>
        </div>

        <Separator />

        <div className={cn("flex items-center justify-between gap-2 p-2", collapsed && "flex-col")}>
          <div className={cn("flex items-center gap-2", collapsed && "flex-col")}>
            <Avatar className={cn("size-9 border", collapsed && "hidden")}>
              <AvatarFallback className="bg-sidebar-accent text-xs font-medium text-sidebar-foreground">
                {initials(user?.fullName || user?.username)}
              </AvatarFallback>
            </Avatar>
            <div className={cn("min-w-0", collapsed && "hidden")}>
              <div className="truncate text-xs font-medium text-sidebar-foreground">{user?.fullName || user?.username || ""}</div>
              <div className="text-[11px] text-sidebar-foreground/70">Signed in</div>
            </div>
          </div>

          <div className={cn("flex items-center gap-1", collapsed && "flex-col")}>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Logout"
              onClick={logout}
              className="text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </aside>
  );
}
