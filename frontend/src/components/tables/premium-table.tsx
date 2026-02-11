"use client";

import * as React from "react";
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

// =========================================
// PREMIUM ENTERPRISE TABLE COMPONENTS
// Inspired by Stripe, Linear, AWS Console
// =========================================

interface PremiumTableProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function PremiumTable({ className, children, ...props }: PremiumTableProps) {
  return (
    <div
      className={cn(
        "relative w-full overflow-auto rounded-lg border border-slate-200/60 bg-white shadow-sm dark:border-slate-800/60 dark:bg-slate-950",
        className
      )}
      {...props}
    >
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  );
}

interface PremiumTableHeaderProps extends React.HTMLAttributes<HTMLTableSectionElement> {
  children: React.ReactNode;
}

export function PremiumTableHeader({ className, children, ...props }: PremiumTableHeaderProps) {
  return (
    <thead
      className={cn(
        "sticky top-0 z-10 bg-slate-50/95 backdrop-blur-sm dark:bg-slate-900/95",
        className
      )}
      {...props}
    >
      {children}
    </thead>
  );
}

interface PremiumTableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  sortable?: boolean;
  sortDirection?: "asc" | "desc" | null;
  onSort?: () => void;
}

export function PremiumTableHead({
  className,
  children,
  sortable,
  sortDirection,
  onSort,
  ...props
}: PremiumTableHeadProps) {
  const content = (
    <div className="flex items-center gap-1.5">
      <span>{children}</span>
      {sortable && (
        <span className="text-slate-400 dark:text-slate-600">
          {sortDirection === "asc" ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : sortDirection === "desc" ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronsUpDown className="h-3.5 w-3.5" />
          )}
        </span>
      )}
    </div>
  );

  return (
    <th
      className={cn(
        "border-b border-slate-200 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-600 dark:border-slate-800 dark:text-slate-400",
        sortable && "cursor-pointer select-none hover:text-slate-900 dark:hover:text-slate-200",
        className
      )}
      onClick={sortable ? onSort : undefined}
      {...props}
    >
      {content}
    </th>
  );
}

interface PremiumTableBodyProps extends React.HTMLAttributes<HTMLTableSectionElement> {
  children: React.ReactNode;
}

export function PremiumTableBody({ className, children, ...props }: PremiumTableBodyProps) {
  return (
    <tbody className={cn("divide-y divide-slate-100 dark:divide-slate-900", className)} {...props}>
      {children}
    </tbody>
  );
}

interface PremiumTableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  children: React.ReactNode;
  interactive?: boolean;
}

export function PremiumTableRow({ className, children, interactive = true, ...props }: PremiumTableRowProps) {
  return (
    <tr
      className={cn(
        "group border-b border-slate-100 transition-colors dark:border-slate-900",
        interactive && "hover:bg-slate-50/50 dark:hover:bg-slate-900/50",
        className
      )}
      {...props}
    >
      {children}
    </tr>
  );
}

interface PremiumTableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  children: React.ReactNode;
  numeric?: boolean;
}

export function PremiumTableCell({ className, children, numeric, ...props }: PremiumTableCellProps) {
  return (
    <td
      className={cn(
        "px-4 py-3.5 text-sm text-slate-700 dark:text-slate-300",
        numeric && "text-right tabular-nums",
        className
      )}
      {...props}
    >
      {children}
    </td>
  );
}

// =========================================
// PREMIUM STATUS BADGE
// =========================================

type StatusVariant = "success" | "warning" | "danger" | "secondary" | "info";

interface PremiumStatusBadgeProps {
  variant: StatusVariant;
  children: React.ReactNode;
  dotClassName?: string;
}

const variantStyles: Record<StatusVariant, { container: string; dot: string }> = {
  success: {
    container:
      "bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30",
    dot: "bg-emerald-500",
  },
  warning: {
    container:
      "bg-amber-50 text-amber-700 border-amber-200/60 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30",
    dot: "bg-amber-500",
  },
  danger: {
    container:
      "bg-red-50 text-red-700 border-red-200/60 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/30",
    dot: "bg-red-500",
  },
  secondary: {
    container:
      "bg-slate-50 text-slate-700 border-slate-200/60 dark:bg-slate-950/20 dark:text-slate-400 dark:border-slate-900/30",
    dot: "bg-slate-400",
  },
  info: {
    container:
      "bg-blue-50 text-blue-700 border-blue-200/60 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/30",
    dot: "bg-blue-500",
  },
};

export function PremiumStatusBadge({ variant, children, dotClassName }: PremiumStatusBadgeProps) {
  const styles = variantStyles[variant];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        styles.container
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", styles.dot, dotClassName)} />
      {children}
    </span>
  );
}

// =========================================
// PREMIUM ACTION BUTTON
// =========================================

interface PremiumActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "view" | "edit" | "delete" | "default";
  icon: React.ReactNode;
  tooltip?: string;
}

const actionVariantStyles = {
  view: "hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950/30 dark:hover:text-blue-400",
  edit: "hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-950/30 dark:hover:text-amber-400",
  delete: "hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 dark:hover:text-red-400",
  default: "hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100",
};

export function PremiumActionButton({
  variant = "default",
  icon,
  className,
  ...props
}: PremiumActionButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition-colors dark:text-slate-400",
        "disabled:pointer-events-none disabled:opacity-50",
        actionVariantStyles[variant],
        className
      )}
      {...props}
    >
      {icon}
    </button>
  );
}

// =========================================
// PREMIUM TABLE EMPTY STATE
// =========================================

interface PremiumTableEmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function PremiumTableEmptyState({ icon, title, description, action }: PremiumTableEmptyStateProps) {
  return (
    <tr>
      <td colSpan={100} className="py-16 text-center">
        <div className="flex flex-col items-center gap-3">
          {icon && <div className="text-slate-400 dark:text-slate-600">{icon}</div>}
          <div className="space-y-1">
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{title}</p>
            {description && <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>}
          </div>
          {action && <div className="mt-2">{action}</div>}
        </div>
      </td>
    </tr>
  );
}

// =========================================
// PREMIUM TABLE SKELETON
// =========================================

export function PremiumTableSkeleton({ rows = 5, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} className="border-b border-slate-100 dark:border-slate-900">
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} className="px-4 py-3.5">
              <div className="h-4 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
