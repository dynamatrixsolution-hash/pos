"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { useSettings } from "@/components/settings-provider";
import {
  TrendingUp,
  DollarSign,
  Printer,
  Calendar,
  Store,
  Download,
  Users,
  BarChart3,
  CreditCard,
  Layers,
  ArrowRight,
  TrendingDown,
  Clock,
  PieChart as PieIcon,
  Calculator,
} from "lucide-react";
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
} from "recharts";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";

interface DailyReportData {
  sales: number;
  purchases: number;
  collections: number;
  payments: number;
  expenses: number;
  profit: number;
}

export default function DailyReportsPage() {
  const { data: session } = useSession();
  const { currencySymbol, taxName } = useSettings();

  const [activeTab, setActiveTab] = React.useState<string>("sales");
  const [selectedBranch, setSelectedBranch] = React.useState<string>("");
  const [selectedCashier, setSelectedCashier] = React.useState<string>("");
  const [dateStr, setDateStr] = React.useState<string>("");
  const [mounted, setMounted] = React.useState(false);

  const [branches, setBranches] = React.useState<any[]>([]);
  const [cashiers, setCashiers] = React.useState<any[]>([]);
  const [reportData, setReportData] = React.useState<any>(null);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);

  // Default to today
  React.useEffect(() => {
    setMounted(true);
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    setDateStr(`${yyyy}-${mm}-${dd}`);
  }, []);

  // Fetch filters (branches and cashiers)
  React.useEffect(() => {
    async function loadFilters() {
      try {
        const [branchRes, cashierRes] = await Promise.all([
          fetch("/api/v1/branches"),
          fetch("/api/v1/users"),
        ]);
        if (branchRes.ok) {
          const data = await branchRes.json();
          setBranches(data);
        }
        if (cashierRes.ok) {
          const data = await cashierRes.json();
          const usersList = data.users || data || [];
          setCashiers(Array.isArray(usersList) ? usersList.filter((u: any) => u.role === "CASHIER" || u.role === "MANAGER") : []);
        }
      } catch (err) {
        console.error("Failed to load filter metadata:", err);
      }
    }
    loadFilters();
  }, []);

  // Fetch report data
  const fetchDailyReport = React.useCallback(async () => {
    if (!dateStr) return;
    setIsLoading(true);
    try {
      let url = `/api/v1/reports?startDate=${dateStr}&endDate=${dateStr}`;
      if (selectedBranch) {
        url += `&branchId=${selectedBranch}`;
      }
      
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setReportData(data);
      }
    } catch (err) {
      console.error("Failed to load daily report:", err);
    } finally {
      setIsLoading(false);
    }
  }, [dateStr, selectedBranch]);

  React.useEffect(() => {
    fetchDailyReport();
  }, [dateStr, selectedBranch, fetchDailyReport]);

  const triggerPrint = () => {
    window.print();
  };

  const exportExcel = () => {
    if (!reportData) return alert("No data available");
    const sheetData = [
      { Metric: "Date", Value: dateStr },
      { Metric: "Gross Sales", Value: reportData.sales.total },
      { Metric: "Sales Discount", Value: reportData.sales.discount },
      { Metric: "Sales Tax/VAT", Value: reportData.sales.tax },
      { Metric: "Daily Restock Purchases", Value: reportData.purchases.total },
      { Metric: "Collections (Sales Payments)", Value: reportData.sales.byPaymentMethod.reduce((acc: number, cur: any) => acc + cur.amount, 0) },
      { Metric: "Expenses Disbursed", Value: reportData.expenses.total },
      { Metric: "Net Daily Profit", Value: reportData.margins.netProfit },
    ];
    const ws = XLSX.utils.json_to_sheet(sheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Daily Report ${dateStr}`);
    XLSX.writeFile(wb, `daily_report_${dateStr}.xlsx`);
  };

  const exportPDF = () => {
    if (!reportData) return alert("No data available");
    const doc = new jsPDF();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(94, 80, 235);
    doc.text(`DynaPOS - Daily Audit Report (${dateStr})`, 14, 20);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 26);
    doc.text(`Branch context: ${selectedBranch ? "Specific branch ID" : "All branch logs"}`, 14, 31);

    let y = 42;
    doc.setFont("helvetica", "bold");
    doc.setFillColor(243, 244, 246);
    doc.rect(14, y, 182, 7, "F");
    doc.setTextColor(50, 50, 50);
    doc.text("Financial Breakdown Metric", 16, y + 5);
    doc.text("Value", 140, y + 5);

    y += 7;
    doc.setFont("helvetica", "normal");
    const metrics = [
      ["Gross Sales Revenue", `${currencySymbol}${reportData.sales.total.toFixed(2)}`],
      ["Sales Count", `${reportData.sales.count} invoices`],
      ["Sales Discounts Billed", `${currencySymbol}${reportData.sales.discount.toFixed(2)}`],
      [`Tax/VAT Collected`, `${currencySymbol}${reportData.sales.tax.toFixed(2)}`],
      ["COGS (Cost of Sales)", `${currencySymbol}${reportData.margins.costOfGoodsSold.toFixed(2)}`],
      ["Restock Purchases total", `${currencySymbol}${reportData.purchases.total.toFixed(2)}`],
      ["Daily Expenses Logged", `${currencySymbol}${reportData.expenses.total.toFixed(2)}`],
      ["Daily Other Incomes", `${currencySymbol}${reportData.income.total.toFixed(2)}`],
      ["Net Daily Profit", `${currencySymbol}${reportData.margins.netProfit.toFixed(2)}`],
    ];

    metrics.forEach(([lbl, val]) => {
      doc.text(lbl, 16, y + 5);
      doc.text(val, 140, y + 5);
      doc.line(14, y + 8, 196, y + 8);
      y += 8;
    });

    doc.save(`daily_report_${dateStr}.pdf`);
  };

  const tabs = [
    { id: "sales", label: "Daily Sales" },
    { id: "purchase", label: "Daily Purchase" },
    { id: "collection", label: "Daily Collection" },
    { id: "payment", label: "Daily Payment" },
    { id: "expense", label: "Daily Expense" },
    { id: "profit", label: "Daily Profit" },
  ];

  const getActiveTabContent = () => {
    if (!reportData) return null;

    switch (activeTab) {
      case "sales":
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 p-4 rounded-2xl">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Gross Sales</span>
                <h4 className="text-lg font-black text-foreground mt-1">{currencySymbol}{reportData.sales.total.toFixed(2)}</h4>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 p-4 rounded-2xl">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Invoices Billed</span>
                <h4 className="text-lg font-black text-foreground mt-1">{reportData.sales.count} bills</h4>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 p-4 rounded-2xl">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Discounts Allowed</span>
                <h4 className="text-lg font-black text-red-500 mt-1">{currencySymbol}{reportData.sales.discount.toFixed(2)}</h4>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 p-4 rounded-2xl">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">VAT Collected</span>
                <h4 className="text-lg font-black text-[#2563EB] mt-1">{currencySymbol}{reportData.sales.tax.toFixed(2)}</h4>
              </div>
            </div>

            {/* Payment Methods Breakdown Chart */}
            <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 rounded-2xl p-5">
              <h3 className="text-xs font-bold mb-3">Daily Sales by Payment Channel</h3>
              <div className="h-48 w-full flex items-center justify-center">
                {reportData.sales.byPaymentMethod.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={reportData.sales.byPaymentMethod}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="method" fontSize={10} />
                      <YAxis fontSize={10} />
                      <Tooltip formatter={(v: any) => [`${currencySymbol}${v.toFixed(2)}`, "Amount"]} />
                      <Bar dataKey="amount" fill="#2563EB" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <span className="text-xs text-muted-foreground">No payment records logged for this day</span>
                )}
              </div>
            </div>
          </div>
        );

      case "purchase":
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 p-4 rounded-2xl">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Purchase Restocks</span>
                <h4 className="text-lg font-black text-foreground mt-1">{currencySymbol}{reportData.purchases.total.toFixed(2)}</h4>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 p-4 rounded-2xl">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Purchase Orders Received</span>
                <h4 className="text-lg font-black text-foreground mt-1">{reportData.purchases.count} orders</h4>
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 p-6 rounded-2xl text-center text-xs text-muted-foreground">
              Review daily purchases against inbound vendor supply deliveries.
            </div>
          </div>
        );

      case "collection":
        const totalCollections = reportData.sales.byPaymentMethod.reduce((acc: number, cur: any) => acc + cur.amount, 0);
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 p-4 rounded-2xl">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Cash Collections</span>
                <h4 className="text-lg font-black text-[#10b981] mt-1">{currencySymbol}{totalCollections.toFixed(2)}</h4>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 p-4 rounded-2xl">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Voucher Count</span>
                <h4 className="text-lg font-black text-foreground mt-1">{reportData.sales.count} payments</h4>
              </div>
            </div>
            <div className="overflow-x-auto border border-slate-200/50 dark:border-slate-800 rounded-2xl bg-slate-50 dark:bg-slate-900">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-950 font-bold text-[9px] uppercase text-slate-500 border-b border-slate-200 dark:border-slate-850">
                    <th className="py-2 px-3">Payment Method</th>
                    <th className="py-2 px-3 text-right">Collected Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {reportData.sales.byPaymentMethod.map((pm: any) => (
                    <tr key={pm.method}>
                      <td className="py-2.5 px-3 font-semibold">{pm.method}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-800 dark:text-slate-200">
                        {currencySymbol}{pm.amount.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );

      case "payment":
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 p-4 rounded-2xl">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Disbursed Cash Payments</span>
                <h4 className="text-lg font-black text-red-500 mt-1">{currencySymbol}{reportData.expenses.total.toFixed(2)}</h4>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 p-4 rounded-2xl">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Disbursements Count</span>
                <h4 className="text-lg font-black text-foreground mt-1">{reportData.expenses.count} vouchers</h4>
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 p-6 rounded-2xl text-center text-xs text-muted-foreground">
              Review debited business voucher values disbursed outward.
            </div>
          </div>
        );

      case "expense":
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 p-4 rounded-2xl">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Daily Store Expenses</span>
                <h4 className="text-lg font-black text-red-500 mt-1">{currencySymbol}{reportData.expenses.total.toFixed(2)}</h4>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 p-4 rounded-2xl">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Daily Voucher Count</span>
                <h4 className="text-lg font-black text-foreground mt-1">{reportData.expenses.count} expenses</h4>
              </div>
            </div>
            
            <div className="overflow-x-auto border border-slate-200/50 dark:border-slate-800 rounded-2xl bg-slate-50 dark:bg-slate-900">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-950 font-bold text-[9px] uppercase text-slate-500 border-b border-slate-200/60 dark:border-slate-800">
                    <th className="py-2.5 px-3">Expense Category</th>
                    <th className="py-2.5 px-3 text-right">Disbursed Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {reportData.expenses.byCategory.map((ec: any) => (
                    <tr key={ec.categoryId}>
                      <td className="py-2.5 px-3 font-semibold">{ec.categoryName}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-red-500">
                        {currencySymbol}{ec.amount.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                  {reportData.expenses.byCategory.length === 0 && (
                    <tr>
                      <td colSpan={2} className="py-4 text-center text-slate-400">No category-wise expenses logged today</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );

      case "profit":
        const profitMargin = reportData.sales.total > 0 ? (reportData.margins.netProfit / reportData.sales.total) * 100 : 0;
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 p-4 rounded-2xl">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Gross Sales Revenue</span>
                <h4 className="text-lg font-black text-foreground mt-1">{currencySymbol}{reportData.sales.total.toFixed(2)}</h4>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 p-4 rounded-2xl">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Cost of Goods Sold (COGS)</span>
                <h4 className="text-lg font-black text-slate-500 mt-1">{currencySymbol}{reportData.margins.costOfGoodsSold.toFixed(2)}</h4>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 p-4 rounded-2xl">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Net Profit Margin</span>
                <h4 className={`text-lg font-black mt-1 ${reportData.margins.netProfit >= 0 ? "text-[#10b981]" : "text-red-500"}`}>
                  {currencySymbol}{reportData.margins.netProfit.toFixed(2)} ({profitMargin.toFixed(1)}%)
                </h4>
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 p-6 rounded-2xl text-center text-xs text-muted-foreground">
              Net Profit is estimated as: Gross Revenue - Cost of Goods Sold (COGS) + Incomes - Expenses.
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header controls */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white dark:bg-[#0a0f24] border border-slate-200/50 dark:border-slate-800 rounded-3xl p-6 shadow-sm print:hidden">
        <div>
          <h1 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-[#2563EB]" /> Daily Reports Portal
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Audit daily financial performance indicators, gross net margins, restock values, and profit parameters.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
          {/* Preset parameters */}
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 px-3 py-2 rounded-xl text-xs w-full sm:w-auto">
            <Calendar className="h-4 w-4 text-[#2563EB]" />
            <input
              type="date"
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
              className="bg-transparent border-none outline-none font-bold text-foreground cursor-pointer text-xs focus:ring-0"
            />
          </div>

          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 px-3 py-2 rounded-xl text-xs w-full sm:w-auto">
            <Store className="h-4 w-4 text-[#2563EB]" />
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
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
              disabled={isLoading || !reportData}
              className="flex items-center justify-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold transition-all w-full sm:w-auto cursor-pointer"
            >
              <Download className="h-4 w-4" />
              <span>Excel</span>
            </button>
            <button
              onClick={exportPDF}
              disabled={isLoading || !reportData}
              className="flex items-center justify-center gap-2 px-3.5 py-2 bg-[#2563EB] text-white hover:bg-[#1D4ED8] rounded-xl text-xs font-bold transition-all w-full sm:w-auto cursor-pointer"
            >
              <Printer className="h-4 w-4" />
              <span>PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* Print details header */}
      <div className="hidden print:block border-b-2 border-[#2563EB] pb-3 mb-5">
        <h1 className="text-2xl font-black text-[#2563EB]">DynaPOS Daily Audit</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Date preset: {dateStr} | Generated: {mounted ? new Date().toLocaleString() : ""}</p>
      </div>

      {/* 2. Tabs Selector */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2.5 overflow-x-auto scrollbar-none shrink-0 print:hidden">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
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

      {/* 3. Main Data Container */}
      <div className="bg-white dark:bg-[#0a0f24] border border-slate-200/50 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
        {isLoading ? (
          <div className="h-64 flex flex-col items-center justify-center space-y-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#2563EB] border-t-transparent" />
            <p className="text-xs text-muted-foreground">Compiling ledger balances...</p>
          </div>
        ) : reportData ? (
          getActiveTabContent()
        ) : (
          <div className="py-12 text-center text-xs text-slate-400">
            Please configure report parameters to generate daily audit outputs.
          </div>
        )}
      </div>
    </div>
  );
}
