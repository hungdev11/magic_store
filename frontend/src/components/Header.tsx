"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useStoreProfile } from "@/lib/store";
import { Store, RefreshCw, CheckCircle2, AlertCircle, ShoppingCart } from "lucide-react";

export function Header() {
  const pathname = usePathname();
  const { storeSetting, fetchSettings, isLoading, error } = useStoreProfile();

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  if (pathname === "/pos" || pathname?.startsWith("/pos/")) {
    return null;
  }

  return (
    <header className="h-16 bg-surface-card border-b border-border-subtle px-6 flex items-center justify-between sticky top-0 z-10 shadow-sm">
      {/* Left: Store identity & costing method */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Store className="w-5 h-5 text-brand" />
          <h1 className="font-semibold text-text-main text-base">
            {storeSetting?.name || "Cửa Hàng"}
          </h1>
        </div>
        <span className="text-border-default">|</span>
        <div className="flex items-center gap-1.5 text-xs text-text-sub">
          <span>Phương pháp tính giá vốn:</span>
          <span className="font-semibold text-brand px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200">
            {storeSetting?.costing_method || "WAC"} (Bình quân gia quyền)
          </span>
        </div>
      </div>

      {/* Right: Sync Status & Currency Indicator */}
      <div className="flex items-center gap-4">
        {isLoading ? (
          <div className="flex items-center gap-1.5 text-xs text-text-sub">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-brand" />
            <span>Đang đồng bộ...</span>
          </div>
        ) : error ? (
          <div className="flex items-center gap-1.5 text-xs text-rose-600 bg-rose-50 px-2 py-1 rounded border border-rose-200">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Mất kết nối máy chủ</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Đã kết nối Backend</span>
          </div>
        )}

        <div className="text-xs font-medium text-text-sub bg-surface-muted px-2.5 py-1 rounded border border-border-subtle">
          Đơn vị tiền tệ: <strong className="text-text-main">{storeSetting?.currency || "VND"}</strong>
        </div>

        <Link
          href="/pos"
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition-colors"
        >
          <ShoppingCart className="w-4 h-4" />
          <span>Bán hàng POS</span>
          <span className="bg-emerald-500/60 text-[10px] font-bold px-1.5 py-0.5 rounded text-white border border-emerald-400/40">
            F8
          </span>
        </Link>
      </div>
    </header>
  );
}
