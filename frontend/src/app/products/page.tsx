"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { api, Product, Category } from "@/lib/api";
import { formatVND, formatQty } from "@/lib/design-tokens";
import {
  PageHeader,
  Badge,
  Button,
  TableToolbar,
  LoadingState,
  EmptyState,
  AlertBanner,
} from "@/components/common";
import {
  Package,
  Plus,
  Scale,
  Layers,
  Factory,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Tag,
  Filter,
} from "lucide-react";

const PRODUCT_TYPE_LABELS: Record<string, string> = {
  FINISHED_GOOD: "Thành phẩm",
  RAW_MATERIAL: "Nguyên vật liệu",
  WIP_SEMI_FINISHED: "Bán thành phẩm",
  SERVICE: "Dịch vụ",
  COMBO: "Gói / Combo",
};

// ponytail: in-memory list filtering; upgrade to server-side search pagination when product catalog exceeds 1000 items.
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
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchesName = p.name.toLowerCase().includes(term);
        const matchesCode = p.code.toLowerCase().includes(term);
        const matchesVariant = p.variants?.some(
          (v) =>
            v.sku.toLowerCase().includes(term) ||
            (v.variant_name && v.variant_name.toLowerCase().includes(term))
        );
        if (!matchesName && !matchesCode && !matchesVariant) return false;
      }

      if (selectedCategory !== "ALL" && p.category_id !== selectedCategory) {
        return false;
      }

      if (selectedType !== "ALL" && p.product_type !== selectedType) {
        return false;
      }

      return true;
    });
  }, [products, searchTerm, selectedCategory, selectedType]);

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
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <PageHeader
        title="Quản lý Hàng hóa & Sản phẩm"
        description="Theo dõi danh mục sản phẩm, biến thể ma trận, định mức chế biến và tồn kho WAC."
        badge={
          <Badge variant="brand">
            {products.length} mặt hàng
          </Badge>
        }
        actions={
          <Link href="/products/new">
            <Button variant="primary" size="sm">
              <Plus className="w-4 h-4 mr-1.5" />
              <span>Thêm sản phẩm</span>
            </Button>
          </Link>
        }
      />

      {/* Error Notice */}
      {error && (
        <AlertBanner
          type="error"
          message={error}
          onClose={() => setError(null)}
        />
      )}

      {/* Search and Filters */}
      <TableToolbar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Tìm theo tên sản phẩm, mã SKU, barcode..."
        filters={
          <>
            <div className="flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-text-sub shrink-0" />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="py-1.5 px-2.5 text-xs sm:text-sm bg-surface-muted/50 border border-border-subtle rounded-sm focus:outline-none focus:border-brand text-text-main"
              >
                <option value="ALL">Tất cả danh mục</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-text-sub shrink-0" />
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="py-1.5 px-2.5 text-xs sm:text-sm bg-surface-muted/50 border border-border-subtle rounded-sm focus:outline-none focus:border-brand text-text-main"
              >
                <option value="ALL">Tất cả loại hàng</option>
                {Object.entries(PRODUCT_TYPE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </>
        }
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={loadData}
            title="Tải lại dữ liệu"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-brand" : ""}`} />
            <span className="hidden sm:inline ml-1.5">Tải lại</span>
          </Button>
        }
      />

      {/* Main Table / State Views */}
      {isLoading ? (
        <LoadingState
          message="Đang tải danh sách hàng hóa..."
          submessage="Kết nối máy chủ cơ sở dữ liệu Micro-ERP"
        />
      ) : filteredProducts.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Chưa có sản phẩm nào phù hợp"
          description={
            searchTerm || selectedCategory !== "ALL" || selectedType !== "ALL"
              ? "Không tìm thấy mặt hàng phù hợp với điều kiện lọc."
              : "Bắt đầu bằng cách tạo sản phẩm đầu tiên với cấu hình ma trận, cân ký hoặc định mức BOM."
          }
          action={
            <Link href="/products/new">
              <Button variant="primary" size="sm">
                <Plus className="w-4 h-4 mr-1.5" />
                <span>Thêm sản phẩm mới</span>
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="bg-surface-card rounded-md border border-border-subtle shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-muted/60 text-xs text-text-sub font-semibold border-b border-border-subtle">
                <tr>
                  <th className="py-2.5 px-3 w-9"></th>
                  <th className="py-2.5 px-3">Tên sản phẩm & Mã</th>
                  <th className="py-2.5 px-3">Danh mục & Phân loại</th>
                  <th className="py-2.5 px-3">ĐVT cơ sở</th>
                  <th className="py-2.5 px-3">Biến thể</th>
                  <th className="py-2.5 px-3 text-right">Tồn kho khả dụng</th>
                  <th className="py-2.5 px-3 text-right">Giá bán & Giá vốn WAC</th>
                  <th className="py-2.5 px-3">Đặc tính mô-đun</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {filteredProducts.map((p) => {
                  const stats = getProductStats(p);
                  const isExpanded = expandedProductIds.has(p.id);

                  return (
                    <React.Fragment key={p.id}>
                      <tr className="hover:bg-surface-card-hover transition-colors group">
                        <td className="py-2.5 px-3 text-center">
                          {stats.isMatrix ? (
                            <button
                              type="button"
                              onClick={() => toggleExpand(p.id)}
                              className="text-text-sub hover:text-text-main transition-colors p-1 rounded-sm hover:bg-surface-muted"
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
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-text-main">
                            {p.name}
                          </div>
                          <div className="text-xs text-text-sub font-mono tabular-nums mt-0.5">
                            {p.code}
                          </div>
                        </td>

                        {/* Category & Product Type */}
                        <td className="py-2.5 px-3">
                          <div className="text-xs font-medium text-text-main">
                            {p.category?.name || "Chưa phân loại"}
                          </div>
                          <div className="text-xs text-text-sub mt-0.5">
                            {PRODUCT_TYPE_LABELS[p.product_type] || p.product_type}
                          </div>
                        </td>

                        {/* Base UOM */}
                        <td className="py-2.5 px-3">
                          <Badge variant="default">
                            {p.base_uom}
                          </Badge>
                        </td>

                        {/* Variants Count */}
                        <td className="py-2.5 px-3">
                          {stats.isMatrix ? (
                            <button
                              type="button"
                              onClick={() => toggleExpand(p.id)}
                              className="inline-flex items-center gap-1 text-xs font-medium text-purple-700 bg-purple-50 px-2 py-0.5 rounded-sm border border-purple-200 hover:bg-purple-100 transition-colors"
                            >
                              <Layers className="w-3 h-3" />
                              <span>{stats.variantCount} biến thể</span>
                            </button>
                          ) : (
                            <span className="text-xs text-text-sub">
                              Đơn thể
                            </span>
                          )}
                        </td>

                        {/* Available Stock */}
                        <td className="py-2.5 px-3 text-right">
                          <div className="font-semibold text-text-main font-mono tabular-nums">
                            {formatQty(stats.totalStock, p.base_uom)}
                          </div>
                          {stats.hasStockAlert && (
                            <div className="inline-flex items-center gap-1 text-[11px] text-amber-800 font-medium mt-0.5">
                              <AlertTriangle className="w-3 h-3 text-amber-600" />
                              <span>Dưới định mức</span>
                            </div>
                          )}
                        </td>

                        {/* Selling Price & WAC Cost */}
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums">
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
                        <td className="py-2.5 px-3">
                          <div className="flex flex-wrap gap-1">
                            {p.is_weighable && (
                              <Badge variant="catchweight">
                                <Scale className="w-3 h-3 mr-1" /> Cân ký
                              </Badge>
                            )}
                            {p.production_mode && p.production_mode !== "NONE" && (
                              <Badge variant="bom">
                                <Factory className="w-3 h-3 mr-1" /> Định mức BOM
                              </Badge>
                            )}
                            {stats.isMatrix && (
                              <Badge variant="matrix">
                                <Layers className="w-3 h-3 mr-1" /> Ma trận
                              </Badge>
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
                          <td colSpan={8} className="p-3 pl-10 border-b border-border-subtle">
                            <div className="bg-surface-card rounded-sm border border-border-subtle p-3 shadow-inner">
                              <div className="text-xs font-semibold text-text-sub uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                <Layers className="w-3.5 h-3.5 text-purple-600" />
                                <span>Chi tiết các biến thể ({p.variants?.length} SKU)</span>
                              </div>
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="border-b border-border-subtle text-text-sub font-semibold">
                                    <th className="py-1.5 px-2.5 text-left">Mã SKU</th>
                                    <th className="py-1.5 px-2.5 text-left">Tên biến thể / Quy cách</th>
                                    <th className="py-1.5 px-2.5 text-right">Tồn kho</th>
                                    <th className="py-1.5 px-2.5 text-right">Giá bán</th>
                                    <th className="py-1.5 px-2.5 text-right">Giá vốn WAC</th>
                                    <th className="py-1.5 px-2.5 text-right">Giá sàn</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-border-subtle font-mono tabular-nums">
                                  {p.variants?.map((v) => (
                                    <tr key={v.id} className="hover:bg-surface-muted/40 transition-colors">
                                      <td className="py-1.5 px-2.5 font-medium text-text-main">
                                        {v.sku}
                                      </td>
                                      <td className="py-1.5 px-2.5 font-sans text-text-main">
                                        {v.variant_name || p.name}
                                      </td>
                                      <td className="py-1.5 px-2.5 text-right font-medium">
                                        {formatQty(v.current_stock ?? v.current_inventory ?? 0, p.base_uom)}
                                      </td>
                                      <td className="py-1.5 px-2.5 text-right font-semibold text-text-main">
                                        {formatVND(v.base_selling_price)}
                                      </td>
                                      <td className="py-1.5 px-2.5 text-right text-text-sub">
                                        {formatVND(v.cost_price)}
                                      </td>
                                      <td className="py-1.5 px-2.5 text-right text-text-sub">
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
