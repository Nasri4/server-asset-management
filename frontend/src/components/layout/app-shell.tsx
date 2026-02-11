"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { FloatingActions } from "@/components/layout/floating-actions";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = React.useState(false);
  const pathname = usePathname();

  React.useEffect(() => {
    const saved = window.localStorage.getItem("sam.sidebar.collapsed");
    if (saved === "1") setCollapsed(true);
  }, []);

  const toggleCollapsed = React.useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem("sam.sidebar.collapsed", next ? "1" : "0");
      return next;
    });
  }, []);

  React.useEffect(() => {
    const scrollToHash = () => {
      const raw = window.location.hash;
      const id = raw.startsWith("#") ? raw.slice(1) : raw;
      if (!id) return;

      // Allow layout/route transitions to settle.
      window.setTimeout(() => {
        const el = document.getElementById(id);
        if (!el) return;
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
    };

    scrollToHash();
    window.addEventListener("hashchange", scrollToHash);
    return () => window.removeEventListener("hashchange", scrollToHash);
  }, [pathname]);

  return (
    <div className="sam-app-bg flex h-dvh w-full flex-col bg-background">
      <Topbar collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />

      <div className="flex min-h-0 flex-1">
        <Sidebar collapsed={collapsed} />

        <main className="min-h-0 flex-1 overflow-y-auto bg-slate-50">
          <div className="mx-auto w-full max-w-360 px-3 py-4 pb-24 md:px-6 md:py-6 md:pb-28">{children}</div>
        </main>
      </div>

      <FloatingActions />
    </div>
  );
}
