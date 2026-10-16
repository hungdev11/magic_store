"use client";

import React, { useState, useEffect } from "react";
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/common/Button";
import { Input } from "@/components/common/Input";
import { api, Unit } from "@/lib/api";
import { AlertCircle } from "lucide-react";

export interface UnitFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  unit?: Unit | null;
}

// ponytail: standard unit modal form; upgrade to auto-suggesting ISO/GS1 standard UOMs if global trade interoperability needed.
export const UnitFormModal: React.FC<UnitFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  unit,
}) => {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = !!unit;

  useEffect(() => {
    if (isOpen) {
      if (unit) {
        setCode(unit.code || "");
        setName(unit.name || "");
        setDescription(unit.description || "");
        setIsActive(unit.is_active ?? true);
      } else {
        setCode("");
        setName("");
        setDescription("");
        setIsActive(true);
      }
      setError(null);
    }
  }, [isOpen, unit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedCode = code.trim().toUpperCase();
    const trimmedName = name.trim();

    if (!trimmedCode) {
      setError("Mã đơn vị tính không được để trống.");
      return;
    }
    if (!trimmedName) {
      setError("Tên đơn vị tính không được để trống.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      if (isEdit && unit) {
        await api.updateUnit(unit.id, {
          code: trimmedCode,
          name: trimmedName,
          description: description.trim(),
          is_active: isActive,
        });
      } else {
        await api.createUnit({
          code: trimmedCode,
          name: trimmedName,
          description: description.trim(),
          is_active: isActive,
        });
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Không thể lưu thông tin đơn vị tính.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      title={isEdit ? "Chỉnh sửa đơn vị tính" : "Thêm đơn vị tính mới"}
      description={
        isEdit
          ? "Cập nhật thông tin chi tiết của đơn vị tính."
          : "Tạo đơn vị tính mới để quản lý và quy đổi sản phẩm."
      }
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={isLoading}>
            Hủy
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            isLoading={isLoading}
          >
            {isEdit ? "Lưu thay đổi" : "Tạo đơn vị"}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-sm text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div>
          <Input
            id="unit-code"
            label="Mã đơn vị tính *"
            placeholder="VD: HOP, CAI, KG"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className="font-mono uppercase"
            autoFocus={!isEdit}
            required
          />
          <p className="text-[11px] text-text-sub mt-1">
            Mã định danh duy nhất viết hoa, dùng trong bảng quy đổi (VD: HOP, KG, GOI).
          </p>
        </div>

        <div>
          <Input
            id="unit-name"
            label="Tên đơn vị tính *"
            placeholder="VD: Hộp, Cái, Kilogram"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="unit-desc" className="block text-xs font-medium text-text-sub">
            Mô tả
          </label>
          <textarea
            id="unit-desc"
            rows={2}
            placeholder="Ghi chú chi tiết về đơn vị tính..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full bg-surface-card border border-border-default rounded-sm px-3 py-2 text-sm text-text-main placeholder:text-text-disabled focus:outline-none focus:border-border-focus focus:ring-1 focus:ring-border-focus transition-colors"
          />
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
              Kích hoạt đơn vị tính (cho phép sử dụng khi tạo sản phẩm)
            </span>
          </label>
        </div>
      </form>
    </Modal>
  );
};
