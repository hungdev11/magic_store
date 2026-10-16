"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import { BatchItem, api } from "@/lib/api";
import { formatQty } from "@/lib/design-tokens";
import {
  PageHeader,
  Button,
  Input,
  Badge,
  AlertBanner,
} from "@/components/common";
import { BatchEditModal } from "@/components/inventory/BatchEditModal";
import { BatchTraceDrawer } from "@/components/inventory/BatchTraceDrawer";
import {
  Search,
  Pencil,
  History,
  RefreshCw,
  ArrowDownToLine,
  Trash2,
  Boxes,
  Loader2,
} from "lucide-react";

type BatchStatusFilter = "ALL" | "ACTIVE" | "EXPIRING_SOON" | "EXPIRED" | "OUT_OF_STOCK";

interface BatchStatusInfo {
  key: BatchStatusFilter;
  label: string;
  badgeVariant: "inflow" | "outflow" | "alert" | "default";
}

function getBatchStatusInfo(batch: BatchItem): BatchStatusInfo {
  const remaining = Number(batch.remaining_qty || 0);
  if (remaining <= 0) {
    return {
      key: "OUT_OF_STOCK",
      label: "Hết hàng",
      badgeVariant: "default",
    };
  }

  if (!batch.expiry_date) {
    return {
      key: "ACTIVE",
      label: "Còn hạn",
      badgeVariant: "inflow",
    };
  }

  const exp = new Date(batch.expiry_date).getTime();
  const now = Date.now();
  if (exp <= now) {
    return {
      key: "EXPIRED",
      label: "Đã hết hạn",
      badgeVariant: "outflow",
    };
  }

  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  if (exp <= now + thirtyDays) {
    return {
      key: "EXPIRING_SOON",
      label: "Cận date",
      badgeVariant: "alert",
    };
  }

  return {
    key: "ACTIVE",
    label: "Còn hạn",
    badgeVariant: "inflow",
  };
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

// ponytail: table pagination omitted; upgrade to cursor pagination when batch count exceeds 1,000 lots.
function BatchesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const statusParam = (searchParams.get("status")?.toUpperCase() as BatchStatusFilter) || "ALL";
  const queryParam = searchParams.get("q") || "";

  const [batches, setBatches] = useState<BatchItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState(queryParam);
  const [statusFilter, setStatusFilter] = useState<BatchStatusFilter>(
    ["ALL", "ACTIVE", "EXPIRING_SOON", "EXPIRED", "OUT_OF_STOCK"].includes(statusParam)
      ? statusParam
      : "ALL"
  );

  // Modals state
  const [editingBatch, setEditingBatch] = useState<BatchItem | null>(null);
  const [tracingBatch, setTracingBatch] = useState<BatchItem | null>(null);

  const loadBatches = async (q?: string, status?: BatchStatusFilter) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await api.getBatches({
        q: q !== undefined ? q : (searchTerm.trim() || undefined),
        status: (status || statusFilter) === "ALL" ? undefined : (status || statusFilter),
      });
      setBatches(data || []);
    } catch (err: any) {
      setLoadError(err.message || "Không thể tải danh sách lô hàng.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBatches(queryParam, statusParam);
  }, []);

  const updateUrl = (status: BatchStatusFilter, q: string) => {
    const params = new URLSearchParams();
    if (status !== "ALL") params.set("status", status);
    if (q.trim()) params.set("q", q.trim());
    const qs = params.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ""}`);
  };

  const handleStatusChange = (newStatus: BatchStatusFilter) => {
    setStatusFilter(newStatus);
    updateUrl(newStatus, searchTerm);
    loadBatches(searchTerm.trim() || undefined, newStatus);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateUrl(statusFilter, searchTerm);
    loadBatches(searchTerm.trim() || undefined, statusFilter);
  };

  const handleBatchSaved = (updated: BatchItem) => {
    setBatches((prev) =>
      prev.map((b) => (b.id === updated.id ? { ...b, ...updated } : b))
    );
  };

  const statusCounts = useMemo(() => {
    const counts = {
      ALL: batches.length,
      ACTIVE: 0,
      EXPIRING_SOON: 0,
      EXPIRED: 0,
      OUT_OF_STOCK: 0,
    };
    batches.forEach((b) => {
      const info = getBatchStatusInfo(b);
      if (info.key in counts) {
        counts[info.key as keyof typeof counts]++;
      }
    });
    return counts;
  }, [batches]);

  const filterTabs: { key: BatchStatusFilter; label: string }[] = [
    { key: "ALL", label: "Tất cả" },
    { key: "ACTIVE", label: "Còn hàng" },
    { key: "EXPIRING_SOON", label: "Cận date (< 30 ngày)" },
    { key: "EXPIRED", label: "Đã hết hạn" },
    { key: "OUT_OF_STOCK", label: "Hết hàng" },
  ];

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Top Header */}
      <PageHeader
        title="Quản lý Lô & Hạn sử dụng"
        description="Theo dõi mã lô, vòng đời HSD, nhà cung cấp và lịch sử biến động nhập-xuất kho."
        badge={
          <Badge variant="brand">
            {batches.length} lô hàng
          </Badge>
        }
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Link href="/inventory/purchase">
              <Button size="sm" variant="outline" className="gap-1.5">
                <ArrowDownToLine className="w-3.5 h-3.5 text-brand" />
                <span>Nhập kho (PO)</span>
              </Button>
            </Link>
            <Link href="/inventory/wastage">
              <Button size="sm" variant="outline" className="gap-1.5">
                <Trash2 className="w-3.5 h-3.5 text-text-sub" />
                <span>Xuất hủy</span>
              </Button>
            </Link>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => loadBatches()}
              disabled={isLoading}
              title="Tải lại danh sách"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? "animate-spin text-brand" : ""}`} />
              <span>Tải lại</span>
            </Button>
          </div>
        }
      />

      {/* Load error */}
      {loadError && (
        <AlertBanner
          type="error"
          message={loadError}
          onClose={() => setLoadError(null)}
        />
      )}

      {/* Toolbar: Search & Filter Tabs */}
      <div className="bg-surface-card border border-border-default rounded-md p-3 space-y-3 shadow-card">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          {filterTabs.map((tab) => {
            const isSelected = statusFilter === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => handleStatusChange(tab.key)}
                className={`px-2.5 py-1 rounded-sm text-xs font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                  isSelected
                    ? "bg-brand text-white shadow-xs"
                    : "bg-surface-muted text-text-sub hover:text-text-main"
                }`}
              >
                <span>{tab.label}</span>
                {statusFilter === "ALL" && (
                  <span
                    className={`font-mono tabular-nums text-[11px] px-1 py-0.2 rounded ${
                      isSelected ? "bg-white/20 text-white" : "bg-surface-card text-text-sub"
                    }`}
                  >
                    {statusCounts[tab.key]}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="flex-1">
            <Input
              type="text"
              placeholder="Tìm theo mã lô, tên sản phẩm, mã SKU, ghi chú..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>
          <Button type="submit" variant="primary" size="md">
            Tìm kiếm
          </Button>
          {searchTerm && (
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => {
                setSearchTerm("");
                updateUrl(statusFilter, "");
                loadBatches("", statusFilter);
              }}
            >
              Xóa lọc
            </Button>
          )}
        </form>
      </div>

      {/* Data Table */}
      <div className="bg-surface-card border border-border-default rounded-md overflow-hidden shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-surface-muted border-b border-border-default text-text-sub uppercase tracking-wider text-[11px] font-semibold select-none">
                <th className="px-3 py-2 whitespace-nowrap">Mã lô</th>
                <th className="px-3 py-2 min-w-[200px]">Tên sản phẩm & SKU</th>
                <th className="px-3 py-2 whitespace-nowrap">Nhà cung cấp</th>
                <th className="px-3 py-2 whitespace-nowrap text-right">Tồn còn lại / Ban đầu</th>
                <th className="px-3 py-2 whitespace-nowrap">Ngày nhập</th>
                <th className="px-3 py-2 whitespace-nowrap">Hạn sử dụng</th>
                <th className="px-3 py-2 whitespace-nowrap text-center">Trạng thái</th>
                <th className="px-3 py-2 whitespace-nowrap text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-text-sub">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin text-brand" />
                      <span>Đang tải danh sách lô hàng...</span>
                    </div>
                  </td>
                </tr>
              ) : batches.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-text-sub">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Boxes className="w-7 h-7 text-text-disabled" />
                      <p className="font-semibold text-text-main text-sm">Không tìm thấy lô hàng nào</p>
                      <p className="text-xs text-text-sub">
                        {searchTerm || statusFilter !== "ALL"
                          ? "Hãy thử thay đổi điều kiện tìm kiếm hoặc trạng thái lọc."
                          : "Chưa có lô hàng nào được nhập vào hệ thống."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                batches.map((batch) => {
                  const statusInfo = getBatchStatusInfo(batch);
                  const productName = batch.variant?.product?.name || "—";
                  const sku = batch.variant?.sku || batch.variant_id;
                  const variantName = batch.variant?.variant_name;
                  const baseUom = batch.variant?.product?.base_uom || "";

                  return (
                    <tr
                      key={batch.id}
                      className="hover:bg-surface-card-hover transition-colors h-[38px]"
                    >
                      {/* Mã lô */}
                      <td className="px-3 py-2 font-mono font-medium text-text-main whitespace-nowrap">
                        <span className="bg-surface-muted px-1.5 py-0.5 rounded-sm border border-border-subtle">
                          {batch.batch_code}
                        </span>
                      </td>

                      {/* Tên SP & SKU */}
                      <td className="px-3 py-2">
                        <div className="font-medium text-text-main truncate max-w-xs" title={productName}>
                          {productName}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="font-mono tabular-nums text-text-sub text-[11px]">{sku}</span>
                          {variantName && (
                            <span className="text-text-sub text-[11px] truncate max-w-[120px]">
                              • {variantName}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Nhà cung cấp */}
                      <td className="px-3 py-2 text-text-sub whitespace-nowrap">
                        <span className="truncate max-w-[150px] block" title={batch.supplier?.name || "—"}>
                          {batch.supplier?.name || "—"}
                        </span>
                      </td>

                      {/* Tồn còn lại / Ban đầu */}
                      <td className="px-3 py-2 text-right font-mono tabular-nums whitespace-nowrap">
                        <span className="font-semibold text-text-main">
                          {formatQty(batch.remaining_qty)}
                        </span>
                        <span className="text-text-sub"> / {formatQty(batch.initial_qty)}</span>
                        {baseUom && <span className="text-text-sub ml-1">{baseUom}</span>}
                      </td>

                      {/* Ngày nhập */}
                      <td className="px-3 py-2 font-mono tabular-nums text-text-sub whitespace-nowrap">
                        {formatDate(batch.received_date)}
                      </td>

                      {/* Hạn sử dụng */}
                      <td className="px-3 py-2 font-mono tabular-nums whitespace-nowrap">
                        {batch.expiry_date ? (
                          <span className={statusInfo.key === "EXPIRED" ? "text-outflow font-semibold" : "text-text-sub"}>
                            {formatDate(batch.expiry_date)}
                          </span>
                        ) : (
                          <span className="text-text-disabled italic">Không hạn</span>
                        )}
                      </td>

                      {/* Badge trạng thái */}
                      <td className="px-3 py-2 text-center whitespace-nowrap">
                        <Badge variant={statusInfo.badgeVariant}>
                          {statusInfo.label}
                        </Badge>
                      </td>

                      {/* Thao tác */}
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs text-text-sub hover:text-brand"
                            onClick={() => setEditingBatch(batch)}
                            title="Sửa hạn sử dụng và ghi chú"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            <span>Sửa</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-7 px-2 text-xs"
                            onClick={() => setTracingBatch(batch)}
                            title="Truy vết lịch sử biến động lô"
                          >
                            <History className="w-3.5 h-3.5 text-brand" />
                            <span>Truy vết</span>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer */}
        {!isLoading && batches.length > 0 && (
          <div className="px-4 py-2.5 bg-surface-muted/50 border-t border-border-subtle flex items-center justify-between text-xs text-text-sub font-mono tabular-nums">
            <span>Hiển thị {batches.length} lô hàng</span>
            <span>
              Tổng tồn khả dụng:{" "}
              {formatQty(
                batches.reduce((acc, curr) => acc + Number(curr.remaining_qty || 0), 0)
              )}
            </span>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      <BatchEditModal
        isOpen={Boolean(editingBatch)}
        onClose={() => setEditingBatch(null)}
        batch={editingBatch}
        onSuccess={handleBatchSaved}
      />

      {/* Movement Trace Drawer */}
      <BatchTraceDrawer
        isOpen={Boolean(tracingBatch)}
        onClose={() => setTracingBatch(null)}
        batch={tracingBatch}
      />
    </div>
  );
}

export default function BatchesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-text-sub">Đang tải...</div>}>
      <BatchesContent />
    </Suspense>
  );
}
