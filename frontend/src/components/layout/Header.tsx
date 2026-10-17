"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useStoreProfile } from "@/lib/store";
import { api, Warehouse as WarehouseType } from "@/lib/api";
import {
  Store,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Warehouse,
  ChevronDown,
} from "lucide-react";

// ponytail: sticky app bar with connection poll and warehouse indicator; upgrade to multi-tenant branch context if needed.
export function Header() {
  const pathname = usePathname();
  const { storeSetting, fetchSettings, isLoading, error } = useStoreProfile();
  const [warehouses, setWarehouses] = useState<WarehouseType[]>([]);
  const [selectedWhId, setSelectedWhId] = useState<string>("");

  useEffect(() => {
    fetchSettings();
    api
      .getWarehouses(true)
      .then((whs) => {
        setWarehouses(whs || []);
        if (whs && whs.length > 0) {
          const def = whs.find((w) => w.is_default);
          setSelectedWhId(def ? def.id : whs[0].id);
        }
      })
      .catch(() => {});
  }, [fetchSettings]);

  if (pathname === "/pos" || pathname?.startsWith("/pos/")) {
    return null;
  }

  return (
    <header className="h-14 bg-surface-card border-b border-border-subtle px-4 sm:px-6 flex items-center justify-between sticky top-0 z-10 shadow-sm">
      {/* Left: Store identity & costing method */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Store className="w-4 h-4 text-brand" />
          <span className="font-semibold text-text-main text-sm truncate max-w-[200px]">
            {storeSetting?.name || "Cửa Hàng"}
          </span>
        </div>
        <span className="text-border-default hidden sm:inline">|</span>
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-text-sub">
          <span>Giá vốn:</span>
          <span className="font-semibold text-brand px-1.5 py-0.5 rounded-sm bg-emerald-50 border border-emerald-200">
            {storeSetting?.costing_method || "WAC"}
          </span>
        </div>

        {/* Warehouse Indicator */}
        {warehouses.length > 0 && (
          <>
            <span className="text-border-default hidden md:inline">|</span>
            <div className="hidden md:flex items-center gap-1.5 text-xs bg-surface-app border border-border-subtle rounded-lg px-2.5 py-1">
              <Warehouse className="w-3.5 h-3.5 text-brand" />
              <select
                value={selectedWhId}
                onChange={(e) => setSelectedWhId(e.target.value)}
                className="bg-transparent text-text-main font-medium focus:outline-none cursor-pointer text-xs"
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} {w.is_default ? "★" : ""}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}
      </div>

      {/* Right: Sync Status & Currency Indicator */}
      <div className="flex items-center gap-3">
        {isLoading ? (
          <div className="flex items-center gap-1 text-xs text-text-sub">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-brand" />
            <span className="hidden md:inline">Đang đồng bộ</span>
          </div>
        ) : error ? (
          <div className="flex items-center gap-1 text-xs text-rose-700 bg-rose-50 px-2 py-0.5 rounded-sm border border-rose-200">
            <AlertCircle className="w-3.5 h-3.5 text-rose-700" />
            <span className="hidden md:inline">Mất kết nối</span>
          </div>
        ) : (
          <div className="flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-sm border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
            <span className="hidden md:inline">Kết nối tốt</span>
          </div>
        )}

        <div className="text-xs font-medium text-text-sub bg-surface-muted px-2 py-1 rounded-sm border border-border-subtle tabular-nums font-mono">
          {storeSetting?.currency || "VND"}
        </div>
      </div>
    </header>
  );
}
