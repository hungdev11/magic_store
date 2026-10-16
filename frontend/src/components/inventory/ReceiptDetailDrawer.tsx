"use client";

import React, { useEffect, useState } from "react";
import { InventoryReceipt, api } from "@/lib/api";
import { formatQty, formatVND } from "@/lib/design-tokens";
import { Button } from "@/components/common/Button";
import { Badge } from "@/components/common/Badge";
import {
  X,
  Loader2,
  AlertCircle,
  FileText,
  Calendar,
  Building2,
  Package,
  Layers,
  ArrowDownToLine,
  Trash2,
} from "lucide-react";

export interface ReceiptDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  referenceId: string | null;
}

export const ReceiptDetailDrawer: React.FC<ReceiptDetailDrawerProps> = ({
  isOpen,
  onClose,
  referenceId,
}) => {
  const [receipt, setReceipt] = useState<InventoryReceipt | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !referenceId) {
      setReceipt(null);
      setError(null);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    api.getReceiptDetail(referenceId)
      .then((data) => {
        if (isMounted) {
          setReceipt(data);
        }
      })
      .catch((err: any) => {
        if (isMounted) {
          setError(err.message || "Không thể tải chi tiết phiếu.");
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, referenceId]);

  if (!isOpen) return null;

  const isPurchase = receipt?.movement_type === "PURCHASE_IN";

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-xs flex justify-end">
      <div className="w-full max-w-2xl bg-surface-card h-full shadow-2xl flex flex-col border-l border-border-default animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-4 border-b border-border-default flex items-start justify-between bg-surface-app/50">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-base font-bold text-text-main">
                {referenceId}
              </span>
              <Badge variant={isPurchase ? "inflow" : "outflow"}>
                {isPurchase ? "Phiếu Nhập Hàng" : "Phiếu Xuất Hủy"}
              </Badge>
            </div>
            {receipt?.created_at && (
              <div className="flex items-center gap-3 text-xs text-text-sub">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {new Date(receipt.created_at).toLocaleString("vi-VN")}
                </span>
                {receipt.partner_name && (
                  <span className="flex items-center gap-1 font-medium text-text-main">
                    <Building2 className="w-3.5 h-3.5 text-text-sub" />
                    {receipt.partner_name}
                  </span>
                )}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-sm hover:bg-surface-app text-text-sub hover:text-text-main transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {isLoading ? (
            <div className="h-64 flex flex-col items-center justify-center gap-2 text-text-sub">
              <Loader2 className="w-6 h-6 animate-spin text-brand" />
              <span className="text-xs">Đang tải thông tin chi tiết...</span>
            </div>
          ) : error ? (
            <div className="p-4 rounded-sm bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : receipt ? (
            <>
              {receipt.notes && (
                <div className="p-3 bg-surface-app border border-border-default rounded-sm text-xs">
                  <span className="font-medium text-text-sub block mb-0.5">Ghi chú phiếu:</span>
                  <p className="text-text-main whitespace-pre-wrap">{receipt.notes}</p>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-text-main uppercase tracking-wider px-1">
                  <span>Danh sách mặt hàng ({receipt.items?.length || 0})</span>
                  <span>Tổng SL: {formatQty(Number(receipt.total_qty || 0))}</span>
                </div>

                <div className="border border-border-default rounded-sm overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-surface-app text-text-sub font-semibold border-b border-border-default">
                      <tr>
                        <th className="py-2.5 px-3 text-left">Sản phẩm / SKU</th>
                        <th className="py-2.5 px-3 text-right">Số lượng</th>
                        <th className="py-2.5 px-3 text-right">Đơn giá</th>
                        <th className="py-2.5 px-3 text-right">Thành tiền</th>
                        <th className="py-2.5 px-3 text-left">Lô / HSD</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-default bg-surface-card">
                      {receipt.items?.map((item, idx) => (
                        <tr key={item.id || idx} className="hover:bg-surface-app/50 transition-colors">
                          <td className="py-2.5 px-3">
                            <div className="font-medium text-text-main">
                              {item.product_name || "Sản phẩm"}
                            </div>
                            <div className="font-mono text-[11px] text-text-sub">
                              {item.sku}
                              {item.variant_name && item.variant_name !== item.product_name && (
                                <span className="ml-1 text-text-sub/70">({item.variant_name})</span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                            <div className="font-semibold text-text-main">
                              {formatQty(Number(item.input_qty || 0))} {item.input_uom}
                            </div>
                            {item.input_uom !== item.base_uom && (
                              <div className="text-[10px] text-text-sub">
                                ≈ {formatQty(Number(item.qty_in_base_uom || 0))} {item.base_uom}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums text-text-sub">
                            {formatVND(Number(item.unit_cost_at_time || 0))}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-text-main">
                            {formatVND(Number(item.line_total || 0))}
                          </td>
                          <td className="py-2.5 px-3 text-left font-mono text-[11px]">
                            {item.batch_code ? (
                              <div>
                                <span className="font-medium text-brand">{item.batch_code}</span>
                                {item.expiry_date && (
                                  <div className="text-[10px] text-text-sub">
                                    HSD: {new Date(item.expiry_date).toLocaleDateString("vi-VN")}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-text-disabled">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : null}
        </div>

        {/* Footer */}
        {receipt && (
          <div className="p-4 border-t border-border-default bg-surface-app/50 flex items-center justify-between">
            <div>
              <span className="text-xs text-text-sub block">Tổng giá trị phiếu:</span>
              <span className="text-base font-bold font-mono tabular-nums text-brand">
                {formatVND(Number(receipt.total_amount || 0))}
              </span>
            </div>
            <Button variant="secondary" size="sm" onClick={onClose}>
              Đóng
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
