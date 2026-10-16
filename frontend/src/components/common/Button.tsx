"use client";

import React, { ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost" | "outline";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
}

// ponytail: button uses static variant maps; upgrade to cva (class-variance-authority) if compound variants needed.
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "secondary",
      size = "md",
      isLoading = false,
      disabled,
      type = "button",
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center font-medium transition-colors focus:outline-none focus:ring-1 focus:ring-brand rounded-sm disabled:opacity-50 disabled:cursor-not-allowed select-none";

    const variantStyles: Record<ButtonVariant, string> = {
      primary: "bg-brand text-white hover:bg-brand-hover active:bg-brand-active shadow-sm",
      secondary:
        "bg-surface-card text-text-main border border-border-default hover:bg-surface-muted hover:border-border-focus",
      danger: "bg-outflow text-white hover:opacity-90 active:opacity-100",
      ghost: "text-text-sub hover:text-text-main hover:bg-surface-muted",
      outline: "border border-border-default text-text-main hover:bg-surface-muted",
    };

    const sizeStyles: Record<ButtonSize, string> = {
      sm: "h-8 px-2.5 text-xs gap-1.5",
      md: "h-9 px-3.5 text-sm gap-2",
      lg: "h-11 px-5 text-base gap-2.5",
    };

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        className={cn(baseStyles, variantStyles[variant], sizeStyles[size], className)}
        {...props}
      >
        {isLoading && <Loader2 className="w-4 h-4 animate-spin text-current" />}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
