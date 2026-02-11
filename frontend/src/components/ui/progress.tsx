import * as React from "react";

import { cn } from "@/lib/utils";

type ProgressProps = React.ComponentProps<"div"> & {
  value?: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function Progress({ value = 0, className, ...props }: ProgressProps) {
  const clampedValue = clamp(Number.isFinite(value) ? value : 0, 0, 100);

  return (
    <div
      data-slot="progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clampedValue}
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-full bg-slate-100",
        className
      )}
      {...props}
    >
      <div
        data-slot="progress-indicator"
        className="h-full w-full flex-1 bg-slate-900 transition-transform"
        style={{ transform: `translateX(-${100 - clampedValue}%)` }}
      />
    </div>
  );
}
