import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  api,
  type PosCheckoutPayload,
  type PosCheckoutResponse,
  type Product,
  type ProductVariant,
  type Partner,
} from "./api";

export interface PosModifier {
  name: string;
  price: number;
  linked_variant_id?: string;
  deduct_qty?: number;
}

export interface PosCartItem {
  id: string;
  variantId: string;
  productName: string;
  variantName: string;
  sku: string;
  baseUom: string;
  soldUom: string;
  conversionFactor: number;
  isWeighable: boolean;
  isVariableRatio: boolean;
  soldQty: number;
  actualBaseQty: number;
  originalUnitPrice: number;
  actualUnitPrice: number;
  minSellingPrice: number;
  isReturn: boolean;
  modifiers: PosModifier[];
  lineTotal: number;
  isPriceOverridden?: boolean;
  isBelowMinPrice?: boolean;
}

export interface OfflineOrder {
  id: string;
  createdAt: string;
  payload: PosCheckoutPayload;
  status: "PENDING" | "SYNCED" | "FAILED";
  retryCount: number;
  errorMessage?: string;
}

export interface AddItemOptions {
  soldQty?: number;
  actualBaseQty?: number;
  soldUom?: string;
  conversionFactor?: number;
  actualUnitPrice?: number;
  isReturn?: boolean;
  modifiers?: PosModifier[];
  isVariableRatio?: boolean;
}

export interface PosState {
  cart: PosCartItem[];
  selectedCustomer: Partner | null;
  discountAmount: number;
  surchargeAmount: number;
  paidAmount: number;
  paymentMethod: "CASH" | "BANK_QR" | "MIXED" | "CREDIT";
  offlineQueue: OfflineOrder[];
  isOnline: boolean;

  // Computed Totals
  getSubtotal: () => number;
  getTotalAmount: () => number;
  getDebtAmount: () => number;
  getChangeAmount: () => number;

  // Cart Actions
  addItem: (variant: ProductVariant, product: Product, options?: AddItemOptions) => void;
  updateItemQty: (id: string, soldQty: number, actualBaseQty?: number) => void;
  updateItemPrice: (id: string, newUnitPrice: number) => { success: boolean; belowMinPrice: boolean };
  toggleItemReturn: (id: string) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;

  // Checkout State Setters
  setCustomer: (customer: Partner | null) => void;
  setDiscount: (amount: number) => void;
  setSurcharge: (amount: number) => void;
  setPaidAmount: (amount: number) => void;
  setPaymentMethod: (method: "CASH" | "BANK_QR" | "MIXED" | "CREDIT") => void;
  setOnlineStatus: (status: boolean) => void;

  // POS Checkout & Offline Queue Operations
  checkout: (notes?: string) => Promise<PosCheckoutResponse>;
  syncOfflineQueue: () => Promise<number>;
  removeOfflineOrder: (id: string) => void;
  clearOfflineQueue: () => void;
}

export function calculateLineTotal(
  actualUnitPrice: number,
  soldQty: number,
  actualBaseQty: number,
  modifiers: PosModifier[] = [],
  isReturn: boolean = false,
  isWeighable: boolean = false
): number {
  const modTotalPerUnit = modifiers.reduce((acc, m) => acc + (Number(m.price) || 0), 0);
  let baseAmount: number;

  // ponytail: catch-weight prices by weighed kg if weighable, else by piece/soldQty.
  if (isWeighable && actualBaseQty > 0) {
    baseAmount = actualUnitPrice * actualBaseQty + modTotalPerUnit * soldQty;
  } else if (actualBaseQty > 0 && actualBaseQty !== soldQty) {
    baseAmount = actualUnitPrice * actualBaseQty + modTotalPerUnit * soldQty;
  } else {
    baseAmount = (actualUnitPrice + modTotalPerUnit) * soldQty;
  }

  const rounded = Math.round(baseAmount * 100) / 100;
  return isReturn ? -Math.abs(rounded) : Math.abs(rounded);
}

// ponytail: local memory fallback storage for SSR hydration safety; upgrade to IndexedDB when offline cart exceeds 5MB.
export const usePosStore = create<PosState>()(
  persist(
    (set, get) => ({
      cart: [],
      selectedCustomer: null,
      discountAmount: 0,
      surchargeAmount: 0,
      paidAmount: 0,
      paymentMethod: "CASH",
      offlineQueue: [],
      isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,

      getSubtotal: () => {
        return get().cart.reduce((sum, item) => sum + item.lineTotal, 0);
      },

      getTotalAmount: () => {
        const { cart, discountAmount, surchargeAmount } = get();
        const subtotal = cart.reduce((sum, item) => sum + item.lineTotal, 0);
        return Math.max(0, subtotal - discountAmount + surchargeAmount);
      },

      getDebtAmount: () => {
        const { cart, discountAmount, surchargeAmount, paidAmount, paymentMethod } = get();
        const subtotal = cart.reduce((sum, item) => sum + item.lineTotal, 0);
        const total = Math.max(0, subtotal - discountAmount + surchargeAmount);
        if (paymentMethod === "CREDIT") return total;
        return Math.max(0, total - paidAmount);
      },

      getChangeAmount: () => {
        const { cart, discountAmount, surchargeAmount, paidAmount, paymentMethod } = get();
        if (paymentMethod === "CREDIT") return 0;
        const subtotal = cart.reduce((sum, item) => sum + item.lineTotal, 0);
        const total = Math.max(0, subtotal - discountAmount + surchargeAmount);
        return Math.max(0, paidAmount - total);
      },

      addItem: (variant, product, options) => {
        const soldQty = options?.soldQty ?? 1;
        const soldUom = options?.soldUom || product.base_uom || "Cái";
        const conversionFactor = options?.conversionFactor ?? 1;
        const isWeighable = Boolean(product.is_weighable);
        const isVariableRatio = Boolean(options?.isVariableRatio ?? false);
        const originalUnitPrice = Number(variant.base_selling_price) || 0;
        const actualUnitPrice = options?.actualUnitPrice ?? originalUnitPrice;
        const minSellingPrice = Number(variant.min_selling_price) || 0;
        const isReturn = options?.isReturn ?? false;
        const modifiers = options?.modifiers ?? [];

        let actualBaseQty = options?.actualBaseQty;
        if (actualBaseQty === undefined) {
          actualBaseQty = isWeighable ? soldQty : soldQty * conversionFactor;
        }

        const isBelowMin = !isReturn && minSellingPrice > 0 && actualUnitPrice < minSellingPrice;
        const isPriceOverridden = actualUnitPrice !== originalUnitPrice;

        set(state => {
          // Merge identical standard rows if not weighable, not return, and no modifiers
          const canMerge =
            !isWeighable &&
            !isReturn &&
            modifiers.length === 0 &&
            !isPriceOverridden;

          const existingIndex = canMerge
            ? state.cart.findIndex(
                it =>
                  it.variantId === variant.id &&
                  it.soldUom === soldUom &&
                  !it.isReturn &&
                  it.modifiers.length === 0 &&
                  it.actualUnitPrice === actualUnitPrice
              )
            : -1;

          if (existingIndex > -1) {
            const nextCart = [...state.cart];
            const existing = nextCart[existingIndex];
            const nextQty = existing.soldQty + soldQty;
            const nextBaseQty = nextQty * conversionFactor;
            const nextLineTotal = calculateLineTotal(
              existing.actualUnitPrice,
              nextQty,
              nextBaseQty,
              existing.modifiers,
              existing.isReturn,
              existing.isWeighable
            );

            nextCart[existingIndex] = {
              ...existing,
              soldQty: nextQty,
              actualBaseQty: nextBaseQty,
              lineTotal: nextLineTotal,
            };
            return { cart: nextCart };
          }

          const newItem: PosCartItem = {
            id: `cart-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
            variantId: variant.id,
            productName: product.name,
            variantName: variant.variant_name || product.name,
            sku: variant.sku || "",
            baseUom: product.base_uom || "Cái",
            soldUom,
            conversionFactor,
            isWeighable,
            isVariableRatio,
            soldQty,
            actualBaseQty,
            originalUnitPrice,
            actualUnitPrice,
            minSellingPrice,
            isReturn,
            modifiers,
            lineTotal: calculateLineTotal(
              actualUnitPrice,
              soldQty,
              actualBaseQty,
              modifiers,
              isReturn,
              isWeighable
            ),
            isPriceOverridden,
            isBelowMinPrice: isBelowMin,
          };

          return { cart: [...state.cart, newItem] };
        });
      },

      updateItemQty: (id, soldQty, actualBaseQty) => {
        if (soldQty <= 0) {
          get().removeItem(id);
          return;
        }

        set(state => ({
          cart: state.cart.map(item => {
            if (item.id !== id) return item;

            let resolvedBaseQty = actualBaseQty;
            if (resolvedBaseQty === undefined) {
              if (item.isWeighable) {
                resolvedBaseQty = item.soldQty > 0 ? (item.actualBaseQty / item.soldQty) * soldQty : soldQty;
              } else {
                resolvedBaseQty = soldQty * item.conversionFactor;
              }
            }

            const lineTotal = calculateLineTotal(
              item.actualUnitPrice,
              soldQty,
              resolvedBaseQty,
              item.modifiers,
              item.isReturn,
              item.isWeighable
            );

            return {
              ...item,
              soldQty,
              actualBaseQty: resolvedBaseQty,
              lineTotal,
            };
          }),
        }));
      },

      updateItemPrice: (id, newUnitPrice) => {
        let isBelowMin = false;

        set(state => ({
          cart: state.cart.map(item => {
            if (item.id !== id) return item;

            const minPrice = item.minSellingPrice || 0;
            if (!item.isReturn && minPrice > 0 && newUnitPrice < minPrice) {
              isBelowMin = true;
            }

            const actualUnitPrice = newUnitPrice;
            const isPriceOverridden = actualUnitPrice !== item.originalUnitPrice;
            const lineTotal = calculateLineTotal(
              actualUnitPrice,
              item.soldQty,
              item.actualBaseQty,
              item.modifiers,
              item.isReturn,
              item.isWeighable
            );

            return {
              ...item,
              actualUnitPrice,
              isPriceOverridden,
              isBelowMinPrice: isBelowMin,
              lineTotal,
            };
          }),
        }));

        return { success: !isBelowMin, belowMinPrice: isBelowMin };
      },

      toggleItemReturn: id => {
        set(state => ({
          cart: state.cart.map(item => {
            if (item.id !== id) return item;

            const nextReturn = !item.isReturn;
            const isBelowMin = !nextReturn && item.minSellingPrice > 0 && item.actualUnitPrice < item.minSellingPrice;
            const lineTotal = calculateLineTotal(
              item.actualUnitPrice,
              item.soldQty,
              item.actualBaseQty,
              item.modifiers,
              nextReturn,
              item.isWeighable
            );

            return {
              ...item,
              isReturn: nextReturn,
              isBelowMinPrice: isBelowMin,
              lineTotal,
            };
          }),
        }));
      },

      removeItem: id => {
        set(state => ({
          cart: state.cart.filter(item => item.id !== id),
        }));
      },

      clearCart: () => {
        set({
          cart: [],
          selectedCustomer: null,
          discountAmount: 0,
          surchargeAmount: 0,
          paidAmount: 0,
          paymentMethod: "CASH",
        });
      },

      setCustomer: customer => set({ selectedCustomer: customer }),
      setDiscount: amount => set({ discountAmount: Math.max(0, amount) }),
      setSurcharge: amount => set({ surchargeAmount: Math.max(0, amount) }),
      setPaidAmount: amount => set({ paidAmount: Math.max(0, amount) }),
      setPaymentMethod: method => set({ paymentMethod: method }),
      setOnlineStatus: status => set({ isOnline: status }),

      checkout: async notes => {
        const {
          cart,
          selectedCustomer,
          discountAmount,
          surchargeAmount,
          paidAmount,
          paymentMethod,
          isOnline,
        } = get();

        if (cart.length === 0) {
          throw new Error("Giỏ hàng đang trống");
        }

        const subtotal = cart.reduce((sum, item) => sum + item.lineTotal, 0);
        const totalAmount = Math.max(0, subtotal - discountAmount + surchargeAmount);

        let effectivePaid = paidAmount;
        let effectiveDebt = 0;

        if (paymentMethod === "CREDIT") {
          effectivePaid = 0;
          effectiveDebt = totalAmount;
        } else if (paidAmount > 0) {
          effectivePaid = paidAmount;
          effectiveDebt = Math.max(0, totalAmount - paidAmount);
        } else {
          effectivePaid = totalAmount;
          effectiveDebt = 0;
        }

        const payload: PosCheckoutPayload = {
          customer_id: selectedCustomer?.id,
          items: cart.map(item => ({
            variant_id: item.variantId,
            sold_uom: item.soldUom,
            sold_qty: item.soldQty,
            actual_base_qty_deducted: item.actualBaseQty,
            original_unit_price: item.originalUnitPrice,
            actual_unit_price: item.actualUnitPrice,
            line_total: item.lineTotal,
            is_return: item.isReturn,
            modifiers: item.modifiers.length > 0 ? item.modifiers : undefined,
          })),
          subtotal,
          discount_amount: discountAmount,
          surcharge_amount: surchargeAmount,
          total_amount: totalAmount,
          paid_amount: effectivePaid,
          debt_amount: effectiveDebt,
          payment_method: paymentMethod,
          notes,
        };

        const createOfflineFallback = (errorMsg?: string): PosCheckoutResponse => {
          const offlineId = `OFFLINE-${Date.now()}`;
          const offlineOrder: OfflineOrder = {
            id: offlineId,
            createdAt: new Date().toISOString(),
            payload,
            status: "PENDING",
            retryCount: 0,
            errorMessage: errorMsg,
          };

          set(state => ({
            offlineQueue: [...state.offlineQueue, offlineOrder],
          }));

          get().clearCart();

          return {
            id: offlineId,
            order_number: offlineId,
            customer_id: payload.customer_id,
            customer: selectedCustomer || undefined,
            status: "PENDING",
            subtotal: payload.subtotal,
            discount_amount: payload.discount_amount,
            surcharge_amount: payload.surcharge_amount,
            total_amount: payload.total_amount,
            paid_amount: payload.paid_amount,
            debt_amount: payload.debt_amount,
            payment_method: payload.payment_method,
            items: payload.items.map((it, idx) => ({
              id: `${offlineId}-${idx}`,
              order_id: offlineId,
              variant_id: it.variant_id,
              sold_uom: it.sold_uom,
              sold_qty: it.sold_qty,
              actual_base_qty_deducted: it.actual_base_qty_deducted,
              original_unit_price: it.original_unit_price,
              actual_unit_price: it.actual_unit_price,
              line_total: it.line_total,
              is_return: it.is_return,
            })),
            created_at: offlineOrder.createdAt,
            offline: true,
          };
        };

        if (isOnline) {
          try {
            const res = await api.checkoutOrder(payload);
            get().clearCart();
            return res;
          } catch (err: any) {
            console.warn("Online checkout failed, saving to offline queue:", err);
            return createOfflineFallback(err?.message || "Checkout failed");
          }
        }

        return createOfflineFallback("Offline mode active");
      },

      syncOfflineQueue: async () => {
        const { offlineQueue } = get();
        const pending = offlineQueue.filter(o => o.status === "PENDING");
        if (pending.length === 0) return 0;

        let syncedCount = 0;
        const nextQueue: OfflineOrder[] = [];

        for (const order of offlineQueue) {
          if (order.status !== "PENDING") {
            nextQueue.push(order);
            continue;
          }

          try {
            await api.checkoutOrder(order.payload);
            syncedCount++;
          } catch (err: any) {
            nextQueue.push({
              ...order,
              retryCount: order.retryCount + 1,
              errorMessage: err?.message || "Đồng bộ thất bại",
              status: order.retryCount >= 4 ? "FAILED" : "PENDING",
            });
          }
        }

        set({ offlineQueue: nextQueue });
        return syncedCount;
      },

      removeOfflineOrder: id => {
        set(state => ({
          offlineQueue: state.offlineQueue.filter(o => o.id !== id),
        }));
      },

      clearOfflineQueue: () => {
        set({ offlineQueue: [] });
      },
    }),
    {
      name: "magic_store_pos_store",
      storage: createJSONStorage(() => {
        if (typeof window !== "undefined") {
          return window.localStorage;
        }
        return {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
        };
      }),
      partialize: state => ({
        cart: state.cart,
        offlineQueue: state.offlineQueue,
        selectedCustomer: state.selectedCustomer,
        discountAmount: state.discountAmount,
        surchargeAmount: state.surchargeAmount,
        paidAmount: state.paidAmount,
        paymentMethod: state.paymentMethod,
      }),
    }
  )
);

// ponytail: zero-framework self-check verifying catch-weight, return negation and modifiers calculation.
export function _selfCheckPosStore(): boolean {
  return (
    calculateLineTotal(100000, 2, 2) === 200000 &&
    calculateLineTotal(100000, 2, 2, [], true) === -200000 &&
    calculateLineTotal(160000, 1, 1.35, [], false, true) === 216000 &&
    calculateLineTotal(25000, 2, 2, [{ name: "Trứng", price: 5000 }], false) === 60000
  );
}
