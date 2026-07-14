"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { useSettings } from "@/components/settings-provider";
import SuperAdminDashboard from "@/components/super-admin-dashboard";
import {
  TrendingUp,
  DollarSign,
  Boxes,
  Users,
  ShoppingCart,
  AlertTriangle,
  ArrowRight,
  Plus,
  Package,
  FileText,
  CreditCard,
  MoreHorizontal,
  ChevronDown,
  RefreshCw,
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
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
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

const COLORS = ["#0B3B30", "#126854", "#22C55E", "#38BDF8", "#94A3B8"];

export default function DashboardPage() {
  const { data: session, status: sessionStatus } = useSession();
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
  const [isSyncing, setIsSyncing] = React.useState(false);

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
    return <div className="h-full flex items-center justify-center p-8"><RefreshCw className="w-8 h-8 animate-spin text-primary opacity-50" /></div>;
  }

  if (userRole === "SUPER_ADMIN") {
    return <SuperAdminDashboard />;
  }

  // Mock Category Data based on Top Products for visual presentation
  const categoryData = [
    { name: "Electronics", value: 45 },
    { name: "Accessories", value: 25 },
    { name: "Wearables", value: 15 },
    { name: "Home Appliances", value: 10 },
    { name: "Others", value: 5 },
  ];

  // Mock Business Analytics
  const businessAnalytics = [
    { label: "Average Order Value", value: "₹1,980", trend: "+10.2%" },
    { label: "Conversion Rate", value: "3.42%", trend: "+6.5%" },
    { label: "Customer Retention", value: "78.6%", trend: "+4.3%" },
    { label: "Gross Margin", value: "32.8%", trend: "+7.1%" },
  ];

  // Mini Sparkline Data
  const sparklineData = chartData.length > 0 ? chartData.map(d => ({ value: d.sales })) : [{value: 0}, {value: 10}, {value: 5}, {value: 20}];

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-24 md:pb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
            Welcome back, {session?.user?.name?.split(" ")[0] || "Admin"}! 👋
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Here's what's happening with your business today.
          </p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="hidden sm:flex items-center px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-600">
            This Month <ChevronDown className="w-4 h-4 ml-2" />
          </div>
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-[#0B3B30] text-white hover:bg-[#126854] rounded-lg text-xs font-bold transition-all shadow-sm"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin" : ""}`} />
            Sync Real-time Data
          </button>
        </div>
      </div>

      {/* Mobile Only: Today's Summary & Quick Actions */}
      <div className="md:hidden space-y-4">
        <div className="bg-[#0B3B30] text-white p-5 rounded-2xl flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <div>
              <div className="text-[10px] font-bold text-white/70 uppercase">Today's Summary</div>
              <div className="text-xs font-medium text-white/90">24 August 2024</div>
            </div>
            <div className="px-2 py-1 bg-white/10 rounded text-[10px] font-bold flex items-center">
              Today <ChevronDown className="w-3 h-3 ml-1" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <div className="text-[10px] text-white/70 font-semibold mb-0.5">Sales</div>
              <div className="text-lg font-black">{currencySymbol}{metrics?.totalSales.toLocaleString('en-IN', { maximumFractionDigits: 0 }) || 0}</div>
              <div className="text-[8px] text-[#22C55E] mt-0.5 font-bold">↑ 16.5%</div>
            </div>
            <div>
              <div className="text-[10px] text-white/70 font-semibold mb-0.5">Orders</div>
              <div className="text-lg font-black">{metrics?.ordersCount || 85}</div>
              <div className="text-[8px] text-[#22C55E] mt-0.5 font-bold">↑ 10.2%</div>
            </div>
            <div>
              <div className="text-[10px] text-white/70 font-semibold mb-0.5">Customers</div>
              <div className="text-lg font-black">{metrics?.customersCount || 42}</div>
              <div className="text-[8px] text-[#22C55E] mt-0.5 font-bold">↑ 8.1%</div>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-bold mb-3 text-slate-800 px-1">Quick Actions</h3>
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "New Sale", icon: Plus, href: "/dashboard/pos" },
              { label: "Add Product", icon: Package, href: "/dashboard/products" },
              { label: "Stock In", icon: Boxes, href: "/dashboard/inventory" },
              { label: "Customer", icon: Users, href: "/dashboard/customers" },
              { label: "Expenses", icon: CreditCard, href: "/dashboard/expenses" },
              { label: "Reports", icon: FileText, href: "/dashboard/reports" },
              { label: "Cash In/Out", icon: DollarSign, href: "/dashboard/sales" },
              { label: "More", icon: MoreHorizontal, href: "#" },
            ].map((action, i) => (
              <Link key={i} href={action.href} className="flex flex-col items-center gap-1.5 p-3 bg-white rounded-2xl border border-slate-100 shadow-sm shadow-slate-100/50 hover:border-[#126854]/30 transition-colors">
                <action.icon className="w-5 h-5 text-[#0B3B30]" />
                <span className="text-[9px] font-bold text-slate-600 text-center leading-tight">{action.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Metric Cards (Desktop Only) */}
      {metrics && (
        <div className="hidden md:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Sales */}
          <div className="bg-white border border-slate-100 p-5 rounded-2xl flex flex-col justify-between shadow-sm">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[11px] font-bold text-slate-500">Total Sales</p>
                  <h3 className="text-xl font-black text-slate-800">
                    {currencySymbol}{metrics.totalSales.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </h3>
                </div>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center text-[10px] font-bold">
                <span className="text-emerald-500 mr-1">↑ 18.6%</span>
                <span className="text-slate-400">vs Last Month</span>
              </div>
              <div className="w-16 h-8">
                {mounted && (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={sparklineData}>
                      <Line type="monotone" dataKey="value" stroke="#10B981" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          {/* Card 2: Orders */}
          <div className="bg-white border border-slate-100 p-5 rounded-2xl flex flex-col justify-between shadow-sm">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <ShoppingCart className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[11px] font-bold text-slate-500">Orders</p>
                  <h3 className="text-xl font-black text-slate-800">
                    {metrics.ordersCount || 1248}
                  </h3>
                </div>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center text-[10px] font-bold">
                <span className="text-emerald-500 mr-1">↑ 12.4%</span>
                <span className="text-slate-400">vs Last Month</span>
              </div>
              <div className="w-16 h-8">
                {mounted && (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={sparklineData}>
                      <Line type="monotone" dataKey="value" stroke="#10B981" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          {/* Card 3: Customers */}
          <div className="bg-white border border-slate-100 p-5 rounded-2xl flex flex-col justify-between shadow-sm">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[11px] font-bold text-slate-500">Customers</p>
                  <h3 className="text-xl font-black text-slate-800">
                    {metrics.customersCount || 932}
                  </h3>
                </div>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center text-[10px] font-bold">
                <span className="text-emerald-500 mr-1">↑ 8.7%</span>
                <span className="text-slate-400">vs Last Month</span>
              </div>
              <div className="w-16 h-8">
                {mounted && (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={sparklineData}>
                      <Line type="monotone" dataKey="value" stroke="#10B981" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          {/* Card 4: Profit */}
          <div className="bg-white border border-slate-100 p-5 rounded-2xl flex flex-col justify-between shadow-sm">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <DollarSign className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[11px] font-bold text-slate-500">Profit</p>
                  <h3 className="text-xl font-black text-slate-800">
                    {currencySymbol}{Math.abs(metrics.netProfit).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </h3>
                </div>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center text-[10px] font-bold">
                <span className="text-emerald-500 mr-1">↑ 15.3%</span>
                <span className="text-slate-400">vs Last Month</span>
              </div>
              <div className="w-16 h-8">
                {mounted && (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={sparklineData}>
                      <Line type="monotone" dataKey="value" stroke="#10B981" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Row 1: Charts & Top Products */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Sales Overview Chart (2/3) */}
        <div className="lg:col-span-2 bg-white border border-slate-100 rounded-2xl p-6 shadow-sm flex flex-col">
          <h2 className="text-sm font-extrabold text-slate-800 mb-6">Sales Overview</h2>
          <div className="h-72 w-full flex-1">
            {mounted && chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorSalesFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#126854" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#126854" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} tickFormatter={(v) => `${currencySymbol}${v > 1000 ? (v/1000).toFixed(0)+'K' : v}`} />
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}
                    itemStyle={{ color: '#0B3B30', fontWeight: 'bold' }}
                  />
                  <Area type="monotone" dataKey="sales" name="Sales" stroke="#126854" strokeWidth={3} fillOpacity={1} fill="url(#colorSalesFill)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">Loading chart data...</div>
            )}
          </div>
        </div>

        {/* Top Selling Products (1/3) */}
        <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-sm font-extrabold text-slate-800">Top Selling Products</h2>
            <Link href="/dashboard/products" className="text-[10px] font-bold text-[#126854] hover:underline">View All</Link>
          </div>
          
          <div className="flex-1 space-y-4">
            {topProducts.length === 0 ? (
              <div className="text-center text-slate-400 text-xs py-8">No products sold yet</div>
            ) : (
              topProducts.slice(0,5).map((p, i) => (
                <div key={p.id} className="flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-[#126854]/5 transition-colors">
                      <Package className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-800">{p.name}</div>
                      <div className="text-[9px] text-slate-400 font-semibold">{p.sku}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-black text-slate-800">{currencySymbol}{p.revenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
                    <div className="text-[9px] text-slate-400 font-medium">{p.quantitySold} units</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Row 2: Recent Orders & Donut & Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent Orders (1/3) */}
        <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-sm font-extrabold text-slate-800">Recent Orders</h2>
            <Link href="/dashboard/sales" className="text-[10px] font-bold text-slate-500 flex items-center">
              View All Orders <ChevronDown className="w-3 h-3 ml-1" />
            </Link>
          </div>
          
          <div className="space-y-4">
            <div className="flex text-[10px] font-bold text-slate-400 border-b border-slate-100 pb-2">
              <div className="flex-1">Order ID / Customer</div>
              <div className="w-20 text-right">Amount</div>
              <div className="w-24 text-right">Status</div>
            </div>
            {transactions.slice(0,5).map((tx) => (
              <div key={tx.id} className="flex items-center text-xs py-1">
                <div className="flex-1">
                  <div className="font-bold text-slate-800">{tx.customerName || "Walk-in Customer"}</div>
                  <div className="text-[9px] text-slate-400">{tx.invoiceNumber}</div>
                </div>
                <div className="w-20 text-right font-black text-slate-800">
                  {currencySymbol}{tx.total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </div>
                <div className="w-24 flex justify-end">
                  <span className={`px-2 py-1 rounded-md text-[9px] font-bold flex items-center justify-center ${
                    tx.paymentStatus === 'PAID' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'
                  }`}>
                    {tx.paymentStatus === 'PAID' ? 'Completed' : 'Processing'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sales by Category (1/3) */}
        <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
          <h2 className="text-sm font-extrabold text-slate-800 mb-4">Sales by Category</h2>
          <div className="flex items-center h-48">
            <div className="w-1/2 h-full relative">
              {mounted && (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={65}
                      paddingAngle={2}
                      dataKey="value"
                      stroke="none"
                    >
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              )}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xs font-black text-slate-800">{currencySymbol}{metrics?.totalSales ? (metrics.totalSales/1000).toFixed(1)+'k' : '0'}</span>
                <span className="text-[8px] text-slate-400 font-bold">Total Sales</span>
              </div>
            </div>
            <div className="w-1/2 pl-4 space-y-3">
              {categoryData.map((cat, idx) => (
                <div key={cat.name} className="flex items-center justify-between text-[10px]">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></span>
                    <span className="font-semibold text-slate-600">{cat.name}</span>
                  </div>
                  <span className="font-bold text-slate-400">{cat.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Business Analytics (1/3) */}
        <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
          <h2 className="text-sm font-extrabold text-slate-800 mb-6">Business Analytics</h2>
          <div className="space-y-5">
            {businessAnalytics.map((item, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-[#126854]">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-slate-500">{item.label}</div>
                    <div className="text-xs font-black text-slate-800">{item.value}</div>
                  </div>
                </div>
                <div className="px-2 py-1 bg-emerald-50 text-emerald-600 rounded text-[9px] font-bold">
                  {item.trend}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

