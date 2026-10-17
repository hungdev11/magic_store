"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  api,
  CashbookTransaction,
  CashbookSummary,
  CreateCashbookInput,
} from "@/lib/api";
import { formatVND } from "@/lib/design-tokens";
import {
  PageHeader,
  Badge,
  Button,
  LoadingState,
  AlertBanner,
  Modal,
} from "@/components/common";
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  Plus,
  RefreshCw,
  Search,
  Filter,
  CreditCard,
  Building2,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Calendar,
  Save,
} from "lucide-react";

const CASHBOOK_CATEGORIES: { key: string; label: string; type: "INFLOW" | "OUTFLOW" }[] = [
  { key: "SALES_REVENUE", label: "Doanh thu bán hàng POS", type: "INFLOW" },
  { key: "DEBT_COLLECTION", label: "Thu tiền nợ khách hàng", type: "INFLOW" },
  { key: "SUPPLIER_PAYMENT", label: "Chi trả nợ nhà cung cấp", type: "OUTFLOW" },
  { key: "RENT", label: "Chi phí thuê mặt bằng", type: "OUTFLOW" },
  { key: "ELECTRICITY", label: "Chi phí điện nước / Internet", type: "OUTFLOW" },
  { key: "ICE_PACKAGING", label: "Bao bì, đá lạnh, vật tư đóng gói", type: "OUTFLOW" },
  { key: "STAFF_WAGE", label: "Lương & Thưởng nhân viên", type: "OUTFLOW" },
  { key: "SHIPPING", label: "Phí vận chuyển / Giao hàng", type: "OUTFLOW" },
  { key: "OTHER_EXPENSE", label: "Chi phí vận hành khác", type: "OUTFLOW" },
];

export default function CashbookPage() {
  const [transactions, setTransactions] = useState<CashbookTransaction[]>([]);
  const [summary, setSummary] = useState<CashbookSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("ALL");
  const [filterCategory, setFilterCategory] = useState<string>("ALL");
  const [filterMethod, setFilterMethod] = useState<string>("ALL");
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Voucher Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<"INFLOW" | "OUTFLOW">("INFLOW");
  const [modalCategory, setModalCategory] = useState("OTHER_EXPENSE");
  const [modalAmount, setModalAmount] = useState<number>(0);
  const [modalMethod, setModalMethod] = useState<"CASH" | "BANK_TRANSFER">("CASH");
  const [modalDesc, setModalDesc] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [txs, sum] = await Promise.all([
        api.getCashbook(),
        api.getCashbookSummary(),
      ]);
      setTransactions(txs || []);
      setSummary(sum || null);
    } catch (err: any) {
      setError(err.message || "Không thể tải sổ quỹ");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenVoucher = (type: "INFLOW" | "OUTFLOW") => {
    setModalType(type);
    setModalCategory(type === "INFLOW" ? "DEBT_COLLECTION" : "OTHER_EXPENSE");
    setModalAmount(0);
    setModalMethod("CASH");
    setModalDesc("");
    setIsModalOpen(true);
  };

  const handleSaveVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (modalAmount <= 0) {
      setError("Số tiền giao dịch phải lớn hơn 0");
      return;
    }
    if (!modalDesc.trim()) {
      setError("Vui lòng nhập mô tả / lý do thu chi");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const payload: CreateCashbookInput = {
        transaction_type: modalType,
        category: modalCategory,
        amount: Number(modalAmount),
        payment_method: modalMethod,
        description: modalDesc.trim(),
      };
      await api.createCashbook(payload);
      setSuccessMsg(`Đã tạo phiếu ${modalType === "INFLOW" ? "THU" : "CHI"} thành công!`);
      setIsModalOpen(false);
      await loadData();
    } catch (err: any) {
      setError(err.message || "Lỗi tạo phiếu thu/chi");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      if (filterType !== "ALL" && t.transaction_type !== filterType) return false;
      if (filterCategory !== "ALL" && t.category !== filterCategory) return false;
      if (filterMethod !== "ALL" && t.payment_method !== filterMethod) return false;

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const descMatch = t.description.toLowerCase().includes(q);
        const partnerMatch = t.partner?.name && t.partner.name.toLowerCase().includes(q);
        const catMatch = t.category.toLowerCase().includes(q);
        if (!descMatch && !partnerMatch && !catMatch) return false;
      }

      return true;
    });
  }, [transactions, filterType, filterCategory, filterMethod, searchTerm]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      <PageHeader
        title="Sổ Quỹ Thu / Chi (Tiền Mặt & Ngân Hàng)"
        description="Theo dõi toàn bộ dòng tiền vào ra thực tế: doanh thu bán hàng, thu nợ, chi trả nhà cung cấp và chi phí vận hành."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={loadData} disabled={isLoading}>
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
              <span>Làm mới</span>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleOpenVoucher("OUTFLOW")}
              className="text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-300"
            >
              <ArrowDownLeft className="w-3.5 h-3.5 mr-1.5 text-rose-600" />
              <span>Lập phiếu Chi</span>
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleOpenVoucher("INFLOW")}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <ArrowUpRight className="w-3.5 h-3.5 mr-1.5" />
              <span>Lập phiếu Thu</span>
            </Button>
          </div>
        }
      />

      {error && <AlertBanner type="error" message={error} onClose={() => setError(null)} />}
      {successMsg && <AlertBanner type="success" message={successMsg} onClose={() => setSuccessMsg(null)} />}

      {/* KPI Cards: Net Balance, Cash, Bank */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Net Balance */}
        <div className="bg-surface-card p-4 rounded-xl border border-border-default shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-text-sub uppercase tracking-wider block">
              Tổng tồn quỹ thực tế
            </span>
            <div className="text-2xl font-bold font-mono text-brand mt-1 tabular-nums">
              {formatVND(Number(summary?.net_balance || 0))}
            </div>
            <div className="flex items-center gap-2 text-[10px] text-text-sub mt-1">
              <span>Thu: {formatVND(Number(summary?.total_inflow || 0))}</span>
              <span>•</span>
              <span>Chi: {formatVND(Number(summary?.total_outflow || 0))}</span>
            </div>
          </div>
          <div className="p-3 bg-brand/10 text-brand rounded-xl border border-brand/20">
            <Wallet className="w-6 h-6" />
          </div>
        </div>

        {/* Cash Balance */}
        <div className="bg-surface-card p-4 rounded-xl border border-border-default shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-text-sub uppercase tracking-wider block">
              Quỹ Tiền mặt tại két
            </span>
            <div className="text-2xl font-bold font-mono text-emerald-700 mt-1 tabular-nums">
              {formatVND(Number(summary?.cash_balance || 0))}
            </div>
            <div className="flex items-center gap-2 text-[10px] text-text-sub mt-1">
              <span>Thu: {formatVND(Number(summary?.cash_inflow || 0))}</span>
              <span>•</span>
              <span>Chi: {formatVND(Number(summary?.cash_outflow || 0))}</span>
            </div>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-200">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        {/* Bank Balance */}
        <div className="bg-surface-card p-4 rounded-xl border border-border-default shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-text-sub uppercase tracking-wider block">
              Tài khoản Ngân hàng
            </span>
            <div className="text-2xl font-bold font-mono text-text-main mt-1 tabular-nums">
              {formatVND(Number(summary?.bank_balance || 0))}
            </div>
            <div className="flex items-center gap-2 text-[10px] text-text-sub mt-1">
              <span>Thu: {formatVND(Number(summary?.bank_inflow || 0))}</span>
              <span>•</span>
              <span>Chi: {formatVND(Number(summary?.bank_outflow || 0))}</span>
            </div>
          </div>
          <div className="p-3 bg-surface-app text-text-sub rounded-xl border border-border-subtle">
            <CreditCard className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-surface-card p-3 rounded-xl border border-border-default shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-text-sub absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Tìm theo mô tả, đối tác, danh mục..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-surface-app border border-border-default rounded-lg focus:outline-none focus:border-brand text-text-main"
          />
        </div>

        {/* Dropdown Filters */}
        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
          {/* Type */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-surface-app border border-border-default rounded-lg text-text-main focus:outline-none focus:border-brand"
          >
            <option value="ALL">Tất cả luồng tiền</option>
            <option value="INFLOW">Thu tiền (+)</option>
            <option value="OUTFLOW">Chi tiền (-)</option>
          </select>

          {/* Category */}
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-surface-app border border-border-default rounded-lg text-text-main focus:outline-none focus:border-brand"
          >
            <option value="ALL">Tất cả hạng mục</option>
            {CASHBOOK_CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>

          {/* Method */}
          <select
            value={filterMethod}
            onChange={(e) => setFilterMethod(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-surface-app border border-border-default rounded-lg text-text-main focus:outline-none focus:border-brand"
          >
            <option value="ALL">Tất cả phương thức</option>
            <option value="CASH">Tiền mặt</option>
            <option value="BANK_TRANSFER">Ngân hàng / QR</option>
          </select>
        </div>
      </div>

      {/* Transactions Table */}
      {isLoading ? (
        <LoadingState message="Đang tải dữ liệu sổ quỹ..." submessage="Nhật ký thu chi" />
      ) : filteredTransactions.length === 0 ? (
        <div className="p-12 text-center bg-surface-card border border-dashed border-border-default rounded-xl space-y-3">
          <Wallet className="w-10 h-10 text-text-disabled mx-auto" />
          <h3 className="text-sm font-semibold text-text-main">Chưa có giao dịch thu chi phù hợp</h3>
          <p className="text-xs text-text-sub">Thử thay đổi bộ lọc hoặc tạo phiếu thu chi đầu tiên.</p>
        </div>
      ) : (
        <div className="bg-surface-card rounded-xl border border-border-default overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-surface-app text-text-sub font-semibold border-b border-border-default">
                <tr>
                  <th className="py-3 px-3.5">Thời gian</th>
                  <th className="py-3 px-3.5">Loại</th>
                  <th className="py-3 px-3.5 text-right">Số tiền</th>
                  <th className="py-3 px-3.5">Hạng mục thu / chi</th>
                  <th className="py-3 px-3.5 text-center">Phương thức</th>
                  <th className="py-3 px-3.5">Đối tác liên quan</th>
                  <th className="py-3 px-3.5">Nội dung diễn giải</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-default bg-surface-card">
                {filteredTransactions.map((tx) => {
                  const isInflow = tx.transaction_type === "INFLOW";
                  const catMatch = CASHBOOK_CATEGORIES.find((c) => c.key === tx.category);

                  return (
                    <tr key={tx.id} className="hover:bg-surface-app/50 transition-colors">
                      <td className="py-2.5 px-3.5 font-mono text-[11px] text-text-sub whitespace-nowrap">
                        {new Date(tx.created_at).toLocaleString("vi-VN")}
                      </td>
                      <td className="py-2.5 px-3.5 font-semibold">
                        {isInflow ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[11px] border border-emerald-200">
                            <ArrowUpRight className="w-3 h-3 text-emerald-600" />
                            <span>Thu (+)</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-rose-700 bg-rose-50 px-2 py-0.5 rounded text-[11px] border border-rose-200">
                            <ArrowDownLeft className="w-3 h-3 text-rose-600" />
                            <span>Chi (-)</span>
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3.5 text-right font-mono font-bold tabular-nums text-sm">
                        <span className={isInflow ? "text-emerald-700" : "text-rose-700"}>
                          {isInflow ? "+" : "-"}
                          {formatVND(Number(tx.amount))}
                        </span>
                      </td>
                      <td className="py-2.5 px-3.5 font-medium text-text-main">
                        {catMatch ? catMatch.label : tx.category}
                      </td>
                      <td className="py-2.5 px-3.5 text-center font-mono text-[11px]">
                        <span className="px-2 py-0.5 rounded bg-surface-app border border-border-subtle">
                          {tx.payment_method === "BANK_TRANSFER" ? "Ngân hàng" : "Tiền mặt"}
                        </span>
                      </td>
                      <td className="py-2.5 px-3.5 text-text-sub">
                        {tx.partner?.name || "-"}
                      </td>
                      <td className="py-2.5 px-3.5 text-text-main max-w-sm truncate" title={tx.description}>
                        {tx.description}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: LẬP PHIẾU THU / PHIẾU CHI
      ========================================================================= */}
      {isModalOpen && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={modalType === "INFLOW" ? "Lập Phiếu Thu Tiền" : "Lập Phiếu Chi Tiền"}
        >
          <form onSubmit={handleSaveVoucher} className="space-y-4 text-xs">
            <div>
              <label className="block text-[11px] font-semibold text-text-main mb-1">
                Số tiền giao dịch (VND) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="1000"
                step="1000"
                required
                value={modalAmount || ""}
                onChange={(e) => setModalAmount(Number(e.target.value))}
                className="w-full px-3 py-2 bg-surface-app border border-border-default rounded-lg text-right font-mono font-bold text-brand text-sm focus:outline-none focus:border-brand"
                placeholder="VD: 500.000"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-text-main mb-1">
                Hạng mục {modalType === "INFLOW" ? "thu" : "chi"}
              </label>
              <select
                value={modalCategory}
                onChange={(e) => setModalCategory(e.target.value)}
                className="w-full px-3 py-2 bg-surface-app border border-border-default rounded-lg text-text-main focus:outline-none focus:border-brand"
              >
                {CASHBOOK_CATEGORIES.filter((c) => c.type === modalType).map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-text-main mb-1">
                Phương thức thanh toán
              </label>
              <select
                value={modalMethod}
                onChange={(e) => setModalMethod(e.target.value as "CASH" | "BANK_TRANSFER")}
                className="w-full px-3 py-2 bg-surface-app border border-border-default rounded-lg text-text-main focus:outline-none focus:border-brand"
              >
                <option value="CASH">Tiền mặt (Két tiền)</option>
                <option value="BANK_TRANSFER">Chuyển khoản (Ngân hàng)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-text-main mb-1">
                Nội dung lý do thu / chi <span className="text-rose-500">*</span>
              </label>
              <textarea
                required
                rows={2}
                value={modalDesc}
                onChange={(e) => setModalDesc(e.target.value)}
                placeholder="Chi tiết lý do thanh toán tiền mặt bằng, tiền điện thoại, cước vận chuyển..."
                className="w-full px-3 py-2 bg-surface-app border border-border-default rounded-lg text-text-main focus:outline-none focus:border-brand"
              />
            </div>

            <div className="pt-3 border-t border-border-default flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setIsModalOpen(false)}
                disabled={isSubmitting}
              >
                Hủy
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                isLoading={isSubmitting}
                disabled={isSubmitting}
              >
                <Save className="w-3.5 h-3.5 mr-1" />
                <span>Lưu phiếu {modalType === "INFLOW" ? "Thu" : "Chi"}</span>
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
