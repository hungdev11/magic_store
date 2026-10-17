"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  api,
  DebtPartnerItem,
  DebtLedgerEntry,
  RecordDebtPaymentInput,
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
  CreditCard,
  TrendingDown,
  TrendingUp,
  RefreshCw,
  Search,
  CheckCircle2,
  DollarSign,
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
  History,
  Building2,
  Users,
  Wallet,
  Calendar,
} from "lucide-react";

export default function DebtsManagementPage() {
  const [activeTab, setActiveTab] = useState<"CUSTOMER" | "SUPPLIER">("CUSTOMER");
  const [debts, setDebts] = useState<DebtPartnerItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Payment Modal State
  const [paymentModalPartner, setPaymentModalPartner] = useState<DebtPartnerItem | null>(null);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payMethod, setPayMethod] = useState<"CASH" | "BANK_TRANSFER">("CASH");
  const [payNote, setPayNote] = useState("");
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  // History Drawer State
  const [historyPartner, setHistoryPartner] = useState<DebtPartnerItem | null>(null);
  const [ledgerEntries, setLedgerEntries] = useState<DebtLedgerEntry[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await api.getDebts({ type: activeTab });
      setDebts(data || []);
    } catch (err: any) {
      setError(err.message || "Không thể tải sổ công nợ");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const handleOpenPaymentModal = (p: DebtPartnerItem) => {
    setPaymentModalPartner(p);
    const bal = Math.max(0, Number(p.current_debt_balance || 0));
    setPayAmount(bal);
    setPayMethod("CASH");
    setPayNote(
      p.partner_type === "CUSTOMER"
        ? `Thu tiền nợ từ ${p.name}`
        : `Thanh toán công nợ cho ${p.name}`
    );
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentModalPartner) return;
    if (payAmount <= 0) {
      setError("Số tiền thanh toán phải lớn hơn 0");
      return;
    }

    setIsSubmittingPayment(true);
    setError(null);
    try {
      const payload: RecordDebtPaymentInput = {
        partner_id: paymentModalPartner.id,
        amount: Number(payAmount),
        payment_method: payMethod,
        note: payNote.trim(),
      };
      await api.recordDebtPayment(payload);
      setSuccessMsg(
        paymentModalPartner.partner_type === "CUSTOMER"
          ? `Đã thu ${formatVND(payAmount)} từ khách hàng "${paymentModalPartner.name}". Đã tự động ghi phiếu Thu vào sổ quỹ!`
          : `Đã chi ${formatVND(payAmount)} thanh toán cho NCC "${paymentModalPartner.name}". Đã tự động ghi phiếu Chi vào sổ quỹ!`
      );
      setPaymentModalPartner(null);
      await loadData();
    } catch (err: any) {
      setError(err.message || "Lỗi xử lý giao dịch công nợ");
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const handleViewHistory = async (p: DebtPartnerItem) => {
    setHistoryPartner(p);
    setIsLoadingHistory(true);
    try {
      const entries = await api.getPartnerDebtHistory(p.id);
      setLedgerEntries(entries || []);
    } catch (err: any) {
      setError(err.message || "Lỗi tải lịch sử công nợ");
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Metrics
  const metrics = useMemo(() => {
    let totalDebt = 0;
    let partnersWithDebt = 0;
    debts.forEach((d) => {
      const bal = Number(d.current_debt_balance || 0);
      if (bal > 0) {
        totalDebt += bal;
        partnersWithDebt++;
      }
    });
    return {
      totalDebt,
      partnersWithDebt,
      totalPartners: debts.length,
    };
  }, [debts]);

  const filteredDebts = useMemo(() => {
    if (!searchTerm.trim()) return debts;
    const q = searchTerm.toLowerCase();
    return debts.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        (d.phone && d.phone.toLowerCase().includes(q))
    );
  }, [debts, searchTerm]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      <PageHeader
        title="Quản Lý Sổ Công Nợ (Phải Thu / Phải Trả)"
        description="Theo dõi nợ mua hàng POS của khách hàng và công nợ mua hàng với các nhà cung cấp."
        actions={
          <div className="flex items-center gap-2">
            <Link href="/finance/cashbook">
              <Button variant="secondary" size="sm">
                <Wallet className="w-3.5 h-3.5 mr-1.5" />
                <span>Sổ quỹ Thu/Chi</span>
              </Button>
            </Link>
            <Button variant="secondary" size="sm" onClick={loadData} disabled={isLoading}>
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
              <span>Làm mới</span>
            </Button>
          </div>
        }
      />

      {error && <AlertBanner type="error" message={error} onClose={() => setError(null)} />}
      {successMsg && <AlertBanner type="success" message={successMsg} onClose={() => setSuccessMsg(null)} />}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-surface-card p-4 rounded-xl border border-border-default shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-text-sub uppercase tracking-wider block">
              {activeTab === "CUSTOMER" ? "Tổng nợ phải thu (Khách nợ)" : "Tổng nợ phải trả (Nợ NCC)"}
            </span>
            <div
              className={`text-2xl font-bold font-mono mt-1 tabular-nums ${
                activeTab === "CUSTOMER" ? "text-amber-600" : "text-rose-600"
              }`}
            >
              {formatVND(metrics.totalDebt)}
            </div>
            <span className="text-[10px] text-text-disabled">
              {metrics.partnersWithDebt} đối tác đang có dư nợ
            </span>
          </div>
          <div
            className={`p-3 rounded-xl border ${
              activeTab === "CUSTOMER"
                ? "bg-amber-50 text-amber-700 border-amber-200"
                : "bg-rose-50 text-rose-700 border-rose-200"
            }`}
          >
            <CreditCard className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-surface-card p-4 rounded-xl border border-border-default shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-text-sub uppercase tracking-wider block">
              Đối tác có dư nợ
            </span>
            <div className="text-2xl font-bold font-mono text-text-main mt-1 tabular-nums">
              {metrics.partnersWithDebt} / {metrics.totalPartners}
            </div>
            <span className="text-[10px] text-text-disabled">Hồ sơ đối tác quản lý</span>
          </div>
          <div className="p-3 bg-surface-app text-text-sub rounded-xl border border-border-subtle">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-surface-card p-4 rounded-xl border border-border-default shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-text-sub uppercase tracking-wider block">
              Tác nghiệp liên kết
            </span>
            <div className="text-xs font-medium text-text-main mt-2 leading-relaxed">
              Thu / Trả nợ tự động sinh giao dịch tương ứng trong Sổ Quỹ Thu/Chi.
            </div>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-200">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Tabs Switcher & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-surface-card p-3 rounded-xl border border-border-default shadow-xs">
        {/* Tabs */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setActiveTab("CUSTOMER")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === "CUSTOMER"
                ? "bg-brand text-white shadow-xs"
                : "bg-surface-app text-text-sub hover:bg-surface-card border border-border-default"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Phải thu Khách hàng</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("SUPPLIER")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === "SUPPLIER"
                ? "bg-brand text-white shadow-xs"
                : "bg-surface-app text-text-sub hover:bg-surface-card border border-border-default"
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Phải trả Nhà cung cấp</span>
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-text-sub absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Tìm theo tên đối tác, số điện thoại..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-surface-app border border-border-default rounded-lg focus:outline-none focus:border-brand text-text-main"
          />
        </div>
      </div>

      {/* Debts Table */}
      {isLoading ? (
        <LoadingState message="Đang truy vấn sổ công nợ..." submessage="Sổ cái đối tác" />
      ) : filteredDebts.length === 0 ? (
        <div className="p-12 text-center bg-surface-card border border-dashed border-border-default rounded-xl space-y-3">
          <CreditCard className="w-10 h-10 text-text-disabled mx-auto" />
          <h3 className="text-sm font-semibold text-text-main">
            {searchTerm ? "Không tìm thấy đối tác phù hợp" : "Không có dư nợ đối tác"}
          </h3>
          <p className="text-xs text-text-sub">
            {activeTab === "CUSTOMER"
              ? "Tất cả khách hàng đều đã thanh toán đủ hoặc chưa phát sinh đơn bán chịu."
              : "Cửa hàng không có khoản nợ nhà cung cấp nào chưa thanh toán."}
          </p>
        </div>
      ) : (
        <div className="bg-surface-card rounded-xl border border-border-default overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-surface-app text-text-sub font-semibold border-b border-border-default">
                <tr>
                  <th className="py-3 px-3.5">Tên đối tác</th>
                  <th className="py-3 px-3.5">Số điện thoại</th>
                  <th className="py-3 px-3.5 text-right">Dư nợ hiện tại</th>
                  <th className="py-3 px-3.5 text-right">Hạn mức tối đa</th>
                  <th className="py-3 px-3.5 text-center">Giao dịch gần nhất</th>
                  <th className="py-3 px-3.5 text-center w-40">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-default bg-surface-card">
                {filteredDebts.map((d) => {
                  const debt = Number(d.current_debt_balance || 0);
                  const limit = Number(d.credit_limit || 0);
                  const isOverLimit = limit > 0 && debt > limit;

                  return (
                    <tr key={d.id} className="hover:bg-surface-app/50 transition-colors">
                      <td className="py-3 px-3.5">
                        <div className="font-bold text-text-main">{d.name}</div>
                        {d.address && (
                          <div className="text-[11px] text-text-sub truncate max-w-xs mt-0.5">
                            {d.address}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3.5 font-mono text-text-main">
                        {d.phone || <span className="text-text-disabled">-</span>}
                      </td>
                      <td className="py-3 px-3.5 text-right font-mono tabular-nums">
                        <div
                          className={`font-bold text-sm ${
                            debt > 0
                              ? activeTab === "CUSTOMER"
                                ? "text-amber-700"
                                : "text-rose-700"
                              : "text-text-disabled"
                          }`}
                        >
                          {formatVND(debt)}
                        </div>
                        {isOverLimit && (
                          <span className="text-[10px] text-rose-600 font-semibold block">
                            Vượt hạn mức!
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3.5 text-right font-mono tabular-nums text-text-sub">
                        {limit > 0 ? formatVND(limit) : <span className="text-text-disabled">-</span>}
                      </td>
                      <td className="py-3 px-3.5 text-center text-text-sub">
                        {d.last_transaction_at ? (
                          <span className="font-mono text-[11px]">
                            {new Date(d.last_transaction_at).toLocaleDateString("vi-VN")}
                          </span>
                        ) : (
                          <span className="text-text-disabled">-</span>
                        )}
                      </td>
                      <td className="py-3 px-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenPaymentModal(d)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold transition ${
                              activeTab === "CUSTOMER"
                                ? "bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-300"
                                : "bg-indigo-50 text-indigo-800 hover:bg-indigo-100 border border-indigo-300"
                            }`}
                          >
                            <DollarSign className="w-3.5 h-3.5" />
                            <span>{activeTab === "CUSTOMER" ? "Thu nợ" : "Trả nợ"}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleViewHistory(d)}
                            className="p-1.5 text-text-sub hover:text-brand hover:bg-surface-app rounded"
                            title="Xem lịch sử đối soát nợ"
                          >
                            <History className="w-3.5 h-3.5" />
                          </button>
                        </div>
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
          MODAL: THU NỢ KHÁCH HÀNG / TRẢ NỢ NHÀ CUNG CẤP
      ========================================================================= */}
      {paymentModalPartner && (
        <Modal
          isOpen={Boolean(paymentModalPartner)}
          onClose={() => setPaymentModalPartner(null)}
          title={
            paymentModalPartner.partner_type === "CUSTOMER"
              ? `Thu tiền nợ khách hàng: ${paymentModalPartner.name}`
              : `Thanh toán nợ nhà cung cấp: ${paymentModalPartner.name}`
          }
        >
          <form onSubmit={handleSubmitPayment} className="space-y-4 text-xs">
            <div className="p-3 bg-surface-app rounded-lg border border-border-default space-y-1">
              <div className="flex justify-between text-text-sub">
                <span>Dư nợ hiện tại:</span>
                <span className="font-mono font-bold text-rose-700 text-sm">
                  {formatVND(Number(paymentModalPartner.current_debt_balance || 0))}
                </span>
              </div>
              {paymentModalPartner.phone && (
                <div className="flex justify-between text-text-sub">
                  <span>Số điện thoại:</span>
                  <span className="font-mono">{paymentModalPartner.phone}</span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-text-main mb-1">
                Số tiền thanh toán (VND) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="1000"
                step="1000"
                required
                value={payAmount || ""}
                onChange={(e) => setPayAmount(Number(e.target.value))}
                className="w-full px-3 py-2 bg-surface-app border border-border-default rounded-lg text-right font-mono font-bold text-brand text-sm focus:outline-none focus:border-brand"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-text-main mb-1">
                Phương thức nhận / chi tiền
              </label>
              <select
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value as "CASH" | "BANK_TRANSFER")}
                className="w-full px-3 py-2 bg-surface-app border border-border-default rounded-lg text-text-main focus:outline-none focus:border-brand"
              >
                <option value="CASH">Tiền mặt (Quỹ tiền mặt)</option>
                <option value="BANK_TRANSFER">Chuyển khoản (Tài khoản ngân hàng)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-text-main mb-1">
                Ghi chú nội dung phiếu
              </label>
              <input
                type="text"
                value={payNote}
                onChange={(e) => setPayNote(e.target.value)}
                placeholder="Thu nợ đơn hàng, cấn trừ công nợ đợt 1..."
                className="w-full px-3 py-2 bg-surface-app border border-border-default rounded-lg text-text-main focus:outline-none focus:border-brand"
              />
            </div>

            <div className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-200 text-[11px] text-emerald-900 leading-relaxed">
              Giao dịch này sẽ ghi nhận vào Sổ Nợ và tự động sinh phiếu{" "}
              <strong>
                {paymentModalPartner.partner_type === "CUSTOMER" ? "THU (Inflow)" : "CHI (Outflow)"}
              </strong>{" "}
              trong Sổ Quỹ Thu/Chi.
            </div>

            <div className="pt-3 border-t border-border-default flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setPaymentModalPartner(null)}
                disabled={isSubmittingPayment}
              >
                Hủy
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                isLoading={isSubmittingPayment}
                disabled={isSubmittingPayment}
              >
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                <span>Xác nhận giao dịch</span>
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* =========================================================================
          MODAL: LỊCH SỬ BIẾN ĐỘNG CÔNG NỢ (LEDGER HISTORY)
      ========================================================================= */}
      {historyPartner && (
        <Modal
          isOpen={Boolean(historyPartner)}
          onClose={() => setHistoryPartner(null)}
          title={`Lịch sử công nợ: ${historyPartner.name}`}
          size="lg"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-surface-app rounded-lg border border-border-default flex items-center justify-between">
              <div>
                <span className="text-[11px] text-text-sub block">Dư nợ hiện thời:</span>
                <span className="font-mono font-bold text-rose-700 text-sm">
                  {formatVND(Number(historyPartner.current_debt_balance || 0))}
                </span>
              </div>
              <span className="text-text-sub text-[11px]">
                {ledgerEntries.length} giao dịch ghi nhận
              </span>
            </div>

            {isLoadingHistory ? (
              <LoadingState message="Đang tải lịch sử công nợ..." />
            ) : ledgerEntries.length === 0 ? (
              <div className="p-8 text-center bg-surface-card border border-dashed border-border-default rounded-lg text-text-sub">
                Chưa có phát sinh giao dịch nợ nào cho đối tác này.
              </div>
            ) : (
              <div className="border border-border-default rounded-lg overflow-hidden max-h-96 overflow-y-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-surface-app text-text-sub font-semibold border-b border-border-default sticky top-0">
                    <tr>
                      <th className="py-2 px-3">Thời gian</th>
                      <th className="py-2 px-3">Loại biến động</th>
                      <th className="py-2 px-3">Số chứng từ</th>
                      <th className="py-2 px-3 text-right">Số tiền</th>
                      <th className="py-2 px-3 text-right">Dư nợ sau GD</th>
                      <th className="py-2 px-3">Nội dung ghi chú</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-default bg-surface-card">
                    {ledgerEntries.map((e) => (
                      <tr key={e.id}>
                        <td className="py-2 px-3 text-text-sub whitespace-nowrap font-mono text-[11px]">
                          {new Date(e.created_at).toLocaleString("vi-VN")}
                        </td>
                        <td className="py-2 px-3 font-semibold">
                          <span
                            className={
                              e.transaction_type.includes("PAYMENT") || e.transaction_type.includes("REPAYMENT")
                                ? "text-emerald-700"
                                : "text-amber-700"
                            }
                          >
                            {e.transaction_type}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-mono text-text-sub">
                          {e.reference_id || "-"}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold tabular-nums">
                          {formatVND(Number(e.amount))}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-rose-700 tabular-nums">
                          {formatVND(Number(e.balance_after))}
                        </td>
                        <td className="py-2 px-3 text-text-sub max-w-xs truncate" title={e.note || ""}>
                          {e.note || "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
