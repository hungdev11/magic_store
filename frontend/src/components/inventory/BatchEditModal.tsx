"use client";

import React, { useState, useEffect } from "react";
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/common/Button";
import { Input } from "@/components/common/Input";
import { BatchItem, api } from "@/lib/api";
import { formatQty } from "@/lib/design-tokens";
import { AlertCircle, Calendar, FileText } from "lucide-react";

export interface BatchEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  batch: BatchItem | null;
  onSuccess: (updatedBatch: BatchItem) => void;
}

// ponytail: direct form state synced on modal open; upgrade to react-hook-form + zod if batch validation rules expand.
export function BatchEditModal({
  isOpen,
  onClose,
  batch,
  onSuccess,
}: BatchEditModalProps) {
  const [expiryDate, setExpiryDate] = useState("");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (batch) {
      setExpiryDate(batch.expiry_date ? batch.expiry_date.split("T")[0] : "");
      setNotes(batch.notes || "");
      setError(null);
    }
  }, [batch, isOpen]);

  if (!batch) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      const payload: { notes?: string; expiry_date?: string | null } = {
        notes: notes.trim(),
        expiry_date: expiryDate ? new Date(`${expiryDate}T00:00:00Z`).toISOString() : null,
      };

      const updated = await api.updateBatch(batch.id, payload);
      onSuccess(updated);
      onClose();
    } catch (err: any) {
      setError(err.message || "Không thể cập nhật thông tin lô hàng.");
    } finally {
      setIsSaving(false);
    }
  };

  const productName = batch.variant?.product?.name || "Sản phẩm";
  const sku = batch.variant?.sku || batch.variant_id;
  const uom = batch.variant?.product?.base_uom || "";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <span>Sửa thông tin Lô hàng</span>
          <span className="font-mono text-sm px-2 py-0.5 bg-surface-muted border border-border-subtle rounded text-text-sub font-normal">
            {batch.batch_code}
          </span>
        </div>
      }
      description={`${productName} — SKU: ${sku}`}
      size="md"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={isSaving}>
            Hủy
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            isLoading={isSaving}
          >
            Lưu thay đổi
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-2.5 bg-outflow-light border border-outflow/20 rounded-sm text-xs text-outflow flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Read-only quick stats */}
        <div className="grid grid-cols-2 gap-3 p-3 bg-surface-muted/60 border border-border-subtle rounded-sm text-xs">
          <div>
            <span className="text-text-sub block">Tồn hiện tại / Ban đầu:</span>
            <span className="font-mono tabular-nums font-semibold text-text-main">
              {formatQty(batch.remaining_qty)} / {formatQty(batch.initial_qty)} {uom}
            </span>
          </div>
          <div>
            <span className="text-text-sub block">Nhà cung cấp:</span>
            <span className="font-medium text-text-main truncate block">
              {batch.supplier?.name || "—"}
            </span>
          </div>
        </div>

        {/* Expiry Date input */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label htmlFor="batch-expiry-date" className="block text-xs font-medium text-text-sub">
              Hạn sử dụng (HSD)
            </label>
            {expiryDate && (
              <button
                type="button"
                onClick={() => setExpiryDate("")}
                className="text-[11px] text-text-sub hover:text-text-main hover:underline"
              >
                Xóa hạn (Không thời hạn)
              </button>
            )}
          </div>
          <Input
            id="batch-expiry-date"
            type="date"
            value={expiryDate}
            onChange={(e) => setExpiryDate(e.target.value)}
            leftIcon={<Calendar className="w-4 h-4" />}
            className="font-mono tabular-nums"
          />
        </div>

        {/* Notes input */}
        <div className="space-y-1">
          <label htmlFor="batch-notes" className="block text-xs font-medium text-text-sub">
            Ghi chú lô
          </label>
          <div className="relative">
            <textarea
              id="batch-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Ghi chú về nguồn gốc, tình trạng lô hàng..."
              className="w-full bg-surface-card border border-border-default rounded-sm px-3 py-2 text-sm text-text-main placeholder:text-text-disabled focus:outline-none focus:border-border-focus focus:ring-1 focus:ring-border-focus transition-colors"
            />
          </div>
        </div>
      </form>
    </Modal>
  );
}
