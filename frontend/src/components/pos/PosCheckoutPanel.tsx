"use client";

import React, { useState } from "react";
import {
  User,
  CreditCard,
  QrCode,
  Banknote,
  Split,
  AlertTriangle,
  RefreshCw,
  Check,
  Calculator,
} from "lucide-react";
import { type Partner } from "@/lib/api";
import { formatVND } from "@/lib/design-tokens";
import { Badge } from "@/components/common";

export type PosPaymentMethod = "CASH" | "BANK_QR" | "MIXED" | "CREDIT";

export interface PosCheckoutPanelProps {
  selectedCustomer: Partner | null;
  onOpenCustomerModal: () => void;
  subtotal: number;
  discountAmount: number;
  onDiscountChange: (amount: number) => void;
  surchargeAmount?: number;
  onSurchargeChange?: (amount: number) => void;
  vatRate?: number;
  totalAmount: number;
  paymentMethod: PosPaymentMethod;
  onPaymentMethodChange: (method: PosPaymentMethod) => void;
  paidAmount: number;
  onPaidAmountChange: (amount: number) => void;
  changeAmount: number;
  debtAmount: number;
  onCheckout: () => void;
  isCheckingOut: boolean;
  checkoutError?: string | null;
  disabled?: boolean;
  shortcutLabel?: string;
  className?: string;
}

const QUICK_CASH_AMOUNTS = [50000, 100000, 200000, 500000];

// ponytail: integrated touch numpad and quick bill chips; upgrade to multi-tender split payment modal if combining cash and bank transfer.
export const PosCheckoutPanel: React.FC<PosCheckoutPanelProps> = ({
  selectedCustomer,
  onOpenCustomerModal,
  subtotal,
  discountAmount,
  onDiscountChange,
  surchargeAmount = 0,
  onSurchargeChange,
  vatRate = 0,
  totalAmount,
  paymentMethod,
  onPaymentMethodChange,
  paidAmount,
  onPaidAmountChange,
  changeAmount,
  debtAmount,
  onCheckout,
  isCheckingOut,
  checkoutError,
  disabled = false,
  shortcutLabel = "F8",
  className = "",
}) => {
  const [showNumpad, setShowNumpad] = useState(false);

  const handleNumpadPress = (digit: string) => {
    const current = paidAmount.toString();
    if (digit === "CLEAR") {
      onPaidAmountChange(0);
    } else if (digit === "BACKSPACE") {
      const next = current.slice(0, -1);
      onPaidAmountChange(next ? parseFloat(next) || 0 : 0);
    } else if (digit === "000") {
      const next = paidAmount === 0 ? "0" : `${paidAmount}000`;
      onPaidAmountChange(parseFloat(next) || 0);
    } else {
      const next = paidAmount === 0 ? digit : `${paidAmount}${digit}`;
      onPaidAmountChange(parseFloat(next) || 0);
    }
  };

  const vatAmount = vatRate > 0 ? Math.round(subtotal * (vatRate / 100)) : 0;

  return (
    <div
      className={`bg-surface-card border-t border-border-subtle p-3 space-y-2.5 shrink-0 select-none ${className}`}
    >
      {/* 1. Customer Selector Row */}
      <button
        type="button"
        onClick={onOpenCustomerModal}
        className="w-full flex items-center justify-between px-2.5 py-2 rounded-sm bg-surface-app border border-border-default hover:border-brand transition-colors text-left text-xs"
        title="Chọn khách hàng [F4]"
      >
        <div className="flex items-center gap-2 min-w-0">
          <User className="w-4 h-4 text-brand shrink-0" />
          <div className="truncate">
            {selectedCustomer ? (
              <div className="flex items-center gap-1.5 truncate">
                <span className="font-semibold text-text-main truncate">
                  {selectedCustomer.name}
                </span>
                {selectedCustomer.phone && (
                  <span className="text-text-sub font-mono text-[11px]">
                    ({selectedCustomer.phone})
                  </span>
                )}
              </div>
            ) : (
              <span className="text-text-sub font-medium">
                Khách lẻ (Vãng lai) [F4]
              </span>
            )}
          </div>
        </div>

        {selectedCustomer && (
          <Badge variant="alert" className="shrink-0 text-[10px]">
            Nợ: {formatVND(selectedCustomer.current_debt_balance ?? selectedCustomer.current_debt ?? 0)}
          </Badge>
        )}
      </button>

      {/* 2. Bill Summary Calculations */}
      <div className="space-y-1 text-xs text-text-sub pt-1 border-t border-border-subtle">
        {/* Subtotal */}
        <div className="flex justify-between items-center">
          <span>Tiền hàng (Tạm tính):</span>
          <span className="font-mono font-semibold text-text-main tabular-nums">
            {formatVND(subtotal)}
          </span>
        </div>

        {/* Discount Input */}
        <div className="flex justify-between items-center">
          <span>Chiết khấu đơn:</span>
          <div className="flex items-center gap-1">
            <input
              type="number"
              min="0"
              step="1000"
              value={discountAmount || ""}
              onChange={(e) => onDiscountChange(Math.max(0, parseFloat(e.target.value) || 0))}
              placeholder="0"
              className="w-24 h-6 text-right px-2 font-mono text-xs bg-surface-app border border-border-default rounded-sm focus:outline-none focus:border-border-focus font-medium tabular-nums"
            />
            <span className="text-[11px] font-mono text-text-sub">₫</span>
          </div>
        </div>

        {/* Surcharge / Tip if used */}
        {onSurchargeChange && (
          <div className="flex justify-between items-center">
            <span>Phụ thu / Tip:</span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min="0"
                step="1000"
                value={surchargeAmount || ""}
                onChange={(e) => onSurchargeChange(Math.max(0, parseFloat(e.target.value) || 0))}
                placeholder="0"
                className="w-24 h-6 text-right px-2 font-mono text-xs bg-surface-app border border-border-default rounded-sm focus:outline-none focus:border-border-focus font-medium tabular-nums"
              />
              <span className="text-[11px] font-mono text-text-sub">₫</span>
            </div>
          </div>
        )}

        {/* VAT if rate > 0 */}
        {vatRate > 0 && (
          <div className="flex justify-between items-center">
            <span>Thuế VAT ({vatRate}%):</span>
            <span className="font-mono font-medium text-text-main tabular-nums">
              +{formatVND(vatAmount)}
            </span>
          </div>
        )}

        {/* Final Amount Due */}
        <div className="flex justify-between items-baseline pt-1.5 border-t border-border-subtle">
          <span className="font-bold text-xs sm:text-sm text-text-main uppercase tracking-tight">
            Khách phải trả:
          </span>
          <span className="font-extrabold font-mono text-lg sm:text-xl text-brand tabular-nums">
            {formatVND(totalAmount)}
          </span>
        </div>
      </div>

      {/* 3. Payment Method Grid */}
      <div className="grid grid-cols-4 gap-1 text-xs font-semibold">
        <button
          type="button"
          onClick={() => onPaymentMethodChange("CASH")}
          className={`h-8 px-1 rounded-sm border text-center transition-colors flex items-center justify-center gap-1 ${
            paymentMethod === "CASH"
              ? "bg-brand text-white border-brand shadow-xs"
              : "bg-surface-app text-text-sub border-border-subtle hover:bg-surface-muted"
          }`}
        >
          <Banknote className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">Tiền mặt</span>
        </button>

        <button
          type="button"
          onClick={() => onPaymentMethodChange("BANK_QR")}
          className={`h-8 px-1 rounded-sm border text-center transition-colors flex items-center justify-center gap-1 ${
            paymentMethod === "BANK_QR"
              ? "bg-brand text-white border-brand shadow-xs"
              : "bg-surface-app text-text-sub border-border-subtle hover:bg-surface-muted"
          }`}
        >
          <QrCode className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">VietQR</span>
        </button>

        <button
          type="button"
          onClick={() => onPaymentMethodChange("CREDIT")}
          className={`h-8 px-1 rounded-sm border text-center transition-colors flex items-center justify-center gap-1 ${
            paymentMethod === "CREDIT"
              ? "bg-brand text-white border-brand shadow-xs"
              : "bg-surface-app text-text-sub border-border-subtle hover:bg-surface-muted"
          }`}
        >
          <CreditCard className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">Ghi nợ</span>
        </button>

        <button
          type="button"
          onClick={() => onPaymentMethodChange("MIXED")}
          className={`h-8 px-1 rounded-sm border text-center transition-colors flex items-center justify-center gap-1 ${
            paymentMethod === "MIXED"
              ? "bg-brand text-white border-brand shadow-xs"
              : "bg-surface-app text-text-sub border-border-subtle hover:bg-surface-muted"
          }`}
        >
          <Split className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">Hỗn hợp</span>
        </button>
      </div>

      {/* 4. Customer Paid & Quick Chips */}
      {paymentMethod !== "CREDIT" && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-sub whitespace-nowrap">Tiền khách đưa:</span>
            <input
              type="number"
              min="0"
              step="1000"
              value={paidAmount || ""}
              onChange={(e) => onPaidAmountChange(parseFloat(e.target.value) || 0)}
              placeholder={totalAmount.toString()}
              className="flex-1 h-8 text-right px-2.5 text-sm bg-surface-app border border-border-default rounded-sm font-mono font-bold text-text-main focus:outline-none focus:border-border-focus tabular-nums"
            />
            <span className="text-xs text-text-sub font-mono">₫</span>

            <button
              type="button"
              onClick={() => setShowNumpad(!showNumpad)}
              className={`p-1.5 rounded-sm border text-xs transition-colors ${
                showNumpad
                  ? "bg-brand text-white border-brand"
                  : "bg-surface-app text-text-sub border-border-subtle hover:bg-surface-muted"
              }`}
              title="Mở phím số cảm ứng"
            >
              <Calculator className="w-4 h-4" />
            </button>
          </div>

          {/* Touch Numpad (Collapsible) */}
          {showNumpad && (
            <div className="grid grid-cols-4 gap-1 p-2 bg-surface-app rounded-sm border border-border-subtle text-xs font-bold font-mono">
              {["7", "8", "9", "CLEAR"].map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleNumpadPress(key)}
                  className={`h-8 rounded-sm border border-border-subtle flex items-center justify-center ${
                    key === "CLEAR"
                      ? "bg-outflow/10 text-outflow hover:bg-outflow/20"
                      : "bg-surface-card hover:bg-surface-muted text-text-main"
                  }`}
                >
                  {key === "CLEAR" ? "C" : key}
                </button>
              ))}
              {["4", "5", "6", "000"].map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleNumpadPress(key)}
                  className="h-8 rounded-sm border border-border-subtle bg-surface-card hover:bg-surface-muted text-text-main flex items-center justify-center"
                >
                  {key}
                </button>
              ))}
              {["1", "2", "3", "BACKSPACE"].map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleNumpadPress(key)}
                  className={`h-8 rounded-sm border border-border-subtle flex items-center justify-center ${
                    key === "BACKSPACE"
                      ? "bg-alert/10 text-alert hover:bg-alert/20 font-sans"
                      : "bg-surface-card hover:bg-surface-muted text-text-main"
                  }`}
                >
                  {key === "BACKSPACE" ? "⌫" : key}
                </button>
              ))}
              <button
                type="button"
                onClick={() => handleNumpadPress("0")}
                className="col-span-2 h-8 rounded-sm border border-border-subtle bg-surface-card hover:bg-surface-muted text-text-main flex items-center justify-center"
              >
                0
              </button>
              <button
                type="button"
                onClick={() => onPaidAmountChange(totalAmount)}
                className="col-span-2 h-8 rounded-sm border border-brand bg-brand/10 text-brand hover:bg-brand/20 font-sans text-xs flex items-center justify-center"
              >
                Đúng giá
              </button>
            </div>
          )}

          {/* Quick Cash Chips */}
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none pb-0.5">
            <button
              type="button"
              onClick={() => onPaidAmountChange(totalAmount)}
              className="px-2 py-0.5 text-[11px] rounded-sm bg-surface-app hover:bg-surface-muted border border-border-subtle font-semibold whitespace-nowrap text-text-sub hover:text-text-main"
            >
              Đúng giá
            </button>
            {QUICK_CASH_AMOUNTS.map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => onPaidAmountChange(amt)}
                className="px-2 py-0.5 text-[11px] rounded-sm bg-surface-app hover:bg-surface-muted border border-border-subtle font-semibold font-mono whitespace-nowrap text-text-sub hover:text-text-main tabular-nums"
              >
                {amt / 1000}k
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 5. Change or Debt Output Box */}
      <div className="flex justify-between items-center text-xs font-semibold py-1.5 px-2.5 rounded-sm bg-surface-muted/60 border border-border-subtle">
        {changeAmount > 0 ? (
          <>
            <span className="text-inflow">Tiền thối lại khách:</span>
            <span className="font-mono text-inflow font-bold text-sm tabular-nums">
              {formatVND(changeAmount)}
            </span>
          </>
        ) : debtAmount > 0 ? (
          <>
            <span className="text-alert">Ghi nợ đơn hàng:</span>
            <span className="font-mono text-alert font-bold text-sm tabular-nums">
              {formatVND(debtAmount)}
            </span>
          </>
        ) : (
          <>
            <span className="text-text-sub">Trạng thái thanh toán:</span>
            <span className="text-inflow font-semibold">Đã đủ</span>
          </>
        )}
      </div>

      {/* 6. Checkout Error Message */}
      {checkoutError && (
        <div className="p-2 rounded-sm bg-outflow/10 border border-outflow/30 text-xs text-outflow font-medium flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>{checkoutError}</span>
        </div>
      )}

      {/* 7. Big Checkout Button */}
      <button
        type="button"
        disabled={disabled || isCheckingOut}
        onClick={onCheckout}
        className="w-full h-11 px-4 rounded-sm bg-brand hover:bg-brand-hover text-white font-bold text-sm sm:text-base shadow-xs disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 active:scale-[0.99]"
      >
        {isCheckingOut ? (
          <>
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span>Đang xử lý đơn hàng...</span>
          </>
        ) : (
          <>
            <Check className="w-4 h-4" />
            <span>THANH TOÁN ({shortcutLabel})</span>
          </>
        )}
      </button>
    </div>
  );
};
