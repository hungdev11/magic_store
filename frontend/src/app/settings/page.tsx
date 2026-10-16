"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useStoreProfile } from "@/lib/store";
import {
  Fish,
  Shirt,
  UtensilsCrossed,
  Layers,
  Scale,
  Factory,
  CalendarClock,
  Tag,
  WalletCards,
  Sparkles,
  Check,
  CheckCircle2,
  AlertCircle,
  Save,
  Loader2,
  Sliders,
  Store,
  RotateCcw,
  Sparkle,
} from "lucide-react";

// Preset definitions conforming to Phase 3 Adaptive UI spec
const PRESETS = [
  {
    key: "SEAFOOD" as const,
    title: "Sạp Cá & Hải Sản Tươi Sống",
    subtitle: "Thủy hải sản & Cân ký",
    description:
      "Tối ưu cho kinh doanh thủy hải sản tươi sống: cân trọng lượng thực tế tại quầy, quản lý lô date và phân rã mổ xẻ cá hồi/thịt cá.",
    icon: Fish,
    badgeColor: "bg-cyan-50 text-cyan-700 border-cyan-200",
    activeColor: "border-cyan-500 ring-2 ring-cyan-500/20",
    iconBg: "bg-cyan-100 text-cyan-700",
    modules: {
      catch_weight: true,
      batch_expiry: true,
      bom_production: true,
      dynamic_pos_pricing: true,
      matrix_variants: false,
      credit_ledger: false,
      product_modifiers: false,
    },
    features: [
      { key: "catch_weight", label: "Cân thực tế (Catch-weight)", state: true },
      { key: "batch_expiry", label: "Quản lý Lô & Hạn sử dụng", state: true },
      { key: "bom_production", label: "Mổ xẻ & Pha lóc (BOM)", state: true },
      { key: "dynamic_pos_pricing", label: "Mặc cả & Sửa giá quầy", state: true },
      { key: "matrix_variants", label: "Ma trận Màu x Size", state: false },
    ],
  },
  {
    key: "APPAREL" as const,
    title: "Shop Thời Trang & May Mặc",
    subtitle: "Thời trang & Đa biến thể",
    description:
      "Tối ưu cho bán lẻ thời trang: ma trận đa biến thể Màu × Size, quản lý sổ nợ khách hàng quen và điều chỉnh giá bán linh hoạt.",
    icon: Shirt,
    badgeColor: "bg-purple-50 text-purple-700 border-purple-200",
    activeColor: "border-purple-500 ring-2 ring-purple-500/20",
    iconBg: "bg-purple-100 text-purple-700",
    modules: {
      matrix_variants: true,
      credit_ledger: true,
      dynamic_pos_pricing: true,
      catch_weight: false,
      bom_production: false,
      batch_expiry: false,
      product_modifiers: false,
    },
    features: [
      { key: "matrix_variants", label: "Ma trận Biến thể (Màu × Size)", state: true },
      { key: "credit_ledger", label: "Sổ nợ Khách & Nhà cung cấp", state: true },
      { key: "dynamic_pos_pricing", label: "Mặc cả & Sửa giá quầy", state: true },
      { key: "catch_weight", label: "Cân thực tế (Catch-weight)", state: false },
      { key: "bom_production", label: "Định mức chế biến (BOM)", state: false },
    ],
  },
  {
    key: "FOOD" as const,
    title: "Tiệm Chế Biến Đồ Ăn & F&B",
    subtitle: "F&B & Chế biến món",
    description:
      "Tối ưu cho nhà hàng, tiệm ăn uống: lập công thức chế biến mẻ thành phẩm theo BOM, quản lý đồ ăn kèm topping và theo dõi hạn sử dụng.",
    icon: UtensilsCrossed,
    badgeColor: "bg-orange-50 text-orange-700 border-orange-200",
    activeColor: "border-orange-500 ring-2 ring-orange-500/20",
    iconBg: "bg-orange-100 text-orange-700",
    modules: {
      bom_production: true,
      batch_expiry: true,
      product_modifiers: true,
      dynamic_pos_pricing: true,
      matrix_variants: false,
      catch_weight: false,
      credit_ledger: false,
    },
    features: [
      { key: "bom_production", label: "Chế biến mẻ thành phẩm (BOM)", state: true },
      { key: "batch_expiry", label: "Quản lý Lô & Hạn sử dụng", state: true },
      { key: "product_modifiers", label: "Đồ ăn kèm / Topping", state: true },
      { key: "matrix_variants", label: "Ma trận Màu x Size", state: false },
      { key: "catch_weight", label: "Cân thực tế (Catch-weight)", state: false },
    ],
  },
];

// 7 Fine-grained feature flag switches
const FEATURE_FLAGS = [
  {
    key: "matrix_variants",
    title: "Ma trận Biến thể (Màu x Size)",
    description:
      "Quản lý sản phẩm thời trang đa thuộc tính (Màu sắc × Kích cỡ), tự động sinh danh sách SKU biến thể theo lưới quy cách.",
    icon: Layers,
    accentColor: "text-purple-600 bg-purple-50 border-purple-200",
  },
  {
    key: "catch_weight",
    title: "Cân số thực & Đơn vị biến thiên (Dual-unit)",
    description:
      "Nhập số cân thực tế khi bán hoặc nhập kho (VD: Con ~ 1.2kg). Quản lý tồn kho kép theo đơn vị chuẩn và đơn vị phụ.",
    icon: Scale,
    accentColor: "text-cyan-600 bg-cyan-50 border-cyan-200",
  },
  {
    key: "bom_production",
    title: "Chế biến mẻ & Phân rã mổ xẻ (BOM)",
    description:
      "Lập định mức nguyên liệu (Bill of Materials) để chế biến nấu mẻ thành phẩm hoặc pha lóc xẻ thịt cá, tự động trừ kho nguyên liệu.",
    icon: Factory,
    accentColor: "text-indigo-600 bg-indigo-50 border-indigo-200",
  },
  {
    key: "batch_expiry",
    title: "Quản lý Lô & Hạn sử dụng",
    description:
      "Theo dõi số lô nhập kho, cảnh báo hàng sắp hết hạn, hỗ trợ quản lý hạn dùng sản phẩm tươi sống và thực phẩm.",
    icon: CalendarClock,
    accentColor: "text-amber-600 bg-amber-50 border-amber-200",
  },
  {
    key: "dynamic_pos_pricing",
    title: "Cho phép sửa giá / mặc cả tại quầy",
    description:
      "Cho phép thu ngân điều chỉnh giá bán trực tiếp trên đơn hàng POS hoặc áp dụng mức giá bán nhanh theo thời điểm.",
    icon: Tag,
    accentColor: "text-sky-600 bg-sky-50 border-sky-200",
  },
  {
    key: "credit_ledger",
    title: "Quản lý Sổ nợ Khách hàng & Nhà cung cấp",
    description:
      "Ghi nhận công nợ khi nhập hàng và cho phép khách hàng quen mua nợ ghi sổ, theo dõi số dư và hạn mức nợ.",
    icon: WalletCards,
    accentColor: "text-rose-600 bg-rose-50 border-rose-200",
  },
  {
    key: "product_modifiers",
    title: "Đồ ăn kèm / Topping có cấu hình",
    description:
      "Cấu hình danh sách gia vị, topping, đồ ăn kèm khi bán hàng F&B kèm theo phụ thu định lượng nguyên vật liệu.",
    icon: Sparkles,
    accentColor: "text-orange-600 bg-orange-50 border-orange-200",
  },
];

export default function SettingsPage() {
  const { storeSetting, enabledModules, updateSettings, applyPreset, fetchSettings } =
    useStoreProfile();

  // Local form state
  const [storeName, setStoreName] = useState("");
  const [costingMethod, setCostingMethod] = useState("WAC");
  const [localModules, setLocalModules] = useState<Record<string, boolean>>({});

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [applyingPreset, setApplyingPreset] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  // Synchronize state from store profile
  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    if (storeSetting) {
      setStoreName(storeSetting.name || "Cửa Hàng");
      setCostingMethod(storeSetting.costing_method || "WAC");
    }
  }, [storeSetting]);

  useEffect(() => {
    setLocalModules(enabledModules);
  }, [enabledModules]);

  // Determine which preset matches current active modules
  // ponytail: preset match checks key modules required by each profile
  const activePresetKey = useMemo(() => {
    for (const preset of PRESETS) {
      const isMatch = Object.entries(preset.modules).every(([key, expected]) => {
        return !!localModules[key] === expected;
      });
      if (isMatch) return preset.key;
    }
    return null;
  }, [localModules]);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  // Toggle single module flag
  const handleToggleModule = (key: string) => {
    setLocalModules((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // 1-Click apply preset handler
  const handleApplyPreset = async (presetKey: "SEAFOOD" | "APPAREL" | "FOOD") => {
    setApplyingPreset(presetKey);
    setToast(null);

    const preset = PRESETS.find((p) => p.key === presetKey);
    if (!preset) return;

    try {
      // 1. Call store applyPreset API
      await applyPreset(presetKey);

      // 2. Persist full preset flag matrix to backend
      await updateSettings({
        name: storeName || storeSetting?.name || "Cửa Hàng",
        costing_method: costingMethod,
        enabled_modules: preset.modules,
      });

      // Update local state immediately
      setLocalModules(preset.modules);
      setToast({
        type: "success",
        message: `Đã áp dụng thành công mẫu: ${preset.title}! Hệ thống đã cập nhật tính năng.`,
      });
    } catch (err: any) {
      // Even if network error occurs, apply locally for resilient UX
      setLocalModules(preset.modules);
      setToast({
        type: "info",
        message: `Đã áp dụng mẫu ${preset.title} vào giao diện hiện tại.`,
      });
    } finally {
      setApplyingPreset(null);
    }
  };

  // Save full settings form
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setToast(null);

    try {
      await updateSettings({
        name: storeName.trim() || "Cửa Hàng",
        costing_method: costingMethod,
        enabled_modules: localModules,
      });
      setToast({
        type: "success",
        message: "Lưu cấu hình cửa hàng & mô-đun nghiệp vụ thành công!",
      });
    } catch (err: any) {
      setToast({
        type: "error",
        message: err.message || "Lỗi khi lưu cấu hình. Vui lòng kiểm tra kết nối.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Reset to server state
  const handleReset = () => {
    if (storeSetting) {
      setStoreName(storeSetting.name || "Cửa Hàng");
      setCostingMethod(storeSetting.costing_method || "WAC");
    }
    setLocalModules(enabledModules);
    setToast({
      type: "info",
      message: "Đã hoàn tác các thay đổi chưa lưu.",
    });
  };

  const activeModuleCount = Object.values(localModules).filter(Boolean).length;

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-16">
      {/* Toast Notification Banner */}
      {toast && (
        <div
          role="alert"
          className={`flex items-center justify-between p-4 rounded-xl border shadow-sm transition-all duration-300 ${
            toast.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : toast.type === "error"
              ? "bg-rose-50 border-rose-200 text-rose-800"
              : "bg-sky-50 border-sky-200 text-sky-800"
          }`}
        >
          <div className="flex items-center gap-3">
            {toast.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-brand shrink-0" />
            ) : toast.type === "error" ? (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            ) : (
              <Sparkle className="w-5 h-5 text-sky-600 shrink-0" />
            )}
            <span className="text-sm font-medium">{toast.message}</span>
          </div>
          <button
            onClick={() => setToast(null)}
            className="text-xs font-semibold hover:opacity-75 px-2 py-1"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Screen Header */}
      <div className="bg-surface-card rounded-2xl p-6 border border-border-subtle shadow-card flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-brand px-2 py-0.5 rounded bg-brand-light border border-emerald-200">
              Cấu hình hệ thống
            </span>
            <span className="text-xs text-text-sub font-mono">
              {activeModuleCount}/7 Tính năng đang bật
            </span>
          </div>
          <h1 className="text-2xl font-bold text-text-main">
            Cài đặt Cửa hàng & Mô-đun Nghiệp vụ
          </h1>
          <p className="text-sm text-text-sub mt-1 max-w-2xl">
            Bật tắt linh hoạt theo đặc thù kinh doanh: Hải sản/Cân ký, Thời trang/Size-Màu, F&B/Định mức chế biến
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activePresetKey ? (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg">
              <span className="w-2 h-2 rounded-full bg-brand animate-pulse" />
              <span className="text-xs font-semibold text-brand">
                Mẫu: {PRESETS.find((p) => p.key === activePresetKey)?.subtitle}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-muted border border-border-subtle rounded-lg">
              <span className="w-2 h-2 rounded-full bg-slate-400" />
              <span className="text-xs font-medium text-text-sub">Cấu hình Tùy chỉnh (Custom)</span>
            </div>
          )}
        </div>
      </div>

      {/* SECTION 1: 1-Click Industry Presets */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-text-main flex items-center gap-2">
              <Sliders className="w-5 h-5 text-brand" />
              1-Click Industry Presets (Mẫu Ngành Hàng Thiết Lập Nhanh)
            </h2>
            <p className="text-xs text-text-sub mt-0.5">
              Chọn mẫu phù hợp để hệ thống tự động kích hoạt bộ cờ tính năng chuẩn cho ngành của bạn.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {PRESETS.map((preset) => {
            const Icon = preset.icon;
            const isCurrent = activePresetKey === preset.key;
            const isLoading = applyingPreset === preset.key;

            return (
              <div
                key={preset.key}
                className={`bg-surface-card rounded-xl p-5 border transition-all duration-200 shadow-card flex flex-col justify-between ${
                  isCurrent
                    ? `${preset.activeColor} bg-surface-card ring-1`
                    : "border-border-subtle hover:border-border-default hover:shadow-md"
                }`}
              >
                <div>
                  {/* Preset Header */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${preset.iconBg}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-text-main text-base leading-snug">
                          {preset.title}
                        </h3>
                        <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded border mt-0.5 ${preset.badgeColor}`}>
                          {preset.subtitle}
                        </span>
                      </div>
                    </div>

                    {isCurrent && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 shrink-0">
                        <Check className="w-3 h-3" /> Đang dùng
                      </span>
                    )}
                  </div>

                  {/* Description */}
                  <p className="text-xs text-text-sub leading-relaxed mb-4">
                    {preset.description}
                  </p>

                  {/* Enabled Features List */}
                  <div className="space-y-1.5 pt-3 border-t border-border-subtle mb-5">
                    <div className="text-[11px] font-semibold text-text-disabled uppercase tracking-wider mb-1">
                      Cấu hình tính năng:
                    </div>
                    {preset.features.map((feat) => (
                      <div
                        key={feat.key}
                        className="flex items-center justify-between text-xs py-0.5"
                      >
                        <span className={feat.state ? "text-text-main font-medium" : "text-text-disabled line-through"}>
                          {feat.label}
                        </span>
                        {feat.state ? (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                            BẬT
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium text-slate-400 bg-slate-50 px-1.5 py-0.2 rounded border border-slate-200">
                            TẮT
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Apply Button */}
                <button
                  type="button"
                  disabled={isLoading || isCurrent}
                  onClick={() => handleApplyPreset(preset.key)}
                  className={`w-full py-2.5 px-4 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
                    isCurrent
                      ? "bg-surface-muted text-text-disabled cursor-default border border-border-subtle"
                      : "bg-brand text-white hover:bg-brand-hover shadow-sm active:scale-[0.99]"
                  }`}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Đang áp dụng...</span>
                    </>
                  ) : isCurrent ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Mẫu đang kích hoạt</span>
                    </>
                  ) : (
                    <span>Áp dụng mẫu này</span>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* SECTION 2: Fine-Grained Feature Flags & Store Settings */}
      <form onSubmit={handleSaveSettings} className="space-y-6">
        <div className="bg-surface-card rounded-2xl p-6 border border-border-subtle shadow-card space-y-6">
          <div>
            <h2 className="text-lg font-bold text-text-main flex items-center gap-2">
              <Store className="w-5 h-5 text-brand" />
              Thông tin Cửa hàng & Phương pháp Giá vốn
            </h2>
            <p className="text-xs text-text-sub mt-0.5">
              Cấu hình danh tính kinh doanh và công thức hạch toán tồn kho kế toán.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            {/* Store Name Input */}
            <div className="space-y-2">
              <label
                htmlFor="storeName"
                className="block text-xs font-semibold text-text-main"
              >
                Tên Cửa Hàng / Doanh Nghiệp <span className="text-rose-500">*</span>
              </label>
              <input
                id="storeName"
                type="text"
                required
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder="Ví dụ: Hải Sản Biển Đông, Shop Bella, ..."
                className="w-full px-3.5 py-2.5 rounded-lg border border-border-default focus:border-brand focus:ring-1 focus:ring-brand text-sm bg-white text-text-main transition shadow-sm outline-none"
              />
              <p className="text-[11px] text-text-sub">
                Tên sẽ xuất hiện trên thanh điều hướng, phiếu nhập kho và hóa đơn bán lẻ.
              </p>
            </div>

            {/* Costing Method Selector */}
            <div className="space-y-2">
              <label
                htmlFor="costingMethod"
                className="block text-xs font-semibold text-text-main"
              >
                Phương pháp Tính Giá Vốn Hàng Tồn Kho
              </label>
              <select
                id="costingMethod"
                value={costingMethod}
                onChange={(e) => setCostingMethod(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-border-default focus:border-brand focus:ring-1 focus:ring-brand text-sm bg-white text-text-main transition shadow-sm outline-none"
              >
                <option value="WAC">
                  WAC - Bình quân gia quyền (Weighted Average Cost - Khuyên dùng)
                </option>
                <option value="FIFO">
                  FIFO - Nhập trước xuất trước (First In, First Out)
                </option>
              </select>
              <p className="text-[11px] text-text-sub">
                {costingMethod === "WAC"
                  ? "Tự động tính lại giá vốn bình quân gia quyền tức thì sau mỗi lần nhập hàng PO hoặc chế biến mẻ."
                  : "Xuất hàng và hạch toán giá vốn theo thứ tự lô hàng cũ nhất nhập kho trước."}
              </p>
            </div>
          </div>
        </div>

        {/* Feature Switches Table */}
        <div className="bg-surface-card rounded-2xl p-6 border border-border-subtle shadow-card space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-text-main flex items-center gap-2">
                <Sliders className="w-5 h-5 text-brand" />
                Bảng Toggle Công Tắc Tính Năng Độc Lập
              </h2>
              <p className="text-xs text-text-sub mt-0.5">
                Bật hoặc tắt từng mô-đun riêng lẻ. Giao diện người dùng sẽ lập tức co giãn tương ứng.
              </p>
            </div>
            <div className="text-xs font-semibold text-text-sub">
              Đang bật: <strong className="text-brand font-bold">{activeModuleCount}</strong> / 7 mô-đun
            </div>
          </div>

          <div className="divide-y divide-border-subtle">
            {FEATURE_FLAGS.map((flag) => {
              const Icon = flag.icon;
              const isEnabled = !!localModules[flag.key];

              return (
                <div
                  key={flag.key}
                  className="py-4.5 flex items-center justify-between gap-4 hover:bg-surface-muted/40 px-3 rounded-xl transition"
                >
                  <div className="flex items-start gap-3.5 max-w-3xl">
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border mt-0.5 ${flag.accentColor}`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-text-main">
                          {flag.title}
                        </span>
                        {isEnabled ? (
                          <span className="text-[10px] font-bold px-2 py-0.2 bg-emerald-50 text-brand border border-emerald-200 rounded-full">
                            Đang Bật
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium px-2 py-0.2 bg-slate-100 text-text-disabled border border-slate-200 rounded-full">
                            Đang Tắt
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-text-sub mt-1 leading-relaxed">
                        {flag.description}
                      </p>
                    </div>
                  </div>

                  {/* Toggle Switch Component */}
                  <div className="shrink-0">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isEnabled}
                      onClick={() => handleToggleModule(flag.key)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 ${
                        isEnabled ? "bg-brand" : "bg-slate-200"
                      }`}
                    >
                      <span className="sr-only">{flag.title}</span>
                      <span
                        aria-hidden="true"
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                          isEnabled ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Form Action Buttons */}
          <div className="pt-6 border-t border-border-subtle flex flex-col sm:flex-row items-center justify-between gap-4">
            <button
              type="button"
              onClick={handleReset}
              className="text-xs text-text-sub hover:text-text-main flex items-center gap-1.5 font-medium px-3 py-2 rounded-lg hover:bg-surface-muted transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Khôi phục giá trị đã lưu</span>
            </button>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                type="submit"
                disabled={isSaving}
                className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-brand text-white text-sm font-semibold hover:bg-brand-hover shadow-sm transition flex items-center justify-center gap-2 disabled:opacity-70 active:scale-[0.99]"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Đang lưu cấu hình...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Lưu cấu hình</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
