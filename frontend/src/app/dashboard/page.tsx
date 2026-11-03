"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { useSettings } from "@/components/settings-provider";
import SuperAdminDashboard from "@/components/super-admin-dashboard";
import {
  ArrowRight,
  BedDouble,
  Coins,
  CreditCard,
  Package,
  Receipt,
  RefreshCw,
  ShoppingCart,
  Terminal,
  TrendingUp,
  UtensilsCrossed,
} from "lucide-react";
import Link from "next/link";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface DashboardMetrics {
  totalSales: number;
  totalPurchases: number;
  totalExpenses: number;
  totalIncome: number;
  grossProfit: number;
  netProfit: number;
  costOfGoodsSold: number;
  ordersCount?: number;
  customersCount?: number;
}

interface AlertMeta {
  id: string;
  name: string;
  sku: string;
  currentQuantity: number;
  alertQuantity: number;
  unit: string;
}

interface TransactionMeta {
  id: string;
  invoiceNumber: string;
  customerName: string;
  total: number;
  status: string;
  paymentStatus: string;
  createdAt: string;
}

interface TopProductMeta {
  id: string;
  name: string;
  sku: string;
  quantitySold: number;
  revenue: number;
}

interface HospitalityStats {
  rooms: {
    total: number;
    occupied: number;
    vacant: number;
    maintenance: number;
  };
  tables: {
    total: number;
    occupied: number;
    available: number;
  };
  activeStays: number;
}

const CARD = "bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg shadow-none";

export default function DashboardPage() {
  const { data: session } = useSession();
  const { currencySymbol } = useSettings();
  const userRole = (session?.user as any)?.role;

  const [metrics, setMetrics] = React.useState<DashboardMetrics | null>(null);
  const [alerts, setAlerts] = React.useState<AlertMeta[]>([]);
  const [transactions, setTransactions] = React.useState<TransactionMeta[]>([]);
  const [topProducts, setTopProducts] = React.useState<TopProductMeta[]>([]);
  const [chartData, setChartData] = React.useState<any[]>([]);
  const [outOfStock, setOutOfStock] = React.useState<any[]>([]);
  const [hospitalityStats, setHospitalityStats] = React.useState<HospitalityStats | null>(null);

  const [isLoading, setIsLoading] = React.useState(true);
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const [range, setRange] = React.useState("today");

  const loadDashboard = React.useCallback(async () => {
    try {
      const dashRes = await fetch(`/api/v1/reports/dashboard?range=${range}`);
      if (dashRes.ok) {
        const data = await dashRes.json();
        setMetrics(data.metrics || null);
        setAlerts(Array.isArray(data.lowStockAlerts) ? data.lowStockAlerts : []);
        setTransactions(Array.isArray(data.recentTransactions) ? data.recentTransactions : []);
        setTopProducts(Array.isArray(data.topSellingProducts) ? data.topSellingProducts : []);
        setChartData(Array.isArray(data.salesChart) ? data.salesChart : []);
        setOutOfStock(Array.isArray(data.outOfStockProducts) ? data.outOfStockProducts : []);
        if (data.hospitalityStats) setHospitalityStats(data.hospitalityStats);
      }
    } catch (err) {
      console.error("Failed to load dashboard metrics:", err);
    }
  }, [range]);

  const handleSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      await loadDashboard();
    } finally {
      setIsSyncing(false);
    }
  };

  React.useEffect(() => {
    setMounted(true);
    if (userRole === "SUPER_ADMIN") {
      setIsLoading(false);
      return;
    }

    let active = true;
    const init = async () => {
      setIsLoading(true);
      await loadDashboard();
      if (active) setIsLoading(false);
    };

    init();
    return () => {
      active = false;
    };
  }, [loadDashboard, userRole]);

  if (!mounted || isLoading) {
    return (
      <div className="mx-auto max-w-[1600px] animate-pulse space-y-4 pb-8" aria-label="Loading dashboard">
        <div className="flex items-center justify-between border-b border-[#D8CEC1] pb-4">
          <div className="h-7 w-48 rounded-md bg-[#EEE7DD]" />
          <div className="h-9 w-44 rounded-md bg-[#EEE7DD]" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] p-4 space-y-3">
              <div className="h-4 w-1/2 rounded bg-[#EEE7DD]" />
              <div className="h-7 w-3/4 rounded bg-[#EEE7DD]" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7]" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.55fr_1fr]">
          <div className="h-80 rounded-lg bg-[#EEE7DD]" />
          <div className="h-80 rounded-lg bg-[#EEE7DD]" />
        </div>
      </div>
    );
  }

  if (userRole === "SUPER_ADMIN") return <SuperAdminDashboard />;

  const totalSalesVal = Number(metrics?.totalSales ?? 0);
  const cogsVal = Number(metrics?.costOfGoodsSold ?? 0);
  const expensesVal = Number(metrics?.totalExpenses ?? 0);
  const netProfitVal = Number(metrics?.netProfit ?? 0);
  const ordersCountVal = Number(metrics?.ordersCount ?? 0);
  const netMargin = totalSalesVal > 0 ? ((netProfitVal / totalSalesVal) * 100).toFixed(1) : "0.0";
  const cogsPct = totalSalesVal > 0 ? ((cogsVal / totalSalesVal) * 100).toFixed(1) : "0.0";
  const hasActualSales = chartData.some((point) => Number(point?.sales ?? 0) > 0);
  const stockItems = [...outOfStock, ...alerts].slice(0, 4);
  const outOfStockIds = new Set(outOfStock.map((item) => item.id));

  // Occupancy metrics
  const roomsTotal = hospitalityStats?.rooms?.total ?? 0;
  const roomsOccupied = hospitalityStats?.rooms?.occupied ?? 0;
  const roomPct = roomsTotal > 0 ? Math.min(100, Math.round((roomsOccupied / roomsTotal) * 100)) : 0;

  const tablesTotal = hospitalityStats?.tables?.total ?? 0;
  const tablesOccupied = hospitalityStats?.tables?.occupied ?? 0;
  const tablePct = tablesTotal > 0 ? Math.min(100, Math.round((tablesOccupied / tablesTotal) * 100)) : 0;

  const formatAmount = (value: number | string | null | undefined) =>
    `${currencySymbol}${Number(value ?? 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  return (
    <main className="mx-auto w-full min-w-0 max-w-[1600px] space-y-4 pb-8 text-[#292320]">
      {/* Header Bar */}
      <header className="flex flex-col gap-3 border-b border-[#D8CEC1] pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#292320]">
            Welcome, {session?.user?.name || "Owner"}
          </h1>
        </div>

        <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto">
          {/* Apple Segmented Period Control */}
          <div
            className="inline-flex p-1 bg-[#EEE7DD] rounded-lg border border-[#D8CEC1] text-xs font-semibold"
            role="tablist"
            aria-label="Period"
          >
            {[
              { id: "today", label: "Today" },
              { id: "week", label: "This week" },
              { id: "month", label: "This month" },
              { id: "fiscalYear", label: "Fiscal year" },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={range === item.id}
                onClick={() => setRange(item.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-all ${
                  range === item.id
                    ? "bg-[#FFFCF7] text-[#292320] border border-[#D8CEC1]"
                    : "text-[#71675E] hover:text-[#292320]"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleSync}
            disabled={isSyncing}
            className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-md bg-[#6B2837] px-3.5 text-xs font-semibold text-[#FFFCF7] hover:bg-[#541E2A] cursor-pointer disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin" : ""}`} />
            {isSyncing ? "Syncing" : "Sync"}
          </button>
        </div>
      </header>

      {/* 5 Key Metric Cards (Full Height, Colorful Apple Badges) */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5" aria-label="Key metrics">
        {/* Gross Sales */}
        <Link
          href="/dashboard/sales"
          className={`${CARD} p-4 transition-all hover:border-[#16A34A] hover:bg-[#FCFDFB] group cursor-pointer flex flex-col justify-between min-h-[118px]`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="h-9 w-9 rounded-md bg-[#EAF5EE] border border-[#D1EAD8] text-[#16A34A] flex items-center justify-center shrink-0">
              <TrendingUp className="h-4 w-4" />
            </div>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#EAF5EE] text-[#16A34A] border border-[#D1EAD8] tabular-nums">
              {ordersCountVal} bills
            </span>
          </div>
          <div className="mt-2.5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[#71675E]">Gross Sales</div>
            <div className="mt-0.5 text-xl font-bold leading-tight tabular-nums text-[#292320] truncate">
              {formatAmount(totalSalesVal)}
            </div>
          </div>
        </Link>

        {/* Net Profit */}
        <Link
          href="/dashboard/reports"
          className={`${CARD} p-4 transition-all hover:border-[#6B2837] hover:bg-[#FDFBFC] group cursor-pointer flex flex-col justify-between min-h-[118px]`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="h-9 w-9 rounded-md bg-[#FDF2F4] border border-[#F8D2D9] text-[#6B2837] flex items-center justify-center shrink-0">
              <Coins className="h-4 w-4" />
            </div>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border tabular-nums ${
                netProfitVal < 0
                  ? "bg-[#FDF2F2] text-[#DC2626] border-[#FBD5D5]"
                  : "bg-[#FDF2F4] text-[#6B2837] border-[#F8D2D9]"
              }`}
            >
              {netMargin}% net
            </span>
          </div>
          <div className="mt-2.5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[#71675E]">Net Profit</div>
            <div
              className={`mt-0.5 text-xl font-bold leading-tight tabular-nums truncate ${
                netProfitVal < 0 ? "text-[#DC2626]" : "text-[#292320]"
              }`}
            >
              {formatAmount(netProfitVal)}
            </div>
          </div>
        </Link>

        {/* Live Hospitality Occupancy */}
        <Link
          href="/dashboard/hotel/rooms"
          className={`${CARD} p-4 transition-all hover:border-[#2563EB] hover:bg-[#FAFCFE] group cursor-pointer flex flex-col justify-between min-h-[118px]`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="h-9 w-9 rounded-md bg-[#EFF6FF] border border-[#DBEAFE] text-[#2563EB] flex items-center justify-center shrink-0">
              <BedDouble className="h-4 w-4" />
            </div>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#EFF6FF] text-[#2563EB] border border-[#DBEAFE] tabular-nums">
              {roomPct}% rooms
            </span>
          </div>
          <div className="mt-2.5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[#71675E]">Live Occupancy</div>
            <div className="mt-0.5 text-xl font-bold leading-tight tabular-nums text-[#292320] truncate">
              {roomsOccupied} / {roomsTotal} <span className="text-xs font-normal text-[#71675E]">rooms</span>
            </div>
          </div>
        </Link>

        {/* Cost of Goods Sold */}
        <Link
          href="/dashboard/inventory"
          className={`${CARD} p-4 transition-all hover:border-[#D97706] hover:bg-[#FDFCF9] group cursor-pointer flex flex-col justify-between min-h-[118px]`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="h-9 w-9 rounded-md bg-[#FEF8EE] border border-[#FDE8CC] text-[#D97706] flex items-center justify-center shrink-0">
              <Package className="h-4 w-4" />
            </div>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#FEF8EE] text-[#D97706] border border-[#FDE8CC] tabular-nums">
              {cogsPct}% COGS
            </span>
          </div>
          <div className="mt-2.5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[#71675E]">Stock Cost (COGS)</div>
            <div className="mt-0.5 text-xl font-bold leading-tight tabular-nums text-[#292320] truncate">
              {formatAmount(cogsVal)}
            </div>
          </div>
        </Link>

        {/* Operating Expenses */}
        <Link
          href="/dashboard/expenses"
          className={`${CARD} p-4 transition-all hover:border-[#DC2626] hover:bg-[#FCF9F9] group cursor-pointer flex flex-col justify-between min-h-[118px]`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="h-9 w-9 rounded-md bg-[#FDF2F2] border border-[#FBD5D5] text-[#DC2626] flex items-center justify-center shrink-0">
              <CreditCard className="h-4 w-4" />
            </div>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#FDF2F2] text-[#DC2626] border border-[#FBD5D5] tabular-nums">
              OpEx
            </span>
          </div>
          <div className="mt-2.5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[#71675E]">Total Expenses</div>
            <div className="mt-0.5 text-xl font-bold leading-tight tabular-nums text-[#292320] truncate">
              {formatAmount(expensesVal)}
            </div>
          </div>
        </Link>
      </section>

      {/* Quick Action Tiles Dock */}
      <section aria-label="Quick access">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {/* Restaurant POS */}
          <Link
            href="/dashboard/restaurant/pos"
            className={`${CARD} p-3 flex items-center gap-3 transition-all hover:border-[#D97706] hover:bg-[#FEF8EE]/30 group cursor-pointer min-h-[58px]`}
          >
            <div className="h-9 w-9 rounded-md bg-[#FEF8EE] border border-[#FDE8CC] text-[#D97706] flex items-center justify-center shrink-0">
              <UtensilsCrossed className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-[#292320] truncate">Restaurant POS</div>
              <div className="text-[10px] text-[#71675E] truncate">Tables & billing</div>
            </div>
          </Link>

          {/* Rooms Tape Chart */}
          <Link
            href="/dashboard/hotel/rooms"
            className={`${CARD} p-3 flex items-center gap-3 transition-all hover:border-[#2563EB] hover:bg-[#EFF6FF]/30 group cursor-pointer min-h-[58px]`}
          >
            <div className="h-9 w-9 rounded-md bg-[#EFF6FF] border border-[#DBEAFE] text-[#2563EB] flex items-center justify-center shrink-0">
              <BedDouble className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-[#292320] truncate">Tape Chart</div>
              <div className="text-[10px] text-[#71675E] truncate">Room rack & stays</div>
            </div>
          </Link>

          {/* Guest Folios */}
          <Link
            href="/dashboard/hotel/folios"
            className={`${CARD} p-3 flex items-center gap-3 transition-all hover:border-[#16A34A] hover:bg-[#EAF5EE]/30 group cursor-pointer min-h-[58px]`}
          >
            <div className="h-9 w-9 rounded-md bg-[#EAF5EE] border border-[#D1EAD8] text-[#16A34A] flex items-center justify-center shrink-0">
              <Receipt className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-[#292320] truncate">Guest Folios</div>
              <div className="text-[10px] text-[#71675E] truncate">Billing & checkout</div>
            </div>
          </Link>

          {/* Kitchen Display */}
          <Link
            href="/dashboard/restaurant/kds"
            className={`${CARD} p-3 flex items-center gap-3 transition-all hover:border-[#6B2837] hover:bg-[#FDF2F4]/30 group cursor-pointer min-h-[58px]`}
          >
            <div className="h-9 w-9 rounded-md bg-[#FDF2F4] border border-[#F8D2D9] text-[#6B2837] flex items-center justify-center shrink-0">
              <Terminal className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-[#292320] truncate">Kitchen (KDS)</div>
              <div className="text-[10px] text-[#71675E] truncate">Live order stations</div>
            </div>
          </Link>

          {/* Purchases & Supply */}
          <Link
            href="/dashboard/purchases"
            className={`${CARD} p-3 flex items-center gap-3 transition-all hover:border-[#7C3AED] hover:bg-[#F5F3FF]/30 group cursor-pointer min-h-[58px]`}
          >
            <div className="h-9 w-9 rounded-md bg-[#F5F3FF] border border-[#DDD6FE] text-[#7C3AED] flex items-center justify-center shrink-0">
              <ShoppingCart className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-[#292320] truncate">Purchases</div>
              <div className="text-[10px] text-[#71675E] truncate">Stock intake & POs</div>
            </div>
          </Link>

          {/* Expenses */}
          <Link
            href="/dashboard/expenses"
            className={`${CARD} p-3 flex items-center gap-3 transition-all hover:border-[#DC2626] hover:bg-[#FDF2F2]/30 group cursor-pointer min-h-[58px]`}
          >
            <div className="h-9 w-9 rounded-md bg-[#FDF2F2] border border-[#FBD5D5] text-[#DC2626] flex items-center justify-center shrink-0">
              <CreditCard className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-[#292320] truncate">Expenses</div>
              <div className="text-[10px] text-[#71675E] truncate">Vouchers & ledger</div>
            </div>
          </Link>
        </div>
      </section>

      {/* Main Grid: Chart & Transactions Left, Capacity & Inventory Right */}
      <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(330px,1fr)]">
        <div className="min-w-0 space-y-4">
          {/* Revenue Chart */}
          <section className={`${CARD} p-4 sm:p-5`} aria-label="Sales chart">
            <div className="mb-4 flex items-center justify-between gap-3 border-b border-[#EEE7DD] pb-3">
              <div>
                <h2 className="text-base font-bold text-[#292320]">Sales Performance</h2>
              </div>
              <div className="text-right">
                <div className="text-base font-bold tabular-nums text-[#292320]">{formatAmount(totalSalesVal)}</div>
              </div>
            </div>

            {hasActualSales ? (
              <div className="h-[240px] w-full min-w-0">
                <ResponsiveContainer width="100%" height={240} minWidth={0} minHeight={240}>
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#16A34A" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#16A34A" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#EEE7DD" strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: "#71675E" }}
                      tickMargin={10}
                    />
                    <YAxis
                      width={56}
                      domain={[0, "auto"]}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: "#71675E" }}
                      tickFormatter={(value) => `${currencySymbol}${value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value}`}
                    />
                    <Tooltip
                      formatter={(value: any) => [formatAmount(value), "Sales"]}
                      contentStyle={{
                        backgroundColor: "#FFFCF7",
                        borderColor: "#D8CEC1",
                        borderRadius: "8px",
                        fontSize: "12px",
                        boxShadow: "none",
                        padding: "8px 12px",
                      }}
                      labelStyle={{ color: "#71675E", fontWeight: 600, marginBottom: 4 }}
                      itemStyle={{ color: "#16A34A", fontWeight: 700 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="sales"
                      name="Sales"
                      stroke="#16A34A"
                      strokeWidth={2.5}
                      fill="url(#salesGrad)"
                      activeDot={{ r: 4, strokeWidth: 0, fill: "#16A34A" }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex min-h-[200px] flex-col items-center justify-center rounded-lg border border-dashed border-[#D8CEC1] bg-[#FAF7F1] px-5 py-7 text-center">
                <p className="text-sm font-semibold text-[#292320]">No sales recorded for this period</p>
                <Link
                  href="/dashboard/restaurant/pos"
                  className="mt-3 inline-flex h-8 items-center rounded-md bg-[#6B2837] px-3.5 text-xs font-semibold text-[#FFFCF7] hover:bg-[#541E2A] cursor-pointer"
                >
                  Open Restaurant POS
                </Link>
              </div>
            )}
          </section>

          {/* Recent Transactions Table */}
          <section className={`${CARD} overflow-hidden`} aria-label="Recent transactions">
            <div className="flex items-center justify-between gap-3 border-b border-[#EEE7DD] px-4 py-3.5 sm:px-5">
              <h2 className="text-sm font-bold text-[#292320]">Recent Transactions</h2>
              <Link
                href="/dashboard/sales"
                className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-[#6B2837] hover:underline cursor-pointer"
              >
                View ledger <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {transactions.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-[#71675E]">No transactions recorded for this period.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] border-collapse text-left text-xs">
                  <thead>
                    <tr className="bg-[#F7F3EC] text-[11px] font-semibold uppercase tracking-wider text-[#71675E] border-b border-[#EEE7DD]">
                      <th className="px-4 py-3">Invoice</th>
                      <th className="px-4 py-3">Customer / Guest</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                      <th className="px-4 py-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EEE7DD]">
                    {transactions.slice(0, 6).map((transaction) => {
                      const name = transaction.customerName || "Walk-in Guest";
                      const isPaid = transaction.paymentStatus === "PAID";
                      const isPartial = transaction.paymentStatus === "PARTIAL";

                      return (
                        <tr key={transaction.id} className="transition-colors hover:bg-[#FAF7F1]">
                          <td className="px-4 py-3 whitespace-nowrap font-mono text-[11px] font-semibold text-[#6B2837]">
                            {transaction.invoiceNumber}
                          </td>
                          <td className="px-4 py-3 max-w-[220px] truncate font-semibold text-[#292320]">
                            {name}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-right font-bold tabular-nums text-[#292320]">
                            {formatAmount(transaction.total)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border tabular-nums ${
                                isPaid
                                  ? "bg-[#EAF5EE] text-[#16A34A] border-[#D1EAD8]"
                                  : isPartial
                                  ? "bg-[#EFF6FF] text-[#2563EB] border-[#DBEAFE]"
                                  : "bg-[#FEF8EE] text-[#D97706] border-[#FDE8CC]"
                              }`}
                            >
                              {transaction.paymentStatus || "UNPAID"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        {/* Aside: Occupancy Progress & Inventory Health */}
        <aside className="min-w-0 space-y-4">
          {/* Hospitality Occupancy Card with Apple Health Style Progress */}
          <section className={`${CARD} p-4 sm:p-5`} aria-label="Occupancy and live floor capacity">
            <div className="flex items-center justify-between gap-3 border-b border-[#EEE7DD] pb-3">
              <h2 className="text-sm font-bold text-[#292320]">Live Capacity</h2>
              <div className="flex items-center gap-2 text-xs font-semibold">
                <Link href="/dashboard/hotel/rooms" className="text-[#6B2837] hover:underline cursor-pointer">
                  Rooms
                </Link>
                <span className="text-[#D8CEC1]">·</span>
                <Link href="/dashboard/restaurant/tables" className="text-[#6B2837] hover:underline cursor-pointer">
                  Tables
                </Link>
              </div>
            </div>

            <div className="pt-3.5 space-y-4">
              {/* Rooms Occupancy Meter */}
              <div>
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="flex items-center gap-1.5 text-[#292320]">
                    <BedDouble className="h-3.5 w-3.5 text-[#2563EB]" /> Hotel Rooms
                  </span>
                  <span className="tabular-nums font-bold text-[#2563EB]">
                    {roomsOccupied} / {roomsTotal} ({roomPct}%)
                  </span>
                </div>
                {/* Visual Progress Track */}
                <div className="mt-2 h-2.5 w-full rounded-full bg-[#EEE7DD] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#2563EB] transition-all duration-500"
                    style={{ width: `${roomPct}%` }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-[#71675E]">
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-[#16A34A]" />
                    Vacant: <strong className="text-[#292320] tabular-nums">{hospitalityStats?.rooms?.vacant ?? 0}</strong>
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-[#D97706]" />
                    Housekeeping: <strong className="text-[#292320] tabular-nums">{hospitalityStats?.rooms?.maintenance ?? 0}</strong>
                  </span>
                </div>
              </div>

              {/* Dining Tables Occupancy Meter */}
              <div className="border-t border-[#EEE7DD] pt-3.5">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="flex items-center gap-1.5 text-[#292320]">
                    <UtensilsCrossed className="h-3.5 w-3.5 text-[#16A34A]" /> Dining Tables
                  </span>
                  <span className="tabular-nums font-bold text-[#16A34A]">
                    {tablesOccupied} / {tablesTotal} ({tablePct}%)
                  </span>
                </div>
                {/* Visual Progress Track */}
                <div className="mt-2 h-2.5 w-full rounded-full bg-[#EEE7DD] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#16A34A] transition-all duration-500"
                    style={{ width: `${tablePct}%` }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-[#71675E]">
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-[#16A34A]" />
                    Available: <strong className="text-[#292320] tabular-nums">{hospitalityStats?.tables?.available ?? 0}</strong>
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-[#2563EB]" />
                    Active Stays: <strong className="text-[#292320] tabular-nums">{hospitalityStats?.activeStays ?? 0}</strong>
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Action Navigation Buttons */}
            <div className="mt-4 grid grid-cols-3 gap-2 border-t border-[#EEE7DD] pt-3">
              <Link
                href="/dashboard/restaurant/tables"
                className="h-8 rounded-md bg-[#F7F3EC] border border-[#D8CEC1] text-xs font-semibold text-[#292320] hover:bg-[#EEE7DD] flex items-center justify-center transition-colors cursor-pointer"
              >
                Floor Plan
              </Link>
              <Link
                href="/dashboard/hotel/rooms"
                className="h-8 rounded-md bg-[#F7F3EC] border border-[#D8CEC1] text-xs font-semibold text-[#292320] hover:bg-[#EEE7DD] flex items-center justify-center transition-colors cursor-pointer"
              >
                Tape Chart
              </Link>
              <Link
                href="/dashboard/hotel/housekeeping"
                className="h-8 rounded-md bg-[#F7F3EC] border border-[#D8CEC1] text-xs font-semibold text-[#292320] hover:bg-[#EEE7DD] flex items-center justify-center transition-colors cursor-pointer"
              >
                Housekeeping
              </Link>
            </div>
          </section>

          {/* Inventory Health & Top Selling Products */}
          <section className={`${CARD} overflow-hidden`} aria-label="Inventory health and top products">
            <div className="flex items-center justify-between gap-3 border-b border-[#EEE7DD] px-4 py-3.5 sm:px-5">
              <div>
                <h2 className="text-sm font-bold text-[#292320]">Inventory Health</h2>
                <div className="mt-1 flex items-center gap-2">
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#FDF2F2] text-[#DC2626] border border-[#FBD5D5]">
                    {outOfStock.length} out of stock
                  </span>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#FEF8EE] text-[#D97706] border border-[#FDE8CC]">
                    {alerts.length} low stock
                  </span>
                </div>
              </div>
              <Link href="/dashboard/purchases" className="shrink-0 text-xs font-semibold text-[#6B2837] hover:underline cursor-pointer">
                Restock
              </Link>
            </div>

            {stockItems.length === 0 ? (
              <div className="px-4 py-5 text-xs text-[#71675E] text-center">
                All inventory quantities are currently within healthy limits.
              </div>
            ) : (
              <div className="divide-y divide-[#EEE7DD]">
                {stockItems.map((item) => {
                  const quantity = Number(item.currentQuantity ?? 0);
                  const isOutOfStock = outOfStockIds.has(item.id) || quantity <= 0;
                  return (
                    <div key={item.id} className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-5">
                      <div className="min-w-0">
                        <div className="truncate text-xs font-semibold text-[#292320]">{item.name}</div>
                        {item.sku && (
                          <div className="font-mono text-[10px] text-[#71675E]">{item.sku}</div>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border tabular-nums ${
                            isOutOfStock
                              ? "bg-[#FDF2F2] text-[#DC2626] border-[#FBD5D5]"
                              : "bg-[#FEF8EE] text-[#D97706] border-[#FDE8CC]"
                          }`}
                        >
                          {quantity} {item.unit || "pcs"} {isOutOfStock ? "(0 left)" : `(min ${Number(item.alertQuantity ?? 0)})`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Top Products Subsection */}
            <div className="border-y border-[#EEE7DD] bg-[#F7F3EC] px-4 py-2.5 sm:px-5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-bold uppercase tracking-wider text-[#71675E]">Top-Selling Dishes</span>
                <Link href="/dashboard/products" className="text-xs font-semibold text-[#6B2837] hover:underline cursor-pointer">
                  Catalog
                </Link>
              </div>
            </div>

            {topProducts.length === 0 ? (
              <div className="px-4 py-4 text-xs text-[#71675E] text-center">No product sales recorded for this period.</div>
            ) : (
              <div className="divide-y divide-[#EEE7DD]">
                {topProducts.slice(0, 4).map((product, idx) => (
                  <div key={product.id} className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`h-5 w-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 border ${
                          idx === 0
                            ? "bg-[#FEF8EE] text-[#D97706] border-[#FDE8CC]"
                            : "bg-[#EEE7DD] text-[#71675E] border-[#D8CEC1]"
                        }`}
                      >
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate text-xs font-semibold text-[#292320]">{product.name}</div>
                        <div className="mt-0.5 text-[10px] text-[#71675E] tabular-nums">
                          {Number(product.quantitySold ?? 0).toLocaleString("en-IN")} sold
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0 text-xs font-bold tabular-nums text-[#292320]">
                      {formatAmount(product.revenue)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </aside>
      </div>
    </main>
  );
}
  