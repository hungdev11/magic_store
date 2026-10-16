"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useStoreProfile } from "@/lib/store";
import {
  LayoutDashboard,
  Package,
  ArrowDownToLine,
  Factory,
  Trash2,
  Settings,
  Scale,
  Sparkles,
  Layers,
  WalletCards,
  ShoppingCart,
} from "lucide-react";

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  moduleKey?: string;
}

export function Sidebar() {
  const pathname = usePathname();
  const { isModuleEnabled, storeSetting } = useStoreProfile();

  if (pathname === "/pos" || pathname?.startsWith("/pos/")) {
    return null;
  }

  const navItems: NavItem[] = [
    {
      name: "Bán hàng POS",
      href: "/pos",
      icon: ShoppingCart,
      badge: "POS",
    },
    {
      name: "Tổng quan",
      href: "/",
      icon: LayoutDashboard,
    },
    {
      name: "Sản phẩm & Hàng hóa",
      href: "/products",
      icon: Package,
    },
    {
      name: "Nhập hàng (PO)",
      href: "/inventory/purchase",
      icon: ArrowDownToLine,
    },
  ];

  // Conditional routes based on enabled_modules
  if (isModuleEnabled("bom_production")) {
    navItems.push({
      name: "Chế biến & Phân rã",
      href: "/production",
      icon: Factory,
      badge: "BOM",
    });
  }

  // Wastage is available when batch_expiry is active or general loss tracking
  if (isModuleEnabled("batch_expiry")) {
    navItems.push({
      name: "Hủy hàng & Hao hụt",
      href: "/inventory/wastage",
      icon: Trash2,
      badge: "Lô/Hạn",
    });
  }

  // Credit ledger is available when credit_ledger is active
  if (isModuleEnabled("credit_ledger")) {
    navItems.push({
      name: "Sổ nợ & Đối tác",
      href: "/partners",
      icon: WalletCards,
      badge: "Công nợ",
    });
  }

  // Settings is always available
  navItems.push({
    name: "Cài đặt Cửa hàng",
    href: "/settings",
    icon: Settings,
  });

  return (
    <aside className="w-64 bg-surface-card border-r border-border-subtle flex flex-col shrink-0 min-h-screen">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-6 border-b border-border-subtle gap-3">
        <div className="w-9 h-9 rounded-lg bg-brand flex items-center justify-center text-white font-bold text-lg shadow-sm">
          M
        </div>
        <div className="flex flex-col overflow-hidden">
          <span className="font-semibold text-text-main text-sm truncate">
            {storeSetting?.name || "Magic Store"}
          </span>
          <span className="text-xs text-text-sub font-mono">Micro-ERP</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-text-disabled">
          Phân hệ tác nghiệp
        </div>

        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-brand text-white shadow-sm"
                  : "text-text-sub hover:bg-surface-card-hover hover:text-text-main"
              }`}
            >
              <div className="flex items-center gap-3 truncate">
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-white" : "text-text-sub"}`} />
                <span className="truncate">{item.name}</span>
              </div>
              {item.badge && (
                <span
                  className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                    isActive ? "bg-white/20 text-white" : "bg-emerald-50 text-brand"
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Module Badges Summary Footer */}
      <div className="p-4 border-t border-border-subtle bg-surface-muted/50">
        <div className="text-xs font-medium text-text-sub mb-2 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-brand" />
          <span>Mô-đun đang mở</span>
        </div>
        <div className="flex flex-wrap gap-1">
          {isModuleEnabled("catch_weight") && (
            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 bg-cyan-50 text-cyan-700 border border-cyan-200 rounded font-medium">
              <Scale className="w-2.5 h-2.5" /> Cân ký
            </span>
          )}
          {isModuleEnabled("matrix_variants") && (
            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded font-medium">
              <Layers className="w-2.5 h-2.5" /> Ma trận
            </span>
          )}
          {isModuleEnabled("bom_production") && (
            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded font-medium">
              <Factory className="w-2.5 h-2.5" /> Chế biến
            </span>
          )}
          {!isModuleEnabled("catch_weight") &&
            !isModuleEnabled("matrix_variants") &&
            !isModuleEnabled("bom_production") && (
              <span className="text-[11px] text-text-disabled italic">Chưa kích hoạt tính năng phụ</span>
            )}
        </div>
      </div>
    </aside>
  );
}
