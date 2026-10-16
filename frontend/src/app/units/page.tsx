"use client";

import React, { useEffect, useState, useMemo } from "react";
import { api, Unit } from "@/lib/api";
import {
  PageHeader,
  Button,
  Badge,
  ConfirmDialog,
  TableToolbar,
  AlertBanner,
} from "@/components/common";
import { UnitFormModal } from "@/components/units/UnitFormModal";
import {
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  Scale,
} from "lucide-react";

// ponytail: table pagination omitted; upgrade to server-side cursor pagination when unit catalog exceeds 500 items.
export default function UnitsPage() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");

  // Form Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);

  // Deletion state
  const [deletingUnit, setDeletingUnit] = useState<Unit | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const loadUnits = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await api.getUnits();
      setUnits(data || []);
    } catch (err: any) {
      setLoadError(err.message || "Không thể tải danh sách đơn vị tính.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUnits();
  }, []);

  const filteredUnits = useMemo(() => {
    return units.filter((u) => {
      const search = searchTerm.trim().toLowerCase();
      const matchesSearch =
        !search ||
        u.code.toLowerCase().includes(search) ||
        u.name.toLowerCase().includes(search) ||
        (u.description && u.description.toLowerCase().includes(search));

      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" && u.is_active) ||
        (statusFilter === "INACTIVE" && !u.is_active);

      return matchesSearch && matchesStatus;
    });
  }, [units, searchTerm, statusFilter]);

  const handleOpenCreate = () => {
    setEditingUnit(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (unit: Unit) => {
    setEditingUnit(unit);
    setIsModalOpen(true);
  };

  const handleOpenDelete = (unit: Unit) => {
    setDeleteError(null);
    setDeletingUnit(unit);
  };

  const handleConfirmDelete = async () => {
    if (!deletingUnit) return;
    setIsDeleting(true);
    setDeleteError(null);

    try {
      await api.deleteUnit(deletingUnit.id);
      const deletedName = deletingUnit.name;
      setDeletingUnit(null);
      setFeedback({
        type: "success",
        message: `Đã xóa đơn vị tính "${deletedName}" thành công.`,
      });
      await loadUnits();
    } catch (err: any) {
      setDeletingUnit(null);
      setDeleteError(err.message || "Không thể xóa đơn vị tính.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Page Header */}
      <PageHeader
        title="Quản lý Đơn vị tính"
        description="Danh mục đơn vị đo lường cơ sở và quy đổi cho sản phẩm, nguyên vật liệu và kiểm kê."
        badge={
          <Badge variant="brand">
            {units.length} đơn vị
          </Badge>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={loadUnits}
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
              <span>Thêm đơn vị tính</span>
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
        searchPlaceholder="Tìm theo mã, tên hoặc mô tả..."
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
              Tất cả ({units.length})
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
              Đang dùng ({units.filter((u) => u.is_active).length})
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
              Vô hiệu ({units.filter((u) => !u.is_active).length})
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
                <th className="px-3 py-2.5 w-32">Mã đơn vị</th>
                <th className="px-3 py-2.5 w-48">Tên đơn vị</th>
                <th className="px-3 py-2.5">Mô tả</th>
                <th className="px-3 py-2.5 w-28 text-center">Trạng thái</th>
                <th className="px-3 py-2.5 w-28 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle text-text-main">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-text-sub">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-brand" />
                    <span>Đang tải danh sách đơn vị tính...</span>
                  </td>
                </tr>
              ) : filteredUnits.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-text-sub">
                    <Scale className="w-7 h-7 mx-auto mb-2 text-text-disabled" />
                    {units.length === 0 ? (
                      <div>
                        <p className="font-semibold text-text-main">Chưa có đơn vị tính nào</p>
                        <p className="text-xs text-text-sub mt-0.5">
                          Nhấn nút &quot;Thêm đơn vị tính&quot; để bắt đầu thiết lập danh mục.
                        </p>
                      </div>
                    ) : (
                      <p>Không tìm thấy đơn vị tính nào phù hợp với bộ lọc.</p>
                    )}
                  </td>
                </tr>
              ) : (
                filteredUnits.map((unit) => (
                  <tr
                    key={unit.id}
                    className="hover:bg-surface-muted/50 transition-colors h-[38px]"
                  >
                    <td className="px-3 py-2 font-mono font-medium text-text-main">
                      {unit.code}
                    </td>
                    <td className="px-3 py-2 font-medium text-text-main">
                      {unit.name}
                    </td>
                    <td className="px-3 py-2 text-text-sub truncate max-w-xs">
                      {unit.description || <span className="text-text-disabled">—</span>}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <Badge variant={unit.is_active ? "inflow" : "default"}>
                        {unit.is_active ? "Đang dùng" : "Vô hiệu"}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEdit(unit)}
                          className="h-7 px-2 text-xs gap-1 hover:text-brand"
                          title="Sửa đơn vị tính"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          <span>Sửa</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenDelete(unit)}
                          className="h-7 px-2 text-xs gap-1 text-outflow hover:bg-rose-50 hover:text-rose-700"
                          title="Xóa đơn vị tính"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Xóa</span>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Form Modal */}
      <UnitFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        unit={editingUnit}
        onSuccess={async () => {
          setIsModalOpen(false);
          setFeedback({
            type: "success",
            message: editingUnit
              ? `Đã cập nhật đơn vị tính "${editingUnit.name}" thành công.`
              : "Đã tạo đơn vị tính mới thành công.",
          });
          await loadUnits();
        }}
      />

      {/* Confirm Deletion Dialog */}
      <ConfirmDialog
        isOpen={!!deletingUnit}
        title="Xác nhận xóa đơn vị tính"
        description={`Bạn có chắc muốn xóa đơn vị tính "${deletingUnit?.name}" (${deletingUnit?.code})? Hệ thống sẽ chặn xóa nếu đơn vị này đang được liên kết với sản phẩm hoặc bảng quy đổi.`}
        confirmLabel="Xóa đơn vị tính"
        cancelLabel="Hủy"
        variant="danger"
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingUnit(null)}
      />
    </div>
  );
}
