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
  const { data: session, status: sessionStatus } = useSession();
  const { currencySymbol } = useSettings();

  const userRole = (session?.user as any)?.role;
  
  const [metrics, setMetrics] = React.useState<DashboardMetrics | null>(null);
  const [alerts, setAlerts] = React.useState<AlertMeta[]>([]);
  const [transactions, setTransactions] = React.useState<TransactionMeta[]>([]);
  const [topProducts, setTopProducts] = React.useState<TopProductMeta[]>([]);
  const [chartData, setChartData] = React.useState<any[]>([]);
  
  const [isLoading, setIsLoading] = React.useState(true);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    
    if (userRole === "SUPER_ADMIN") {
      setIsLoading(false);
      return;
    }
    
    async function loadDashboard() {
      try {
        const res = await fetch("/api/v1/reports/dashboard");
        if (res.ok) {
          const data = await res.json();
          setMetrics(data.metrics);
          setAlerts(data.lowStockAlerts || []);
          setTransactions(data.recentTransactions || []);
          setTopProducts(data.topSellingProducts || []);
          setChartData(data.salesChart || []);
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
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

  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 glass-card bg-gradient-to-br from-primary/10 via-transparent to-transparent p-6 rounded-3xl">
        <div>
          <h1 className="text-2xl font-black">Dashboard Overview</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time business performance analytics for your active branch context.
          </p>
        </div>
        <Link
          href="/dashboard/pos"
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white hover:bg-blue-500 rounded-xl text-xs font-bold shadow-[0_0_15px_rgba(37,99,235,0.4)] hover:shadow-[0_0_25px_rgba(37,99,235,0.6)] hover:-translate-y-0.5 transition-all uppercase tracking-wider"
        >
          <ShoppingBag className="h-4.5 w-4.5" />
          Open POS Terminal
        </Link>
      </div>

      {/* 1. Metrics Grid */}
      {metrics && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Card 1: Total Sales */}
          <div className="glass-card p-6 rounded-3xl flex items-center gap-4 hover:-translate-y-1 hover:shadow-lg transition-all duration-300 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Total Sales</p>
              <h3 className="text-xl font-black mt-0.5">{currencySymbol}{metrics.totalSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
              <p className="text-[9px] text-muted-foreground mt-0.5">Current calendar month</p>
            </div>
          </div>

          {/* Card 2: Cost of Goods Sold */}
          <div className="glass-card p-6 rounded-3xl flex items-center gap-4 hover:-translate-y-1 hover:shadow-lg transition-all duration-300 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="h-12 w-12 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center flex-shrink-0">
              <Boxes className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">COGS (Stock Cost)</p>
              <h3 className="text-xl font-black mt-0.5">{currencySymbol}{metrics.costOfGoodsSold.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
              <p className="text-[9px] text-muted-foreground mt-0.5">Inventory value sold</p>
            </div>
          </div>

          {/* Card 3: Other Income */}
          <div className="glass-card p-6 rounded-3xl flex items-center gap-4 hover:-translate-y-1 hover:shadow-lg transition-all duration-300 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="h-12 w-12 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center flex-shrink-0">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Other Income</p>
              <h3 className="text-xl font-black mt-0.5">{currencySymbol}{metrics.totalIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
              <p className="text-[9px] text-muted-foreground mt-0.5">Additional monthly inflow</p>
            </div>
          </div>

          {/* Card 4: Monthly Expenses */}
          <div className="glass-card p-6 rounded-3xl flex items-center gap-4 hover:-translate-y-1 hover:shadow-lg transition-all duration-300 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="h-12 w-12 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center flex-shrink-0">
              <Coins className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Expenses</p>
              <h3 className="text-xl font-black mt-0.5">{currencySymbol}{metrics.totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
              <p className="text-[9px] text-muted-foreground mt-0.5">Outward payments</p>
            </div>
          </div>

          {/* Card 5: Net Profit */}
          <div className="glass-card p-6 rounded-3xl flex items-center gap-4 hover:-translate-y-1 hover:shadow-lg transition-all duration-300 relative overflow-hidden group">
            <div className={`absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity ${netProfitPositive ? "from-emerald-500/5" : "from-red-500/5"} to-transparent`} />
            <div className={`h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
              netProfitPositive ? "bg-emerald-500/10 text-emerald-500" : "bg-destructive/10 text-destructive"
            }`}>
              <DollarSign className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Net Profit</p>
              <h3 className={`text-xl font-black mt-0.5 ${netProfitPositive ? "text-primary" : "text-destructive"}`}>
                {currencySymbol}{metrics.netProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
              <p className="text-[9px] text-muted-foreground mt-0.5">Sales - COGS + Income - Expenses</p>
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
