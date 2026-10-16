"use client";

import React, { useEffect, useState, useMemo } from "react";
import { api, Category, Product } from "@/lib/api";
import {
  PageHeader,
  Button,
  Badge,
  ConfirmDialog,
  TableToolbar,
  AlertBanner,
} from "@/components/common";
import { CategoryFormModal } from "@/components/categories/CategoryFormModal";
import {
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  FolderTree,
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

  const categoryMap = useMemo(() => {
    const map = new Map<string, Category>();
    categories.forEach((cat) => {
      map.set(cat.id, cat);
    });
    return map;
  }, [categories]);

  const productCountMap = useMemo(() => {
    const counts: Record<string, number> = {};
    products.forEach((prod) => {
      if (prod.category_id) {
        counts[prod.category_id] = (counts[prod.category_id] || 0) + 1;
      }
    });
    return counts;
  }, [products]);

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
      setDeleteError(err.message || "Không thể xóa danh mục.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Page Header */}
      <PageHeader
        title="Quản lý Danh mục Sản phẩm"
        description="Thiết lập danh mục phân cấp cho hàng hóa, nguyên vật liệu và phân bổ tồn kho."
        badge={
          <Badge variant="brand">
            {categories.length} danh mục
          </Badge>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={loadData}
              disabled={isLoading}
              title="Làm mới danh sách"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? "animate-spin text-brand" : ""}`} />
              <span>Làm mới</span>
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleOpenCreate}
            >
              <Plus className="w-4 h-4 mr-1.5" />
              <span>Thêm danh mục</span>
            </Button>
          </div>
        }
      />

      {/* Global Alerts / Feedback */}
      {feedback && (
        <AlertBanner
          type={feedback.type}
          message={feedback.message}
          onClose={() => setFeedback(null)}
        />
      )}

      {deleteError && (
        <AlertBanner
          type="error"
          message={`Không thể xóa: ${deleteError}`}
          onClose={() => setDeleteError(null)}
        />
      )}

      {loadError && (
        <AlertBanner
          type="error"
          message={loadError}
          onClose={() => setLoadError(null)}
        />
      )}

      {/* Search & Filter Bar */}
      <TableToolbar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Tìm theo mã hoặc tên danh mục..."
        actions={
          <div className="inline-flex items-center p-0.5 bg-surface-muted border border-border-default rounded-sm text-xs">
            <button
              type="button"
              onClick={() => setStatusFilter("ALL")}
              className={`px-2.5 py-1 font-medium rounded-sm transition-colors ${
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
              className={`px-2.5 py-1 font-medium rounded-sm transition-colors ${
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
              className={`px-2.5 py-1 font-medium rounded-sm transition-colors ${
                statusFilter === "INACTIVE"
                  ? "bg-surface-card text-text-main shadow-xs"
                  : "text-text-sub hover:text-text-main"
              }`}
            >
              Vô hiệu ({categories.filter((c) => c.is_active === false).length})
            </button>
          </div>
        }
      />

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
                        <p className="font-semibold text-text-main">Chưa có danh mục nào</p>
                        <p className="text-xs text-text-sub mt-0.5">
                          Nhấn nút &quot;Thêm danh mục&quot; để tạo danh mục đầu tiên.
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
      </div>

      {/* Form Modal */}
      <CategoryFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        category={editingCategory}
        categories={categories}
        onSuccess={async () => {
          setIsModalOpen(false);
          setFeedback({
            type: "success",
            message: editingCategory
              ? `Đã cập nhật danh mục "${editingCategory.name}" thành công.`
              : "Đã tạo danh mục mới thành công.",
          });
          await loadData();
        }}
      />

      {/* Confirm Deletion Dialog */}
      <ConfirmDialog
        isOpen={!!deletingCategory}
        title="Xác nhận xóa danh mục"
        description={`Bạn có chắc muốn xóa danh mục "${deletingCategory?.name}"? Hệ thống sẽ chặn xóa nếu danh mục đang chứa sản phẩm hoặc có danh mục con.`}
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
