// Design tokens, badge styles, and formatting utilities for Micro-ERP

export type BadgeVariant =
  | "brand"
  | "inflow"
  | "outflow"
  | "alert"
  | "info"
  | "catchweight"
  | "matrix"
  | "bom"
  | "modifier"
  | "default";

export const BADGE_STYLES: Record<BadgeVariant, { bg: string; text: string; border: string }> = {
  brand: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
  },
  inflow: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
  },
  outflow: {
    bg: "bg-rose-50",
    text: "text-rose-700",
    border: "border-rose-200",
  },
  alert: {
    bg: "bg-amber-50",
    text: "text-amber-800",
    border: "border-amber-200",
  },
  info: {
    bg: "bg-sky-50",
    text: "text-sky-700",
    border: "border-sky-200",
  },
  catchweight: {
    bg: "bg-cyan-50",
    text: "text-cyan-700",
    border: "border-cyan-200",
  },
  matrix: {
    bg: "bg-purple-50",
    text: "text-purple-700",
    border: "border-purple-200",
  },
  bom: {
    bg: "bg-indigo-50",
    text: "text-indigo-700",
    border: "border-indigo-200",
  },
  modifier: {
    bg: "bg-orange-50",
    text: "text-orange-700",
    border: "border-orange-200",
  },
  default: {
    bg: "bg-slate-100",
    text: "text-slate-700",
    border: "border-slate-200",
  },
};

export function getBadgeClasses(variant: BadgeVariant = "default"): string {
  const style = BADGE_STYLES[variant] || BADGE_STYLES.default;
  return `inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${style.bg} ${style.text} ${style.border}`;
}

export function formatVND(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || amount === "") return "0 ₫";
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return "0 ₫";
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(num);
}

export function formatQty(qty: number | string | null | undefined, uom?: string): string {
  if (qty === null || qty === undefined || qty === "") return `0 ${uom || ""}`.trim();
  const num = typeof qty === "string" ? parseFloat(qty) : qty;
  if (isNaN(num)) return `0 ${uom || ""}`.trim();
  const formatted = new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: 3,
  }).format(num);
  return uom ? `${formatted} ${uom}` : formatted;
}

export function formatPercent(rate: number | string | null | undefined): string {
  if (rate === null || rate === undefined || rate === "") return "0%";
  const num = typeof rate === "string" ? parseFloat(rate) : rate;
  if (isNaN(num)) return "0%";
  return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(num)}%`;
}

export interface MultiUomStockResult {
  baseTotal: string;
  breakdown: string;
  fullText: string;
  parts: { name: string; qty: number }[];
}

// formatMultiUomStock decomposes atomic base quantities into human-readable pack hierarchy (e.g. 53 Lon -> 2 Thùng, 5 Lon lẻ)
export function formatMultiUomStock(
  baseQty: number | string | null | undefined,
  baseUom: string,
  conversions?: { uom_name: string; conversion_factor: number | string }[]
): MultiUomStockResult {
  const qty = typeof baseQty === "string" ? parseFloat(baseQty) : baseQty ?? 0;
  if (!qty || isNaN(qty) || qty <= 0) {
    const zeroStr = `0 ${baseUom}`.trim();
    return {
      baseTotal: zeroStr,
      breakdown: zeroStr,
      fullText: zeroStr,
      parts: [],
    };
  }

  const baseTotal = formatQty(qty, baseUom);

  if (!conversions || conversions.length === 0) {
    return {
      baseTotal,
      breakdown: baseTotal,
      fullText: baseTotal,
      parts: [{ name: baseUom, qty }],
    };
  }

  // Sort conversions descending by factor (>1)
  const sortedConversions = [...conversions]
    .map((c) => ({
      name: c.uom_name,
      factor: Number(c.conversion_factor) || 0,
    }))
    .filter((c) => c.factor > 1)
    .sort((a, b) => b.factor - a.factor);

  if (sortedConversions.length === 0) {
    return {
      baseTotal,
      breakdown: baseTotal,
      fullText: baseTotal,
      parts: [{ name: baseUom, qty }],
    };
  }

  let remaining = qty;
  const parts: { name: string; qty: number }[] = [];

  for (const conv of sortedConversions) {
    if (remaining >= conv.factor) {
      const count = Math.floor(remaining / conv.factor);
      if (count > 0) {
        parts.push({ name: conv.name, qty: count });
        remaining = remaining - count * conv.factor;
      }
    }
  }

  if (remaining > 0 || parts.length === 0) {
    parts.push({
      name: `${baseUom}${parts.length > 0 ? " lẻ" : ""}`,
      qty: Math.round(remaining * 1000) / 1000,
    });
  }

  const breakdown = parts
    .map((p) => `${Number.isInteger(p.qty) ? p.qty : p.qty.toFixed(2)} ${p.name}`)
    .join(", ");

  const fullText = parts.length > 1 ? `${breakdown} (${baseTotal})` : breakdown;

  return {
    baseTotal,
    breakdown,
    fullText,
    parts,
  };
}

export interface ModuleMeta {
  key: string;
  label: string;
  description: string;
  badgeVariant: BadgeVariant;
}

export const MODULE_DEFINITIONS: Record<string, ModuleMeta> = {
  catch_weight: {
    key: "catch_weight",
    label: "Cân thực tế & Đơn vị biến thiên",
    description: "Nhập cân nặng thực tế tại quầy, quản lý đơn vị phụ (con, rổ, két) theo tỷ lệ biến thiên.",
    badgeVariant: "catchweight",
  },
  matrix_variants: {
    key: "matrix_variants",
    label: "Ma trận Biến thể (Màu × Size)",
    description: "Quản lý sản phẩm thời trang theo tổ hợp thuộc tính, tự động sinh mã SKU theo bảng quy cách.",
    badgeVariant: "matrix",
  },
  bom_production: {
    key: "bom_production",
    label: "Chế biến & Định mức BOM",
    description: "Lập công thức thành phẩm, trừ kho nguyên vật liệu khi chế biến hoặc phân rã mổ xẻ.",
    badgeVariant: "bom",
  },
  batch_expiry: {
    key: "batch_expiry",
    label: "Quản lý Lô & Hạn sử dụng",
    description: "Theo dõi số lô, hạn dùng hàng tươi sống/thuốc, cảnh báo tồn kho cận ngày hết hạn.",
    badgeVariant: "alert",
  },
  dynamic_pos_pricing: {
    key: "dynamic_pos_pricing",
    label: "Giá bán linh hoạt tại quầy",
    description: "Cho phép thu ngân mặc cả, áp dụng giá bán theo khối lượng hoặc điều chỉnh giá trực tiếp.",
    badgeVariant: "info",
  },
  credit_ledger: {
    key: "credit_ledger",
    label: "Quản lý Sổ nợ & Công nợ",
    description: "Theo dõi công nợ nhà cung cấp khi nhập hàng và công nợ ghi sổ của khách quen.",
    badgeVariant: "outflow",
  },
  product_modifiers: {
    key: "product_modifiers",
    label: "Đồ ăn kèm & Topping (F&B)",
    description: "Gắn nhóm topping/gia vị đi kèm khi chọn món, tính phụ thu định lượng nguyên liệu.",
    badgeVariant: "modifier",
  },
};
