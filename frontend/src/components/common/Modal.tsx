"use client";

import React, { useEffect, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  className?: string;
}

// ponytail: custom portal-less modal with document body scroll lock; upgrade to Radix Dialog / native <dialog> if focus trapping or portals across iframes needed.
export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  className,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-xl",
    xl: "max-w-3xl",
    full: "max-w-5xl",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 animate-in fade-in duration-100"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "w-full bg-surface-card border border-border-default rounded-md shadow-card flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-100",
          sizeClasses[size],
          className
        )}
      >
        {(title || description) && (
          <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle shrink-0">
            <div>
              {title && <h3 className="text-base font-semibold text-text-main">{title}</h3>}
              {description && <p className="text-xs text-text-sub mt-0.5">{description}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng"
              className="p-1 rounded-sm text-text-sub hover:text-text-main hover:bg-surface-muted transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <div className="p-4 overflow-y-auto flex-1">{children}</div>
        {footer && (
          <div className="px-4 py-3 bg-surface-muted border-t border-border-subtle rounded-b-md flex justify-end gap-2 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
