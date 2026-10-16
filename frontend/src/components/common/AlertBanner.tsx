"use client";

import React from "react";
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type AlertType = "success" | "error" | "warning" | "info";

export interface AlertBannerProps {
  type?: AlertType;
  message: string;
  onClose?: () => void;
  className?: string;
}

const ALERT_CONFIG: Record<
  AlertType,
  { container: string; iconClass: string; icon: React.ComponentType<{ className?: string }> }
> = {
  success: {
    container: "bg-emerald-50 border-emerald-200 text-emerald-900",
    iconClass: "text-emerald-700",
    icon: CheckCircle2,
  },
  error: {
    container: "bg-rose-50 border-rose-200 text-rose-900",
    iconClass: "text-rose-700",
    icon: AlertCircle,
  },
  warning: {
    container: "bg-amber-50 border-amber-200 text-amber-900",
    iconClass: "text-amber-800",
    icon: AlertTriangle,
  },
  info: {
    container: "bg-sky-50 border-sky-200 text-sky-900",
    iconClass: "text-sky-700",
    icon: Info,
  },
};

// ponytail: static toast banner; upgrade to a global toast store (Sonner / ToastProvider) if stacked timed alerts needed.
export const AlertBanner: React.FC<AlertBannerProps> = ({
  type = "info",
  message,
  onClose,
  className,
}) => {
  const config = ALERT_CONFIG[type];
  const Icon = config.icon;

  return (
    <div
      role="alert"
      className={cn(
        "p-3 rounded-md border flex items-center justify-between gap-3 text-xs sm:text-sm animate-in fade-in duration-100",
        config.container,
        className
      )}
    >
      <div className="flex items-center gap-2.5">
        <Icon className={cn("w-4 h-4 shrink-0", config.iconClass)} />
        <span className="font-medium">{message}</span>
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng thông báo"
          className="p-1 rounded-sm text-text-sub hover:text-text-main transition-colors shrink-0"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
