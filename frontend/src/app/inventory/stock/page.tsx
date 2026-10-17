"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  api,
  Warehouse,
  VariantStockReport,
} from "@/lib/api";
import { formatQty } from "@/lib/design-tokens";
import {
  PageHeader,
  Badge,
  Button,
  LoadingState,
} from "@/components/common";
import {
  Warehouse as WarehouseIcon,
  RefreshCw,
  Search,
  ArrowRightLeft,
  Boxes,
  AlertTriangle,
  CheckCircle2,
  PackageX,
  Package,
} from "lucide-react";

export default function MultiWarehouseStockPage() {
  const [stockReports, setStockReports] = useState<VariantStockReport[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedWarehouseIds, setSelectedWarehouseIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [stockFilter, setStockFilter] = useState<"ALL" | "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK">("ALL");

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [stockData, whData] = await Promise.all([
        api.getWarehouseStock().catch(() => []),
        api.getWarehouses(true).catch(() => []),
      ]);
      setStockReports(stockData || []);
      const whList = whData || [];
      setWarehouses(whList);
      setSelectedWarehouseIds(whList.map((w) => w.id));
    } catch (err: any) {
      console.error("Lỗi khi tải dữ liệu tồn kho:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleWarehouse = (id: string) => {
    setSelectedWarehouseIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleAllWarehouses = () => {
    if (selectedWarehouseIds.length === warehouses.length) {
      // Don't deselect all completely, keep at least default or none
      setSelectedWarehouseIds([]);
    } else {
      setSelectedWarehouseIds(warehouses.map((w) => w.id));
    }
  };

  const visibleWarehouses = useMemo(() => {
    if (selectedWarehouseIds.length === 0) return warehouses;
    return warehouses.filter((w) => selectedWarehouseIds.includes(w.id));
  }, [warehouses, selectedWarehouseIds]);

  useEffect(() => {
    loadData();
  }, []);

  // Summary Metrics
  const metrics = useMemo(() => {
    let totalItems = stockReports.length;
    let totalOnHand = 0;
    let totalReserved = 0;
    let totalInTransit = 0;
    let outOfStockCount = 0;

    stockReports.forEach((r) => {
      const onHand = Number(r.total_on_hand ?? r.total_stock ?? 0);
      const res = Number(r.total_reserved ?? 0);
      totalOnHand += onHand;
      totalReserved += res;

      (r.by_warehouse || []).forEach((bw) => {
        totalInTransit += Number(bw.in_transit ?? 0);
      });

      const avail = Number(r.total_available ?? onHand - res);
      if (avail <= 0) {
        outOfStockCount++;
      }
    });

    return {
      totalItems,
      totalOnHand,
      totalReserved,
      totalInTransit,
      outOfStockCount,
    };
  }, [stockReports]);

  // Filtered reports
  const filteredReports = useMemo(() => {
    let result = stockReports;

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(
        (r) =>
          r.sku.toLowerCase().includes(q) ||
          r.product_name.toLowerCase().includes(q) ||
          (r.variant_name && r.variant_name.toLowerCase().includes(q))
      );
    }

    if (stockFilter === "IN_STOCK") {
      result = result.filter((r) => Number(r.total_stock || 0) > 0);
    } else if (stockFilter === "LOW_STOCK") {
      result = result.filter((r) => {
        const tot = Number(r.total_stock || 0);
        return tot > 0 && tot < 5;
      });
    } else if (stockFilter === "OUT_OF_STOCK") {
      result = result.filter((r) => Number(r.total_stock || 0) <= 0);
    }

    return result;
  }, [stockReports, searchTerm, stockFilter]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top Header */}
      <PageHeader
        title="Tồn Kho Đa Chi Nhánh"
        description="Ma trận số lượng tồn kho theo thời gian thực tại từng điểm bán và kho tổng."
        actions={
          <div className="flex items-center gap-2">
            <Link href="/inventory/transfers">
              <Button variant="secondary" size="sm">
                <ArrowRightLeft className="w-3.5 h-3.5 mr-1.5" />
                <span>Điều chuyển kho</span>
              </Button>
            </Link>
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
        }
      />

      {/* KPI Tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-surface-card p-4 rounded-xl border border-border-default shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-text-sub uppercase tracking-wider block">
              Tổng mặt hàng
            </span>
            <div className="text-xl font-bold font-mono text-text-main mt-1 tabular-nums">
              {metrics.totalItems}
            </div>
            <span className="text-[10px] text-text-disabled">SKU đang quản lý</span>
          </div>
          <div className="p-2.5 bg-surface-app text-text-sub rounded-lg border border-border-subtle">
            <Package className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-surface-card p-4 rounded-xl border border-border-default shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-text-sub uppercase tracking-wider block">
              Tồn vật lý (On-Hand)
            </span>
            <div className="text-xl font-bold font-mono text-brand mt-1 tabular-nums">
              {metrics.totalOnHand.toLocaleString("vi-VN")}
            </div>
            <span className="text-[10px] text-text-disabled">Đơn vị cơ sở</span>
          </div>
          <div className="p-2.5 bg-brand/10 text-brand rounded-lg border border-brand/20">
            <Boxes className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-surface-card p-4 rounded-xl border border-border-default shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-text-sub uppercase tracking-wider block">
              Đang giữ chỗ (Reserved)
            </span>
            <div className="text-xl font-bold font-mono text-amber-600 mt-1 tabular-nums">
              {metrics.totalReserved.toLocaleString("vi-VN")}
            </div>
            <span className="text-[10px] text-text-disabled">Đơn chờ xuất/giao</span>
          </div>
          <div className="p-2.5 bg-amber-50 text-amber-600 rounded-lg border border-amber-200">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-surface-card p-4 rounded-xl border border-border-default shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-text-sub uppercase tracking-wider block">
              Đang chuyển kho
            </span>
            <div className="text-xl font-bold font-mono text-sky-600 mt-1 tabular-nums">
              {metrics.totalInTransit.toLocaleString("vi-VN")}
            </div>
            <span className="text-[10px] text-text-disabled">Chưa ký nhận</span>
          </div>
          <div className="p-2.5 bg-sky-50 text-sky-600 rounded-lg border border-sky-200">
            <ArrowRightLeft className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-surface-card p-3.5 rounded-xl border border-border-default shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-text-sub absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Tìm theo SKU, tên sản phẩm..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-surface-app border border-border-default rounded-lg focus:outline-none focus:border-brand text-text-main"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
          <button
            type="button"
            onClick={() => setStockFilter("ALL")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
              stockFilter === "ALL"
                ? "bg-brand text-white"
                : "bg-surface-app text-text-sub hover:bg-surface-card border border-border-default"
            }`}
          >
            Tất cả ({stockReports.length})
          </button>
          <button
            type="button"
            onClick={() => setStockFilter("IN_STOCK")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
              stockFilter === "IN_STOCK"
                ? "bg-emerald-600 text-white"
                : "bg-surface-app text-text-sub hover:bg-surface-card border border-border-default"
            }`}
          >
            Còn hàng
          </button>
          <button
            type="button"
            onClick={() => setStockFilter("LOW_STOCK")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
              stockFilter === "LOW_STOCK"
                ? "bg-amber-600 text-white"
                : "bg-surface-app text-text-sub hover:bg-surface-card border border-border-default"
            }`}
          >
            Sắp hết (&lt;5)
          </button>
          <button
            type="button"
            onClick={() => setStockFilter("OUT_OF_STOCK")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
              stockFilter === "OUT_OF_STOCK"
                ? "bg-rose-600 text-white"
                : "bg-surface-app text-text-sub hover:bg-surface-card border border-border-default"
            }`}
          >
            Hết hàng
          </button>
        </div>
      </div>

      {/* Warehouse Column Filter Bar */}
      {warehouses.length > 0 && (
        <div className="bg-surface-card px-3.5 py-2.5 rounded-xl border border-border-default shadow-xs flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-text-main flex items-center gap-1.5 mr-1">
            <WarehouseIcon className="w-3.5 h-3.5 text-brand" />
            <span>Chọn kho hiển thị:</span>
          </span>
          <button
            type="button"
            onClick={toggleAllWarehouses}
            className={`px-2.5 py-1 rounded text-xs font-medium transition border ${
              selectedWarehouseIds.length === warehouses.length
                ? "bg-brand/10 border-brand/30 text-brand font-semibold"
                : "bg-surface-app border-border-subtle text-text-sub hover:bg-surface-muted hover:text-text-main"
            }`}
          >
            {selectedWarehouseIds.length === warehouses.length ? "✓ Tất cả kho" : "Chọn tất cả"}
          </button>
          <div className="h-4 w-px bg-border-subtle mx-1" />
          {warehouses.map((w) => {
            const isSelected = selectedWarehouseIds.includes(w.id);
            return (
              <button
                key={w.id}
                type="button"
                onClick={() => toggleWarehouse(w.id)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition flex items-center gap-1.5 border ${
                  isSelected
                    ? "bg-surface-card border-brand text-brand font-semibold shadow-xs"
                    : "bg-surface-app border-border-subtle text-text-sub hover:bg-surface-muted hover:text-text-main opacity-60"
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => {}}
                  className="rounded border-border-default text-brand focus:ring-0 cursor-pointer pointer-events-none w-3.5 h-3.5"
                />
                <span>{w.name}</span>
                {w.is_default && <span className="text-[10px] text-brand">★</span>}
              </button>
            );
          })}
        </div>
      )}

      {/* Matrix Table */}
      {isLoading ? (
        <LoadingState
          message="Đang tính toán số lượng tồn kho đa chi nhánh..."
          submessage="Truy vấn dữ liệu thời gian thực"
        />
      ) : filteredReports.length === 0 ? (
        <div className="p-12 text-center bg-surface-card border border-dashed border-border-default rounded-xl space-y-3">
          <WarehouseIcon className="w-10 h-10 text-text-disabled mx-auto" />
          <h3 className="text-sm font-semibold text-text-main">
            Không tìm thấy sản phẩm nào phù hợp
          </h3>
          <p className="text-xs text-text-sub">
            Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm.
          </p>
        </div>
      ) : (
        <div className="bg-surface-card rounded-xl border border-border-default overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-surface-app text-text-sub font-semibold border-b border-border-default">
                <tr>
                  <th className="py-3 px-3.5 text-left w-36">Mã SKU</th>
                  <th className="py-3 px-3.5 text-left min-w-[200px]">
                    Tên sản phẩm & Quy cách
                  </th>
                  <th className="py-3 px-2.5 text-center w-20">ĐVT cơ sở</th>
                  {visibleWarehouses.map((w) => (
                    <th
                      key={w.id}
                      className="py-3 px-3 text-right whitespace-nowrap font-medium"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <WarehouseIcon className="w-3 h-3 text-text-sub" />
                        <span>{w.name}</span>
                        {w.is_default && (
                          <span className="text-[10px] text-brand">★</span>
                        )}
                      </div>
                    </th>
                  ))}
                  <th className="py-3 px-4 text-right whitespace-nowrap font-bold bg-surface-app/80 text-text-main border-l border-border-default w-32">
                    Tổng toàn hệ thống
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-default bg-surface-card">
                {filteredReports.map((row) => {
                  const total = Number(row.total_stock || 0);
                  const whDataMap = new Map<string, any>();
                  (row.by_warehouse || []).forEach((bw) => {
                    whDataMap.set(bw.warehouse_id, bw);
                  });

                  return (
                    <tr
                      key={row.variant_id}
                      className="hover:bg-surface-app/50 transition-colors"
                    >
                      <td className="py-2.5 px-3.5 font-mono font-bold text-text-main">
                        {row.sku}
                      </td>
                      <td className="py-2.5 px-3.5 text-text-main">
                        <div className="font-semibold">{row.product_name}</div>
                        {row.variant_name &&
                          row.variant_name !== row.product_name && (
                            <div className="text-[11px] text-text-sub">
                              {row.variant_name}
                            </div>
                          )}
                      </td>
                      <td className="py-2.5 px-2.5 text-center font-mono text-text-sub">
                        <span className="px-1.5 py-0.5 rounded bg-surface-app border border-border-subtle">
                          {row.base_uom}
                        </span>
                      </td>

                      {/* Warehouses stock columns */}
                      {visibleWarehouses.map((w) => {
                        const bw = whDataMap.get(w.id);
                        const onHand = Number(bw?.on_hand ?? bw?.stock ?? 0);
                        const reserved = Number(bw?.reserved ?? 0);
                        const inTransit = Number(bw?.in_transit ?? 0);
                        const available = Number(bw?.available ?? onHand - reserved);
                        const secQty = bw?.secondary_qty ? Number(bw.secondary_qty) : null;

                        return (
                          <td
                            key={w.id}
                            className="py-2.5 px-3 text-right font-mono tabular-nums"
                          >
                            <div
                              className={`font-semibold ${
                                onHand > 0
                                  ? "text-text-main"
                                  : onHand === 0
                                  ? "text-text-disabled"
                                  : "text-rose-600 font-bold"
                              }`}
                            >
                              {onHand > 0
                                ? formatQty(onHand, row.base_uom)
                                : onHand === 0
                                ? "0"
                                : formatQty(onHand, row.base_uom)}
                            </div>
                            {secQty !== null && secQty > 0 && (
                              <div className="text-[10px] text-cyan-700 font-medium">
                                {secQty} con
                              </div>
                            )}
                            {(reserved > 0 || inTransit > 0) && (
                              <div className="text-[10px] flex items-center justify-end gap-1 mt-0.5 flex-wrap">
                                {reserved > 0 && (
                                  <span className="text-amber-700 bg-amber-50 px-1 rounded">
                                    Giữ: {formatQty(reserved)}
                                  </span>
                                )}
                                {inTransit > 0 && (
                                  <span className="text-sky-700 bg-sky-50 px-1 rounded">
                                    Chuyển: {formatQty(inTransit)}
                                  </span>
                                )}
                              </div>
                            )}
                            {reserved > 0 && (
                              <div className="text-[10px] text-emerald-700 font-medium mt-0.5">
                                Bán được: {formatQty(available)}
                              </div>
                            )}
                          </td>
                        );
                      })}

                      {/* Total Stock Column */}
                      <td
                        className={`py-2.5 px-4 text-right font-mono tabular-nums font-bold border-l border-border-default ${
                          total > 0
                            ? "text-brand"
                            : total === 0
                            ? "text-rose-500"
                            : "text-rose-700 bg-rose-50/50"
                        }`}
                      >
                        <div>{formatQty(row.total_on_hand ?? total, row.base_uom)}</div>
                        {row.total_reserved && Number(row.total_reserved) > 0 ? (
                          <div className="text-[10px] text-amber-700 font-normal mt-0.5">
                            Giữ: {formatQty(row.total_reserved)} | Bán: {formatQty(row.total_available ?? total)}
                          </div>
                        ) : null}
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
  );
}
