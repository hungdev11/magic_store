"use client";

import React, { ReactNode } from "react";
import { PackageOpen } from "lucide-react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

// ponytail: centered empty container; upgrade to interactive onboarding tour if empty state initiates multi-step setup.
export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon = PackageOpen,
  title,
  description,
  action,
  className,
}) => {
  return (
    <div
      className={cn(
        "bg-surface-card rounded-md border border-border-subtle p-12 text-center shadow-card flex flex-col items-center justify-center",
        className
      )}
    >
      <div className="w-12 h-12 rounded-md bg-surface-muted flex items-center justify-center text-text-sub mb-3 border border-border-subtle">
        <Icon className="w-6 h-6 text-text-sub" />
      </div>
      <h3 className="text-sm font-semibold text-text-main">{title}</h3>
      {description && (
        <p className="text-xs text-text-sub mt-1 max-w-md leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
};
