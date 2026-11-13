"use client";

import React, { useState, useEffect, useCallback } from "react";
import { reportsRepository } from "../repositories/reports.repository";
import { formatNPR, parseMoney } from "@/lib/currency";
import {
  Users,
  Building2,
  RefreshCw,
  Download,
  Search,
  Loader2,
  AlertCircle,
  FileText,
} from "lucide-react";
import { exportToExcel } from "@/lib/export-helper";
import { Notify } from "@/lib/notify";

export function OutstandingReportContainer() {
  const [activeTab, setActiveTab] = useState<"customers" | "suppliers">("customers");
  const [customers, setCustomers] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await reportsRepository.fetchOutstanding();
      setCustomers(res.customers || []);
      setSuppliers(res.suppliers || []);
    } catch (err: any) {
      console.error("Failed to load outstanding balances:", err);
      Notify.error(err.message || "Failed to load outstanding data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredCustomers = customers
    .filter((c) => parseMoney(c.currentBalance || c.balance || 0) > 0)
    .filter((c) => !search || c.name.toLowerCase().includes(search.toLowerCase()) || (c.phone && c.phone.includes(search)));

  const filteredSuppliers = suppliers
    .filter((s) => parseMoney(s.currentBalance || s.balance || 0) > 0)
    .filter((s) => !search || s.name.toLowerCase().includes(search.toLowerCase()) || (s.phone && s.phone.includes(search)));

  const totalReceivables = filteredCustomers.reduce((acc, c) => acc + parseMoney(c.currentBalance || c.balance || 0), 0);
  const totalPayables = filteredSuppliers.reduce((acc, s) => acc + parseMoney(s.currentBalance || s.balance || 0), 0);

  const handleExport = () => {
    const isCust = activeTab === "customers";
    const data = isCust ? filteredCustomers : filteredSuppliers;
    if (data.length === 0) {
      Notify.warning("No outstanding entries to export");
      return;
    }
    const rows = data.map((d) => ({
      Name: d.name,
      Phone: d.phone || "—",
      PAN_VAT: d.panVat || "—",
      Balance_NPR: parseMoney(d.currentBalance || d.balance || 0),
    }));
    exportToExcel(rows, `Outstanding_${activeTab}`);
  };

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#EEE7DD] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-[#6B2837]" />
            <h1 className="text-xl font-bold text-[#292320] tracking-tight">Outstanding & Aging Balances</h1>
          </div>
          <p className="text-xs text-[#71675E] mt-0.5">
            Credit accounts receivable from customers and accounts payable to suppliers
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadData()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#292320] bg-[#FFFCF7] border border-[#EEE7DD] rounded-md hover:bg-[#F7F3EC] transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-4 bg-[#FFFCF7] border border-[#EEE7DD] rounded-lg space-y-1">
          <div className="flex items-center justify-between text-xs font-semibold text-[#71675E]">
            <span>Total Customer Receivables (Udhari)</span>
            <Users className="h-4 w-4 text-[#B33432]" />
          </div>
          <div className="text-2xl font-bold text-[#B33432] tabular-nums">
            {formatNPR(totalReceivables)}
          </div>
          <p className="text-[11px] text-[#71675E]">{filteredCustomers.length} accounts with overdue balance</p>
        </div>

        <div className="p-4 bg-[#FFFCF7] border border-[#EEE7DD] rounded-lg space-y-1">
          <div className="flex items-center justify-between text-xs font-semibold text-[#71675E]">
            <span>Total Supplier Payables (Liabilities)</span>
            <Building2 className="h-4 w-4 text-[#946000]" />
          </div>
          <div className="text-2xl font-bold text-[#946000] tabular-nums">
            {formatNPR(totalPayables)}
          </div>
          <p className="text-[11px] text-[#71675E]">{filteredSuppliers.length} vendor balances owed</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[#EEE7DD] pb-2">
        <button
          onClick={() => setActiveTab("customers")}
          className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
            activeTab === "customers"
              ? "bg-[#6B2837] text-white"
              : "text-[#71675E] hover:text-[#292320] hover:bg-[#F7F3EC]"
          }`}
        >
          <Users className="h-3.5 w-3.5" />
          Customer Receivables ({filteredCustomers.length})
        </button>
        <button
          onClick={() => setActiveTab("suppliers")}
          className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
            activeTab === "suppliers"
              ? "bg-[#6B2837] text-white"
              : "text-[#71675E] hover:text-[#292320] hover:bg-[#F7F3EC]"
          }`}
        >
          <Building2 className="h-3.5 w-3.5" />
          Supplier Payables ({filteredSuppliers.length})
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="h-3.5 w-3.5 text-[#71675E] absolute left-2.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Search ${activeTab}...`}
          className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#FFFCF7] border border-[#EEE7DD] rounded-md text-[#292320] outline-none focus:border-[#6B2837]"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="p-12 text-center text-xs text-[#71675E] bg-[#FFFCF7] border border-[#EEE7DD] rounded-lg">
          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-[#6B2837]" />
          Computing credit balances...
        </div>
      ) : (
        <div className="bg-[#FFFCF7] border border-[#EEE7DD] rounded-lg overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#EEE7DD] bg-[#F7F3EC] text-[#71675E]">
                <th className="py-2.5 px-3 font-semibold">Party Name</th>
                <th className="py-2.5 px-3 font-semibold">Contact / Phone</th>
                <th className="py-2.5 px-3 font-semibold">PAN / VAT</th>
                <th className="py-2.5 px-3 font-semibold text-right">Outstanding Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEE7DD]">
              {(activeTab === "customers" ? filteredCustomers : filteredSuppliers).map((item) => {
                const bal = parseMoney(item.currentBalance || item.balance || 0);
                return (
                  <tr key={item.id} className="hover:bg-[#F7F3EC]/50 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-[#292320]">{item.name}</td>
                    <td className="py-2.5 px-3 tabular-nums text-[#71675E]">{item.phone || "—"}</td>
                    <td className="py-2.5 px-3 text-[#71675E]">{item.panVat || item.pan || "—"}</td>
                    <td className="py-2.5 px-3 tabular-nums text-right font-bold text-[#B33432]">
                      {formatNPR(bal)}
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
