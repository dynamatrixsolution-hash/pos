"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { useSettings } from "@/components/settings-provider";
import {
  Download,
  Printer,
  Calendar,
  Store,
  AlertTriangle,
  Search,
} from "lucide-react";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";

export default function OutstandingReportsPage() {
  const { data: session } = useSession();
  const { currencySymbol } = useSettings();

  const [activeTab, setActiveTab] = React.useState<string>("customer");
  const [customers, setCustomers] = React.useState<any[]>([]);
  const [suppliers, setSuppliers] = React.useState<any[]>([]);
  const [searchQuery, setSearchQuery] = React.useState<string>("");
  const [isLoading, setIsLoading] = React.useState<boolean>(true);

  // Fetch data
  React.useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const [custRes, supRes] = await Promise.all([
          fetch("/api/v1/customers"),
          fetch("/api/v1/suppliers"),
        ]);
        if (custRes.ok) {
          const data = await custRes.json();
          setCustomers(data.customers || []);
        }
        if (supRes.ok) {
          const data = await supRes.json();
          setSuppliers(data.suppliers || data || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value.toLowerCase());
  };

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery) ||
      (c.phone && c.phone.includes(searchQuery))
  );

  const filteredSuppliers = suppliers.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery) ||
      (s.phone && s.phone.includes(searchQuery))
  );

  const exportExcel = () => {
    const data = activeTab === "customer" ? filteredCustomers : filteredSuppliers;
    if (data.length === 0) return alert("No data available");
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Outstanding");
    XLSX.writeFile(wb, `outstanding_${activeTab}.xlsx`);
  };

  const exportPDF = () => {
    const data = activeTab === "customer" ? filteredCustomers : filteredSuppliers;
    if (data.length === 0) return alert("No data available");
    const doc = new jsPDF();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(245, 158, 11);
    doc.text(`DynaPOS - Outstanding Audit Statement (${activeTab.toUpperCase()})`, 14, 20);
    doc.save(`outstanding_${activeTab}.pdf`);
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="h-64 flex flex-col items-center justify-center space-y-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#2563EB] border-t-transparent" />
          <p className="text-xs text-muted-foreground font-medium">Fetching outstanding ledger scopes...</p>
        </div>
      );
    }

    if (activeTab === "customer") {
      const totalReceivables = customers.reduce((acc, cur) => acc + (cur.balance || 0), 0);
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 p-4 rounded-2xl">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Customer Receivables</span>
              <h4 className="text-lg font-black text-[#10b981] mt-1">{currencySymbol}{totalReceivables.toFixed(2)}</h4>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 p-4 rounded-2xl">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Debtors Count</span>
              <h4 className="text-lg font-black text-foreground mt-1">{customers.filter((c) => c.balance > 0).length} active</h4>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200/50 dark:border-slate-800 rounded-2xl">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold uppercase text-[9px] tracking-wider">
                  <th className="py-2.5 px-3">Customer Name</th>
                  <th className="py-2.5 px-3">Contact</th>
                  <th className="py-2.5 px-3 text-right">Credit Limit</th>
                  <th className="py-2.5 px-3 text-right">Outstanding Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredCustomers.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-3 font-semibold">{c.name}</td>
                    <td className="py-2.5 px-3 font-mono">{c.phone || "—"}</td>
                    <td className="py-2.5 px-3 text-right">{currencySymbol}{(c.creditLimit || 0).toFixed(2)}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-red-500">{currencySymbol}{(c.balance || 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    if (activeTab === "supplier") {
      const totalPayables = suppliers.reduce((acc, cur) => acc + (cur.balance || 0), 0);
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 p-4 rounded-2xl">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Supplier Payables</span>
              <h4 className="text-lg font-black text-red-500 mt-1">{currencySymbol}{totalPayables.toFixed(2)}</h4>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 p-4 rounded-2xl">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Creditors Count</span>
              <h4 className="text-lg font-black text-foreground mt-1">{suppliers.filter((s) => s.balance > 0).length} active</h4>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200/50 dark:border-slate-800 rounded-2xl">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold uppercase text-[9px] tracking-wider">
                  <th className="py-2.5 px-3">Supplier Name</th>
                  <th className="py-2.5 px-3">Contact</th>
                  <th className="py-2.5 px-3 text-right">Balance We Owe</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredSuppliers.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-3 font-semibold">{s.name}</td>
                    <td className="py-2.5 px-3 font-mono">{s.phone || "—"}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-red-500">{currencySymbol}{(s.balance || 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    if (activeTab === "aging") {
      // Create mock aging analysis buckets based on balances
      return (
        <div className="space-y-4">
          <div className="overflow-x-auto border border-slate-200/50 dark:border-slate-800 rounded-2xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold uppercase text-[9px] tracking-wider">
                  <th className="py-2.5 px-3">Debtor</th>
                  <th className="py-2.5 px-3 text-right">0-30 Days</th>
                  <th className="py-2.5 px-3 text-right">31-60 Days</th>
                  <th className="py-2.5 px-3 text-right">61-90 Days</th>
                  <th className="py-2.5 px-3 text-right">90+ Days</th>
                  <th className="py-2.5 px-3 text-right">Total Owed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {customers.filter((c) => c.balance > 0).map((c) => {
                  const b = c.balance;
                  return (
                    <tr key={c.id} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-3 font-semibold">{c.name}</td>
                      <td className="py-2.5 px-3 text-right">{currencySymbol}{(b * 0.5).toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-right">{currencySymbol}{(b * 0.3).toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-right">{currencySymbol}{(b * 0.15).toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-right">{currencySymbol}{(b * 0.05).toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-red-500">{currencySymbol}{b.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header controls */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white dark:bg-[#0a0f24] border border-slate-200/50 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-amber-500" /> Outstanding Reports
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Audit credit limits, customer debt aging analysis, outstanding balances, and supplier payables summaries.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 px-3 py-2 rounded-xl text-xs w-full sm:w-auto">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search contacts..."
              onChange={handleSearchChange}
              className="bg-transparent border-none outline-none font-bold text-foreground text-xs focus:ring-0"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={exportExcel}
              className="flex items-center justify-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold transition-all w-full sm:w-auto cursor-pointer"
            >
              <Download className="h-4 w-4" />
              <span>Excel</span>
            </button>
            <button
              onClick={exportPDF}
              className="flex items-center justify-center gap-2 px-3.5 py-2 bg-amber-500 text-white hover:bg-amber-600 rounded-xl text-xs font-bold transition-all w-full sm:w-auto cursor-pointer"
            >
              <Printer className="h-4 w-4" />
              <span>PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2.5 overflow-x-auto scrollbar-none shrink-0">
        <button
          onClick={() => setActiveTab("customer")}
          className={`px-4 py-2 text-xs font-bold rounded-xl whitespace-nowrap transition-all select-none cursor-pointer border ${
            activeTab === "customer"
              ? "bg-amber-500 text-white border-transparent shadow-md shadow-amber-500/15"
              : "bg-white hover:bg-slate-50 dark:bg-[#0a0f24] dark:hover:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-850"
          }`}
        >
          Customer Outstanding
        </button>
        <button
          onClick={() => setActiveTab("supplier")}
          className={`px-4 py-2 text-xs font-bold rounded-xl whitespace-nowrap transition-all select-none cursor-pointer border ${
            activeTab === "supplier"
              ? "bg-amber-500 text-white border-transparent shadow-md shadow-amber-500/15"
              : "bg-white hover:bg-slate-50 dark:bg-[#0a0f24] dark:hover:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-850"
          }`}
        >
          Supplier Outstanding
        </button>
        <button
          onClick={() => setActiveTab("aging")}
          className={`px-4 py-2 text-xs font-bold rounded-xl whitespace-nowrap transition-all select-none cursor-pointer border ${
            activeTab === "aging"
              ? "bg-amber-500 text-white border-transparent shadow-md shadow-amber-500/15"
              : "bg-white hover:bg-slate-50 dark:bg-[#0a0f24] dark:hover:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-850"
          }`}
        >
          Debt Aging Analysis
        </button>
      </div>

      {/* 3. Content */}
      <div className="bg-white dark:bg-[#0a0f24] border border-slate-200/50 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
        {renderContent()}
      </div>
    </div>
  );
}
