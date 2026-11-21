"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { RefreshCw, Megaphone, Plus } from "lucide-react";
import { toast } from "@/components/toast";
import { apiClient } from "@/core/api/api-client";

type MetricCardProps = {
  href: string;
  label: string;
  value: React.ReactNode;
  sublabel: string;
  badge?: string;
  badgeTone?: "ready" | "attention" | "urgent" | "info";
};

const BADGE_TONES: Record<NonNullable<MetricCardProps["badgeTone"]>, string> = {
  ready: "bg-[#EAF3EE] text-[#28634B] border-[#C3DED0]",
  attention: "bg-[#FDF5E7] text-[#946000] border-[#EDD7AD]",
  urgent: "bg-[#FAEAEC] text-[#B33432] border-[#E9B6B7]",
  info: "bg-[#EDF4F9] text-[#315F85] border-[#B8D2E6]",
};

function MetricCard({ href, label, value, sublabel, badge, badgeTone = "info" }: MetricCardProps) {
  return (
    <Link
      href={href}
      className="group block rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] p-4 transition-colors duration-100 hover:border-[#6B2837]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B2837]/25"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#71675E]">
          {label}
        </span>
        {badge ? (
          <span
            className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold ${BADGE_TONES[badgeTone]}`}
          >
            {badge}
          </span>
        ) : null}
      </div>
      <div className="mt-2.5 text-2xl font-bold leading-none tracking-tight text-[#292320] tabular-nums group-hover:text-[#6B2837]">
        {value}
      </div>
      <p className="mt-2 truncate text-[11px] text-[#71675E] tabular-nums">{sublabel}</p>
    </Link>
  );
}

type SectionHeaderProps = {
  title: string;
  count?: string;
  href: string;
  linkLabel: string;
  tone?: "default" | "urgent" | "attention";
};

function SectionHeader({ title, count, href, linkLabel, tone = "default" }: SectionHeaderProps) {
  const pillClass =
    tone === "urgent"
      ? "bg-[#FAEAEC] text-[#B33432] border-[#E9B6B7]"
      : tone === "attention"
      ? "bg-[#FDF5E7] text-[#946000] border-[#EDD7AD]"
      : "bg-[#EEE7DD] text-[#292320] border-[#D8CEC1]";

  return (
    <div className="flex min-h-[44px] items-center justify-between gap-3 border-b border-[#D8CEC1] bg-[#EEE7DD]/60 px-4">
      <div className="flex min-w-0 items-center gap-2">
        <h2 className="truncate text-xs font-bold uppercase tracking-wider text-[#292320]">
          {title}
        </h2>
        {count ? (
          <span className={`shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-semibold tabular-nums ${pillClass}`}>
            {count}
          </span>
        ) : null}
      </div>
      <Link
        href={href}
        className="shrink-0 text-[11px] font-semibold text-[#6B2837] transition-colors hover:text-[#541E2A] hover:underline"
      >
        {linkLabel}
      </Link>
    </div>
  );
}

function StatusBadge({ status }: { status?: string }) {
  const normalized = (status || "UNKNOWN").toUpperCase();
  if (normalized === "ACTIVE") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-[#C3DED0] bg-[#EAF3EE] px-2 py-0.5 text-[10px] font-semibold text-[#28634B]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#28634B]" />
        Active
      </span>
    );
  }
  if (normalized === "TRIAL" || normalized === "PENDING") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-[#EDD7AD] bg-[#FDF5E7] px-2 py-0.5 text-[10px] font-semibold text-[#946000]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#946000]" />
        {normalized === "TRIAL" ? "Trial" : "Pending"}
      </span>
    );
  }
  if (["SUSPENDED", "EXPIRED", "CANCELLED", "TERMINATED"].includes(normalized)) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-[#E9B6B7] bg-[#FAEAEC] px-2 py-0.5 text-[10px] font-semibold text-[#B33432]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#B33432]" />
        {normalized.charAt(0) + normalized.slice(1).toLowerCase()}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-md border border-[#D8CEC1] bg-[#EEE7DD] px-2 py-0.5 text-[10px] font-semibold text-[#71675E]">
      {normalized}
    </span>
  );
}

function formatNpr(amount: number) {
  const n = Number(amount || 0);
  if (n <= 0) return "NPR 0";
  if (n >= 10_000_000) return `NPR ${(n / 10_000_000).toFixed(2)}Cr`;
  if (n >= 100_000) return `NPR ${(n / 100_000).toFixed(2)}L`;
  return `NPR ${n.toLocaleString("en-NP")}`;
}

function formatDate(dateStr?: string | Date) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "-";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function formatDateShort(dateStr?: string | Date) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "-";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatPackageType(pkg?: string) {
  const p = (pkg || "").toUpperCase();
  if (p === "BOTH" || p === "HOTEL_RESTAURANT") return "Restaurant & Hotel";
  if (p === "HOTEL") return "Hotel";
  return "Restaurant";
}

function formatPlan(plan?: string) {
  if (!plan) return "Starter";
  return plan.charAt(0).toUpperCase() + plan.slice(1).toLowerCase();
}

function formatActionLabel(action?: string) {
  if (!action) return "Activity logged";
  return action
    .replace(/^SETTING_UPDATED_/, "")
    .split("_")
    .map((word, idx) => (idx === 0 ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : word.toLowerCase()))
    .join(" ");
}

export default function SuperAdminDashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const json = await apiClient.superAdmin.getDashboard();
      setData(json);
      setLastUpdated(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    } catch (err: any) {
      toast.error(err.message || "Failed to load command center data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleApproveRequest = async (requestId: string, businessName: string) => {
    try {
      setApprovingId(requestId);
      await apiClient.superAdmin.approveRequest(requestId, {
        action: "APPROVE",
        reason: "Approved from Command Center",
        adminNotes: "Approved from Command Center",
      });
      toast.success(`"${businessName}" approved and provisioned.`);
      await fetchDashboardData();
    } catch (err: any) {
      toast.error(err.message || "Failed to approve application");
    } finally {
      setApprovingId(null);
    }
  };

  const metrics = data?.overviewMetrics || {
    totalBusinesses: 0,
    activeBusinesses: 0,
    suspendedBusinesses: 0,
    totalUsers: 0,
    totalBranches: 0,
    monthlyRevenue: 0,
    estimatedMrr: 0,
    totalPlatformRevenue: 0,
    totalOutstandingRevenue: 0,
  };

  const queues = data?.attentionQueues || {};
  const analytics = data?.analytics || {};
  const planDistribution: Array<{ name: string; value: number; count: number; color: string }> =
    Array.isArray(analytics.planDistribution) ? analytics.planDistribution : [];
  const monthlyGrowth: Array<{ month: string; businesses: number; revenue: number }> =
    Array.isArray(analytics.monthlyGrowth) ? analytics.monthlyGrowth : [];
  const support = analytics.support || { open: 0, inProgress: 0, waiting: 0, resolved: 0 };

  const actionLists = data?.actionLists || {};
  const urgentRegistrationRequests = Array.isArray(actionLists.urgentRegistrationRequests)
    ? actionLists.urgentRegistrationRequests
    : [];
  const overdueInvoicesList = Array.isArray(actionLists.overdueInvoicesList)
    ? actionLists.overdueInvoicesList
    : [];
  const recentAuditActivity = Array.isArray(actionLists.recentAuditActivity)
    ? actionLists.recentAuditActivity
    : [];
  const recentBusinesses = Array.isArray(actionLists.recentBusinesses)
    ? actionLists.recentBusinesses
    : [];

  const pendingCount = Number(queues.pendingApprovals?.count ?? 0);
  const overdueCount = Number(queues.overdueSubscriptions?.count ?? 0);
  const expiringCount = Number(queues.expiringWithin30Days?.count ?? 0);
  const suspendedCount = Number(queues.suspendedAccounts?.count ?? 0);
  const backupStatus: string = queues.backupFreshness?.status || "CRITICAL";
  const openSupportTotal = Number(support.open || 0) + Number(support.inProgress || 0);
  const maxMonthlyRev = Math.max(1, ...monthlyGrowth.map((m) => m.revenue));

  const isInitialLoad = loading && !data;

  return (
    <main className="min-h-full w-full bg-[#F7F3EC] text-[#292320]">
      <div className="mx-auto w-full max-w-[1600px] space-y-4 pb-8">
        {/* Header */}
        <header className="flex flex-col gap-3 border-b border-[#D8CEC1] pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#71675E]">
              Platform Operations {lastUpdated ? `• Synced ${lastUpdated}` : ""}
            </p>
            <h1 className="mt-1 text-xl font-bold tracking-tight text-[#292320]">
              Command Center
            </h1>
            <p className="mt-0.5 text-xs text-[#71675E]">
              Live tenant portfolio, billing health, verification queues, and platform audit stream.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={fetchDashboardData}
              disabled={loading}
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] px-3 text-xs font-semibold text-[#292320] transition-colors duration-100 hover:bg-[#EEE7DD] disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              {loading ? "Syncing" : "Refresh"}
            </button>
            <Link
              href="/dashboard/super-admin/notices/create"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] px-3 text-xs font-semibold text-[#292320] transition-colors duration-100 hover:bg-[#EEE7DD]"
            >
              <Megaphone className="h-3.5 w-3.5 text-[#71675E]" />
              Broadcast notice
            </Link>
            <Link
              href="/dashboard/super-admin/onboarding/register"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#6B2837] px-3.5 text-xs font-semibold text-[#FFFCF7] transition-colors duration-100 hover:bg-[#541E2A]"
            >
              <Plus className="h-3.5 w-3.5" />
              Register business
            </Link>
          </div>
        </header>

        {/* Attention Strip */}
        <section
          aria-label="Operational health summary"
          className="flex flex-wrap items-center gap-2 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] px-3.5 py-2.5 text-xs"
        >
          <span className="mr-1 text-[10px] font-bold uppercase tracking-wider text-[#71675E]">
            Live Signals
          </span>
          <Link
            href="/dashboard/super-admin/businesses/expiring"
            className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-semibold tabular-nums transition-colors ${
              expiringCount > 0 ? BADGE_TONES.attention : BADGE_TONES.ready
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${expiringCount > 0 ? "bg-[#946000]" : "bg-[#28634B]"}`} />
            Expiring (30d): {expiringCount}
          </Link>
          <Link
            href="/dashboard/super-admin/businesses"
            className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-semibold tabular-nums transition-colors ${
              suspendedCount > 0 ? BADGE_TONES.urgent : BADGE_TONES.ready
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${suspendedCount > 0 ? "bg-[#B33432]" : "bg-[#28634B]"}`} />
            Suspended: {suspendedCount}
          </Link>
          <Link
            href="/dashboard/super-admin/support"
            className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-semibold tabular-nums transition-colors ${
              openSupportTotal > 0 ? BADGE_TONES.info : BADGE_TONES.ready
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${openSupportTotal > 0 ? "bg-[#315F85]" : "bg-[#28634B]"}`} />
            Active Tickets: {openSupportTotal}
          </Link>
          <Link
            href="/dashboard/super-admin/monitoring"
            className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
              backupStatus === "HEALTHY"
                ? BADGE_TONES.ready
                : backupStatus === "WARNING"
                ? BADGE_TONES.attention
                : BADGE_TONES.urgent
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                backupStatus === "HEALTHY"
                  ? "bg-[#28634B]"
                  : backupStatus === "WARNING"
                  ? "bg-[#946000]"
                  : "bg-[#B33432]"
              }`}
            />
            Backups: {backupStatus === "HEALTHY" ? "Verified" : backupStatus === "WARNING" ? "Needs Check" : "No Backup"}
          </Link>
        </section>

        {/* Primary KPI Row */}
        {isInitialLoad ? (
          <section aria-label="Loading metrics" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] p-4 space-y-3">
                <div className="h-3 w-28 animate-pulse rounded bg-[#EEE7DD]" />
                <div className="h-7 w-24 animate-pulse rounded bg-[#EEE7DD]" />
                <div className="h-3 w-40 animate-pulse rounded bg-[#EEE7DD]" />
              </div>
            ))}
          </section>
        ) : (
          <section aria-label="Platform metrics" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              href="/dashboard/super-admin/businesses"
              label="Active Tenants"
              value={metrics.activeBusinesses}
              sublabel={`${metrics.totalBusinesses} total • ${metrics.totalBranches} branches • ${metrics.totalUsers} staff`}
              badge={metrics.activeBusinesses === metrics.totalBusinesses ? "All Healthy" : `${metrics.suspendedBusinesses} Suspended`}
              badgeTone={metrics.suspendedBusinesses > 0 ? "urgent" : "ready"}
            />
            <MetricCard
              href="/dashboard/super-admin/revenue"
              label="This Month Collected"
              value={formatNpr(metrics.monthlyRevenue)}
              sublabel={`All-time: ${formatNpr(metrics.totalPlatformRevenue)} • Est. MRR: ${formatNpr(metrics.estimatedMrr)}`}
              badge="Live Ledger"
              badgeTone="info"
            />
            <MetricCard
              href="/dashboard/super-admin/businesses/pending"
              label="Pending Approvals"
              value={pendingCount}
              sublabel={pendingCount > 0 ? "Applications awaiting verification" : "Verification queue is clear"}
              badge={pendingCount > 0 ? "Needs Review" : "Clear"}
              badgeTone={pendingCount > 0 ? "attention" : "ready"}
            />
            <MetricCard
              href="/dashboard/super-admin/revenue"
              label="Overdue Invoices"
              value={overdueCount}
              sublabel={`Outstanding balance: ${formatNpr(metrics.totalOutstandingRevenue)}`}
              badge={overdueCount > 0 ? "Action Due" : "Up to Date"}
              badgeTone={overdueCount > 0 ? "urgent" : "ready"}
            />
          </section>
        )}

        {/* Analytics Row: 6-Month Real Trend + Plan & Support Breakdown */}
        <section aria-label="Platform analytics" className="grid grid-cols-1 gap-3 xl:grid-cols-12">
          <div className="overflow-hidden rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] xl:col-span-7">
            <SectionHeader
              title="6-Month Revenue & Tenant Growth"
              count={`Est. MRR ${formatNpr(metrics.estimatedMrr)}`}
              href="/dashboard/super-admin/reports"
              linkLabel="Open reports"
            />
            <div className="p-4">
              {isInitialLoad ? (
                <div className="h-36 animate-pulse rounded-md bg-[#EEE7DD]" />
              ) : (
                <div className="grid grid-cols-6 gap-2.5 items-end h-36 pt-4">
                  {monthlyGrowth.map((pt) => {
                    const heightPct = pt.revenue > 0 ? Math.max(14, Math.round((pt.revenue / maxMonthlyRev) * 100)) : 6;
                    return (
                      <div key={pt.month} className="flex h-full flex-col items-center justify-end gap-1.5">
                        <span className="text-[10px] font-semibold text-[#71675E] tabular-nums">
                          {pt.revenue > 0 ? formatNpr(pt.revenue).replace("NPR ", "") : "0"}
                        </span>
                        <div className="flex w-full flex-1 items-end">
                          <div
                            className={`w-full rounded-t-md border transition-colors ${
                              pt.revenue > 0
                                ? "border-[#6B2837] bg-[#6B2837]"
                                : "border-[#D8CEC1] bg-[#EEE7DD]"
                            }`}
                            style={{ height: `${heightPct}%` }}
                            title={`${pt.month}: ${formatNpr(pt.revenue)} collected • ${pt.businesses} tenants`}
                          />
                        </div>
                        <div className="text-center">
                          <div className="text-[10px] font-semibold text-[#292320]">{pt.month}</div>
                          <div className="text-[9px] text-[#71675E] tabular-nums">
                            {pt.businesses} {pt.businesses === 1 ? "tenant" : "tenants"}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] xl:col-span-5">
            <SectionHeader
              title="Plan Mix & Support Desk"
              count={`${metrics.totalBusinesses} tenants`}
              href="/dashboard/super-admin/subscriptions"
              linkLabel="Manage plans"
            />
            <div className="space-y-4 p-4">
              <div className="space-y-2.5">
                {planDistribution.map((plan) => (
                  <div key={plan.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[#292320]">{plan.name}</span>
                      <span className="text-[#71675E] tabular-nums">
                        {plan.count} ({plan.value}%)
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-md bg-[#EEE7DD]">
                      <div
                        className="h-full rounded-md"
                        style={{ width: `${plan.value}%`, backgroundColor: plan.color }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-4 gap-2 border-t border-[#D8CEC1] pt-3 text-center">
                <div className="rounded-md border border-[#D8CEC1] bg-[#F7F3EC] py-2">
                  <div className="text-[10px] font-semibold uppercase text-[#71675E]">Open</div>
                  <div className="mt-0.5 text-sm font-bold text-[#292320] tabular-nums">{support.open}</div>
                </div>
                <div className="rounded-md border border-[#D8CEC1] bg-[#F7F3EC] py-2">
                  <div className="text-[10px] font-semibold uppercase text-[#71675E]">Active</div>
                  <div className="mt-0.5 text-sm font-bold text-[#315F85] tabular-nums">{support.inProgress}</div>
                </div>
                <div className="rounded-md border border-[#D8CEC1] bg-[#F7F3EC] py-2">
                  <div className="text-[10px] font-semibold uppercase text-[#71675E]">Waiting</div>
                  <div className="mt-0.5 text-sm font-bold text-[#946000] tabular-nums">{support.waiting}</div>
                </div>
                <div className="rounded-md border border-[#D8CEC1] bg-[#F7F3EC] py-2">
                  <div className="text-[10px] font-semibold uppercase text-[#71675E]">Resolved</div>
                  <div className="mt-0.5 text-sm font-bold text-[#28634B] tabular-nums">{support.resolved}</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Operational Queues */}
        <section aria-label="Operational queues" className="grid grid-cols-1 gap-3 xl:grid-cols-12">
          <div className="min-w-0 overflow-hidden rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] xl:col-span-7">
            <SectionHeader
              title="Verification Queue"
              count={`${pendingCount} pending`}
              href="/dashboard/super-admin/businesses/pending"
              linkLabel="View applications"
              tone={pendingCount > 0 ? "attention" : "default"}
            />

            {isInitialLoad ? (
              <div className="space-y-2 p-4">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-9 animate-pulse rounded bg-[#EEE7DD]" />
                ))}
              </div>
            ) : urgentRegistrationRequests.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-xs font-semibold text-[#292320]">No pending applications</p>
                <p className="mt-1 text-[11px] text-[#71675E]">
                  New business registrations awaiting verification will appear here.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse text-left text-xs">
                  <thead className="border-b border-[#D8CEC1] bg-[#EEE7DD] text-[10px] font-semibold uppercase tracking-wider text-[#292320]">
                    <tr>
                      <th className="px-3.5 py-2.5">Business</th>
                      <th className="px-3 py-2.5">Plan &amp; Type</th>
                      <th className="px-3 py-2.5">Applicant</th>
                      <th className="px-3 py-2.5">Submitted</th>
                      <th className="px-3.5 py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D8CEC1]/60">
                    {urgentRegistrationRequests.map((req: any) => {
                      const isApproving = approvingId === req.id;
                      return (
                        <tr key={req.id} className="transition-colors hover:bg-[#F7F3EC]">
                          <td className="px-3.5 py-2.5">
                            <div className="font-semibold text-[#292320]">{req.businessName}</div>
                            <div className="font-mono text-[10px] text-[#71675E]">{req.trackingCode}</div>
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="font-medium text-[#292320]">{formatPlan(req.plan)}</div>
                            <div className="text-[10px] text-[#71675E]">{formatPackageType(req.businessType)}</div>
                          </td>
                          <td className="max-w-[180px] px-3 py-2.5">
                            <div className="truncate font-medium text-[#292320]">{req.ownerName || "-"}</div>
                            <div className="truncate text-[10px] text-[#71675E]">{req.ownerEmail || "-"}</div>
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-[#71675E]">
                            {formatDate(req.createdAt)}
                          </td>
                          <td className="whitespace-nowrap px-3.5 py-2.5 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <Link
                                href={`/dashboard/super-admin/businesses/pending?inspect=${req.id}`}
                                className="inline-flex h-7 items-center rounded-md border border-[#D8CEC1] bg-[#FFFCF7] px-2.5 text-[11px] font-semibold text-[#292320] transition-colors hover:bg-[#EEE7DD]"
                              >
                                Inspect
                              </Link>
                              <button
                                type="button"
                                onClick={() => handleApproveRequest(req.id, req.businessName)}
                                disabled={isApproving}
                                className="inline-flex h-7 cursor-pointer items-center rounded-md bg-[#6B2837] px-2.5 text-[11px] font-semibold text-[#FFFCF7] transition-colors hover:bg-[#541E2A] disabled:opacity-50"
                              >
                                {isApproving ? "Approving" : "Approve"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="min-w-0 overflow-hidden rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] xl:col-span-5">
            <SectionHeader
              title="Overdue Subscriptions"
              count={`${overdueCount} overdue`}
              href="/dashboard/super-admin/revenue"
              linkLabel="Billing center"
              tone={overdueCount > 0 ? "urgent" : "default"}
            />

            {isInitialLoad ? (
              <div className="space-y-2 p-4">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-9 animate-pulse rounded bg-[#EEE7DD]" />
                ))}
              </div>
            ) : overdueInvoicesList.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-xs font-semibold text-[#292320]">No overdue invoices</p>
                <p className="mt-1 text-[11px] text-[#71675E]">
                  All tenant subscription accounts are current.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] border-collapse text-left text-xs">
                  <thead className="border-b border-[#D8CEC1] bg-[#EEE7DD] text-[10px] font-semibold uppercase tracking-wider text-[#292320]">
                    <tr>
                      <th className="px-3.5 py-2.5">Business</th>
                      <th className="px-3 py-2.5">Invoice</th>
                      <th className="px-3 py-2.5 text-right">Amount</th>
                      <th className="px-3 py-2.5">Due</th>
                      <th className="px-3.5 py-2.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D8CEC1]/60">
                    {overdueInvoicesList.map((inv: any) => (
                      <tr key={inv.id} className="transition-colors hover:bg-[#F7F3EC]">
                        <td className="px-3.5 py-2.5 font-semibold text-[#292320]">
                          {inv.business?.name || "Unknown business"}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 font-mono text-[10px] text-[#71675E]">
                          {inv.invoiceNumber || "-"}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-right font-semibold tabular-nums text-[#B33432]">
                          {formatNpr(Number(inv.amount || 0))}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-[#71675E]">
                          {formatDate(inv.dueDate)}
                        </td>
                        <td className="whitespace-nowrap px-3.5 py-2.5 text-right">
                          <Link
                            href="/dashboard/super-admin/revenue"
                            className="inline-flex h-7 items-center rounded-md bg-[#6B2837] px-2.5 text-[11px] font-semibold text-[#FFFCF7] transition-colors hover:bg-[#541E2A]"
                          >
                            Settle
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* Tenant Directory & Recent Activity */}
        <section aria-label="Tenant directory and recent activity" className="grid grid-cols-1 gap-3 2xl:grid-cols-12">
          <div className="min-w-0 overflow-hidden rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] 2xl:col-span-8">
            <SectionHeader
              title="Registered Properties"
              count={`${recentBusinesses.length} shown`}
              href="/dashboard/super-admin/businesses"
              linkLabel={`View directory (${metrics.totalBusinesses})`}
            />

            {isInitialLoad ? (
              <div className="space-y-2 p-4">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-10 animate-pulse rounded bg-[#EEE7DD]" />
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse text-left text-xs">
                  <thead className="border-b border-[#D8CEC1] bg-[#EEE7DD] text-[10px] font-semibold uppercase tracking-wider text-[#292320]">
                    <tr>
                      <th className="px-3.5 py-2.5">Business / Property</th>
                      <th className="px-3 py-2.5">Package</th>
                      <th className="px-3 py-2.5">Owner</th>
                      <th className="px-3 py-2.5 text-center">Footprint</th>
                      <th className="px-3 py-2.5">Plan</th>
                      <th className="px-3 py-2.5">Status</th>
                      <th className="px-3.5 py-2.5 text-right">Provisioned</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D8CEC1]/60">
                    {recentBusinesses.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-xs text-[#71675E]">
                          No registered properties found.
                        </td>
                      </tr>
                    ) : (
                      recentBusinesses.map((business: any) => (
                        <tr key={business.id} className="transition-colors hover:bg-[#F7F3EC]">
                          <td className="px-3.5 py-2.5">
                            <Link
                              href={`/dashboard/super-admin/businesses/${business.id}`}
                              className="font-semibold text-[#292320] hover:text-[#6B2837] hover:underline"
                            >
                              {business.name}
                            </Link>
                            <span className="ml-1.5 font-mono text-[10px] text-[#71675E]">
                              /{business.slug}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-[#292320]">
                            {formatPackageType(business.packageType)}
                          </td>
                          <td className="max-w-[150px] truncate px-3 py-2.5 text-[#292320]">
                            {business.ownerName || "-"}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-center tabular-nums text-[#71675E]">
                            {business.branchesCount ?? 0} br • {business.usersCount ?? 0} staff
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 font-semibold text-[#6B2837]">
                            {formatPlan(business.plan)}
                          </td>
                          <td className="px-3 py-2.5">
                            <StatusBadge status={business.status} />
                          </td>
                          <td className="whitespace-nowrap px-3.5 py-2.5 text-right tabular-nums text-[#71675E]">
                            {formatDate(business.createdAt)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="min-w-0 overflow-hidden rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] 2xl:col-span-4">
            <SectionHeader
              title="Recent Activity"
              count={`${Math.min(recentAuditActivity.length, 6)} events`}
              href="/dashboard/super-admin/activity-logs"
              linkLabel="Audit log"
            />

            {isInitialLoad ? (
              <div className="space-y-2 p-4">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-10 animate-pulse rounded bg-[#EEE7DD]" />
                ))}
              </div>
            ) : recentAuditActivity.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-[#71675E]">
                No platform audit activity logged yet.
              </div>
            ) : (
              <div className="divide-y divide-[#D8CEC1]/60">
                {recentAuditActivity.slice(0, 6).map((log: any) => (
                  <div
                    key={log.id}
                    className="flex min-h-[50px] items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-[#F7F3EC]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-[#292320]">
                        {formatActionLabel(log.action)}
                      </p>
                      <p className="mt-0.5 truncate text-[10px] text-[#71675E]">
                        {log.business?.name || "Global platform"}
                        {log.actor?.name ? ` • ${log.actor.name}` : ""}
                      </p>
                    </div>
                    <time className="shrink-0 whitespace-nowrap text-[10px] tabular-nums text-[#71675E]">
                      {formatDateShort(log.createdAt)}
                    </time>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
