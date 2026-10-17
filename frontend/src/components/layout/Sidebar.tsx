"use client";

import React, { Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useStoreProfile } from "@/lib/store";
import {
  LayoutDashboard,
  Package,
  FolderTree,
  Scale,
  Boxes,
  ArrowDownToLine,
  Trash2,
  Truck,
  Users,
  ShoppingCart,
  Factory,
  Settings,
  Sparkles,
  Layers,
  Warehouse,
  ArrowRightLeft,
  CreditCard,
  Wallet,
  TrendingUp,
} from "lucide-react";

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    title: "Hàng hóa & Danh mục",
    items: [
      { name: "Sản phẩm", href: "/products", icon: Package },
      { name: "Danh mục", href: "/categories", icon: FolderTree },
      { name: "Đơn vị tính", href: "/units", icon: Scale },
    ],
  },
  {
    title: "Kho & Vật tư",
    items: [
      { name: "Tồn kho chi nhánh", href: "/inventory/stock", icon: Warehouse },
      { name: "Chuyển kho", href: "/inventory/transfers", icon: ArrowRightLeft },
      { name: "Danh mục kho", href: "/inventory/warehouses", icon: Warehouse },
      { name: "Quản lý Lô & HSD", href: "/inventory/batches", icon: Boxes },
      { name: "Nhập kho", href: "/inventory/purchase", icon: ArrowDownToLine },
      { name: "Xuất hủy", href: "/inventory/wastage", icon: Trash2 },
    ],
  },
  {
    title: "Đối tác (CRM)",
    items: [
      { name: "Khách hàng", href: "/customers", icon: Users },
      { name: "Nhà cung cấp", href: "/suppliers", icon: Truck },
    ],
  },
  {
    title: "Tài chính & Sổ nợ",
    items: [
      { name: "Sổ nợ & Công nợ", href: "/finance/debts", icon: CreditCard },
      { name: "Sổ quỹ Thu/Chi", href: "/finance/cashbook", icon: Wallet },
      { name: "Báo cáo Lãi/Lỗ", href: "/finance/pnl", icon: TrendingUp },
    ],
  },
  {
    title: "Bán hàng & Chế biến",
    items: [
      { name: "Bán hàng POS", href: "/pos", icon: ShoppingCart, badge: "POS" },
      { name: "Định mức BOM", href: "/production", icon: Factory },
    ],
  },
  {
    title: "Hệ thống",
    items: [
      { name: "Cài đặt", href: "/settings", icon: Settings },
    ],
  },
];

function checkItemActive(
  itemHref: string,
  pathname: string | null,
  searchParams: ReturnType<typeof useSearchParams> | null
): boolean {
  if (!pathname) return false;
  const [itemPath, itemQuery] = itemHref.split("?");

  const pathMatches =
    itemPath === "/"
      ? pathname === "/"
      : pathname === itemPath || pathname.startsWith(itemPath + "/");

  if (!pathMatches) return false;

  if (itemQuery) {
    const q = new URLSearchParams(itemQuery);
    for (const [key, val] of q.entries()) {
      const currentVal = searchParams?.get(key) ?? null;
      if (itemPath === "/partners" && key === "type" && val === "CUSTOMER") {
        if (currentVal !== "CUSTOMER" && currentVal !== null) {
          return false;
        }
      } else if (currentVal !== val) {
        return false;
      }
    }
    return true;
  }

  if (pathname === "/partners" && searchParams?.get("type")) {
    return false;
  }

  return true;
}

function SidebarNavContent({
  pathname,
  searchParams,
}: {
  pathname: string | null;
  searchParams: ReturnType<typeof useSearchParams> | null;
}) {
  const isOverviewActive = checkItemActive("/", pathname, searchParams);

  return (
    <nav className="flex-1 px-3 py-2 space-y-3 overflow-y-auto">
      <div>
        <Link
          href="/"
          className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
            isOverviewActive
              ? "bg-surface-app text-brand font-semibold"
              : "text-text-sub hover:bg-surface-card-hover hover:text-text-main"
          }`}
        >
          <LayoutDashboard
            className={`w-4 h-4 shrink-0 ${isOverviewActive ? "text-brand" : "text-text-sub"}`}
          />
          <span className="truncate">Tổng quan</span>
        </Link>
      </div>

      {navGroups.map((group) => (
        <div key={group.title} className="space-y-0.5">
          <div className="px-2.5 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-text-disabled">
            {group.title}
          </div>
          {group.items.map((item) => {
            const isActive = checkItemActive(item.href, pathname, searchParams);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-surface-app text-brand font-semibold"
                    : "text-text-sub hover:bg-surface-card-hover hover:text-text-main"
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? "text-brand" : "text-text-sub"
                    }`}
                  />
                  <span className="truncate">{item.name}</span>
                </div>
                {item.badge && (
                  <span
                    className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-sm ${
                      isActive
                        ? "bg-brand/10 text-brand"
                        : "bg-surface-muted text-text-sub"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function SidebarNavList({ pathname }: { pathname: string | null }) {
  const searchParams = useSearchParams();
  return <SidebarNavContent pathname={pathname} searchParams={searchParams} />;
}

// ponytail: static responsive sidebar; upgrade to responsive collapsible mobile offcanvas when viewport is below 768px.
export function Sidebar() {
  const pathname = usePathname();
  const { isModuleEnabled, storeSetting } = useStoreProfile();

  if (pathname === "/pos" || pathname?.startsWith("/pos/")) {
    return null;
  }

  return (
    <aside className="w-56 bg-surface-card border-r border-border-subtle flex flex-col shrink-0 min-h-screen">
      {/* Brand Header */}
      <Link
        href="/"
        className="h-14 flex items-center px-4 border-b border-border-subtle gap-2.5 hover:bg-surface-card-hover transition-colors"
      >
        <div className="w-7 h-7 rounded-md bg-brand flex items-center justify-center text-white font-bold text-sm shadow-sm">
          M
        </div>
        <div className="flex flex-col overflow-hidden">
          <span className="font-semibold text-text-main text-xs truncate">
            {storeSetting?.name || "Magic Store"}
          </span>
          <span className="text-[10px] text-text-sub font-mono">Micro-ERP</span>
        </div>
      </Link>

      {/* Navigation Groups with Suspense for SearchParams */}
      <Suspense fallback={<SidebarNavContent pathname={pathname} searchParams={null} />}>
        <SidebarNavList pathname={pathname} />
      </Suspense>

      {/* Module Badges Summary Footer */}
      <div className="p-3 border-t border-border-subtle bg-surface-muted/30">
        <div className="text-[11px] font-medium text-text-sub mb-1.5 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-brand" />
          <span>Mô-đun đang mở</span>
        </div>
        <div className="flex flex-wrap gap-1">
          {isModuleEnabled("catch_weight") && (
            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 bg-cyan-50 text-cyan-700 border border-cyan-200 rounded-sm font-medium">
              <Scale className="w-2.5 h-2.5" /> Cân ký
            </span>
          )}
          {isModuleEnabled("matrix_variants") && (
            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-sm font-medium">
              <Layers className="w-2.5 h-2.5" /> Ma trận
            </span>
          )}
          {isModuleEnabled("bom_production") && (
            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-sm font-medium">
              <Factory className="w-2.5 h-2.5" /> Chế biến
            </span>
          )}
          {!isModuleEnabled("catch_weight") &&
            !isModuleEnabled("matrix_variants") &&
            !isModuleEnabled("bom_production") && (
              <span className="text-[10px] text-text-disabled italic">Cơ bản</span>
            )}
        </div>
      </div>
    </aside>
  );
}
