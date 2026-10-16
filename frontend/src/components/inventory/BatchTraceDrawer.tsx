"use client";

import React, { useEffect, useState } from "react";
import { BatchItem, InventoryMovementItem, api } from "@/lib/api";
import { formatQty, formatVND } from "@/lib/design-tokens";
import { Button } from "@/components/common/Button";
import {
  X,
  Loader2,
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  Clock,
  FileSpreadsheet,
  PackageCheck,
  History,
} from "lucide-react";

export interface BatchTraceDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  batch: BatchItem | null;
}

interface MovementMeta {
  label: string;
  badgeClass: string;
  isAddition: boolean;
}

function resolveMovementMeta(type: string): MovementMeta {
  switch (type) {
    case "PURCHASE_IN":
      return {
        label: "Nhập hàng",
        badgeClass: "bg-inflow-light text-inflow border-inflow/20",
        isAddition: true,
      };
    case "SALE_OUT":
      return {
        label: "Bán hàng",
        badgeClass: "bg-outflow-light text-outflow border-outflow/20",
        isAddition: false,
      };
    case "WASTAGE_SPOILAGE":
      return {
        label: "Xuất hủy/hao hụt",
        badgeClass: "bg-outflow-light text-outflow border-outflow/20",
        isAddition: false,
      };
    case "PRODUCTION_CONSUME":
      return {
        label: "Tiêu hao sản xuất",
        badgeClass: "bg-purple-50 text-purple-700 border-purple-200",
        isAddition: false,
      };
    case "PRODUCTION_YIELD":
      return {
        label: "Thành phẩm sản xuất",
        badgeClass: "bg-indigo-50 text-indigo-700 border-indigo-200",
        isAddition: true,
      };
    case "RETURN_IN":
      return {
        label: "Nhập trả hàng",
        badgeClass: "bg-inflow-light text-inflow border-inflow/20",
        isAddition: true,
      };
    case "STATE_TRANSFORM":
      return {
        label: "Chuyển trạng thái",
        badgeClass: "bg-sky-50 text-sky-700 border-sky-200",
        isAddition: false,
      };
    case "STOCKTAKE_ADJUST":
      return {
        label: "Kiểm kê cân đối",
        badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
        isAddition: false,
      };
    default:
      return {
        label: type,
        badgeClass: "bg-surface-muted text-text-sub border-border-subtle",
        isAddition: false,
      };
  }
}

function formatTraceDateTime(dateStr?: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(d);
}

// ponytail: single drawer slide-over without framer-motion; upgrade to motion-primitives if custom gesture dismissals needed.
export function BatchTraceDrawer({
  isOpen,
  onClose,
  batch,
}: BatchTraceDrawerProps) {
  const [movements, setMovements] = useState<InventoryMovementItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  const fetchTrace = async () => {
    if (!batch?.id) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getBatchTrace(batch.id);
      setMovements(data || []);
    } catch (err: any) {
      setError(err.message || "Không thể tải lịch sử biến động lô.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && batch?.id) {
      fetchTrace();
    } else {
      setMovements([]);
      setError(null);
    }
  }, [isOpen, batch?.id]);

  if (!isOpen || !batch) return null;

  const productName = batch.variant?.product?.name || "Sản phẩm";
  const sku = batch.variant?.sku || batch.variant_id;
  const baseUom = batch.variant?.product?.base_uom || "";

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/60 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="trace-drawer-title"
        className="w-full max-w-lg h-full bg-surface-card border-l border-border-default shadow-card flex flex-col animate-in slide-in-from-right duration-200"
      >
        {/* Drawer Header */}
        <div className="px-4 py-3.5 border-b border-border-subtle flex items-start justify-between gap-3 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-brand shrink-0" />
              <h2 id="trace-drawer-title" className="text-sm font-semibold text-text-main">
                Truy vết biến động lô
              </h2>
              <span className="font-mono text-xs px-2 py-0.5 bg-surface-muted border border-border-subtle rounded-sm font-medium text-text-main">
                {batch.batch_code}
              </span>
            </div>
            <p className="text-xs text-text-sub mt-1">
              {productName} <span className="font-mono">({sku})</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="p-1 rounded-sm text-text-sub hover:text-text-main hover:bg-surface-muted transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Batch Summary Bar */}
        <div className="px-4 py-2.5 bg-surface-muted/60 border-b border-border-subtle flex items-center justify-between text-xs shrink-0">
          <div>
            <span className="text-text-sub">Tồn kho còn lại: </span>
            <span className="font-mono tabular-nums font-semibold text-text-main">
              {formatQty(batch.remaining_qty)} {baseUom}
            </span>
            <span className="text-text-sub"> / Ban đầu: </span>
            <span className="font-mono tabular-nums text-text-sub">
              {formatQty(batch.initial_qty)} {baseUom}
            </span>
          </div>
          <button
            type="button"
            onClick={fetchTrace}
            disabled={isLoading}
            className="inline-flex items-center gap-1 text-[11px] text-text-sub hover:text-text-main transition-colors"
            title="Làm mới lịch sử"
          >
            <RefreshCw className={`w-3 h-3 ${isLoading ? "animate-spin" : ""}`} />
            <span>Tải lại</span>
          </button>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-text-sub">
              <Loader2 className="w-5 h-5 animate-spin text-brand" />
              <span className="text-xs">Đang truy vấn lịch sử biến động...</span>
            </div>
          ) : error ? (
            <div className="p-3 bg-outflow-light border border-outflow/20 rounded-sm text-xs text-outflow space-y-2">
              <div className="flex items-center gap-1.5 font-medium">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Lỗi truy vấn dữ liệu</span>
              </div>
              <p>{error}</p>
              <Button size="sm" variant="outline" onClick={fetchTrace}>
                Thử lại
              </Button>
            </div>
          ) : movements.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-text-sub space-y-2">
              <FileSpreadsheet className="w-8 h-8 text-text-disabled" />
              <p className="text-xs">Chưa có giao dịch biến động nào được ghi nhận cho lô này.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {movements.map((item) => {
                const meta = resolveMovementMeta(item.movement_type);
                const rawQty = Number(item.qty_in_base_uom || 0);
                // When rawQty is explicitly signed, respect sign; else infer from meta
                const isNeg = rawQty < 0 || (!meta.isAddition && rawQty > 0 && item.movement_type === "SALE_OUT");
                const absQty = Math.abs(rawQty);
                const sign = isNeg ? "-" : "+";
                const qtyColor = isNeg ? "text-outflow" : "text-inflow";
                const displayUom = item.input_uom || baseUom;

                return (
                  <div
                    key={item.id}
                    className="p-3 bg-surface-card border border-border-default rounded-sm space-y-2 hover:border-border-focus transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`inline-flex items-center px-1.5 py-0.5 rounded-sm text-[11px] font-medium border ${meta.badgeClass}`}
                        >
                          {meta.label}
                        </span>
                        {item.reference_id && (
                          <span
                            className="font-mono text-[11px] bg-surface-muted border border-border-subtle px-1.5 py-0.5 rounded-sm text-text-sub truncate max-w-[150px]"
                            title={`Mã tham chiếu: ${item.reference_id}`}
                          >
                            Ref: {item.reference_id}
                          </span>
                        )}
                      </div>
                      <div className={`font-mono tabular-nums text-sm font-semibold ${qtyColor}`}>
                        {sign}
                        {formatQty(absQty)} {displayUom}
                      </div>
                    </div>

                    {item.reason_note && (
                      <p className="text-xs text-text-sub italic bg-surface-muted/50 p-1.5 rounded-sm border border-border-subtle">
                        {item.reason_note}
                      </p>
                    )}

                    <div className="flex items-center justify-between text-[11px] text-text-sub font-mono tabular-nums pt-1 border-t border-border-subtle">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-text-disabled" />
                        {formatTraceDateTime(item.created_at)}
                      </span>
                      {Number(item.unit_cost_at_time || 0) > 0 && (
                        <span>Giá vốn: {formatVND(item.unit_cost_at_time)}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Drawer Footer */}
        <div className="px-4 py-3 bg-surface-muted border-t border-border-subtle flex items-center justify-between shrink-0">
          <span className="text-xs text-text-sub font-mono tabular-nums">
            Tổng cộng: {movements.length} giao dịch
          </span>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Đóng
          </Button>
        </div>
      </div>
    </div>
  );
}
