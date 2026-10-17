"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { api, Partner } from "@/lib/api";
import { formatVND } from "@/lib/design-tokens";
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
  Truck,
  Plus,
  Edit2,
  Trash2,
  RefreshCw,
  Search,
  Phone,
  MapPin,
  Save,
  CreditCard,
  Building2,
} from "lucide-react";

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Partner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Partner | null>(null);
  const [deletingSupplier, setDeletingSupplier] = useState<Partner | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form State
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formAddress, setFormAddress] = useState("");

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await api.getPartners("SUPPLIER");
      setSuppliers(data || []);
    } catch (err: any) {
      setError(err.message || "Không thể tải danh sách nhà cung cấp");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenCreate = () => {
    setEditingSupplier(null);
    setFormName("");
    setFormPhone("");
    setFormAddress("");
    setIsModalOpen(true);
  };

  const handleOpenEdit = (s: Partner) => {
    setEditingSupplier(s);
    setFormName(s.name);
    setFormPhone(s.phone || "");
    setFormAddress(s.address || "");
    setIsModalOpen(true);
  };

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setError("Vui lòng nhập tên nhà cung cấp");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const payload: Partial<Partner> = {
        name: formName.trim(),
        phone: formPhone.trim() || undefined,
        address: formAddress.trim() || undefined,
        partner_type: "SUPPLIER",
        is_active: true,
      };

      if (editingSupplier) {
        await api.updatePartner(editingSupplier.id, payload);
        setSuccessMsg(`Cập nhật NCC "${formName}" thành công!`);
      } else {
        await api.createPartner(payload);
        setSuccessMsg(`Thêm mới NCC "${formName}" thành công!`);
      }
      setIsModalOpen(false);
      await loadData();
    } catch (err: any) {
      setError(err.message || "Lỗi lưu nhà cung cấp");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSupplier = async () => {
    if (!deletingSupplier) return;
    setIsDeleting(true);
    try {
      await api.deletePartner(deletingSupplier.id);
      setSuccessMsg(`Đã xóa nhà cung cấp "${deletingSupplier.name}"!`);
      setDeletingSupplier(null);
      await loadData();
    } catch (err: any) {
      setError(err.message || "Lỗi xóa nhà cung cấp");
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredSuppliers = useMemo(() => {
    if (!searchTerm.trim()) return suppliers;
    const q = searchTerm.toLowerCase();
    return suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.phone && s.phone.toLowerCase().includes(q)) ||
        (s.address && s.address.toLowerCase().includes(q))
    );
  }, [suppliers, searchTerm]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      <PageHeader
        title="Quản Lý Nhà Cung Cấp"
        description="Danh bạ các nguồn cung ứng nguyên vật liệu, đầu mối phân phối và thông tin giao dịch."
        badge={<Badge variant="brand">{suppliers.length} đối tác cung ứng</Badge>}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/finance/debts">
              <Button variant="secondary" size="sm">
                <CreditCard className="w-3.5 h-3.5 mr-1.5" />
                <span>Công Nợ Phải Trả</span>
              </Button>
            </Link>
            <Button variant="secondary" size="sm" onClick={loadData} disabled={isLoading}>
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
              <span>Làm mới</span>
            </Button>
            <Button variant="primary" size="sm" onClick={handleOpenCreate}>
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              <span>Thêm nhà cung cấp</span>
            </Button>
          </div>
        }
      />

      {error && <AlertBanner type="error" message={error} onClose={() => setError(null)} />}
      {successMsg && <AlertBanner type="success" message={successMsg} onClose={() => setSuccessMsg(null)} />}

      {/* Search Toolbar */}
      <div className="bg-surface-card p-3.5 rounded-xl border border-border-default shadow-xs flex items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-text-sub absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Tìm theo tên nhà cung cấp, số điện thoại, địa chỉ..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-surface-app border border-border-default rounded-lg focus:outline-none focus:border-brand text-text-main"
          />
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <LoadingState message="Đang tải danh sách nhà cung cấp..." submessage="Nguồn hàng & Vật tư" />
      ) : filteredSuppliers.length === 0 ? (
        <div className="p-12 text-center bg-surface-card border border-dashed border-border-default rounded-xl space-y-3">
          <Truck className="w-10 h-10 text-text-disabled mx-auto" />
          <h3 className="text-sm font-semibold text-text-main">Chưa có nhà cung cấp nào</h3>
          <p className="text-xs text-text-sub">Bấm nút &quot;Thêm nhà cung cấp&quot; để thiết lập nguồn cung hàng hóa.</p>
        </div>
      ) : (
        <div className="bg-surface-card rounded-xl border border-border-default overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-surface-app text-text-sub font-semibold border-b border-border-default">
                <tr>
                  <th className="py-3 px-3.5">Tên nhà cung cấp / Công ty</th>
                  <th className="py-3 px-3.5">Số điện thoại liên hệ</th>
                  <th className="py-3 px-3.5">Địa chỉ kho bãi / Giao nhận</th>
                  <th className="py-3 px-3.5 text-center">Trạng thái</th>
                  <th className="py-3 px-3.5 text-center w-28">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-default bg-surface-card">
                {filteredSuppliers.map((s) => (
                  <tr key={s.id} className="hover:bg-surface-app/50 transition-colors">
                    <td className="py-3 px-3.5 font-bold text-text-main flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0 border border-indigo-200">
                        <Building2 className="w-3.5 h-3.5" />
                      </div>
                      <span>{s.name}</span>
                    </td>
                    <td className="py-3 px-3.5 font-mono text-text-main">
                      {s.phone ? (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3 text-text-sub shrink-0" />
                          <span>{s.phone}</span>
                        </span>
                      ) : (
                        <span className="text-text-disabled">-</span>
                      )}
                    </td>
                    <td className="py-3 px-3.5 text-text-sub">
                      {s.address ? (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-text-disabled shrink-0" />
                          <span className="truncate max-w-sm">{s.address}</span>
                        </span>
                      ) : (
                        <span className="text-text-disabled">-</span>
                      )}
                    </td>
                    <td className="py-3 px-3.5 text-center">
                      <Badge variant="inflow">Hợp tác</Badge>
                    </td>
                    <td className="py-3 px-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(s)}
                          className="p-1.5 text-text-sub hover:text-brand hover:bg-surface-app rounded"
                          title="Sửa nhà cung cấp"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingSupplier(s)}
                          className="p-1.5 text-text-sub hover:text-rose-600 hover:bg-surface-app rounded"
                          title="Xóa nhà cung cấp"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Add / Edit */}
      {isModalOpen && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={editingSupplier ? "Chỉnh sửa Nhà cung cấp" : "Thêm Nhà cung cấp Mới"}
        >
          <form onSubmit={handleSaveSupplier} className="space-y-4 text-xs">
            <div>
              <label className="block text-[11px] font-semibold text-text-main mb-1">
                Tên nhà cung cấp / Doanh nghiệp <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Ví dụ: Công ty TNHH Thủy Hải Sản Biển Đông, Cơ sở Bột Mì Minh Châu..."
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="w-full px-3 py-2 bg-surface-app border border-border-default rounded-lg focus:outline-none focus:border-brand text-text-main font-medium"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-text-main mb-1">
                Số điện thoại liên hệ
              </label>
              <input
                type="text"
                placeholder="028 3822 9999 / 0903 123 456"
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
                className="w-full px-3 py-2 bg-surface-app border border-border-default rounded-lg focus:outline-none focus:border-brand text-text-main font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-text-main mb-1">
                Địa chỉ trụ sở / Kho giao nhận
              </label>
              <input
                type="text"
                placeholder="Số nhà, đường, khu công nghiệp, quận/huyện, tỉnh/thành..."
                value={formAddress}
                onChange={(e) => setFormAddress(e.target.value)}
                className="w-full px-3 py-2 bg-surface-app border border-border-default rounded-lg focus:outline-none focus:border-brand text-text-main"
              />
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
                <span>{editingSupplier ? "Lưu thay đổi" : "Tạo nhà cung cấp"}</span>
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Confirmation */}
      {deletingSupplier && (
        <ConfirmDialog
          isOpen={Boolean(deletingSupplier)}
          title={`Xác nhận xóa nhà cung cấp: ${deletingSupplier.name}`}
          description="Hành động này sẽ xóa nhà cung cấp khỏi danh mục. Các phiếu nhập hàng quá khứ vẫn được lưu vết đầy đủ."
          confirmLabel="Xác nhận xóa"
          variant="danger"
          isLoading={isDeleting}
          onConfirm={handleDeleteSupplier}
          onCancel={() => setDeletingSupplier(null)}
        />
      )}
    </div>
  );
}
