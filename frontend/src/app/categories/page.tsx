"use client";

import React, { useEffect, useState, useMemo } from "react";
import { api, Category, Product } from "@/lib/api";
import { Button } from "@/components/common/Button";
import { Input } from "@/components/common/Input";
import { Badge } from "@/components/common/Badge";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { CategoryFormModal } from "@/components/categories/CategoryFormModal";
import {
  FolderTree,
  Plus,
  Search,
  Pencil,
  Trash2,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  X,
} from "lucide-react";

// ponytail: in-memory product count and filtering; upgrade to server-side search and count aggregation when category count exceeds 500 items.
export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");

  // Form Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  // Deletion state
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [cats, prods] = await Promise.all([
        api.getCategories(),
        api.getProducts().catch(() => [] as Product[]),
      ]);
      setCategories(cats || []);
      setProducts(prods || []);
    } catch (err: any) {
      setLoadError(err.message || "Không thể tải danh sách danh mục.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Map category ID to Category object for fast lookup of parent name
  const categoryMap = useMemo(() => {
    const map = new Map<string, Category>();
    categories.forEach((cat) => {
      map.set(cat.id, cat);
    });
    return map;
  }, [categories]);

  // Count products directly assigned to each category
  const productCountMap = useMemo(() => {
    const counts: Record<string, number> = {};
    products.forEach((prod) => {
      if (prod.category_id) {
        counts[prod.category_id] = (counts[prod.category_id] || 0) + 1;
      }
    });
    return counts;
  }, [products]);

  // Filtered categories
  const filteredCategories = useMemo(() => {
    return categories.filter((cat) => {
      const search = searchTerm.trim().toLowerCase();
      const code = (cat.code || "").toLowerCase();
      const name = cat.name.toLowerCase();
      const parentName = cat.parent_id ? (categoryMap.get(cat.parent_id)?.name || "").toLowerCase() : "";

      const matchesSearch =
        !search ||
        code.includes(search) ||
        name.includes(search) ||
        parentName.includes(search);

      const isActive = cat.is_active !== false;
      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" && isActive) ||
        (statusFilter === "INACTIVE" && !isActive);

      return matchesSearch && matchesStatus;
    });
  }, [categories, searchTerm, statusFilter, categoryMap]);

  const handleOpenCreate = () => {
    setEditingCategory(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (cat: Category) => {
    setEditingCategory(cat);
    setIsModalOpen(true);
  };

  const handleOpenDelete = (cat: Category) => {
    setDeleteError(null);
    setDeletingCategory(cat);
  };

  const handleConfirmDelete = async () => {
    if (!deletingCategory) return;
    setIsDeleting(true);
    setDeleteError(null);

    try {
      await api.deleteCategory(deletingCategory.id);
      const deletedName = deletingCategory.name;
      setDeletingCategory(null);
      setFeedback({
        type: "success",
        message: `Đã xóa danh mục "${deletedName}" thành công.`,
      });
      await loadData();
    } catch (err: any) {
      setDeletingCategory(null);
      // Display server error clearly (e.g. 409 Conflict: Danh mục đang chứa sản phẩm hoặc danh mục con, không thể xóa.)
      setDeleteError(err.message || "Không thể xóa danh mục.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border-subtle pb-4">
        <div>
          <div className="flex items-center gap-2">
            <FolderTree className="w-5 h-5 text-brand shrink-0" />
            <h1 className="text-lg font-bold text-text-main">Quản lý Danh mục Sản phẩm</h1>
          </div>
          <p className="text-xs text-text-sub mt-0.5">
            Thiết lập danh mục phân cấp cho hàng hóa, nguyên vật liệu và báo cáo doanh thu
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={loadData}
            disabled={isLoading}
            title="Làm mới danh sách"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Làm mới
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleOpenCreate}
            className="shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Thêm danh mục
          </Button>
        </div>
      </div>

      {/* Global Alerts / Feedback */}
      {feedback && (
        <div
          role="status"
          className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-md text-xs flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="p-0.5 text-emerald-600 hover:text-emerald-900 rounded-sm"
            aria-label="Đóng thông báo"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {deleteError && (
        <div
          role="alert"
          className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-md text-xs flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <div>
              <span className="font-semibold">Không thể xóa: </span>
              <span>{deleteError}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setDeleteError(null)}
            className="p-0.5 text-rose-600 hover:text-rose-900 rounded-sm"
            aria-label="Đóng cảnh báo lỗi"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {loadError && (
        <div
          role="alert"
          className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-md text-xs flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{loadError}</span>
          </div>
          <Button variant="outline" size="sm" onClick={loadData}>
            Thử lại
          </Button>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
        <div className="w-full sm:w-80">
          <Input
            placeholder="Tìm theo mã hoặc tên danh mục..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            leftIcon={<Search className="w-4 h-4 text-text-sub" />}
            className="h-8 text-xs"
          />
        </div>

        {/* Status Filter Segmented Controls */}
        <div className="inline-flex items-center p-0.5 bg-surface-muted border border-border-default rounded-md text-xs">
          <button
            type="button"
            onClick={() => setStatusFilter("ALL")}
            className={`px-3 py-1 font-medium rounded-sm transition-colors ${
              statusFilter === "ALL"
                ? "bg-surface-card text-text-main shadow-xs"
                : "text-text-sub hover:text-text-main"
            }`}
          >
            Tất cả ({categories.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("ACTIVE")}
            className={`px-3 py-1 font-medium rounded-sm transition-colors ${
              statusFilter === "ACTIVE"
                ? "bg-surface-card text-text-main shadow-xs"
                : "text-text-sub hover:text-text-main"
            }`}
          >
            Đang dùng ({categories.filter((c) => c.is_active !== false).length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("INACTIVE")}
            className={`px-3 py-1 font-medium rounded-sm transition-colors ${
              statusFilter === "INACTIVE"
                ? "bg-surface-card text-text-main shadow-xs"
                : "text-text-sub hover:text-text-main"
            }`}
          >
            Vô hiệu ({categories.filter((c) => c.is_active === false).length})
          </button>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-surface-card border border-border-default rounded-md overflow-hidden shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-surface-muted border-b border-border-default text-text-sub uppercase text-[11px] font-semibold tracking-wider">
                <th className="px-3 py-2.5 w-36">Mã danh mục</th>
                <th className="px-3 py-2.5 w-56">Tên danh mục</th>
                <th className="px-3 py-2.5 w-48">Danh mục cha</th>
                <th className="px-3 py-2.5 w-32 text-center">Số sản phẩm</th>
                <th className="px-3 py-2.5 w-28 text-center">Trạng thái</th>
                <th className="px-3 py-2.5 w-28 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle text-text-main">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-text-sub">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-brand" />
                    <span>Đang tải danh sách danh mục...</span>
                  </td>
                </tr>
              ) : filteredCategories.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-text-sub">
                    <FolderTree className="w-7 h-7 mx-auto mb-2 text-text-disabled" />
                    {categories.length === 0 ? (
                      <div>
                        <p className="font-medium text-text-main">Chưa có danh mục nào</p>
                        <p className="text-xs text-text-sub mt-0.5">
                          Nhấn nút &quot;+ Thêm danh mục&quot; để tạo danh mục đầu tiên.
                        </p>
                      </div>
                    ) : (
                      <p>Không tìm thấy danh mục nào phù hợp với bộ lọc.</p>
                    )}
                  </td>
                </tr>
              ) : (
                filteredCategories.map((cat) => {
                  const parent = cat.parent_id ? categoryMap.get(cat.parent_id) : null;
                  const prodCount = productCountMap[cat.id] || 0;
                  const isActive = cat.is_active !== false;

                  return (
                    <tr
                      key={cat.id}
                      className="hover:bg-surface-muted/50 transition-colors h-[38px]"
                    >
                      <td className="px-3 py-2 font-mono font-medium text-text-main">
                        {cat.code || <span className="text-text-disabled">—</span>}
                      </td>
                      <td className="px-3 py-2 font-medium text-text-main">
                        {cat.name}
                      </td>
                      <td className="px-3 py-2 text-text-sub">
                        {parent ? (
                          <span className="inline-flex items-center gap-1.5 font-medium text-text-main">
                            <span className="text-text-sub">↳</span>
                            {parent.name}
                          </span>
                        ) : (
                          <span className="text-text-disabled italic">Gốc</span>
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono tabular-nums text-center text-text-main">
                        {prodCount}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <Badge variant={isActive ? "inflow" : "default"}>
                          {isActive ? "Đang dùng" : "Vô hiệu"}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEdit(cat)}
                            className="h-7 px-2 text-xs gap-1 hover:text-brand"
                            title="Sửa danh mục"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            <span>Sửa</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenDelete(cat)}
                            className="h-7 px-2 text-xs gap-1 text-outflow hover:bg-rose-50 hover:text-rose-700"
                            title="Xóa danh mục"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Xóa</span>
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

        {/* Footer Row with Count */}
        {!isLoading && filteredCategories.length > 0 && (
          <div className="px-3 py-2 bg-surface-muted border-t border-border-subtle flex items-center justify-between text-xs text-text-sub">
            <span>
              Hiển thị <span className="font-mono font-medium text-text-main">{filteredCategories.length}</span> / {categories.length} danh mục
            </span>
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      <CategoryFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={loadData}
        category={editingCategory}
        categories={categories}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deletingCategory}
        title="Xóa danh mục sản phẩm"
        description={`Bạn có chắc chắn muốn xóa danh mục "${deletingCategory?.name}" (${deletingCategory?.code})? Hành động này không thể hoàn tác.`}
        confirmLabel="Xóa danh mục"
        cancelLabel="Hủy"
        variant="danger"
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingCategory(null)}
      />
    </div>
  );
}
