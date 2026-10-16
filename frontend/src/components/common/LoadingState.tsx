"use client";

import React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface LoadingStateProps {
  message?: string;
  submessage?: string;
  className?: string;
}

// ponytail: centered spinner card; upgrade to skeleton loaders if content structure preservation is critical.
export const LoadingState: React.FC<LoadingStateProps> = ({
  message = "Đang tải dữ liệu...",
  submessage = "Kết nối máy chủ cơ sở dữ liệu Micro-ERP",
  className,
}) => {
  return (
    <div
      className={cn(
        "bg-surface-card rounded-md border border-border-subtle p-12 text-center shadow-card flex flex-col items-center justify-center",
        className
      )}
    >
      <Loader2 className="w-7 h-7 animate-spin text-brand mb-3" />
      <p className="text-sm font-semibold text-text-main">{message}</p>
      {submessage && (
        <p className="text-xs text-text-sub mt-1 max-w-sm">{submessage}</p>
      )}
    </div>
  );
};
