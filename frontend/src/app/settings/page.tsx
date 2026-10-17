"use client";

import React, { useState, useEffect } from "react";
import { useStoreProfile } from "@/lib/store";
import {
  PageHeader,
  Badge,
  Button,
  AlertBanner,
} from "@/components/common";
import {
  Store,
  Save,
  CheckCircle2,
  Sliders,
  DollarSign,
  Package,
  Layers,
  Scale,
  Factory,
  Boxes,
  CreditCard,
  Building2,
  Wallet,
} from "lucide-react";

const ACTIVE_SYSTEM_CAPABILITIES = [
  {
    title: "Phân hệ Đa Chi Nhánh & Đa Kho",
    desc: "Cân bằng tồn kho, điều chuyển hàng hóa liên kho và hạch toán độc lập tại từng địa điểm.",
    icon: Building2,
  },
  {
    title: "Bản chất hàng hóa (Cách 2)",
    desc: "Tự động tinh giản biểu mẫu theo đúng loại sản phẩm (Đa ĐVT, Ma trận Màu × Size, Cân ký tươi sống, F&B Chế biến).",
    icon: Package,
  },
  {
    title: "Đa Đơn Vị Tính & Barcode riêng",
    desc: "Mỗi quy cách (Thùng, Lốc, Lon) có hệ số quy đổi, mã vạch và giá bán riêng để quét tại quầy.",
    icon: Scale,
  },
  {
    title: "Quản lý Lô & Hạn sử dụng",
    desc: "Theo dõi số lô nhập, tự động tính ngày hết hạn theo shelf life và cảnh báo cận date.",
    icon: Boxes,
  },
  {
    title: "Sổ Nợ & Quản lý Công nợ (CRM)",
    desc: "Phân tách rõ công nợ phải thu từ khách hàng và công nợ phải trả cho nhà cung cấp.",
    icon: CreditCard,
  },
  {
    title: "Sổ Quỹ Thu / Chi Thực Tế",
    desc: "Theo dõi dòng tiền vào ra, phân biệt quỹ tiền mặt tại két và tài khoản ngân hàng.",
    icon: Wallet,
  },
  {
    title: "Báo Cáo Lãi / Lỗ Thực Tế (P&L)",
    desc: "Bóc tách chính xác Doanh thu, Giá vốn WAC, Tổn thất xuất hủy và Chi phí vận hành.",
    icon: DollarSign,
  },
  {
    title: "Định mức BOM & F&B Options",
    desc: "Sản xuất mẻ, bán hàng tự trừ nguyên vật liệu, cấu hình size giá và danh sách topping món kèm.",
    icon: Factory,
  },
];

export default function SettingsPage() {
  const { storeSetting, updateSettings, fetchSettings } = useStoreProfile();

  const [storeName, setStoreName] = useState("");
  const [currency, setCurrency] = useState("VND");
  const [costingMethod, setCostingMethod] = useState("WAC");
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    if (storeSetting) {
      setStoreName(storeSetting.name || "Cửa Hàng Magic Store");
      setCurrency(storeSetting.currency || "VND");
      setCostingMethod(storeSetting.costing_method || "WAC");
    }
  }, [storeSetting]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeName.trim()) {
      setToast({ type: "error", message: "Tên cửa hàng không được để trống" });
      return;
    }

    setIsSaving(true);
    setToast(null);
    try {
      await updateSettings({
        name: storeName.trim(),
        currency: currency.trim().toUpperCase(),
        costing_method: costingMethod,
      });
      setToast({ type: "success", message: "Đã lưu cài đặt cửa hàng thành công!" });
    } catch (err: any) {
      setToast({ type: "error", message: err.message || "Lỗi khi lưu cài đặt" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      <PageHeader
        title="Cài Đặt Hệ Thống & Cửa Hàng"
        description="Thông tin doanh nghiệp, phương pháp tính giá vốn và cấu hình tài chính."
        badge={<Badge variant="brand">Toàn bộ tính năng hoạt động</Badge>}
      />

      {toast && (
        <AlertBanner
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}

      {/* Main Settings Form */}
      <form onSubmit={handleSave} className="space-y-6">
        <section className="bg-surface-card rounded-xl p-5 sm:p-6 border border-border-default shadow-xs space-y-4">
          <div className="border-b border-border-subtle pb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text-main flex items-center gap-2">
              <Store className="w-4 h-4 text-brand" />
              <span>1. Thông tin Cửa hàng & Định chế Tài chính</span>
            </h2>
            <Badge variant="default">Cấu hình chung</Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-text-main mb-1">
                Tên cửa hàng / Doanh nghiệp <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-surface-app border border-border-default rounded-lg focus:outline-none focus:border-brand font-medium text-text-main"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-main mb-1">
                Đơn vị tiền tệ hiển thị
              </label>
              <input
                type="text"
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                className="w-full px-3.5 py-2 text-xs bg-surface-app border border-border-default rounded-lg focus:outline-none focus:border-brand font-mono text-text-main"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-text-main mb-1">
                Phương pháp tính giá vốn hàng tồn kho
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="p-3 rounded-lg border border-brand bg-brand/5 ring-1 ring-brand cursor-pointer flex items-start gap-2.5">
                  <input
                    type="radio"
                    name="costing"
                    value="WAC"
                    checked={costingMethod === "WAC"}
                    onChange={(e) => setCostingMethod(e.target.value)}
                    className="mt-0.5 text-brand focus:ring-brand"
                  />
                  <div>
                    <span className="text-xs font-bold text-text-main block">
                      WAC (Bình quân gia quyền thời gian thực)
                    </span>
                    <span className="text-[11px] text-text-sub block mt-0.5 leading-relaxed">
                      Tự động tính lại giá vốn bình quân ngay khi nhập kho hoặc chế biến, đảm bảo tính đúng Lãi/Lỗ tại quầy POS.
                    </span>
                  </div>
                </label>

                <label className="p-3 rounded-lg border border-border-default bg-surface-app opacity-60 cursor-not-allowed flex items-start gap-2.5">
                  <input
                    type="radio"
                    name="costing"
                    value="FIFO"
                    disabled
                    className="mt-0.5 text-text-disabled"
                  />
                  <div>
                    <span className="text-xs font-bold text-text-sub block">
                      FIFO (Nhập trước xuất trước)
                    </span>
                    <span className="text-[11px] text-text-disabled block mt-0.5">
                      Đang được tự động áp dụng khi xuất hàng từ các lô (Batch Lot).
                    </span>
                  </div>
                </label>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-border-subtle flex justify-end">
            <Button type="submit" variant="primary" size="sm" isLoading={isSaving} disabled={isSaving}>
              <Save className="w-3.5 h-3.5 mr-1" />
              <span>Lưu cấu hình</span>
            </Button>
          </div>
        </section>

        {/* System Capabilities Section */}
        <section className="bg-surface-card rounded-xl p-5 sm:p-6 border border-border-default shadow-xs space-y-4">
          <div className="border-b border-border-subtle pb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text-main flex items-center gap-2">
              <Sliders className="w-4 h-4 text-brand" />
              <span>2. Toàn bộ Phân hệ Nghiệp vụ Đang Kích Hoạt (8/8)</span>
            </h2>
            <Badge variant="inflow">Đầy đủ tính năng</Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ACTIVE_SYSTEM_CAPABILITIES.map((cap, idx) => {
              const Icon = cap.icon;
              return (
                <div
                  key={idx}
                  className="p-3.5 bg-surface-app rounded-xl border border-border-default flex items-start gap-3"
                >
                  <div className="p-2 rounded-lg bg-surface-card border border-border-subtle text-brand shrink-0">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-xs text-text-main">
                        {cap.title}
                      </span>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    </div>
                    <p className="text-[11px] text-text-sub mt-0.5 leading-relaxed">
                      {cap.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </form>
    </div>
  );
}
