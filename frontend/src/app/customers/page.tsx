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
  Users,
  Plus,
  Edit2,
  Trash2,
  RefreshCw,
  Search,
  Phone,
  MapPin,
  Save,
  CreditCard,
  UserCheck,
} from "lucide-react";

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Partner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Partner | null>(null);
  const [deletingCustomer, setDeletingCustomer] = useState<Partner | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form State
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formPriceTier, setFormPriceTier] = useState("RETAIL");
  const [formCreditLimit, setFormCreditLimit] = useState<number>(0);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await api.getPartners("CUSTOMER");
      setCustomers(data || []);
    } catch (err: any) {
      setError(err.message || "Không thể tải danh sách khách hàng");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenCreate = () => {
    setEditingCustomer(null);
    setFormName("");
    setFormPhone("");
    setFormAddress("");
    setFormPriceTier("RETAIL");
    setFormCreditLimit(0);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (c: Partner) => {
    setEditingCustomer(c);
    setFormName(c.name);
    setFormPhone(c.phone || "");
    setFormAddress(c.address || "");
    setFormPriceTier(c.price_tier || "RETAIL");
    setFormCreditLimit(Number(c.credit_limit || 0));
    setIsModalOpen(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setError("Vui lòng nhập tên khách hàng");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const payload: Partial<Partner> = {
        name: formName.trim(),
        phone: formPhone.trim() || undefined,
        address: formAddress.trim() || undefined,
        partner_type: "CUSTOMER",
        price_tier: formPriceTier,
        credit_limit: formCreditLimit,
        is_active: true,
      };

      if (editingCustomer) {
        await api.updatePartner(editingCustomer.id, payload);
        setSuccessMsg(`Cập nhật khách hàng "${formName}" thành công!`);
      } else {
        await api.createPartner(payload);
        setSuccessMsg(`Thêm mới khách hàng "${formName}" thành công!`);
      }
      setIsModalOpen(false);
      await loadData();
    } catch (err: any) {
      setError(err.message || "Lỗi lưu khách hàng");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCustomer = async () => {
    if (!deletingCustomer) return;
    setIsDeleting(true);
    try {
      await api.deletePartner(deletingCustomer.id);
      setSuccessMsg(`Đã xóa khách hàng "${deletingCustomer.name}"!`);
      setDeletingCustomer(null);
      await loadData();
    } catch (err: any) {
      setError(err.message || "Lỗi xóa khách hàng");
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredCustomers = useMemo(() => {
    if (!searchTerm.trim()) return customers;
    const q = searchTerm.toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.toLowerCase().includes(q)) ||
        (c.address && c.address.toLowerCase().includes(q))
    );
  }, [customers, searchTerm]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      <PageHeader
        title="Quản Lý Khách Hàng (CRM)"
        description="Thông tin đối tác mua hàng, phân hạng khách hàng và quản lý thông tin liên hệ."
        badge={<Badge variant="brand">{customers.length} khách hàng</Badge>}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/finance/debts">
              <Button variant="secondary" size="sm">
                <CreditCard className="w-3.5 h-3.5 mr-1.5" />
                <span>Xem Sổ Công Nợ</span>
              </Button>
            </Link>
            <Button variant="secondary" size="sm" onClick={loadData} disabled={isLoading}>
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
              <span>Làm mới</span>
            </Button>
            <Button variant="primary" size="sm" onClick={handleOpenCreate}>
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              <span>Thêm khách hàng</span>
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
            placeholder="Tìm theo tên, số điện thoại, địa chỉ..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-surface-app border border-border-default rounded-lg focus:outline-none focus:border-brand text-text-main"
          />
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <LoadingState message="Đang tải danh sách khách hàng..." submessage="Hệ thống CRM" />
      ) : filteredCustomers.length === 0 ? (
        <div className="p-12 text-center bg-surface-card border border-dashed border-border-default rounded-xl space-y-3">
          <Users className="w-10 h-10 text-text-disabled mx-auto" />
          <h3 className="text-sm font-semibold text-text-main">Chưa có khách hàng nào</h3>
          <p className="text-xs text-text-sub">Bấm nút &quot;Thêm khách hàng&quot; để tạo hồ sơ khách hàng đầu tiên.</p>
        </div>
      ) : (
        <div className="bg-surface-card rounded-xl border border-border-default overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-surface-app text-text-sub font-semibold border-b border-border-default">
                <tr>
                  <th className="py-3 px-3.5">Tên khách hàng</th>
                  <th className="py-3 px-3.5">Số điện thoại</th>
                  <th className="py-3 px-3.5">Địa chỉ</th>
                  <th className="py-3 px-3.5 text-center">Phân hạng</th>
                  <th className="py-3 px-3.5 text-right">Hạn mức nợ</th>
                  <th className="py-3 px-3.5 text-center w-28">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-default bg-surface-card">
                {filteredCustomers.map((c) => (
                  <tr key={c.id} className="hover:bg-surface-app/50 transition-colors">
                    <td className="py-3 px-3.5 font-bold text-text-main flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-brand/10 text-brand flex items-center justify-center font-bold text-xs shrink-0">
                        {c.name.slice(0, 1).toUpperCase()}
                      </div>
                      <span>{c.name}</span>
                    </td>
                    <td className="py-3 px-3.5 font-mono text-text-main">
                      {c.phone ? (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3 text-text-sub shrink-0" />
                          <span>{c.phone}</span>
                        </span>
                      ) : (
                        <span className="text-text-disabled">-</span>
                      )}
                    </td>
                    <td className="py-3 px-3.5 text-text-sub">
                      {c.address ? (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-text-disabled shrink-0" />
                          <span className="truncate max-w-xs">{c.address}</span>
                        </span>
                      ) : (
                        <span className="text-text-disabled">-</span>
                      )}
                    </td>
                    <td className="py-3 px-3.5 text-center">
                      <Badge variant="default">
                        {c.price_tier === "WHOLESALE" ? "Khách buôn" : "Khách lẻ"}
                      </Badge>
                    </td>
                    <td className="py-3 px-3.5 text-right font-mono tabular-nums text-text-sub">
                      {Number(c.credit_limit || 0) > 0 ? (
                        formatVND(Number(c.credit_limit))
                      ) : (
                        <span className="text-text-disabled">Không giới hạn</span>
                      )}
                    </td>
                    <td className="py-3 px-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(c)}
                          className="p-1.5 text-text-sub hover:text-brand hover:bg-surface-app rounded"
                          title="Sửa khách hàng"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingCustomer(c)}
                          className="p-1.5 text-text-sub hover:text-rose-600 hover:bg-surface-app rounded"
                          title="Xóa khách hàng"
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
          title={editingCustomer ? "Chỉnh sửa Khách hàng" : "Thêm Khách hàng Mới"}
        >
          <form onSubmit={handleSaveCustomer} className="space-y-4 text-xs">
            <div>
              <label className="block text-[11px] font-semibold text-text-main mb-1">
                Tên khách hàng <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Ví dụ: Anh Nam, Chị Lan, Quán Ăn Đại Lộc..."
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="w-full px-3 py-2 bg-surface-app border border-border-default rounded-lg focus:outline-none focus:border-brand text-text-main font-medium"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-text-main mb-1">
                Số điện thoại
              </label>
              <input
                type="text"
                placeholder="0912 345 678"
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
                className="w-full px-3 py-2 bg-surface-app border border-border-default rounded-lg focus:outline-none focus:border-brand text-text-main font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-text-main mb-1">
                Địa chỉ giao hàng / cư trú
              </label>
              <input
                type="text"
                placeholder="Số nhà, đường, phường/xã, quận/huyện..."
                value={formAddress}
                onChange={(e) => setFormAddress(e.target.value)}
                className="w-full px-3 py-2 bg-surface-app border border-border-default rounded-lg focus:outline-none focus:border-brand text-text-main"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-text-main mb-1">
                  Nhóm khách / Phân hạng
                </label>
                <select
                  value={formPriceTier}
                  onChange={(e) => setFormPriceTier(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-app border border-border-default rounded-lg text-text-main focus:outline-none focus:border-brand"
                >
                  <option value="RETAIL">Khách lẻ (RETAIL)</option>
                  <option value="WHOLESALE">Khách buôn / Đại lý (WHOLESALE)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-text-main mb-1">
                  Hạn mức nợ tối đa (VND)
                </label>
                <input
                  type="number"
                  step="50000"
                  min="0"
                  placeholder="0 (Không hạn chế)"
                  value={formCreditLimit || ""}
                  onChange={(e) => setFormCreditLimit(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-surface-app border border-border-default rounded-lg text-right font-mono text-text-main focus:outline-none focus:border-brand"
                />
              </div>
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
                <span>{editingCustomer ? "Lưu thay đổi" : "Tạo khách hàng"}</span>
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Confirmation */}
      {deletingCustomer && (
        <ConfirmDialog
          isOpen={Boolean(deletingCustomer)}
          title={`Xác nhận xóa khách hàng: ${deletingCustomer.name}`}
          description="Hành động này sẽ xóa khách hàng khỏi danh sách CRM. Lịch sử các đơn hàng cũ vẫn được bảo lưu an toàn."
          confirmLabel="Xác nhận xóa"
          variant="danger"
          isLoading={isDeleting}
          onConfirm={handleDeleteCustomer}
          onCancel={() => setDeletingCustomer(null)}
        />
      )}
    </div>
  );
}
