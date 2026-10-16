"use client";

import React, { useState, useEffect } from "react";
import { type Product, type ProductVariant } from "@/lib/api";
import { formatVND, formatQty } from "@/lib/design-tokens";
import { Modal, Button, Input } from "@/components/common";
import { Scale, RefreshCw, AlertTriangle } from "lucide-react";

export interface PosWeighModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product;
  variant: ProductVariant;
  onConfirm: (weight: number, unitPrice: number) => void;
}

const PRESET_WEIGHTS = [0.25, 0.5, 1.0, 1.5, 2.0, 5.0];
const KEYPAD_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "DEL"];

// ponytail: serial COM scale read simulated via mock buffer; upgrade to navigator.serial Web Serial API stream when hardware scale plugged.
export const PosWeighModal: React.FC<PosWeighModalProps> = ({
  isOpen,
  onClose,
  product,
  variant,
  onConfirm,
}) => {
  const [weightInput, setWeightInput] = useState<string>("1.000");
  const [unitPrice, setUnitPrice] = useState<number>(Number(variant.base_selling_price) || 0);
  const [isReadingSerial, setIsReadingSerial] = useState(false);
  const [serialStatus, setSerialStatus] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setWeightInput("1.000");
      setUnitPrice(Number(variant.base_selling_price) || 0);
      setSerialStatus(null);
    }
  }, [isOpen, variant]);

  const handleKeypadPress = (val: string) => {
    if (val === "DEL") {
      setWeightInput((prev) => (prev.length > 1 ? prev.slice(0, -1) : "0"));
    } else if (val === ".") {
      if (!weightInput.includes(".")) {
        setWeightInput((prev) => prev + ".");
      }
    } else {
      setWeightInput((prev) => {
        if (prev === "0" || prev === "1.000") return val;
        return prev + val;
      });
    }
  };

  const handleSimulateSerialScale = () => {
    setIsReadingSerial(true);
    setSerialStatus("Đang đọc cổng Serial/COM...");
    setTimeout(() => {
      // Generate stable simulated scale reading between 0.350 and 3.500 kg
      const simulatedWeight = (Math.floor(Math.random() * 320 + 35) / 100).toFixed(3);
      setWeightInput(simulatedWeight);
      setIsReadingSerial(false);
      setSerialStatus(`COM1: Đã nhận ${simulatedWeight} ${product.base_uom || "kg"}`);
    }, 450);
  };

  const parsedWeight = parseFloat(weightInput) || 0;
  const totalPrice = parsedWeight * unitPrice;
  const minPrice = Number(variant.min_selling_price) || 0;
  const isBelowMinPrice = minPrice > 0 && unitPrice < minPrice;

  const handleConfirm = () => {
    const finalWeight = parsedWeight > 0 ? parsedWeight : 1;
    onConfirm(finalWeight, unitPrice);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      title={
        <div className="flex items-center gap-2">
          <Scale className="w-5 h-5 text-brand" />
          <span>Cân Điện Tử & Tính Giá</span>
        </div>
      }
      description={`Mã: ${variant.sku} | ĐVT gốc: ${product.base_uom}`}
      footer={
        <div className="flex items-center justify-end gap-2 w-full">
          <Button variant="secondary" size="md" onClick={onClose}>
            Hủy
          </Button>
          <Button variant="primary" size="md" onClick={handleConfirm} disabled={parsedWeight <= 0}>
            Thêm vào giỏ
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Product Details Header */}
        <div>
          <h4 className="font-bold text-text-main text-base truncate">{product.name}</h4>
          {variant.variant_name && (
            <p className="text-xs text-text-sub mt-0.5">{variant.variant_name}</p>
          )}
        </div>

        {/* Digital Scale Readout Display */}
        <div className="p-4 rounded-md bg-slate-900 border border-border-default text-white flex flex-col items-center justify-center relative">
          <div className="w-full flex items-center justify-between mb-1">
            <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">
              Khối lượng thực tế
            </span>
            <button
              type="button"
              onClick={handleSimulateSerialScale}
              disabled={isReadingSerial}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 border border-slate-700 font-mono transition-colors disabled:opacity-50"
              title="Lấy số cân tự động qua cổng Serial / COM"
            >
              <RefreshCw className={`w-3 h-3 ${isReadingSerial ? "animate-spin" : ""}`} />
              <span>Đọc cân COM</span>
            </button>
          </div>

          <div className="flex items-baseline gap-2 font-mono tabular-nums my-1">
            <span className="text-4xl font-extrabold tracking-tight">
              {weightInput || "0"}
            </span>
            <span className="text-xl text-slate-400 font-medium">
              {product.base_uom || "kg"}
            </span>
          </div>

          {serialStatus && (
            <span className="text-[11px] font-mono text-emerald-300 mt-1">
              {serialStatus}
            </span>
          )}
        </div>

        {/* Unit Price Input & Floor Price Validation */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <label htmlFor="weigh-unit-price" className="font-semibold text-text-main">
              Đơn giá bán / {product.base_uom}:
            </label>
            {minPrice > 0 && (
              <span className="text-text-sub font-mono tabular-nums">
                Giá sàn: {formatVND(minPrice)}
              </span>
            )}
          </div>
          <Input
            id="weigh-unit-price"
            type="number"
            min="0"
            step="1000"
            value={unitPrice || ""}
            onChange={(e) => setUnitPrice(parseFloat(e.target.value) || 0)}
            className="font-mono tabular-nums font-bold text-right"
          />
          {isBelowMinPrice && (
            <div className="p-2 rounded-sm bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-1.5 font-medium">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>Cảnh báo: Đơn giá dưới giá sàn tối thiểu ({formatVND(minPrice)})!</span>
            </div>
          )}
        </div>

        {/* Quick Weight Preset Buttons */}
        <div className="space-y-1">
          <span className="text-xs text-text-sub font-medium">Khối lượng nhanh:</span>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {PRESET_WEIGHTS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setWeightInput(preset.toString())}
                className="px-2.5 py-1 rounded-sm bg-surface-muted hover:bg-surface-app border border-border-subtle text-xs font-semibold font-mono tabular-nums text-text-main whitespace-nowrap transition-colors"
              >
                {preset} {product.base_uom || "kg"}
              </button>
            ))}
          </div>
        </div>

        {/* Touch Keypad */}
        <div className="grid grid-cols-3 gap-1.5">
          {KEYPAD_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => handleKeypadPress(key)}
              className="py-2.5 rounded-sm bg-surface-card hover:bg-surface-muted active:bg-surface-app border border-border-default font-mono tabular-nums text-base font-bold text-text-main transition-colors select-none"
            >
              {key === "DEL" ? "⌫" : key}
            </button>
          ))}
        </div>

        {/* Calculation Summary Row */}
        <div className="p-3 rounded-sm bg-surface-muted border border-border-subtle flex justify-between items-center">
          <span className="text-xs font-bold text-text-sub uppercase tracking-wider">
            Thành tiền tạm tính:
          </span>
          <span className="text-lg font-bold font-mono tabular-nums text-brand">
            {formatVND(totalPrice)}
          </span>
        </div>
      </div>
    </Modal>
  );
};
