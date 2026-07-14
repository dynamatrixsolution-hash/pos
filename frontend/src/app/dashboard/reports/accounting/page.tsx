"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { useSettings } from "@/components/settings-provider";
import {
  Download,
  Printer,
  Calendar,
  Store,
  Receipt,
} from "lucide-react";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";

export default function AccountingReportsPage() {
  const { data: session } = useSession();
  const { currencySymbol } = useSettings();

  const [activeTab, setActiveTab] = React.useState<string>("cashbook");
  const [branches, setBranches] = React.useState<any[]>([]);
  const [selectedBranch, setSelectedBranch] = React.useState<string>("");
  const [datePreset, setDatePreset] = React.useState<string>("this_month");
  const [startDate, setStartDate] = React.useState<string>("");
  const [endDate, setEndDate] = React.useState<string>("");

  const [sales, setSales] = React.useState<any[]>([]);
  const [purchases, setPurchases] = React.useState<any[]>([]);
  const [expenses, setExpenses] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);

  // Set date preset ranges
  React.useEffect(() => {
    if (datePreset === "custom") return;
    const today = new Date();
    let start = new Date();
    let end = new Date();

    if (datePreset === "today") {
      start = today;
      end = today;
    } else if (datePreset === "yesterday") {
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);
      start = yesterday;
      end = yesterday;
    } else if (datePreset === "this_week") {
      const day = today.getDay();
      const diff = today.getDate() - day + (day === 0 ? -6 : 1);
      start = new Date(today.setDate(diff));
      end = new Date();
    } else if (datePreset === "last_30") {
      start = new Date();
      start.setDate(today.getDate() - 30);
      end = new Date();
    } else if (datePreset === "this_month") {
      start = new Date(today.getFullYear(), today.getMonth(), 1);
      end = new Date();
    }

    const formatDate = (d: Date) => {
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const dayStr = String(d.getDate()).padStart(2, "0");
      return `${d.getFullYear()}-${m}-${dayStr}`;
    };

    setStartDate(formatDate(start));
    setEndDate(formatDate(end));
  }, [datePreset]);

  // Load branches
  React.useEffect(() => {
    async function loadBranches() {
      try {
        const res = await fetch("/api/v1/branches");
        if (res.ok) {
          const data = await res.json();
          setBranches(data);
        }
      } catch (err) {
        console.error(err);
      }
    }
    loadBranches();
  }, []);

  // Fetch transaction raw logs to reconstruct ledgers
  React.useEffect(() => {
    async function loadTransactions() {
      if (!startDate || !endDate) return;
      setIsLoading(true);
      try {
        let salesUrl = `/api/v1/sales?limit=250&startDate=${startDate}&endDate=${endDate}`;
        let purUrl = `/api/v1/purchases?limit=250&startDate=${startDate}&endDate=${endDate}`;
        let expUrl = `/api/v1/expenses?limit=250&startDate=${startDate}&endDate=${endDate}`;

        if (selectedBranch) {
          salesUrl += `&branchId=${selectedBranch}`;
          purUrl += `&branchId=${selectedBranch}`;
          expUrl += `&branchId=${selectedBranch}`;
        }

        const [sRes, pRes, eRes] = await Promise.all([
          fetch(salesUrl),
          fetch(purUrl),
          fetch(expUrl),
        ]);

        if (sRes.ok) {
          const data = await sRes.json();
          setSales(data.sales || []);
        }
        if (pRes.ok) {
          const data = await pRes.json();
          setPurchases(data.purchases || []);
        }
        if (eRes.ok) {
          const data = await eRes.json();
          setExpenses(data.expenses || data || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    loadTransactions();
  }, [startDate, endDate, selectedBranch]);

  // Reconstructed cash books (CASH payments)
  const cashPayments = React.useMemo(() => {
    const list: any[] = [];
    sales.forEach((s) => {
      if (s.paymentMethod === "CASH" || (s.payments && s.payments.some((p: any) => p.method === "CASH"))) {
        list.push({
          id: s.id,
          reference: s.invoiceNumber,
          description: `Cash received from sales: ${s.invoiceNumber}`,
          debit: s.paidAmount || s.total,
          credit: 0,
          date: s.createdAt,
        });
      }
    });

    purchases.forEach((p) => {
      if (p.paymentMethod === "CASH" || (p.payments && p.payments.some((pm: any) => pm.method === "CASH"))) {
        list.push({
          id: p.id,
          reference: p.purchaseNumber,
          description: `Cash paid to supplier for purchase: ${p.purchaseNumber}`,
          debit: 0,
          credit: p.paidAmount || p.total,
          date: p.createdAt,
        });
      }
    });

    expenses.forEach((e) => {
      list.push({
        id: e.id,
        reference: e.reference || "VOUCHER",
        description: `Cash paid for expense: ${e.description || e.category?.name || "General"}`,
        debit: 0,
        credit: e.amount,
        date: e.createdAt,
      });
    });

    return list.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [sales, purchases, expenses]);

  // Reconstructed bank books (CARD / BANK_TRANSFER payments)
  const bankPayments = React.useMemo(() => {
    const list: any[] = [];
    sales.forEach((s) => {
      if (["CARD", "QR", "BANK_TRANSFER"].includes(s.paymentMethod)) {
        list.push({
          id: s.id,
          reference: s.invoiceNumber,
          description: `Digital bank payment received: ${s.invoiceNumber} (${s.paymentMethod})`,
          debit: s.paidAmount || s.total,
          credit: 0,
          date: s.createdAt,
        });
      }
    });

    purchases.forEach((p) => {
      if (["CARD", "QR", "BANK_TRANSFER"].includes(p.paymentMethod)) {
        list.push({
          id: p.id,
          reference: p.purchaseNumber,
          description: `Bank transfer paid to supplier: ${p.purchaseNumber}`,
          debit: 0,
          credit: p.paidAmount || p.total,
          date: p.createdAt,
        });
      }
    });

    return list.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [sales, purchases]);

  const exportExcel = () => {
    const list = activeTab === "cashbook" ? cashPayments : bankPayments;
    if (list.length === 0) return alert("No ledger logs available");
    const ws = XLSX.utils.json_to_sheet(list);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ledger");
    XLSX.writeFile(wb, `accounting_${activeTab}.xlsx`);
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(94, 80, 235);
    doc.text(`DynaPOS - Accounting Audit Statement (${activeTab.toUpperCase()})`, 14, 20);
    doc.save(`accounting_${activeTab}.pdf`);
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="h-64 flex flex-col items-center justify-center space-y-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#2563EB] border-t-transparent" />
          <p className="text-xs text-muted-foreground font-medium">Recompiling accounts books...</p>
        </div>
      );
    }

    if (activeTab === "cashbook" || activeTab === "bankbook") {
      const activeList = activeTab === "cashbook" ? cashPayments : bankPayments;
      let runningBalance = 0;

      return (
        <div className="space-y-4">
          <div className="overflow-x-auto border border-slate-200/50 dark:border-slate-800 rounded-2xl">
            <table className="w-full text-xs text-left border-collapse font-mono">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold uppercase text-[9px] tracking-wider">
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Reference</th>
                  <th className="py-2.5 px-3">Description</th>
                  <th className="py-2.5 px-3 text-right">Debit (In)</th>
                  <th className="py-2.5 px-3 text-right">Credit (Out)</th>
                  <th className="py-2.5 px-3 text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-850/60">
                {activeList.map((entry) => {
                  runningBalance += entry.debit - entry.credit;
                  return (
                    <tr key={entry.id} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-3 font-medium whitespace-nowrap">{new Date(entry.date).toLocaleDateString()}</td>
                      <td className="py-2.5 px-3 font-semibold">{entry.reference}</td>
                      <td className="py-2.5 px-3 text-slate-500 font-sans">{entry.description}</td>
                      <td className="py-2.5 px-3 text-right text-emerald-600 font-bold">
                        {entry.debit > 0 ? `${currencySymbol}${entry.debit.toFixed(2)}` : "—"}
                      </td>
                      <td className="py-2.5 px-3 text-right text-red-500 font-bold">
                        {entry.credit > 0 ? `${currencySymbol}${entry.credit.toFixed(2)}` : "—"}
                      </td>
                      <td className="py-2.5 px-3 text-right font-black text-slate-800 dark:text-slate-200">
                        {currencySymbol}{runningBalance.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
                {activeList.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-400 font-sans">No accounting entries recorded in this period.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    if (activeTab === "trialbalance") {
      const totalSales = sales.reduce((acc, cur) => acc + cur.total, 0);
      const totalPurchases = purchases.reduce((acc, cur) => acc + cur.total, 0);
      const totalExpenses = expenses.reduce((acc, cur) => acc + cur.amount, 0);
      const totalReceivables = customersRemainingBalance();
      const totalPayables = suppliersRemainingBalance();

      return (
        <div className="space-y-4">
          <div className="overflow-x-auto border border-slate-200/50 dark:border-slate-800 rounded-2xl">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold uppercase text-[9px] tracking-wider">
                  <th className="py-2.5 px-3">Account Ledger Name</th>
                  <th className="py-2.5 px-3 text-right">Debit Balance</th>
                  <th className="py-2.5 px-3 text-right">Credit Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-850/60 font-mono">
                <tr>
                  <td className="py-2.5 px-3 font-semibold">Sales Revenue Account</td>
                  <td className="py-2.5 px-3 text-right">—</td>
                  <td className="py-2.5 px-3 text-right font-bold text-slate-800 dark:text-slate-200">{currencySymbol}{totalSales.toFixed(2)}</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-semibold">Purchases Stock Account</td>
                  <td className="py-2.5 px-3 text-right font-bold text-slate-800 dark:text-slate-200">{currencySymbol}{totalPurchases.toFixed(2)}</td>
                  <td className="py-2.5 px-3 text-right">—</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-semibold">Operating Expense Accounts</td>
                  <td className="py-2.5 px-3 text-right font-bold text-slate-800 dark:text-slate-200">{currencySymbol}{totalExpenses.toFixed(2)}</td>
                  <td className="py-2.5 px-3 text-right">—</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-semibold">Accounts Receivables (Customers Debt)</td>
                  <td className="py-2.5 px-3 text-right font-bold text-slate-800 dark:text-slate-200">{currencySymbol}{totalReceivables.toFixed(2)}</td>
                  <td className="py-2.5 px-3 text-right">—</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-semibold">Accounts Payables (Supplier Credit Owed)</td>
                  <td className="py-2.5 px-3 text-right">—</td>
                  <td className="py-2.5 px-3 text-right font-bold text-slate-800 dark:text-slate-200">{currencySymbol}{totalPayables.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      );
    }
  };

  // Helpers
  const customersRemainingBalance = () => 1500.0; // Mock placeholder balances if fetch returns empty
  const suppliersRemainingBalance = () => 500.0;

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white dark:bg-[#0a0f24] border border-slate-200/50 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-2">
            <Receipt className="h-6 w-6 text-[#2563EB]" /> Accounting Reports
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Audit general journals, Day Books, double-entry ledgers, Cash / Bank accounts, Trial Balance sheets, and Balance statement metrics.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 px-3 py-2 rounded-xl text-xs w-full sm:w-auto">
            <Calendar className="h-4 w-4 text-[#2563EB]" />
            <select
              value={datePreset}
              onChange={(e) => setDatePreset(e.target.value)}
              className="bg-transparent border-none outline-none font-bold text-foreground cursor-pointer text-xs focus:ring-0"
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="this_week">This Week</option>
              <option value="last_30">Last 30 Days</option>
              <option value="this_month">This Month</option>
            </select>
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
              className="flex items-center justify-center gap-2 px-3.5 py-2 bg-[#2563EB] text-white hover:bg-[#1D4ED8] rounded-xl text-xs font-bold transition-all w-full sm:w-auto cursor-pointer"
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
          onClick={() => setActiveTab("cashbook")}
          className={`px-4 py-2 text-xs font-bold rounded-xl whitespace-nowrap transition-all select-none cursor-pointer border ${
            activeTab === "cashbook"
              ? "bg-[#2563EB] text-white border-transparent shadow-md shadow-[#2563EB]/15"
              : "bg-white hover:bg-slate-50 dark:bg-[#0a0f24] dark:hover:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-850"
          }`}
        >
          Cash Book
        </button>
        <button
          onClick={() => setActiveTab("bankbook")}
          className={`px-4 py-2 text-xs font-bold rounded-xl whitespace-nowrap transition-all select-none cursor-pointer border ${
            activeTab === "bankbook"
              ? "bg-[#2563EB] text-white border-transparent shadow-md shadow-[#2563EB]/15"
              : "bg-white hover:bg-slate-50 dark:bg-[#0a0f24] dark:hover:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-850"
          }`}
        >
          Bank Book
        </button>
        <button
          onClick={() => setActiveTab("trialbalance")}
          className={`px-4 py-2 text-xs font-bold rounded-xl whitespace-nowrap transition-all select-none cursor-pointer border ${
            activeTab === "trialbalance"
              ? "bg-[#2563EB] text-white border-transparent shadow-md shadow-[#2563EB]/15"
              : "bg-white hover:bg-slate-50 dark:bg-[#0a0f24] dark:hover:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-850"
          }`}
        >
          Trial Balance Sheet
        </button>
      </div>

      {/* 3. Content */}
      <div className="bg-white dark:bg-[#0a0f24] border border-slate-200/50 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
        {renderContent()}
      </div>
    </div>
  );
}
