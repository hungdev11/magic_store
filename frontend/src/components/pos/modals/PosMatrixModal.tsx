"use client";

import React, { useState, useEffect, useMemo } from "react";
import { type Product, type ProductVariant } from "@/lib/api";
import { formatVND, formatQty } from "@/lib/design-tokens";
import { Modal, Button, Badge } from "@/components/common";
import { Layers, Plus, Minus, ShoppingCart, Check } from "lucide-react";

export interface MatrixSelectionItem {
  variant: ProductVariant;
  qty: number;
}

export interface PosMatrixModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product;
  onConfirm: (selections: MatrixSelectionItem[]) => void;
  onSelectSingle?: (variant: ProductVariant) => void;
}

function parseAttributes(raw?: Record<string, string> | string): Record<string, string> {
  if (!raw) return {};
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function getVariantStock(v?: ProductVariant): number {
  if (!v) return 0;
  const val = v.current_stock ?? v.current_inventory ?? 0;
  return Number(val) || 0;
}

// ponytail: interactive attribute rows selector; upgrade to dynamic facet hierarchy if cascading dependencies between attributes are required.
export const PosMatrixModal: React.FC<PosMatrixModalProps> = ({
  isOpen,
  onClose,
  product,
  onConfirm,
  onSelectSingle,
}) => {
  const variants = useMemo(() => product.variants || [], [product.variants]);

  // Extract all unique attribute keys and their distinct values
  const { attributeKeys, attributeValuesMap } = useMemo(() => {
    const keys: string[] = [];
    const valuesMap: Record<string, string[]> = {};

    variants.forEach((v) => {
      const attrs = parseAttributes(v.attributes);
      Object.entries(attrs).forEach(([key, val]) => {
        if (!keys.includes(key)) {
          keys.push(key);
          valuesMap[key] = [];
        }
        if (!valuesMap[key].includes(val)) {
          valuesMap[key].push(val);
        }
      });
    });

    return { attributeKeys: keys, attributeValuesMap: valuesMap };
  }, [variants]);

  // Selected attribute state: { "Màu sắc": "Trắng", "Kích cỡ": "M" }
  const [selectedAttributes, setSelectedAttributes] = useState<Record<string, string>>({});
  const [singleQty, setSingleQty] = useState<number>(1);

  // Initialize selected attributes with first variant when opened
  useEffect(() => {
    if (isOpen) {
      setSingleQty(1);
      if (variants.length > 0) {
        const firstAttrs = parseAttributes(variants[0].attributes);
        const initialSelections: Record<string, string> = {};
        attributeKeys.forEach((key) => {
          initialSelections[key] =
            firstAttrs[key] || attributeValuesMap[key]?.[0] || "";
        });
        setSelectedAttributes(initialSelections);
      } else {
        setSelectedAttributes({});
      }
    }
  }, [isOpen, variants, attributeKeys, attributeValuesMap]);

  // Matching variant based on picked attributes
  const matchingVariant = useMemo(() => {
    if (variants.length === 0) return null;
    return (
      variants.find((v) => {
        const attrs = parseAttributes(v.attributes);
        return attributeKeys.every((key) => {
          if (!selectedAttributes[key]) return true;
          return attrs[key] === selectedAttributes[key];
        });
      }) || variants[0]
    );
  }, [variants, attributeKeys, selectedAttributes]);

  const stock = matchingVariant ? getVariantStock(matchingVariant) : 0;
  const isOutOfStock = stock <= 0;

  const handleConfirm = () => {
    if (!matchingVariant) return;
    const qty = Math.max(1, singleQty);
    if (onSelectSingle) {
      onSelectSingle(matchingVariant);
    } else {
      onConfirm([{ variant: matchingVariant, qty }]);
    }
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      title={
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-brand" />
          <span>Chọn Thuộc Tính Sản Phẩm</span>
        </div>
      }
      description={product.name}
      footer={
        <div className="flex items-center justify-between w-full">
          <div>
            {matchingVariant && (
              <span className="text-xs text-text-sub">
                Đơn giá:{" "}
                <strong className="font-mono tabular-nums text-brand font-bold text-sm">
                  {formatVND(matchingVariant.base_selling_price)}
                </strong>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="secondary" size="md" onClick={onClose}>
              Đóng
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handleConfirm}
              disabled={!matchingVariant}
            >
              <Check className="w-4 h-4 mr-1.5" />
              <span>Thêm vào giỏ</span>
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {variants.length === 0 ? (
          <div className="p-8 text-center text-text-sub text-sm">
            Sản phẩm chưa có biến thể nào được cấu hình.
          </div>
        ) : (
          <div className="space-y-4">
            {/* Attribute Rows Selection */}
            {attributeKeys.map((attrKey) => {
              const values = attributeValuesMap[attrKey] || [];
              const currentVal = selectedAttributes[attrKey] || values[0];

              return (
                <div key={attrKey} className="space-y-1.5">
                  <label className="text-xs font-bold text-text-sub uppercase tracking-wider block">
                    {attrKey}:
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {values.map((val) => {
                      const isSelected = currentVal === val;
                      return (
                        <button
                          key={val}
                          type="button"
                          onClick={() =>
                            setSelectedAttributes((prev) => ({
                              ...prev,
                              [attrKey]: val,
                            }))
                          }
                          className={`px-3 py-1.5 rounded-sm text-xs font-semibold border transition-all ${
                            isSelected
                              ? "bg-brand text-white border-brand shadow-sm"
                              : "bg-surface-app text-text-main border-border-default hover:bg-surface-muted"
                          }`}
                        >
                          {val}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Matching Variant Card Preview */}
            {matchingVariant ? (
              <div className="p-3.5 rounded-sm bg-surface-muted/50 border border-border-default space-y-2 mt-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-text-main text-sm">
                    {matchingVariant.variant_name || matchingVariant.sku}
                  </span>
                  <span className="text-[11px] font-mono tabular-nums text-text-sub">
                    SKU: {matchingVariant.sku}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border-subtle">
                  <div>
                    <span className="text-[11px] text-text-sub block">Đơn giá bán:</span>
                    <span className="text-base font-extrabold font-mono tabular-nums text-brand">
                      {formatVND(matchingVariant.base_selling_price)}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-[11px] text-text-sub block">Tồn kho hiện tại:</span>
                    {isOutOfStock ? (
                      <Badge variant="outflow">Hết hàng</Badge>
                    ) : (
                      <span className="text-sm font-bold font-mono tabular-nums text-text-main">
                        {formatQty(stock, product.base_uom)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Quantity Spinner */}
                <div className="flex items-center justify-between pt-2 border-t border-border-subtle">
                  <span className="text-xs text-text-sub font-medium">Số lượng mua:</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSingleQty((q) => Math.max(1, q - 1))}
                      disabled={singleQty <= 1}
                      className="w-7 h-7 rounded-sm border border-border-default flex items-center justify-center text-text-sub hover:text-text-main hover:bg-surface-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <input
                      type="number"
                      min="1"
                      value={singleQty}
                      onChange={(e) => setSingleQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      className="w-14 h-7 text-center font-mono tabular-nums font-bold text-xs border border-border-default rounded-sm bg-surface-card focus:outline-none focus:border-border-focus"
                    />
                    <button
                      type="button"
                      onClick={() => setSingleQty((q) => q + 1)}
                      className="w-7 h-7 rounded-sm border border-border-default flex items-center justify-center text-text-sub hover:text-text-main hover:bg-surface-muted transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-sm bg-amber-50 border border-amber-200 text-xs text-amber-800">
                Không tìm thấy biến thể phù hợp với lựa chọn này.
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};
