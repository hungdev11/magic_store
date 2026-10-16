"use client";

import React, { useEffect, useState, useMemo, Suspense } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { api, Partner } from "@/lib/api";
import { formatVND } from "@/lib/design-tokens";
import { cn } from "@/lib/utils";
import {
  PageHeader,
  Button,
  Badge,
  ConfirmDialog,
  TableToolbar,
  AlertBanner,
} from "@/components/common";
import { PartnerFormModal } from "@/components/partners/PartnerFormModal";
import {
  Users,
  Truck,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
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
      const matchesTab =
        activeTab === "SUPPLIER"
          ? p.partner_type === "SUPPLIER" || p.partner_type === "BOTH"
          : p.partner_type === "CUSTOMER" || p.partner_type === "BOTH";

      const search = searchTerm.trim().toLowerCase();
      const matchesSearch =
        !search ||
        p.name.toLowerCase().includes(search) ||
        (p.phone && p.phone.toLowerCase().includes(search)) ||
        (p.address && p.address.toLowerCase().includes(search));

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
      setDeleteError(err.message || "Không thể xóa đối tác.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Page Header with Tab Switcher */}
      <PageHeader
        title="Quản lý Đối tác & Sổ Nợ"
        description="Theo dõi danh sách khách hàng, nhà cung cấp, hạn mức nợ và công nợ phát sinh."
        badge={
          <Badge variant="brand">
            {activeTab === "SUPPLIER" ? `${supplierCount} nhà cung cấp` : `${customerCount} khách hàng`}
          </Badge>
        }
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {/* Header Tab Switcher */}
            <div className="inline-flex p-0.5 bg-surface-muted border border-border-default rounded-sm">
              <button
                type="button"
                onClick={() => handleTabChange("SUPPLIER")}
                className={cn(
                  "px-2.5 py-1 text-xs font-medium rounded-sm transition-colors flex items-center gap-1.5",
                  activeTab === "SUPPLIER"
                    ? "bg-surface-card text-brand shadow-xs font-semibold"
                    : "text-text-sub hover:text-text-main"
                )}
              >
                <Truck className="w-3.5 h-3.5" />
                <span>Nhà cung cấp</span>
                <span className="text-[10px] font-mono tabular-nums opacity-80">
                  ({supplierCount})
                </span>
              </button>
              <button
                type="button"
                onClick={() => handleTabChange("CUSTOMER")}
                className={cn(
                  "px-2.5 py-1 text-xs font-medium rounded-sm transition-colors flex items-center gap-1.5",
                  activeTab === "CUSTOMER"
                    ? "bg-surface-card text-brand shadow-xs font-semibold"
                    : "text-text-sub hover:text-text-main"
                )}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Khách hàng</span>
                <span className="text-[10px] font-mono tabular-nums opacity-80">
                  ({customerCount})
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
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? "animate-spin text-brand" : ""}`} />
              <span>Làm mới</span>
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleOpenCreate}
            >
              <Plus className="w-4 h-4 mr-1.5" />
              <span>Thêm đối tác</span>
            </Button>
          </div>
        }
      />

      {/* Global Alerts / Feedback */}
      {feedback && (
        <AlertBanner
          type={feedback.type}
          message={feedback.message}
          onClose={() => setFeedback(null)}
        />
      )}

      {deleteError && (
        <AlertBanner
          type="error"
          message={`Không thể xóa đối tác: ${deleteError}`}
          onClose={() => setDeleteError(null)}
        />
      )}

      {loadError && (
        <AlertBanner
          type="error"
          message={loadError}
          onClose={() => setLoadError(null)}
        />
      )}

      {/* Filter Toolbar */}
      <TableToolbar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Tìm theo tên, số điện thoại, địa chỉ..."
        filters={
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-text-sub whitespace-nowrap">Trạng thái:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "ALL" | "ACTIVE" | "INACTIVE")}
              className="h-8 bg-surface-muted/50 border border-border-subtle rounded-sm px-2.5 text-xs text-text-main focus:outline-none focus:border-brand"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="ACTIVE">Đang hoạt động</option>
              <option value="INACTIVE">Ngừng hoạt động</option>
            </select>
          </div>
        }
      />

      {/* Table Section */}
      <div className="bg-surface-card border border-border-default rounded-md overflow-hidden shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-surface-muted border-b border-border-default text-text-sub font-semibold uppercase tracking-wider select-none text-[11px]">
              <tr className="h-9">
                <th className="px-3 py-2">Tên đối tác</th>
                <th className="px-3 py-2">Số điện thoại</th>
                <th className="px-3 py-2">Địa chỉ</th>
                <th className="px-3 py-2 text-right">Hạn mức nợ</th>
                <th className="px-3 py-2 text-right">Dư nợ hiện tại</th>
                <th className="px-3 py-2 text-center">Trạng thái</th>
                <th className="px-3 py-2 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle text-text-main">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-3 py-12 text-center text-text-sub">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-brand" />
                    <span>Đang tải danh sách đối tác...</span>
                  </td>
                </tr>
              ) : filteredPartners.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-12 text-center text-text-sub">
                    <Users className="w-7 h-7 mx-auto mb-2 text-text-disabled" />
                    <span>Không tìm thấy đối tác nào phù hợp.</span>
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
                      <td className="px-3 py-2 font-mono tabular-nums text-right text-outflow font-semibold">
                        {formatVND(debtNumber)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <Badge variant={partner.is_active !== false ? "brand" : "default"}>
                          {partner.is_active !== false ? "Hoạt động" : "Ngừng"}
                        </Badge>
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
    <Suspense fallback={<div className="p-8 text-center text-xs text-text-sub">Đang tải...</div>}>
      <PartnersContent />
    </Suspense>
  );
}
