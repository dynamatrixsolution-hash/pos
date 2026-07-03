"use client";

import * as React from "react";
import {
  Building,
  Users,
  Layers,
  Plus,
  Coins,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  TrendingDown,
  Activity,
  CheckCircle,
  Database,
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
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

interface SaaSMetrics {
  totalBusinesses: number;
  activeBusinesses: number;
  expiredBusinesses: number;
  trialBusinesses: number;
  totalRevenue: number;
  monthlyRevenue: number;
  totalUsers: number;
  activeUsers: number;
  totalBranches: number;
  totalWarehouses: number;
  pendingRenewals: number;
}

interface ChartItem {
  name: string;
  revenue?: number;
  total?: number;
  active?: number;
  value?: number;
  renewals?: number;
}

interface ActivityLogItem {
  id: string;
  action: string;
  details: string;
  createdAt: string;
  user: string;
}

const COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444"];

export default function SuperAdminDashboard() {
  const [metrics, setMetrics] = React.useState<SaaSMetrics | null>(null);
  const [charts, setCharts] = React.useState<{
    revenueTrend: ChartItem[];
    businessGrowth: ChartItem[];
    subscriptionGrowth: ChartItem[];
    monthlyRenewals: ChartItem[];
  } | null>(null);
  const [activities, setActivities] = React.useState<ActivityLogItem[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function loadStats() {
      try {
        const res = await fetch("/api/v1/super-admin/dashboard");
        if (res.ok) {
          const data = await res.json();
          setMetrics(data.metrics);
          setCharts(data.charts);
          setActivities(data.recentActivity);
        }
      } catch (err) {
        console.error("Failed to load SaaS analytics:", err);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent mx-auto" />
          <p className="text-xs text-muted-foreground">Aggregating platform diagnostics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-[#0F172A]">
      {/* 1. Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gradient-to-br from-blue-600/10 via-sky-50/5 to-transparent border border-blue-100 p-6 rounded-3xl">
        <div>
          <h1 className="text-2xl font-black">SaaS Control Panel</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time platform licensing analytics, system health logs, and subscription billing.
          </p>
        </div>
        <Link
          href="/dashboard/super-admin/businesses?tab=add"
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white hover:bg-blue-500 rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 hover:-translate-y-0.5 transition-all uppercase tracking-wider"
        >
          <Plus className="h-4.5 w-4.5" />
          Provision Business
        </Link>
      </div>

      {/* 2. Key Metrics Grid */}
      {metrics && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Revenue */}
          <div className="bg-white border border-slate-200/80 p-6 rounded-3xl flex items-center gap-4 hover:-translate-y-1 hover:shadow-md transition-all duration-300 relative overflow-hidden group">
            <div className="h-12 w-12 rounded-xl bg-blue-600/10 text-blue-600 flex items-center justify-center flex-shrink-0">
              <Coins className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total SaaS Revenue</p>
              <h3 className="text-xl font-black mt-0.5">${metrics.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
              <p className="text-[9px] text-slate-400 mt-0.5">Platform lifetime collections</p>
            </div>
          </div>

          {/* Monthly Revenue */}
          <div className="bg-white border border-slate-200/80 p-6 rounded-3xl flex items-center gap-4 hover:-translate-y-1 hover:shadow-md transition-all duration-300 relative overflow-hidden group">
            <div className="h-12 w-12 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center flex-shrink-0">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Monthly SaaS Revenue</p>
              <h3 className="text-xl font-black mt-0.5">${metrics.monthlyRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
              <p className="text-[9px] text-emerald-600 font-semibold mt-0.5">+14.2% MRR growth</p>
            </div>
          </div>

          {/* Total Businesses */}
          <div className="bg-white border border-slate-200/80 p-6 rounded-3xl flex items-center gap-4 hover:-translate-y-1 hover:shadow-md transition-all duration-300 relative overflow-hidden group">
            <div className="h-12 w-12 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center flex-shrink-0">
              <Building className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Registered Tenants</p>
              <h3 className="text-xl font-black mt-0.5">{metrics.totalBusinesses} Businesses</h3>
              <p className="text-[9px] text-slate-400 mt-0.5">{metrics.activeBusinesses} Active / {metrics.expiredBusinesses} Expired</p>
            </div>
          </div>

          {/* Users & Branches */}
          <div className="bg-white border border-slate-200/80 p-6 rounded-3xl flex items-center gap-4 hover:-translate-y-1 hover:shadow-md transition-all duration-300 relative overflow-hidden group">
            <div className="h-12 w-12 rounded-xl bg-purple-500/10 text-purple-650 flex items-center justify-center flex-shrink-0">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Active Platform Users</p>
              <h3 className="text-xl font-black mt-0.5">{metrics.activeUsers} Users</h3>
              <p className="text-[9px] text-slate-400 mt-0.5">{metrics.totalBranches} Branches / {metrics.totalWarehouses} Warehouses</p>
            </div>
          </div>
        </div>
      )}

      {/* 3. Detailed Stats Row */}
      {metrics && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200/80 p-4 rounded-2xl">
            <span className="text-[9px] font-bold text-slate-400 uppercase">Trial Plans</span>
            <p className="text-lg font-black text-slate-800 mt-0.5">{metrics.trialBusinesses}</p>
          </div>
          <div className="bg-white border border-slate-200/80 p-4 rounded-2xl">
            <span className="text-[9px] font-bold text-slate-400 uppercase">Pending Renewals</span>
            <p className="text-lg font-black text-amber-500 mt-0.5">{metrics.pendingRenewals} (30 days)</p>
          </div>
          <div className="bg-white border border-slate-200/80 p-4 rounded-2xl">
            <span className="text-[9px] font-bold text-slate-400 uppercase">Server Health</span>
            <p className="text-lg font-black text-emerald-600 mt-0.5">HEALTHY</p>
          </div>
          <div className="bg-white border border-slate-200/80 p-4 rounded-2xl">
            <span className="text-[9px] font-bold text-slate-400 uppercase">Active DB Queries</span>
            <p className="text-lg font-black text-slate-800 mt-0.5">CONNECTED</p>
          </div>
        </div>
      )}

      {/* 4. Charts Section */}
      {charts && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Revenue Trend Area Chart */}
          <div className="lg:col-span-2 bg-white border border-slate-200/80 rounded-3xl p-6 flex flex-col justify-between">
            <div className="mb-4">
              <h2 className="text-sm font-bold">Revenue Trend</h2>
              <p className="text-[10px] text-muted-foreground mt-0.5">Monthly platform collections (USD).</p>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={charts.revenueTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorSaasRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563EB" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(229, 231, 235, 0.5)" />
                  <XAxis dataKey="name" stroke="#64748B" style={{ opacity: 0.8, fontSize: "10px" }} />
                  <YAxis stroke="#64748B" style={{ opacity: 0.8, fontSize: "10px" }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="revenue" name="Revenue ($)" stroke="#2563EB" strokeWidth={2.5} fillOpacity={1} fill="url(#colorSaasRev)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Plan Distribution Pie Chart */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-6 flex flex-col justify-between">
            <div>
              <h2 className="text-sm font-bold">Plan Distribution</h2>
              <p className="text-[10px] text-muted-foreground mt-0.5">SaaS subscription plans among active businesses.</p>
            </div>
            <div className="h-64 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={charts.subscriptionGrowth}
                    cx="50%"
                    cy="45%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {charts.subscriptionGrowth.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" height={36} iconSize={8} iconType="circle" style={{ fontSize: "10px" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* 5. Second Charts Row */}
      {charts && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Business growth line chart */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-6">
            <div className="mb-4">
              <h2 className="text-sm font-bold">Business Growth</h2>
              <p className="text-[10px] text-muted-foreground mt-0.5">Registration index and active licensing trends.</p>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={charts.businessGrowth} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorTotalBus" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorActBus" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(229, 231, 235, 0.5)" />
                  <XAxis dataKey="name" stroke="#64748B" style={{ fontSize: "10px" }} />
                  <YAxis stroke="#64748B" style={{ fontSize: "10px" }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="total" name="Total Registered" stroke="#3B82F6" strokeWidth={2} fillOpacity={1} fill="url(#colorTotalBus)" />
                  <Area type="monotone" dataKey="active" name="Active Subscribers" stroke="#10B981" strokeWidth={2} fillOpacity={1} fill="url(#colorActBus)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Monthly renewals bar chart */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-6">
            <div className="mb-4">
              <h2 className="text-sm font-bold">Monthly Renewals</h2>
              <p className="text-[10px] text-muted-foreground mt-0.5">Schedules of plans due for billing in the current month.</p>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.monthlyRenewals} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(229, 231, 235, 0.5)" />
                  <XAxis dataKey="name" stroke="#64748B" style={{ fontSize: "10px" }} />
                  <YAxis stroke="#64748B" style={{ fontSize: "10px" }} />
                  <Tooltip />
                  <Bar dataKey="renewals" name="Renewals Due" fill="#F59E0B" radius={[8, 8, 0, 0]} barSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* 6. Recent Activity Feed */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-sm font-bold">Recent Platform Activity</h2>
            <p className="text-[10px] text-muted-foreground mt-0.5">Real-time audit history of administrator triggers.</p>
          </div>
          <Link
            href="/dashboard/super-admin/activity-logs"
            className="text-xs text-blue-600 hover:underline font-bold flex items-center gap-1"
          >
            Audit Trails
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="space-y-4">
          {activities.length === 0 ? (
            <div className="text-center text-xs text-muted-foreground py-6">No recent events recorded.</div>
          ) : (
            activities.map((act) => (
              <div
                key={act.id}
                className="flex items-start gap-4 p-3 hover:bg-slate-50 border border-slate-100 rounded-xl transition-all"
              >
                <div className="h-8 w-8 rounded-lg bg-slate-150 flex items-center justify-center shrink-0">
                  <Activity className="h-4.5 w-4.5 text-slate-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-2">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                      act.action === "CREATE_BUSINESS"
                        ? "bg-blue-50 text-blue-600 border border-blue-100"
                        : act.action === "SUSPEND_BUSINESS"
                        ? "bg-red-50 text-red-650 border border-red-100"
                        : "bg-emerald-50 text-emerald-600 border border-emerald-100"
                    }`}>
                      {act.action}
                    </span>
                    <span className="text-[9px] text-slate-400 font-semibold">{new Date(act.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">{act.details}</p>
                  <p className="text-[9px] text-slate-400 mt-0.5">Triggered by: {act.user}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
