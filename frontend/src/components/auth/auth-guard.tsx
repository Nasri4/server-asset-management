"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

import { useAuth } from "@/components/auth/auth-provider";
import { Skeleton } from "@/components/ui/skeleton";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();

  React.useEffect(() => {
    if (loading) return;
    if (user) return;
    if (typeof window === "undefined") return;

    // If the user explicitly clicked Logout, always send them to login
    // without preserving the current route as a post-login destination.
    const explicitLogout = window.sessionStorage.getItem("auth:explicitLogout");
    if (explicitLogout === "1") {
      window.sessionStorage.removeItem("auth:explicitLogout");
      window.location.href = "/login";
      return;
    }

    const next = pathname && pathname !== "/login" ? `?next=${encodeURIComponent(pathname)}` : "";
    window.location.href = `/login${next}`;
  }, [loading, pathname, user]);

  if (loading) {
    return (
      <div className="p-6">
        <div className="grid gap-3">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-96" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!user) return null;

  return <>{children}</>;
}
