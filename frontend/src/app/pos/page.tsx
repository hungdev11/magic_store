"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  usePosStore,
  type PosCartItem,
  type PosModifier,
} from "@/lib/pos-store";
import { useStoreProfile } from "@/lib/store";
import {
  api,
  type Product,
  type ProductVariant,
  type Category,
  type Partner,
} from "@/lib/api";
import { formatVND } from "@/lib/design-tokens";
import { CheckCircle2, RefreshCw } from "lucide-react";
import {
  PosHeader,
  PosTabsBar,
  PosCartTable,
  PosProductGrid,
  PosCheckoutPanel,
  PosWeighModal,
  PosMatrixModal,
  PosModifierModal,
  PosCustomerModal,
  PosPriceModal,
  type MatrixSelectionItem,
} from "@/components/pos";
import { Modal } from "@/components/common";

function parseAttributes(raw?: Record<string, string> | string): Record<string, string> {
  if (!raw) return {};
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

// ponytail: thin orchestrator coordinating modular POS sub-components; upgrade to service-worker background sync if PWA installability required.
export default function PosPage() {
  const { storeSetting, fetchSettings } = useStoreProfile();
  const {
    cart,
    selectedCustomer,
    discountAmount,
    paidAmount,
    paymentMethod,
    offlineQueue,
    isOnline,
    getSubtotal,
    getTotalAmount,
    getDebtAmount,
    getChangeAmount,
    addItem,
    updateItemQty,
    updateItemPrice,
    toggleItemReturn,
    removeItem,
    clearCart,
    setCustomer,
    setDiscount,
    setPaidAmount,
    setPaymentMethod,
    setOnlineStatus,
    checkout,
    syncOfflineQueue,
  } = usePosStore();

  // Master Data State
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [customers, setCustomers] = useState<Partner[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("ALL");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Modals State
  const [activeWeighModal, setActiveWeighModal] = useState<{
    product: Product;
    variant: ProductVariant;
  } | null>(null);

  const [activeMatrixModal, setActiveMatrixModal] = useState<Product | null>(null);

  const [activeModifierModal, setActiveModifierModal] = useState<{
    product: Product;
    variant: ProductVariant;
  } | null>(null);

  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [activePriceModal, setActivePriceModal] = useState<PosCartItem | null>(null);

  const [checkoutSuccess, setCheckoutSuccess] = useState<{
    orderId: string;
    totalAmount: number;
    paymentMethod: string;
    customerName: string;
    debtAmount: number;
    changeAmount: number;
    isOffline: boolean;
  } | null>(null);

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  // Multi-order Tabs State
  const [activeOrderId, setActiveOrderId] = useState<string>("order-1");

  // Initial Data Fetch
  useEffect(() => {
    fetchSettings();

    async function loadMasterData() {
      setIsLoadingData(true);
      try {
        const [prodsData, catsData, custsData] = await Promise.all([
          api.getProducts().catch(() => []),
          api.getCategories().catch(() => []),
          api.getPartners("CUSTOMER").catch(() => []),
        ]);
        setProducts(prodsData || []);
        setCategories(catsData || []);
        setCustomers(custsData || []);
      } catch (err) {
        console.error("Failed to load POS master data", err);
      } finally {
        setIsLoadingData(false);
      }
    }

    loadMasterData();
  }, [fetchSettings]);

  // Online / Offline Status Monitoring
  useEffect(() => {
    const handleOnline = () => setOnlineStatus(true);
    const handleOffline = () => setOnlineStatus(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    setOnlineStatus(typeof navigator !== "undefined" ? navigator.onLine : true);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [setOnlineStatus]);

  // Focus search input on initial mount
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // Product Inspection Helpers
  const isWeighableProduct = useCallback((p: Product) => {
    return (
      p.is_weighable ||
      p.variants?.some((v) =>
        v.uom_conversions?.some((c) => c.is_variable_ratio)
      ) ||
      false
    );
  }, []);

  const isMatrixProduct = useCallback((p: Product) => {
    if (!p.variants) return false;
    if (p.variants.length > 1) return true;
    const firstAttrs = p.variants[0]?.attributes;
    return Boolean(firstAttrs && Object.keys(parseAttributes(firstAttrs)).length > 0);
  }, []);

  const isModifierProduct = useCallback((p: Product) => {
    return (
      p.production_mode === "POS_BACKFLUSH" ||
      p.production_mode === "ASSEMBLY" ||
      p.product_type === "COMBO" ||
      Boolean((p as any).modifier_groups && (p as any).modifier_groups.length > 0)
    );
  }, []);

  // Card Click Interaction
  const handleProductCardClick = useCallback((product: Product) => {
    const primaryVariant = product.variants?.[0];
    if (!primaryVariant) return;

    if (isMatrixProduct(product)) {
      setActiveMatrixModal(product);
    } else if (isWeighableProduct(product)) {
      setActiveWeighModal({ product, variant: primaryVariant });
    } else if (isModifierProduct(product)) {
      setActiveModifierModal({ product, variant: primaryVariant });
    } else {
      // Standard Product: 1-touch immediate add
      addItem(primaryVariant, product);
    }
  }, [addItem, isMatrixProduct, isWeighableProduct, isModifierProduct]);

  // Checkout Execution
  const handleTriggerCheckout = useCallback(async () => {
    if (cart.length === 0) return;
    setCheckoutError(null);

    const debt = getDebtAmount();
    if (debt > 0 && !selectedCustomer) {
      setCheckoutError("Vui lòng chọn khách hàng để ghi nợ công nợ.");
      setIsCustomerModalOpen(true);
      return;
    }

    setIsCheckingOut(true);
    try {
      const res = await checkout("Đơn bán hàng POS siêu tốc");
      setCheckoutSuccess({
        orderId: res.order_number || res.id || "POS-OFFLINE",
        totalAmount: getTotalAmount(),
        paymentMethod,
        customerName: selectedCustomer?.name || "Khách lẻ (Vãng lai)",
        debtAmount: getDebtAmount(),
        changeAmount: getChangeAmount(),
        isOffline: Boolean(res.offline),
      });
    } catch (err: any) {
      setCheckoutError(err.message || "Lỗi xử lý thanh toán");
    } finally {
      setIsCheckingOut(false);
    }
  }, [
    cart.length,
    getDebtAmount,
    selectedCustomer,
    checkout,
    getTotalAmount,
    paymentMethod,
    getChangeAmount,
  ]);

  // Sync Offline Queue
  const handleSyncOfflineQueue = useCallback(async () => {
    if (isSyncing || offlineQueue.length === 0) return;
    setIsSyncing(true);
    setSyncMessage(null);
    try {
      const syncedCount = await syncOfflineQueue();
      setSyncMessage(`Đã đồng bộ thành công ${syncedCount} đơn hàng ngoại tuyến.`);
      setTimeout(() => setSyncMessage(null), 4000);
    } catch (err: any) {
      setSyncMessage(err?.message || "Đồng bộ thất bại. Vui lòng thử lại.");
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, offlineQueue.length, syncOfflineQueue]);

  // Keyboard Shortcuts Handler: F2, F4, F8, F9, Esc
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      } else if (e.key === "F4") {
        e.preventDefault();
        setIsCustomerModalOpen((prev) => !prev);
      } else if (e.key === "F8") {
        e.preventDefault();
        if (cart.length > 0 && !isCheckingOut) {
          handleTriggerCheckout();
        }
      } else if (e.key === "F9") {
        e.preventDefault();
        if (cart.length > 0) {
          const lastItem = cart[cart.length - 1];
          toggleItemReturn(lastItem.id);
        }
      } else if (e.key === "Escape") {
        if (activeWeighModal) setActiveWeighModal(null);
        else if (activeMatrixModal) setActiveMatrixModal(null);
        else if (activeModifierModal) setActiveModifierModal(null);
        else if (isCustomerModalOpen) setIsCustomerModalOpen(false);
        else if (activePriceModal) setActivePriceModal(null);
        else if (checkoutSuccess) setCheckoutSuccess(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    cart,
    isCheckingOut,
    activeWeighModal,
    activeMatrixModal,
    activeModifierModal,
    isCustomerModalOpen,
    activePriceModal,
    checkoutSuccess,
    toggleItemReturn,
    handleTriggerCheckout,
  ]);

  // Barcode / Search Enter Action
  const handleSearchSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim().toLowerCase();
    if (!query) return;

    // Check exact SKU or Barcode match first
    for (const p of products) {
      if (!p.variants) continue;
      for (const v of p.variants) {
        if (
          v.sku.toLowerCase() === query ||
          (v.barcode && v.barcode.toLowerCase() === query)
        ) {
          if (isWeighableProduct(p)) {
            setActiveWeighModal({ product: p, variant: v });
          } else if (isModifierProduct(p)) {
            setActiveModifierModal({ product: p, variant: v });
          } else {
            addItem(v, p);
          }
          setSearchQuery("");
          return;
        }
      }
    }

    // Check product code match
    for (const p of products) {
      if (p.code.toLowerCase() === query) {
        handleProductCardClick(p);
        setSearchQuery("");
        return;
      }
    }

    // Filter match single item
    const matches = products.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.code.toLowerCase().includes(query)
    );
    if (matches.length === 1) {
      handleProductCardClick(matches[0]);
      setSearchQuery("");
    }
  }, [searchQuery, products, isWeighableProduct, isModifierProduct, addItem, handleProductCardClick]);

  // Catch-weight Modal Confirm
  const handleWeighConfirm = (weight: number, unitPrice: number) => {
    if (!activeWeighModal) return;
    const { product, variant } = activeWeighModal;
    addItem(variant, product, {
      actualBaseQty: weight,
      soldQty: weight,
      actualUnitPrice: unitPrice,
    });
    setActiveWeighModal(null);
  };

  // Matrix Modal Confirm
  const handleMatrixConfirm = (selections: MatrixSelectionItem[]) => {
    if (!activeMatrixModal) return;
    selections.forEach(({ variant, qty }) => {
      addItem(variant, activeMatrixModal, { soldQty: qty });
    });
    setActiveMatrixModal(null);
  };

  const handleMatrixSelectSingle = (variant: ProductVariant) => {
    if (!activeMatrixModal) return;
    if (isWeighableProduct(activeMatrixModal)) {
      setActiveMatrixModal(null);
      setActiveWeighModal({ product: activeMatrixModal, variant });
    } else if (isModifierProduct(activeMatrixModal)) {
      setActiveMatrixModal(null);
      setActiveModifierModal({ product: activeMatrixModal, variant });
    } else {
      addItem(variant, activeMatrixModal);
      setActiveMatrixModal(null);
    }
  };

  // Modifier Modal Confirm
  const handleModifierConfirm = (modifiers: PosModifier[]) => {
    if (!activeModifierModal) return;
    const { product, variant } = activeModifierModal;
    addItem(variant, product, {
      soldQty: 1,
      modifiers,
    });
    setActiveModifierModal(null);
  };

  // Price Modal Confirm
  const handlePriceConfirm = (newPrice: number) => {
    if (!activePriceModal) return;
    updateItemPrice(activePriceModal.id, newPrice);
    setActivePriceModal(null);
  };

  const orderTabs = useMemo(() => [
    {
      id: "order-1",
      title: "Đơn 1",
      itemCount: cart.length,
      totalAmount: getTotalAmount(),
      customerName: selectedCustomer?.name,
    },
  ], [cart.length, getTotalAmount, selectedCustomer?.name]);

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-surface-app select-none">
      {/* 1. Header Bar */}
      <PosHeader
        storeName={storeSetting?.name || "Magic Store"}
        cashierName="Thu ngân"
        isOnline={isOnline}
        offlineCount={offlineQueue.length}
        isSyncing={isSyncing}
        syncMessage={syncMessage}
        onSyncOffline={handleSyncOfflineQueue}
      />

      {/* 2. Order Tabs Bar */}
      <PosTabsBar
        orders={orderTabs}
        activeOrderId={activeOrderId}
        onSelectOrder={setActiveOrderId}
        onAddOrder={() => {}}
        onCloseOrder={() => {}}
      />

      {/* 3. Main Two-Column Viewport */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
        {/* LEFT COLUMN (~60%): PRODUCT SEARCH & TOUCH GRID */}
        <section className="w-full lg:w-[60%] flex flex-col min-w-0 border-r border-border-subtle bg-surface-app h-full">
          <PosProductGrid
            products={products}
            categories={categories}
            selectedCategoryId={selectedCategoryId}
            onSelectCategory={setSelectedCategoryId}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onSearchSubmit={handleSearchSubmit}
            onProductClick={handleProductCardClick}
            isLoading={isLoadingData}
            searchInputRef={searchInputRef}
          />
        </section>

        {/* RIGHT COLUMN (~40%): CART TABLE & CHECKOUT PANEL */}
        <section className="w-full lg:w-[40%] flex flex-col min-w-0 bg-surface-card h-full">
          <PosCartTable
            items={cart}
            onUpdateQty={updateItemQty}
            onOpenPriceModal={(item) => setActivePriceModal(item)}
            onToggleReturn={toggleItemReturn}
            onRemoveItem={removeItem}
            onClearCart={clearCart}
          />

          <PosCheckoutPanel
            selectedCustomer={selectedCustomer}
            onOpenCustomerModal={() => setIsCustomerModalOpen(true)}
            subtotal={getSubtotal()}
            discountAmount={discountAmount}
            onDiscountChange={setDiscount}
            totalAmount={getTotalAmount()}
            paymentMethod={paymentMethod as any}
            onPaymentMethodChange={(m) => setPaymentMethod(m as any)}
            paidAmount={paidAmount}
            onPaidAmountChange={setPaidAmount}
            changeAmount={getChangeAmount()}
            debtAmount={getDebtAmount()}
            onCheckout={handleTriggerCheckout}
            isCheckingOut={isCheckingOut}
            checkoutError={checkoutError}
            disabled={cart.length === 0}
            shortcutLabel="F8"
          />
        </section>
      </div>

      {/* ===================== MODALS ===================== */}

      {/* Modal 1: Catch-Weight */}
      {activeWeighModal && (
        <PosWeighModal
          isOpen={Boolean(activeWeighModal)}
          onClose={() => setActiveWeighModal(null)}
          product={activeWeighModal.product}
          variant={activeWeighModal.variant}
          onConfirm={handleWeighConfirm}
        />
      )}

      {/* Modal 2: Matrix Variant Selector (Attribute Rows) */}
      {activeMatrixModal && (
        <PosMatrixModal
          isOpen={Boolean(activeMatrixModal)}
          onClose={() => setActiveMatrixModal(null)}
          product={activeMatrixModal}
          onConfirm={handleMatrixConfirm}
          onSelectSingle={handleMatrixSelectSingle}
        />
      )}

      {/* Modal 3: Modifiers & Toppings */}
      {activeModifierModal && (
        <PosModifierModal
          isOpen={Boolean(activeModifierModal)}
          onClose={() => setActiveModifierModal(null)}
          product={activeModifierModal.product}
          variant={activeModifierModal.variant}
          onConfirm={handleModifierConfirm}
        />
      )}

      {/* Modal 4: Customer Picker */}
      <PosCustomerModal
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        customers={customers}
        selectedCustomer={selectedCustomer}
        onSelectCustomer={(cust) => setCustomer(cust)}
        onCustomerCreated={(newCust) => {
          setCustomers((prev) => [newCust, ...prev]);
          setCustomer(newCust);
        }}
      />

      {/* Modal 5: Price Override */}
      {activePriceModal && (
        <PosPriceModal
          isOpen={Boolean(activePriceModal)}
          onClose={() => setActivePriceModal(null)}
          item={activePriceModal}
          onConfirm={handlePriceConfirm}
        />
      )}

      {/* Modal 6: Checkout Success Receipt */}
      {checkoutSuccess && (
        <Modal
          isOpen={Boolean(checkoutSuccess)}
          onClose={() => {
            setCheckoutSuccess(null);
            searchInputRef.current?.focus();
          }}
          size="sm"
        >
          <div className="text-center p-4 space-y-4">
            <div className="w-12 h-12 rounded-sm bg-inflow/10 text-inflow flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7 text-emerald-600" />
            </div>

            <div>
              <h3 className="font-bold text-lg text-text-main">
                Thanh Toán Hoàn Tất!
              </h3>
              <p className="text-xs text-text-sub mt-1">
                {checkoutSuccess.isOffline
                  ? "Đơn đã lưu ngoại tuyến vào hàng đợi và sẽ tự động đồng bộ khi có kết nối."
                  : "Giao dịch đã được ghi nhận vào Sổ kho, Sổ quỹ và Công nợ."}
              </p>
            </div>

            <div className="p-3 rounded-sm bg-surface-muted/50 border border-border-default text-left space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-text-sub">Mã đơn hàng:</span>
                <span className="font-mono tabular-nums font-bold text-text-main">
                  {checkoutSuccess.orderId}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-sub">Khách hàng:</span>
                <span className="font-semibold text-text-main">
                  {checkoutSuccess.customerName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-sub">Phương thức:</span>
                <span className="font-medium text-text-main">
                  {checkoutSuccess.paymentMethod}
                </span>
              </div>
              <div className="flex justify-between pt-1.5 border-t border-border-subtle font-bold text-sm">
                <span>Tổng tiền:</span>
                <span className="font-mono tabular-nums text-brand font-bold">
                  {formatVND(checkoutSuccess.totalAmount)}
                </span>
              </div>
              {checkoutSuccess.changeAmount > 0 && (
                <div className="flex justify-between text-inflow font-semibold">
                  <span>Tiền thối lại:</span>
                  <span className="font-mono tabular-nums font-bold">
                    {formatVND(checkoutSuccess.changeAmount)}
                  </span>
                </div>
              )}
              {checkoutSuccess.debtAmount > 0 && (
                <div className="flex justify-between text-alert font-semibold">
                  <span>Ghi nợ:</span>
                  <span className="font-mono tabular-nums font-bold">
                    {formatVND(checkoutSuccess.debtAmount)}
                  </span>
                </div>
              )}
            </div>

            <button
              type="button"
              autoFocus
              onClick={() => {
                setCheckoutSuccess(null);
                searchInputRef.current?.focus();
              }}
              className="w-full py-2.5 rounded-sm bg-brand hover:bg-brand-hover text-white font-bold text-sm transition-colors shadow-sm"
            >
              Đơn hàng mới (Tiếp tục bán) [Esc]
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
