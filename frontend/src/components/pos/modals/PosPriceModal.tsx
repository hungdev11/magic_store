"use client";

import React, { useState, useEffect } from "react";
import { type PosCartItem } from "@/lib/pos-store";
import { formatVND, formatPercent } from "@/lib/design-tokens";
import { Modal, Button, Input } from "@/components/common";
import { DollarSign, Percent, AlertTriangle, RotateCcw } from "lucide-react";

export interface PosPriceModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: PosCartItem;
  maxDiscountPercent?: number;
  onConfirm: (newUnitPrice: number) => void;
}

const DISCOUNT_PRESETS = [5, 10, 15, 20, 30, 50];
const NUMPAD_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "000", "0", "DEL"];

// ponytail: touch numpad supports price and discount percent toggles; upgrade to role-based supervisor override PIN modal if cashier limit exceeded.
export const PosPriceModal: React.FC<PosPriceModalProps> = ({
  isOpen,
  onClose,
  item,
  maxDiscountPercent = 50,
  onConfirm,
}) => {
  const [activeTab, setActiveTab] = useState<"PRICE" | "DISCOUNT">("PRICE");
  const [priceString, setPriceString] = useState<string>("0");
  const [discountString, setDiscountString] = useState<string>("0");

  useEffect(() => {
    if (isOpen) {
      setActiveTab("PRICE");
      setPriceString(item.actualUnitPrice.toString());
      const original = item.originalUnitPrice || item.actualUnitPrice;
      if (original > 0 && original > item.actualUnitPrice) {
        const pct = Math.round(((original - item.actualUnitPrice) / original) * 100);
        setDiscountString(pct.toString());
      } else {
        setDiscountString("0");
      }
    }
  }, [isOpen, item]);

  // Derived effective values
  const currentPrice =
    activeTab === "PRICE"
      ? parseFloat(priceString) || 0
      : Math.max(
          0,
          Math.round(
            item.originalUnitPrice * (1 - (parseFloat(discountString) || 0) / 100)
          )
        );

  const effectiveDiscountPercent =
    activeTab === "DISCOUNT"
      ? parseFloat(discountString) || 0
      : item.originalUnitPrice > 0 && item.originalUnitPrice > currentPrice
      ? Math.round(((item.originalUnitPrice - currentPrice) / item.originalUnitPrice) * 100)
      : 0;

  const handleKeypadPress = (val: string) => {
    if (activeTab === "PRICE") {
      if (val === "DEL") {
        setPriceString((prev) => (prev.length > 1 ? prev.slice(0, -1) : "0"));
      } else if (val === "000") {
        setPriceString((prev) => (prev === "0" ? "0" : prev + "000"));
      } else {
        setPriceString((prev) => (prev === "0" ? val : prev + val));
      }
    } else {
      // DISCOUNT mode (0 - 100%)
      if (val === "DEL") {
        setDiscountString((prev) => (prev.length > 1 ? prev.slice(0, -1) : "0"));
      } else if (val === "000") {
        // Ignored for discount mode
      } else {
        setDiscountString((prev) => {
          const nextVal = prev === "0" ? val : prev + val;
          const num = parseFloat(nextVal);
          if (num > 100) return "100";
          return nextVal;
        });
      }
    }
  };

  const handleResetToOriginal = () => {
    setPriceString(item.originalUnitPrice.toString());
    setDiscountString("0");
  };

  const minPrice = item.minSellingPrice || 0;
  const isBelowMin = minPrice > 0 && currentPrice < minPrice;
  const isOverMaxDiscount = effectiveDiscountPercent > maxDiscountPercent;

  const handleSave = () => {
    onConfirm(currentPrice);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      title={
        <div className="flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-brand" />
          <span>Sửa Giá & Chiết Khấu</span>
        </div>
      }
      description={item.productName}
      footer={
        <div className="flex items-center justify-end gap-2 w-full">
          <Button variant="secondary" size="md" onClick={onClose}>
            Hủy
          </Button>
          <Button variant="primary" size="md" onClick={handleSave}>
            Cập nhật giá
          </Button>
        </div>
      }
    >
      <div className="space-y-3.5">
        {/* Product Reference Price Tags */}
        <div className="p-2.5 rounded-sm bg-surface-muted border border-border-subtle flex justify-between text-xs">
          <div>
            <span className="text-text-sub block">Giá niêm yết</span>
            <span className="font-mono tabular-nums font-bold text-text-main">
              {formatVND(item.originalUnitPrice)}
            </span>
          </div>
          <div className="text-right">
            <span className="text-text-sub block">Giá sàn tối thiểu</span>
            <span className="font-mono tabular-nums font-bold text-text-main">
              {formatVND(minPrice)}
            </span>
          </div>
        </div>

        {/* Mode Toggle: Price vs Discount */}
        <div className="grid grid-cols-2 gap-1 p-0.5 rounded-sm bg-surface-muted border border-border-subtle">
          <button
            type="button"
            onClick={() => setActiveTab("PRICE")}
            className={`py-1.5 text-xs font-semibold rounded-sm transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === "PRICE"
                ? "bg-surface-card text-text-main border border-border-default shadow-sm"
                : "text-text-sub hover:text-text-main"
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            <span>Đơn giá (₫)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("DISCOUNT")}
            className={`py-1.5 text-xs font-semibold rounded-sm transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === "DISCOUNT"
                ? "bg-surface-card text-text-main border border-border-default shadow-sm"
                : "text-text-sub hover:text-text-main"
            }`}
          >
            <Percent className="w-3.5 h-3.5" />
            <span>Chiết khấu (%)</span>
          </button>
        </div>

        {/* Active Input Display */}
        {activeTab === "PRICE" ? (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <label htmlFor="price-numpad-input" className="font-semibold text-text-sub">
                Đơn giá mới:
              </label>
              <button
                type="button"
                onClick={handleResetToOriginal}
                className="inline-flex items-center gap-1 text-[11px] text-brand hover:underline"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Đặt lại giá gốc</span>
              </button>
            </div>
            <Input
              id="price-numpad-input"
              type="text"
              readOnly
              value={formatVND(parseFloat(priceString) || 0)}
              className="text-right font-mono tabular-nums text-lg font-bold"
            />
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <label htmlFor="discount-numpad-input" className="font-semibold text-text-sub">
                Mức chiết khấu (%):
              </label>
              <span className="text-[11px] font-mono tabular-nums text-brand font-medium">
                → Đơn giá: {formatVND(currentPrice)}
              </span>
            </div>
            <Input
              id="discount-numpad-input"
              type="text"
              readOnly
              value={formatPercent(parseFloat(discountString) || 0)}
              className="text-right font-mono tabular-nums text-lg font-bold"
            />
            {/* Quick Discount Presets */}
            <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
              {DISCOUNT_PRESETS.map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => setDiscountString(pct.toString())}
                  className="px-2 py-1 rounded-sm bg-surface-muted hover:bg-surface-app border border-border-subtle text-xs font-mono tabular-nums font-semibold text-text-main whitespace-nowrap transition-colors"
                >
                  {pct}%
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Warnings Section */}
        {isBelowMin && (
          <div className="p-2 rounded-sm bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-1.5 font-medium">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
            <span>
              Cảnh báo: Đơn giá ({formatVND(currentPrice)}) thấp hơn giá sàn tối thiểu (
              {formatVND(minPrice)})!
            </span>
          </div>
        )}

        {isOverMaxDiscount && (
          <div className="p-2 rounded-sm bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-start gap-1.5 font-medium">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
            <span>
              Cảnh báo: Chiết khấu {effectiveDiscountPercent}% vượt mức tối đa cho phép (
              {maxDiscountPercent}%).
            </span>
          </div>
        )}

        {/* Touch Numpad */}
        <div className="grid grid-cols-3 gap-1.5">
          {NUMPAD_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => handleKeypadPress(key)}
              className="py-2 rounded-sm bg-surface-card hover:bg-surface-muted active:bg-surface-app border border-border-default font-mono tabular-nums text-base font-bold text-text-main transition-colors select-none"
            >
              {key === "DEL" ? "⌫" : key}
            </button>
          ))}
        </div>

        {/* Calculation Preview Result */}
        <div className="p-2.5 rounded-sm bg-surface-muted border border-border-subtle flex justify-between items-center text-xs">
          <span className="text-text-sub">
            Thành tiền ({item.soldQty} {item.soldUom || item.baseUom}):
          </span>
          <span className="font-mono tabular-nums font-bold text-sm text-brand">
            {formatVND(currentPrice * item.soldQty)}
          </span>
        </div>
      </div>
    </Modal>
  );
};
