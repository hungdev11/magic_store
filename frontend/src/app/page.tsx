"use client";

import React from "react";
import Link from "next/link";
import { useStoreProfile } from "@/lib/store";
import { MODULE_DEFINITIONS } from "@/lib/design-tokens";
import { PageHeader, Badge, Button } from "@/components/common";
import {
  Package,
  ArrowDownToLine,
  Factory,
  Trash2,
  Settings,
  PlusCircle,
  ArrowRight,
  ShoppingCart,
  Boxes,
  Truck,
  Users,
} from "lucide-react";

interface OperationItem {
  title: string;
  desc: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  condition?: boolean;
}

interface OperationGroup {
  group: string;
  items: OperationItem[];
}

// ponytail: static action grid grouped by operations; upgrade to dynamic dashboard widgets if analytics metrics added.
export default function DashboardPage() {
  const { storeSetting, enabledModules } = useStoreProfile();

  const activeModuleKeys = Object.keys(enabledModules).filter((k) => enabledModules[k]);

  const operations: OperationGroup[] = [
    {
      group: "Bán hàng & Quầy thu ngân",
      items: [
        {
          title: "Bán hàng POS",
          desc: "Giao diện thu ngân nhanh, cân ký, trừ nguyên liệu và tính nợ",
          href: "/pos",
          icon: ShoppingCart,
          badge: "F8",
        },
      ],
    },
    {
      group: "Kho & Hàng hóa",
      items: [
        {
          title: "Thêm sản phẩm mới",
          desc: "Tạo sản phẩm với ma trận màu size, cân ký hoặc định mức BOM",
          href: "/products/new",
          icon: PlusCircle,
        },
        {
          title: "Danh sách sản phẩm",
          desc: "Tra cứu tồn kho thực tế, bảng giá bán và giá vốn WAC",
          href: "/products",
          icon: Package,
        },
        {
          title: "Nhập hàng nhà cung cấp",
          desc: "Lập phiếu nhập kho PO, phân bổ theo lô và hạn dùng",
          href: "/inventory/purchase",
          icon: ArrowDownToLine,
        },
        {
          title: "Quản lý Lô & HSD",
          desc: "Theo dõi số lô, cảnh báo cận date và truy vết luân chuyển",
          href: "/inventory/batches",
          icon: Boxes,
        },
        {
          title: "Xuất hủy & Hao hụt",
          desc: "Ghi nhận cá ngộp, hàng hỏng và hạch toán tổn thất vốn",
          href: "/inventory/wastage",
          icon: Trash2,
        },
      ],
    },
    {
      group: "Đối tác & Chế biến",
      items: [
        {
          title: "Định mức & Chế biến BOM",
          desc: "Nấu mẻ thành phẩm hoặc pha lóc mổ xẻ nguyên liệu",
          href: "/production",
          icon: Factory,
          condition: enabledModules["bom_production"],
        },
        {
          title: "Nhà cung cấp",
          desc: "Quản lý danh sách đối tác cung ứng và công nợ phải trả",
          href: "/partners?type=SUPPLIER",
          icon: Truck,
        },
        {
          title: "Khách hàng",
          desc: "Quản lý khách quen, hạn mức nợ và sổ nợ",
          href: "/partners?type=CUSTOMER",
          icon: Users,
        },
      ],
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header with Title and Settings Action */}
      <PageHeader
        title={storeSetting?.name || "Magic Store"}
        description="Hệ thống Micro-ERP tự thích ứng theo ngành hàng với tính toán giá vốn bình quân (WAC)."
        badge={
          <Badge variant="brand">
            WAC · {storeSetting?.currency || "VND"}
          </Badge>
        }
        actions={
          <div className="flex items-center gap-2">
            <Link href="/pos">
              <Button variant="primary" size="sm">
                <ShoppingCart className="w-4 h-4 mr-1.5" />
                <span>Bán hàng POS (F8)</span>
              </Button>
            </Link>
            <Link href="/settings">
              <Button variant="secondary" size="sm">
                <Settings className="w-4 h-4 mr-1.5" />
                <span>Cấu hình mô-đun</span>
              </Button>
            </Link>
          </div>
        }
      />

      {/* Feature Flags Active Status */}
      <div className="bg-surface-card rounded-md p-4 border border-border-subtle shadow-card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text-main">
            Trạng thái Mô-đun Ngành hàng
          </h2>
          <span className="text-xs text-text-sub tabular-nums font-mono">
            {activeModuleKeys.length} / {Object.keys(MODULE_DEFINITIONS).length} kích hoạt
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {Object.entries(MODULE_DEFINITIONS).map(([key, def]) => {
            const isEnabled = !!enabledModules[key];
            return (
              <Badge
                key={key}
                variant={isEnabled ? def.badgeVariant : "default"}
                className={!isEnabled ? "opacity-40" : ""}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                    isEnabled ? "bg-current" : "bg-text-disabled"
                  }`}
                />
                {def.label}
              </Badge>
            );
          })}
        </div>
      </div>

      {/* Structured Operational Workflow Groups */}
      <div className="space-y-5">
        {operations.map((group) => {
          const visibleItems = group.items.filter((item) => item.condition !== false);
          if (visibleItems.length === 0) return null;

          return (
            <div key={group.group} className="space-y-2.5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-text-sub">
                {group.group}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="group bg-surface-card p-4 rounded-md border border-border-subtle hover:border-brand/40 hover:shadow-card transition-all flex flex-col justify-between"
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-sm bg-surface-muted text-text-main group-hover:bg-brand-light group-hover:text-brand transition-colors shrink-0">
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <h4 className="font-semibold text-sm text-text-main group-hover:text-brand transition-colors truncate">
                              {item.title}
                            </h4>
                            {item.badge && (
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-sm bg-brand-light text-brand font-semibold shrink-0">
                                {item.badge}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-text-sub mt-1 line-clamp-2 leading-relaxed">
                            {item.desc}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 pt-2.5 border-t border-border-subtle flex items-center justify-end text-xs font-medium text-text-sub group-hover:text-brand transition-colors">
                        <span>Truy cập</span>
                        <ArrowRight className="w-3.5 h-3.5 ml-1 transition-transform group-hover:translate-x-0.5" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
