"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  api,
  Warehouse,
  Product,
  ProductVariant,
  StockTransfer,
  CreateTransferInput,
} from "@/lib/api";
import { formatQty } from "@/lib/design-tokens";
import {
  PageHeader,
  Badge,
  Button,
  LoadingState,
  AlertBanner,
  Modal,
} from "@/components/common";
import {
  ArrowRightLeft,
  Plus,
  Trash2,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  Warehouse as WarehouseIcon,
  Eye,
  ArrowLeft,
  Send,
  Boxes,
} from "lucide-react";

interface TransferRowItem {
  rowId: string;
  variantId: string;
  productId: string;
  productName: string;
  variantName: string;
  sku: string;
  baseUom: string;
  qty: number;
}

export default function StockTransfersPage() {
  const [viewMode, setViewMode] = useState<"LIST" | "CREATE">("LIST");
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTransfer, setSelectedTransfer] = useState<StockTransfer | null>(null);

  // Form State
  const [fromWarehouseId, setFromWarehouseId] = useState("");
  const [toWarehouseId, setToWarehouseId] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<TransferRowItem[]>([]);
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [transfersData, whData, prodsData] = await Promise.all([
        api.getTransfers().catch(() => []),
        api.getWarehouses(true).catch(() => []),
        api.getProducts().catch(() => []),
      ]);
      setTransfers(transfersData || []);
      setWarehouses(whData || []);
      setProducts(prodsData || []);

      if (whData && whData.length >= 2) {
        setFromWarehouseId(whData[0].id);
        setToWarehouseId(whData[1].id);
      } else if (whData && whData.length === 1) {
        setFromWarehouseId(whData[0].id);
      }
    } catch (err: any) {
      console.error("Lỗi khi tải dữ liệu chuyển kho:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter transfers
  const filteredTransfers = useMemo(() => {
    if (!searchTerm.trim()) return transfers;
    const q = searchTerm.toLowerCase();
    return transfers.filter(
      (t) =>
        t.transfer_number.toLowerCase().includes(q) ||
        (t.from_warehouse?.name && t.from_warehouse.name.toLowerCase().includes(q)) ||
        (t.to_warehouse?.name && t.to_warehouse.name.toLowerCase().includes(q)) ||
        (t.notes && t.notes.toLowerCase().includes(q))
    );
  }, [transfers, searchTerm]);

  // Flat list of product variants for selection
  const flatVariants = useMemo(() => {
    const res: {
      productId: string;
      productName: string;
      variant: ProductVariant;
      baseUom: string;
    }[] = [];
    products.forEach((p) => {
      (p.variants || []).forEach((v) => {
        res.push({
          productId: p.id,
          productName: p.name,
          variant: v,
          baseUom: p.base_uom,
        });
      });
    });
    return res;
  }, [products]);

  // Add Item to Transfer
  const handleAddItem = () => {
    if (!selectedVariantId) return;
    const match = flatVariants.find((fv) => fv.variant.id === selectedVariantId);
    if (!match) return;

    if (items.some((it) => it.variantId === selectedVariantId)) {
      setFormError("Sản phẩm này đã có trong danh sách điều chuyển.");
      return;
    }

    setItems((prev) => [
      ...prev,
      {
        rowId: `row-${Date.now()}-${Math.random()}`,
        variantId: match.variant.id,
        productId: match.productId,
        productName: match.productName,
        variantName: match.variant.variant_name || match.productName,
        sku: match.variant.sku,
        baseUom: match.baseUom,
        qty: 1,
      },
    ]);
    setSelectedVariantId("");
    setFormError(null);
  };

  const handleUpdateItemQty = (rowId: string, qty: number) => {
    setItems((prev) =>
      prev.map((it) => (it.rowId === rowId ? { ...it, qty: Math.max(0.001, qty) } : it))
    );
  };

  const handleRemoveItem = (rowId: string) => {
    setItems((prev) => prev.filter((it) => it.rowId !== rowId));
  };

  const handleResetForm = () => {
    setItems([]);
    setNotes("");
    setFormError(null);
    setFormSuccess(null);
  };

  // Submit create transfer
  const handleSubmitTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!fromWarehouseId || !toWarehouseId) {
      setFormError("Vui lòng chọn cả Kho xuất và Kho nhận.");
      return;
    }

    if (fromWarehouseId === toWarehouseId) {
      setFormError("Kho xuất và Kho nhận không được trùng nhau.");
      return;
    }

    if (items.length === 0) {
      setFormError("Vui lòng chọn ít nhất một mặt hàng cần điều chuyển.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: CreateTransferInput = {
        from_warehouse_id: fromWarehouseId,
        to_warehouse_id: toWarehouseId,
        notes: notes.trim() || undefined,
        items: items.map((it) => ({
          variant_id: it.variantId,
          qty: Number(it.qty),
          uom: it.baseUom,
        })),
      };

      await api.createTransfer(payload);
      setFormSuccess("Tạo phiếu điều chuyển kho thành công!");
      await loadData();
      setTimeout(() => {
        handleResetForm();
        setViewMode("LIST");
      }, 1000);
    } catch (err: any) {
      setFormError(err.message || "Lỗi khi tạo phiếu điều chuyển");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Complete transfer
  const handleCompleteTransfer = async (transferId: string) => {
    setActionLoadingId(transferId);
    try {
      await api.completeTransfer(transferId);
      await loadData();
      if (selectedTransfer && selectedTransfer.id === transferId) {
        setSelectedTransfer(null);
      }
    } catch (err: any) {
      alert(err.message || "Lỗi khi hoàn tất chuyển kho");
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Page Header */}
      <PageHeader
        title="Điều Chuyển Kho Hàng"
        description="Quản lý luân chuyển hàng hóa giữa các kho chi nhánh, cân bằng tồn kho và bảo toàn giá trị vốn."
        actions={
          viewMode === "LIST" ? (
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                handleResetForm();
                setViewMode("CREATE");
              }}
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              <span>Tạo phiếu chuyển kho</span>
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setViewMode("LIST")}
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
              <span>Về danh sách</span>
            </Button>
          )
        }
      />

      {/* =========================================================================
          VIEW 1: DANH SÁCH PHIẾU ĐIỀU CHUYỂN
      ========================================================================= */}
      {viewMode === "LIST" && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-surface-card p-3.5 rounded-xl border border-border-default shadow-xs">
            <div className="relative w-full sm:w-96">
              <Search className="w-4 h-4 text-text-sub absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Tìm mã phiếu, tên kho chuyển, kho nhận..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-surface-app border border-border-default rounded-lg focus:outline-none focus:border-brand text-text-main"
              />
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={loadData}
              disabled={isLoading}
            >
              <RefreshCw
                className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? "animate-spin" : ""}`}
              />
              <span>Làm mới</span>
            </Button>
          </div>

          {/* Transfers Table */}
          {isLoading ? (
            <LoadingState
              message="Đang tải danh sách phiếu chuyển kho..."
              submessage="Truy vấn dữ liệu luân chuyển"
            />
          ) : filteredTransfers.length === 0 ? (
            <div className="p-12 text-center bg-surface-card border border-dashed border-border-default rounded-xl space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                <ArrowRightLeft className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-text-main">
                {searchTerm
                  ? "Không tìm thấy phiếu chuyển kho phù hợp"
                  : "Chưa có phiếu chuyển kho nào"}
              </h3>
              <p className="text-xs text-text-sub max-w-sm mx-auto">
                {searchTerm
                  ? "Thử tìm kiếm với từ khóa khác."
                  : "Tạo phiếu điều chuyển hàng hóa để phân bổ tồn kho giữa các chi nhánh."}
              </p>
              {!searchTerm && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    handleResetForm();
                    setViewMode("CREATE");
                  }}
                >
                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                  <span>Lập phiếu chuyển đầu tiên</span>
                </Button>
              )}
            </div>
          ) : (
            <div className="bg-surface-card rounded-xl border border-border-default overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-surface-app text-text-sub font-semibold border-b border-border-default">
                    <tr>
                      <th className="py-3 px-3.5 text-left">Mã phiếu</th>
                      <th className="py-3 px-3.5 text-left">Từ kho</th>
                      <th className="py-3 px-2 text-center w-8"></th>
                      <th className="py-3 px-3.5 text-left">Đến kho</th>
                      <th className="py-3 px-3.5 text-center">Trạng thái</th>
                      <th className="py-3 px-3.5 text-right">Số mặt hàng</th>
                      <th className="py-3 px-3.5 text-left">Thời gian tạo</th>
                      <th className="py-3 px-3.5 text-center w-36">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-default bg-surface-card">
                    {filteredTransfers.map((t) => {
                      const isComplete = t.status === "COMPLETED";
                      const isInTransit = t.status === "IN_TRANSIT";

                      return (
                        <tr
                          key={t.id}
                          className="hover:bg-surface-app/50 transition-colors cursor-pointer"
                          onClick={() => setSelectedTransfer(t)}
                        >
                          <td className="py-3 px-3.5 font-mono font-bold text-brand hover:underline">
                            {t.transfer_number}
                          </td>
                          <td className="py-3 px-3.5 font-medium text-text-main">
                            {t.from_warehouse?.name || "Kho xuất"}
                          </td>
                          <td className="py-3 px-2 text-center text-text-disabled">
                            <ArrowRight className="w-3.5 h-3.5 inline" />
                          </td>
                          <td className="py-3 px-3.5 font-medium text-text-main">
                            {t.to_warehouse?.name || "Kho nhận"}
                          </td>
                          <td className="py-3 px-3.5 text-center">
                            {isComplete ? (
                              <Badge variant="inflow">Đã hoàn thành</Badge>
                            ) : isInTransit ? (
                              <Badge variant="alert">Đang chuyển</Badge>
                            ) : (
                              <Badge variant="default">{t.status}</Badge>
                            )}
                          </td>
                          <td className="py-3 px-3.5 text-right font-mono tabular-nums text-text-main">
                            {(t.items || []).length} mặt hàng
                          </td>
                          <td className="py-3 px-3.5 text-text-sub whitespace-nowrap">
                            {new Date(t.created_at).toLocaleString("vi-VN")}
                          </td>
                          <td
                            className="py-3 px-3.5 text-center"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center justify-center gap-1.5">
                              {isInTransit && (
                                <button
                                  type="button"
                                  disabled={actionLoadingId === t.id}
                                  onClick={() => handleCompleteTransfer(t.id)}
                                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-md transition"
                                >
                                  {actionLoadingId === t.id ? (
                                    <RefreshCw className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  )}
                                  <span>Xác nhận nhận</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setSelectedTransfer(t)}
                                className="p-1 text-text-sub hover:text-brand rounded"
                                title="Xem chi tiết"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          VIEW 2: BIỂU MẪU TẠO PHIẾU CHUYỂN KHO (CREATE)
      ========================================================================= */}
      {viewMode === "CREATE" && (
        <form onSubmit={handleSubmitTransfer} className="space-y-6">
          {formError && (
            <AlertBanner
              type="error"
              message={formError}
              onClose={() => setFormError(null)}
            />
          )}

          {formSuccess && (
            <AlertBanner
              type="success"
              message={formSuccess}
              onClose={() => setFormSuccess(null)}
            />
          )}

          {/* Section 1: Thông tin kho luân chuyển */}
          <section className="bg-surface-card rounded-xl p-5 border border-border-default shadow-xs space-y-4">
            <h2 className="text-sm font-semibold text-text-main flex items-center gap-2 border-b border-border-subtle pb-3">
              <WarehouseIcon className="w-4 h-4 text-brand" />
              <span>1. Tuyến điều chuyển & Thông tin chung</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-text-main mb-1">
                  Từ kho xuất hàng <span className="text-rose-500">*</span>
                </label>
                <select
                  value={fromWarehouseId}
                  onChange={(e) => setFromWarehouseId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-surface-app border border-border-default rounded-lg focus:outline-none focus:border-brand text-text-main font-medium"
                >
                  <option value="">-- Chọn kho xuất --</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id} disabled={w.id === toWarehouseId}>
                      {w.name} {w.is_default ? "(Mặc định)" : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-main mb-1">
                  Đến kho nhận hàng <span className="text-rose-500">*</span>
                </label>
                <select
                  value={toWarehouseId}
                  onChange={(e) => setToWarehouseId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-surface-app border border-border-default rounded-lg focus:outline-none focus:border-brand text-text-main font-medium"
                >
                  <option value="">-- Chọn kho nhận --</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id} disabled={w.id === fromWarehouseId}>
                      {w.name} {w.is_default ? "(Mặc định)" : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2 md:col-span-1">
                <label className="block text-xs font-semibold text-text-main mb-1">
                  Ghi chú điều chuyển
                </label>
                <input
                  type="text"
                  placeholder="Lý do chuyển, số xe, nhân viên giao nhận..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-surface-app border border-border-default rounded-lg focus:outline-none focus:border-brand text-text-main"
                />
              </div>
            </div>
          </section>

          {/* Section 2: Mặt hàng luân chuyển */}
          <section className="bg-surface-card rounded-xl p-5 border border-border-default shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <h2 className="text-sm font-semibold text-text-main flex items-center gap-2">
                <Boxes className="w-4 h-4 text-brand" />
                <span>2. Danh mục mặt hàng chuyển kho ({items.length})</span>
              </h2>
            </div>

            {/* Selector */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <select
                  value={selectedVariantId}
                  onChange={(e) => setSelectedVariantId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-surface-app border border-border-default rounded-lg focus:outline-none focus:border-brand text-text-main"
                >
                  <option value="">-- Chọn sản phẩm cần chuyển kho --</option>
                  {flatVariants.map((fv) => (
                    <option key={fv.variant.id} value={fv.variant.id}>
                      [{fv.variant.sku}] {fv.productName}{" "}
                      {fv.variant.variant_name ? `- ${fv.variant.variant_name}` : ""} (
                      {fv.baseUom})
                    </option>
                  ))}
                </select>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleAddItem}
                disabled={!selectedVariantId}
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                <span>Thêm vào danh sách</span>
              </Button>
            </div>

            {/* Items Table */}
            {items.length === 0 ? (
              <div className="p-8 text-center bg-surface-app rounded-lg border border-dashed border-border-default text-xs text-text-sub">
                Chưa có mặt hàng nào. Vui lòng chọn sản phẩm ở ô phía trên và bấm &quot;Thêm vào danh sách&quot;.
              </div>
            ) : (
              <div className="overflow-x-auto border border-border-default rounded-lg">
                <table className="w-full text-xs">
                  <thead className="bg-surface-app text-text-sub font-semibold border-b border-border-default">
                    <tr>
                      <th className="py-2.5 px-3 text-left">STT</th>
                      <th className="py-2.5 px-3 text-left">Mã SKU</th>
                      <th className="py-2.5 px-3 text-left">Tên sản phẩm & Quy cách</th>
                      <th className="py-2.5 px-3 text-right w-36">Số lượng chuyển</th>
                      <th className="py-2.5 px-3 text-left w-24">Đơn vị</th>
                      <th className="py-2.5 px-2 text-center w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-default bg-surface-card">
                    {items.map((it, idx) => (
                      <tr key={it.rowId}>
                        <td className="py-2 px-3 text-text-sub text-center w-10">
                          {idx + 1}
                        </td>
                        <td className="py-2 px-3 font-mono font-bold text-text-main">
                          {it.sku}
                        </td>
                        <td className="py-2 px-3 text-text-main font-medium">
                          {it.productName}
                          {it.variantName !== it.productName && (
                            <span className="text-text-sub ml-1">
                              ({it.variantName})
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right">
                          <input
                            type="number"
                            min="0.001"
                            step="any"
                            value={it.qty}
                            onChange={(e) =>
                              handleUpdateItemQty(it.rowId, Number(e.target.value))
                            }
                            className="w-full px-2 py-1 text-xs bg-surface-app border border-border-default rounded font-mono text-right font-bold text-brand"
                          />
                        </td>
                        <td className="py-2 px-3 text-text-sub font-mono">
                          {it.baseUom}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(it.rowId)}
                            className="p-1 text-text-disabled hover:text-rose-600 rounded"
                            title="Xóa dòng"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Action Bar */}
          <div className="flex items-center justify-between pt-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setViewMode("LIST")}
            >
              Hủy bỏ
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSubmitting}
              disabled={isSubmitting}
            >
              <Send className="w-3.5 h-3.5 mr-1.5" />
              <span>Xác nhận điều chuyển kho</span>
            </Button>
          </div>
        </form>
      )}

      {/* =========================================================================
          MODAL CHI TIẾT PHIẾU ĐIỀU CHUYỂN
      ========================================================================= */}
      {selectedTransfer && (
        <Modal
          isOpen={Boolean(selectedTransfer)}
          onClose={() => setSelectedTransfer(null)}
          title={`Chi tiết phiếu chuyển: ${selectedTransfer.transfer_number}`}
        >
          <div className="space-y-4 text-xs">
            {/* Meta */}
            <div className="grid grid-cols-2 gap-3 p-3 bg-surface-app rounded-lg border border-border-default">
              <div>
                <span className="text-text-sub block text-[11px]">Từ kho xuất:</span>
                <span className="font-bold text-text-main text-sm">
                  {selectedTransfer.from_warehouse?.name || "Kho xuất"}
                </span>
              </div>
              <div>
                <span className="text-text-sub block text-[11px]">Đến kho nhận:</span>
                <span className="font-bold text-text-main text-sm">
                  {selectedTransfer.to_warehouse?.name || "Kho nhận"}
                </span>
              </div>
              <div>
                <span className="text-text-sub block text-[11px]">Thời gian:</span>
                <span className="font-mono text-text-main">
                  {new Date(selectedTransfer.created_at).toLocaleString("vi-VN")}
                </span>
              </div>
              <div>
                <span className="text-text-sub block text-[11px]">Trạng thái:</span>
                <Badge
                  variant={
                    selectedTransfer.status === "COMPLETED"
                      ? "inflow"
                      : selectedTransfer.status === "IN_TRANSIT"
                      ? "alert"
                      : "default"
                  }
                >
                  {selectedTransfer.status}
                </Badge>
              </div>
              {selectedTransfer.notes && (
                <div className="col-span-2 pt-1 border-t border-border-subtle">
                  <span className="text-text-sub block text-[11px]">Ghi chú:</span>
                  <span className="text-text-main">{selectedTransfer.notes}</span>
                </div>
              )}
            </div>

            {/* Items */}
            <div>
              <span className="font-semibold text-text-main block mb-2">
                Danh sách mặt hàng ({selectedTransfer.items?.length || 0})
              </span>
              <div className="border border-border-default rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-surface-app text-text-sub font-semibold border-b border-border-default">
                    <tr>
                      <th className="py-2 px-3 text-left">Mã SKU</th>
                      <th className="py-2 px-3 text-left">Tên sản phẩm</th>
                      <th className="py-2 px-3 text-right">Số lượng</th>
                      <th className="py-2 px-3 text-left">Đơn vị</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-default bg-surface-card">
                    {(selectedTransfer.items || []).map((it) => (
                      <tr key={it.id}>
                        <td className="py-2 px-3 font-mono font-bold text-text-main">
                          {it.variant?.sku || "-"}
                        </td>
                        <td className="py-2 px-3 text-text-main">
                          {it.variant?.variant_name || "Sản phẩm"}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold tabular-nums text-brand">
                          {formatQty(it.qty, it.uom)}
                        </td>
                        <td className="py-2 px-3 text-text-sub font-mono">
                          {it.uom}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Action inside modal */}
            {selectedTransfer.status === "IN_TRANSIT" && (
              <div className="pt-2 flex justify-end">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleCompleteTransfer(selectedTransfer.id)}
                  disabled={actionLoadingId === selectedTransfer.id}
                  isLoading={actionLoadingId === selectedTransfer.id}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                  <span>Xác nhận hoàn tất nhập kho</span>
                </Button>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
