import { type Product, type ProductVariant } from "./api";

// ponytail: simple filter(Boolean).join(" "); upgrade to clsx + tailwind-merge if Tailwind class collision deduplication needed.
export function cn(...inputs: (string | undefined | null | false | boolean)[]): string {
  return inputs.filter(Boolean).join(" ");
}

export function parseAttributes(raw?: Record<string, string> | string): Record<string, string> {
  if (!raw) return {};
  if (typeof raw === "object" && !Array.isArray(raw)) return raw;
  if (typeof raw !== "string") return {};
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed;
    }
    return {};
  } catch {
    return {};
  }
}

export function getVariantStock(v?: ProductVariant): number {
  if (!v) return 0;
  const val = v.current_stock ?? v.current_inventory ?? 0;
  return Number(val) || 0;
}

export function getVariantAvailableStock(
  v?: ProductVariant,
  warehouseStockMap?: Map<string, number>
): number {
  if (!v) return 0;
  if (warehouseStockMap && warehouseStockMap.has(v.id)) {
    return warehouseStockMap.get(v.id) ?? 0;
  }
  return getVariantStock(v);
}

export function getProductTotalStock(p: Product): number {
  if (!p.variants || p.variants.length === 0) return 0;
  return p.variants.reduce((acc, v) => acc + getVariantStock(v), 0);
}

export function isWeighableProduct(p: Product): boolean {
  return (
    p.is_weighable ||
    Boolean(
      p.variants?.some((v) =>
        v.uom_conversions?.some((c) => c.is_variable_ratio)
      )
    )
  );
}

export function isMatrixProduct(p: Product): boolean {
  if (!p.variants) return false;
  if (p.variants.length > 1) return true;
  const firstAttrs = p.variants[0]?.attributes;
  return Boolean(firstAttrs && Object.keys(parseAttributes(firstAttrs)).length > 0);
}

export function isModifierProduct(p: Product): boolean {
  return (
    p.production_mode === "POS_BACKFLUSH" ||
    p.production_mode === "ASSEMBLY" ||
    p.product_type === "COMBO" ||
    Boolean((p as any).modifier_groups && (p as any).modifier_groups.length > 0)
  );
}
