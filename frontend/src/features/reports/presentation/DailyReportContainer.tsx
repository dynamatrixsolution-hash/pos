"use client";

import React, { useState, useEffect, useCallback } from "react";
import { reportsRepository } from "../repositories/reports.repository";
import { apiClient } from "@/core/api/api-client";
import { formatNPR, parseMoney } from "@/lib/currency";
import {
  Calendar,
  Printer,
  Download,
  RefreshCw,
  TrendingUp,
  CreditCard,
  ShoppingBag,
  DollarSign,
  Loader2,
  Building2,
} from "lucide-react";
import { exportToExcel } from "@/lib/export-helper";
import { Notify } from "@/lib/notify";

export function DailyReportContainer() {
  const [dateStr, setDateStr] = useState(() => new Date().toISOString().slice(0, 10));
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranch, setSelectedBranch] = useState("ALL");
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadBranches = useCallback(async () => {
    try {
      const data = await reportsRepository.fetchBranches();
      setBranches(data);
    } catch (err) {
      console.error("Failed to load branches:", err);
    }
  }, []);

  const loadDailyReport = useCallback(async () => {
    try {
      setLoading(true);
      const data = await reportsRepository.fetchDailyReport(dateStr, selectedBranch);
      setReportData(data);
    } catch (err: any) {
      console.error("Failed to load daily report:", err);
      Notify.error(err.message || "Failed to load daily report");
    } finally {
      setLoading(false);
    }
  }, [dateStr, selectedBranch]);

  useEffect(() => {
    loadBranches();
  }, [loadBranches]);

  useEffect(() => {
    loadDailyReport();
  }, [loadDailyReport]);

  const handleExport = () => {
    if (!reportData) {
      Notify.warning("No data available to export");
      return;
    }
    const rows = [
      { Metric: "Date", Value: dateStr },
      { Metric: "Total Sales", Value: parseMoney(reportData.sales?.total || 0) },
      { Metric: "Sales Count", Value: reportData.sales?.count || 0 },
      { Metric: "Total Purchases", Value: parseMoney(reportData.purchases?.total || 0) },
      { Metric: "Operating Expenses", Value: parseMoney(reportData.expenses?.total || 0) },
    ];
    exportToExcel(rows, `Daily_Report_${dateStr}`);
  };

  const salesTotal = parseMoney(reportData?.sales?.total || 0);
  const salesCount = reportData?.sales?.count || 0;
  const purchaseTotal = parseMoney(reportData?.purchases?.total || 0);
  const expenseTotal = parseMoney(reportData?.expenses?.total || 0);
  const netEstimated = salesTotal - purchaseTotal - expenseTotal;
  const paymentMethods: any[] = reportData?.sales?.byPaymentMethod || [];

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#EEE7DD] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-[#6B2837]" />
            <h1 className="text-xl font-bold text-[#292320] tracking-tight">Daily Financial Report</h1>
          </div>
          <p className="text-xs text-[#71675E] mt-0.5">
            End-of-day register closing, payment tenders, turnover & margins
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={dateStr}
            onChange={(e) => setDateStr(e.target.value)}
            className="px-3 py-1.5 text-xs bg-[#FFFCF7] border border-[#EEE7DD] rounded-md text-[#292320] focus:border-[#6B2837] outline-none"
          />

          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="px-3 py-1.5 text-xs bg-[#FFFCF7] border border-[#EEE7DD] rounded-md text-[#292320] focus:border-[#6B2837] outline-none"
          >
            <option value="ALL">All Outlets / Branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>

          <button
            onClick={() => loadDailyReport()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#292320] bg-[#FFFCF7] border border-[#EEE7DD] rounded-md hover:bg-[#F7F3EC] transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>

          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#292320] bg-[#FFFCF7] border border-[#EEE7DD] rounded-md hover:bg-[#F7F3EC] transition-colors"
          >
            <Printer className="h-3.5 w-3.5" />
            Print
          </button>

          <button
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#6B2837] rounded-md hover:bg-[#521E2A] transition-colors shadow-sm"
          >
            <Download className="h-3.5 w-3.5" />
            Export
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      {loading ? (
        <div className="p-12 text-center text-xs text-[#71675E] bg-[#FFFCF7] border border-[#EEE7DD] rounded-lg">
          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-[#6B2837]" />
          Computing daily audit & register totals...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-[#FFFCF7] border border-[#EEE7DD] rounded-lg space-y-1">
              <div className="flex items-center justify-between text-xs font-semibold text-[#71675E]">
                <span>Gross Daily Sales</span>
                <TrendingUp className="h-4 w-4 text-[#28634B]" />
              </div>
              <div className="text-xl font-bold text-[#292320] tabular-nums">
                {formatNPR(salesTotal)}
              </div>
              <p className="text-[11px] text-[#71675E]">{salesCount} invoices issued today</p>
            </div>

            <div className="p-4 bg-[#FFFCF7] border border-[#EEE7DD] rounded-lg space-y-1">
              <div className="flex items-center justify-between text-xs font-semibold text-[#71675E]">
                <span>Stock Restock Purchases</span>
                <ShoppingBag className="h-4 w-4 text-[#946000]" />
              </div>
              <div className="text-xl font-bold text-[#292320] tabular-nums">
                {formatNPR(purchaseTotal)}
              </div>
              <p className="text-[11px] text-[#71675E]">Supplier bills & inbound POs</p>
            </div>

            <div className="p-4 bg-[#FFFCF7] border border-[#EEE7DD] rounded-lg space-y-1">
              <div className="flex items-center justify-between text-xs font-semibold text-[#71675E]">
                <span>Operational Expenses</span>
                <DollarSign className="h-4 w-4 text-[#B33432]" />
              </div>
              <div className="text-xl font-bold text-[#292320] tabular-nums">
                {formatNPR(expenseTotal)}
              </div>
              <p className="text-[11px] text-[#71675E]">Petty cash & branch overheads</p>
            </div>

            <div className="p-4 bg-[#FFFCF7] border border-[#EEE7DD] rounded-lg space-y-1">
              <div className="flex items-center justify-between text-xs font-semibold text-[#71675E]">
                <span>Daily Operating Margin</span>
                <TrendingUp className={`h-4 w-4 ${netEstimated >= 0 ? "text-[#28634B]" : "text-[#B33432]"}`} />
              </div>
              <div className={`text-xl font-bold tabular-nums ${netEstimated >= 0 ? "text-[#28634B]" : "text-[#B33432]"}`}>
                {formatNPR(netEstimated)}
              </div>
              <p className="text-[11px] text-[#71675E]">Sales minus purchases & expenses</p>
            </div>
          </div>

          {/* Payment Method Collections */}
          <div className="bg-[#FFFCF7] border border-[#EEE7DD] rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[#EEE7DD] pb-3">
              <div>
                <h3 className="text-sm font-bold text-[#292320]">Tender & Settlement Breakdown</h3>
                <p className="text-xs text-[#71675E]">
                  Audit cash drawer balances against digital QR & card terminal settlements
                </p>
              </div>
              <CreditCard className="h-4 w-4 text-[#6B2837]" />
            </div>

            {paymentMethods.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#71675E] bg-[#F7F3EC] rounded-lg">
                No payment tender records logged for {dateStr}.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                {paymentMethods.map((pm: any, idx: number) => (
                  <div key={idx} className="p-3.5 bg-[#F7F3EC] border border-[#EEE7DD] rounded-lg space-y-1">
                    <span className="text-[11px] font-semibold text-[#71675E] uppercase tracking-wider">
                      {pm.method || pm.paymentMethod || "CASH"}
                    </span>
                    <div className="text-lg font-bold text-[#292320] tabular-nums">
                      {formatNPR(parseMoney(pm.amount || pm._sum?.amount || 0))}
                    </div>
                    <p className="text-[10px] text-[#71675E]">
                      {pm.count || pm._count || 1} transactions
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
