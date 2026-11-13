"use client";

import React, { useState, useEffect, useCallback } from "react";
import { reportsRepository } from "../repositories/reports.repository";
import { formatNPR, parseMoney } from "@/lib/currency";
import {
  PieChart,
  Printer,
  Download,
  RefreshCw,
  TrendingUp,
  ArrowDownRight,
  Loader2,
  Building2,
} from "lucide-react";
import { exportToExcel } from "@/lib/export-helper";
import { Notify } from "@/lib/notify";

export function AccountingReportContainer() {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1); // 1st of current month
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranch, setSelectedBranch] = useState("ALL");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadBranches = useCallback(async () => {
    try {
      const bList = await reportsRepository.fetchBranches();
      setBranches(bList);
    } catch (err) {
      console.error("Failed to load branches:", err);
    }
  }, []);

  const loadAccounting = useCallback(async () => {
    try {
      setLoading(true);
      const res = await reportsRepository.fetchAccountingData(
        startDate,
        endDate,
        selectedBranch !== "ALL" ? selectedBranch : undefined
      );
      setData(res);
    } catch (err: any) {
      console.error("Failed to load accounting data:", err);
      Notify.error(err.message || "Failed to load accounting data");
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, selectedBranch]);

  useEffect(() => {
    loadBranches();
  }, [loadBranches]);

  useEffect(() => {
    loadAccounting();
  }, [loadAccounting]);

  // Financial calculations
  const totalSales = (data?.sales || []).reduce((acc: number, s: any) => acc + parseMoney(s.totalAmount || 0), 0);
  const totalPurchases = (data?.purchases || []).reduce((acc: number, p: any) => acc + parseMoney(p.totalAmount || 0), 0);
  const totalExpenses = (data?.expenses || []).reduce((acc: number, e: any) => acc + parseMoney(e.amount || 0), 0);
  const grossProfit = totalSales - totalPurchases;
  const netIncome = grossProfit - totalExpenses;
  const grossMarginPct = totalSales > 0 ? ((grossProfit / totalSales) * 100).toFixed(1) : "0.0";
  const netMarginPct = totalSales > 0 ? ((netIncome / totalSales) * 100).toFixed(1) : "0.0";

  const totalReceivables = (data?.customers || []).reduce((acc: number, c: any) => acc + parseMoney(c.currentBalance || c.balance || 0), 0);
  const totalPayables = (data?.suppliers || []).reduce((acc: number, s: any) => acc + parseMoney(s.currentBalance || s.balance || 0), 0);

  const handleExport = () => {
    const rows = [
      { Metric: "Period", Value: `${startDate} to ${endDate}` },
      { Metric: "Gross Revenue", Value: totalSales },
      { Metric: "Cost of Goods Sold (COGS)", Value: totalPurchases },
      { Metric: "Gross Profit", Value: grossProfit },
      { Metric: "Operating Expenses", Value: totalExpenses },
      { Metric: "Net Operating Profit", Value: netIncome },
      { Metric: "Accounts Receivable", Value: totalReceivables },
      { Metric: "Accounts Payable", Value: totalPayables },
    ];
    exportToExcel(rows, `Profit_Loss_${startDate}_${endDate}`);
  };

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#EEE7DD] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <PieChart className="h-5 w-5 text-[#6B2837]" />
            <h1 className="text-xl font-bold text-[#292320] tracking-tight">Accounting & P&L Statement</h1>
          </div>
          <p className="text-xs text-[#71675E] mt-0.5">
            Profit and loss statement, operating margins, cost of goods & balance sheet overview
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-2.5 py-1 text-xs bg-[#FFFCF7] border border-[#EEE7DD] rounded-md text-[#292320] outline-none"
          />
          <span className="text-xs text-[#71675E]">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-2.5 py-1 text-xs bg-[#FFFCF7] border border-[#EEE7DD] rounded-md text-[#292320] outline-none"
          />

          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="px-3 py-1 text-xs bg-[#FFFCF7] border border-[#EEE7DD] rounded-md text-[#292320] outline-none"
          >
            <option value="ALL">All Branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>

          <button
            onClick={() => loadAccounting()}
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

      {loading ? (
        <div className="p-12 text-center text-xs text-[#71675E] bg-[#FFFCF7] border border-[#EEE7DD] rounded-lg">
          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-[#6B2837]" />
          Computing financial statements...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Income Statement Table */}
          <div className="lg:col-span-2 bg-[#FFFCF7] border border-[#EEE7DD] rounded-lg p-5 space-y-4">
            <h3 className="text-sm font-bold text-[#292320] border-b border-[#EEE7DD] pb-3">
              Income Statement (Profit & Loss)
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between py-1.5 border-b border-[#EEE7DD]">
                <span className="font-semibold text-[#292320]">Total Revenue (Gross Sales)</span>
                <span className="font-bold text-[#28634B] tabular-nums">{formatNPR(totalSales)}</span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-[#EEE7DD]">
                <span className="text-[#71675E]">Less: Cost of Goods Sold (Inbound Purchases)</span>
                <span className="text-[#B33432] tabular-nums font-medium">({formatNPR(totalPurchases)})</span>
              </div>

              <div className="flex items-center justify-between py-2 bg-[#F7F3EC] px-3 rounded font-bold">
                <span className="text-[#292320]">Gross Profit (Margin: {grossMarginPct}%)</span>
                <span className="text-[#292320] tabular-nums">{formatNPR(grossProfit)}</span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-[#EEE7DD]">
                <span className="text-[#71675E]">Less: Operating & Overhead Expenses</span>
                <span className="text-[#B33432] tabular-nums font-medium">({formatNPR(totalExpenses)})</span>
              </div>

              <div className="flex items-center justify-between py-3 bg-[#6B2837] text-white px-3 rounded font-bold text-sm">
                <span>Net Operating Income (Margin: {netMarginPct}%)</span>
                <span className="tabular-nums">{formatNPR(netIncome)}</span>
              </div>
            </div>
          </div>

          {/* Balance Sheet Mini Summary */}
          <div className="bg-[#FFFCF7] border border-[#EEE7DD] rounded-lg p-5 space-y-4">
            <h3 className="text-sm font-bold text-[#292320] border-b border-[#EEE7DD] pb-3">
              Working Capital Snapshot
            </h3>

            <div className="space-y-4 text-xs">
              <div className="p-3.5 bg-[#F7F3EC] border border-[#EEE7DD] rounded-lg space-y-1">
                <span className="text-[#71675E]">Accounts Receivable (Asset)</span>
                <div className="text-lg font-bold text-[#292320] tabular-nums">
                  {formatNPR(totalReceivables)}
                </div>
                <p className="text-[10px] text-[#71675E]">Owed by customers on credit</p>
              </div>

              <div className="p-3.5 bg-[#F7F3EC] border border-[#EEE7DD] rounded-lg space-y-1">
                <span className="text-[#71675E]">Accounts Payable (Liability)</span>
                <div className="text-lg font-bold text-[#B33432] tabular-nums">
                  {formatNPR(totalPayables)}
                </div>
                <p className="text-[10px] text-[#71675E]">Owed to suppliers for goods</p>
              </div>

              <div className="p-3.5 bg-[#EBF4F0] border border-[#C3DED0] rounded-lg space-y-1">
                <span className="text-[#28634B] font-semibold">Net Working Capital</span>
                <div className="text-lg font-bold text-[#28634B] tabular-nums">
                  {formatNPR(totalReceivables - totalPayables)}
                </div>
                <p className="text-[10px] text-[#28634B]">Receivables minus payables</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
