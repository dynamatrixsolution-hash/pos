"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { useSettings } from "@/components/settings-provider";
import {
  Search,
  Download,
  Printer,
  Calendar,
  Store,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";

export default function TransactionReportsPage() {
  const { data: session } = useSession();
  const { currencySymbol } = useSettings();

  const [activeTab, setActiveTab] = React.useState<string>("sales");
  const [branches, setBranches] = React.useState<any[]>([]);
  const [selectedBranch, setSelectedBranch] = React.useState<string>("");
  const [searchQuery, setSearchQuery] = React.useState<string>("");
  const [datePreset, setDatePreset] = React.useState<string>("this_month");
  const [startDate, setStartDate] = React.useState<string>("");
  const [endDate, setEndDate] = React.useState<string>("");

  const [items, setItems] = React.useState<any[]>([]);
  const [page, setPage] = React.useState<number>(1);
  const [totalPages, setTotalPages] = React.useState<number>(1);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);

  // Set date ranges
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
    setPage(1);
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

  // Fetch transaction list based on active tab
  const fetchTransactions = React.useCallback(async () => {
    setIsLoading(true);
    try {
      let endpoint = "";
      if (activeTab === "sales") endpoint = "/api/v1/sales";
      else if (activeTab === "purchase") endpoint = "/api/v1/purchases";
      else if (activeTab === "expense") endpoint = "/api/v1/expenses";
      else if (activeTab === "payment") endpoint = "/api/v1/payments"; // fetch all payments

      let url = `${endpoint}?page=${page}&limit=20`;
      if (selectedBranch) url += `&branchId=${selectedBranch}`;
      if (startDate) url += `&startDate=${startDate}`;
      if (endDate) url += `&endDate=${endDate}`;
      if (searchQuery) url += `&search=${encodeURIComponent(searchQuery)}`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        // Standardize output formats
        setItems(data.sales || data.purchases || data.expenses || data.payments || data.data || []);
        setTotalPages(data.pagination?.totalPages || 1);
      } else {
        setItems([]);
      }
    } catch (err) {
      console.error(err);
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, page, selectedBranch, startDate, endDate, searchQuery]);

  React.useEffect(() => {
    fetchTransactions();
  }, [activeTab, page, selectedBranch, startDate, endDate, fetchTransactions]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setPage(1);
  };

  const tabs = [
    { id: "sales", label: "Sales Transactions" },
    { id: "purchase", label: "Purchase Transactions" },
    { id: "payment", label: "Payment Transactions" },
    { id: "expense", label: "Expense Transactions" },
  ];

  const exportExcel = () => {
    if (items.length === 0) return alert("No transactions to export");
    const ws = XLSX.utils.json_to_sheet(items);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Transactions");
    XLSX.writeFile(wb, `transactions_${activeTab}.xlsx`);
  };

  const exportPDF = () => {
    if (items.length === 0) return alert("No transactions to export");
    const doc = new jsPDF();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(94, 80, 235);
    doc.text(`DynaPOS - ${activeTab.toUpperCase()} Transactions Report`, 14, 20);
    doc.save(`transactions_${activeTab}.pdf`);
  };

  const formatDateTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const dateFormatted = d.toISOString().split("T")[0];
    const timeFormatted = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
    return { date: dateFormatted, time: timeFormatted };
  };

  const formatMethod = (method?: string, fallback = "Cash") => {
    if (!method) return fallback;
    const m = method.toUpperCase();
    if (m === "CASH") return "Cash";
    if (m === "QR") return "E-Sewa";
    if (m === "BANK_TRANSFER") return "Bank Transfer";
    if (m === "CARD") return "Card";
    if (m === "CREDIT") return "Credit";
    return method;
  };

  const renderTable = () => {
    if (items.length === 0) {
      return (
        <div className="py-12 text-center text-xs text-slate-400">
          No transactions match current filters.
        </div>
      );
    }

    if (activeTab === "sales") {
      return (
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-200/60 dark:border-slate-800 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
              <th className="py-4 px-6">DATE | TIME</th>
              <th className="py-4 px-6">INVOICE NO</th>
              <th className="py-4 px-6">CUSTOMER</th>
              <th className="py-4 px-6">METHOD</th>
              <th className="py-4 px-6 text-right">AMOUNT</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-slate-950">
            {items.map((item) => {
              const { date, time } = formatDateTime(item.createdAt);
              const method = formatMethod(item.payments?.[0]?.method || item.paymentMethod);
              return (
                <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-4 px-6">
                    <div className="font-bold text-slate-800 dark:text-slate-200 text-xs">{date}</div>
                    <div className="text-[10px] text-slate-400 font-medium mt-0.5">{time}</div>
                  </td>
                  <td className="py-4 px-6 font-semibold text-slate-700 dark:text-slate-300">{item.invoiceNumber}</td>
                  <td className="py-4 px-6 font-semibold text-slate-700 dark:text-slate-300">{item.customer?.name || "Walk-in Customer"}</td>
                  <td className="py-4 px-6 font-medium text-slate-600 dark:text-slate-400">{method}</td>
                  <td className="py-4 px-6 text-right font-black text-slate-900 dark:text-white text-sm">
                    {currencySymbol} {(item.total ?? 0).toFixed(2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      );
    }

    if (activeTab === "purchase") {
      return (
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-200/60 dark:border-slate-800 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
              <th className="py-4 px-6">DATE | TIME</th>
              <th className="py-4 px-6">PO NO</th>
              <th className="py-4 px-6">SUPPLIER</th>
              <th className="py-4 px-6">STATUS</th>
              <th className="py-4 px-6 text-right">AMOUNT</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-slate-950">
            {items.map((item) => {
              const { date, time } = formatDateTime(item.createdAt);
              return (
                <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-4 px-6">
                    <div className="font-bold text-slate-800 dark:text-slate-200 text-xs">{date}</div>
                    <div className="text-[10px] text-slate-400 font-medium mt-0.5">{time}</div>
                  </td>
                  <td className="py-4 px-6 font-semibold text-slate-700 dark:text-slate-300">{item.purchaseNumber}</td>
                  <td className="py-4 px-6 font-semibold text-slate-700 dark:text-slate-300">{item.supplier?.name || "N/A"}</td>
                  <td className="py-4 px-6 font-medium text-slate-600 dark:text-slate-400">{item.paymentStatus}</td>
                  <td className="py-4 px-6 text-right font-black text-slate-900 dark:text-white text-sm">
                    {currencySymbol} {(item.total ?? 0).toFixed(2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      );
    }

    if (activeTab === "payment") {
      return (
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-200/60 dark:border-slate-800 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
              <th className="py-4 px-6">DATE | TIME</th>
              <th className="py-4 px-6">RECEIPT NO</th>
              <th className="py-4 px-6">PARTY</th>
              <th className="py-4 px-6">METHOD</th>
              <th className="py-4 px-6 text-right">AMOUNT</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-slate-950">
            {items.map((item) => {
              const { date, time } = formatDateTime(item.createdAt);
              const method = formatMethod(item.method);
              return (
                <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-4 px-6">
                    <div className="font-bold text-slate-800 dark:text-slate-200 text-xs">{date}</div>
                    <div className="text-[10px] text-slate-400 font-medium mt-0.5">{time}</div>
                  </td>
                  <td className="py-4 px-6 font-semibold text-slate-700 dark:text-slate-300">{item.receiptNumber || "—"}</td>
                  <td className="py-4 px-6 font-semibold text-slate-700 dark:text-slate-300">{item.customer?.name || item.supplier?.name || "Walk-in Customer"}</td>
                  <td className="py-4 px-6 font-medium text-slate-600 dark:text-slate-400">{method}</td>
                  <td className="py-4 px-6 text-right font-black text-slate-900 dark:text-white text-sm">
                    {currencySymbol} {(item.amount ?? 0).toFixed(2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      );
    }

    if (activeTab === "expense") {
      return (
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-200/60 dark:border-slate-800 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
              <th className="py-4 px-6">DATE | TIME</th>
              <th className="py-4 px-6">REF NO</th>
              <th className="py-4 px-6">CATEGORY</th>
              <th className="py-4 px-6">DESCRIPTION</th>
              <th className="py-4 px-6 text-right">AMOUNT</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-slate-950">
            {items.map((item) => {
              const { date, time } = formatDateTime(item.createdAt);
              return (
                <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-4 px-6">
                    <div className="font-bold text-slate-800 dark:text-slate-200 text-xs">{date}</div>
                    <div className="text-[10px] text-slate-400 font-medium mt-0.5">{time}</div>
                  </td>
                  <td className="py-4 px-6 font-semibold text-slate-700 dark:text-slate-300">{item.reference || "—"}</td>
                  <td className="py-4 px-6 font-semibold text-slate-700 dark:text-slate-300">{item.category?.name || "Other"}</td>
                  <td className="py-4 px-6 font-medium text-slate-600 dark:text-slate-400 truncate max-w-[200px]">{item.description || "—"}</td>
                  <td className="py-4 px-6 text-right font-black text-slate-900 dark:text-white text-sm">
                    {currencySymbol} {(item.amount ?? 0).toFixed(2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white dark:bg-[#0a0f24] border border-slate-200/50 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-[#2563EB]" /> Transaction Reports
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Audit and filter detailed transactional history registers, sales logs, PO values, payment vouchers, and expense logs.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
          {/* Preset parameters */}
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

          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 px-3 py-2 rounded-xl text-xs w-full sm:w-auto">
            <Store className="h-4 w-4 text-[#2563EB]" />
            <select
              value={selectedBranch}
              onChange={(e) => {
                setSelectedBranch(e.target.value);
                setPage(1);
              }}
              className="bg-transparent border-none outline-none font-bold text-foreground cursor-pointer text-xs focus:ring-0"
            >
              <option value="">All Branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={exportExcel}
              disabled={isLoading || items.length === 0}
              className="flex items-center justify-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold transition-all w-full sm:w-auto cursor-pointer"
            >
              <Download className="h-4 w-4" />
              <span>Excel</span>
            </button>
            <button
              onClick={exportPDF}
              disabled={isLoading || items.length === 0}
              className="flex items-center justify-center gap-2 px-3.5 py-2 bg-[#2563EB] text-white hover:bg-[#1D4ED8] rounded-xl text-xs font-bold transition-all w-full sm:w-auto cursor-pointer"
            >
              <Printer className="h-4 w-4" />
              <span>Print</span>
            </button>
          </div>
        </div>
      </div>

      {/* Search Input bar */}
      <div className="relative flex items-center bg-white dark:bg-[#0a0f24] border border-slate-200/50 dark:border-slate-800 rounded-2xl px-3.5 h-11 w-full max-w-md shadow-xs">
        <Search className="h-4.5 w-4.5 text-slate-400" />
        <input
          type="text"
          placeholder="Search by invoice code, supplier name..."
          value={searchQuery}
          onChange={handleSearchChange}
          className="w-full bg-transparent border-none text-xs outline-none pl-2.5 text-foreground placeholder-slate-400 font-semibold"
        />
      </div>

      {/* Tabs list */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2.5 overflow-x-auto scrollbar-none shrink-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              setItems([]);
              setPage(1);
            }}
            className={`px-4 py-2 text-xs font-bold rounded-xl whitespace-nowrap transition-all select-none cursor-pointer border ${
              activeTab === tab.id
                ? "bg-[#2563EB] text-white border-transparent shadow-md shadow-[#2563EB]/15"
                : "bg-white hover:bg-slate-50 dark:bg-[#0a0f24] dark:hover:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-850"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main Table container */}
      <div className="bg-white dark:bg-[#0a0f24] border border-slate-200/50 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="h-64 flex flex-col items-center justify-center space-y-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#2563EB] border-t-transparent" />
            <p className="text-xs text-muted-foreground">Loading transaction logs...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            {renderTable()}
          </div>
        )}

        {/* Pagination */}
        {!isLoading && totalPages > 1 && (
          <div className="flex justify-between items-center px-6 py-4 border-t border-slate-150 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/30">
            <span className="text-xs text-muted-foreground font-semibold">
              Showing page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                className="px-3 py-1.5 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold bg-white dark:bg-slate-950 hover:bg-slate-50 disabled:opacity-50 transition-all cursor-pointer"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                className="px-3 py-1.5 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold bg-white dark:bg-slate-950 hover:bg-slate-50 disabled:opacity-50 transition-all cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
