"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

import { api } from "@/lib/api/client";
import type { AuthUser } from "@/lib/api/types";

type AuthState = {
  user: AuthUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = React.createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<AuthUser | null>(null);
  const [loading, setLoading] = React.useState(true);
  const pathname = usePathname();

  const refresh = React.useCallback(async () => {
    try {
      const res = await api.get("/auth/me");
      // backend uses ok(res, data) wrapper -> { ok: true, data: ... }
      const data = (res.data?.data ?? res.data) as AuthUser;
      setUser(data ?? null);
    } catch {
      setUser(null);
    }
  }, []);

  const logout = React.useCallback(async () => {
    try {
      if (typeof window !== "undefined") {
        // Used by AuthGuard to avoid redirecting back to the current protected route.
        window.sessionStorage.setItem("auth:explicitLogout", "1");
      }
      await api.post("/auth/logout");
    } finally {
      setUser(null);
      if (typeof window !== "undefined") window.location.href = "/login";
    }
  }, []);

  React.useEffect(() => {
    // Avoid auth fetch loops on login page.
    if (pathname?.startsWith("/login")) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      setLoading(true);
      await refresh();
      if (!cancelled) setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [pathname, refresh]);

  return (
    <AuthContext.Provider value={{ user, loading, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
