"use client";

import React, { InputHTMLAttributes, forwardRef, ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

// ponytail: single input field layout; upgrade to compound Input.Group if complex adjoined buttons needed.
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, leftIcon, rightIcon, id, ...props }, ref) => {
    return (
      <div className="w-full space-y-1">
        {label && (
          <label htmlFor={id} className="block text-xs font-medium text-text-sub">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-2.5 text-text-sub pointer-events-none flex items-center justify-center">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={id}
            className={cn(
              "w-full h-9 bg-surface-card border border-border-default rounded-sm px-3 text-sm text-text-main",
              "focus:outline-none focus:border-border-focus focus:ring-1 focus:ring-border-focus transition-colors",
              "disabled:bg-surface-muted disabled:text-text-disabled disabled:cursor-not-allowed",
              leftIcon ? "pl-9" : "",
              rightIcon ? "pr-9" : "",
              error ? "border-outflow focus:border-outflow focus:ring-outflow" : "",
              className
            )}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-2.5 text-text-sub pointer-events-none flex items-center justify-center">
              {rightIcon}
            </div>
          )}
        </div>
        {error && <p className="text-xs text-outflow">{error}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";
