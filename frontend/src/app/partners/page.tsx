"use client";

import React, { useEffect, useState, useMemo } from "react";
import { api, Partner } from "@/lib/api";
import { formatVND, getBadgeClasses } from "@/lib/design-tokens";
import {
  Users,
  UserPlus,
  Plus,
  Search,
  Phone,
  Building2,
  X,
  RefreshCw,
  AlertCircle,
  CreditCard,
  UserCheck,
  Truck,
} from "lucide-react";

// ponytail: minimal partner creation modal and list; upgrade to full ledger history, credit limit warnings, and payment vouchers in Phase 4

const PARTNER_TYPE_LABELS: Record<string, { label: string; badge: "info" | "brand" | "matrix" }> = {
  CUSTOMER: { label: "Khách hàng", badge: "brand" },
  SUPPLIER: { label: "Nhà cung cấp", badge: "info" },
  BOTH: { label: "Cả hai", badge: "matrix" },
};

const PRICE_TIER_LABELS: Record<string, string> = {
  RETAIL: "Giá bán lẻ",
  WHOLESALE: "Giá bán buôn/sỉ",
  VIP: "Giá VIP",
};

export default function PartnersPage() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [modalSubmitting, setModalSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // New partner form state
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newType, setNewType] = useState<"CUSTOMER" | "SUPPLIER" | "BOTH">("CUSTOMER");
  const [newPriceTier, setNewPriceTier] = useState("RETAIL");

  const loadPartners = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getPartners();
      setPartners(data || []);
    } catch (err: any) {
      setError(err.message || "Không thể tải danh sách đối tác");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPartners();
  }, []);

  const filteredPartners = useMemo(() => {
    return partners.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.phone && p.phone.includes(searchTerm));
      const matchesType = typeFilter === "ALL" || p.partner_type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [partners, searchTerm, typeFilter]);

  const handleCreatePartner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      setModalError("Vui lòng nhập tên đối tác");
      return;
    }

    setModalSubmitting(true);
    setModalError(null);

    try {
      await api.createPartner({
        name: newName.trim(),
        phone: newPhone.trim() || undefined,
        address: newAddress.trim() || undefined,
        partner_type: newType,
        price_tier: newPriceTier,
      });

      // Reset and close
      setNewName("");
      setNewPhone("");
      setNewAddress("");
      setNewType("CUSTOMER");
      setNewPriceTier("RETAIL");
      setShowModal(false);

      await loadPartners();
    } catch (err: any) {
      setModalError(err.message || "Không thể tạo đối tác mới");
    } finally {
      setModalSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border-subtle pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-6 h-6 text-brand" />
            <h1 className="text-xl font-bold text-text-main">
              Quản lý Đối tác & Sổ Nợ (Khách hàng & Nhà cung cấp)
            </h1>
          </div>
          <p className="text-xs text-text-sub mt-1">
            Theo dõi hạn mức nợ, lịch sử mua nợ và thu hồi công nợ theo thời gian thực
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadPartners}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-text-sub bg-surface-card border border-border-default rounded-lg hover:text-text-main hover:bg-surface-app transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Làm mới
          </button>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-brand rounded-lg hover:bg-brand-hover shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            Thêm đối tác mới
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={loadPartners}
            className="underline font-medium hover:text-rose-900"
          >
            Thử lại
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm theo tên, số điện thoại..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-surface-card border border-border-default rounded-lg focus:outline-none focus:border-brand text-text-main"
          />
        </div>

        <div className="flex items-center gap-1 bg-surface-card border border-border-default rounded-lg p-1 w-full sm:w-auto">
          {[
            { id: "ALL", label: "Tất cả" },
            { id: "CUSTOMER", label: "Khách hàng" },
            { id: "SUPPLIER", label: "Nhà cung cấp" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setTypeFilter(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                typeFilter === tab.id
                  ? "bg-brand text-white shadow-xs"
                  : "text-text-sub hover:text-text-main"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table listing partners */}
      <div className="bg-surface-card border border-border-subtle rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-app border-b border-border-subtle text-text-muted font-medium uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Tên đối tác</th>
                <th className="py-3 px-4">Số điện thoại</th>
                <th className="py-3 px-4">Loại đối tác</th>
                <th className="py-3 px-4">Bảng giá</th>
                <th className="py-3 px-4 text-right">Dư nợ hiện tại</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle text-text-main">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-text-muted">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-brand" />
                    Đang tải dữ liệu đối tác...
                  </td>
                </tr>
              ) : filteredPartners.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-text-muted">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    Chưa có đối tác nào phù hợp. Nhấn "Thêm đối tác mới" để bắt đầu.
                  </td>
                </tr>
              ) : (
                filteredPartners.map((partner) => {
                  const debt =
                    partner.current_debt_balance ?? partner.current_debt ?? 0;
                  const debtNumber = typeof debt === "string" ? parseFloat(debt) : debt;
                  const typeMeta = PARTNER_TYPE_LABELS[partner.partner_type] || {
                    label: partner.partner_type,
                    badge: "info" as const,
                  };

                  return (
                    <tr
                      key={partner.id}
                      className="hover:bg-surface-app/50 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="font-medium text-text-main">
                          {partner.name}
                        </div>
                        {partner.address && (
                          <div className="text-[11px] text-text-sub truncate max-w-xs">
                            {partner.address}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-text-sub font-mono">
                        {partner.phone || "-"}
                      </td>
                      <td className="py-3 px-4">
                        <span className={getBadgeClasses(typeMeta.badge)}>
                          {typeMeta.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-text-sub">
                        {PRICE_TIER_LABELS[partner.price_tier || "RETAIL"] ||
                          partner.price_tier ||
                          "Giá bán lẻ"}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold">
                        <span
                          className={
                            debtNumber > 0
                              ? "text-rose-600 font-mono"
                              : debtNumber < 0
                              ? "text-emerald-600 font-mono"
                              : "text-text-sub font-mono"
                          }
                        >
                          {formatVND(debtNumber)}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal create partner */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface-card rounded-xl border border-border-subtle shadow-dropdown w-full max-w-md p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-brand" />
                <h3 className="text-sm font-semibold text-text-main">
                  Thêm đối tác mới
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-text-sub hover:text-text-main p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {modalError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
                {modalError}
              </div>
            )}

            <form onSubmit={handleCreatePartner} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-text-main block mb-1">
                  Tên đối tác <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Công ty TNHH Hải Sản Biển Đông / Chị Lan..."
                  className="w-full text-xs px-3 py-2 bg-surface-app border border-border-default rounded-lg focus:outline-none focus:border-brand text-text-main"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-text-main block mb-1">
                  Loại đối tác
                </label>
                <select
                  value={newType}
                  onChange={(e) =>
                    setNewType(e.target.value as "CUSTOMER" | "SUPPLIER" | "BOTH")
                  }
                  className="w-full text-xs px-3 py-2 bg-surface-app border border-border-default rounded-lg focus:outline-none focus:border-brand text-text-main"
                >
                  <option value="CUSTOMER">Khách hàng</option>
                  <option value="SUPPLIER">Nhà cung cấp</option>
                  <option value="BOTH">Cả hai (Khách kiêm Nhà cung cấp)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-text-main block mb-1">
                  Số điện thoại
                </label>
                <input
                  type="text"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="0912345678"
                  className="w-full text-xs px-3 py-2 bg-surface-app border border-border-default rounded-lg focus:outline-none focus:border-brand text-text-main"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-text-main block mb-1">
                  Địa chỉ
                </label>
                <input
                  type="text"
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  placeholder="123 Trần Phú, Nha Trang..."
                  className="w-full text-xs px-3 py-2 bg-surface-app border border-border-default rounded-lg focus:outline-none focus:border-brand text-text-main"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-text-main block mb-1">
                  Bảng giá áp dụng
                </label>
                <select
                  value={newPriceTier}
                  onChange={(e) => setNewPriceTier(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-surface-app border border-border-default rounded-lg focus:outline-none focus:border-brand text-text-main"
                >
                  <option value="RETAIL">Giá bán lẻ (RETAIL)</option>
                  <option value="WHOLESALE">Giá bán buôn/sỉ (WHOLESALE)</option>
                  <option value="VIP">Giá khách quen/VIP</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border-subtle">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3 py-1.5 text-xs text-text-sub hover:text-text-main border border-border-default rounded-lg hover:bg-surface-app"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={modalSubmitting}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-brand rounded-lg hover:bg-brand-hover disabled:opacity-50"
                >
                  {modalSubmitting ? "Đang lưu..." : "Lưu đối tác"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
