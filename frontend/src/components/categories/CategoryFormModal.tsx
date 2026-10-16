"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/common/Button";
import { Input } from "@/components/common/Input";
import { SearchableSelect, SelectOption } from "@/components/common/SearchableSelect";
import { api, Category } from "@/lib/api";
import { slugify } from "@/lib/matrix-utils";
import { AlertCircle } from "lucide-react";

export interface CategoryFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  category?: Category | null;
  categories: Category[];
}

export const CategoryFormModal: React.FC<CategoryFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  category,
  categories,
}) => {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [isCodeCustomized, setIsCodeCustomized] = useState(false);
  const [parentId, setParentId] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = !!category;

  useEffect(() => {
    if (isOpen) {
      if (category) {
        setCode(category.code || "");
        setName(category.name || "");
        setParentId(category.parent_id || "");
        setIsActive(category.is_active ?? true);
        setIsCodeCustomized(true);
      } else {
        setCode("");
        setName("");
        setIsCodeCustomized(false);
        setParentId("");
        setIsActive(true);
      }
      setError(null);
    }
  }, [isOpen, category]);

  const handleNameChange = (val: string) => {
    setName(val);
    if (!isCodeCustomized && !isEdit) {
      setCode(slugify(val));
    }
  };

  // Compute excluded IDs (self + all descendants) to prevent cyclic hierarchy
  const excludedIds = useMemo(() => {
    if (!category) return new Set<string>();
    const descendants = new Set<string>([category.id]);
    const queue = [category.id];
    while (queue.length > 0) {
      const current = queue.shift()!;
      categories
        .filter((c) => c.parent_id === current)
        .forEach((child) => {
          if (!descendants.has(child.id)) {
            descendants.add(child.id);
            queue.push(child.id);
          }
        });
    }
    return descendants;
  }, [category, categories]);

  // Options for SearchableSelect
  const parentOptions = useMemo<SelectOption[]>(() => {
    const options: SelectOption[] = [
      {
        value: "",
        label: "-- Không có (Danh mục gốc) --",
      },
    ];

    categories
      .filter((c) => !excludedIds.has(c.id))
      .forEach((c) => {
        options.push({
          value: c.id,
          label: c.name,
          subLabel: c.code ? `Mã: ${c.code}` : undefined,
          badge: c.is_active === false ? "Vô hiệu" : undefined,
        });
      });

    return options;
  }, [categories, excludedIds]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Tên danh mục không được để trống.");
      return;
    }

    const trimmedCode = code.trim().toUpperCase() || slugify(trimmedName);

    setIsLoading(true);
    setError(null);

    const payload = {
      code: trimmedCode,
      name: trimmedName,
      parent_id: parentId.trim() ? parentId.trim() : null,
      is_active: isActive,
    };

    try {
      if (isEdit && category) {
        await api.updateCategory(category.id, payload);
      } else {
        await api.createCategory(payload);
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Không thể lưu thông tin danh mục.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      title={isEdit ? "Chỉnh sửa danh mục" : "Thêm danh mục mới"}
      description="Tên danh mục được dùng để phân loại sản phẩm trên POS và báo cáo tồn kho."
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={isLoading}>
            Hủy
          </Button>
          <Button variant="primary" size="sm" onClick={handleSubmit} isLoading={isLoading}>
            {isEdit ? "Lưu thay đổi" : "Tạo danh mục"}
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
            id="cat-name"
            label="Tên danh mục *"
            placeholder="VD: Hải sản tươi sống, Đồ uống đóng chai"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            autoFocus
            required
          />
        </div>

        <div>
          <Input
            id="cat-code"
            label="Mã danh mục (Tự động sinh từ tên)"
            placeholder="VD: HAI_SAN_TUOI_SONG, DO_UONG"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              setIsCodeCustomized(true);
            }}
            className="font-mono uppercase text-xs"
          />
          <p className="text-[11px] text-text-sub mt-1">
            Mã định danh tự động sinh, dùng cho phân loại và tích hợp dữ liệu.
          </p>
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-medium text-text-sub">
            Danh mục cha
          </label>
          <SearchableSelect
            options={parentOptions}
            value={parentId}
            onChange={setParentId}
            placeholder="-- Chọn danh mục cha --"
          />
          <p className="text-[11px] text-text-sub mt-1">
            Để trống nếu là danh mục cấp cao nhất.
          </p>
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
              Kích hoạt danh mục (cho phép gán sản phẩm)
            </span>
          </label>
        </div>
      </form>
    </Modal>
  );
};
