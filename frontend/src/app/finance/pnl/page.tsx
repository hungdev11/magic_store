"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { api, PnLReportResponse } from "@/lib/api";
import { formatVND } from "@/lib/design-tokens";
import {
  PageHeader,
  Badge,
  Button,
  LoadingState,
  AlertBanner,
} from "@/components/common";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  PieChart,
  Calendar,
  RefreshCw,
  ArrowRight,
  Flame,
  Minus,
  Equal,
  Wallet,
  Receipt,
  Building,
} from "lucide-react";

export default function PnLReportPage() {
  const [report, setReport] = useState<PnLReportResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Time preset filter
  const [timePreset, setTimePreset] = useState<"TODAY" | "7DAYS" | "THIS_MONTH">("THIS_MONTH");
  const [fromDate, setFromDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split("T")[0];
  });
  const [toDate, setToDate] = useState<string>(() => {
    return new Date().toISOString().split("T")[0];
  });

  const handleApplyPreset = (preset: "TODAY" | "7DAYS" | "THIS_MONTH") => {
    setTimePreset(preset);
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    setToDate(todayStr);

    if (preset === "TODAY") {
      setFromDate(todayStr);
    } else if (preset === "7DAYS") {
      const past = new Date();
      past.setDate(past.getDate() - 7);
      setFromDate(past.toISOString().split("T")[0]);
    } else if (preset === "THIS_MONTH") {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      setFromDate(firstDay.toISOString().split("T")[0]);
    }
  };

  const loadReport = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.getPnLReport({ from: fromDate, to: toDate });
      setReport(res);
    } catch (err: any) {
      setError(err.message || "Không thể tải báo cáo tài chính");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [fromDate, toDate]);

  const rev = Number(report?.total_revenue || 0);
  const cogs = Number(report?.total_cogs || 0);
  const gross = Number(report?.gross_profit || 0);
  const grossPct = Number(report?.gross_margin_percent || 0);
  const wastage = Number(report?.total_wastage_loss || 0);
  const opex = Number(report?.total_operating_exp || 0);
  const net = Number(report?.net_profit || 0);
  const netPct = Number(report?.net_margin_percent || 0);

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      <PageHeader
        title="Báo Cáo Lãi / Lỗ Thực Tế (P&L Income Statement)"
        description="Bóc tách minh bạch Doanh thu, Giá vốn xuất kho WAC, Tổn thất hao hụt xuất hủy và Chi phí vận hành cửa hàng."
        actions={
          <div className="flex items-center gap-2">
            <Link href="/finance/cashbook">
              <Button variant="secondary" size="sm">
                <Wallet className="w-3.5 h-3.5 mr-1.5" />
                <span>Sổ quỹ</span>
              </Button>
            </Link>
            <Button variant="secondary" size="sm" onClick={loadReport} disabled={isLoading}>
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
              <span>Cập nhật số liệu</span>
            </Button>
          </div>
        }
      />

      {error && <AlertBanner type="error" message={error} onClose={() => setError(null)} />}

      {/* Date Range Selector Bar */}
      <div className="bg-surface-card p-3 rounded-xl border border-border-default shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => handleApplyPreset("TODAY")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              timePreset === "TODAY"
                ? "bg-brand text-white"
                : "bg-surface-app text-text-sub hover:bg-surface-card border border-border-default"
            }`}
          >
            Hôm nay
          </button>
          <button
            type="button"
            onClick={() => handleApplyPreset("7DAYS")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              timePreset === "7DAYS"
                ? "bg-brand text-white"
                : "bg-surface-app text-text-sub hover:bg-surface-card border border-border-default"
            }`}
          >
            7 ngày qua
          </button>
          <button
            type="button"
            onClick={() => handleApplyPreset("THIS_MONTH")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              timePreset === "THIS_MONTH"
                ? "bg-brand text-white"
                : "bg-surface-app text-text-sub hover:bg-surface-card border border-border-default"
            }`}
          >
            Tháng này
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs font-medium text-text-sub">
          <Calendar className="w-4 h-4 text-text-disabled shrink-0" />
          <span>Từ</span>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => {
              setFromDate(e.target.value);
              setTimePreset("THIS_MONTH");
            }}
            className="px-2.5 py-1 bg-surface-app border border-border-default rounded-lg text-text-main font-mono text-xs"
          />
          <span>Đến</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => {
              setToDate(e.target.value);
              setTimePreset("THIS_MONTH");
            }}
            className="px-2.5 py-1 bg-surface-app border border-border-default rounded-lg text-text-main font-mono text-xs"
          />
        </div>
      </div>

      {isLoading ? (
        <LoadingState message="Đang tổng hợp báo cáo tài chính..." submessage="Tính toán WAC & Sổ cái" />
      ) : (
        <>
          {/* =========================================================================
              FINANCIAL STATEMENT WATERFALL / LADDER
          ========================================================================= */}
          <div className="bg-surface-card rounded-xl border border-border-default p-5 sm:p-6 shadow-xs space-y-5">
            <div className="border-b border-border-subtle pb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-text-main flex items-center gap-2">
                <Receipt className="w-4 h-4 text-brand" />
                <span>Bảng Bóc Tách Kết Quả Hoạt Động Kinh Doanh (P&L Breakdown)</span>
              </h2>
              <span className="text-xs text-text-sub font-mono">
                {fromDate} → {toDate}
              </span>
            </div>

            <div className="space-y-3 font-mono text-xs">
              {/* 1. Doanh thu thuần */}
              <div className="flex items-center justify-between p-3.5 bg-surface-app rounded-xl border border-border-default">
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs">
                    +
                  </div>
                  <div>
                    <span className="font-sans font-bold text-sm text-text-main block">
                      1. Doanh thu thuần bán hàng
                    </span>
                    <span className="font-sans text-[11px] text-text-sub">
                      Tổng giá trị các đơn hàng bán lẻ & bán buôn POS đã thanh toán
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-base font-bold text-emerald-700 tabular-nums">
                    {formatVND(rev)}
                  </div>
                  <span className="text-[10px] text-text-disabled font-sans">100% doanh thu</span>
                </div>
              </div>

              {/* 2. Giá vốn hàng bán (COGS) */}
              <div className="flex items-center justify-between p-3.5 bg-surface-app rounded-xl border border-border-default">
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded bg-rose-100 text-rose-800 flex items-center justify-center font-bold text-xs">
                    -
                  </div>
                  <div>
                    <span className="font-sans font-bold text-sm text-text-main block">
                      2. Giá vốn hàng bán (COGS - WAC)
                    </span>
                    <span className="font-sans text-[11px] text-text-sub">
                      Giá trị vốn bình quân gia quyền tại thời điểm xuất kho bán
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-base font-bold text-rose-600 tabular-nums">
                    {formatVND(cogs)}
                  </div>
                  <span className="text-[10px] text-text-disabled font-sans">
                    {rev > 0 ? ((cogs / rev) * 100).toFixed(1) : 0}% doanh thu
                  </span>
                </div>
              </div>

              {/* 3. Lợi nhuận gộp */}
              <div className="flex items-center justify-between p-3.5 bg-emerald-50/60 rounded-xl border border-emerald-300">
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">
                    =
                  </div>
                  <div>
                    <span className="font-sans font-bold text-sm text-emerald-950 block">
                      3. Lợi nhuận gộp (Gross Profit)
                    </span>
                    <span className="font-sans text-[11px] text-emerald-800">
                      Doanh thu thuần trừ Giá vốn hàng bán
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-emerald-800 tabular-nums">
                    {formatVND(gross)}
                  </div>
                  <span className="text-xs text-emerald-700 font-bold font-sans">
                    Tỷ suất LN gộp: {grossPct}%
                  </span>
                </div>
              </div>

              {/* 4. Chi phí hao hụt / Xuất hủy */}
              <div className="flex items-center justify-between p-3.5 bg-surface-app rounded-xl border border-border-default">
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded bg-rose-100 text-rose-800 flex items-center justify-center font-bold text-xs">
                    -
                  </div>
                  <div>
                    <span className="font-sans font-bold text-sm text-text-main block flex items-center gap-1.5">
                      <Flame className="w-4 h-4 text-rose-600" />
                      <span>4. Chi phí hao hụt & Xuất hủy hàng</span>
                    </span>
                    <span className="font-sans text-[11px] text-text-sub">
                      Tổn thất vốn do cá ngộp chết, rau củ thiu hỏng, cận date hết hạn
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-base font-bold text-rose-600 tabular-nums">
                    {formatVND(wastage)}
                  </div>
                  <span className="text-[10px] text-text-disabled font-sans">
                    {rev > 0 ? ((wastage / rev) * 100).toFixed(1) : 0}% doanh thu
                  </span>
                </div>
              </div>

              {/* 5. Chi phí vận hành */}
              <div className="flex items-center justify-between p-3.5 bg-surface-app rounded-xl border border-border-default">
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded bg-rose-100 text-rose-800 flex items-center justify-center font-bold text-xs">
                    -
                  </div>
                  <div>
                    <span className="font-sans font-bold text-sm text-text-main block">
                      5. Chi phí vận hành cửa hàng (OPEX)
                    </span>
                    <span className="font-sans text-[11px] text-text-sub">
                      Thuê mặt bằng, điện nước, lương nhân viên, cước vận chuyển, bao bì
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-base font-bold text-rose-600 tabular-nums">
                    {formatVND(opex)}
                  </div>
                  <span className="text-[10px] text-text-disabled font-sans">
                    {rev > 0 ? ((opex / rev) * 100).toFixed(1) : 0}% doanh thu
                  </span>
                </div>
              </div>

              {/* 6. Lợi nhuận thuần thực tế */}
              <div
                className={`flex items-center justify-between p-4 rounded-xl border ${
                  net >= 0
                    ? "bg-brand/10 border-brand/30 ring-2 ring-brand/10"
                    : "bg-rose-50 border-rose-300 ring-2 ring-rose-200"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-sm text-white ${
                      net >= 0 ? "bg-brand" : "bg-rose-600"
                    }`}
                  >
                    =
                  </div>
                  <div>
                    <span className="font-sans font-extrabold text-base text-text-main block">
                      6. Lợi nhuận thuần thực tế (Net Profit)
                    </span>
                    <span className="font-sans text-xs text-text-sub">
                      Lợi nhuận gộp sau khi trừ triệt để Hao hụt & Toàn bộ Chi phí vận hành
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className={`text-2xl font-black tabular-nums ${
                      net >= 0 ? "text-brand" : "text-rose-700"
                    }`}
                  >
                    {formatVND(net)}
                  </div>
                  <span
                    className={`text-xs font-bold font-sans ${
                      net >= 0 ? "text-brand" : "text-rose-700"
                    }`}
                  >
                    Tỷ suất LN ròng: {netPct}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* =========================================================================
              DAILY BREAKDOWN TABLE
          ========================================================================= */}
          {report && report.daily_breakdown && report.daily_breakdown.length > 0 && (
            <div className="bg-surface-card rounded-xl border border-border-default overflow-hidden shadow-xs space-y-3 p-4">
              <h3 className="text-xs font-bold text-text-main uppercase tracking-wider">
                Bảng số liệu chi tiết từng ngày trong kỳ
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left font-mono">
                  <thead className="bg-surface-app text-text-sub font-semibold border-b border-border-default">
                    <tr>
                      <th className="py-2.5 px-3">Ngày</th>
                      <th className="py-2.5 px-3 text-right">Doanh thu</th>
                      <th className="py-2.5 px-3 text-right">Giá vốn</th>
                      <th className="py-2.5 px-3 text-right">LN Gộp</th>
                      <th className="py-2.5 px-3 text-right">Hao hụt</th>
                      <th className="py-2.5 px-3 text-right">Chi phí VH</th>
                      <th className="py-2.5 px-3 text-right">LN Thuần</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-default bg-surface-card tabular-nums">
                    {report.daily_breakdown.map((d) => (
                      <tr key={d.date} className="hover:bg-surface-app/50 transition-colors">
                        <td className="py-2.5 px-3 font-semibold text-text-main">
                          {d.date}
                        </td>
                        <td className="py-2.5 px-3 text-right text-emerald-700 font-bold">
                          {formatVND(Number(d.revenue))}
                        </td>
                        <td className="py-2.5 px-3 text-right text-text-sub">
                          {formatVND(Number(d.cogs))}
                        </td>
                        <td className="py-2.5 px-3 text-right text-text-main font-semibold">
                          {formatVND(Number(d.gross_profit))}
                        </td>
                        <td className="py-2.5 px-3 text-right text-rose-600">
                          {Number(d.wastage_loss) > 0 ? formatVND(Number(d.wastage_loss)) : "-"}
                        </td>
                        <td className="py-2.5 px-3 text-right text-text-sub">
                          {Number(d.operating_exp) > 0 ? formatVND(Number(d.operating_exp)) : "-"}
                        </td>
                        <td
                          className={`py-2.5 px-3 text-right font-bold ${
                            Number(d.net_profit) >= 0 ? "text-brand" : "text-rose-700"
                          }`}
                        >
                          {formatVND(Number(d.net_profit))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
