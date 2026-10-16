"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStoreProfile } from "@/lib/store";
import {
  api,
  Partner,
  Product,
  ProductVariant,
  PurchaseInput,
  PurchaseItem,
} from "@/lib/api";
import { formatVND, formatQty, getBadgeClasses } from "@/lib/design-tokens";
import {
  ArrowLeft,
  ArrowDownToLine,
  Plus,
  Trash2,
  Building2,
  Calendar,
  CreditCard,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Search,
  Calculator,
  TrendingUp,
  TrendingDown,
  Sparkles,
  CalendarClock,
  Layers,
  Scale,
  RotateCcw,
  UserPlus,
  X,
  ExternalLink,
  ChevronDown,
} from "lucide-react";

interface PurchaseItemRow {
  rowId: string;
  productId: string;
  variantId: string;
  productName: string;
  variantName: string;
  sku: string;
  baseUom: string;
  selectedUom: string;
  conversionFactor: number;
  stockOld: number;
  wacOld: number;
  qty: number;
  unitCost: number;
  batchCode: string;
  expiryDate: string;
  trackBatches: boolean;
  availableUoms: { uom_name: string; conversion_factor: number }[];
}

export default function PurchaseOrderPage() {
  const router = useRouter();
  const { isModuleEnabled } = useStoreProfile();

  // Master Data
  const [partners, setPartners] = useState<Partner[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Form Header State
  const [supplierId, setSupplierId] = useState<string>("");
  const [purchaseDate, setPurchaseDate] = useState<string>(() => {
    return new Date().toISOString().split("T")[0];
  });
  const [referenceCode, setReferenceCode] = useState<string>(() => {
    const today = new Date().toISOString().slice(2, 10).replace(/-/g, "");
    const random = Math.floor(1000 + Math.random() * 9000);
    return `PO-${today}-${random}`;
  });
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "BANK_TRANSFER" | "CREDIT">("CASH");
  const [notes, setNotes] = useState<string>("");

  // Items State
  const [items, setItems] = useState<PurchaseItemRow[]>([]);
  const [selectedProductVariantId, setSelectedProductVariantId] = useState<string>("");

  // Quick Supplier Modal State
  const [showQuickSupplierModal, setShowQuickSupplierModal] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState("");
  const [newSupplierPhone, setNewSupplierPhone] = useState("");
  const [newSupplierAddress, setNewSupplierAddress] = useState("");
  const [isCreatingSupplier, setIsCreatingSupplier] = useState(false);
  const [supplierModalError, setSupplierModalError] = useState<string | null>(null);

  // Payment Summary State
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [hasManuallyEditedPaid, setHasManuallyEditedPaid] = useState<boolean>(false);

  // Form Submission & Toast State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  // Fetch initial master data
  const loadMasterData = async () => {
    setIsLoadingData(true);
    setFetchError(null);
    try {
      const [partnersData, productsData] = await Promise.all([
        api.getPartners("SUPPLIER"),
        api.getProducts(),
      ]);
      setPartners(partnersData || []);
      setProducts(productsData || []);
    } catch (err: any) {
      setFetchError(err.message || "Không thể tải dữ liệu ban đầu");
    } finally {
      setIsLoadingData(false);
    }
  };

  useEffect(() => {
    loadMasterData();
  }, []);

  // Flattened list of product variants for easy selection
  const flatVariants = useMemo(() => {
    const list: {
      productId: string;
      productName: string;
      baseUom: string;
      trackBatches: boolean;
      variant: ProductVariant;
    }[] = [];

    products.forEach((product) => {
      if (product.variants && product.variants.length > 0) {
        product.variants.forEach((v) => {
          list.push({
            productId: product.id,
            productName: product.name,
            baseUom: product.base_uom,
            trackBatches: product.track_batches,
            variant: v,
          });
        });
      }
    });

    return list;
  }, [products]);

  // Selected supplier details
  const selectedSupplier = useMemo(() => {
    return partners.find((p) => p.id === supplierId);
  }, [partners, supplierId]);

  // Calculate totals
  const totalAmount = useMemo(() => {
    return items.reduce((sum, item) => sum + item.qty * item.unitCost, 0);
  }, [items]);

  // Auto-synchronize amountPaid when total changes unless user manually edited it
  useEffect(() => {
    if (!hasManuallyEditedPaid) {
      if (paymentMethod === "CREDIT") {
        setAmountPaid(0);
      } else {
        setAmountPaid(totalAmount);
      }
    }
  }, [totalAmount, paymentMethod, hasManuallyEditedPaid]);

  const remainingDebt = Math.max(0, totalAmount - amountPaid);

  // Add Item to table
  const handleAddItem = (variantIdToAdd?: string) => {
    const targetVariantId = variantIdToAdd || selectedProductVariantId;
    if (!targetVariantId) return;

    const itemMeta = flatVariants.find((fv) => fv.variant.id === targetVariantId);
    if (!itemMeta) return;

    const { productId, productName, baseUom, trackBatches, variant } = itemMeta;

    const currentStock = Number(variant.current_stock || 0);
    const costPrice = Number(variant.cost_price || 0);

    // Available UOMs: base + conversions
    const availableUoms = [{ uom_name: baseUom, conversion_factor: 1 }];
    if (variant.uom_conversions && variant.uom_conversions.length > 0) {
      variant.uom_conversions.forEach((uc) => {
        availableUoms.push({
          uom_name: uc.uom_name,
          conversion_factor: Number(uc.conversion_factor) || 1,
        });
      });
    }

    const isBatchActive = trackBatches || isModuleEnabled("batch_expiry");
    const todayStr = new Date().toISOString().slice(2, 10).replace(/-/g, "");
    const rowCount = items.length + 1;
    const defaultBatch = isBatchActive
      ? `LOT-${todayStr}-${String(rowCount).padStart(2, "0")}`
      : "";

    const newRow: PurchaseItemRow = {
      rowId: `row-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      productId,
      variantId: variant.id,
      productName,
      variantName: variant.variant_name || "Tiêu chuẩn",
      sku: variant.sku,
      baseUom,
      selectedUom: baseUom,
      conversionFactor: 1,
      stockOld: currentStock,
      wacOld: costPrice,
      qty: 1,
      unitCost: costPrice > 0 ? costPrice : 0,
      batchCode: defaultBatch,
      expiryDate: "",
      trackBatches: isBatchActive,
      availableUoms,
    };

    setItems((prev) => [...prev, newRow]);
    setSelectedProductVariantId("");
  };

  // Remove Item
  const handleRemoveItem = (rowId: string) => {
    setItems((prev) => prev.filter((item) => item.rowId !== rowId));
  };

  // Update item field
  const handleUpdateItem = (
    rowId: string,
    field: keyof PurchaseItemRow,
    value: any
  ) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.rowId !== rowId) return item;

        if (field === "selectedUom") {
          const matchedUom = item.availableUoms.find((u) => u.uom_name === value);
          const factor = matchedUom ? matchedUom.conversion_factor : 1;
          return {
            ...item,
            selectedUom: value,
            conversionFactor: factor,
          };
        }

        return { ...item, [field]: value };
      })
    );
  };

  // Calculate real-time WAC preview for a row
  const getWacPreview = (item: PurchaseItemRow) => {
    const stockOld = Math.max(0, Number(item.stockOld) || 0);
    const wacOld = Math.max(0, Number(item.wacOld) || 0);
    const factor = item.conversionFactor > 0 ? item.conversionFactor : 1;
    const qtyInBase = (Number(item.qty) || 0) * factor;
    const priceInBase = factor > 0 ? (Number(item.unitCost) || 0) / factor : 0;

    const totalStock = stockOld + qtyInBase;

    let newWac = wacOld;
    if (totalStock <= 0) {
      newWac = priceInBase;
    } else if (stockOld <= 0) {
      newWac = priceInBase;
    } else {
      const totalCostValue = stockOld * wacOld + qtyInBase * priceInBase;
      newWac = Math.round(totalCostValue / totalStock);
    }

    const delta = newWac - wacOld;
    const percentChange =
      wacOld > 0 ? ((newWac - wacOld) / wacOld) * 100 : newWac > 0 ? 100 : 0;

    return {
      newWac,
      delta,
      percentChange,
      stockOld,
      qtyInBase,
      totalStock,
    };
  };

  // Create Quick Supplier
  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSupplierName.trim()) {
      setSupplierModalError("Vui lòng nhập tên nhà cung cấp");
      return;
    }

    setIsCreatingSupplier(true);
    setSupplierModalError(null);

    try {
      const created = await api.createPartner({
        name: newSupplierName.trim(),
        phone: newSupplierPhone.trim() || undefined,
        address: newSupplierAddress.trim() || undefined,
        partner_type: "SUPPLIER",
      });

      setPartners((prev) => [created, ...prev]);
      setSupplierId(created.id);
      setShowQuickSupplierModal(false);
      setNewSupplierName("");
      setNewSupplierPhone("");
      setNewSupplierAddress("");
    } catch (err: any) {
      setSupplierModalError(err.message || "Lỗi khi tạo nhà cung cấp");
    } finally {
      setIsCreatingSupplier(false);
    }
  };

  // Handle Complete Purchase
  const handleSubmitPurchase = async () => {
    setSubmitError(null);
    setSubmitSuccess(null);

    // Validations
    if (!supplierId) {
      setSubmitError("Vui lòng chọn hoặc thêm mới Nhà cung cấp.");
      return;
    }

    if (items.length === 0) {
      setSubmitError("Vui lòng thêm ít nhất một mặt hàng vào phiếu nhập kho.");
      return;
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.qty <= 0) {
        setSubmitError(
          `Sản phẩm "${item.productName} (${item.variantName})" phải có số lượng lớn hơn 0.`
        );
        return;
      }
      if (item.unitCost < 0) {
        setSubmitError(
          `Sản phẩm "${item.productName} (${item.variantName})" có đơn giá không hợp lệ.`
        );
        return;
      }

      // Check batch expiry if enabled
      const requireBatch =
        isModuleEnabled("batch_expiry") || item.trackBatches;
      if (requireBatch && !item.batchCode.trim()) {
        setSubmitError(
          `Vui lòng nhập Mã Lô (Batch Code) cho sản phẩm "${item.productName}".`
        );
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const noteParts = [
        notes.trim(),
        `Ngày nhập: ${purchaseDate}`,
        `PT: ${paymentMethod}`,
        `Đã thanh toán: ${formatVND(amountPaid)}`,
      ].filter(Boolean);

      const purchasePayload: PurchaseInput = {
        supplier_id: supplierId || undefined,
        reference_id: referenceCode.trim() || undefined,
        notes: noteParts.join(" | "),
        items: items.map((item) => {
          const baseQty = Number(item.qty) * (item.conversionFactor || 1);
          const baseUnitCost =
            item.conversionFactor > 0
              ? Number(item.unitCost) / item.conversionFactor
              : Number(item.unitCost);

          return {
            variant_id: item.variantId,
            qty: baseQty,
            unit_cost: baseUnitCost,
            uom: item.baseUom,
            batch_code:
              (item.trackBatches || isModuleEnabled("batch_expiry")) &&
              item.batchCode.trim()
                ? item.batchCode.trim()
                : undefined,
            expiry_date: item.expiryDate
              ? `${item.expiryDate}T00:00:00Z`
              : undefined,
          };
        }),
      };

      await api.purchaseStock(purchasePayload);

      setSubmitSuccess(
        `Đã tạo phiếu nhập kho "${referenceCode}" thành công! Tồn kho và giá vốn WAC đã được cập nhật.`
      );
    } catch (err: any) {
      setSubmitError(err.message || "Lỗi khi xử lý nhập hàng.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset form to create another PO
  const handleResetForm = () => {
    const today = new Date().toISOString().slice(2, 10).replace(/-/g, "");
    const random = Math.floor(1000 + Math.random() * 9000);
    setReferenceCode(`PO-${today}-${random}`);
    setSupplierId("");
    setPaymentMethod("CASH");
    setNotes("");
    setItems([]);
    setAmountPaid(0);
    setHasManuallyEditedPaid(false);
    setSubmitSuccess(null);
    setSubmitError(null);
    loadMasterData();
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border-subtle pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/products"
              className="inline-flex items-center gap-1 text-xs text-text-sub hover:text-text-main transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Quay lại Sản phẩm</span>
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center text-brand">
              <ArrowDownToLine className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-text-main">
                Tạo Phiếu Nhập Hàng (PO & Kho Vận)
              </h1>
              <p className="text-xs text-text-sub">
                Nhập hàng từ nhà cung cấp, ghi nhận số lô, hạn sử dụng và cập nhật giá vốn WAC tức thì
              </p>
            </div>
          </div>
        </div>

        {/* Feature Badges Active Status */}
        <div className="flex flex-wrap items-center gap-2">
          {isModuleEnabled("batch_expiry") && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200">
              <CalendarClock className="w-3.5 h-3.5 text-amber-600" />
              Lô & Hạn sử dụng
            </span>
          )}
          {isModuleEnabled("credit_ledger") && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-50 text-rose-800 border border-rose-200">
              <CreditCard className="w-3.5 h-3.5 text-rose-600" />
              Sổ nợ NCC
            </span>
          )}
          {isModuleEnabled("catch_weight") && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-cyan-50 text-cyan-800 border border-cyan-200">
              <Scale className="w-3.5 h-3.5 text-cyan-600" />
              Cân ký & Biến thiên
            </span>
          )}
        </div>
      </div>

      {/* Success Notification Alert */}
      {submitSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3 shadow-sm">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-emerald-900">
              Nhập hàng hoàn tất thành công!
            </h3>
            <p className="text-xs text-emerald-700 mt-0.5">{submitSuccess}</p>
            <div className="flex items-center gap-3 mt-3">
              <button
                type="button"
                onClick={handleResetForm}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 shadow-sm transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Tạo phiếu nhập mới
              </button>
              <Link
                href="/products"
                className="px-3 py-1.5 bg-white border border-emerald-300 hover:bg-emerald-100 text-emerald-800 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Xem danh sách sản phẩm & tồn kho
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Error Notification Alert */}
      {submitError && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 shadow-sm">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-rose-900">
              Không thể hoàn tất phiếu nhập
            </h3>
            <p className="text-xs text-rose-700 mt-0.5">{submitError}</p>
          </div>
          <button
            type="button"
            onClick={() => setSubmitError(null)}
            className="text-rose-500 hover:text-rose-800 text-xs"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Loading state for master data */}
      {isLoadingData ? (
        <div className="p-12 text-center bg-surface-card rounded-xl border border-border-subtle shadow-card flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 text-brand animate-spin mb-3" />
          <span className="text-sm text-text-sub">Đang tải dữ liệu nhà cung cấp và danh mục hàng hóa...</span>
        </div>
      ) : fetchError ? (
        <div className="p-6 bg-rose-50 border border-rose-200 rounded-xl text-center">
          <p className="text-sm text-rose-700 font-medium mb-3">{fetchError}</p>
          <button
            onClick={loadMasterData}
            className="px-4 py-2 bg-rose-600 text-white text-xs rounded-lg font-medium hover:bg-rose-700 inline-flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Thử tải lại
          </button>
        </div>
      ) : (
        <>
          {/* =========================================================================
              KHỐI 1: THÔNG TIN CHUNG ĐƠN NHẬP HÀNG
          ========================================================================== */}
          <div className="bg-surface-card rounded-xl border border-border-subtle p-5 shadow-card space-y-4">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-brand" />
                <h2 className="text-sm font-semibold text-text-main">
                  Khối 1: Thông tin chung đơn nhập hàng
                </h2>
              </div>
              <span className="text-xs text-text-sub font-mono">
                {items.length} dòng sản phẩm
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Nhà Cung Cấp */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-text-main flex items-center gap-1">
                    Nhà cung cấp
                    <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowQuickSupplierModal(true)}
                    className="text-[11px] text-brand hover:text-brand-hover font-medium flex items-center gap-1 hover:underline"
                  >
                    <UserPlus className="w-3 h-3" />
                    Thêm nhanh NCC
                  </button>
                </div>
                <select
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-surface-app border border-border-default rounded-lg focus:outline-none focus:border-brand text-text-main"
                >
                  <option value="">-- Chọn Nhà cung cấp --</option>
                  {partners.map((partner) => (
                    <option key={partner.id} value={partner.id}>
                      {partner.name} {partner.phone ? `(${partner.phone})` : ""}
                    </option>
                  ))}
                </select>

                {/* Supplier Debt & Details */}
                {selectedSupplier && (
                  <div className="mt-1 p-2 bg-surface-muted rounded-lg border border-border-subtle text-[11px] space-y-0.5">
                    <div className="flex justify-between text-text-sub">
                      <span>Nợ NCC hiện tại:</span>
                      <span className="font-semibold text-rose-700">
                        {formatVND(
                          (selectedSupplier as any).current_debt_balance ??
                            selectedSupplier.current_debt ??
                            0
                        )}
                      </span>
                    </div>
                    {selectedSupplier.phone && (
                      <div className="flex justify-between text-text-sub">
                        <span>Điện thoại:</span>
                        <span>{selectedSupplier.phone}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Ngày Nhập Hàng */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-main flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-text-sub" />
                  Ngày nhập hàng
                </label>
                <input
                  type="date"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-surface-app border border-border-default rounded-lg focus:outline-none focus:border-brand text-text-main font-mono"
                />
              </div>

              {/* Mã Phiếu Nhập / Số Hóa Đơn NCC */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-main flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-text-sub" />
                  Mã phiếu / Số HĐ NCC
                </label>
                <input
                  type="text"
                  value={referenceCode}
                  onChange={(e) => setReferenceCode(e.target.value)}
                  placeholder="PO-20261016-01 / HD-12345"
                  className="w-full text-xs px-3 py-2 bg-surface-app border border-border-default rounded-lg focus:outline-none focus:border-brand text-text-main font-mono"
                />
              </div>

              {/* Phương Thức Thanh Toán */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-main flex items-center gap-1">
                  <CreditCard className="w-3.5 h-3.5 text-text-sub" />
                  Phương thức thanh toán
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) =>
                    setPaymentMethod(
                      e.target.value as "CASH" | "BANK_TRANSFER" | "CREDIT"
                    )
                  }
                  className="w-full text-xs px-3 py-2 bg-surface-app border border-border-default rounded-lg focus:outline-none focus:border-brand text-text-main"
                >
                  <option value="CASH">Tiền mặt (CASH)</option>
                  <option value="BANK_TRANSFER">Chuyển khoản (BANK)</option>
                  <option value="CREDIT">Ghi nợ NCC (Công nợ)</option>
                </select>
              </div>

              {/* Ghi Chú Đơn Nhập */}
              <div className="col-span-1 md:grid-cols-2 lg:col-span-4 space-y-1.5">
                <label className="text-xs font-medium text-text-sub">
                  Ghi chú nhập hàng
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ghi chú về đợt giao nhận, xe vận chuyển, tình trạng bao bì..."
                  className="w-full text-xs px-3 py-2 bg-surface-app border border-border-default rounded-lg focus:outline-none focus:border-brand text-text-main"
                />
              </div>
            </div>
          </div>

          {/* =========================================================================
              KHỐI 2: BẢNG DANH SÁCH HÀNG NHẬP (PURCHASE ITEMS TABLE)
          ========================================================================== */}
          <div className="bg-surface-card rounded-xl border border-border-subtle p-5 shadow-card space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border-subtle pb-3">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-brand" />
                <h2 className="text-sm font-semibold text-text-main">
                  Khối 2: Danh sách hàng nhập & Dự tính WAC
                </h2>
              </div>

              {/* Selector to Add Product Variant */}
              <div className="flex items-center gap-2">
                <div className="relative min-w-[280px] sm:min-w-[340px]">
                  <select
                    value={selectedProductVariantId}
                    onChange={(e) => {
                      setSelectedProductVariantId(e.target.value);
                      if (e.target.value) {
                        handleAddItem(e.target.value);
                      }
                    }}
                    className="w-full text-xs pl-3 pr-8 py-2 bg-surface-app border border-border-default rounded-lg focus:outline-none focus:border-brand text-text-main cursor-pointer"
                  >
                    <option value="">+ Chọn sản phẩm để thêm vào phiếu...</option>
                    {flatVariants.map(({ productId, productName, baseUom, variant }) => {
                      const stock = Number(variant.current_stock || 0);
                      const cost = Number(variant.cost_price || 0);
                      return (
                        <option key={variant.id} value={variant.id}>
                          [{variant.sku}] {productName} {variant.variant_name ? `- ${variant.variant_name}` : ""} (Tồn: {formatQty(stock, baseUom)} | Vốn: {formatVND(cost)})
                        </option>
                      );
                    })}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-text-sub absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Empty State */}
            {items.length === 0 ? (
              <div className="py-12 text-center border-2 border-dashed border-border-subtle rounded-xl flex flex-col items-center justify-center p-6 bg-surface-muted/30">
                <div className="w-12 h-12 rounded-full bg-brand/10 text-brand flex items-center justify-center mb-2">
                  <ArrowDownToLine className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-semibold text-text-main">
                  Chưa có sản phẩm nào trong phiếu nhập
                </h3>
                <p className="text-xs text-text-sub max-w-sm mt-1">
                  Chọn một sản phẩm từ danh sách phía trên hoặc tìm kiếm theo SKU để bắt đầu nhập số lượng và tính toán giá vốn WAC.
                </p>
              </div>
            ) : (
              /* Items Table */
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border-subtle bg-surface-muted/50 text-text-sub font-semibold">
                      <th className="py-2.5 px-3 w-10 text-center">#</th>
                      <th className="py-2.5 px-3 min-w-[200px]">Sản phẩm & Biến thể</th>
                      <th className="py-2.5 px-3 w-28">Đơn vị</th>
                      <th className="py-2.5 px-3 w-32 text-right">Số lượng nhập</th>
                      <th className="py-2.5 px-3 w-36 text-right">Đơn giá nhập</th>
                      <th className="py-2.5 px-3 w-36 text-right">Thành tiền</th>
                      {(isModuleEnabled("batch_expiry") || items.some((i) => i.trackBatches)) && (
                        <>
                          <th className="py-2.5 px-3 w-36">Mã Lô (Batch)</th>
                          <th className="py-2.5 px-3 w-36">Hạn sử dụng</th>
                        </>
                      )}
                      <th className="py-2.5 px-3 min-w-[200px]">Dự tính WAC Mới</th>
                      <th className="py-2.5 px-2 w-10 text-center">Xóa</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {items.map((item, index) => {
                      const itemSubtotal = item.qty * item.unitCost;
                      const wacInfo = getWacPreview(item);
                      const showBatchCols =
                        isModuleEnabled("batch_expiry") || items.some((i) => i.trackBatches);

                      return (
                        <tr
                          key={item.rowId}
                          className="hover:bg-surface-card-hover transition-colors group"
                        >
                          {/* STT */}
                          <td className="py-3 px-3 text-center text-text-sub font-mono">
                            {index + 1}
                          </td>

                          {/* Product Info */}
                          <td className="py-3 px-3">
                            <div className="font-semibold text-text-main">
                              {item.productName}
                            </div>
                            <div className="text-[11px] text-text-sub flex items-center gap-1.5 mt-0.5">
                              <span className="font-mono text-brand font-medium">
                                {item.sku}
                              </span>
                              {item.variantName && item.variantName !== "Tiêu chuẩn" && (
                                <span className="text-text-sub">
                                  • {item.variantName}
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-text-disabled mt-0.5">
                              Tồn kho: {formatQty(item.stockOld, item.baseUom)} | Vốn cũ:{" "}
                              {formatVND(item.wacOld)}
                            </div>
                          </td>

                          {/* UOM Selector */}
                          <td className="py-3 px-3">
                            {item.availableUoms.length > 1 ? (
                              <select
                                value={item.selectedUom}
                                onChange={(e) =>
                                  handleUpdateItem(item.rowId, "selectedUom", e.target.value)
                                }
                                className="w-full text-xs px-2 py-1.5 bg-surface-app border border-border-default rounded focus:outline-none focus:border-brand"
                              >
                                {item.availableUoms.map((u) => (
                                  <option key={u.uom_name} value={u.uom_name}>
                                    {u.uom_name}{" "}
                                    {u.conversion_factor !== 1
                                      ? `(x${u.conversion_factor})`
                                      : ""}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="inline-block px-2 py-1 bg-surface-muted text-text-main font-medium rounded text-xs border border-border-subtle">
                                {item.baseUom}
                              </span>
                            )}
                          </td>

                          {/* Qty Input (supports decimals, catch-weight) */}
                          <td className="py-3 px-3 text-right">
                            <input
                              type="number"
                              min="0.001"
                              step="any"
                              value={item.qty === 0 ? "" : item.qty}
                              onChange={(e) =>
                                handleUpdateItem(
                                  item.rowId,
                                  "qty",
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              className="w-24 text-right text-xs px-2 py-1.5 bg-surface-app border border-border-default rounded focus:outline-none focus:border-brand font-mono font-medium"
                            />
                            {item.conversionFactor !== 1 && (
                              <div className="text-[10px] text-text-sub mt-0.5">
                                = {formatQty(wacInfo.qtyInBase, item.baseUom)}
                              </div>
                            )}
                          </td>

                          {/* Unit Cost Input */}
                          <td className="py-3 px-3 text-right">
                            <input
                              type="number"
                              min="0"
                              step="1000"
                              value={item.unitCost === 0 ? "" : item.unitCost}
                              onChange={(e) =>
                                handleUpdateItem(
                                  item.rowId,
                                  "unitCost",
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              className="w-28 text-right text-xs px-2 py-1.5 bg-surface-app border border-border-default rounded focus:outline-none focus:border-brand font-mono font-medium"
                            />
                            <div className="text-[10px] text-text-sub mt-0.5">
                              {formatVND(item.unitCost)}
                            </div>
                          </td>

                          {/* Subtotal */}
                          <td className="py-3 px-3 text-right font-mono font-semibold text-text-main">
                            {formatVND(itemSubtotal)}
                          </td>

                          {/* Batch & Expiry (if enabled) */}
                          {showBatchCols && (
                            <>
                              <td className="py-3 px-3">
                                <input
                                  type="text"
                                  value={item.batchCode}
                                  onChange={(e) =>
                                    handleUpdateItem(item.rowId, "batchCode", e.target.value)
                                  }
                                  placeholder="LOT-20261016-01"
                                  className="w-32 text-xs px-2 py-1.5 bg-surface-app border border-border-default rounded focus:outline-none focus:border-brand font-mono"
                                />
                              </td>
                              <td className="py-3 px-3">
                                <input
                                  type="date"
                                  value={item.expiryDate}
                                  onChange={(e) =>
                                    handleUpdateItem(item.rowId, "expiryDate", e.target.value)
                                  }
                                  className="w-32 text-xs px-2 py-1.5 bg-surface-app border border-border-default rounded focus:outline-none focus:border-brand font-mono"
                                />
                              </td>
                            </>
                          )}

                          {/* Real-time WAC Calculation Preview */}
                          <td className="py-3 px-3">
                            <div className="bg-surface-app p-2 rounded-lg border border-border-subtle space-y-1">
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-text-sub text-[11px]">WAC Mới:</span>
                                <span className="font-bold font-mono text-text-main">
                                  {formatVND(wacInfo.newWac)}
                                </span>
                              </div>

                              <div className="flex items-center justify-between text-[10px]">
                                <span className="text-text-disabled">Chênh lệch:</span>
                                {wacInfo.delta > 0 ? (
                                  <span className="inline-flex items-center text-amber-700 bg-amber-50 px-1 py-0.5 rounded font-mono font-semibold">
                                    <TrendingUp className="w-2.5 h-2.5 mr-0.5" />
                                    +{formatVND(wacInfo.delta)} (+{wacInfo.percentChange.toFixed(1)}%)
                                  </span>
                                ) : wacInfo.delta < 0 ? (
                                  <span className="inline-flex items-center text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded font-mono font-semibold">
                                    <TrendingDown className="w-2.5 h-2.5 mr-0.5" />
                                    {formatVND(wacInfo.delta)} ({wacInfo.percentChange.toFixed(1)}%)
                                  </span>
                                ) : (
                                  <span className="text-text-disabled font-mono">
                                    Không đổi
                                  </span>
                                )}
                              </div>

                              <div className="text-[9px] text-text-disabled border-t border-border-subtle pt-0.5">
                                [({item.stockOld} × {Math.round(item.wacOld)}) + (
                                {wacInfo.qtyInBase} × {Math.round(item.unitCost / item.conversionFactor)})] /{" "}
                                {wacInfo.totalStock}
                              </div>
                            </div>
                          </td>

                          {/* Delete Action */}
                          <td className="py-3 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item.rowId)}
                              title="Xóa dòng"
                              className="text-text-sub hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* =========================================================================
              KHỐI 3: TỔNG KẾT & THANH TOÁN (PAYMENT SUMMARY)
          ========================================================================== */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Summary Notes & Terms */}
            <div className="lg:col-span-1 bg-surface-card rounded-xl border border-border-subtle p-5 shadow-card space-y-4">
              <div className="flex items-center gap-2 border-b border-border-subtle pb-3">
                <Calculator className="w-4 h-4 text-brand" />
                <h3 className="text-sm font-semibold text-text-main">
                  Tóm tắt số liệu nhập kho
                </h3>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between py-1 border-b border-border-subtle text-text-sub">
                  <span>Số dòng sản phẩm:</span>
                  <span className="font-semibold text-text-main">
                    {items.length} mặt hàng
                  </span>
                </div>

                <div className="flex justify-between py-1 border-b border-border-subtle text-text-sub">
                  <span>Tổng số lượng nhập:</span>
                  <span className="font-semibold text-text-main">
                    {items
                      .reduce((sum, item) => sum + Number(item.qty || 0), 0)
                      .toLocaleString("vi-VN")}
                  </span>
                </div>

                <div className="flex justify-between py-1 border-b border-border-subtle text-text-sub">
                  <span>Nhà cung cấp:</span>
                  <span className="font-semibold text-text-main truncate max-w-[180px]">
                    {selectedSupplier?.name || "Chưa gắn NCC"}
                  </span>
                </div>

                <div className="flex justify-between py-1 border-b border-border-subtle text-text-sub">
                  <span>Phương thức:</span>
                  <span className="font-medium text-text-main">
                    {paymentMethod === "CASH"
                      ? "Tiền mặt"
                      : paymentMethod === "BANK_TRANSFER"
                      ? "Chuyển khoản"
                      : "Ghi nợ NCC"}
                  </span>
                </div>

                {isModuleEnabled("batch_expiry") && (
                  <div className="p-2.5 bg-amber-50/70 border border-amber-200/60 rounded-lg text-amber-800 text-[11px] flex items-start gap-2">
                    <CalendarClock className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600" />
                    <span>
                      Chế độ <strong>Quản lý Lô & Hạn sử dụng</strong> đang bật. Tất cả các lô hàng nhập sẽ được lập thẻ kho theo dõi thời hạn.
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Payment Calculation & Submit Button */}
            <div className="lg:col-span-2 bg-surface-card rounded-xl border border-border-subtle p-5 shadow-card flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-border-subtle pb-3">
                  <h3 className="text-sm font-semibold text-text-main">
                    Khối 3: Tổng kết & Thanh toán
                  </h3>
                  <span className="text-xs text-text-sub font-mono">
                    Chứng từ: {referenceCode}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Tổng Tiền Hàng */}
                  <div className="p-4 bg-surface-muted/60 rounded-xl border border-border-subtle">
                    <span className="text-xs text-text-sub font-medium">
                      Tổng tiền hàng
                    </span>
                    <div className="text-lg sm:text-xl font-bold text-text-main font-mono mt-1">
                      {formatVND(totalAmount)}
                    </div>
                    <span className="text-[10px] text-text-disabled">
                      {items.length} mặt hàng
                    </span>
                  </div>

                  {/* Tiền Thanh Toán Thực Tế */}
                  <div className="p-4 bg-emerald-50/60 rounded-xl border border-emerald-200">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-emerald-800 font-medium">
                        Tiền thanh toán thực tế
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setAmountPaid(totalAmount);
                          setHasManuallyEditedPaid(true);
                        }}
                        className="text-[10px] text-brand hover:underline"
                      >
                        Trả đủ
                      </button>
                    </div>
                    <input
                      type="number"
                      min="0"
                      step="1000"
                      value={amountPaid === 0 ? "" : amountPaid}
                      onChange={(e) => {
                        setAmountPaid(parseFloat(e.target.value) || 0);
                        setHasManuallyEditedPaid(true);
                      }}
                      className="w-full text-base sm:text-lg font-bold font-mono text-emerald-900 bg-white border border-emerald-300 rounded-lg px-2.5 py-1 mt-1 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    <div className="text-[10px] text-emerald-700 mt-1">
                      {formatVND(amountPaid)}
                    </div>
                  </div>

                  {/* Tiền Nợ NCC Còn Lại */}
                  <div className="p-4 bg-surface-muted/60 rounded-xl border border-border-subtle">
                    <span className="text-xs text-text-sub font-medium">
                      Tiền nợ NCC còn lại
                    </span>
                    <div
                      className={`text-lg sm:text-xl font-bold font-mono mt-1 ${
                        remainingDebt > 0 ? "text-rose-600" : "text-text-main"
                      }`}
                    >
                      {formatVND(remainingDebt)}
                    </div>
                    <span className="text-[10px] text-text-disabled">
                      {remainingDebt > 0
                        ? "Ghi sổ nợ phải trả NCC"
                        : "Thanh toán dứt điểm"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-4 border-t border-border-subtle">
                <button
                  type="button"
                  onClick={handleResetForm}
                  disabled={isSubmitting}
                  className="w-full sm:w-auto px-4 py-2.5 text-xs text-text-sub hover:text-text-main hover:bg-surface-card-hover rounded-lg border border-border-subtle transition-colors flex items-center justify-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Làm mới
                </button>

                <button
                  type="button"
                  onClick={handleSubmitPurchase}
                  disabled={isSubmitting || items.length === 0}
                  className="w-full sm:w-auto px-6 py-2.5 bg-brand hover:bg-brand-hover text-white rounded-lg text-xs font-semibold shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Đang ghi sổ & cập nhật WAC...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Hoàn tất nhập kho</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* =========================================================================
          MODAL: TẠO NHANH NHÀ CUNG CẤP (QUICK SUPPLIER MODAL)
      ========================================================================== */}
      {showQuickSupplierModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface-card rounded-xl border border-border-subtle shadow-dropdown w-full max-w-md p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-brand" />
                <h3 className="text-sm font-semibold text-text-main">
                  Thêm nhanh Nhà cung cấp mới
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowQuickSupplierModal(false)}
                className="text-text-sub hover:text-text-main p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {supplierModalError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
                {supplierModalError}
              </div>
            )}

            <form onSubmit={handleCreateSupplier} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-text-main block mb-1">
                  Tên nhà cung cấp <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newSupplierName}
                  onChange={(e) => setNewSupplierName(e.target.value)}
                  placeholder="Công ty CP Thủy sản Đại Dương"
                  className="w-full text-xs px-3 py-2 bg-surface-app border border-border-default rounded-lg focus:outline-none focus:border-brand text-text-main"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-text-main block mb-1">
                  Số điện thoại
                </label>
                <input
                  type="text"
                  value={newSupplierPhone}
                  onChange={(e) => setNewSupplierPhone(e.target.value)}
                  placeholder="0912345678"
                  className="w-full text-xs px-3 py-2 bg-surface-app border border-border-default rounded-lg focus:outline-none focus:border-brand text-text-main"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-text-main block mb-1">
                  Địa chỉ
                </label>
                <input
                  type="text"
                  value={newSupplierAddress}
                  onChange={(e) => setNewSupplierAddress(e.target.value)}
                  placeholder="Cảng cá Hòn Rớ, Nha Trang, Khánh Hòa"
                  className="w-full text-xs px-3 py-2 bg-surface-app border border-border-default rounded-lg focus:outline-none focus:border-brand text-text-main"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border-subtle">
                <button
                  type="button"
                  onClick={() => setShowQuickSupplierModal(false)}
                  className="px-3 py-2 text-xs text-text-sub hover:text-text-main rounded-lg border border-border-subtle hover:bg-surface-card-hover"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isCreatingSupplier}
                  className="px-4 py-2 bg-brand hover:bg-brand-hover text-white text-xs font-medium rounded-lg flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  {isCreatingSupplier ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Đang lưu...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Lưu nhà cung cấp</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
