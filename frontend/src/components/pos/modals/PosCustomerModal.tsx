"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { api, type Partner } from "@/lib/api";
import { formatVND } from "@/lib/design-tokens";
import { Modal, Button, Input, Badge } from "@/components/common";
import { User, Search, UserPlus, Phone, ArrowLeft, Check } from "lucide-react";

export interface PosCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  customers: Partner[];
  selectedCustomer: Partner | null;
  onSelectCustomer: (customer: Partner | null) => void;
  onCustomerCreated?: (newCustomer: Partner) => void;
}

// ponytail: fast customer creation captures name and phone inline; upgrade to full partner master dialog if tax code or billing address needed.
export const PosCustomerModal: React.FC<PosCustomerModalProps> = ({
  isOpen,
  onClose,
  customers,
  selectedCustomer,
  onSelectCustomer,
  onCustomerCreated,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const newNameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSearchQuery("");
      setIsCreating(false);
      setNewName("");
      setNewPhone("");
      setCreateError(null);
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isCreating) {
      setTimeout(() => {
        newNameInputRef.current?.focus();
      }, 50);
    }
  }, [isCreating]);

  const filteredCustomers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.toLowerCase().includes(q)) ||
        c.id.toLowerCase().includes(q)
    );
  }, [customers, searchQuery]);

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = newName.trim();
    const trimmedPhone = newPhone.trim();

    if (!trimmedName) {
      setCreateError("Vui lòng nhập tên khách hàng.");
      return;
    }

    setIsSubmitting(true);
    setCreateError(null);

    try {
      const created = await api.createPartner({
        name: trimmedName,
        phone: trimmedPhone || undefined,
        partner_type: "CUSTOMER",
      });

      onCustomerCreated?.(created);
      onSelectCustomer(created);
      onClose();
    } catch (err: any) {
      setCreateError(err.message || "Không thể tạo khách hàng. Vui lòng thử lại.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      title={
        <div className="flex items-center gap-2">
          <User className="w-5 h-5 text-brand" />
          <span>{isCreating ? "Tạo Nhanh Khách Hàng" : "Chọn Khách Hàng (F4)"}</span>
        </div>
      }
      description={
        isCreating
          ? "Đăng ký thông tin khách mới ngay tại quầy"
          : "Tìm kiếm theo Tên, Số điện thoại hoặc Mã khách"
      }
      footer={
        <div className="flex items-center justify-between w-full">
          {isCreating ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsCreating(false);
                  setCreateError(null);
                }}
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                <span>Quay lại tìm</span>
              </Button>
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="md" onClick={onClose}>
                  Hủy
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleCreateCustomer}
                  isLoading={isSubmitting}
                >
                  Lưu & Chọn
                </Button>
              </div>
            </>
          ) : (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsCreating(true)}
              >
                <UserPlus className="w-3.5 h-3.5 mr-1" />
                <span>+ Tạo khách mới</span>
              </Button>
              <Button variant="secondary" size="md" onClick={onClose}>
                Đóng
              </Button>
            </>
          )}
        </div>
      }
    >
      {isCreating ? (
        /* Create New Customer Form */
        <form onSubmit={handleCreateCustomer} className="space-y-3">
          <Input
            ref={newNameInputRef}
            id="new-customer-name"
            label="Họ và tên khách hàng *"
            placeholder="Ví dụ: Anh Nam, Chị Linh..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            required
          />

          <Input
            id="new-customer-phone"
            label="Số điện thoại"
            placeholder="Ví dụ: 0912345678"
            type="tel"
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value)}
            leftIcon={<Phone className="w-4 h-4" />}
          />

          {createError && (
            <p className="text-xs text-outflow font-medium">{createError}</p>
          )}
        </form>
      ) : (
        /* Search & Customer Selection List */
        <div className="space-y-3">
          <Input
            ref={searchInputRef}
            id="customer-search-input"
            placeholder="Tìm theo tên hoặc số điện thoại..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search className="w-4 h-4" />}
            autoFocus
          />

          {/* Quick Option: Walk-in Retail Customer */}
          <button
            type="button"
            onClick={() => {
              onSelectCustomer(null);
              onClose();
            }}
            className={`w-full p-2.5 rounded-sm border text-left text-xs font-semibold transition-colors flex items-center justify-between ${
              selectedCustomer === null
                ? "bg-brand/10 border-brand text-brand"
                : "bg-surface-card hover:bg-surface-muted border-border-default text-text-sub"
            }`}
          >
            <span>Khách lẻ (Vãng lai) - Không ghi nợ</span>
            {selectedCustomer === null && <Check className="w-4 h-4 text-brand" />}
          </button>

          {/* Customer Result Rows */}
          <div className="space-y-1.5 max-h-72 overflow-y-auto pr-0.5">
            {filteredCustomers.length === 0 ? (
              <div className="p-6 text-center text-text-sub text-xs">
                Không tìm thấy khách hàng phù hợp. Bấm "+ Tạo khách mới" để đăng ký nhanh.
              </div>
            ) : (
              filteredCustomers.map((cust) => {
                const isSelected = selectedCustomer?.id === cust.id;
                const debt = Number(cust.current_debt_balance ?? cust.current_debt ?? 0);

                return (
                  <button
                    key={cust.id}
                    type="button"
                    onClick={() => {
                      onSelectCustomer(cust);
                      onClose();
                    }}
                    className={`w-full p-2.5 rounded-sm border text-left transition-colors flex items-center justify-between ${
                      isSelected
                        ? "bg-brand/5 border-brand"
                        : "bg-surface-card hover:bg-surface-muted border-border-default"
                    }`}
                  >
                    <div>
                      <div className="font-semibold text-text-main text-xs">{cust.name}</div>
                      <div className="text-[11px] text-text-sub font-mono tabular-nums mt-0.5 flex items-center gap-2">
                        <span>{cust.phone || "Chưa có SĐT"}</span>
                        {cust.price_tier && (
                          <span className="text-text-disabled">• Hạng {cust.price_tier}</span>
                        )}
                      </div>
                    </div>

                    <div className="text-right flex items-center gap-2">
                      {debt > 0 ? (
                        <span className="text-xs font-mono tabular-nums font-semibold px-2 py-0.5 rounded-sm bg-amber-50 text-amber-800 border border-amber-200">
                          Nợ: {formatVND(debt)}
                        </span>
                      ) : (
                        <span className="text-xs font-mono tabular-nums text-text-sub">
                          Nợ: 0 ₫
                        </span>
                      )}
                      {isSelected && <Check className="w-4 h-4 text-brand" />}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </Modal>
  );
};
