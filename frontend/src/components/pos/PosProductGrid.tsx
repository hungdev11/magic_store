"use client";

import React from "react";
import {
  Search,
  Barcode,
  X,
  Scale,
  Layers,
  Utensils,
  Package,
  RefreshCw,
} from "lucide-react";
import { type Product, type ProductVariant, type Category } from "@/lib/api";
import { formatVND, formatQty } from "@/lib/design-tokens";
import {
  parseAttributes,
  getVariantStock,
  getProductTotalStock,
  isWeighableProduct,
  isMatrixProduct,
  isModifierProduct,
} from "@/lib/utils";
import { Badge } from "@/components/common";

export interface PosProductGridProps {
  products: Product[];
  categories: Category[];
  selectedCategoryId: string;
  onSelectCategory: (categoryId: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSearchSubmit: (e: React.FormEvent) => void;
  onProductClick: (product: Product) => void;
  isLoading?: boolean;
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
  className?: string;
}

function isBomProduct(p: Product): boolean {
  return p.production_mode === "BOM" || Boolean(p.track_batches);
}

// ponytail: responsive CSS grid 2-4 columns; upgrade to virtualized grid if product catalog exceeds 1000 items.
export const PosProductGrid: React.FC<PosProductGridProps> = ({
  products,
  categories,
  selectedCategoryId,
  onSelectCategory,
  searchQuery,
  onSearchChange,
  onSearchSubmit,
  onProductClick,
  isLoading = false,
  searchInputRef,
  className = "",
}) => {
  return (
    <section className={`flex flex-col h-full bg-surface-app select-none min-w-0 ${className}`}>
      {/* Top Bar: Search & Barcode Input and Categories */}
      <div className="p-2.5 bg-surface-card border-b border-border-subtle space-y-2 shrink-0">
        {/* Search Barcode Input */}
        <form onSubmit={onSearchSubmit} className="relative flex items-center">
          <div className="absolute left-3 text-text-sub pointer-events-none flex items-center gap-1.5">
            <Search className="w-4 h-4 text-text-sub" />
            <Barcode className="w-4 h-4 text-brand" />
          </div>

          <input
            ref={searchInputRef as any}
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Quét mã vạch Barcode hoặc tìm tên, SKU... [F2]"
            className="w-full h-9 pl-16 pr-9 text-xs sm:text-sm bg-surface-app border border-border-default rounded-sm focus:outline-none focus:border-border-focus font-medium text-text-main"
          />

          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                onSearchChange("");
                searchInputRef?.current?.focus();
              }}
              className="absolute right-2.5 p-1 text-text-sub hover:text-text-main"
              title="Xóa tìm kiếm"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </form>

        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
          <button
            type="button"
            onClick={() => onSelectCategory("ALL")}
            className={`px-2.5 py-1 rounded-sm text-xs font-semibold whitespace-nowrap transition-colors border ${
              selectedCategoryId === "ALL"
                ? "bg-brand text-white border-brand shadow-xs"
                : "bg-surface-app text-text-sub hover:bg-surface-muted hover:text-text-main border-border-subtle"
            }`}
          >
            Tất cả ({products.length})
          </button>

          {categories.map((cat) => {
            const count = products.filter((p) => p.category_id === cat.id).length;
            const isSelected = selectedCategoryId === cat.id;

            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => onSelectCategory(cat.id)}
                className={`px-2.5 py-1 rounded-sm text-xs font-semibold whitespace-nowrap transition-colors border ${
                  isSelected
                    ? "bg-brand text-white border-brand shadow-xs"
                    : "bg-surface-app text-text-sub hover:bg-surface-muted hover:text-text-main border-border-subtle"
                }`}
              >
                {cat.name} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Product Touch Grid Area */}
      <div className="flex-1 overflow-y-auto p-2.5">
        {isLoading ? (
          <div className="h-full flex flex-col items-center justify-center text-text-sub gap-2 py-12">
            <RefreshCw className="w-6 h-6 animate-spin text-brand" />
            <span className="text-xs font-medium">Đang tải danh mục hàng hóa...</span>
          </div>
        ) : products.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-text-sub gap-2 py-12">
            <Search className="w-8 h-8 stroke-1 text-text-disabled" />
            <span className="text-xs font-medium">Không tìm thấy sản phẩm phù hợp.</span>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
            {products.map((product) => {
              const weighable = isWeighableProduct(product);
              const matrix = isMatrixProduct(product);
              const modifier = isModifierProduct(product);
              const bom = isBomProduct(product);
              const totalStock = getProductTotalStock(product);
              const primaryVariant = product.variants?.[0];
              const price = primaryVariant
                ? Number(primaryVariant.base_selling_price) || 0
                : 0;

              return (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => onProductClick(product)}
                  className="group flex flex-col justify-between text-left p-2.5 rounded-sm bg-surface-card border border-border-default hover:border-brand hover:bg-surface-card/90 transition-all active:scale-[0.99] min-h-[110px]"
                >
                  {/* Card Top: Code & Domain Badges */}
                  <div className="flex items-start justify-between gap-1 w-full mb-1">
                    <span className="text-[10px] font-mono text-text-sub truncate">
                      {product.code}
                    </span>
                    <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
                      {weighable && (
                        <Badge variant="catchweight" className="text-[9px] px-1 py-0 gap-0.5">
                          <Scale className="w-2.5 h-2.5" /> Cân
                        </Badge>
                      )}
                      {matrix && (
                        <Badge variant="matrix" className="text-[9px] px-1 py-0 gap-0.5">
                          <Layers className="w-2.5 h-2.5" /> Ma trận
                        </Badge>
                      )}
                      {modifier && (
                        <Badge variant="modifier" className="text-[9px] px-1 py-0 gap-0.5">
                          <Utensils className="w-2.5 h-2.5" /> Topping
                        </Badge>
                      )}
                      {bom && (
                        <Badge variant="bom" className="text-[9px] px-1 py-0 gap-0.5">
                          <Package className="w-2.5 h-2.5" /> BOM
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Card Mid: Product Name, Thumbnail & UOM */}
                  <div className="my-1 flex-1 flex items-start gap-2 min-w-0">
                    {(product.image_url || primaryVariant?.image_url) && (
                      <div className="w-10 h-10 rounded-sm overflow-hidden shrink-0 border border-border-subtle bg-surface-muted mt-0.5">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={product.image_url || primaryVariant?.image_url}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-text-main text-xs sm:text-sm line-clamp-2 leading-snug group-hover:text-brand transition-colors">
                        {product.name}
                      </div>
                      <div className="text-[10px] text-text-sub mt-0.5">
                        ĐVT: <span className="font-medium text-text-main">{product.base_uom}</span>
                      </div>
                    </div>
                  </div>

                  {/* Card Bottom: Selling Price & Inventory Stock */}
                  <div className="pt-1.5 border-t border-border-subtle flex items-center justify-between w-full mt-1">
                    <span className="font-bold text-brand font-mono tabular-nums text-xs sm:text-sm">
                      {formatVND(price)}
                    </span>
                    <span
                      className={`text-[10px] font-mono tabular-nums font-medium ${
                        totalStock <= 0 ? "text-outflow font-bold" : "text-text-sub"
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
  );
};
