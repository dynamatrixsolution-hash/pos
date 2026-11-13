"use client";

import React, { useState, useEffect, useCallback } from "react";
import { reportsRepository } from "../repositories/reports.repository";
import { formatNPR, parseMoney } from "@/lib/currency";
import {
  FileText,
  Printer,
  Download,
  RefreshCw,
  Search,
  Loader2,
  TrendingUp,
  ShoppingBag,
  CreditCard,
  DollarSign,
} from "lucide-react";
import { exportToExcel } from "@/lib/export-helper";
import { Notify } from "@/lib/notify";

type TxTab = "sales" | "purchase" | "expense" | "payment";

export function TransactionsReportContainer() {
  const [activeTab, setActiveTab] = useState<TxTab>("sales");
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranch, setSelectedBranch] = useState("ALL");
  const [search, setSearch] = useState("");
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadBranches = useCallback(async () => {
    try {
      const data = await reportsRepository.fetchBranches();
      setBranches(data);
    } catch (err) {
      console.error("Failed to load branches:", err);
    }
  }, []);

  const loadTransactions = useCallback(async () => {
    try {
      setLoading(true);
      const res = await reportsRepository.fetchTransactions(activeTab, {
        startDate,
        endDate,
        branchId: selectedBranch !== "ALL" ? selectedBranch : undefined,
        search: search || undefined,
        limit: 100,
      });

      if (activeTab === "sales") setRecords(res.sales || []);
      else if (activeTab === "purchase") setRecords(res.purchases || []);
      else if (activeTab === "expense") setRecords(res.expenses || []);
      else setRecords(res.payments || []);
    } catch (err: any) {
      console.error("Failed to load transactions:", err);
      Notify.error(err.message || "Failed to load transactions");
    } finally {
      setLoading(false);
    }
  }, [activeTab, startDate, endDate, selectedBranch, search]);

  useEffect(() => {
    loadBranches();
  }, [loadBranches]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const handleExport = () => {
    if (records.length === 0) {
      Notify.warning("No records to export");
      return;
    }
    const rows = records.map((r) => ({
      Ref: r.invoiceNumber || r.billNumber || r.paymentNumber || r.id,
      Date: new Date(r.createdAt || r.date).toLocaleDateString(),
      Party: r.customer?.name || r.supplier?.name || r.partyName || r.category || "General",
      Amount: parseMoney(r.totalAmount || r.amount || 0),
      Status: r.status || "COMPLETED",
    }));
    exportToExcel(rows, `Transactions_${activeTab}_${startDate}_${endDate}`);
  };

  const totalAmount = records.reduce((acc, r) => acc + parseMoney(r.totalAmount || r.amount || 0), 0);

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#EEE7DD] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-[#6B2837]" />
            <h1 className="text-xl font-bold text-[#292320] tracking-tight">Transaction Ledger</h1>
          </div>
          <p className="text-xs text-[#71675E] mt-0.5">
            Audit sales receipts, purchase orders, operational expenses & payment vouchers
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadTransactions()}
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

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[#EEE7DD] pb-2">
        {(
          [
            ["sales", "Sales Orders", TrendingUp],
            ["purchase", "Purchases", ShoppingBag],
            ["expense", "Expenses", DollarSign],
            ["payment", "Payments & Vouchers", CreditCard],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              activeTab === key
                ? "bg-[#6B2837] text-white"
                : "text-[#71675E] hover:text-[#292320] hover:bg-[#F7F3EC]"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Filter Row */}
      <div className="flex flex-wrap items-center gap-3 bg-[#FFFCF7] p-3 border border-[#EEE7DD] rounded-lg">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-[#71675E]">From:</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-2.5 py-1 text-xs bg-[#F7F3EC] border border-[#EEE7DD] rounded-md text-[#292320] outline-none"
          />
          <span className="text-[11px] font-semibold text-[#71675E]">To:</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-2.5 py-1 text-xs bg-[#F7F3EC] border border-[#EEE7DD] rounded-md text-[#292320] outline-none"
          />
        </div>

        <select
          value={selectedBranch}
          onChange={(e) => setSelectedBranch(e.target.value)}
          className="px-3 py-1.5 text-xs bg-[#F7F3EC] border border-[#EEE7DD] rounded-md text-[#292320] outline-none"
        >
          <option value="ALL">All Branches</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>

        <div className="relative flex-1 min-w-[200px]">
          <Search className="h-3.5 w-3.5 text-[#71675E] absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search invoice #, customer, supplier..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#F7F3EC] border border-[#EEE7DD] rounded-md text-[#292320] outline-none focus:border-[#6B2837]"
          />
        </div>

        <div className="text-xs font-semibold text-[#292320] tabular-nums ml-auto">
          Total: <span className="text-[#6B2837]">{formatNPR(totalAmount)}</span>
        </div>
      </div>

      {/* Records Table */}
      {loading ? (
        <div className="p-12 text-center text-xs text-[#71675E] bg-[#FFFCF7] border border-[#EEE7DD] rounded-lg">
          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-[#6B2837]" />
          Loading transactions ledger...
        </div>
      ) : records.length === 0 ? (
        <div className="p-10 text-center bg-[#FFFCF7] border border-[#EEE7DD] rounded-lg">
          <FileText className="h-8 w-8 text-[#71675E] mx-auto mb-2 opacity-50" />
          <h3 className="text-sm font-semibold text-[#292320]">No transactions found</h3>
          <p className="text-xs text-[#71675E] mt-1">Try adjusting the date range or branch filter.</p>
        </div>
      ) : (
        <div className="bg-[#FFFCF7] border border-[#EEE7DD] rounded-lg overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#EEE7DD] bg-[#F7F3EC] text-[#71675E]">
                <th className="py-2.5 px-3 font-semibold">Ref #</th>
                <th className="py-2.5 px-3 font-semibold">Date</th>
                <th className="py-2.5 px-3 font-semibold">Party / Classification</th>
                <th className="py-2.5 px-3 font-semibold">Method / Category</th>
                <th className="py-2.5 px-3 font-semibold text-right">Amount</th>
                <th className="py-2.5 px-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEE7DD]">
              {records.map((r) => {
                const ref = r.invoiceNumber || r.billNumber || r.paymentNumber || r.id;
                const date = new Date(r.createdAt || r.date).toLocaleDateString();
                const party = r.customer?.name || r.supplier?.name || r.partyName || r.category || "General";
                const method = r.paymentMethod || r.category || r.type || "—";
                const amt = parseMoney(r.totalAmount || r.amount || 0);

                return (
                  <tr key={r.id} className="hover:bg-[#F7F3EC]/50 transition-colors">
                    <td className="py-2.5 px-3 font-mono font-medium text-[#292320]">{ref}</td>
                    <td className="py-2.5 px-3 tabular-nums text-[#71675E]">{date}</td>
                    <td className="py-2.5 px-3 font-semibold text-[#292320]">{party}</td>
                    <td className="py-2.5 px-3 text-[#71675E]">{method}</td>
                    <td className="py-2.5 px-3 tabular-nums text-right font-bold text-[#292320]">
                      {formatNPR(amt)}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-semibold bg-[#EBF4F0] text-[#28634B] border border-[#C3DED0]">
                        {r.status || "COMPLETED"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
