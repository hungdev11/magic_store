"use client";

import React from "react";
import { Plus, X, ShoppingBag } from "lucide-react";
import { formatVND } from "@/lib/design-tokens";

export interface PosOrderTab {
  id: string;
  orderNumber?: string;
  title?: string;
  itemCount: number;
  totalAmount?: number;
  customerName?: string;
}

export interface PosTabsBarProps {
  orders: PosOrderTab[];
  activeOrderId: string;
  onSelectOrder: (orderId: string) => void;
  onAddOrder: () => void;
  onCloseOrder: (orderId: string) => void;
  maxOrders?: number;
  className?: string;
}

// ponytail: tab switcher supports up to maxOrders concurrent pending carts; upgrade to persistent drafted order storage if app backgrounded.
export const PosTabsBar: React.FC<PosTabsBarProps> = ({
  orders,
  activeOrderId,
  onSelectOrder,
  onAddOrder,
  onCloseOrder,
  maxOrders = 10,
  className = "",
}) => {
  const displayOrders =
    orders.length > 0
      ? orders
      : [{ id: "order-1", title: "Đơn 1", itemCount: 0, totalAmount: 0 }];

  return (
    <div
      className={`h-10 bg-surface-muted/60 border-b border-border-subtle flex items-center px-2 gap-1 overflow-x-auto scrollbar-none select-none shrink-0 ${className}`}
    >
      <div className="flex items-center gap-1 min-w-0">
        {displayOrders.map((order, index) => {
          const isActive = order.id === activeOrderId;
          const label = order.title || order.orderNumber || `Đơn ${index + 1}`;

          return (
            <div
              key={order.id}
              onClick={() => onSelectOrder(order.id)}
              className={`group flex items-center gap-1.5 h-8 px-2.5 rounded-t-sm border-t border-l border-r text-xs cursor-pointer transition-colors ${
                isActive
                  ? "bg-surface-card border-border-default text-text-main font-semibold shadow-xs"
                  : "bg-surface-muted/30 border-transparent text-text-sub hover:bg-surface-card/60 hover:text-text-main"
              }`}
            >
              <ShoppingBag
                className={`w-3.5 h-3.5 shrink-0 ${
                  isActive ? "text-brand" : "text-text-disabled"
                }`}
              />

              <span className="truncate max-w-[100px]">{label}</span>

              {order.itemCount > 0 && (
                <span className="px-1 py-[1px] rounded-sm bg-surface-muted text-text-sub font-mono text-[10px] font-medium tabular-nums">
                  {order.itemCount}
                </span>
              )}

              {order.totalAmount && order.totalAmount > 0 ? (
                <span className="hidden sm:inline font-mono text-[10px] text-brand font-medium tabular-nums">
                  {formatVND(order.totalAmount)}
                </span>
              ) : null}

              {displayOrders.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseOrder(order.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-0.5 ml-0.5 rounded-sm hover:bg-outflow/10 text-text-sub hover:text-outflow transition-all"
                  title="Đóng đơn hàng này"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {displayOrders.length < maxOrders && (
        <button
          type="button"
          onClick={onAddOrder}
          className="h-7 w-7 flex items-center justify-center rounded-sm bg-surface-card border border-border-subtle hover:border-border-default text-text-sub hover:text-brand hover:bg-surface-card transition-colors shrink-0"
          title="Thêm đơn hàng mới (+)"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
