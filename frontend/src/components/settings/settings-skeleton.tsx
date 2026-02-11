"use client";

import { Skeleton } from "@/components/ui/skeleton";

export function SettingsSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="grid gap-3">
      <Skeleton className="h-10 w-72" />
      <Skeleton className="h-4 w-[28rem]" />
      <div className="grid gap-2 pt-2">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}
