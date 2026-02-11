"use client";

import * as React from "react";
import { Download, Filter, Plus, Search, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Premium Data Table Wrapper
 * Provides consistent header, search, and controls for all data tables
 */

interface DataTableWrapperProps {
  title: string;
  description?: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  onAdd?: () => void;
  onExport?: () => void;
  addLabel?: string;
  filterSlot?: React.ReactNode;
  columnToggleSlot?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function DataTableWrapper({
  title,
  description,
  searchValue,
  onSearchChange,
  onAdd,
  onExport,
  addLabel = "Add",
  filterSlot,
  columnToggleSlot,
  children,
  footer,
}: DataTableWrapperProps) {
  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{title}</h1>
          {description && (
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
          )}
        </div>
        <div className="flex gap-2">
          {onExport && (
            <Button variant="outline" size="sm" onClick={onExport}>
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          )}
          {onAdd && (
            <Button size="sm" onClick={onAdd}>
              <Plus className="mr-2 h-4 w-4" />
              {addLabel}
            </Button>
          )}
        </div>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                type="search"
                placeholder="Search..."
                value={searchValue}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              {filterSlot}
              {columnToggleSlot}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {children}
        </CardContent>
      </Card>

      {/* Footer */}
      {footer && (
        <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-400">
          {footer}
        </div>
      )}
    </div>
  );
}
