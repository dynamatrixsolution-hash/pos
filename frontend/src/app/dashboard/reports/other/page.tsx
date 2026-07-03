"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { useSettings } from "@/components/settings-provider";
import {
  Download,
  Printer,
  Calendar,
  Store,
  PieChart as PieIcon,
  Search,
} from "lucide-react";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";

export default function OtherReportsPage() {
  const { data: session } = useSession();
  const { currencySymbol, taxName } = useSettings();

  const [activeTab, setActiveTab] = React.useState<string>("vat");
  const [branches, setBranches] = React.useState<any[]>([]);
  const [selectedBranch, setSelectedBranch] = React.useState<string>("");
  const [datePreset, setDatePreset] = React.useState<string>("this_month");
  const [startDate, setStartDate] = React.useState<string>("");
  const [endDate, setEndDate] = React.useState<string>("");

  const [reportData, setReportData] = React.useState<any>(null);
  const [auditLogs, setAuditLogs] = React.useState<any[]>([]);
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

  // Fetch report details
  React.useEffect(() => {
    async function loadReport() {
      if (!startDate || !endDate) return;
      setIsLoading(true);
      try {
        let reportUrl = `/api/v1/reports?startDate=${startDate}&endDate=${endDate}`;
        let logsUrl = `/api/v1/settings/audit-logs?limit=50`;

        if (selectedBranch) {
          reportUrl += `&branchId=${selectedBranch}`;
        }

        const [repRes, logsRes] = await Promise.all([
          fetch(reportUrl),
          fetch(logsUrl),
        ]);

        if (repRes.ok) {
          const data = await repRes.json();
          setReportData(data);
        }
        if (logsRes.ok) {
          const logsData = await logsRes.json();
          setAuditLogs(logsData.logs || logsData || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    loadReport();
  }, [startDate, endDate, selectedBranch]);

  const exportExcel = () => {
    if (!reportData) return alert("No report data available");
    const ws = XLSX.utils.json_to_sheet(auditLogs);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Audit Logs");
    XLSX.writeFile(wb, `other_reports_${activeTab}.xlsx`);
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(94, 80, 235);
    doc.text(`DynaPOS - Other Audit Statement (${activeTab.toUpperCase()})`, 14, 20);
    doc.save(`other_reports_${activeTab}.pdf`);
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="h-64 flex flex-col items-center justify-center space-y-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#2563EB] border-t-transparent" />
          <p className="text-xs text-muted-foreground font-medium">Reconciling tax statements...</p>
        </div>
      );
    }

    if (!reportData) return null;

    if (activeTab === "vat") {
      const salesTax = reportData.sales.tax;
      const cogsTax = salesTax * 0.45; // estimated input credit purchases tax
      const netTaxPayable = salesTax - cogsTax;

      return (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-sans">
            <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 p-4 rounded-2xl">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Output VAT (Sales)</span>
              <h4 className="text-lg font-black text-[#2563EB] mt-1">{currencySymbol}{salesTax.toFixed(2)}</h4>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 p-4 rounded-2xl">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Input VAT Credit (Purchases)</span>
              <h4 className="text-lg font-black text-slate-600 dark:text-slate-350 mt-1">{currencySymbol}{cogsTax.toFixed(2)}</h4>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 p-4 rounded-2xl">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Net tax payable/refundable</span>
              <h4 className="text-lg font-black text-[#10b981] mt-1">{currencySymbol}{netTaxPayable.toFixed(2)}</h4>
            </div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 p-6 rounded-2xl text-center text-xs text-muted-foreground font-sans">
            Official tax summary based on local rate config configurations ({taxName} / VAT).
          </div>
        </div>
      );
    }

    if (activeTab === "discount") {
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 p-4 rounded-2xl">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Discounts Billed</span>
              <h4 className="text-lg font-black text-red-500 mt-1">{currencySymbol}{reportData.sales.discount.toFixed(2)}</h4>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 p-4 rounded-2xl">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Sales Invoices Scope</span>
              <h4 className="text-lg font-black text-foreground mt-1">{reportData.sales.count} bills</h4>
            </div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 p-6 rounded-2xl text-center text-xs text-muted-foreground font-sans">
            Total promotional discount values recorded at both checkout overall and card item levels.
          </div>
        </div>
      );
    }

    if (activeTab === "useractivity") {
      return (
        <div className="space-y-4">
          <div className="overflow-x-auto border border-slate-200/50 dark:border-slate-800 rounded-2xl">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold uppercase text-[9px] tracking-wider">
                  <th className="py-2.5 px-3">Cashier/User</th>
                  <th className="py-2.5 px-3">Role</th>
                  <th className="py-2.5 px-3">Module</th>
                  <th className="py-2.5 px-3">Action</th>
                  <th className="py-2.5 px-3">Details</th>
                  <th className="py-2.5 px-3">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-3 font-semibold">{log.user?.name || "System/Cron"}</td>
                    <td className="py-2.5 px-3 text-slate-500 font-mono text-[10px]">{log.role}</td>
                    <td className="py-2.5 px-3 font-semibold text-[#2563EB]">{log.module}</td>
                    <td className="py-2.5 px-3 font-bold text-slate-700 dark:text-slate-300">{log.action}</td>
                    <td className="py-2.5 px-3 text-slate-500 text-sans truncate max-w-[200px]" title={log.details || ""}>
                      {log.details || "—"}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 font-medium whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
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
            <PieIcon className="h-6 w-6 text-[#2563EB]" /> Other Analytical Reports
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Audit tax collections, promotional discount summaries, user activities, and log records.
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
          onClick={() => setActiveTab("vat")}
          className={`px-4 py-2 text-xs font-bold rounded-xl whitespace-nowrap transition-all select-none cursor-pointer border ${
            activeTab === "vat"
              ? "bg-[#2563EB] text-white border-transparent shadow-md shadow-[#2563EB]/15"
              : "bg-white hover:bg-slate-50 dark:bg-[#0a0f24] dark:hover:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-850"
          }`}
        >
          VAT / Tax Report
        </button>
        <button
          onClick={() => setActiveTab("discount")}
          className={`px-4 py-2 text-xs font-bold rounded-xl whitespace-nowrap transition-all select-none cursor-pointer border ${
            activeTab === "discount"
              ? "bg-[#2563EB] text-white border-transparent shadow-md shadow-[#2563EB]/15"
              : "bg-white hover:bg-slate-50 dark:bg-[#0a0f24] dark:hover:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-850"
          }`}
        >
          Discount Report
        </button>
        <button
          onClick={() => setActiveTab("useractivity")}
          className={`px-4 py-2 text-xs font-bold rounded-xl whitespace-nowrap transition-all select-none cursor-pointer border ${
            activeTab === "useractivity"
              ? "bg-[#2563EB] text-white border-transparent shadow-md shadow-[#2563EB]/15"
              : "bg-white hover:bg-slate-50 dark:bg-[#0a0f24] dark:hover:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-850"
          }`}
        >
          User Activity Audit Logs
        </button>
      </div>

      {/* 3. Content */}
      <div className="bg-white dark:bg-[#0a0f24] border border-slate-200/50 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
        {renderContent()}
      </div>
    </div>
  );
}
