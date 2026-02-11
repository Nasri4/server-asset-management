"use client";

import * as React from "react";
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type SortDir = "asc" | "desc";

export function TableToolbar({
  search,
  onSearch,
  placeholder = "Search…",
  right,
}: {
  search: string;
  onSearch: (value: string) => void;
  placeholder?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="w-full md:max-w-md">
        <Input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder={placeholder}
          className="h-10 bg-card"
        />
      </div>
      {right ? <div className="flex flex-wrap items-center gap-2">{right}</div> : null}
    </div>
  );
}

export function SortableTh({
  label,
  active,
  dir,
  onToggle,
  className,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onToggle: () => void;
  className?: string;
}) {
  const Icon = !active ? ChevronsUpDown : dir === "asc" ? ChevronUp : ChevronDown;
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-left text-sm font-medium text-foreground hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        className
      )}
      aria-label={`Sort by ${label}`}
    >
      <span className="whitespace-nowrap">{label}</span>
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
    </button>
  );
}

export function TablePagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(total, safePage * pageSize);

  return (
    <div className="flex flex-col gap-3 border-t pt-4 md:flex-row md:items-center md:justify-between">
      <div className="text-sm text-muted-foreground">
        {start}-{end} of {total}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Rows</span>
          <select
            className="sam-select h-9 w-auto"
            value={String(pageSize)}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
          >
            {[10, 20, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.max(1, safePage - 1))}
          disabled={safePage <= 1}
        >
          Prev
        </Button>
        <div className="text-sm text-muted-foreground">
          Page <span className="font-medium text-foreground">{safePage}</span> / {totalPages}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
          disabled={safePage >= totalPages}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

export function toSearchText(...parts: Array<string | number | boolean | null | undefined>) {
  return parts
    .filter((p) => p !== null && p !== undefined)
    .join(" ")
    .toLowerCase();
}
