"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { useSettings } from "@/components/settings-provider";
import SuperAdminDashboard from "@/components/super-admin-dashboard";
import {
  TrendingUp,
  DollarSign,
  Boxes,
  Coins,
  AlertTriangle,
  ArrowRight,
  TrendingDown,
  ShoppingBag,
  Store,
  ChevronDown,
  RefreshCw,
  Calendar,
  Users,
  Settings,
} from "lucide-react";
import Link from "next/link";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
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
  alertsCount?: number;
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

export default function DashboardPage() {
  const { data: session, status: sessionStatus, update } = useSession();
  const { currencySymbol } = useSettings();

  const userRole = (session?.user as any)?.role;
  
  const [metrics, setMetrics] = React.useState<DashboardMetrics | null>(null);
  const [alerts, setAlerts] = React.useState<AlertMeta[]>([]);
  const [transactions, setTransactions] = React.useState<TransactionMeta[]>([]);
  const [topProducts, setTopProducts] = React.useState<TopProductMeta[]>([]);
  const [chartData, setChartData] = React.useState<any[]>([]);
  const [branches, setBranches] = React.useState<any[]>([]);
  const [activeBranchName, setActiveBranchName] = React.useState("Downtown Supermart");
  
  const [isLoading, setIsLoading] = React.useState(true);
  const [mounted, setMounted] = React.useState(false);

  const [syncSeconds, setSyncSeconds] = React.useState(0);
  const [isSyncing, setIsSyncing] = React.useState(false);

  // Sync Timer to count up seconds since last sync
  React.useEffect(() => {
    const interval = setInterval(() => {
      setSyncSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const getSyncedTimeText = () => {
    if (syncSeconds < 10) return "Synced just now";
    if (syncSeconds < 60) return `Synced ${syncSeconds}s ago`;
    const mins = Math.floor(syncSeconds / 60);
    return `Synced ${mins}m ago`;
  };

  const handleSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const [dashRes, branchRes] = await Promise.all([
        fetch("/api/v1/reports/dashboard"),
        fetch("/api/v1/branches?limit=50"),
      ]);
      if (dashRes.ok) {
        const data = await dashRes.json();
        setMetrics(data.metrics);
        setAlerts(data.lowStockAlerts || []);
        setTransactions(data.recentTransactions || []);
        setTopProducts(data.topSellingProducts || []);
        setChartData(data.salesChart || []);
      }
      if (branchRes.ok) {
        const data = await branchRes.json();
        setBranches(data.branches || []);
      }
      setSyncSeconds(0);
    } catch (err) {
      console.error("Sync failed:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  React.useEffect(() => {
    if (branches.length > 0 && session?.user) {
      const uBranchId = (session.user as any).branchId;
      const matched = branches.find((b) => b.id === uBranchId);
      if (matched) {
        setActiveBranchName(matched.name);
      } else if (branches.length > 0) {
        setActiveBranchName(branches[0].name);
      }
    }
  }, [branches, session]);

  React.useEffect(() => {
    setMounted(true);
    
    if (userRole === "SUPER_ADMIN") {
      setIsLoading(false);
      return;
    }
    
    async function loadDashboard() {
      try {
        const [dashRes, branchRes] = await Promise.all([
          fetch("/api/v1/reports/dashboard"),
          fetch("/api/v1/branches?limit=50"),
        ]);
        if (dashRes.ok) {
          const data = await dashRes.json();
          setMetrics(data.metrics);
          setAlerts(data.lowStockAlerts || []);
          setTransactions(data.recentTransactions || []);
          setTopProducts(data.topSellingProducts || []);
          setChartData(data.salesChart || []);
        }
        if (branchRes.ok) {
          const data = await branchRes.json();
          setBranches(data.branches || []);
        }
      } catch (err) {
        console.error("Failed to load dashboard metrics:", err);
      } finally {
        setIsLoading(false);
      }
    }
    
    if (sessionStatus !== "loading") {
      loadDashboard();
    }
  }, [sessionStatus, userRole]);

  if (sessionStatus === "loading" || isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        {/* Welcome banner skeleton */}
        <div className="h-24 bg-card border border-border p-6 rounded-3xl flex flex-col justify-center space-y-2">
          <div className="h-5 bg-secondary dark:bg-slate-800 rounded w-1/4" />
          <div className="h-3.5 bg-secondary/70 dark:bg-slate-800/70 rounded w-1/2" />
        </div>

        {/* Metrics Grid skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-card border border-border p-6 rounded-3xl flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-secondary dark:bg-slate-800 shrink-0" />
              <div className="space-y-2 flex-1">
                <div className="h-2.5 bg-secondary/60 dark:bg-slate-800/60 rounded w-16" />
                <div className="h-5 bg-secondary dark:bg-slate-800 rounded w-24" />
                <div className="h-2 bg-secondary/40 dark:bg-slate-800/40 rounded w-20" />
              </div>
            </div>
          ))}
        </div>

        {/* Chart Panel & Sidebar skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-card border border-border p-6 rounded-3xl h-[350px] flex flex-col justify-between">
            <div className="space-y-2">
              <div className="h-4.5 bg-secondary dark:bg-slate-800 rounded w-1/3" />
              <div className="h-3 bg-secondary/65 dark:bg-slate-800/65 rounded w-1/2" />
            </div>
            <div className="h-[240px] bg-secondary/30 dark:bg-slate-800/20 rounded-xl" />
          </div>

          <div className="bg-card border border-border p-6 rounded-3xl h-[350px] flex flex-col justify-between">
            <div className="space-y-2">
              <div className="h-4.5 bg-secondary dark:bg-slate-800 rounded w-1/2" />
              <div className="h-3 bg-secondary/65 dark:bg-slate-800/65 rounded w-2/3" />
            </div>
            <div className="space-y-3 mt-4 flex-1">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex justify-between items-center py-1">
                  <div className="space-y-1.5 flex-1 pr-4">
                    <div className="h-3.5 bg-secondary dark:bg-slate-800 rounded w-2/3" />
                    <div className="h-2.5 bg-secondary/50 dark:bg-slate-800/50 rounded w-1/2" />
                  </div>
                  <div className="h-5 bg-secondary dark:bg-slate-800 rounded w-12" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom tables/recent logs skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 2 }).map((_, colIdx) => (
            <div key={colIdx} className="bg-card border border-border p-6 rounded-3xl space-y-4">
              <div className="space-y-1.5">
                <div className="h-4 bg-secondary dark:bg-slate-800 rounded w-1/3" />
                <div className="h-3 bg-secondary/60 dark:bg-slate-800/60 rounded w-1/2" />
              </div>
              <div className="space-y-3.5 pt-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex justify-between items-center py-2 border-b border-border/40 last:border-0">
                    <div className="space-y-1.5 flex-1">
                      <div className="h-3.5 bg-secondary dark:bg-slate-800 rounded w-1/2" />
                      <div className="h-2.5 bg-secondary/50 dark:bg-slate-800/50 rounded w-1/3" />
                    </div>
                    <div className="h-4 bg-secondary dark:bg-slate-800 rounded w-14" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (userRole === "SUPER_ADMIN") {
    return <SuperAdminDashboard />;
  }

  const netProfitPositive = metrics ? metrics.netProfit >= 0 : true;
  const marginPercent = metrics && metrics.totalSales > 0 
    ? ((metrics.netProfit / metrics.totalSales) * 100).toFixed(1) 
    : "0.0";
  const currentDateString = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <div className="relative bg-white dark:bg-card border border-border text-foreground rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-sm overflow-hidden">
        {/* Subtle glow for aesthetic depth */}
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-[100px] pointer-events-none" />
        
        <div className="flex-1 space-y-4 w-full">
          {/* Status badge */}
          <div className="flex items-center gap-1.5 text-[9px] font-bold text-muted-foreground tracking-widest uppercase">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            All Systems Operational &bull; {getSyncedTimeText().toUpperCase()}
          </div>
          
          {/* Greetings */}
          <div>
            <h1 className="text-3xl font-black text-foreground tracking-tight">
              Welcome back, {session?.user?.name?.split(" ")[0] || "User"}.
            </h1>
            <p className="text-xs text-muted-foreground mt-1 font-medium leading-relaxed">
              Here's how {activeBranchName} is performing today &mdash; {currentDateString}.
            </p>
          </div>
        </div>

        {/* Right side: Real-time sync button */}
        <button
          onClick={handleSync}
          disabled={isSyncing}
          className="flex items-center gap-2 px-5 py-2.5 bg-slate-950 text-white hover:bg-slate-900 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100 border border-border rounded-xl text-xs font-black shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all uppercase tracking-wider shrink-0 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          <RefreshCw className={`h-4.5 w-4.5 ${isSyncing ? "animate-spin" : ""}`} />
          <span>{isSyncing ? "Syncing..." : "Sync Real-Time Data"}</span>
        </button>
      </div>

      {/* 1. Metrics Grid */}
      {metrics && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Card 1: Total Sales */}
          <div className="bg-card border border-border p-6 rounded-3xl flex flex-col justify-between hover:shadow-lg hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group">
            <div className="flex justify-between items-start">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center flex-shrink-0">
                <TrendingUp className="h-5 w-5" />
              </div>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold border bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                +8.4%
              </span>
            </div>
            <div className="mt-4">
              <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Total Sales</p>
              <h3 className="text-xl font-black mt-0.5">
                {currencySymbol}{metrics.totalSales.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
              <p className="text-[9px] text-muted-foreground mt-1">vs last month</p>
            </div>
          </div>

          {/* Card 2: Cost of Goods Sold */}
          <div className="bg-card border border-border p-6 rounded-3xl flex flex-col justify-between hover:shadow-lg hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group">
            <div className="flex justify-between items-start">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center flex-shrink-0">
                <Boxes className="h-5 w-5" />
              </div>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold border bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400">
                -2.1%
              </span>
            </div>
            <div className="mt-4">
              <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">COGS (Stock Cost)</p>
              <h3 className="text-xl font-black mt-0.5">
                {currencySymbol}{metrics.costOfGoodsSold.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
              <p className="text-[9px] text-muted-foreground mt-1">inventory value sold</p>
            </div>
          </div>

          {/* Card 3: Other Income */}
          <div className="bg-card border border-border p-6 rounded-3xl flex flex-col justify-between hover:shadow-lg hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group">
            <div className="flex justify-between items-start">
              <div className="h-10 w-10 rounded-xl bg-cyan-500/10 text-cyan-600 flex items-center justify-center flex-shrink-0">
                <TrendingUp className="h-5 w-5" />
              </div>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold border bg-slate-500/10 border-slate-500/20 text-slate-600 dark:text-slate-400">
                0.0%
              </span>
            </div>
            <div className="mt-4">
              <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Other Income</p>
              <h3 className="text-xl font-black mt-0.5">
                {currencySymbol}{metrics.totalIncome.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
              <p className="text-[9px] text-muted-foreground mt-1">additional monthly inflow</p>
            </div>
          </div>

          {/* Card 4: Monthly Expenses */}
          <div className="bg-card border border-border p-6 rounded-3xl flex flex-col justify-between hover:shadow-lg hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group">
            <div className="flex justify-between items-start">
              <div className="h-10 w-10 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center flex-shrink-0">
                <Coins className="h-5 w-5" />
              </div>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold border bg-slate-500/10 border-slate-500/20 text-slate-600 dark:text-slate-400">
                0.0%
              </span>
            </div>
            <div className="mt-4">
              <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Expenses</p>
              <h3 className="text-xl font-black mt-0.5">
                {currencySymbol}{metrics.totalExpenses.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
              <p className="text-[9px] text-muted-foreground mt-1">outward payments</p>
            </div>
          </div>

          {/* Card 5: Net Profit */}
          <div className="bg-card border border-border p-6 rounded-3xl flex flex-col justify-between hover:shadow-lg hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group">
            <div className="flex justify-between items-start">
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                netProfitPositive ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
              }`}>
                <DollarSign className="h-5 w-5" />
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                netProfitPositive
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                  : "bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400"
              }`}>
                {netProfitPositive ? "+12.6%" : "-12.6%"}
              </span>
            </div>
            <div className="mt-4">
              <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Net Profit</p>
              <h3 className={`text-xl font-black mt-0.5 ${netProfitPositive ? "text-foreground" : "text-rose-600 dark:text-rose-400"}`}>
                {metrics.netProfit < 0 ? `${currencySymbol}-` : `${currencySymbol}`}{Math.abs(metrics.netProfit).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
              <p className="text-[9px] text-muted-foreground mt-1">margin {marginPercent}%</p>
            </div>
          </div>
        </div>
      )}

      {/* 2. Charts & Alerts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales performance chart (2/3 width) */}
        <div className="lg:col-span-2 glass-card rounded-3xl p-6 flex flex-col justify-between">
          <div className="mb-4">
            <h2 className="text-sm font-bold">Sales Trend</h2>
            <p className="text-[10px] text-muted-foreground mt-0.5">Daily total sales revenue over the last 7 days.</p>
          </div>
          
          <div className="h-64 w-full">
            {mounted && chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(var(--border), 0.1)" />
                  <XAxis dataKey="name" stroke="currentColor" style={{ opacity: 0.6, fontSize: "10px" }} />
                  <YAxis stroke="currentColor" style={{ opacity: 0.6, fontSize: "10px" }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      borderColor: "hsl(var(--border))",
                      borderRadius: "var(--radius)",
                    }}
                    labelStyle={{ fontSize: "10px", fontWeight: "bold" }}
                    itemStyle={{ fontSize: "11px", color: "hsl(var(--primary))" }}
                  />
                  <Area type="monotone" dataKey="sales" name={`Sales (${currencySymbol})`} stroke="hsl(var(--primary))" strokeWidth={2.5} fillOpacity={1} fill="url(#colorSales)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                No chart points compiled. Run sales bills to populate.
              </div>
            )}
          </div>
        </div>

        {/* Low Stock Alerts (1/3 width) */}
        <div className="glass-card rounded-3xl p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-bold">Low Stock Monitoring</h2>
            <p className="text-[10px] text-muted-foreground mt-0.5">Items falling below minimum alert margins.</p>
          </div>

          <div className="flex-1 overflow-y-auto mt-4 space-y-3 pr-1 max-h-56">
            {alerts.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground p-4">
                <Boxes className="h-10 w-10 stroke-1 opacity-50 mb-1" />
                <p className="text-xs">All products carry safe stock levels.</p>
              </div>
            ) : (
              alerts.map((item) => (
                <div key={item.id} className="bg-secondary/40 border border-border rounded-xl p-3 flex justify-between items-center gap-4">
                  <div className="min-w-0">
                    <div className="text-xs font-bold truncate">{item.name}</div>
                    <div className="text-[9px] text-muted-foreground uppercase font-semibold mt-0.5">SKU: {item.sku}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="text-xs font-black text-destructive">{item.currentQuantity}</span>
                    <span className="text-[9px] text-muted-foreground ml-1">{item.unit}</span>
                    <div className="text-[8px] text-muted-foreground mt-0.5">Min: {item.alertQuantity}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 3. Tables Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recent Transactions */}
        <div className="glass-card rounded-3xl p-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-sm font-bold">Recent POS Checkouts</h2>
              <p className="text-[10px] text-muted-foreground mt-0.5">Latest sales bills processed.</p>
            </div>
            <Link href="/dashboard/sales" className="text-xs text-primary hover:underline font-bold flex items-center gap-1">
              Log
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-border text-muted-foreground font-semibold">
                  <th className="py-2.5">Invoice #</th>
                  <th className="py-2.5">Customer</th>
                  <th className="py-2.5 text-right">Total</th>
                  <th className="py-2.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-muted-foreground">
                      No invoices billed.
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-secondary/20">
                      <td className="py-2.5 font-semibold text-primary">{tx.invoiceNumber}</td>
                      <td className="py-2.5">{tx.customerName}</td>
                      <td className="py-2.5 text-right font-bold">{currencySymbol}{tx.total.toFixed(2)}</td>
                      <td className="py-2.5 text-center">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                          tx.paymentStatus === "PAID"
                            ? "bg-primary/10 text-primary border-primary/20"
                            : tx.paymentStatus === "PARTIAL"
                            ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                            : "bg-destructive/10 text-destructive border-destructive/20"
                        }`}>
                          {tx.paymentStatus}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top Products */}
        <div className="glass-card rounded-3xl p-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-sm font-bold">Top Selling Products</h2>
              <p className="text-[10px] text-muted-foreground mt-0.5">Most popular inventory items by quantity.</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-border text-muted-foreground font-semibold">
                  <th className="py-2.5">Product Name</th>
                  <th className="py-2.5 text-center">Sold</th>
                  <th className="py-2.5 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {topProducts.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-6 text-center text-muted-foreground">
                      No sales recorded yet.
                    </td>
                  </tr>
                ) : (
                  topProducts.map((p) => (
                    <tr key={p.id} className="hover:bg-secondary/20">
                      <td className="py-2.5 font-medium">
                        <div>{p.name}</div>
                        <div className="text-[8px] text-muted-foreground uppercase">SKU: {p.sku}</div>
                      </td>
                      <td className="py-2.5 text-center font-bold">{p.quantitySold}</td>
                      <td className="py-2.5 text-right font-black">{currencySymbol}{p.revenue.toFixed(2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
