"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { api, Product, Category } from "@/lib/api";
import { formatVND, formatQty, getBadgeClasses } from "@/lib/design-tokens";
import {
  Package,
  Plus,
  Search,
  Filter,
  Scale,
  Layers,
  Factory,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Tag,
} from "lucide-react";

const PRODUCT_TYPE_LABELS: Record<string, string> = {
  FINISHED_GOOD: "Thành phẩm",
  RAW_MATERIAL: "Nguyên vật liệu",
  WIP_SEMI_FINISHED: "Bán thành phẩm",
  SERVICE: "Dịch vụ",
  COMBO: "Gói / Combo",
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [selectedType, setSelectedType] = useState<string>("ALL");
  const [expandedProductIds, setExpandedProductIds] = useState<Set<string>>(new Set());

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [prodRes, catRes] = await Promise.all([
        api.getProducts(),
        api.getCategories(),
      ]);
      setProducts(prodRes || []);
      setCategories(catRes || []);
    } catch (err: any) {
      setError(err.message || "Không thể tải danh sách sản phẩm");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const toggleExpand = (productId: string) => {
    setExpandedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // Search term matching name or code or variant SKU
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchesName = p.name.toLowerCase().includes(term);
        const matchesCode = p.code.toLowerCase().includes(term);
        const matchesVariant = p.variants?.some((v) =>
          v.sku.toLowerCase().includes(term) ||
          (v.variant_name && v.variant_name.toLowerCase().includes(term))
        );
        if (!matchesName && !matchesCode && !matchesVariant) return false;
      }

      // Category filter
      if (selectedCategory !== "ALL" && p.category_id !== selectedCategory) {
        return false;
      }

      // Type filter
      if (selectedType !== "ALL" && p.product_type !== selectedType) {
        return false;
      }

      return true;
    });
  }, [products, searchTerm, selectedCategory, selectedType]);

  // Calculations for a product row
  const getProductStats = (p: Product) => {
    const variants = p.variants || [];
    const variantCount = variants.length;
    const isMatrix = variantCount > 1;

    let totalStock = 0;
    let hasStockAlert = false;
    let minSelling = Infinity;
    let maxSelling = -Infinity;
    let minCost = Infinity;
    let maxCost = -Infinity;

    if (variantCount > 0) {
      for (const v of variants) {
        const stock = Number(v.current_stock ?? v.current_inventory ?? 0);
        totalStock += stock;
        const alertThreshold = Number(v.min_stock_alert ?? 0);
        if (alertThreshold > 0 && stock < alertThreshold) {
          hasStockAlert = true;
        }

        const sell = Number(v.base_selling_price || 0);
        const cost = Number(v.cost_price || 0);
        if (sell < minSelling) minSelling = sell;
        if (sell > maxSelling) maxSelling = sell;
        if (cost < minCost) minCost = cost;
        if (cost > maxCost) maxCost = cost;
      }
    } else {
      minSelling = 0;
      maxSelling = 0;
      minCost = 0;
      maxCost = 0;
    }

    if (minSelling === Infinity) minSelling = 0;
    if (maxSelling === -Infinity) maxSelling = 0;
    if (minCost === Infinity) minCost = 0;
    if (maxCost === -Infinity) maxCost = 0;

    return {
      variantCount,
      isMatrix,
      totalStock,
      hasStockAlert,
      minSelling,
      maxSelling,
      minCost,
      maxCost,
    };
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-brand px-2 py-0.5 rounded bg-brand-light border border-emerald-200">
              Quản lý Danh mục
            </span>
            <span className="text-xs text-text-sub font-mono">
              {products.length} mặt hàng
            </span>
          </div>
          <h1 className="text-2xl font-bold text-text-main mt-1">
            Quản lý Hàng hóa & Sản phẩm
          </h1>
          <p className="text-sm text-text-sub mt-0.5">
            Theo dõi danh mục sản phẩm, biến thể ma trận, định mức chế biến và tồn kho WAC.
          </p>
        </div>

        <Link
          href="/products/new"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand-hover shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          <span>Thêm sản phẩm mới</span>
        </Link>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-surface-card p-4 rounded-xl border border-border-subtle shadow-card flex flex-col md:flex-row gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-sub" />
          <input
            type="text"
            placeholder="Tìm theo tên sản phẩm, mã SKU, barcode..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-surface-muted/50 border border-border-subtle rounded-lg focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand text-text-main placeholder:text-text-disabled"
          />
        </div>

        {/* Category Filter */}
        <div className="flex items-center gap-2 min-w-[200px]">
          <Tag className="w-4 h-4 text-text-sub shrink-0" />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full py-2 px-3 text-sm bg-surface-muted/50 border border-border-subtle rounded-lg focus:outline-none focus:border-brand text-text-main"
          >
            <option value="ALL">Tất cả danh mục</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Product Type Filter */}
        <div className="flex items-center gap-2 min-w-[200px]">
          <Filter className="w-4 h-4 text-text-sub shrink-0" />
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="w-full py-2 px-3 text-sm bg-surface-muted/50 border border-border-subtle rounded-lg focus:outline-none focus:border-brand text-text-main"
          >
            <option value="ALL">Tất cả loại hàng</option>
            {Object.entries(PRODUCT_TYPE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* Reload button */}
        <button
          onClick={loadData}
          title="Tải lại dữ liệu"
          className="p-2 border border-border-subtle rounded-lg hover:bg-surface-muted text-text-sub hover:text-text-main transition flex items-center justify-center shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-brand" : ""}`} />
        </button>
      </div>

      {/* Main Table / State Views */}
      {isLoading ? (
        <div className="bg-surface-card rounded-xl border border-border-subtle p-12 text-center shadow-card">
          <RefreshCw className="w-8 h-8 animate-spin text-brand mx-auto mb-3" />
          <p className="text-sm font-medium text-text-main">Đang tải danh sách hàng hóa...</p>
          <p className="text-xs text-text-sub mt-1">Kết nối máy chủ cơ sở dữ liệu Micro-ERP</p>
        </div>
      ) : error ? (
        <div className="bg-surface-card rounded-xl border border-rose-200 p-8 text-center shadow-card bg-rose-50/30">
          <AlertTriangle className="w-8 h-8 text-rose-600 mx-auto mb-2" />
          <p className="text-sm font-semibold text-rose-700">{error}</p>
          <button
            onClick={loadData}
            className="mt-3 px-4 py-1.5 text-xs font-medium rounded-lg bg-white border border-rose-200 text-rose-700 hover:bg-rose-50"
          >
            Thử lại
          </button>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="bg-surface-card rounded-xl border border-border-subtle p-12 text-center shadow-card space-y-3">
          <Package className="w-12 h-12 text-text-disabled mx-auto" />
          <h3 className="text-base font-semibold text-text-main">
            Chưa có sản phẩm nào. Tạo sản phẩm đầu tiên!
          </h3>
          <p className="text-xs text-text-sub max-w-md mx-auto">
            Hệ thống hỗ trợ tự động thích ứng với cấu hình sạp cá (cân ký), thời trang (ma trận biến thể) và F&B (định mức BOM).
          </p>
          <div className="pt-2">
            <Link
              href="/products/new"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand-hover shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              <span>Tạo sản phẩm đầu tiên</span>
            </Link>
          </div>
        </div>
      ) : (
        <div className="bg-surface-card rounded-xl border border-border-subtle shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-muted/60 text-xs text-text-sub font-semibold border-b border-border-subtle">
                <tr>
                  <th className="py-3 px-4 w-10"></th>
                  <th className="py-3 px-4">Tên sản phẩm & Mã SKU</th>
                  <th className="py-3 px-4">Danh mục & Loại hàng</th>
                  <th className="py-3 px-4">ĐVT cơ sở</th>
                  <th className="py-3 px-4">Biến thể</th>
                  <th className="py-3 px-4 text-right">Tồn kho khả dụng</th>
                  <th className="py-3 px-4 text-right">Giá bán & Giá vốn WAC</th>
                  <th className="py-3 px-4">Đặc tính mô-đun</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {filteredProducts.map((p) => {
                  const stats = getProductStats(p);
                  const isExpanded = expandedProductIds.has(p.id);
                  const hasVariants = (p.variants?.length || 0) > 0;

                  return (
                    <React.Fragment key={p.id}>
                      <tr className="hover:bg-surface-muted/40 transition group">
                        <td className="py-3.5 px-4 text-center">
                          {stats.isMatrix ? (
                            <button
                              onClick={() => toggleExpand(p.id)}
                              className="text-text-sub hover:text-text-main transition p-1 rounded hover:bg-surface-muted"
                              title={isExpanded ? "Thu gọn biến thể" : "Xem chi tiết biến thể"}
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-brand" />
                              ) : (
                                <ChevronRight className="w-4 h-4" />
                              )}
                            </button>
                          ) : (
                            <span className="w-4 h-4 inline-block" />
                          )}
                        </td>

                        {/* Product Name & Code */}
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-text-main flex items-center gap-1.5">
                            {p.name}
                          </div>
                          <div className="text-xs text-text-sub font-mono mt-0.5">
                            {p.code}
                          </div>
                        </td>

                        {/* Category & Product Type */}
                        <td className="py-3.5 px-4">
                          <div className="text-xs font-medium text-text-main">
                            {p.category?.name || "Chưa phân loại"}
                          </div>
                          <div className="text-xs text-text-sub mt-0.5">
                            {PRODUCT_TYPE_LABELS[p.product_type] || p.product_type}
                          </div>
                        </td>

                        {/* Base UOM */}
                        <td className="py-3.5 px-4">
                          <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-surface-muted border border-border-subtle text-text-main font-mono">
                            {p.base_uom}
                          </span>
                        </td>

                        {/* Variants Count */}
                        <td className="py-3.5 px-4">
                          {stats.isMatrix ? (
                            <button
                              onClick={() => toggleExpand(p.id)}
                              className="inline-flex items-center gap-1 text-xs font-medium text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200 hover:bg-purple-100 transition"
                            >
                              <Layers className="w-3 h-3" />
                              <span>{stats.variantCount} biến thể</span>
                            </button>
                          ) : (
                            <span className="text-xs text-text-sub font-medium">
                              Đơn thể
                            </span>
                          )}
                        </td>

                        {/* Available Stock */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="font-semibold text-text-main font-mono">
                            {formatQty(stats.totalStock, p.base_uom)}
                          </div>
                          {stats.hasStockAlert && (
                            <div className="inline-flex items-center gap-1 text-[11px] text-amber-700 font-medium mt-0.5">
                              <AlertTriangle className="w-3 h-3 text-amber-500" />
                              <span>Cảnh báo dưới định mức</span>
                            </div>
                          )}
                        </td>

                        {/* Selling Price & WAC Cost */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="font-semibold text-text-main">
                            {stats.minSelling === stats.maxSelling
                              ? formatVND(stats.minSelling)
                              : `${formatVND(stats.minSelling)} - ${formatVND(stats.maxSelling)}`}
                          </div>
                          <div className="text-xs text-text-sub mt-0.5">
                            Vốn:{" "}
                            {stats.minCost === stats.maxCost
                              ? formatVND(stats.minCost)
                              : `${formatVND(stats.minCost)} - ${formatVND(stats.maxCost)}`}{" "}
                            <span className="text-[10px] text-brand font-semibold">(WAC)</span>
                          </div>
                        </td>

                        {/* Module Badges */}
                        <td className="py-3.5 px-4">
                          <div className="flex flex-wrap gap-1.5">
                            {p.is_weighable && (
                              <span
                                className={getBadgeClasses("catchweight")}
                                title="Yêu cầu cân khối lượng thực tế tại quầy"
                              >
                                <Scale className="w-3 h-3 mr-1" />
                                Cân ký
                              </span>
                            )}
                            {p.production_mode && p.production_mode !== "NONE" && (
                              <span
                                className={getBadgeClasses("bom")}
                                title={`Chế độ: ${p.production_mode}`}
                              >
                                <Factory className="w-3 h-3 mr-1" />
                                Định mức BOM
                              </span>
                            )}
                            {stats.isMatrix && (
                              <span
                                className={getBadgeClasses("matrix")}
                                title="Ma trận tổ hợp đa thuộc tính"
                              >
                                <Layers className="w-3 h-3 mr-1" />
                                Ma trận
                              </span>
                            )}
                            {!p.is_weighable &&
                              (!p.production_mode || p.production_mode === "NONE") &&
                              !stats.isMatrix && (
                                <span className="text-xs text-text-disabled italic">
                                  Tiêu chuẩn
                                </span>
                              )}
                          </div>
                        </td>
                      </tr>

                      {/* Expanded Sub-table for Matrix Variants */}
                      {isExpanded && stats.isMatrix && (
                        <tr className="bg-surface-muted/30">
                          <td colSpan={8} className="p-4 pl-12 border-b border-border-subtle">
                            <div className="bg-white rounded-lg border border-border-subtle p-3 shadow-inner">
                              <div className="text-xs font-semibold text-text-sub uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                <Layers className="w-3.5 h-3.5 text-purple-600" />
                                <span>Chi tiết các biến thể ({p.variants?.length} SKU)</span>
                              </div>
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="border-b border-border-subtle text-text-sub">
                                    <th className="py-2 px-3 text-left">Mã SKU</th>
                                    <th className="py-2 px-3 text-left">Tên biến thể / Quy cách</th>
                                    <th className="py-2 px-3 text-right">Tồn kho</th>
                                    <th className="py-2 px-3 text-right">Giá bán</th>
                                    <th className="py-2 px-3 text-right">Giá vốn WAC</th>
                                    <th className="py-2 px-3 text-right">Giá sàn</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-border-subtle">
                                  {p.variants?.map((v) => (
                                    <tr key={v.id} className="hover:bg-slate-50/80">
                                      <td className="py-2 px-3 font-mono font-medium text-text-main">
                                        {v.sku}
                                      </td>
                                      <td className="py-2 px-3 text-text-main">
                                        {v.variant_name || p.name}
                                      </td>
                                      <td className="py-2 px-3 text-right font-mono font-medium">
                                        {formatQty(v.current_stock ?? v.current_inventory ?? 0, p.base_uom)}
                                      </td>
                                      <td className="py-2 px-3 text-right font-semibold text-text-main">
                                        {formatVND(v.base_selling_price)}
                                      </td>
                                      <td className="py-2 px-3 text-right text-text-sub">
                                        {formatVND(v.cost_price)}
                                      </td>
                                      <td className="py-2 px-3 text-right text-text-sub font-mono">
                                        {formatVND(v.min_selling_price)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
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
