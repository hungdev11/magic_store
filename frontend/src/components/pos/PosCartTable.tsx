"use client";

import React from "react";
import {
  Trash2,
  Plus,
  Minus,
  RotateCcw,
  X,
  ShoppingCart,
  Edit2,
} from "lucide-react";
import { type PosCartItem } from "@/lib/pos-store";
import { formatVND, formatQty } from "@/lib/design-tokens";
import { Badge } from "@/components/common";

export interface PosCartTableProps {
  items: PosCartItem[];
  onUpdateQty: (id: string, newQty: number) => void;
  onOpenPriceModal?: (item: PosCartItem) => void;
  onToggleReturn: (id: string) => void;
  onRemoveItem: (id: string) => void;
  onClearCart?: () => void;
  className?: string;
}

// ponytail: high density table layout fixed to 36-40px row height; upgrade to virtualized table list when cart exceeds 100 items.
export const PosCartTable: React.FC<PosCartTableProps> = ({
  items,
  onUpdateQty,
  onOpenPriceModal,
  onToggleReturn,
  onRemoveItem,
  onClearCart,
  className = "",
}) => {
  if (items.length === 0) {
    return (
      <div
        className={`flex-1 flex flex-col items-center justify-center p-6 text-text-sub border-b border-border-subtle bg-surface-card ${className}`}
      >
        <div className="w-12 h-12 rounded-sm bg-surface-muted flex items-center justify-center mb-2">
          <ShoppingCart className="w-6 h-6 stroke-1 text-text-disabled" />
        </div>
        <p className="text-sm font-semibold text-text-main">Giỏ hàng đang trống</p>
        <p className="text-xs text-text-sub text-center max-w-[260px] mt-1">
          Chạm vào sản phẩm trong bảng hoặc quét mã vạch Barcode [F2] để thêm vào đơn.
        </p>
      </div>
    );
  }

  return (
    <div className={`flex-1 flex flex-col min-h-0 bg-surface-card select-none ${className}`}>
      {/* High Density Table Controls Bar */}
      <div className="px-3 py-1.5 bg-surface-muted/40 border-b border-border-subtle flex items-center justify-between text-xs shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-text-main">Chi tiết giỏ hàng</span>
          <span className="px-1.5 py-[1px] rounded-sm bg-surface-app border border-border-subtle font-mono text-[11px] font-bold text-text-sub tabular-nums">
            {items.length} mặt hàng
          </span>
        </div>
        {onClearCart && (
          <button
            type="button"
            onClick={onClearCart}
            className="inline-flex items-center gap-1 text-[11px] text-text-sub hover:text-outflow transition-colors"
            title="Xóa toàn bộ giỏ hàng"
          >
            <Trash2 className="w-3 h-3" />
            <span>Xóa giỏ</span>
          </button>
        )}
      </div>

      {/* Table Container */}
      <div className="flex-1 overflow-y-auto overflow-x-auto min-h-0">
        <table className="w-full text-xs text-left border-collapse">
          <thead className="bg-surface-muted sticky top-0 z-10 border-b border-border-subtle">
            <tr className="h-9 text-text-sub font-semibold">
              <th className="w-8 text-center px-2">#</th>
              <th className="px-3 text-left min-w-[140px]">Tên mặt hàng / Quy cách</th>
              <th className="w-14 text-center px-1">ĐVT</th>
              <th className="w-24 text-right px-2">Đơn giá</th>
              <th className="w-28 text-center px-2">Số lượng</th>
              <th className="w-24 text-right px-3">Thành tiền</th>
              <th className="w-16 text-center px-2">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {items.map((item, index) => {
              const isReturn = item.isReturn;

              return (
                <tr
                  key={item.id}
                  className={`min-h-[38px] transition-colors ${
                    isReturn
                      ? "bg-outflow/5 hover:bg-outflow/10 text-outflow"
                      : "hover:bg-surface-muted/30"
                  }`}
                >
                  {/* STT */}
                  <td className="w-8 text-center px-2 font-mono text-[11px] text-text-sub tabular-nums">
                    {index + 1}
                  </td>

                  {/* Name, SKU, Badges & Toppings */}
                  <td className="px-3 py-1.5 text-left align-middle">
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-text-main line-clamp-1">
                          {item.productName}
                        </span>
                        {item.variantName && item.variantName !== item.productName && (
                          <span className="text-[11px] text-text-sub font-medium">
                            ({item.variantName})
                          </span>
                        )}

                        {/* Badges */}
                        {isReturn && (
                          <Badge variant="outflow" className="text-[10px] px-1 py-0">
                            TRẢ HÀNG
                          </Badge>
                        )}
                        {item.isWeighable && (
                          <Badge variant="catchweight" className="text-[10px] px-1 py-0">
                            {formatQty(item.actualBaseQty, item.baseUom)}
                          </Badge>
                        )}
                        {item.isPriceOverridden && (
                          <Badge variant="alert" className="text-[10px] px-1 py-0">
                            Sửa giá
                          </Badge>
                        )}
                        {item.isBelowMinPrice && (
                          <Badge variant="outflow" className="text-[10px] px-1 py-0">
                            Dưới sàn
                          </Badge>
                        )}
                      </div>

                      {/* SKU */}
                      <span className="font-mono text-[10px] text-text-sub">
                        {item.sku}
                      </span>

                      {/* Modifiers / Toppings */}
                      {item.modifiers && item.modifiers.length > 0 && (
                        <div className="pl-1.5 border-l-2 border-brand/40 text-[10px] text-text-sub space-y-0.5 mt-0.5">
                          {item.modifiers.map((mod, i) => (
                            <div key={i} className="flex items-center justify-between gap-1">
                              <span>+ {mod.name}</span>
                              <span className="font-mono tabular-nums">
                                +{formatVND(mod.price)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>

                  {/* UOM */}
                  <td className="w-14 text-center px-1 font-medium text-text-sub">
                    {item.soldUom}
                  </td>

                  {/* Unit Price (Clickable to open PosPriceModal) */}
                  <td className="w-24 text-right px-2 font-mono tabular-nums">
                    {onOpenPriceModal ? (
                      <button
                        type="button"
                        onClick={() => onOpenPriceModal(item)}
                        className="inline-flex items-center gap-1 text-text-main hover:text-brand underline decoration-dotted underline-offset-2 transition-colors font-medium"
                        title="Bấm để chỉnh sửa đơn giá hoặc chiết khấu"
                      >
                        <span>{formatVND(item.actualUnitPrice)}</span>
                        <Edit2 className="w-2.5 h-2.5 text-text-sub opacity-70" />
                      </button>
                    ) : (
                      <span className="text-text-main font-medium">
                        {formatVND(item.actualUnitPrice)}
                      </span>
                    )}
                  </td>

                  {/* Quantity Stepper */}
                  <td className="w-28 text-center px-2">
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onUpdateQty(item.id, Math.max(0, item.soldQty - 1))}
                        className="w-5 h-5 rounded-sm bg-surface-card border border-border-default hover:bg-surface-muted flex items-center justify-center text-text-sub hover:text-text-main"
                        title="Giảm 1"
                      >
                        <Minus className="w-2.5 h-2.5" />
                      </button>

                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={item.soldQty}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          if (!isNaN(val) && val >= 0) {
                            onUpdateQty(item.id, val);
                          }
                        }}
                        className="w-10 h-6 text-center font-mono font-bold text-xs bg-surface-app border border-border-default rounded-sm focus:outline-none focus:border-border-focus tabular-nums"
                      />

                      <button
                        type="button"
                        onClick={() => onUpdateQty(item.id, item.soldQty + 1)}
                        className="w-5 h-5 rounded-sm bg-surface-card border border-border-default hover:bg-surface-muted flex items-center justify-center text-text-sub hover:text-text-main"
                        title="Tăng 1"
                      >
                        <Plus className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  </td>

                  {/* Line Total */}
                  <td className="w-24 text-right px-3 font-mono font-bold text-sm tabular-nums text-text-main">
                    {isReturn ? (
                      <span className="text-outflow">-{formatVND(Math.abs(item.lineTotal))}</span>
                    ) : (
                      formatVND(item.lineTotal)
                    )}
                  </td>

                  {/* Actions: Return toggle and Remove */}
                  <td className="w-16 text-center px-2">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => onToggleReturn(item.id)}
                        className={`p-1 rounded-sm border transition-colors ${
                          isReturn
                            ? "bg-outflow text-white border-outflow"
                            : "bg-surface-app text-text-sub border-border-subtle hover:text-outflow hover:border-outflow"
                        }`}
                        title={isReturn ? "Hủy đổi trả" : "Đánh dấu đổi trả mặt hàng này [F9]"}
                      >
                        <RotateCcw className="w-3 h-3" />
                      </button>

                      <button
                        type="button"
                        onClick={() => onRemoveItem(item.id)}
                        className="p-1 rounded-sm bg-surface-app text-text-sub border border-border-subtle hover:text-outflow hover:border-outflow transition-colors"
                        title="Xóa mặt hàng khỏi giỏ"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
