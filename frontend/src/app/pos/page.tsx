"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Link from "next/link";
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
import { formatVND, formatQty } from "@/lib/design-tokens";
import {
  ShoppingCart,
  Search,
  Scale,
  Layers,
  Utensils,
  Check,
  X,
  Plus,
  Minus,
  Trash2,
  RefreshCw,
  CloudOff,
  ArrowLeft,
  User,
  CreditCard,
  QrCode,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  Barcode,
  DollarSign,
  ChevronRight,
} from "lucide-react";

// Standard preset toppings for F&B items
const DEFAULT_TOPPINGS: PosModifier[] = [
  { name: "Thêm Trứng Ốp La", price: 10000 },
  { name: "Thêm Pate Gan", price: 5000 },
  { name: "Thêm Chả Lụa", price: 8000 },
  { name: "Thêm Phô Mai Lát", price: 7000 },
  { name: "Thêm Xúc Xích Nướng", price: 10000 },
  { name: "Thêm Rau / Dưa Chua", price: 3000 },
];

function parseAttributes(raw?: Record<string, string> | string): Record<string, string> {
  if (!raw) return {};
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function getVariantStock(v?: ProductVariant): number {
  if (!v) return 0;
  const val = v.current_stock ?? v.current_inventory ?? 0;
  return Number(val) || 0;
}

function getProductTotalStock(p: Product): number {
  if (!p.variants || p.variants.length === 0) return 0;
  return p.variants.reduce((acc, v) => acc + getVariantStock(v), 0);
}

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
  const [weighInput, setWeighInput] = useState<string>("1.000");
  const [weighUnitPrice, setWeighUnitPrice] = useState<number>(0);

  const [activeMatrixModal, setActiveMatrixModal] = useState<Product | null>(null);
  const [selectedAttributes, setSelectedAttributes] = useState<Record<string, string>>({});

  const [activeModifierModal, setActiveModifierModal] = useState<{
    product: Product;
    variant: ProductVariant;
  } | null>(null);
  const [selectedModifiers, setSelectedModifiers] = useState<PosModifier[]>([]);

  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");

  const [activePriceModal, setActivePriceModal] = useState<PosCartItem | null>(null);
  const [priceInput, setPriceInput] = useState<number>(0);
  const [priceWarning, setPriceWarning] = useState<string | null>(null);

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

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // Category filter
      if (selectedCategoryId !== "ALL" && p.category_id !== selectedCategoryId) {
        return false;
      }
      // Search filter
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const matchName = p.name.toLowerCase().includes(q);
      const matchCode = p.code.toLowerCase().includes(q);
      const matchVariant = p.variants?.some(
        (v) =>
          v.sku.toLowerCase().includes(q) ||
          (v.barcode && v.barcode.toLowerCase().includes(q)) ||
          (v.variant_name && v.variant_name.toLowerCase().includes(q))
      );
      return matchName || matchCode || matchVariant;
    });
  }, [products, selectedCategoryId, searchQuery]);

  // Filtered Customers
  const filteredCustomers = useMemo(() => {
    if (!customerSearchQuery.trim()) return customers;
    const q = customerSearchQuery.toLowerCase().trim();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.toLowerCase().includes(q))
    );
  }, [customers, customerSearchQuery]);

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
  const handleProductCardClick = (product: Product) => {
    const primaryVariant = product.variants?.[0];
    if (!primaryVariant) return;

    if (isMatrixProduct(product)) {
      // Initialize selected attributes with first variant's attributes
      const firstAttrs = parseAttributes(primaryVariant.attributes);
      setSelectedAttributes(firstAttrs);
      setActiveMatrixModal(product);
    } else if (isWeighableProduct(product)) {
      setWeighInput("1.000");
      setWeighUnitPrice(Number(primaryVariant.base_selling_price) || 0);
      setActiveWeighModal({ product, variant: primaryVariant });
    } else if (isModifierProduct(product)) {
      setSelectedModifiers([]);
      setActiveModifierModal({ product, variant: primaryVariant });
    } else {
      // Standard Product: 1-touch immediate add
      addItem(primaryVariant, product);
    }
  };

  // Barcode / Search Enter Action
  const handleSearchSubmit = (e: React.FormEvent) => {
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
            setWeighInput("1.000");
            setWeighUnitPrice(Number(v.base_selling_price) || 0);
            setActiveWeighModal({ product: p, variant: v });
          } else if (isModifierProduct(p)) {
            setSelectedModifiers([]);
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

    // If only 1 product matches search query, select it
    if (filteredProducts.length === 1) {
      handleProductCardClick(filteredProducts[0]);
      setSearchQuery("");
    }
  };

  // Catch-Weight Keypad Handlers
  const handleKeypadPress = (val: string) => {
    if (val === "C") {
      setWeighInput("0");
    } else if (val === "DEL") {
      setWeighInput((prev) => (prev.length > 1 ? prev.slice(0, -1) : "0"));
    } else if (val === ".") {
      if (!weighInput.includes(".")) {
        setWeighInput((prev) => prev + ".");
      }
    } else {
      // digits 0-9
      setWeighInput((prev) => {
        if (prev === "0" || prev === "1.000") return val;
        return prev + val;
      });
    }
  };

  const handleAddCatchWeightToCart = () => {
    if (!activeWeighModal) return;
    const weight = parseFloat(weighInput) || 1;
    const { product, variant } = activeWeighModal;

    addItem(variant, product, {
      soldQty: 1,
      actualBaseQty: weight,
      actualUnitPrice: weighUnitPrice,
      isVariableRatio: true,
    });

    setActiveWeighModal(null);
  };

  // Modifier Modal Add To Cart
  const handleAddModifierToCart = () => {
    if (!activeModifierModal) return;
    const { product, variant } = activeModifierModal;

    addItem(variant, product, {
      soldQty: 1,
      modifiers: selectedModifiers,
    });

    setActiveModifierModal(null);
  };

  // Sync Offline Queue
  const handleSyncOfflineQueue = async () => {
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
  };

  // Checkout Execution
  async function handleTriggerCheckout() {
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
  };

  // Price Override Submit
  const handlePriceOverrideSubmit = () => {
    if (!activePriceModal) return;
    const res = updateItemPrice(activePriceModal.id, priceInput);
    if (res.belowMinPrice) {
      setPriceWarning(
        `Đơn giá này dưới giá sàn tối thiểu (${formatVND(activePriceModal.minSellingPrice)})!`
      );
    } else {
      setActivePriceModal(null);
      setPriceWarning(null);
    }
  };

  // Quick cash chips
  const handleQuickCash = (amount: number) => {
    setPaidAmount(amount);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-surface-app h-screen w-screen overflow-hidden select-none">
      {/* 1. POS Top Header Bar */}
      <header className="h-14 bg-surface-card border-b border-border-subtle px-4 flex items-center justify-between shrink-0 shadow-sm">
        {/* Left: Brand, Store Name & Cashier Badge */}
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-text-sub hover:text-text-main font-medium px-2.5 py-1.5 rounded-lg border border-border-subtle bg-surface-app hover:bg-surface-card-hover transition-colors"
            title="Trở về Trang Tổng Quan ERP"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Trở về ERP</span>
          </Link>
          <div className="h-4 w-px bg-border-subtle" />
          <div className="flex items-center gap-2">
            <span className="font-bold text-text-main text-sm truncate max-w-[160px] sm:max-w-[240px]">
              {storeSetting?.name || "Magic Store"}
            </span>
            <span className="px-2 py-0.5 rounded text-[11px] bg-emerald-50 text-emerald-800 font-semibold border border-emerald-200">
              Thu ngân
            </span>
          </div>
        </div>

        {/* Center: Keyboard Shortcuts Legend */}
        <div className="hidden lg:flex items-center gap-3 text-xs text-text-sub bg-surface-app px-3 py-1 rounded-full border border-border-subtle">
          <div className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-surface-card rounded border border-border-subtle font-mono text-[10px] font-bold text-text-main">
              F2
            </kbd>
            <span>Tìm kiếm</span>
          </div>
          <span className="text-border-default">•</span>
          <div className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-surface-card rounded border border-border-subtle font-mono text-[10px] font-bold text-text-main">
              F4
            </kbd>
            <span>Khách hàng</span>
          </div>
          <span className="text-border-default">•</span>
          <div className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-surface-card rounded border border-border-subtle font-mono text-[10px] font-bold text-text-main">
              F8
            </kbd>
            <span>Thanh toán</span>
          </div>
          <span className="text-border-default">•</span>
          <div className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-surface-card rounded border border-border-subtle font-mono text-[10px] font-bold text-text-main">
              F9
            </kbd>
            <span>Đổi trả</span>
          </div>
        </div>

        {/* Right: Network Status & Offline Queue Sync */}
        <div className="flex items-center gap-3">
          {syncMessage && (
            <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md animate-fade-in hidden md:inline">
              {syncMessage}
            </span>
          )}

          {/* Offline Queue Badge */}
          {offlineQueue.length > 0 && (
            <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-300 text-amber-900 px-2.5 py-1 rounded-lg text-xs font-medium">
              <CloudOff className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>{offlineQueue.length} đơn offline</span>
              <button
                onClick={handleSyncOfflineQueue}
                disabled={isSyncing || !isOnline}
                className="ml-1 px-2 py-0.5 bg-amber-600 hover:bg-amber-700 text-white rounded text-[11px] font-bold disabled:opacity-50 transition-colors flex items-center gap-1"
              >
                {isSyncing && <RefreshCw className="w-2.5 h-2.5 animate-spin" />}
                <span>{isSyncing ? "Sync..." : "Sync ngay"}</span>
              </button>
            </div>
          )}

          {/* Network Connection Badge */}
          {isOnline ? (
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>Online</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 bg-amber-100 border border-amber-300 px-2.5 py-1 rounded-full">
              <span className="h-2 w-2 rounded-full bg-amber-500"></span>
              <span>Offline</span>
            </div>
          )}
        </div>
      </header>

      {/* 2. Main Two-Column POS Layout */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
        {/* ===================== LEFT COLUMN (~60%): PRODUCT SEARCH & TOUCH GRID ===================== */}
        <section className="w-full lg:w-[60%] flex flex-col min-w-0 border-r border-border-subtle bg-surface-app h-full">
          {/* Top Bar: Barcode / Search Input & Category Filter Tabs */}
          <div className="p-3 bg-surface-card border-b border-border-subtle space-y-2.5 shrink-0">
            {/* Search Input with Scanner Autofocus */}
            <form onSubmit={handleSearchSubmit} className="relative flex items-center">
              <div className="absolute left-3 text-text-sub pointer-events-none flex items-center gap-1.5">
                <Search className="w-4 h-4" />
                <Barcode className="w-4 h-4 text-brand" />
              </div>
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Quét mã vạch Barcode hoặc gõ tên, SKU sản phẩm... [F2]"
                className="w-full pl-16 pr-10 py-2.5 text-sm bg-surface-app border border-border-default rounded-lg focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent font-medium"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    searchInputRef.current?.focus();
                  }}
                  className="absolute right-3 text-text-sub hover:text-text-main"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </form>

            {/* Category Filter Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
              <button
                type="button"
                onClick={() => setSelectedCategoryId("ALL")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  selectedCategoryId === "ALL"
                    ? "bg-brand text-white shadow-sm"
                    : "bg-surface-app text-text-sub hover:bg-surface-card-hover hover:text-text-main border border-border-subtle"
                }`}
              >
                Tất cả ({products.length})
              </button>
              {categories.map((cat) => {
                const count = products.filter((p) => p.category_id === cat.id).length;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategoryId(cat.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                      selectedCategoryId === cat.id
                        ? "bg-brand text-white shadow-sm"
                        : "bg-surface-app text-text-sub hover:bg-surface-card-hover hover:text-text-main border border-border-subtle"
                    }`}
                  >
                    {cat.name} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {/* Product Touch Grid */}
          <div className="flex-1 overflow-y-auto p-3">
            {isLoadingData ? (
              <div className="h-full flex flex-col items-center justify-center text-text-sub gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-brand" />
                <span className="text-sm">Đang tải danh mục hàng hóa...</span>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-text-sub gap-2 py-12">
                <Search className="w-10 h-10 stroke-1 text-text-disabled" />
                <span className="text-sm">Không tìm thấy sản phẩm phù hợp.</span>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5">
                {filteredProducts.map((product) => {
                  const isWeighable = isWeighableProduct(product);
                  const isMatrix = isMatrixProduct(product);
                  const isTopping = isModifierProduct(product);
                  const totalStock = getProductTotalStock(product);
                  const primaryVariant = product.variants?.[0];
                  const price = primaryVariant ? Number(primaryVariant.base_selling_price) || 0 : 0;

                  return (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => handleProductCardClick(product)}
                      className="group flex flex-col justify-between text-left p-3 rounded-xl bg-surface-card border border-border-subtle hover:border-brand hover:shadow-md transition-all active:scale-[0.98] min-h-[120px]"
                    >
                      {/* Top Badges */}
                      <div className="flex items-start justify-between gap-1 w-full mb-1">
                        <span className="text-[11px] font-mono text-text-sub truncate">
                          {product.code}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          {isWeighable && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-cyan-50 text-cyan-700 border border-cyan-200 flex items-center gap-0.5">
                              <Scale className="w-2.5 h-2.5" /> Cân ký
                            </span>
                          )}
                          {isMatrix && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-0.5">
                              <Layers className="w-2.5 h-2.5" /> Ma trận
                            </span>
                          )}
                          {isTopping && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-0.5">
                              <Utensils className="w-2.5 h-2.5" /> Topping
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Product Name & UOM */}
                      <div className="my-1">
                        <div className="font-semibold text-text-main text-sm line-clamp-2 leading-snug group-hover:text-brand transition-colors">
                          {product.name}
                        </div>
                        <div className="text-[11px] text-text-sub mt-0.5">
                          ĐVT: <span className="font-medium">{product.base_uom}</span>
                        </div>
                      </div>

                      {/* Price & Stock */}
                      <div className="pt-2 border-t border-border-subtle/60 flex items-center justify-between w-full mt-1">
                        <span className="font-bold text-brand text-sm">
                          {formatVND(price)}
                        </span>
                        <span
                          className={`text-[11px] font-medium ${
                            totalStock <= 0 ? "text-rose-600 font-bold" : "text-text-sub"
                          }`}
                        >
                          Tồn: {formatQty(totalStock, product.base_uom)}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* ===================== RIGHT COLUMN (~40%): ADAPTIVE CART & CHECKOUT PANEL ===================== */}
        <section className="w-full lg:w-[40%] flex flex-col min-w-0 bg-surface-card h-full">
          {/* Cart Header: Customer Selection & Clear Cart */}
          <div className="p-3 border-b border-border-subtle flex items-center justify-between gap-2 shrink-0 bg-surface-muted/40">
            {/* Customer Picker Button */}
            <button
              type="button"
              onClick={() => setIsCustomerModalOpen(true)}
              className="flex-1 flex items-center justify-between px-3 py-2 rounded-lg bg-surface-card border border-border-default hover:border-brand text-left text-xs transition-colors"
            >
              <div className="flex items-center gap-2 truncate">
                <User className="w-4 h-4 text-brand shrink-0" />
                <div className="truncate">
                  {selectedCustomer ? (
                    <div>
                      <span className="font-semibold text-text-main truncate">
                        {selectedCustomer.name}
                      </span>
                      {selectedCustomer.phone && (
                        <span className="text-text-sub ml-1.5 font-mono text-[11px]">
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
                <div className="shrink-0 text-right ml-2">
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                    Nợ: {formatVND(selectedCustomer.current_debt_balance || selectedCustomer.current_debt || 0)}
                  </span>
                </div>
              )}
            </button>

            {/* Cart Count & Clear Cart */}
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="px-2 py-1 rounded bg-brand/10 text-brand font-bold text-xs">
                {cart.length} món
              </span>
              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={clearCart}
                  className="p-1.5 text-text-sub hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                  title="Xóa toàn bộ giỏ hàng"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Cart Line Items List */}
          <div className="flex-1 overflow-y-auto divide-y divide-border-subtle p-2 space-y-1">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-text-sub gap-2 py-12">
                <ShoppingCart className="w-12 h-12 stroke-1 text-text-disabled" />
                <span className="text-sm font-medium">Giỏ hàng đang trống</span>
                <span className="text-xs text-text-sub text-center max-w-[240px]">
                  Chạm vào card sản phẩm bên trái hoặc quét mã vạch Barcode để bán hàng.
                </span>
              </div>
            ) : (
              cart.map((item) => (
                <div
                  key={item.id}
                  className={`p-2.5 rounded-lg transition-colors ${
                    item.isReturn
                      ? "bg-rose-50/70 border border-rose-200"
                      : "bg-surface-app/50 hover:bg-surface-app"
                  }`}
                >
                  {/* Row 1: Item Name, Variant Info & Delete */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-text-main text-xs sm:text-sm">
                          {item.productName}
                        </span>
                        {item.variantName && item.variantName !== item.productName && (
                          <span className="text-xs text-text-sub">
                            - {item.variantName}
                          </span>
                        )}
                        {/* Domain Badges */}
                        {item.isReturn && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-600 text-white">
                            TRẢ HÀNG
                          </span>
                        )}
                        {item.isWeighable && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-cyan-100 text-cyan-800">
                            {item.actualBaseQty} {item.baseUom}
                          </span>
                        )}
                        {item.isPriceOverridden && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-amber-100 text-amber-800">
                            Giá sửa
                          </span>
                        )}
                        {item.isBelowMinPrice && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                            Dưới giá sàn
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] font-mono text-text-sub">
                        {item.sku}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="text-text-sub hover:text-rose-600 p-1 rounded"
                      title="Xóa dòng này"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Row 2: Modifiers / Toppings */}
                  {item.modifiers && item.modifiers.length > 0 && (
                    <div className="my-1 pl-2 border-l-2 border-indigo-300 text-[11px] text-indigo-900 space-y-0.5">
                      {item.modifiers.map((mod, i) => (
                        <div key={i} className="flex justify-between">
                          <span>+ {mod.name}</span>
                          <span className="font-mono">+{formatVND(mod.price)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Row 3: Qty Adjuster, Pricing & Action Buttons */}
                  <div className="mt-2 flex items-center justify-between gap-2 pt-1 border-t border-border-subtle/50 text-xs">
                    {/* Qty Controls */}
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => updateItemQty(item.id, item.soldQty - 1)}
                        className="w-6 h-6 rounded bg-surface-card border border-border-default flex items-center justify-center hover:bg-surface-card-hover font-bold"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-8 text-center font-bold font-mono text-sm">
                        {item.soldQty}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateItemQty(item.id, item.soldQty + 1)}
                        className="w-6 h-6 rounded bg-surface-card border border-border-default flex items-center justify-center hover:bg-surface-card-hover font-bold"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                      <span className="text-text-sub text-[11px]">
                        {item.soldUom}
                      </span>
                    </div>

                    {/* Unit Price & Line Total */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setActivePriceModal(item);
                          setPriceInput(item.actualUnitPrice);
                          setPriceWarning(null);
                        }}
                        className="text-[11px] text-text-sub hover:text-brand underline decoration-dotted"
                        title="Sửa giá quầy"
                      >
                        {formatVND(item.actualUnitPrice)}
                      </button>

                      <span
                        className={`font-bold font-mono text-sm ${
                          item.isReturn ? "text-rose-600" : "text-text-main"
                        }`}
                      >
                        {item.isReturn ? `-${formatVND(item.lineTotal)}` : formatVND(item.lineTotal)}
                      </span>
                    </div>

                    {/* Return Toggle Button */}
                    <button
                      type="button"
                      onClick={() => toggleItemReturn(item.id)}
                      className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors flex items-center gap-1 ${
                        item.isReturn
                          ? "bg-rose-600 text-white"
                          : "bg-surface-card hover:bg-rose-50 text-text-sub hover:text-rose-700 border border-border-subtle"
                      }`}
                      title="Đổi/Trả hàng dòng này [F9]"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>{item.isReturn ? "Hủy trả" : "Đổi trả"}</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Checkout & Totals Panel */}
          <div className="p-3.5 border-t border-border-subtle bg-surface-card shrink-0 space-y-3">
            {/* Subtotal & Discount Calculation */}
            <div className="space-y-1.5 text-xs text-text-sub">
              <div className="flex justify-between">
                <span>Tiền hàng:</span>
                <span className="font-mono font-semibold text-text-main">
                  {formatVND(getSubtotal())}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span>Chiết khấu đơn:</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={discountAmount || ""}
                    onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="w-24 text-right px-2 py-0.5 text-xs bg-surface-app border border-border-default rounded font-mono font-medium focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                  <span>₫</span>
                </div>
              </div>

              {/* Total Final Line */}
              <div className="flex justify-between items-baseline pt-1.5 border-t border-border-subtle">
                <span className="font-bold text-sm text-text-main">KHÁCH PHẢI TRẢ:</span>
                <span className="font-extrabold font-mono text-xl text-brand">
                  {formatVND(getTotalAmount())}
                </span>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="grid grid-cols-4 gap-1.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setPaymentMethod("CASH")}
                className={`py-1.5 px-1 rounded-lg border text-center transition-colors ${
                  paymentMethod === "CASH"
                    ? "bg-brand text-white border-brand shadow-sm"
                    : "bg-surface-app text-text-sub border-border-subtle hover:bg-surface-card-hover"
                }`}
              >
                Tiền mặt
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod("BANK_QR")}
                className={`py-1.5 px-1 rounded-lg border text-center transition-colors flex items-center justify-center gap-1 ${
                  paymentMethod === "BANK_QR"
                    ? "bg-brand text-white border-brand shadow-sm"
                    : "bg-surface-app text-text-sub border-border-subtle hover:bg-surface-card-hover"
                }`}
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>VietQR</span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod("CREDIT")}
                className={`py-1.5 px-1 rounded-lg border text-center transition-colors flex items-center justify-center gap-1 ${
                  paymentMethod === "CREDIT"
                    ? "bg-brand text-white border-brand shadow-sm"
                    : "bg-surface-app text-text-sub border-border-subtle hover:bg-surface-card-hover"
                }`}
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Ghi nợ</span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod("MIXED")}
                className={`py-1.5 px-1 rounded-lg border text-center transition-colors ${
                  paymentMethod === "MIXED"
                    ? "bg-brand text-white border-brand shadow-sm"
                    : "bg-surface-app text-text-sub border-border-subtle hover:bg-surface-card-hover"
                }`}
              >
                Hỗn hợp
              </button>
            </div>

            {/* Customer Paid Amount & Quick Cash Chips */}
            {paymentMethod !== "CREDIT" && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-sub whitespace-nowrap">Tiền khách đưa:</span>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={paidAmount || ""}
                    onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)}
                    placeholder={getTotalAmount().toString()}
                    className="flex-1 text-right px-2.5 py-1 text-sm bg-surface-app border border-border-default rounded-lg font-mono font-bold focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                  <span className="text-xs text-text-sub font-mono">₫</span>
                </div>

                {/* Quick Cash Buttons */}
                <div className="flex items-center gap-1 overflow-x-auto scrollbar-none pb-0.5">
                  <button
                    type="button"
                    onClick={() => handleQuickCash(getTotalAmount())}
                    className="px-2 py-0.5 text-[11px] rounded bg-surface-muted hover:bg-surface-card-hover border border-border-subtle font-semibold whitespace-nowrap"
                  >
                    Đúng giá
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickCash(50000)}
                    className="px-2 py-0.5 text-[11px] rounded bg-surface-muted hover:bg-surface-card-hover border border-border-subtle font-semibold whitespace-nowrap"
                  >
                    50k
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickCash(100000)}
                    className="px-2 py-0.5 text-[11px] rounded bg-surface-muted hover:bg-surface-card-hover border border-border-subtle font-semibold whitespace-nowrap"
                  >
                    100k
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickCash(200000)}
                    className="px-2 py-0.5 text-[11px] rounded bg-surface-muted hover:bg-surface-card-hover border border-border-subtle font-semibold whitespace-nowrap"
                  >
                    200k
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickCash(500000)}
                    className="px-2 py-0.5 text-[11px] rounded bg-surface-muted hover:bg-surface-card-hover border border-border-subtle font-semibold whitespace-nowrap"
                  >
                    500k
                  </button>
                </div>
              </div>
            )}

            {/* Change or Debt Row */}
            <div className="flex justify-between items-center text-xs font-semibold py-1 px-2.5 rounded-lg bg-surface-muted/60">
              {getChangeAmount() > 0 ? (
                <>
                  <span className="text-emerald-700">Tiền thối lại khách:</span>
                  <span className="font-mono text-emerald-700 font-bold text-sm">
                    {formatVND(getChangeAmount())}
                  </span>
                </>
              ) : getDebtAmount() > 0 ? (
                <>
                  <span className="text-amber-800">Ghi nợ đơn hàng:</span>
                  <span className="font-mono text-amber-800 font-bold text-sm">
                    {formatVND(getDebtAmount())}
                  </span>
                </>
              ) : (
                <>
                  <span className="text-text-sub">Trạng thái thanh toán:</span>
                  <span className="text-emerald-700">Đã đủ</span>
                </>
              )}
            </div>

            {/* Checkout Error Message */}
            {checkoutError && (
              <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>{checkoutError}</span>
              </div>
            )}

            {/* BIG CHECKOUT BUTTON (F8) */}
            <button
              type="button"
              disabled={cart.length === 0 || isCheckingOut}
              onClick={handleTriggerCheckout}
              className="w-full py-3 px-4 rounded-xl bg-brand hover:bg-brand-hover text-white font-bold text-base shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 active:scale-[0.99]"
            >
              {isCheckingOut ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Đang xử lý đơn hàng...</span>
                </>
              ) : (
                <>
                  <Check className="w-5 h-5" />
                  <span>THANH TOÁN (F8)</span>
                </>
              )}
            </button>
          </div>
        </section>
      </div>

      {/* ===================== MODAL 1: CÂN ĐIỆN TỬ (CATCH-WEIGHT TOUCH KEYPAD) ===================== */}
      {activeWeighModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-surface-card rounded-2xl border border-border-subtle shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="p-4 border-b border-border-subtle flex items-center justify-between bg-surface-muted/40">
              <div className="flex items-center gap-2">
                <Scale className="w-5 h-5 text-cyan-600" />
                <h3 className="font-bold text-text-main text-base">
                  Cân Điện Tử & Tính Giá
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveWeighModal(null)}
                className="text-text-sub hover:text-text-main p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Product Info */}
              <div>
                <h4 className="font-bold text-text-main text-lg">
                  {activeWeighModal.product.name}
                </h4>
                <div className="text-xs text-text-sub font-mono">
                  Mã: {activeWeighModal.variant.sku} | ĐVT gốc: {activeWeighModal.product.base_uom}
                </div>
              </div>

              {/* Digital Weight Display */}
              <div className="p-4 rounded-xl bg-slate-900 text-white flex flex-col items-center justify-center">
                <span className="text-xs font-semibold text-cyan-400 uppercase tracking-widest mb-1">
                  Cân Thực Tế
                </span>
                <div className="flex items-baseline gap-2 font-mono">
                  <span className="text-4xl font-extrabold tracking-tight">
                    {weighInput || "0"}
                  </span>
                  <span className="text-xl text-slate-400">
                    {activeWeighModal.product.base_uom || "kg"}
                  </span>
                </div>
              </div>

              {/* Editable Selling Price per kg */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <label className="font-semibold text-text-main">
                    Đơn giá bán / {activeWeighModal.product.base_uom}:
                  </label>
                  <span className="text-text-sub">
                    Sàn: {formatVND(activeWeighModal.variant.min_selling_price)}
                  </span>
                </div>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={weighUnitPrice || ""}
                  onChange={(e) => setWeighUnitPrice(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-sm bg-surface-app border border-border-default rounded-lg font-mono font-bold focus:outline-none focus:ring-2 focus:ring-brand"
                />
                {weighUnitPrice < Number(activeWeighModal.variant.min_selling_price) && (
                  <p className="text-xs text-rose-600 font-medium">
                    Cảnh báo: Đơn giá dưới giá sàn tối thiểu ({formatVND(activeWeighModal.variant.min_selling_price)})!
                  </p>
                )}
              </div>

              {/* Quick Weight Presets */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {[0.25, 0.5, 1.0, 1.5, 2.0, 5.0].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setWeighInput(preset.toString())}
                    className="px-2.5 py-1 rounded-lg bg-surface-muted hover:bg-surface-card-hover border border-border-subtle text-xs font-bold font-mono whitespace-nowrap"
                  >
                    {preset} {activeWeighModal.product.base_uom}
                  </button>
                ))}
              </div>

              {/* Touch Keypad */}
              <div className="grid grid-cols-3 gap-2">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "DEL"].map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleKeypadPress(key)}
                    className="py-3 rounded-xl bg-surface-app hover:bg-surface-card-hover active:bg-surface-muted border border-border-subtle font-mono text-lg font-bold text-text-main transition-colors"
                  >
                    {key === "DEL" ? "⌫" : key}
                  </button>
                ))}
              </div>

              {/* Total Calculation Preview */}
              <div className="p-3 rounded-xl bg-cyan-50/70 border border-cyan-200 flex justify-between items-center">
                <span className="text-xs font-bold text-cyan-950">THÀNH TIỀN TẠM TÍNH:</span>
                <span className="text-lg font-extrabold font-mono text-cyan-900">
                  {formatVND((parseFloat(weighInput) || 0) * weighUnitPrice)}
                </span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-4 border-t border-border-subtle flex items-center justify-end gap-2 bg-surface-muted/30">
              <button
                type="button"
                onClick={() => setActiveWeighModal(null)}
                className="px-4 py-2 rounded-lg border border-border-subtle text-text-sub hover:bg-surface-card-hover text-sm font-semibold"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleAddCatchWeightToCart}
                className="px-5 py-2 rounded-lg bg-brand hover:bg-brand-hover text-white text-sm font-bold shadow-sm"
              >
                Thêm vào giỏ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== MODAL 2: CHỌN BIẾN THỂ MA TRẬN (MATRIX VARIANT MODAL) ===================== */}
      {activeMatrixModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-surface-card rounded-2xl border border-border-subtle shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]">
            {/* Modal Header */}
            <div className="p-4 border-b border-border-subtle flex items-center justify-between bg-surface-muted/40 shrink-0">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-purple-600" />
                <h3 className="font-bold text-text-main text-base">
                  Chọn Biến Thể Sản Phẩm
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveMatrixModal(null)}
                className="text-text-sub hover:text-text-main p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 flex-1 overflow-y-auto space-y-4">
              <div>
                <h4 className="font-bold text-text-main text-base">
                  {activeMatrixModal.name}
                </h4>
                <p className="text-xs text-text-sub mt-0.5">
                  Chọn các thuộc tính bên dưới để xem phiên bản và giá bán tương ứng:
                </p>
              </div>

              {(() => {
                const variants = activeMatrixModal.variants || [];

                // Extract all unique attribute keys across variants
                const attributeKeys: string[] = [];
                variants.forEach((v) => {
                  const attrs = parseAttributes(v.attributes);
                  Object.keys(attrs).forEach((key) => {
                    if (!attributeKeys.includes(key)) {
                      attributeKeys.push(key);
                    }
                  });
                });

                // Find matching variant based on current selected attributes
                const matchingVariant = variants.find((v) => {
                  const attrs = parseAttributes(v.attributes);
                  return attributeKeys.every((key) => {
                    if (!selectedAttributes[key]) return true;
                    return attrs[key] === selectedAttributes[key];
                  });
                }) || variants[0];

                const stock = matchingVariant ? getVariantStock(matchingVariant) : 0;

                return (
                  <div className="space-y-4">
                    {/* Attribute Rows */}
                    {attributeKeys.map((attrKey) => {
                      // Get all unique values for this attribute key
                      const valuesSet = new Set<string>();
                      variants.forEach((v) => {
                        const attrs = parseAttributes(v.attributes);
                        if (attrs[attrKey]) valuesSet.add(attrs[attrKey]);
                      });
                      const values = Array.from(valuesSet);
                      const currentSelectedVal = selectedAttributes[attrKey] || values[0];

                      return (
                        <div key={attrKey} className="space-y-1.5">
                          <label className="text-xs font-bold text-text-sub uppercase tracking-wider">
                            {attrKey}:
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {values.map((val) => {
                              const isSelected = currentSelectedVal === val;
                              return (
                                <button
                                  key={val}
                                  type="button"
                                  onClick={() =>
                                    setSelectedAttributes((prev) => ({
                                      ...prev,
                                      [attrKey]: val,
                                    }))
                                  }
                                  className={`px-3 py-1.5 rounded-md text-xs font-semibold border transition-all ${
                                    isSelected
                                      ? "bg-brand text-white border-brand shadow-sm"
                                      : "bg-surface-app text-text-main border-border-default hover:bg-surface-muted"
                                  }`}
                                >
                                  {val}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}

                    {/* Matching Variant Details Card */}
                    {matchingVariant ? (
                      <div className="p-4 rounded-xl bg-surface-muted/60 border border-border-subtle space-y-2 mt-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-text-main text-sm">
                            {matchingVariant.variant_name || matchingVariant.sku}
                          </span>
                          <span className="text-[11px] font-mono text-text-sub">
                            SKU: {matchingVariant.sku}
                          </span>
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-border-subtle">
                          <div>
                            <div className="text-[11px] text-text-sub">Đơn giá bán:</div>
                            <div className="text-base font-extrabold text-brand font-mono">
                              {formatVND(matchingVariant.base_selling_price)}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-[11px] text-text-sub">Tồn kho hiện tại:</div>
                            <div className="text-sm font-bold text-text-main font-mono">
                              {formatQty(stock, activeMatrixModal.base_uom)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
                        Không tìm thấy biến thể phù hợp với tổ hợp thuộc tính đã chọn.
                      </div>
                    )}

                    {/* Quick Add To Cart Button */}
                    <div className="pt-2">
                      <button
                        type="button"
                        disabled={!matchingVariant}
                        onClick={() => {
                          if (!matchingVariant) return;
                          if (isWeighableProduct(activeMatrixModal)) {
                            setActiveMatrixModal(null);
                            setWeighInput("1.000");
                            setWeighUnitPrice(Number(matchingVariant.base_selling_price) || 0);
                            setActiveWeighModal({ product: activeMatrixModal, variant: matchingVariant });
                          } else if (isModifierProduct(activeMatrixModal)) {
                            setActiveMatrixModal(null);
                            setSelectedModifiers([]);
                            setActiveModifierModal({ product: activeMatrixModal, variant: matchingVariant });
                          } else {
                            addItem(matchingVariant, activeMatrixModal);
                            setActiveMatrixModal(null);
                          }
                        }}
                        className="w-full py-2.5 rounded-lg bg-brand hover:bg-brand-hover text-white text-sm font-bold shadow-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                      >
                        <Check className="w-4 h-4" />
                        <span>Thêm biến thể vào giỏ hàng</span>
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 border-t border-border-subtle flex justify-end bg-surface-muted/30 shrink-0">
              <button
                type="button"
                onClick={() => setActiveMatrixModal(null)}
                className="px-4 py-2 rounded-lg border border-border-subtle text-text-sub hover:bg-surface-card-hover text-sm font-semibold"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== MODAL 3: CHỌN ĐỒ ĂN KÈM / TOPPING (MODIFIER MODAL) ===================== */}
      {activeModifierModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-surface-card rounded-2xl border border-border-subtle shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="p-4 border-b border-border-subtle flex items-center justify-between bg-surface-muted/40">
              <div className="flex items-center gap-2">
                <Utensils className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-text-main text-base">
                  Chọn Đồ Ăn Kèm & Topping
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveModifierModal(null)}
                className="text-text-sub hover:text-text-main p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <h4 className="font-bold text-text-main text-lg">
                  {activeModifierModal.product.name}
                </h4>
                <div className="text-xs text-text-sub">
                  Giá món chính: <strong className="text-brand">{formatVND(activeModifierModal.variant.base_selling_price)}</strong>
                </div>
              </div>

              {/* Topping Checkbox List */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-text-sub uppercase tracking-wider">
                  Danh sách Topping thêm:
                </div>
                {DEFAULT_TOPPINGS.map((mod) => {
                  const isChecked = selectedModifiers.some((m) => m.name === mod.name);
                  return (
                    <label
                      key={mod.name}
                      className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-colors ${
                        isChecked
                          ? "bg-indigo-50 border-indigo-400 text-indigo-950"
                          : "bg-surface-app border-border-subtle hover:bg-surface-card-hover text-text-main"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedModifiers((prev) => [...prev, mod]);
                            } else {
                              setSelectedModifiers((prev) =>
                                prev.filter((m) => m.name !== mod.name)
                              );
                            }
                          }}
                          className="w-4 h-4 rounded text-brand focus:ring-brand"
                        />
                        <span className="font-semibold text-sm">{mod.name}</span>
                      </div>
                      <span className="font-mono font-bold text-xs text-brand">
                        +{formatVND(mod.price)}
                      </span>
                    </label>
                  );
                })}
              </div>

              {/* Combined Total Preview */}
              <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-200 flex justify-between items-center">
                <span className="text-xs font-bold text-indigo-950">TỔNG MÓN ĐÍNH KÈM:</span>
                <span className="text-lg font-extrabold font-mono text-indigo-900">
                  {formatVND(
                    Number(activeModifierModal.variant.base_selling_price) +
                      selectedModifiers.reduce((acc, m) => acc + m.price, 0)
                  )}
                </span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-4 border-t border-border-subtle flex items-center justify-end gap-2 bg-surface-muted/30">
              <button
                type="button"
                onClick={() => setActiveModifierModal(null)}
                className="px-4 py-2 rounded-lg border border-border-subtle text-text-sub hover:bg-surface-card-hover text-sm font-semibold"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleAddModifierToCart}
                className="px-5 py-2 rounded-lg bg-brand hover:bg-brand-hover text-white text-sm font-bold shadow-sm"
              >
                Thêm vào giỏ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== MODAL 4: CHỌN KHÁCH HÀNG (CUSTOMER MODAL - F4) ===================== */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-surface-card rounded-2xl border border-border-subtle shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-border-subtle flex items-center justify-between bg-surface-muted/40 shrink-0">
              <div className="flex items-center gap-2">
                <User className="w-5 h-5 text-brand" />
                <h3 className="font-bold text-text-main text-base">
                  Chọn Khách Hàng (F4)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCustomerModalOpen(false)}
                className="text-text-sub hover:text-text-main p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 border-b border-border-subtle bg-surface-app shrink-0 space-y-2">
              <input
                type="text"
                autoFocus
                value={customerSearchQuery}
                onChange={(e) => setCustomerSearchQuery(e.target.value)}
                placeholder="Tìm theo tên hoặc số điện thoại..."
                className="w-full px-3 py-2 text-sm bg-surface-card border border-border-default rounded-lg focus:outline-none focus:ring-2 focus:ring-brand font-medium"
              />

              <button
                type="button"
                onClick={() => {
                  setCustomer(null);
                  setIsCustomerModalOpen(false);
                }}
                className={`w-full py-2 px-3 rounded-lg border text-left text-xs font-bold transition-colors ${
                  selectedCustomer === null
                    ? "bg-brand text-white border-brand"
                    : "bg-surface-card text-text-sub hover:bg-surface-card-hover border-border-subtle"
                }`}
              >
                Khách lẻ (Vãng lai) - Không ghi nợ
              </button>
            </div>

            <div className="p-2 flex-1 overflow-y-auto space-y-1">
              {filteredCustomers.length === 0 ? (
                <div className="p-6 text-center text-text-sub text-xs">
                  Không tìm thấy đối tác khách hàng nào.
                </div>
              ) : (
                filteredCustomers.map((cust) => {
                  const isSelected = selectedCustomer?.id === cust.id;
                  const debt = Number(cust.current_debt_balance ?? cust.current_debt ?? 0);

                  return (
                    <button
                      key={cust.id}
                      type="button"
                      onClick={() => {
                        setCustomer(cust);
                        setIsCustomerModalOpen(false);
                      }}
                      className={`w-full p-2.5 rounded-xl border text-left transition-colors flex items-center justify-between ${
                        isSelected
                          ? "bg-emerald-50 border-emerald-400"
                          : "bg-surface-card hover:bg-surface-app border-border-subtle"
                      }`}
                    >
                      <div>
                        <div className="font-bold text-text-main text-sm">
                          {cust.name}
                        </div>
                        <div className="text-xs text-text-sub font-mono">
                          {cust.phone || "Không có SĐT"}
                        </div>
                      </div>
                      <div className="text-right">
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded ${
                            debt > 0
                              ? "bg-amber-100 text-amber-800"
                              : "bg-surface-muted text-text-sub"
                          }`}
                        >
                          Nợ: {formatVND(debt)}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <div className="p-3 border-t border-border-subtle flex justify-end bg-surface-muted/30 shrink-0">
              <button
                type="button"
                onClick={() => setIsCustomerModalOpen(false)}
                className="px-4 py-1.5 rounded-lg border border-border-subtle text-text-sub hover:bg-surface-card-hover text-xs font-semibold"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== MODAL 5: SỬA ĐƠN GIÁ BÁN TẠI QUẦY ===================== */}
      {activePriceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-surface-card rounded-2xl border border-border-subtle shadow-2xl w-full max-w-sm overflow-hidden flex flex-col">
            <div className="p-4 border-b border-border-subtle flex items-center justify-between bg-surface-muted/40">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-amber-600" />
                <h3 className="font-bold text-text-main text-base">
                  Sửa Giá Quầy
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActivePriceModal(null)}
                className="text-text-sub hover:text-text-main p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-3">
              <div>
                <h4 className="font-bold text-text-main text-sm">
                  {activePriceModal.productName}
                </h4>
                <div className="text-xs text-text-sub mt-0.5 space-x-2">
                  <span>Giá niêm yết: {formatVND(activePriceModal.originalUnitPrice)}</span>
                  <span>•</span>
                  <span>Giá sàn: {formatVND(activePriceModal.minSellingPrice)}</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-text-main block mb-1">
                  Đơn giá bán mới:
                </label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  autoFocus
                  value={priceInput || ""}
                  onChange={(e) => setPriceInput(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-base font-bold font-mono bg-surface-app border border-border-default rounded-lg focus:outline-none focus:ring-2 focus:ring-brand"
                />
              </div>

              {priceWarning && (
                <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{priceWarning}</span>
                </div>
              )}
            </div>

            <div className="p-3.5 border-t border-border-subtle flex justify-end gap-2 bg-surface-muted/30">
              <button
                type="button"
                onClick={() => setActivePriceModal(null)}
                className="px-3 py-1.5 rounded-lg border border-border-subtle text-text-sub hover:bg-surface-card-hover text-xs font-semibold"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handlePriceOverrideSubmit}
                className="px-4 py-1.5 rounded-lg bg-brand hover:bg-brand-hover text-white text-xs font-bold shadow-sm"
              >
                Cập nhật giá
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== MODAL 6: HOÀN TẤT ĐƠN HÀNG (CHECKOUT SUCCESS RECEIPT) ===================== */}
      {checkoutSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-surface-card rounded-2xl border border-border-subtle shadow-2xl w-full max-w-md overflow-hidden flex flex-col text-center p-6 space-y-4">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <h3 className="font-extrabold text-xl text-text-main">
                Thanh Toán Hoàn Tất!
              </h3>
              <p className="text-xs text-text-sub mt-1">
                {checkoutSuccess.isOffline
                  ? "Đơn đã lưu ngoại tuyến vào hàng đợi và sẽ tự động đồng bộ khi có kết nối."
                  : "Giao dịch đã được ghi nhận vào Sổ kho, Sổ quỹ và Công nợ."}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-surface-app border border-border-subtle text-left space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-text-sub">Mã đơn hàng:</span>
                <span className="font-mono font-bold text-text-main">
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
              <div className="flex justify-between pt-1 border-t border-border-subtle font-bold text-sm">
                <span>Tổng tiền:</span>
                <span className="font-mono text-brand">
                  {formatVND(checkoutSuccess.totalAmount)}
                </span>
              </div>
              {checkoutSuccess.changeAmount > 0 && (
                <div className="flex justify-between text-emerald-700 font-semibold">
                  <span>Tiền thối lại:</span>
                  <span className="font-mono">{formatVND(checkoutSuccess.changeAmount)}</span>
                </div>
              )}
              {checkoutSuccess.debtAmount > 0 && (
                <div className="flex justify-between text-rose-700 font-semibold">
                  <span>Ghi nợ:</span>
                  <span className="font-mono">{formatVND(checkoutSuccess.debtAmount)}</span>
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
              className="w-full py-3 rounded-xl bg-brand hover:bg-brand-hover text-white font-bold text-sm shadow-md transition-colors"
            >
              Đơn hàng mới (Tiếp tục bán) [Esc]
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
