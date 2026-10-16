"use client";

import React, { useEffect, useState, useMemo, Suspense } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { api, Partner } from "@/lib/api";
import { formatVND } from "@/lib/design-tokens";
import { cn } from "@/lib/utils";
import { Button } from "@/components/common/Button";
import { Input } from "@/components/common/Input";
import { Badge } from "@/components/common/Badge";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { PartnerFormModal } from "@/components/partners/PartnerFormModal";
import {
  Users,
  Truck,
  Plus,
  Search,
  Pencil,
  Trash2,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  X,
} from "lucide-react";

// ponytail: in-memory list filtering by role and status; upgrade to server-side cursor pagination when partners exceed 1000 records.
function PartnersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const [partners, setPartners] = useState<Partner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Sync tab with URL search parameter
  const typeParam = searchParams.get("type");
  const activeTab: "SUPPLIER" | "CUSTOMER" =
    typeParam === "SUPPLIER" ? "SUPPLIER" : "CUSTOMER";

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");

  // Form modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);

  // Deletion state
  const [deletingPartner, setDeletingPartner] = useState<Partner | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const loadPartners = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await api.getPartners();
      setPartners(data || []);
    } catch (err: any) {
      setLoadError(err.message || "Không thể tải danh sách đối tác.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPartners();
  }, []);

  const handleTabChange = (type: "SUPPLIER" | "CUSTOMER") => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("type", type);
    router.push(`${pathname}?${params.toString()}`);
  };

  // Tab counts
  const supplierCount = useMemo(
    () => partners.filter((p) => p.partner_type === "SUPPLIER" || p.partner_type === "BOTH").length,
    [partners]
  );
  const customerCount = useMemo(
    () => partners.filter((p) => p.partner_type === "CUSTOMER" || p.partner_type === "BOTH").length,
    [partners]
  );

  // Filtered partners
  const filteredPartners = useMemo(() => {
    return partners.filter((p) => {
      // Role tab match: dual-role entities appear in both tabs
      const matchesTab =
        activeTab === "SUPPLIER"
          ? p.partner_type === "SUPPLIER" || p.partner_type === "BOTH"
          : p.partner_type === "CUSTOMER" || p.partner_type === "BOTH";

      // Search match
      const search = searchTerm.trim().toLowerCase();
      const matchesSearch =
        !search ||
        p.name.toLowerCase().includes(search) ||
        (p.phone && p.phone.toLowerCase().includes(search)) ||
        (p.address && p.address.toLowerCase().includes(search));

      // Status match
      const isActive = p.is_active !== false;
      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" && isActive) ||
        (statusFilter === "INACTIVE" && !isActive);

      return matchesTab && matchesSearch && matchesStatus;
    });
  }, [partners, activeTab, searchTerm, statusFilter]);

  const handleOpenCreate = () => {
    setEditingPartner(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (partner: Partner) => {
    setEditingPartner(partner);
    setIsModalOpen(true);
  };

  const handleOpenDelete = (partner: Partner) => {
    setDeleteError(null);
    setDeletingPartner(partner);
  };

  const handleConfirmDelete = async () => {
    if (!deletingPartner) return;
    setIsDeleting(true);
    setDeleteError(null);

    try {
      await api.deletePartner(deletingPartner.id);
      const deletedName = deletingPartner.name;
      setDeletingPartner(null);
      setFeedback({
        type: "success",
        message: `Đã xóa đối tác "${deletedName}" thành công.`,
      });
      await loadPartners();
    } catch (err: any) {
      setDeletingPartner(null);
      // Display server error clearly (e.g. 409 Conflict: Đối tác đã phát sinh giao dịch, không thể xóa.)
      setDeleteError(err.message || "Không thể xóa đối tác.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Page Header with Tab Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border-subtle pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-brand shrink-0" />
            <h1 className="text-lg font-bold text-text-main">Quản lý Đối tác & Sổ Nợ</h1>
          </div>
          <p className="text-xs text-text-sub mt-0.5">
            Theo dõi danh sách khách hàng, nhà cung cấp, hạn mức nợ và công nợ phát sinh
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {/* Header Tab Switcher */}
          <div className="inline-flex p-0.5 bg-surface-app border border-border-default rounded-md">
            <button
              type="button"
              onClick={() => handleTabChange("SUPPLIER")}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-sm transition-colors flex items-center gap-1.5",
                activeTab === "SUPPLIER"
                  ? "bg-brand text-white shadow-xs font-semibold"
                  : "text-text-sub hover:text-text-main"
              )}
            >
              <Truck className="w-3.5 h-3.5" />
              Nhà cung cấp
              <span className={cn(
                "text-[10px] px-1.5 py-0.2 rounded-full font-mono tabular-nums",
                activeTab === "SUPPLIER" ? "bg-white/20 text-white" : "bg-surface-muted text-text-sub"
              )}>
                {supplierCount}
              </span>
            </button>
            <button
              type="button"
              onClick={() => handleTabChange("CUSTOMER")}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-sm transition-colors flex items-center gap-1.5",
                activeTab === "CUSTOMER"
                  ? "bg-brand text-white shadow-xs font-semibold"
                  : "text-text-sub hover:text-text-main"
              )}
            >
              <Users className="w-3.5 h-3.5" />
              Khách hàng
              <span className={cn(
                "text-[10px] px-1.5 py-0.2 rounded-full font-mono tabular-nums",
                activeTab === "CUSTOMER" ? "bg-white/20 text-white" : "bg-surface-muted text-text-sub"
              )}>
                {customerCount}
              </span>
            </button>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={loadPartners}
            disabled={isLoading}
            title="Làm mới danh sách"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Làm mới
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleOpenCreate}
            className="shadow-sm"
          >
            <Plus className="w-4 h-4" />
            + Thêm đối tác
          </Button>
        </div>
      </div>

      {/* Global Alerts / Feedback */}
      {feedback && (
        <div
          role="status"
          className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-md text-xs flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="p-0.5 text-emerald-600 hover:text-emerald-900 rounded-sm"
            aria-label="Đóng thông báo"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {deleteError && (
        <div
          role="alert"
          className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-md text-xs flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <div>
              <span className="font-semibold">Không thể xóa đối tác: </span>
              <span>{deleteError}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setDeleteError(null)}
            className="p-0.5 text-rose-600 hover:text-rose-900 rounded-sm"
            aria-label="Đóng cảnh báo lỗi"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {loadError && (
        <div
          role="alert"
          className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-md text-xs flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{loadError}</span>
          </div>
          <Button variant="outline" size="sm" onClick={loadPartners}>
            Thử lại
          </Button>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-surface-card border border-border-default rounded-md p-3">
        <div className="w-full sm:w-80">
          <Input
            placeholder="Tìm theo tên, số điện thoại, địa chỉ..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            leftIcon={<Search className="w-4 h-4" />}
          />
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <label className="text-xs text-text-sub whitespace-nowrap">Trạng thái:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "ALL" | "ACTIVE" | "INACTIVE")}
            className="h-9 bg-surface-card border border-border-default rounded-sm px-3 text-xs text-text-main focus:outline-none focus:border-border-focus focus:ring-1 focus:ring-border-focus transition-colors"
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="ACTIVE">Đang hoạt động</option>
            <option value="INACTIVE">Ngừng hoạt động</option>
          </select>
        </div>
      </div>

      {/* Table: compact density with row height ~38px, px-3 py-2 */}
      <div className="bg-surface-card border border-border-default rounded-md overflow-hidden shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-surface-muted border-b border-border-default text-text-sub font-medium uppercase tracking-wider select-none">
              <tr className="h-9">
                <th className="px-3 py-2 font-medium">Tên đối tác</th>
                <th className="px-3 py-2 font-medium">Số điện thoại</th>
                <th className="px-3 py-2 font-medium">Địa chỉ</th>
                <th className="px-3 py-2 font-medium text-right">Hạn mức nợ</th>
                <th className="px-3 py-2 font-medium text-right">Dư nợ hiện tại</th>
                <th className="px-3 py-2 font-medium text-center">Trạng thái</th>
                <th className="px-3 py-2 font-medium text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle text-text-main">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-text-sub">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-brand" />
                    Đang tải danh sách đối tác...
                  </td>
                </tr>
              ) : filteredPartners.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-text-sub">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    Không tìm thấy đối tác nào phù hợp.
                  </td>
                </tr>
              ) : (
                filteredPartners.map((partner) => {
                  const debt = partner.current_debt_balance ?? partner.current_debt ?? 0;
                  const debtNumber = typeof debt === "string" ? parseFloat(debt) : debt;
                  const isBoth = partner.partner_type === "BOTH";

                  return (
                    <tr
                      key={partner.id}
                      className="h-[38px] hover:bg-surface-muted/50 transition-colors"
                    >
                      <td className="px-3 py-2 font-medium text-text-main">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate max-w-xs">{partner.name}</span>
                          {isBoth && (
                            <Badge variant="matrix" className="text-[10px] py-0 px-1 font-normal">
                              Cả hai
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 font-mono tabular-nums text-text-sub">
                        {partner.phone || "—"}
                      </td>
                      <td className="px-3 py-2 text-text-sub">
                        <span className="truncate max-w-xs block" title={partner.address || ""}>
                          {partner.address || "—"}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono tabular-nums text-right text-text-main">
                        {formatVND(partner.credit_limit || 0)}
                      </td>
                      <td className="px-3 py-2 font-mono tabular-nums text-right text-outflow">
                        {formatVND(debtNumber)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {partner.is_active !== false ? (
                          <Badge variant="brand">Hoạt động</Badge>
                        ) : (
                          <Badge variant="default">Ngừng</Badge>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="inline-flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => handleOpenEdit(partner)}
                            title="Chỉnh sửa đối tác"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-text-sub hover:text-outflow"
                            onClick={() => handleOpenDelete(partner)}
                            title="Xóa đối tác"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Partner Create/Edit Form Modal */}
      <PartnerFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={loadPartners}
        partner={editingPartner}
        defaultType={activeTab}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deletingPartner}
        title="Xác nhận xóa đối tác"
        description={`Bạn có chắc chắn muốn xóa đối tác "${deletingPartner?.name}"? Dữ liệu đã xóa không thể phục hồi.`}
        confirmLabel="Xóa đối tác"
        cancelLabel="Hủy"
        variant="danger"
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingPartner(null)}
      />
    </div>
  );
}

export default function PartnersPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-12 text-xs text-text-sub">
          <RefreshCw className="w-4 h-4 animate-spin mr-2 text-brand" />
          Đang tải trang đối tác...
        </div>
      }
    >
      <PartnersContent />
    </Suspense>
  );
}
