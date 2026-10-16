"use client";

import React from "react";
import Link from "next/link";
import { useStoreProfile } from "@/lib/store";
import { MODULE_DEFINITIONS, formatVND, formatQty, getBadgeClasses } from "@/lib/design-tokens";
import {
  Package,
  ArrowDownToLine,
  Factory,
  Trash2,
  Settings,
  PlusCircle,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Zap,
} from "lucide-react";

export default function DashboardPage() {
  const { storeSetting, enabledModules } = useStoreProfile();

  const activeModuleKeys = Object.keys(enabledModules).filter((k) => enabledModules[k]);

  const quickActions = [
    {
      title: "Thêm sản phẩm mới",
      desc: "Tạo sản phẩm với ma trận, cân ký hoặc BOM",
      href: "/products/new",
      icon: PlusCircle,
      accent: "text-brand",
      bg: "bg-emerald-50",
    },
    {
      title: "Danh sách hàng hóa",
      desc: "Xem tồn kho thực tế, bảng giá vốn WAC",
      href: "/products",
      icon: Package,
      accent: "text-sky-600",
      bg: "bg-sky-50",
    },
    {
      title: "Nhập hàng nhà cung cấp",
      desc: "Tạo phiếu nhập kho PO, phân bổ theo lô",
      href: "/inventory/purchase",
      icon: ArrowDownToLine,
      accent: "text-indigo-600",
      bg: "bg-indigo-50",
    },
    {
      title: "Chế biến & Định mức BOM",
      desc: "Nấu mẻ thành phẩm hoặc mổ xẻ phân rã",
      href: "/production",
      icon: Factory,
      accent: "text-purple-600",
      bg: "bg-purple-50",
      condition: enabledModules["bom_production"],
    },
    {
      title: "Hủy hàng & Hao hụt",
      desc: "Ghi nhận hỏng hóc, tính tổn thất vốn",
      href: "/inventory/wastage",
      icon: Trash2,
      accent: "text-rose-600",
      bg: "bg-rose-50",
    },
    {
      title: "Cấu hình mô-đun",
      desc: "Chuyển nhanh mẫu ngành hoặc bật/tắt tính năng",
      href: "/settings",
      icon: Settings,
      accent: "text-amber-600",
      bg: "bg-amber-50",
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Welcome & Store Overview Card */}
      <div className="bg-surface-card rounded-xl p-6 border border-border-subtle shadow-card flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-brand px-2 py-0.5 rounded bg-brand-light border border-emerald-200">
              Hệ thống vận hành
            </span>
            <span className="text-xs text-text-sub font-mono">Phiên bản 1.0</span>
          </div>
          <h2 className="text-2xl font-bold text-text-main mt-1">
            {storeSetting?.name || "Cửa Hàng Đa Ngành"}
          </h2>
          <p className="text-sm text-text-sub mt-1">
            Hệ thống Micro-ERP tự thích ứng theo ngành hàng với tính toán giá vốn bình quân (WAC).
          </p>
        </div>

        <Link
          href="/settings"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand-hover transition shadow-sm"
        >
          <Settings className="w-4 h-4" />
          <span>Tùy chỉnh Mô-đun</span>
        </Link>
      </div>

      {/* Feature Flags Active Status Chips */}
      <div className="bg-surface-card rounded-xl p-5 border border-border-subtle shadow-card space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-brand" />
            <h3 className="text-sm font-semibold text-text-main">
              Trạng thái Cờ Tính năng (Feature Flags)
            </h3>
          </div>
          <span className="text-xs text-text-sub">
            {activeModuleKeys.length} / {Object.keys(MODULE_DEFINITIONS).length} mô-đun kích hoạt
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {Object.entries(MODULE_DEFINITIONS).map(([key, def]) => {
            const isEnabled = !!enabledModules[key];
            return (
              <div
                key={key}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs transition ${
                  isEnabled
                    ? `${getBadgeClasses(def.badgeVariant)} border-current font-medium`
                    : "bg-surface-muted text-text-disabled border-border-subtle"
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    isEnabled ? "bg-current" : "bg-text-disabled"
                  }`}
                />
                <span className="font-medium">{def.label}</span>
                <span className="text-[10px] opacity-75">
                  ({isEnabled ? "Bật" : "Tắt"})
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick Action Navigation Grid */}
      <div>
        <h3 className="text-base font-semibold text-text-main mb-3 flex items-center gap-2">
          <Zap className="w-4 h-4 text-brand" />
          <span>Lối tắt tác nghiệp</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {quickActions.map((action) => {
            if (action.condition === false) return null;
            const Icon = action.icon;
            return (
              <Link
                key={action.href}
                href={action.href}
                className="group bg-surface-card p-5 rounded-xl border border-border-subtle hover:border-brand/40 hover:shadow-card transition flex flex-col justify-between"
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2.5 rounded-lg ${action.bg} ${action.accent}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm text-text-main group-hover:text-brand transition">
                      {action.title}
                    </h4>
                    <p className="text-xs text-text-sub mt-1 leading-relaxed">
                      {action.desc}
                    </p>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-border-subtle flex items-center justify-end text-xs font-medium text-text-sub group-hover:text-brand">
                  <span>Mở phân hệ</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1 transition-transform group-hover:translate-x-1" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Design Token Preview / Self-Check Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-surface-card p-4 rounded-xl border border-border-subtle shadow-card">
          <div className="text-xs text-text-sub">Quy chuẩn tiền tệ (VND)</div>
          <div className="text-xl font-bold text-inflow mt-1">
            {formatVND(1850000)}
          </div>
          <div className="text-[11px] text-text-sub mt-0.5">Hạch toán chuẩn đơn vị VNĐ</div>
        </div>
        <div className="bg-surface-card p-4 rounded-xl border border-border-subtle shadow-card">
          <div className="text-xs text-text-sub">Quy chuẩn định lượng (UOM)</div>
          <div className="text-xl font-bold text-text-main mt-1">
            {formatQty(12.45, "kg")}
          </div>
          <div className="text-[11px] text-text-sub mt-0.5">Hỗ trợ số lẻ 3 chữ số thập phân</div>
        </div>
        <div className="bg-surface-card p-4 rounded-xl border border-border-subtle shadow-card">
          <div className="text-xs text-text-sub">Chuẩn bảo toàn dữ liệu</div>
          <div className="text-xl font-bold text-brand mt-1 flex items-center gap-1.5">
            <ShieldCheck className="w-5 h-5" />
            <span>Chống âm kho</span>
          </div>
          <div className="text-[11px] text-text-sub mt-0.5">Kiểm tra số dư trước khi xuất</div>
        </div>
      </div>
    </div>
  );
}
