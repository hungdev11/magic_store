"use client";

import React, { useState, useEffect, useMemo } from "react";
import { type Product, type ProductVariant } from "@/lib/api";
import { formatVND, formatQty } from "@/lib/design-tokens";
import { Modal, Button, Badge } from "@/components/common";
import { Layers, Plus, Minus, ShoppingCart } from "lucide-react";

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

// ponytail: 2-axis matrix grouping for size x color; upgrade to N-dimensional pivot table if >2 matrix dimensions required.
export const PosMatrixModal: React.FC<PosMatrixModalProps> = ({
  isOpen,
  onClose,
  product,
  onConfirm,
  onSelectSingle,
}) => {
  // Map of variantId -> selected quantity
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  useEffect(() => {
    if (isOpen) {
      setQuantities({});
    }
  }, [isOpen]);

  const variants = useMemo(() => product.variants || [], [product.variants]);

  // Extract matrix dimensions from variants attributes
  const { rowKey, colKey, rowValues, colValues, matrixMap } = useMemo(() => {
    const allParsed = variants.map((v) => ({
      variant: v,
      attrs: parseAttributes(v.attributes),
    }));

    // Collect all unique attribute keys
    const keyFrequency: Record<string, number> = {};
    allParsed.forEach(({ attrs }) => {
      Object.keys(attrs).forEach((k) => {
        keyFrequency[k] = (keyFrequency[k] || 0) + 1;
      });
    });

    const sortedKeys = Object.keys(keyFrequency).sort(
      (a, b) => keyFrequency[b] - keyFrequency[a]
    );

    const rKey = sortedKeys[0] || "";
    const cKey = sortedKeys[1] || "";

    const rSet = new Set<string>();
    const cSet = new Set<string>();
    const map = new Map<string, ProductVariant>();

    allParsed.forEach(({ variant, attrs }) => {
      const rVal = rKey ? attrs[rKey] || "Mặc định" : "Mặc định";
      const cVal = cKey ? attrs[cKey] || "Tiêu chuẩn" : "Tiêu chuẩn";
      rSet.add(rVal);
      if (cKey) cSet.add(cVal);
      map.set(`${rVal}___${cVal}`, variant);
    });

    return {
      rowKey: rKey,
      colKey: cKey,
      rowValues: Array.from(rSet),
      colValues: cKey ? Array.from(cSet) : [],
      matrixMap: map,
    };
  }, [variants]);

  const updateQty = (variantId: string, delta: number) => {
    setQuantities((prev) => {
      const current = prev[variantId] || 0;
      const next = Math.max(0, current + delta);
      if (next === 0) {
        const copy = { ...prev };
        delete copy[variantId];
        return copy;
      }
      return { ...prev, [variantId]: next };
    });
  };

  const setQtyDirect = (variantId: string, val: number) => {
    setQuantities((prev) => {
      const next = Math.max(0, val);
      if (next === 0) {
        const copy = { ...prev };
        delete copy[variantId];
        return copy;
      }
      return { ...prev, [variantId]: next };
    });
  };

  const totalSelectedCount = useMemo(() => {
    return Object.values(quantities).reduce((acc, q) => acc + q, 0);
  }, [quantities]);

  const totalAmount = useMemo(() => {
    return variants.reduce((acc, v) => {
      const q = quantities[v.id] || 0;
      return acc + q * (Number(v.base_selling_price) || 0);
    }, 0);
  }, [variants, quantities]);

  const handleConfirm = () => {
    const selections: MatrixSelectionItem[] = [];
    variants.forEach((v) => {
      const q = quantities[v.id];
      if (q && q > 0) {
        selections.push({ variant: v, qty: q });
      }
    });

    if (selections.length > 0) {
      onConfirm(selections);
      onClose();
    }
  };

  const handleSingleSelect = (v: ProductVariant) => {
    if (onSelectSingle) {
      onSelectSingle(v);
    } else {
      onConfirm([{ variant: v, qty: 1 }]);
    }
    onClose();
  };

  const handleInputKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    v: ProductVariant
  ) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const q = quantities[v.id] || 0;
      if (q > 0) {
        handleConfirm();
      } else {
        handleSingleSelect(v);
      }
    }
  };

  const has2DMatrix = colValues.length > 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      title={
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-brand" />
          <span>Chọn Biến Thể Sản Phẩm</span>
        </div>
      }
      description={product.name}
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-baseline gap-3 text-xs">
            <span className="text-text-sub">
              Đã chọn:{" "}
              <strong className="font-mono tabular-nums text-text-main text-sm">
                {totalSelectedCount}
              </strong>{" "}
              sản phẩm
            </span>
            {totalSelectedCount > 0 && (
              <span className="text-text-sub">
                Tổng tiền:{" "}
                <strong className="font-mono tabular-nums text-brand text-sm">
                  {formatVND(totalAmount)}
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
              disabled={totalSelectedCount === 0}
            >
              <ShoppingCart className="w-4 h-4 mr-1.5" />
              <span>Thêm vào giỏ ({totalSelectedCount})</span>
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
        ) : has2DMatrix ? (
          /* 2D Matrix Table: Row Attribute x Column Attribute */
          <div className="overflow-x-auto border border-border-default rounded-sm">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-surface-muted border-b border-border-subtle">
                  <th className="p-2.5 font-semibold text-text-sub border-r border-border-subtle min-w-[120px]">
                    {rowKey} \ {colKey}
                  </th>
                  {colValues.map((colVal) => (
                    <th
                      key={colVal}
                      className="p-2.5 font-semibold text-text-main text-center border-r last:border-r-0 border-border-subtle min-w-[130px]"
                    >
                      {colVal}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle bg-surface-card">
                {rowValues.map((rowVal) => (
                  <tr key={rowVal} className="hover:bg-surface-app/50 transition-colors">
                    <td className="p-2.5 font-semibold text-text-main border-r border-border-subtle bg-surface-muted/30">
                      {rowVal}
                    </td>
                    {colValues.map((colVal) => {
                      const v = matrixMap.get(`${rowVal}___${colVal}`);
                      if (!v) {
                        return (
                          <td
                            key={colVal}
                            className="p-2.5 text-center text-text-disabled border-r last:border-r-0 border-border-subtle bg-surface-muted/10"
                          >
                            -
                          </td>
                        );
                      }

                      const stock = getVariantStock(v);
                      const qty = quantities[v.id] || 0;
                      const isOutOfStock = stock <= 0;

                      return (
                        <td
                          key={colVal}
                          onDoubleClick={() => handleSingleSelect(v)}
                          title="Nhấp đúp để chọn nhanh 1 sản phẩm"
                          className={`p-2 border-r last:border-r-0 border-border-subtle text-center cursor-pointer select-none ${
                            qty > 0 ? "bg-brand/5" : ""
                          }`}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-mono tabular-nums font-bold text-brand">
                                {formatVND(v.base_selling_price)}
                              </span>
                              <span
                                className={`font-mono tabular-nums ${
                                  isOutOfStock ? "text-outflow font-semibold" : "text-text-sub"
                                }`}
                              >
                                Tồn: {formatQty(stock)}
                              </span>
                            </div>

                            <div className="flex items-center justify-center gap-1 mt-1">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateQty(v.id, -1);
                                }}
                                disabled={qty <= 0}
                                className="w-6 h-6 rounded-sm border border-border-default flex items-center justify-center text-text-sub hover:text-text-main hover:bg-surface-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <input
                                type="number"
                                min="0"
                                value={qty || ""}
                                placeholder="0"
                                onClick={(e) => e.stopPropagation()}
                                onDoubleClick={(e) => e.stopPropagation()}
                                onKeyDown={(e) => handleInputKeyDown(e, v)}
                                onChange={(e) =>
                                  setQtyDirect(v.id, parseInt(e.target.value, 10) || 0)
                                }
                                className="w-12 h-6 text-center font-mono tabular-nums font-bold text-xs border border-border-default rounded-sm bg-surface-card focus:outline-none focus:border-border-focus"
                              />
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateQty(v.id, 1);
                                }}
                                className="w-6 h-6 rounded-sm border border-border-default flex items-center justify-center text-text-sub hover:text-text-main hover:bg-surface-muted transition-colors"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          /* 1D Grid / List: When no 2-axis matrix */
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[60vh] overflow-y-auto">
            {variants.map((v) => {
              const attrs = parseAttributes(v.attributes);
              const attrLabels = Object.entries(attrs).map(([k, val]) => `${k}: ${val}`);
              const stock = getVariantStock(v);
              const qty = quantities[v.id] || 0;
              const isOutOfStock = stock <= 0;

              return (
                <div
                  key={v.id}
                  onDoubleClick={() => handleSingleSelect(v)}
                  title="Nhấp đúp để chọn nhanh 1 sản phẩm"
                  className={`p-3 rounded-sm border transition-colors flex flex-col justify-between cursor-pointer select-none ${
                    qty > 0
                      ? "border-brand bg-brand/5"
                      : "border-border-default bg-surface-card hover:border-border-focus"
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-bold text-text-main text-sm">
                        {v.variant_name || v.sku}
                      </div>
                      {attrLabels.length > 0 && (
                        <div className="text-xs text-text-sub mt-0.5">
                          {attrLabels.join(" • ")}
                        </div>
                      )}
                      <div className="text-[11px] font-mono tabular-nums text-text-sub mt-0.5">
                        SKU: {v.sku}
                      </div>
                    </div>

                    {isOutOfStock ? (
                      <Badge variant="outflow">Hết hàng</Badge>
                    ) : (
                      <span className="text-xs font-mono tabular-nums text-text-sub">
                        Tồn: {formatQty(stock, product.base_uom)}
                      </span>
                    )}
                  </div>

                  <div className="mt-3 pt-2 border-t border-border-subtle flex items-center justify-between">
                    <span className="font-bold font-mono tabular-nums text-brand text-sm">
                      {formatVND(v.base_selling_price)}
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          updateQty(v.id, -1);
                        }}
                        disabled={qty <= 0}
                        className="w-7 h-7 rounded-sm border border-border-default flex items-center justify-center text-text-sub hover:text-text-main hover:bg-surface-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <input
                        type="number"
                        min="0"
                        value={qty || ""}
                        placeholder="0"
                        onClick={(e) => e.stopPropagation()}
                        onDoubleClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => handleInputKeyDown(e, v)}
                        onChange={(e) =>
                          setQtyDirect(v.id, parseInt(e.target.value, 10) || 0)
                        }
                        className="w-14 h-7 text-center font-mono tabular-nums font-bold text-xs border border-border-default rounded-sm bg-surface-card focus:outline-none focus:border-border-focus"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          updateQty(v.id, 1);
                        }}
                        className="w-7 h-7 rounded-sm border border-border-default flex items-center justify-center text-text-sub hover:text-text-main hover:bg-surface-muted transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
};
