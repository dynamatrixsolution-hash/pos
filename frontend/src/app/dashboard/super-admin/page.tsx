"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { toast } from "@/components/toast";

function RefreshIcon({ spinning = false }: { spinning?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      className={`h-3.5 w-3.5 ${spinning ? "animate-spin" : ""}`}
    >
      <path
        d="M16.3 8A6.5 6.5 0 0 0 4.8 5.6L3.5 7M3.5 7V3.9M3.5 7h3.1M3.7 12A6.5 6.5 0 0 0 15.2 14.4l1.3-1.4m0 0v3.1m0-3.1h-3.1"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BroadcastIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5">
      <path
        d="M7.2 7.1a4.1 4.1 0 0 0 0 5.8m5.6-5.8a4.1 4.1 0 0 1 0 5.8M4.5 4.4a7.9 7.9 0 0 0 0 11.2m11-11.2a7.9 7.9 0 0 1 0 11.2M10 8.4v3.2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="10" cy="13.9" r=".8" fill="currentColor" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5">
      <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

type MetricCardProps = {
  href: string;
  label: string;
  value: React.ReactNode;
  actionLabel?: string;
  tone?: "default" | "danger";
};

function MetricCard({ href, label, value, actionLabel, tone = "default" }: MetricCardProps) {
  return (
    <Link
      href={href}
      className="group min-h-[82px] rounded-md border border-[#E4E1DD] bg-white px-4 py-3 transition-colors hover:border-[#C9B5BA] hover:bg-[#FFFEFE] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7B263A]/20"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.075em] text-[#77736F]">
          {label}
        </span>
        {actionLabel ? (
          <span
            className={`rounded-sm px-1.5 py-0.5 text-[10px] font-semibold ${
              tone === "danger" ? "bg-[#FEF0EF] text-[#B42318]" : "bg-[#FFF5DF] text-[#96610A]"
            }`}
          >
            {actionLabel}
          </span>
        ) : null}
      </div>
      <div className="mt-2 text-[23px] font-semibold leading-none tracking-tight text-[#201D1B] tabular-nums group-hover:text-[#7B263A]">
        {value}
      </div>
    </Link>
  );
}

type SectionHeaderProps = {
  title: string;
  count?: React.ReactNode;
  href: string;
  linkLabel: string;
  danger?: boolean;
};

function SectionHeader({ title, count, href, linkLabel, danger = false }: SectionHeaderProps) {
  return (
    <div className="flex min-h-[43px] items-center justify-between gap-3 border-b border-[#ECE9E6] px-4">
      <div className="flex min-w-0 items-center gap-2">
        <h2 className="truncate text-[13px] font-semibold text-[#292522]">{title}</h2>
        {count ? (
          <span
            className={`shrink-0 rounded-sm px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${
              danger ? "bg-[#FEF0EF] text-[#B42318]" : "bg-[#F3F1EF] text-[#68635F]"
            }`}
          >
            {count}
          </span>
        ) : null}
      </div>
      <Link
        href={href}
        className="shrink-0 text-[11px] font-medium text-[#7B263A] transition-colors hover:text-[#551827] focus-visible:outline-none focus-visible:underline"
      >
        {linkLabel} <span aria-hidden="true">→</span>
      </Link>
    </div>
  );
}

export default function SuperAdminDashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [approvingId, setApprovingId] = useState<string | null>(null);

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
      toast.error(err.message || "Failed to load command center data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Keep the existing direct approval workflow and API contract.
  const handleApproveRequest = async (requestId: string, businessName: string) => {
    try {
      setApprovingId(requestId);
      const res = await fetch(`/api/v1/super-admin/requests/${requestId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "APPROVE",
          reason: "Approved from Command Center",
          adminNotes: "Approved from Command Center",
        }),
      });
      const resJson = await res.json();
      if (!res.ok) {
        throw new Error(resJson.error || "Failed to approve application");
      }
      toast.success(`"${businessName}" successfully approved and provisioned.`);
      await fetchDashboardData();
    } catch (err: any) {
      toast.error(err.message || "Failed to approve application");
    } finally {
      setApprovingId(null);
    }
  };

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
  };

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

  const pendingCount = Number(attentionQueues.pendingApprovals?.count ?? 0);
  const overdueCount = Number(attentionQueues.overdueSubscriptions?.count ?? 0);

  const formatRevenueK = (num: number) => {
    if (!num || num <= 0) return "NPR 0";
    if (num >= 10000000) return `NPR ${(num / 10000000).toFixed(1)}Cr`;
    if (num >= 100000) return `NPR ${(num / 100000).toFixed(1)}L`;
    if (num >= 1000) return `NPR ${(num / 1000).toFixed(0)}K`;
    return `NPR ${num.toLocaleString()}`;
  };

  const formatDate = (dateStr: string | Date | undefined) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "-";
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const formatDateShort = (dateStr: string | Date | undefined) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "-";
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    return `${day}/${month}`;
  };

  const formatBusinessType = (type?: string) => {
    if (!type) return "Restaurant";
    if (type === "HOTEL_RESTAURANT" || type === "BOTH") return "Both";
    if (type === "HOTEL") return "Hotel";
    return "Restaurant";
  };

  const formatPackageType = (pkg?: string) => {
    if (!pkg) return "Restaurant";
    if (pkg === "BOTH" || pkg === "HOTEL_RESTAURANT") return "Both";
    if (pkg === "HOTEL") return "Hotel";
    return "Restaurant";
  };

  const formatPlan = (plan?: string) => {
    if (!plan) return "Starter";
    return plan.charAt(0).toUpperCase() + plan.slice(1).toLowerCase();
  };

  const formatActionLabel = (action?: string) => {
    if (!action) return "Activity logged";
    const map: Record<string, string> = {
      SUPPORT_TICKET_UPDATED: "Support ticket updated",
      SUPPORT_TICKET_UPDATE: "Support ticket updated",
      SETTING_UPDATED_GENERAL_CONFIG: "General config updated",
      PLATFORM_SETTING_UPDATED: "General config updated",
      NOTICE_CREATED: "Notice created",
      NOTICE_CREATE: "Notice created",
      BUSINESS_APPROVED: "Business approved",
      BUSINESS_APPROVE: "Business approved",
      BUSINESS_CREATED: "Business registered",
      BUSINESS_CREATE: "Business registered",
    };
    if (map[action]) return map[action];
    return action
      .replace(/^SETTING_UPDATED_/, "")
      .split("_")
      .map((word, index) =>
        index === 0 ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : word.toLowerCase(),
      )
      .join(" ");
  };

  const formatTargetName = (log: any) => {
    if (!log.business?.name) return "Global platform";
    const name = log.business.name;
    if (name.includes("RestroInn Grand Hotel")) return "RestroInn Grand Hotel";
    return name;
  };

  return (
    <main
      className="min-h-full w-full bg-[#F7F7F5] text-[#24211F]"
      style={{
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", Helvetica, Arial, sans-serif',
      }}
    >
      <div className="mx-auto w-full max-w-[1600px] space-y-4">
        {/* Page heading */}
        <header className="space-y-2">
          <div className="flex items-center gap-2 text-[11px] leading-none text-[#85807B]">
            <span>Platform</span>
            <span aria-hidden="true" className="text-[#B6B1AC]">/</span>
            <span className="font-medium text-[#514B47]">Command Center</span>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-[23px] font-semibold leading-tight tracking-[-0.035em] text-[#201D1B]">
                Command Center
              </h1>
              <p className="mt-1 text-[12px] text-[#77716C]">
                Platform operations, verification queues and tenant activity.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={fetchDashboardData}
                disabled={loading}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#DEDAD6] bg-white px-3 text-[11px] font-medium text-[#393430] transition-colors hover:border-[#C9C1BB] hover:bg-[#FAF9F8] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7B263A]/20"
              >
                <RefreshIcon spinning={loading} />
                {loading ? "Refreshing" : "Refresh"}
              </button>
              <Link
                href="/dashboard/super-admin/notices/create"
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#DEDAD6] bg-white px-3 text-[11px] font-medium text-[#393430] transition-colors hover:border-[#C9C1BB] hover:bg-[#FAF9F8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7B263A]/20"
              >
                <BroadcastIcon />
                Broadcast notice
              </Link>
              <Link
                href="/dashboard/super-admin/onboarding/register"
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#76283D] bg-[#7B263A] px-3 text-[11px] font-semibold text-white transition-colors hover:border-[#5C1D2D] hover:bg-[#652033] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7B263A]/30"
              >
                <PlusIcon />
                Register business
              </Link>
            </div>
          </div>
        </header>

        {/* Platform metrics */}
        <section aria-label="Platform metrics" className="grid grid-cols-2 gap-2.5 xl:grid-cols-4">
          <MetricCard
            href="/dashboard/super-admin/businesses/pending"
            label="Pending approvals"
            value={pendingCount}
            actionLabel={pendingCount > 0 ? "Needs review" : undefined}
            tone="danger"
          />
          <MetricCard
            href="/dashboard/super-admin/revenue"
            label="Overdue invoices"
            value={overdueCount}
            actionLabel={overdueCount > 0 ? "Payment due" : undefined}
            tone="danger"
          />
          <MetricCard
            href="/dashboard/super-admin/businesses"
            label="Active tenants"
            value={overviewMetrics.activeBusinesses ?? 0}
          />
          <MetricCard
            href="/dashboard/super-admin/revenue"
            label="Monthly revenue"
            value={formatRevenueK(Number(overviewMetrics.totalPlatformRevenue ?? 0))}
          />
        </section>

        {/* Operational queues */}
        <section aria-label="Operational queues" className="grid grid-cols-1 gap-3 xl:grid-cols-12">
          <div className="min-w-0 overflow-hidden rounded-md border border-[#E4E1DD] bg-white xl:col-span-7">
            <SectionHeader
              title="Verification queue"
              count={`${pendingCount} pending`}
              href="/dashboard/super-admin/businesses/pending"
              linkLabel="View applications"
            />

            {urgentRegistrationRequests.length === 0 ? (
              <div className="px-4 py-7 text-center">
                <p className="text-[12px] font-medium text-[#514B47]">
                  {loading ? "Loading applications…" : "No pending applications"}
                </p>
                {!loading ? (
                  <p className="mt-1 text-[11px] text-[#89837D]">New business registrations will appear here.</p>
                ) : null}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[650px] border-collapse text-left text-[11px]">
                  <thead className="bg-[#FAF9F8] text-[#77716C]">
                    <tr className="border-b border-[#ECE9E6]">
                      <th className="px-3.5 py-2 font-medium">Business / Property</th>
                      <th className="px-3 py-2 font-medium">Type &amp; plan</th>
                      <th className="px-3 py-2 font-medium">Applicant</th>
                      <th className="px-3 py-2 font-medium">Submitted</th>
                      <th className="px-3.5 py-2 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F0EEEB]">
                    {urgentRegistrationRequests.map((req: any) => {
                      const isApproving = approvingId === req.id;
                      return (
                        <tr key={req.id} className="transition-colors hover:bg-[#FCFAFA]">
                          <td className="px-3.5 py-2.5">
                            <div className="font-semibold text-[#292522]">{req.businessName}</div>
                            <div className="mt-0.5 font-mono text-[10px] text-[#89837D]">
                              {req.trackingCode}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-[#514B47]">
                            <div className="font-medium">{formatPlan(req.plan)}</div>
                            <div className="mt-0.5 text-[10px] text-[#89837D]">
                              {formatBusinessType(req.businessType)}
                            </div>
                          </td>
                          <td className="max-w-[190px] px-3 py-2.5">
                            <div className="truncate font-medium text-[#393430]">{req.ownerName || "-"}</div>
                            <div className="mt-0.5 truncate text-[10px] text-[#89837D]">{req.ownerEmail || "-"}</div>
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-[#625C57]">
                            {formatDate(req.createdAt)}
                          </td>
                          <td className="whitespace-nowrap px-3.5 py-2.5 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <Link
                                href={`/dashboard/super-admin/businesses/pending?inspect=${req.id}`}
                                className="inline-flex h-7 items-center rounded border border-[#DEDAD6] bg-white px-2.5 text-[10px] font-medium text-[#393430] transition-colors hover:bg-[#F7F6F4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7B263A]/20"
                              >
                                Inspect
                              </Link>
                              <button
                                type="button"
                                onClick={() => handleApproveRequest(req.id, req.businessName)}
                                disabled={isApproving}
                                className="inline-flex h-7 items-center rounded border border-[#76283D] bg-[#7B263A] px-2.5 text-[10px] font-semibold text-white transition-colors hover:bg-[#652033] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7B263A]/30"
                              >
                                {isApproving ? "Approving…" : "Approve"}
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

          <div className="min-w-0 overflow-hidden rounded-md border border-[#E4E1DD] bg-white xl:col-span-5">
            <SectionHeader
              title="Overdue subscriptions"
              count={`${overdueCount} overdue`}
              href="/dashboard/super-admin/revenue"
              linkLabel="Billing center"
              danger={overdueCount > 0}
            />

            {overdueInvoicesList.length === 0 ? (
              <div className="px-4 py-7 text-center">
                <p className="text-[12px] font-medium text-[#514B47]">
                  {loading ? "Loading invoices…" : "No overdue invoices"}
                </p>
                {!loading ? (
                  <p className="mt-1 text-[11px] text-[#89837D]">There are no outstanding overdue subscriptions.</p>
                ) : null}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[540px] border-collapse text-left text-[11px]">
                  <thead className="bg-[#FAF9F8] text-[#77716C]">
                    <tr className="border-b border-[#ECE9E6]">
                      <th className="px-3.5 py-2 font-medium">Business</th>
                      <th className="px-3 py-2 font-medium">Invoice</th>
                      <th className="px-3 py-2 font-medium">Amount</th>
                      <th className="px-3 py-2 font-medium">Due date</th>
                      <th className="px-3.5 py-2 text-right font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F0EEEB]">
                    {overdueInvoicesList.map((inv: any) => (
                      <tr key={inv.id} className="transition-colors hover:bg-[#FCFAFA]">
                        <td className="px-3.5 py-2.5 font-semibold text-[#292522]">
                          {inv.business?.name || "Unknown business"}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 font-mono text-[10px] text-[#77716C]">
                          {inv.invoiceNumber || "-"}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 font-semibold tabular-nums text-[#B42318]">
                          NPR {Number(inv.amount || 0).toLocaleString("en-NP")}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-[#514B47]">
                          {formatDate(inv.dueDate)}
                        </td>
                        <td className="whitespace-nowrap px-3.5 py-2.5 text-right">
                          <Link
                            href="/dashboard/super-admin/revenue"
                            className="inline-flex h-7 items-center rounded border border-[#76283D] bg-[#7B263A] px-2.5 text-[10px] font-semibold text-white transition-colors hover:bg-[#652033] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7B263A]/30"
                          >
                            Record settlement
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

        {/* Tenant directory and audit activity */}
        <section aria-label="Tenant directory and recent activity" className="grid grid-cols-1 gap-3 2xl:grid-cols-12">
          <div className="min-w-0 overflow-hidden rounded-md border border-[#E4E1DD] bg-white 2xl:col-span-8">
            <SectionHeader
              title="Registered properties"
              count={`${recentBusinesses.length} recent`}
              href="/dashboard/super-admin/businesses"
              linkLabel={`View directory (${overviewMetrics.totalBusinesses ?? 0})`}
            />

            <div className="overflow-x-auto">
              <table className="w-full min-w-[790px] border-collapse text-left text-[11px]">
                <thead className="bg-[#FAF9F8] text-[#77716C]">
                  <tr className="border-b border-[#ECE9E6]">
                    <th className="px-3.5 py-2 font-medium">Business / Property</th>
                    <th className="px-3 py-2 font-medium">Type</th>
                    <th className="px-3 py-2 font-medium">Owner</th>
                    <th className="px-3 py-2 font-medium">Plan</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3.5 py-2 font-medium">Provisioned</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0EEEB]">
                  {recentBusinesses.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3.5 py-8 text-center text-[11px] text-[#89837D]">
                        {loading ? "Loading registered properties…" : "No properties found."}
                      </td>
                    </tr>
                  ) : (
                    recentBusinesses.map((business: any) => (
                      <tr key={business.id} className="transition-colors hover:bg-[#FCFAFA]">
                        <td className="px-3.5 py-2.5">
                          <Link
                            href={`/dashboard/super-admin/businesses/${business.id}`}
                            className="font-semibold text-[#292522] transition-colors hover:text-[#7B263A] focus-visible:outline-none focus-visible:underline"
                          >
                            {business.name}
                          </Link>
                          <span className="ml-1.5 font-mono text-[10px] text-[#99928C]">
                            /{business.slug}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-[#514B47]">
                          {formatPackageType(business.packageType)}
                        </td>
                        <td className="max-w-[150px] truncate px-3 py-2.5 text-[#514B47]">
                          {business.ownerName || "-"}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-[#514B47]">
                          {formatPlan(business.plan)}
                        </td>
                        <td className="px-3 py-2.5">
                          <span
                            className={`inline-flex items-center rounded-sm px-1.5 py-0.5 text-[10px] font-semibold ${
                              business.status === "ACTIVE"
                                ? "bg-[#EAF7F0] text-[#067647]"
                                : "bg-[#F3F1EF] text-[#68635F]"
                            }`}
                          >
                            {business.status === "ACTIVE" ? "Active" : business.status || "Unknown"}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3.5 py-2.5 tabular-nums text-[#625C57]">
                          {formatDate(business.createdAt)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="min-w-0 overflow-hidden rounded-md border border-[#E4E1DD] bg-white 2xl:col-span-4">
            <SectionHeader
              title="Recent activity"
              count={`${Math.min(recentAuditActivity.length, 6)} events`}
              href="/dashboard/super-admin/activity-logs"
              linkLabel="Audit log"
            />

            <div className="divide-y divide-[#F0EEEB]">
              {recentAuditActivity.length === 0 ? (
                <div className="px-4 py-8 text-center text-[11px] text-[#89837D]">
                  {loading ? "Loading recent activity…" : "No recent activity logged."}
                </div>
              ) : (
                recentAuditActivity.slice(0, 6).map((log: any) => (
                  <div
                    key={log.id}
                    className="flex min-h-[49px] items-center justify-between gap-3 px-4 py-2 transition-colors hover:bg-[#FCFAFA]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[11px] font-medium text-[#393430]">
                        {formatActionLabel(log.action)}
                      </p>
                      <p className="mt-0.5 truncate text-[10px] text-[#89837D]">
                        {formatTargetName(log)}
                      </p>
                    </div>
                    <time className="shrink-0 whitespace-nowrap text-[10px] tabular-nums text-[#89837D]">
                      {formatDateShort(log.createdAt)}
                    </time>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
