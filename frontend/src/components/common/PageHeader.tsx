"use client";

import React, { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export interface PageHeaderProps {
  title: string;
  description?: string;
  badge?: ReactNode;
  actions?: ReactNode;
  backHref?: string;
}

// ponytail: layout flex header with optional back-link; upgrade to breadcrumb trail if hierarchy exceeds 3 levels.
export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  badge,
  actions,
  backHref,
}) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
      <div className="flex items-start gap-3">
        {backHref && (
          <Link
            href={backHref}
            className="p-1.5 mt-0.5 rounded-sm border border-border-default text-text-sub hover:text-text-main hover:bg-surface-muted transition-colors shrink-0"
            aria-label="Quay lại"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
        )}
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold text-text-main tracking-tight">
              {title}
            </h1>
            {badge && <div>{badge}</div>}
          </div>
          {description && (
            <p className="text-xs sm:text-sm text-text-sub mt-1 leading-relaxed">
              {description}
            </p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {actions}
        </div>
      )}
    </div>
  );
};
