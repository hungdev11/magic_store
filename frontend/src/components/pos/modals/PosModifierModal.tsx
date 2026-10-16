"use client";

import React, { useState, useEffect, useMemo } from "react";
import { type Product, type ProductVariant } from "@/lib/api";
import { type PosModifier } from "@/lib/pos-store";
import { formatVND } from "@/lib/design-tokens";
import { Modal, Button } from "@/components/common";
import { Utensils, Check } from "lucide-react";

export interface PosModifierModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product;
  variant?: ProductVariant | null;
  availableModifiers?: PosModifier[];
  onConfirm: (modifiers: PosModifier[]) => void;
}

export const DEFAULT_POS_TOPPINGS: PosModifier[] = [
  { name: "Thêm Trứng Ốp La", price: 10000 },
  { name: "Thêm Pate Gan", price: 5000 },
  { name: "Thêm Chả Lụa", price: 8000 },
  { name: "Thêm Phô Mai Lát", price: 7000 },
  { name: "Thêm Xúc Xích Nướng", price: 10000 },
  { name: "Thêm Rau / Dưa Chua", price: 3000 },
];

const SUGAR_LEVELS = ["100%", "70%", "50%", "30%", "0%"];
const ICE_LEVELS = ["100%", "50%", "0%"];

// ponytail: F&B modifiers combine sugar/ice radios and topping checklist; upgrade to hierarchical modifier groups if combo step-selection needed.
export const PosModifierModal: React.FC<PosModifierModalProps> = ({
  isOpen,
  onClose,
  product,
  variant,
  availableModifiers = DEFAULT_POS_TOPPINGS,
  onConfirm,
}) => {
  const [selectedSugar, setSelectedSugar] = useState<string>("100%");
  const [selectedIce, setSelectedIce] = useState<string>("100%");
  const [selectedToppings, setSelectedToppings] = useState<PosModifier[]>([]);

  useEffect(() => {
    if (isOpen) {
      setSelectedSugar("100%");
      setSelectedIce("100%");
      setSelectedToppings([]);
    }
  }, [isOpen]);

  const toggleTopping = (mod: PosModifier) => {
    setSelectedToppings((prev) => {
      const exists = prev.some((m) => m.name === mod.name);
      if (exists) {
        return prev.filter((m) => m.name !== mod.name);
      }
      return [...prev, mod];
    });
  };

  const toppingsTotal = useMemo(() => {
    return selectedToppings.reduce((acc, m) => acc + (Number(m.price) || 0), 0);
  }, [selectedToppings]);

  const basePrice = Number(variant?.base_selling_price) || 0;
  const combinedTotal = basePrice + toppingsTotal;

  const handleConfirm = () => {
    const finalModifiers: PosModifier[] = [];

    // Include sugar level if specified
    if (selectedSugar) {
      finalModifiers.push({
        name: `Đường: ${selectedSugar}`,
        price: 0,
      });
    }

    // Include ice level if specified
    if (selectedIce) {
      finalModifiers.push({
        name: `Đá: ${selectedIce}`,
        price: 0,
      });
    }

    // Append toppings
    finalModifiers.push(...selectedToppings);

    onConfirm(finalModifiers);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      title={
        <div className="flex items-center gap-2">
          <Utensils className="w-5 h-5 text-brand" />
          <span>Tùy Chọn & Topping F&B</span>
        </div>
      }
      description={`Món chính: ${product.name} - ${formatVND(basePrice)}`}
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="text-xs">
            <span className="text-text-sub">Tổng tiền món: </span>
            <strong className="font-mono tabular-nums text-brand text-sm">
              {formatVND(combinedTotal)}
            </strong>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="md" onClick={onClose}>
              Hủy
            </Button>
            <Button variant="primary" size="md" onClick={handleConfirm}>
              Thêm vào giỏ
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Sugar Selection Option */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-text-sub uppercase tracking-wider">
            Mức đường:
          </label>
          <div className="grid grid-cols-5 gap-1.5">
            {SUGAR_LEVELS.map((level) => {
              const isSelected = selectedSugar === level;
              return (
                <button
                  key={level}
                  type="button"
                  onClick={() => setSelectedSugar(level)}
                  className={`py-1.5 px-2 rounded-sm text-xs font-semibold font-mono tabular-nums border text-center transition-colors ${
                    isSelected
                      ? "bg-brand text-white border-brand shadow-sm"
                      : "bg-surface-card text-text-main border-border-default hover:bg-surface-muted"
                  }`}
                >
                  {level}
                </button>
              );
            })}
          </div>
        </div>

        {/* Ice Selection Option */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-text-sub uppercase tracking-wider">
            Mức đá:
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {ICE_LEVELS.map((level) => {
              const isSelected = selectedIce === level;
              return (
                <button
                  key={level}
                  type="button"
                  onClick={() => setSelectedIce(level)}
                  className={`py-1.5 px-2 rounded-sm text-xs font-semibold font-mono tabular-nums border text-center transition-colors ${
                    isSelected
                      ? "bg-brand text-white border-brand shadow-sm"
                      : "bg-surface-card text-text-main border-border-default hover:bg-surface-muted"
                  }`}
                >
                  {level === "0%" ? "0% (Không đá)" : level}
                </button>
              );
            })}
          </div>
        </div>

        {/* Topping Checklist */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-text-sub uppercase tracking-wider">
              Danh sách Topping thêm:
            </span>
            <span className="text-text-sub font-mono tabular-nums">
              Đã chọn: {selectedToppings.length}
            </span>
          </div>

          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-0.5">
            {availableModifiers.map((mod) => {
              const isChecked = selectedToppings.some((m) => m.name === mod.name);
              return (
                <label
                  key={mod.name}
                  className={`flex items-center justify-between p-2.5 rounded-sm border cursor-pointer transition-colors focus-within:ring-2 focus-within:ring-brand/40 ${
                    isChecked
                      ? "bg-brand/5 border-brand"
                      : "bg-surface-card border-border-default hover:bg-surface-muted"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleTopping(mod)}
                      className="sr-only"
                    />
                    <div
                      aria-hidden="true"
                      className={`w-4 h-4 rounded-sm border flex items-center justify-center transition-colors ${
                        isChecked
                          ? "bg-brand border-brand text-white"
                          : "border-border-default bg-surface-card"
                      }`}
                    >
                      {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                    <span className="text-xs font-medium text-text-main">{mod.name}</span>
                  </div>

                  <span className="font-mono tabular-nums font-bold text-xs text-brand">
                    +{formatVND(mod.price)}
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Calculation Summary Box */}
        <div className="p-3 rounded-sm bg-surface-muted border border-border-subtle space-y-1 text-xs">
          <div className="flex justify-between text-text-sub">
            <span>Món chính:</span>
            <span className="font-mono tabular-nums">{formatVND(basePrice)}</span>
          </div>
          <div className="flex justify-between text-text-sub">
            <span>Topping phụ thu ({selectedToppings.length}):</span>
            <span className="font-mono tabular-nums">+{formatVND(toppingsTotal)}</span>
          </div>
          <div className="flex justify-between font-bold text-text-main pt-1 border-t border-border-subtle">
            <span>Tổng cộng:</span>
            <span className="font-mono tabular-nums text-brand">{formatVND(combinedTotal)}</span>
          </div>
        </div>
      </div>
    </Modal>
  );
};
