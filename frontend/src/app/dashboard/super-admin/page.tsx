"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Building2,
  FileText,
  CreditCard,
  Users,
  RefreshCw,
  Plus,
  ChevronRight,
  ArrowRight,
  Database,
  LifeBuoy,
  Settings,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Activity,
  Layers,
  UtensilsCrossed,
  BedDouble,
} from "lucide-react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { Notify } from "@/lib/notify";

export default function SuperAdminDashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<"recent" | "approvals" | "overdue" | "suspended">("recent");

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/v1/super-admin/dashboard");
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to load platform overview");
      }
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      Notify.error(err.message || "Failed to load super admin overview");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const overviewMetrics = data?.overviewMetrics || {
    totalBusinesses: 0,
    activeBusinesses: 0,
    totalUsers: 0,
    totalPlatformRevenue: 0,
    totalOutstandingRevenue: 0,
    currency: "NPR",
  };

  const attentionQueues = data?.attentionQueues || {
    pendingApprovals: { count: 0 },
    overdueSubscriptions: { count: 0 },
    trialsEnding: { count: 0 },
    expiringWithin30Days: { count: 0 },
    suspendedAccounts: { count: 0 },
  };

  const analytics = data?.analytics || {
    planDistribution: [
      { name: "Starter", value: 20, count: 1, color: "#71675E" },
      { name: "Standard", value: 40, count: 2, color: "#057A55" },
      { name: "Professional", value: 30, count: 2, color: "#6B2837" },
      { name: "Enterprise", value: 10, count: 1, color: "#1C64F2" },
    ],
    support: { open: 1, inProgress: 1, waiting: 0, resolved: 3 },
  };

  const actionLists = data?.actionLists || {
    urgentRegistrationRequests: [],
    overdueInvoicesList: [],
    recentAuditActivity: [],
    recentBusinesses: [],
  };

  const latestBackup = data?.latestBackup;

  const pendingCount = attentionQueues.pendingApprovals.count;
  const overdueCount = attentionQueues.overdueSubscriptions.count;
  const expiringCount = attentionQueues.expiringWithin30Days.count;

  // Format NPR values compactly like NexaEdu
  const formatRevenueNpr = (num: number) => {
    if (!num || num <= 0) return "NPR 0";
    if (num >= 10000000) return `NPR ${(num / 10000000).toFixed(1)}Cr`;
    if (num >= 100000) return `NPR ${(num / 100000).toFixed(1)}L`;
    if (num >= 1000) return `NPR ${(num / 1000).toFixed(0)}K`;
    return `NPR ${num.toLocaleString()}`;
  };

  // Top 6 KPI Cards definition matching NexaEdu
  const kpiCards = [
    {
      label: "Total Businesses",
      value: overviewMetrics.totalBusinesses.toLocaleString(),
      sub: "↑ 12 mo",
      subHighlight: true,
      href: "/dashboard/super-admin/businesses",
      icon: Building2,
    },
    {
      label: "Active Properties",
      value: overviewMetrics.activeBusinesses.toLocaleString(),
      sub: "Live & operating",
      subHighlight: false,
      href: "/dashboard/super-admin/businesses",
      icon: ShieldCheck,
    },
    {
      label: "Pending Approvals",
      value: String(pendingCount),
      sub: pendingCount > 0 ? "Review needed" : "All clear",
      subHighlight: pendingCount > 0,
      href: "/dashboard/super-admin/businesses/pending",
      icon: Clock,
    },
    {
      label: "Expiring / Overdue",
      value: String(overdueCount || expiringCount),
      sub: overdueCount > 0 ? "Requires payment" : "Within 30d",
      subHighlight: overdueCount > 0,
      href: "/dashboard/super-admin/subscriptions",
      icon: AlertTriangle,
    },
    {
      label: "Platform Staff",
      value: overviewMetrics.totalUsers.toLocaleString(),
      sub: "Across all properties",
      subHighlight: false,
      href: "/dashboard/super-admin/users",
      icon: Users,
    },
    {
      label: "Estimated Revenue",
      value: formatRevenueNpr(overviewMetrics.totalPlatformRevenue),
      sub: "Platform rev",
      subHighlight: false,
      href: "/dashboard/super-admin/revenue",
      icon: CreditCard,
    },
  ];

  return (
    <div
      className="min-h-full bg-[#F7F3EC] text-[#292320]"
      style={{
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "SF Pro", "San Francisco", "Helvetica Neue", Helvetica, Arial, sans-serif',
      }}
    >
      <div className="max-w-[1400px] mx-auto p-6 space-y-5">
        {/* 1. Header Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#292320]">
              Welcome back, Super Admin
            </h1>
            <p className="text-xs sm:text-sm text-[#71675E] mt-0.5">
              Multi-tenant platform overview, hospitality operations, and subscription status across Nepal.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-auto">
            <button
              onClick={fetchDashboardData}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#FFFCF7] border border-[#D8CEC1] text-[#292320] text-xs font-semibold rounded-md hover:bg-[#EEE7DD] transition-colors cursor-pointer disabled:opacity-50"
              title="Refresh platform statistics"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-[#71675E] ${loading ? "animate-spin text-[#6B2837]" : ""}`} />
              <span>Refresh</span>
            </button>
            <Link
              href="/dashboard/super-admin/businesses?tab=add"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#6B2837] hover:bg-[#521E2A] text-[#FFFCF7] text-xs font-semibold rounded-md shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Business</span>
            </Link>
          </div>
        </div>

        {/* 2. NexaEdu-style Needs Attention Alert Strip */}
        {(pendingCount > 0 || overdueCount > 0) && (
          <div className="bg-[#FEF08A]/30 border border-[#FEF08A] rounded-lg px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5 text-[#854D0E] font-medium">
              <span className="w-2 h-2 rounded-full bg-[#E3A008] shrink-0 animate-ping" />
              <span>
                <strong>Platform Notice:</strong> You have {pendingCount} registration{pendingCount !== 1 ? "s" : ""} awaiting verification and {overdueCount} subscription invoice{overdueCount !== 1 ? "s" : ""} requiring payment.
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {pendingCount > 0 && (
                <Link
                  href="/dashboard/super-admin/businesses/pending"
                  className="px-2.5 py-1 bg-[#854D0E] hover:bg-[#723B0A] text-[#FFFCF7] font-semibold rounded-md text-[11px] transition-colors"
                >
                  Review Pending ({pendingCount})
                </Link>
              )}
              {overdueCount > 0 && (
                <Link
                  href="/dashboard/super-admin/revenue"
                  className="px-2.5 py-1 bg-[#FFFCF7] hover:bg-[#F7F3EC] text-[#854D0E] border border-[#FEF08A] font-semibold rounded-md text-[11px] transition-colors"
                >
                  View Overdue ({overdueCount})
                </Link>
              )}
            </div>
          </div>
        )}

        {/* 3. Top 6 Compact KPI Cards (Matching NexaEdu layout) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {kpiCards.map((c, idx) => {
            const Icon = c.icon;
            return (
              <Link
                key={idx}
                href={c.href}
                className="bg-[#FFFCF7] rounded-lg border border-[#D8CEC1] p-3 hover:border-[#6B2837] hover:bg-[#F7F3EC]/50 transition-colors flex items-center justify-between gap-2 group select-none shadow-xs"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium text-[#71675E] truncate">{c.label}</p>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className="text-base font-bold text-[#292320] tracking-tight leading-none tabular-nums">
                      {c.value}
                    </span>
                    <span
                      className={`text-[10px] truncate ${
                        c.subHighlight ? "text-[#6B2837] font-semibold" : "text-[#71675E]"
                      }`}
                    >
                      {c.sub}
                    </span>
                  </div>
                </div>
                <div className="text-[#71675E] group-hover:text-[#6B2837] transition-colors shrink-0">
                  <Icon className="h-4 w-4" />
                </div>
              </Link>
            );
          })}
        </div>

        {/* 4. Main 12-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Column (8 cols): Recent Registrations & Attention Tabs */}
          <div className="lg:col-span-8 space-y-5">
            <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg p-5 flex flex-col justify-between">
              {/* Tabs Row */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#D8CEC1] pb-3">
                <div className="flex items-center gap-5 text-xs font-semibold">
                  <button
                    onClick={() => setActiveTab("recent")}
                    className={`pb-1 transition-colors cursor-pointer ${
                      activeTab === "recent"
                        ? "text-[#6B2837] border-b-2 border-[#6B2837] -mb-[13px]"
                        : "text-[#71675E] hover:text-[#292320]"
                    }`}
                  >
                    Recent Properties ({actionLists.recentBusinesses.length})
                  </button>

                  <button
                    onClick={() => setActiveTab("approvals")}
                    className={`pb-1 transition-colors cursor-pointer ${
                      activeTab === "approvals"
                        ? "text-[#6B2837] border-b-2 border-[#6B2837] -mb-[13px]"
                        : "text-[#71675E] hover:text-[#292320]"
                    }`}
                  >
                    Pending Approvals ({pendingCount})
                  </button>

                  <button
                    onClick={() => setActiveTab("overdue")}
                    className={`pb-1 transition-colors cursor-pointer ${
                      activeTab === "overdue"
                        ? "text-[#6B2837] border-b-2 border-[#6B2837] -mb-[13px]"
                        : "text-[#71675E] hover:text-[#292320]"
                    }`}
                  >
                    Overdue Invoices ({overdueCount})
                  </button>
                </div>

                <Link
                  href={
                    activeTab === "recent"
                      ? "/dashboard/super-admin/businesses"
                      : activeTab === "approvals"
                      ? "/dashboard/super-admin/businesses/pending"
                      : "/dashboard/super-admin/revenue"
                  }
                  className="text-xs font-semibold text-[#6B2837] hover:underline self-start sm:self-auto"
                >
                  View all →
                </Link>
              </div>

              {/* Tab 1: Recent Properties */}
              {activeTab === "recent" && (
                <div className="overflow-x-auto pt-3">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-[#F7F3EC] text-[#71675E] font-semibold border-b border-[#D8CEC1]">
                        <th className="py-2.5 px-3">Property Name</th>
                        <th className="py-2.5 px-3">Package Type</th>
                        <th className="py-2.5 px-3">Owner</th>
                        <th className="py-2.5 px-3">Plan</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3 text-right">Registered</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#D8CEC1]">
                      {actionLists.recentBusinesses.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-[#71675E]">
                            No registered businesses found.
                          </td>
                        </tr>
                      ) : (
                        actionLists.recentBusinesses.map((b: any) => (
                          <tr key={b.id} className="hover:bg-[#F7F3EC]/50 transition-colors">
                            <td className="py-2.5 px-3 font-semibold text-[#292320]">
                              <Link
                                href={`/dashboard/super-admin/businesses/${b.id}`}
                                className="hover:text-[#6B2837] transition-colors"
                              >
                                {b.name}
                              </Link>
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-[#F7F3EC] border border-[#D8CEC1] text-[#71675E] font-medium">
                                {b.packageType === "HOTEL" ? (
                                  <BedDouble className="w-3 h-3 text-[#6B2837]" />
                                ) : b.packageType === "BOTH" ? (
                                  <Layers className="w-3 h-3 text-[#6B2837]" />
                                ) : (
                                  <UtensilsCrossed className="w-3 h-3 text-[#6B2837]" />
                                )}
                                {b.packageType}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-[#71675E]">{b.ownerName}</td>
                            <td className="py-2.5 px-3 font-medium text-[#292320]">{b.plan}</td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${
                                  b.status === "ACTIVE"
                                    ? "bg-[#DEF7EC] text-[#03543F] border border-[#BCF0DA]"
                                    : "bg-[#FDE8E8] text-[#9C3232] border border-[#F8B4B4]"
                                }`}
                              >
                                {b.status}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right text-[#71675E] tabular-nums">
                              {new Date(b.createdAt).toLocaleDateString()}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Tab 2: Pending Approvals */}
              {activeTab === "approvals" && (
                <div className="pt-3">
                  {actionLists.urgentRegistrationRequests.length === 0 ? (
                    <div className="text-center py-8 text-[#71675E]">
                      <CheckCircle2 className="w-8 h-8 mx-auto text-[#03543F] mb-1.5" />
                      <div className="font-bold text-[#292320] text-sm">All Clear</div>
                      <div className="text-xs mt-0.5">No registration applications awaiting review.</div>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {actionLists.urgentRegistrationRequests.map((req: any) => (
                        <div
                          key={req.id}
                          className="p-3 bg-[#F7F3EC] rounded-md border border-[#D8CEC1] flex items-center justify-between text-xs"
                        >
                          <div>
                            <div className="font-bold text-[#292320]">{req.businessName}</div>
                            <div className="text-[11px] text-[#71675E] mt-0.5">
                              Tracking: <span className="font-mono font-semibold">{req.trackingCode}</span> • Plan: {req.plan} • Package: {req.businessType}
                            </div>
                          </div>
                          <Link
                            href="/dashboard/super-admin/businesses/pending"
                            className="px-3 py-1 bg-[#6B2837] text-white text-xs font-semibold rounded-md hover:bg-[#521E2A] transition-colors"
                          >
                            Review & Approve
                          </Link>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab 3: Overdue Invoices */}
              {activeTab === "overdue" && (
                <div className="pt-3">
                  {actionLists.overdueInvoicesList.length === 0 ? (
                    <div className="text-center py-8 text-[#71675E]">
                      <CheckCircle2 className="w-8 h-8 mx-auto text-[#03543F] mb-1.5" />
                      <div className="font-bold text-[#292320] text-sm">Good Standing</div>
                      <div className="text-xs mt-0.5">No platform subscription invoices are currently overdue.</div>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {actionLists.overdueInvoicesList.map((inv: any) => (
                        <div
                          key={inv.id}
                          className="p-3 bg-[#F7F3EC] rounded-md border border-[#D8CEC1] flex items-center justify-between text-xs"
                        >
                          <div>
                            <div className="font-bold text-[#292320]">{inv.business?.name}</div>
                            <div className="text-[11px] text-[#71675E] mt-0.5">
                              Invoice #{inv.invoiceNumber} • Due date: {new Date(inv.dueDate).toLocaleDateString()}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold tabular-nums text-xs text-[#9C3232]">
                              NPR {Number(inv.amount).toLocaleString()}
                            </div>
                            <Link
                              href="/dashboard/super-admin/revenue"
                              className="text-[11px] font-semibold text-[#6B2837] hover:underline"
                            >
                              Record settlement →
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Recent Administrative Activity Audit Log Table */}
            <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg p-5">
              <div className="flex items-center justify-between pb-3 border-b border-[#D8CEC1]">
                <div>
                  <h2 className="text-sm font-bold text-[#292320]">Recent Activity Audit Trail</h2>
                  <p className="text-[11px] text-[#71675E]">Logged administrative actions, plan updates and security events</p>
                </div>
                <Link
                  href="/dashboard/super-admin/activity-logs"
                  className="text-xs font-semibold text-[#6B2837] hover:underline"
                >
                  View full log →
                </Link>
              </div>

              <div className="overflow-x-auto pt-2">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#F7F3EC] text-[#71675E] font-semibold border-b border-[#D8CEC1]">
                      <th className="py-2 px-3">Action</th>
                      <th className="py-2 px-3">Context Property</th>
                      <th className="py-2 px-3">Admin</th>
                      <th className="py-2 px-3 text-right">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D8CEC1]">
                    {actionLists.recentAuditActivity.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-[#71675E]">
                          No administrative actions recorded yet.
                        </td>
                      </tr>
                    ) : (
                      actionLists.recentAuditActivity.map((log: any) => (
                        <tr key={log.id} className="hover:bg-[#F7F3EC]/50 transition-colors">
                          <td className="py-2.5 px-3 font-mono font-medium text-[#6B2837]">{log.action}</td>
                          <td className="py-2.5 px-3 text-[#71675E]">{log.business?.name || "Global"}</td>
                          <td className="py-2.5 px-3 text-[#71675E]">
                            {log.actor?.name || log.actor?.email || "Super admin"}
                          </td>
                          <td className="py-2.5 px-3 text-right text-[#71675E] tabular-nums">
                            {new Date(log.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right Column (4 cols): Donut Chart + Support Desk + System Recovery */}
          <div className="lg:col-span-4 space-y-5">
            {/* Widget 1: Subscription Tier Distribution (Donut Chart matching NexaEdu) */}
            <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h2 className="text-sm font-bold text-[#292320]">Subscription Tiers</h2>
                    <p className="text-[11px] text-[#71675E]">Plan distribution across properties</p>
                  </div>
                  <Link
                    href="/dashboard/super-admin/subscriptions"
                    className="text-xs font-semibold text-[#6B2837] hover:underline"
                  >
                    Plans →
                  </Link>
                </div>

                <div className="flex items-center justify-between gap-4 pt-2">
                  <div className="relative h-28 w-28 shrink-0">
                    {mounted ? (
                      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                        <PieChart>
                          <Pie
                            data={analytics.planDistribution}
                            cx="50%"
                            cy="50%"
                            innerRadius={34}
                            outerRadius={48}
                            paddingAngle={3}
                            dataKey="value"
                          >
                            {analytics.planDistribution.map((entry: any, index: number) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value) => [`${value}% share`]} contentStyle={{ fontSize: 11, borderRadius: 6 }} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full w-full bg-[#F7F3EC] rounded-full animate-pulse" />
                    )}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-[9px] text-[#71675E] font-bold uppercase tracking-wider">Tiers</span>
                      <span className="text-sm font-bold text-[#292320] leading-none mt-0.5">
                        {analytics.planDistribution.length}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5 flex-1 min-w-0 text-xs">
                    {analytics.planDistribution.map((p: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                          <span className="text-[#71675E] font-medium truncate">{p.name}</span>
                        </div>
                        <span className="font-bold text-[#292320] tabular-nums">{p.value}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-3 mt-3 border-t border-[#D8CEC1] flex items-center justify-between text-xs">
                <Link
                  href="/dashboard/super-admin/subscriptions"
                  className="font-semibold text-[#6B2837] hover:underline inline-flex items-center gap-1"
                >
                  Manage subscription plans →
                </Link>
              </div>
            </div>

            {/* Widget 2: Support Desk Status Grid (matching NexaEdu) */}
            <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h2 className="text-sm font-bold text-[#292320]">Support Desk</h2>
                    <p className="text-[11px] text-[#71675E]">Tickets & system health</p>
                  </div>
                  <Link
                    href="/dashboard/super-admin/support"
                    className="text-xs font-semibold text-[#6B2837] hover:underline"
                  >
                    Helpdesk →
                  </Link>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="p-2.5 rounded-lg border border-[#F8B4B4] bg-[#FDE8E8] flex items-center justify-between">
                    <span className="text-[11px] font-medium text-[#9C3232]">Open</span>
                    <span className="text-sm font-bold text-[#9C3232] tabular-nums">
                      {analytics.support.open}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg border border-[#BCF0DA] bg-[#DEF7EC] flex items-center justify-between">
                    <span className="text-[11px] font-medium text-[#03543F]">In Progress</span>
                    <span className="text-sm font-bold text-[#03543F] tabular-nums">
                      {analytics.support.inProgress}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg border border-[#FEF08A] bg-[#FEF08A]/30 flex items-center justify-between">
                    <span className="text-[11px] font-medium text-[#854D0E]">Pending User</span>
                    <span className="text-sm font-bold text-[#854D0E] tabular-nums">
                      {analytics.support.waiting}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] flex items-center justify-between">
                    <span className="text-[11px] font-medium text-[#292320]">Resolved</span>
                    <span className="text-sm font-bold text-[#292320] tabular-nums">
                      {analytics.support.resolved}
                    </span>
                  </div>
                </div>

                <div className="mt-3 p-2.5 rounded-lg bg-[#F7F3EC] border border-[#D8CEC1] flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#03543F] animate-pulse" />
                    <span className="font-medium text-[#292320]">All services operational</span>
                  </div>
                  <span className="text-[10px] font-bold text-[#71675E]">99.9% uptime</span>
                </div>
              </div>

              <div className="pt-3 mt-3 border-t border-[#D8CEC1]">
                <Link
                  href="/dashboard/super-admin/monitoring"
                  className="text-xs font-semibold text-[#6B2837] hover:underline inline-flex items-center gap-1"
                >
                  View system diagnostics →
                </Link>
              </div>
            </div>

            {/* Widget 3: Quick Navigation Access */}
            <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg p-5">
              <h2 className="text-sm font-bold text-[#292320]">Platform Quick Access</h2>

              <div className="space-y-1 mt-3">
                <Link
                  href="/dashboard/super-admin/businesses"
                  className="flex items-center justify-between p-2 rounded-md hover:bg-[#F7F3EC] transition-colors text-xs text-[#292320]"
                >
                  <div className="flex items-center gap-2.5">
                    <Building2 className="h-4 w-4 text-[#71675E]" />
                    <span>Review properties directory</span>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-[#71675E]" />
                </Link>

                <Link
                  href="/dashboard/super-admin/modules"
                  className="flex items-center justify-between p-2 rounded-md hover:bg-[#F7F3EC] transition-colors text-xs text-[#292320]"
                >
                  <div className="flex items-center gap-2.5">
                    <Layers className="h-4 w-4 text-[#71675E]" />
                    <span>Feature matrix &amp; overrides</span>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-[#71675E]" />
                </Link>

                <Link
                  href="/dashboard/super-admin/reports"
                  className="flex items-center justify-between p-2 rounded-md hover:bg-[#F7F3EC] transition-colors text-xs text-[#292320]"
                >
                  <div className="flex items-center gap-2.5">
                    <CreditCard className="h-4 w-4 text-[#71675E]" />
                    <span>Financial reports &amp; exports</span>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-[#71675E]" />
                </Link>

                <Link
                  href="/dashboard/super-admin/settings"
                  className="flex items-center justify-between p-2 rounded-md hover:bg-[#F7F3EC] transition-colors text-xs text-[#292320]"
                >
                  <div className="flex items-center gap-2.5">
                    <Settings className="h-4 w-4 text-[#71675E]" />
                    <span>Platform settings &amp; maintenance</span>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-[#71675E]" />
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-2 text-xs text-[#71675E]">
          RestroInn Hospitality OS • Multi-tenant management for hotels &amp; restaurants across Nepal
        </div>
      </div>
    </div>
  );
}
