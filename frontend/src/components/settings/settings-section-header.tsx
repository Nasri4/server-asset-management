"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";

import { getSettingsMetaByPath } from "@/components/settings/settings-nav-items";

export function SettingsSectionHeader() {
  const pathname = usePathname();
  const meta = React.useMemo(() => getSettingsMetaByPath(pathname), [pathname]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
        <Link href="/dashboard" className="hover:text-slate-700">
          Dashboard
        </Link>
        <ChevronRight className="h-3.5 w-3.5 opacity-60" />
        <Link href="/settings" className="hover:text-slate-700">
          Settings
        </Link>
        {meta.href !== "/settings" ? (
          <>
            <ChevronRight className="h-3.5 w-3.5 opacity-60" />
            <span className="text-slate-700">{meta.title}</span>
          </>
        ) : null}
      </div>

      <div className="grid gap-1">
        <h1 className="text-pretty text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
          {meta.title}
        </h1>
        <p className="max-w-3xl text-sm leading-relaxed text-slate-600 md:text-[15px]">{meta.description}</p>
      </div>
    </div>
  );
}
