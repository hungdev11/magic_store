"use client";

import React, { ReactNode } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TableToolbarProps {
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
  searchPlaceholder?: string;
  filters?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

// ponytail: responsive toolbar flex-wrap; upgrade to collapsible filter drawer if active filter count exceeds 5.
export const TableToolbar: React.FC<TableToolbarProps> = ({
  searchTerm,
  onSearchChange,
  searchPlaceholder = "Tìm kiếm...",
  filters,
  actions,
  className,
}) => {
  return (
    <div
      className={cn(
        "bg-surface-card p-3 rounded-md border border-border-subtle shadow-card flex flex-col md:flex-row items-stretch md:items-center gap-2.5",
        className
      )}
    >
      {onSearchChange !== undefined && (
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-sub pointer-events-none" />
          <input
            type="text"
            value={searchTerm ?? ""}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm bg-surface-muted/50 border border-border-subtle rounded-sm focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand text-text-main placeholder:text-text-disabled transition-colors"
          />
        </div>
      )}

      {filters && (
        <div className="flex items-center gap-2 flex-wrap">{filters}</div>
      )}

      {actions && (
        <div className="flex items-center gap-2 shrink-0">{actions}</div>
      )}
    </div>
  );
};
