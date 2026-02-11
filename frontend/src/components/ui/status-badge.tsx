import { cn } from "@/lib/utils";

export type StatusType = "active" | "inactive" | "maintenance" | "offline" | "decommissioned";

interface StatusBadgeProps {
  status: string | StatusType;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const normalizedStatus = String(status ?? "").toLowerCase().trim();

  // Map status to standardized types
  let type: StatusType = "inactive";
  let label = String(status);

  if (["active", "up", "online", "running", "ok", "healthy"].includes(normalizedStatus)) {
    type = "active";
    label = "Active";
  } else if (["maintenance", "degraded", "warning"].includes(normalizedStatus)) {
    type = "maintenance";
    label = "Maintenance";
  } else if (["offline", "down", "critical", "failed"].includes(normalizedStatus)) {
    type = "offline";
    label = "Offline";
  } else if (["decommissioned", "retired", "archived"].includes(normalizedStatus)) {
    type = "decommissioned";
    label = "Decommissioned";
  } else if (["inactive", "idle", "stopped"].includes(normalizedStatus)) {
    type = "inactive";
    label = "Inactive";
  }

  const statusConfig = {
    active: {
      container: "bg-primary-50 text-primary-700 border-primary-200 dark:bg-primary-900/20 dark:text-primary-400 dark:border-primary-900/30",
      dot: "bg-primary-500",
    },
    inactive: {
      container: "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-900/20 dark:text-gray-400 dark:border-gray-900/30",
      dot: "bg-gray-400",
    },
    maintenance: {
      container: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30",
      dot: "bg-amber-500",
    },
    offline: {
      container: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/30",
      dot: "bg-red-500",
    },
    decommissioned: {
      container: "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-950/20 dark:text-gray-500 dark:border-gray-900/30",
      dot: "bg-gray-400",
    },
  };

  const config = statusConfig[type];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
        config.container,
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", config.dot)} />
      {label}
    </span>
  );
}
