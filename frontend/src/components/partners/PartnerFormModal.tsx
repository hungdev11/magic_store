"use client";

import React, { useState, useEffect } from "react";
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/common/Button";
import { Input } from "@/components/common/Input";
import { api, Partner } from "@/lib/api";
import { AlertCircle } from "lucide-react";

export interface PartnerFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  partner?: Partner | null;
  defaultType?: "CUSTOMER" | "SUPPLIER" | "BOTH";
}

// ponytail: single modal for customer and supplier CRUD; upgrade to multi-step wizard if tax invoices, credit scoring, and multiple bank accounts required.
export const PartnerFormModal: React.FC<PartnerFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  partner,
  defaultType = "CUSTOMER",
}) => {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [partnerType, setPartnerType] = useState<"CUSTOMER" | "SUPPLIER" | "BOTH">(defaultType);
  const [priceTier, setPriceTier] = useState("RETAIL");
  const [creditLimit, setCreditLimit] = useState<string>("0");
  const [isActive, setIsActive] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = !!partner;

  useEffect(() => {
    if (isOpen) {
      if (partner) {
        setName(partner.name || "");
        setPhone(partner.phone || "");
        setAddress(partner.address || "");
        setPartnerType(partner.partner_type || defaultType);
        setPriceTier(partner.price_tier || "RETAIL");
        const limit = partner.credit_limit !== undefined && partner.credit_limit !== null
          ? String(partner.credit_limit)
          : "0";
        setCreditLimit(limit);
        setIsActive(partner.is_active ?? true);
      } else {
        setName("");
        setPhone("");
        setAddress("");
        setPartnerType(defaultType);
        setPriceTier("RETAIL");
        setCreditLimit("0");
        setIsActive(true);
      }
      setError(null);
    }
  }, [isOpen, partner, defaultType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Tên đối tác không được để trống.");
      return;
    }

    const parsedCreditLimit = parseFloat(creditLimit) || 0;
    if (parsedCreditLimit < 0) {
      setError("Hạn mức nợ không được là số âm.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const payload: Partial<Partner> = {
        name: trimmedName,
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
        partner_type: partnerType,
        price_tier: priceTier,
        credit_limit: parsedCreditLimit,
        is_active: isActive,
      };

      if (isEdit && partner) {
        await api.updatePartner(partner.id, payload);
      } else {
        await api.createPartner(payload);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Không thể lưu thông tin đối tác.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      title={
        isEdit
          ? `Chỉnh sửa đối tác: ${partner?.name}`
          : defaultType === "SUPPLIER"
          ? "Thêm nhà cung cấp mới"
          : "Thêm khách hàng mới"
      }
      description={
        isEdit
          ? "Cập nhật thông tin định danh, hạn mức nợ và trạng thái hoạt động."
          : "Nhập thông tin đối tác để quản lý giao dịch và công nợ."
      }
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={isLoading}>
            Hủy
          </Button>
          <Button variant="primary" size="sm" onClick={handleSubmit} isLoading={isLoading}>
            {isEdit ? "Lưu thay đổi" : "Tạo đối tác"}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-3.5">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-sm text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div>
          <Input
            id="partner-name"
            label="Tên đối tác *"
            placeholder="VD: Công ty Cổ phần Hải Sản Biển Đông, Anh Tuấn..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus={!isEdit}
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-text-sub">
              Loại đối tác *
            </label>
            <select
              value={partnerType}
              onChange={(e) =>
                setPartnerType(e.target.value as "CUSTOMER" | "SUPPLIER" | "BOTH")
              }
              className="w-full h-9 bg-surface-card border border-border-default rounded-sm px-3 text-xs text-text-main focus:outline-none focus:border-border-focus focus:ring-1 focus:ring-border-focus transition-colors"
            >
              <option value="CUSTOMER">Khách hàng</option>
              <option value="SUPPLIER">Nhà cung cấp</option>
              <option value="BOTH">Cả hai (Khách kiêm NCC)</option>
            </select>
          </div>

          <div>
            <Input
              id="partner-phone"
              label="Số điện thoại"
              placeholder="0912345678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="font-mono tabular-nums"
            />
          </div>
        </div>

        <div>
          <Input
            id="partner-address"
            label="Địa chỉ"
            placeholder="VD: 123 Lê Lợi, P. Bến Nghé, Q.1, TP.HCM"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Input
              id="partner-credit-limit"
              type="number"
              min="0"
              step="1000"
              label="Hạn mức nợ (VNĐ)"
              placeholder="0"
              value={creditLimit}
              onChange={(e) => setCreditLimit(e.target.value)}
              className="font-mono tabular-nums text-right"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-text-sub">
              Bảng giá áp dụng
            </label>
            <select
              value={priceTier}
              onChange={(e) => setPriceTier(e.target.value)}
              className="w-full h-9 bg-surface-card border border-border-default rounded-sm px-3 text-xs text-text-main focus:outline-none focus:border-border-focus focus:ring-1 focus:ring-border-focus transition-colors"
            >
              <option value="RETAIL">Giá bán lẻ (RETAIL)</option>
              <option value="WHOLESALE">Giá bán buôn/sỉ (WHOLESALE)</option>
              <option value="VIP">Giá VIP</option>
            </select>
          </div>
        </div>

        <div className="pt-1">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 rounded-sm border-border-default text-brand focus:ring-brand accent-emerald-600"
            />
            <span className="text-xs font-medium text-text-main">
              Đang hoạt động (cho phép tạo giao dịch bán/nhập hàng)
            </span>
          </label>
        </div>
      </form>
    </Modal>
  );
};
