"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useStoreProfile } from "@/lib/store";
import {
  api,
  Product,
  ProductVariant,
  WastageInput,
  InventoryReceipt,
} from "@/lib/api";
import { formatVND, formatQty } from "@/lib/design-tokens";
import {
  PageHeader,
  Badge,
  Button,
  LoadingState,
  AlertBanner,
  ConfirmDialog,
} from "@/components/common";
import { ReceiptDetailDrawer } from "@/components/inventory/ReceiptDetailDrawer";
import {
  Trash2,
  AlertTriangle,
  CalendarClock,
  Layers,
  Scale,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  DollarSign,
  ChevronDown,
  History,
  TrendingDown,
  FileText,
  Flame,
  WalletCards,
  Info,
  Calendar,
  X,
  Plus,
  ArrowLeft,
  RefreshCw,
  Eye,
  Search,
} from "lucide-react";

interface ExtendedBatch {
  id: string;
  batch_code: string;
  expiry_date?: string;
  remaining_qty?: number | string;
  unit_cost?: number | string;
}

interface FlatVariantItem {
  productId: string;
  productName: string;
  productCode: string;
  baseUom: string;
  isWeighable: boolean;
  trackBatches: boolean;
  variant: ProductVariant & { batches?: ExtendedBatch[] };
}

interface WastageHistoryItem {
  id: string;
  referenceId: string;
  productName: string;
  variantName: string;
  sku: string;
  lostQty: number;
  uom: string;
  unitCost: number;
  totalLoss: number;
  batchCode?: string;
  reasonCategory: string;
  reasonNote: string;
  recordedToCashbook: boolean;
  recordedAt: string;
}

const COMMON_REASONS = [
  "Cá ngộp/chết không kịp cấp đông",
  "Hư hỏng/Ô thiu",
  "Hết hạn sử dụng",
  "Đổ vỡ trong quá trình bán",
  "Mất mát/Kiểm kê thiếu",
  "Khác",
] as const;

const HIGH_LOSS_THRESHOLD = 500_000; // 500,000 VND warning threshold

export default function InventoryWastagePage() {
  const { isModuleEnabled } = useStoreProfile();

  // View Mode: LIST or CREATE
  const [viewMode, setViewMode] = useState<"LIST" | "CREATE">("LIST");
  const [receipts, setReceipts] = useState<InventoryReceipt[]>([]);
  const [isLoadingReceipts, setIsLoadingReceipts] = useState(true);
  const [receiptSearchTerm, setReceiptSearchTerm] = useState("");
  const [activeDrawerRef, setActiveDrawerRef] = useState<string | null>(null);

  // Master Data State
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Form State
  const [selectedVariantId, setSelectedVariantId] = useState<string>("");
  const [selectedBatchId, setSelectedBatchId] = useState<string>("");
  const [customBatchCode, setCustomBatchCode] = useState<string>("");
  const [lostQty, setLostQty] = useState<string>("");
  const [reasonCategory, setReasonCategory] = useState<string>(COMMON_REASONS[0]);
  const [reasonNote, setReasonNote] = useState<string>("");
  const [recordToCashbook, setRecordToCashbook] = useState<boolean>(true);
  const [referenceId, setReferenceId] = useState<string>(() => {
    const today = new Date().toISOString().slice(2, 10).replace(/-/g, "");
    const random = Math.floor(1000 + Math.random() * 9000);
    return `WST-${today}-${random}`;
  });

  // Action & Modal State
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [showHighLossModal, setShowHighLossModal] = useState<boolean>(false);

  // History State
  const [wastageHistory, setWastageHistory] = useState<WastageHistoryItem[]>([
    {
      id: "hist-001",
      referenceId: "WST-261015-1024",
      productName: "Cá Diêu Hồng Sống",
      variantName: "Loại 1 (0.8 - 1.2kg)",
      sku: "CA_DIEU_HONG_L1",
      lostQty: 3.5,
      uom: "kg",
      unitCost: 55000,
      totalLoss: 192500,
      batchCode: "LOT-20261015-01",
      reasonCategory: "Cá ngộp/chết không kịp cấp đông",
      reasonNote: "Cá ngộp sau khi sục oxy hỏng lúc 6h sáng, đã loại bỏ",
      recordedToCashbook: true,
      recordedAt: "2026-10-15 08:30",
    },
    {
      id: "hist-002",
      referenceId: "WST-261014-4412",
      productName: "Sữa Tươi Tiệt Trùng 1L",
      variantName: "Nguyên kem",
      sku: "SUA_TUOI_1L",
      lostQty: 4,
      uom: "hộp",
      unitCost: 32000,
      totalLoss: 128000,
      batchCode: "LOT-20260901-08",
      reasonCategory: "Hết hạn sử dụng",
      reasonNote: "Quá hạn sử dụng theo lô nhập tháng 9",
      recordedToCashbook: true,
      recordedAt: "2026-10-14 17:15",
    },
    {
      id: "hist-003",
      referenceId: "WST-261012-7890",
      productName: "Nước Mắm Cốt Cá Cơm",
      variantName: "Chai thủy tinh 500ml",
      sku: "NUOC_MAM_500ML",
      lostQty: 2,
      uom: "chai",
      unitCost: 68000,
      totalLoss: 136000,
      batchCode: "LOT-20261005-03",
      reasonCategory: "Đổ vỡ trong quá trình bán",
      reasonNote: "Rơi vỡ khi sắp xếp quầy kệ trưng bày",
      recordedToCashbook: false,
      recordedAt: "2026-10-12 11:20",
    },
  ]);

  // Load products data
  const loadProducts = async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const data = await api.getProducts();
      setProducts(data || []);
    } catch (err: any) {
      setFetchError(err.message || "Không thể tải danh sách sản phẩm");
    } finally {
      setIsLoading(false);
    }
  };

  const loadReceipts = async () => {
    setIsLoadingReceipts(true);
    try {
      const data = await api.getReceipts({ type: "WASTAGE" });
      setReceipts(data || []);
    } catch (err: any) {
      console.error("Lỗi tải danh sách phiếu xuất hủy:", err);
    } finally {
      setIsLoadingReceipts(false);
    }
  };

  useEffect(() => {
    loadProducts();
    loadReceipts();
  }, []);

  const filteredReceipts = useMemo(() => {
    if (!receiptSearchTerm.trim()) return receipts;
    const term = receiptSearchTerm.toLowerCase();
    return receipts.filter(
      (r) =>
        r.reference_id.toLowerCase().includes(term) ||
        (r.notes && r.notes.toLowerCase().includes(term))
    );
  }, [receipts, receiptSearchTerm]);

  // Flatten variants for dropdown
  const flatVariants = useMemo<FlatVariantItem[]>(() => {
    const list: FlatVariantItem[] = [];
    products.forEach((p) => {
      if (p.variants && p.variants.length > 0) {
        p.variants.forEach((v) => {
          list.push({
            productId: p.id,
            productName: p.name,
            productCode: p.code,
            baseUom: p.base_uom,
            isWeighable: p.is_weighable,
            trackBatches: p.track_batches,
            variant: v,
          });
        });
      }
    });
    return list;
  }, [products]);

  // Selected item metadata
  const selectedItem = useMemo(() => {
    return flatVariants.find((fv) => fv.variant.id === selectedVariantId);
  }, [flatVariants, selectedVariantId]);

  // Stock and Cost calculations
  const currentStock = useMemo(() => {
    if (!selectedItem) return 0;
    return Number(selectedItem.variant.current_stock || 0);
  }, [selectedItem]);

  const currentWAC = useMemo(() => {
    if (!selectedItem) return 0;
    return Number(selectedItem.variant.cost_price || 0);
  }, [selectedItem]);

  const parsedQty = useMemo(() => {
    const q = parseFloat(lostQty);
    return isNaN(q) ? 0 : Math.max(0, q);
  }, [lostQty]);

  // Wastage Expense Calculation: Lost Qty * WAC
  const totalWastageExpense = useMemo(() => {
    return parsedQty * currentWAC;
  }, [parsedQty, currentWAC]);

  // Batch Tracking Active Check
  const isBatchTracked = useMemo(() => {
    if (!selectedItem) return false;
    return Boolean(selectedItem.trackBatches || isModuleEnabled("batch_expiry"));
  }, [selectedItem, isModuleEnabled]);

  // Available batches for selected variant
  const availableBatches = useMemo(() => {
    if (!selectedItem || !selectedItem.variant.batches) return [];
    return selectedItem.variant.batches;
  }, [selectedItem]);

  // Reset batch selections when variant changes
  useEffect(() => {
    setSelectedBatchId("");
    setCustomBatchCode("");
  }, [selectedVariantId]);

  // Summary statistics
  const summaryStats = useMemo(() => {
    const totalLossValue = wastageHistory.reduce((sum, item) => sum + item.totalLoss, 0);
    const totalRecords = wastageHistory.length;
    const cashbookCount = wastageHistory.filter((i) => i.recordedToCashbook).length;
    return {
      totalLossValue,
      totalRecords,
      cashbookCount,
    };
  }, [wastageHistory]);

  // Reset form handler
  const handleResetForm = () => {
    const today = new Date().toISOString().slice(2, 10).replace(/-/g, "");
    const random = Math.floor(1000 + Math.random() * 9000);
    setReferenceId(`WST-${today}-${random}`);
    setSelectedVariantId("");
    setSelectedBatchId("");
    setCustomBatchCode("");
    setLostQty("");
    setReasonCategory(COMMON_REASONS[0]);
    setReasonNote("");
    setRecordToCashbook(true);
    setSubmitError(null);
    setSubmitSuccess(null);
  };

  // Submit button clicked
  const handleInitiateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(null);

    if (!selectedVariantId) {
      setSubmitError("Vui lòng chọn sản phẩm cần ghi nhận xuất hủy.");
      return;
    }

    if (parsedQty <= 0) {
      setSubmitError("Số lượng xuất hủy phải lớn hơn 0.");
      return;
    }

    // Check if large loss warrants confirmation modal
    if (totalWastageExpense >= HIGH_LOSS_THRESHOLD) {
      setShowHighLossModal(true);
      return;
    }

    // Otherwise, perform direct execution
    executeWastageRecording();
  };

  // Execute API recordWastage
  const executeWastageRecording = async () => {
    if (!selectedItem) return;

    setIsSubmitting(true);
    setSubmitError(null);
    setShowHighLossModal(false);

    try {
      const fullReason = reasonNote.trim()
        ? `[${reasonCategory}] ${reasonNote.trim()}`
        : reasonCategory;

      const payload: WastageInput = {
        variant_id: selectedVariantId,
        batch_id: selectedBatchId || undefined,
        lost_qty: parsedQty,
        input_uom: selectedItem.baseUom,
        reason_note: fullReason,
        record_to_cashbook: recordToCashbook,
        reference_id: referenceId.trim() || undefined,
      };

      await api.recordWastage(payload);

      // Successfully recorded, update local stock and history
      const nowStr = new Date().toISOString().replace("T", " ").substring(0, 16);
      const newHistoryItem: WastageHistoryItem = {
        id: `wst-${Date.now()}`,
        referenceId: referenceId.trim(),
        productName: selectedItem.productName,
        variantName: selectedItem.variant.variant_name || "Tiêu chuẩn",
        sku: selectedItem.variant.sku,
        lostQty: parsedQty,
        uom: selectedItem.baseUom,
        unitCost: currentWAC,
        totalLoss: totalWastageExpense,
        batchCode: selectedBatchId
          ? availableBatches.find((b) => b.id === selectedBatchId)?.batch_code
          : customBatchCode.trim() || undefined,
        reasonCategory,
        reasonNote: reasonNote.trim(),
        recordedToCashbook: recordToCashbook,
        recordedAt: nowStr,
      };

      setWastageHistory((prev) => [newHistoryItem, ...prev]);

      // Decrement stock in local state
      setProducts((prev) =>
        prev.map((p) => {
          if (p.id !== selectedItem.productId) return p;
          return {
            ...p,
            variants: p.variants?.map((v) => {
              if (v.id !== selectedVariantId) return v;
              const currentSt = Number(v.current_stock || 0);
              return {
                ...v,
                current_stock: Math.max(0, currentSt - parsedQty),
              };
            }),
          };
        })
      );

      setSubmitSuccess(
        `Đã ghi nhận xuất hủy thành công cho "${selectedItem.productName}" (${formatQty(
          parsedQty,
          selectedItem.baseUom
        )}). Giá trị tổn thất: ${formatVND(totalWastageExpense)}.`
      );

      handleResetForm();
      await loadReceipts();
      setViewMode("LIST");
    } catch (err: any) {
      setSubmitError(err.message || "Lỗi khi thực hiện ghi nhận hao hụt.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (viewMode === "LIST") {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        <PageHeader
          backHref="/products"
          title="Phiếu Xuất Hủy & Hao Hụt"
          description="Lịch sử chứng từ xuất hủy, hư hỏng, hết hạn và hạch toán chi phí sổ quỹ P&L."
          actions={
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                handleResetForm();
                setViewMode("CREATE");
              }}
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              <span>Tạo phiếu xuất hủy</span>
            </Button>
          }
          badge={
            <Badge variant="outflow">
              <Trash2 className="w-3.5 h-3.5 mr-1" />
              {receipts.length} chứng từ
            </Badge>
          }
        />

        {submitSuccess && (
          <AlertBanner
            type="success"
            message={submitSuccess}
            onClose={() => setSubmitSuccess(null)}
          />
        )}

        {/* Search & Toolbar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-surface-card p-3 rounded-lg border border-border-default shadow-xs">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-text-sub absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm theo mã chứng từ, lý do..."
              value={receiptSearchTerm}
              onChange={(e) => setReceiptSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-surface-app border border-border-default rounded-sm text-text-main focus:outline-none focus:border-brand font-medium placeholder:text-text-sub"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              variant="secondary"
              size="sm"
              onClick={loadReceipts}
              disabled={isLoadingReceipts}
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoadingReceipts ? "animate-spin" : ""}`} />
              <span>Làm mới</span>
            </Button>
          </div>
        </div>

        {/* Table */}
        {isLoadingReceipts ? (
          <LoadingState
            message="Đang tải danh sách phiếu xuất hủy..."
            submessage="Truy vấn sổ cái kho hàng"
          />
        ) : filteredReceipts.length === 0 ? (
          <div className="p-12 text-center bg-surface-card border border-dashed border-border-default rounded-xl space-y-3">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-text-main">
              {receiptSearchTerm ? "Không tìm thấy phiếu xuất hủy phù hợp" : "Chưa có phiếu xuất hủy nào"}
            </h3>
            <p className="text-xs text-text-sub max-w-sm mx-auto">
              {receiptSearchTerm
                ? "Thử thay đổi từ khóa tìm kiếm mã chứng từ hoặc lý do."
                : "Tất cả các đợt bóc tách chi phí mất mát do cá ngộp, hư hỏng, cận date sẽ hiển thị tại đây."}
            </p>
            {!receiptSearchTerm && (
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  handleResetForm();
                  setViewMode("CREATE");
                }}
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                <span>Lập phiếu xuất hủy đầu tiên</span>
              </Button>
            )}
          </div>
        ) : (
          <div className="bg-surface-card rounded-lg border border-border-default overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-surface-app text-text-sub font-semibold border-b border-border-default">
                  <tr>
                    <th className="py-3 px-3 text-left">Mã chứng từ</th>
                    <th className="py-3 px-3 text-left">Thời gian xuất</th>
                    <th className="py-3 px-3 text-right">Số mặt hàng</th>
                    <th className="py-3 px-3 text-right">Tổng thiệt hại vốn</th>
                    <th className="py-3 px-3 text-left">Lý do & Ghi chú</th>
                    <th className="py-3 px-3 text-center w-28">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-default bg-surface-card">
                  {filteredReceipts.map((r) => (
                    <tr
                      key={r.reference_id}
                      onClick={() => setActiveDrawerRef(r.reference_id)}
                      className="hover:bg-surface-app/60 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-3">
                        <span className="font-mono font-bold text-rose-600 hover:underline">
                          {r.reference_id}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-text-sub whitespace-nowrap">
                        {new Date(r.created_at).toLocaleString("vi-VN")}
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums">
                        <Badge variant="default">{r.item_count} món</Badge>
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold tabular-nums text-rose-600">
                        {formatVND(Number(r.total_amount || 0))}
                      </td>
                      <td className="py-3 px-3 text-text-sub max-w-sm truncate" title={r.notes || ""}>
                        {r.notes || <span className="text-text-disabled">-</span>}
                      </td>
                      <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setActiveDrawerRef(r.reference_id)}
                          className="h-7 text-xs"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1 text-text-sub" />
                          <span>Chi tiết</span>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <ReceiptDetailDrawer
          isOpen={Boolean(activeDrawerRef)}
          referenceId={activeDrawerRef}
          onClose={() => setActiveDrawerRef(null)}
        />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between pb-1">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setViewMode("LIST")}
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
          <span>Danh sách phiếu xuất hủy</span>
        </Button>
      </div>

      {/* Top Header */}
      <PageHeader
        backHref="/products"
        title="Ghi Nhận Hao Hụt & Xuất Hủy"
        description="Bóc tách chi phí mất mát do hư hỏng, cá chết, hết hạn sử dụng nhằm tính đúng Lãi/Lỗ thực tế."
        badge={
          <div className="flex flex-wrap items-center gap-1.5">
            {isModuleEnabled("batch_expiry") && (
              <Badge variant="alert">
                <CalendarClock className="w-3.5 h-3.5 mr-1" />
                Lô & HSD
              </Badge>
            )}
            {isModuleEnabled("catch_weight") && (
              <Badge variant="catchweight">
                <Scale className="w-3.5 h-3.5 mr-1" />
                Cân ký
              </Badge>
            )}
            {isModuleEnabled("credit_ledger") && (
              <Badge variant="bom">
                <WalletCards className="w-3.5 h-3.5 mr-1" />
                Sổ quỹ nội bộ
              </Badge>
            )}
          </div>
        }
      />

      {/* Notifications */}
      {submitSuccess && (
        <AlertBanner
          type="success"
          message={submitSuccess}
          onClose={() => setSubmitSuccess(null)}
        />
      )}

      {submitError && (
        <AlertBanner
          type="error"
          message={submitError}
          onClose={() => setSubmitError(null)}
        />
      )}

      {/* =========================================================================
          TOP STATS SUMMARY TILES
      ========================================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-surface-card p-4 rounded-xl border border-border-subtle shadow-card flex items-center justify-between">
          <div>
            <span className="text-xs text-text-sub font-medium">
              Tổng giá trị tổn thất vốn
            </span>
            <div className="text-xl font-bold font-mono text-rose-600 mt-1">
              {formatVND(summaryStats.totalLossValue)}
            </div>
            <span className="text-[10px] text-text-disabled">
              Chi phí hao hụt & hủy hàng ghi nhận
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
            <TrendingDown className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-surface-card p-4 rounded-xl border border-border-subtle shadow-card flex items-center justify-between">
          <div>
            <span className="text-xs text-text-sub font-medium">
              Tổng số lượt xuất hủy
            </span>
            <div className="text-xl font-bold font-mono text-text-main mt-1">
              {summaryStats.totalRecords} lượt
            </div>
            <span className="text-[10px] text-text-disabled">
              Đã bóc tách qua phiếu điều chỉnh
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
            <Flame className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-surface-card p-4 rounded-xl border border-border-subtle shadow-card flex items-center justify-between">
          <div>
            <span className="text-xs text-text-sub font-medium">
              Hạch toán vào Sổ quỹ
            </span>
            <div className="text-xl font-bold font-mono text-indigo-600 mt-1">
              {summaryStats.cashbookCount} phiếu chi
            </div>
            <span className="text-[10px] text-text-disabled">
              Trừ trực tiếp vào Lợi nhuận thuần
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="p-12 text-center bg-surface-card rounded-xl border border-border-subtle shadow-card flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 text-brand animate-spin mb-3" />
          <span className="text-sm text-text-sub">
            Đang tải danh sách hàng hóa và dữ liệu tồn kho...
          </span>
        </div>
      ) : fetchError ? (
        <div className="p-6 bg-rose-50 border border-rose-200 rounded-xl text-center">
          <p className="text-sm text-rose-700 font-medium mb-3">{fetchError}</p>
          <button
            onClick={loadProducts}
            className="px-4 py-2 bg-rose-600 text-white text-xs rounded-lg font-medium hover:bg-rose-700 inline-flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Thử tải lại
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* =========================================================================
              FORM GHI NHẬN HAO HỤT / XUẤT HỦY (LEFT COLUMN: 7 COLS)
          ========================================================================== */}
          <div className="lg:col-span-7 space-y-6">
            <form
              onSubmit={handleInitiateSubmit}
              className="bg-surface-card rounded-xl border border-border-subtle p-5 shadow-card space-y-5"
            >
              <div className="flex items-center justify-between border-b border-border-subtle pb-3">
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-rose-600" />
                  <h2 className="text-sm font-semibold text-text-main">
                    Phiếu Khai Báo Hao Hụt & Xuất Hủy
                  </h2>
                </div>
                <span className="text-xs text-text-sub font-mono">
                  Mã: {referenceId}
                </span>
              </div>

              {/* 1. Chọn Sản phẩm & Biến thể */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-main flex items-center justify-between">
                  <span>
                    Sản phẩm & Biến thể cần hủy <span className="text-rose-500">*</span>
                  </span>
                  {selectedItem && (
                    <span className="text-[11px] font-mono text-brand">
                      Mã: {selectedItem.variant.sku}
                    </span>
                  )}
                </label>
                <div className="relative">
                  <select
                    value={selectedVariantId}
                    onChange={(e) => setSelectedVariantId(e.target.value)}
                    className="w-full text-xs px-3 py-2.5 bg-surface-app border border-border-default rounded-lg focus:outline-none focus:border-brand text-text-main appearance-none pr-8 cursor-pointer"
                  >
                    <option value="">-- Chọn sản phẩm hư hỏng / quá hạn --</option>
                    {flatVariants.map(({ productId, productName, baseUom, variant }) => {
                      const stock = Number(variant.current_stock || 0);
                      const cost = Number(variant.cost_price || 0);
                      return (
                        <option key={variant.id} value={variant.id}>
                          [{variant.sku}] {productName} {variant.variant_name ? `- ${variant.variant_name}` : ""} (Tồn: {formatQty(stock, baseUom)} | Vốn WAC: {formatVND(cost)})
                        </option>
                      );
                    })}
                  </select>
                  <ChevronDown className="w-4 h-4 text-text-sub absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* Display Stock & WAC Card if Selected */}
              {selectedItem && (
                <div className="grid grid-cols-2 gap-3 p-3 bg-surface-muted/60 border border-border-subtle rounded-xl text-xs">
                  <div>
                    <span className="text-text-sub text-[11px] block">Tồn kho khả dụng:</span>
                    <div className="font-bold text-text-main font-mono text-sm mt-0.5">
                      {formatQty(currentStock, selectedItem.baseUom)}
                    </div>
                  </div>
                  <div>
                    <span className="text-text-sub text-[11px] block">Giá vốn WAC hiện tại:</span>
                    <div className="font-bold text-text-main font-mono text-sm mt-0.5">
                      {formatVND(currentWAC)} / {selectedItem.baseUom}
                    </div>
                  </div>
                </div>
              )}

              {/* 2. Chọn Lô Hàng (Nếu sản phẩm theo dõi lô) */}
              {selectedItem && isBatchTracked && (
                <div className="space-y-1.5 p-3.5 bg-amber-50/50 border border-amber-200/70 rounded-xl">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-amber-900 flex items-center gap-1.5">
                      <CalendarClock className="w-3.5 h-3.5 text-amber-600" />
                      Lô hàng & Hạn sử dụng liên quan
                    </label>
                    <span className="text-[10px] text-amber-700 bg-amber-100/70 px-1.5 py-0.5 rounded">
                      Batch Tracking Active
                    </span>
                  </div>

                  {availableBatches.length > 0 ? (
                    <div className="space-y-1.5 mt-2">
                      <select
                        value={selectedBatchId}
                        onChange={(e) => setSelectedBatchId(e.target.value)}
                        className="w-full text-xs px-3 py-2 bg-white border border-amber-300 rounded-lg focus:outline-none focus:border-amber-500 text-text-main"
                      >
                        <option value="">-- Xuất hủy từ kho chung (Không gắn lô) --</option>
                        {availableBatches.map((b) => (
                          <option key={b.id} value={b.id}>
                            Lô: {b.batch_code} {b.expiry_date ? `| HSD: ${b.expiry_date.slice(0, 10)}` : ""} | Còn lại: {formatQty(b.remaining_qty, selectedItem.baseUom)}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="space-y-2 mt-2">
                      <p className="text-[11px] text-amber-800">
                        Chưa có lô chi tiết từ PO. Bạn có thể nhập mã lô trên bao bì để tiện tra soát:
                      </p>
                      <input
                        type="text"
                        value={customBatchCode}
                        onChange={(e) => setCustomBatchCode(e.target.value)}
                        placeholder="Ví dụ: LOT-20261016-01"
                        className="w-full text-xs px-3 py-2 bg-white border border-amber-300 rounded-lg focus:outline-none focus:border-amber-500 text-text-main font-mono"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* 3. Số lượng hủy & Đơn vị tính */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-text-main flex items-center justify-between">
                    <span>
                      Số lượng xuất hủy <span className="text-rose-500">*</span>
                    </span>
                    <span className="text-[11px] text-text-sub font-mono">
                      (Cho phép số lẻ: 2.5, 0.75)
                    </span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      min="0.001"
                      placeholder="0.0"
                      value={lostQty}
                      onChange={(e) => setLostQty(e.target.value)}
                      className="w-full text-xs px-3 py-2.5 bg-surface-app border border-border-default rounded-lg focus:outline-none focus:border-brand text-text-main font-mono font-medium"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-text-sub">
                      {selectedItem?.baseUom || "ĐVT"}
                    </span>
                  </div>

                  {/* Warning if loss qty exceeds available stock */}
                  {selectedItem && parsedQty > currentStock && (
                    <div className="flex items-center gap-1.5 text-[11px] text-amber-700 mt-1">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>Số lượng hủy ({parsedQty}) vượt tồn khả dụng ({currentStock}). Tồn kho sẽ chuyển về âm nếu xác nhận.</span>
                    </div>
                  )}
                </div>

                {/* Đơn vị tính chuẩn Base UOM */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-text-main">
                    Đơn vị tính chuẩn
                  </label>
                  <input
                    type="text"
                    disabled
                    value={selectedItem ? `${selectedItem.baseUom} (Base UOM)` : "Chưa chọn sản phẩm"}
                    className="w-full text-xs px-3 py-2.5 bg-surface-muted border border-border-subtle rounded-lg text-text-sub cursor-not-allowed font-medium"
                  />
                </div>
              </div>

              {/* 4. Lý do xuất hủy */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-main">
                  Lý do xuất hủy <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <select
                    value={reasonCategory}
                    onChange={(e) => setReasonCategory(e.target.value)}
                    className="w-full text-xs px-3 py-2.5 bg-surface-app border border-border-default rounded-lg focus:outline-none focus:border-brand text-text-main appearance-none pr-8 cursor-pointer"
                  >
                    {COMMON_REASONS.map((reason) => (
                      <option key={reason} value={reason}>
                        {reason}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-text-sub absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* 5. Ghi chú chi tiết lý do */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-main">
                  Ghi chú chi tiết nguyên nhân
                </label>
                <textarea
                  rows={2}
                  value={reasonNote}
                  onChange={(e) => setReasonNote(e.target.value)}
                  placeholder="Ghi rõ tình trạng: ví dụ 'Bể kính hồ cá rò nước', 'Mốc xanh góc bao bì', 'Cá ngộp do mất điện lúc rạng sáng'..."
                  className="w-full text-xs p-3 bg-surface-app border border-border-default rounded-lg focus:outline-none focus:border-brand text-text-main resize-none"
                />
              </div>

              {/* 6. Checkbox Hạch toán vào Sổ quỹ nội bộ */}
              <div className="p-3.5 bg-surface-muted/60 border border-border-subtle rounded-xl flex items-start gap-3">
                <input
                  id="recordToCashbookCheckbox"
                  type="checkbox"
                  checked={recordToCashbook}
                  onChange={(e) => setRecordToCashbook(e.target.checked)}
                  className="mt-0.5 w-4 h-4 text-brand rounded border-border-default focus:ring-brand cursor-pointer"
                />
                <label
                  htmlFor="recordToCashbookCheckbox"
                  className="text-xs text-text-main cursor-pointer select-none space-y-0.5"
                >
                  <span className="font-semibold block text-text-main">
                    Hạch toán chi phí vào Sổ quỹ nội bộ
                  </span>
                  <span className="text-[11px] text-text-sub block leading-relaxed">
                    Tự động tạo phiếu chi chi phí bất thường (OUTFLOW - OTHER_EXPENSE) nhằm phản ánh đúng dòng tiền và trừ vào Lợi nhuận thuần thực tế.
                  </span>
                </label>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border-subtle">
                <button
                  type="button"
                  onClick={handleResetForm}
                  disabled={isSubmitting}
                  className="px-4 py-2.5 text-xs text-text-sub hover:text-text-main hover:bg-surface-card-hover rounded-lg border border-border-subtle transition-colors flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Làm mới
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !selectedVariantId || parsedQty <= 0}
                  className="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Đang ghi nhận hủy hàng...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      <span>Xác nhận Xuất Hủy</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* =========================================================================
              REAL-TIME LOSS CALCULATION PREVIEW (RIGHT COLUMN: 5 COLS)
          ========================================================================== */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-surface-card rounded-xl border border-border-subtle p-5 shadow-card space-y-5">
              <div className="flex items-center gap-2 border-b border-border-subtle pb-3">
                <TrendingDown className="w-4 h-4 text-rose-600" />
                <h3 className="text-sm font-semibold text-text-main">
                  Ước Tính Tổn Thất Vốn Tức Thì
                </h3>
              </div>

              {/* Total Wastage Expense Display */}
              <div className="p-4 bg-rose-50/70 border border-rose-200/80 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-rose-800 font-semibold uppercase tracking-wider">
                    Tổng Giá Trị Tổn Thất Vốn (Wastage Expense)
                  </span>
                  <Flame className="w-4 h-4 text-rose-600" />
                </div>

                <div className="text-2xl sm:text-3xl font-bold font-mono text-rose-600">
                  {formatVND(totalWastageExpense)}
                </div>

                {/* Mathematical Formula Preview */}
                <div className="p-2.5 bg-white/80 rounded-lg border border-rose-200 text-xs text-rose-950 font-mono space-y-1">
                  <div className="flex justify-between">
                    <span>Số lượng hủy:</span>
                    <span className="font-semibold">
                      {formatQty(parsedQty, selectedItem?.baseUom)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Đơn giá vốn WAC:</span>
                    <span className="font-semibold">
                      {formatVND(currentWAC)}
                    </span>
                  </div>
                  <div className="border-t border-rose-200 pt-1 flex justify-between font-bold text-rose-700">
                    <span>Tổn thất = Qty × WAC:</span>
                    <span>{formatVND(totalWastageExpense)}</span>
                  </div>
                </div>

                {totalWastageExpense >= HIGH_LOSS_THRESHOLD && (
                  <div className="flex items-center gap-2 p-2 bg-rose-100/80 border border-rose-300 rounded-lg text-rose-900 text-[11px] font-medium">
                    <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0" />
                    <span>Mức thiệt hại lớn (&gt; {formatVND(HIGH_LOSS_THRESHOLD)}). Hệ thống sẽ yêu cầu xác nhận lần hai trước khi xuất hủy.</span>
                  </div>
                )}
              </div>

              {/* Inventory Impact Overview */}
              <div className="space-y-3 text-xs">
                <h4 className="font-semibold text-text-main text-xs flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-text-sub" />
                  Biến Động Thẻ Kho Dự Tính
                </h4>

                <div className="space-y-2 p-3 bg-surface-muted/60 border border-border-subtle rounded-xl">
                  <div className="flex justify-between text-text-sub">
                    <span>Mặt hàng:</span>
                    <span className="font-medium text-text-main truncate max-w-[200px]">
                      {selectedItem?.productName || "Chưa chọn"}
                    </span>
                  </div>

                  <div className="flex justify-between text-text-sub">
                    <span>Tồn kho hiện tại:</span>
                    <span className="font-mono text-text-main font-semibold">
                      {formatQty(currentStock, selectedItem?.baseUom)}
                    </span>
                  </div>

                  <div className="flex justify-between text-text-sub">
                    <span>Số lượng xuất hủy:</span>
                    <span className="font-mono text-rose-600 font-semibold">
                      -{formatQty(parsedQty, selectedItem?.baseUom)}
                    </span>
                  </div>

                  <div className="border-t border-border-subtle pt-1.5 flex justify-between text-text-main font-bold">
                    <span>Tồn sau xuất hủy:</span>
                    <span className="font-mono text-brand">
                      {formatQty(Math.max(0, currentStock - parsedQty), selectedItem?.baseUom)}
                    </span>
                  </div>
                </div>

                {/* Cashbook Accounting Note */}
                <div className="p-3 bg-surface-muted/40 border border-border-subtle rounded-xl text-[11px] space-y-1 text-text-sub">
                  <div className="flex items-center gap-1.5 font-semibold text-text-main">
                    <Info className="w-3.5 h-3.5 text-brand" />
                    <span>Nguyên lý Kế toán Quản trị:</span>
                  </div>
                  <p className="leading-relaxed">
                    Hàng hóa xuất hủy sẽ tạo bút toán <strong>WASTAGE_SPOILAGE</strong> trong sổ kho, đồng thời tự động ghi nhận phiếu chi <strong>OTHER_EXPENSE</strong> vào sổ quỹ nếu được bật, giúp báo cáo Kết quả kinh doanh (P&L) không bị thổi phồng lợi nhuận.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          HIGH LOSS CONFIRMATION MODAL
      ========================================================================== */}
      {showHighLossModal && selectedItem && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface-card rounded-xl border border-rose-200 shadow-dropdown w-full max-w-md p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <div className="flex items-center gap-2 text-rose-600 font-semibold text-sm">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
                <span>Cảnh Báo Tổn Thất Giá Trị Lớn</span>
              </div>
              <button
                type="button"
                onClick={() => setShowHighLossModal(false)}
                className="text-text-sub hover:text-text-main p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-text-main leading-relaxed">
                Bạn đang chuẩn bị xuất hủy một lượng hàng có tổng giá trị tổn thất vốn vượt mức cảnh báo thông thường:
              </p>

              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl space-y-2">
                <div className="flex justify-between text-text-sub">
                  <span>Mặt hàng:</span>
                  <span className="font-semibold text-text-main">
                    {selectedItem.productName}
                  </span>
                </div>
                <div className="flex justify-between text-text-sub">
                  <span>Số lượng xuất hủy:</span>
                  <span className="font-bold text-rose-700 font-mono">
                    {formatQty(parsedQty, selectedItem.baseUom)}
                  </span>
                </div>
                <div className="flex justify-between text-text-sub">
                  <span>Giá vốn WAC:</span>
                  <span className="font-mono text-text-main">
                    {formatVND(currentWAC)}
                  </span>
                </div>
                <div className="border-t border-rose-200 pt-2 flex justify-between items-baseline">
                  <span className="font-bold text-rose-900">Tổng thiệt hại vốn:</span>
                  <span className="text-xl font-bold font-mono text-rose-600">
                    {formatVND(totalWastageExpense)}
                  </span>
                </div>
              </div>

              {recordToCashbook && (
                <div className="p-2.5 bg-indigo-50 border border-indigo-200 rounded-lg text-indigo-900 text-[11px] flex items-start gap-2">
                  <Info className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
                  <span>
                    Phiếu chi sổ quỹ <strong>{formatVND(totalWastageExpense)}</strong> sẽ được tự động ghi nhận ngay sau khi bạn bấm xác nhận.
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border-subtle">
              <button
                type="button"
                onClick={() => setShowHighLossModal(false)}
                className="px-3.5 py-2 text-xs text-text-sub hover:text-text-main rounded-lg border border-border-subtle hover:bg-surface-card-hover"
              >
                Hủy bỏ & Kiểm tra lại
              </button>
              <button
                type="button"
                onClick={executeWastageRecording}
                disabled={isSubmitting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Đang xử lý...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Đồng ý Xuất Hủy</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <ReceiptDetailDrawer
        isOpen={Boolean(activeDrawerRef)}
        referenceId={activeDrawerRef}
        onClose={() => setActiveDrawerRef(null)}
      />
    </div>
  );
}
