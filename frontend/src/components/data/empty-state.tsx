import * as React from "react";
import { Inbox } from "lucide-react";

export function EmptyState({
  title,
  description,
  icon,
  action,
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border bg-card p-10 text-center sam-shadow">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border bg-muted">
        {icon ?? <Inbox className="h-5 w-5 text-muted-foreground" />}
      </div>
      <div className="mt-1 text-sm font-semibold text-foreground">{title}</div>
      {description ? <div className="max-w-sm text-sm text-muted-foreground">{description}</div> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
