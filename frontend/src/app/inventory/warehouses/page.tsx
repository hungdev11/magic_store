"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { api, Warehouse } from "@/lib/api";
import {
  PageHeader,
  Badge,
  Button,
  LoadingState,
  AlertBanner,
  Modal,
  ConfirmDialog,
} from "@/components/common";
import {
  Warehouse as WarehouseIcon,
  Plus,
  Edit2,
  Trash2,
  RefreshCw,
  Search,
  CheckCircle2,
  Star,
  MapPin,
  Save,
} from "lucide-react";

export default function WarehousesPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);
  const [deletingWarehouse, setDeletingWarehouse] = useState<Warehouse | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form State
  const [formName, setFormName] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formIsDefault, setFormIsDefault] = useState(false);
  const [formIsActive, setFormIsActive] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await api.getWarehouses();
      setWarehouses(data || []);
    } catch (err: any) {
      setError(err.message || "Không thể tải danh sách kho");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenCreate = () => {
    setEditingWarehouse(null);
    setFormName("");
    setFormCode("");
    setFormAddress("");
    setFormIsDefault(warehouses.length === 0);
    setFormIsActive(true);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (w: Warehouse) => {
    setEditingWarehouse(w);
    setFormName(w.name);
    setFormCode(w.code);
    setFormAddress(w.address || "");
    setFormIsDefault(w.is_default);
    setFormIsActive(w.is_active);
    setIsModalOpen(true);
  };

  const handleSaveWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setError("Vui lòng nhập tên kho");
      return;
    }

    const code = (formCode.trim() || formName.trim().toUpperCase().replace(/\s+/g, "_"));
    setIsSaving(true);
    setError(null);

    try {
      if (editingWarehouse) {
        await api.updateWarehouse(editingWarehouse.id, {
          name: formName.trim(),
          code,
          address: formAddress.trim() || undefined,
          is_default: formIsDefault,
          is_active: formIsActive,
        });
        setSuccessMsg(`Cập nhật kho "${formName}" thành công!`);
      } else {
        await api.createWarehouse({
          name: formName.trim(),
          code,
          address: formAddress.trim() || undefined,
          is_default: formIsDefault,
          is_active: formIsActive,
        });
        setSuccessMsg(`Tạo mới kho "${formName}" thành công!`);
      }
      setIsModalOpen(false);
      await loadData();
    } catch (err: any) {
      setError(err.message || "Lỗi lưu kho");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingWarehouse) return;
    if (deletingWarehouse.is_default) {
      setError("Không thể xóa kho mặc định của hệ thống.");
      setDeletingWarehouse(null);
      return;
    }

    setIsDeleting(true);
    try {
      await api.deleteWarehouse(deletingWarehouse.id);
      setSuccessMsg(`Đã xóa kho "${deletingWarehouse.name}"!`);
      setDeletingWarehouse(null);
      await loadData();
    } catch (err: any) {
      setError(err.message || "Lỗi xóa kho");
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredWarehouses = warehouses.filter((w) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      w.name.toLowerCase().includes(q) ||
      w.code.toLowerCase().includes(q) ||
      (w.address && w.address.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      <PageHeader
        title="Danh Mục Kho Bãi & Điểm Bán"
        description="Quản lý các địa điểm lưu kho, chi nhánh và điểm phân phối hàng hóa."
        badge={<Badge variant="brand">{warehouses.length} địa điểm</Badge>}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={loadData} disabled={isLoading}>
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
              <span>Làm mới</span>
            </Button>
            <Button variant="primary" size="sm" onClick={handleOpenCreate}>
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              <span>Thêm kho mới</span>
            </Button>
          </div>
        }
      />

      {error && (
        <AlertBanner type="error" message={error} onClose={() => setError(null)} />
      )}
      {successMsg && (
        <AlertBanner type="success" message={successMsg} onClose={() => setSuccessMsg(null)} />
      )}

      {/* Search Bar */}
      <div className="bg-surface-card p-3.5 rounded-xl border border-border-default shadow-xs flex items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-text-sub absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Tìm theo tên kho, mã kho, địa chỉ..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-surface-app border border-border-default rounded-lg focus:outline-none focus:border-brand text-text-main"
          />
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <LoadingState message="Đang tải danh sách kho bãi..." submessage="Hệ thống đa kho" />
      ) : filteredWarehouses.length === 0 ? (
        <div className="p-12 text-center bg-surface-card border border-dashed border-border-default rounded-xl space-y-3">
          <WarehouseIcon className="w-10 h-10 text-text-disabled mx-auto" />
          <h3 className="text-sm font-semibold text-text-main">Chưa có kho nào</h3>
          <p className="text-xs text-text-sub">Bấm nút &quot;Thêm kho mới&quot; để thiết lập chi nhánh đầu tiên.</p>
        </div>
      ) : (
        <div className="bg-surface-card rounded-xl border border-border-default overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-surface-app text-text-sub font-semibold border-b border-border-default">
                <tr>
                  <th className="py-3 px-3.5">Tên kho bãi</th>
                  <th className="py-3 px-3.5">Mã kho</th>
                  <th className="py-3 px-3.5">Địa chỉ</th>
                  <th className="py-3 px-3.5 text-center">Mặc định</th>
                  <th className="py-3 px-3.5 text-center">Trạng thái</th>
                  <th className="py-3 px-3.5 text-center w-28">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-default bg-surface-card">
                {filteredWarehouses.map((w) => (
                  <tr key={w.id} className="hover:bg-surface-app/50 transition-colors">
                    <td className="py-3 px-3.5 font-bold text-text-main flex items-center gap-2">
                      <WarehouseIcon className="w-4 h-4 text-brand" />
                      <span>{w.name}</span>
                    </td>
                    <td className="py-3 px-3.5 font-mono text-text-sub">{w.code}</td>
                    <td className="py-3 px-3.5 text-text-sub">
                      {w.address ? (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-text-disabled shrink-0" />
                          <span>{w.address}</span>
                        </span>
                      ) : (
                        <span className="text-text-disabled">-</span>
                      )}
                    </td>
                    <td className="py-3 px-3.5 text-center">
                      {w.is_default ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                          <span>Kho chính</span>
                        </span>
                      ) : (
                        <span className="text-text-disabled">-</span>
                      )}
                    </td>
                    <td className="py-3 px-3.5 text-center">
                      {w.is_active ? (
                        <Badge variant="inflow">Hoạt động</Badge>
                      ) : (
                        <Badge variant="default">Tạm đóng</Badge>
                      )}
                    </td>
                    <td className="py-3 px-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(w)}
                          className="p-1.5 text-text-sub hover:text-brand hover:bg-surface-app rounded"
                          title="Sửa kho"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {!w.is_default && (
                          <button
                            type="button"
                            onClick={() => setDeletingWarehouse(w)}
                            className="p-1.5 text-text-sub hover:text-rose-600 hover:bg-surface-app rounded"
                            title="Xóa kho"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={editingWarehouse ? "Chỉnh sửa Kho bãi" : "Thêm Kho bãi Mới"}
        >
          <form onSubmit={handleSaveWarehouse} className="space-y-4 text-xs">
            <div>
              <label className="block text-[11px] font-semibold text-text-main mb-1">
                Tên kho bãi <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Ví dụ: Kho Tổng, Kho Chi Nhánh 1, Điểm Bán 2..."
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="w-full px-3 py-2 bg-surface-app border border-border-default rounded-lg focus:outline-none focus:border-brand text-text-main font-medium"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-text-main mb-1">
                Mã kho (SKU/Code)
              </label>
              <input
                type="text"
                placeholder="VD: KHO_TONG, CN_QUAN1 (Để trống tự sinh)"
                value={formCode}
                onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 bg-surface-app border border-border-default rounded-lg focus:outline-none focus:border-brand text-text-main font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-text-main mb-1">
                Địa chỉ chi nhánh / Kho
              </label>
              <input
                type="text"
                placeholder="123 Nguyễn Văn Cừ, Quận 5, TP.HCM..."
                value={formAddress}
                onChange={(e) => setFormAddress(e.target.value)}
                className="w-full px-3 py-2 bg-surface-app border border-border-default rounded-lg focus:outline-none focus:border-brand text-text-main"
              />
            </div>

            <div className="pt-2 space-y-2 border-t border-border-subtle">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formIsDefault}
                  onChange={(e) => setFormIsDefault(e.target.checked)}
                  className="rounded text-brand focus:ring-brand"
                />
                <span className="font-semibold text-text-main">
                  Đặt làm Kho chính (Mặc định khi bán hàng & nhập hàng)
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                  className="rounded text-brand focus:ring-brand"
                />
                <span className="font-semibold text-text-main">
                  Đang hoạt động (Kích hoạt)
                </span>
              </label>
            </div>

            <div className="pt-3 border-t border-border-default flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setIsModalOpen(false)}
                disabled={isSaving}
              >
                Hủy
              </Button>
              <Button type="submit" variant="primary" size="sm" isLoading={isSaving} disabled={isSaving}>
                <Save className="w-3.5 h-3.5 mr-1" />
                <span>{editingWarehouse ? "Lưu thay đổi" : "Tạo kho"}</span>
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Confirmation */}
      {deletingWarehouse && (
        <ConfirmDialog
          isOpen={Boolean(deletingWarehouse)}
          title={`Xác nhận xóa kho: ${deletingWarehouse.name}`}
          description="Hành động này sẽ xóa kho khỏi danh mục chi nhánh. Các phiếu nhập xuất cũ vẫn được lưu trữ. Bạn có chắc chắn?"
          confirmLabel="Xác nhận xóa"
          variant="danger"
          isLoading={isDeleting}
          onConfirm={handleDelete}
          onCancel={() => setDeletingWarehouse(null)}
        />
      )}
    </div>
  );
}
