"use client";

import React from "react";
import { BadgeVariant, BADGE_STYLES } from "@/lib/design-tokens";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  children: React.ReactNode;
}

// ponytail: reads styles directly from BADGE_STYLES token dictionary; upgrade to dynamic custom themes if runtime user-defined colors added.
export const Badge: React.FC<BadgeProps> = ({ variant = "default", className, children, ...props }) => {
  const style = BADGE_STYLES[variant] || BADGE_STYLES.default;
  return (
    <span
      className={cn(
        "inline-flex items-center px-1.5 py-0.5 rounded-sm text-xs font-medium border font-mono tabular-nums",
        style.bg,
        style.text,
        style.border,
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
};
