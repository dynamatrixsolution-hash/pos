"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Clock,
  Search,
  RefreshCw,
  Bell,
  Calendar,
  AlertTriangle,
  ShieldAlert,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  X,
  Check,
} from "lucide-react";
import ExportDropdown from "@/components/export-dropdown";
import { ExportOptions } from "@/lib/export-service";
import { toast } from "@/components/toast";

interface ExpiringBusiness {
  id: string;
  name: string;
  slug: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  currency: string;
  createdAt: string;
  subscription: {
    id: string;
    plan: string;
    status: string;
    startDate: string;
    endDate: string;
    billingCycle: string;
    trialEndsAt: string | null;
    userLimit: number;
    branchLimit: number;
    packageType: string;
    daysLeft: number;
    urgency: "CRITICAL" | "AT_RISK" | "EXPIRING_SOON" | "EXPIRED" | "HEALTHY";
  };
  owner: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    isActive: boolean;
  } | null;
  branchesCount: number;
  usersCount: number;
}

interface ExpiringCounts {
  critical: number;
  atRisk: number;
  expiringSoon: number;
  expired: number;
  total: number;
}

export default function ExpiringSubscriptionsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [businesses, setBusinesses] = useState<ExpiringBusiness[]>([]);
  const [counts, setCounts] = useState<ExpiringCounts>({
    critical: 0,
    atRisk: 0,
    expiringSoon: 0,
    expired: 0,
    total: 0,
  });

  const [timeframe, setTimeframe] = useState<"all" | "critical" | "risk" | "soon" | "expired">("all");
  const [search, setSearch] = useState("");

  // Modal states
  const [extendingBusiness, setExtendingBusiness] = useState<ExpiringBusiness | null>(null);
  const [extensionDays, setExtensionDays] = useState<number>(14);
  const [extensionReason, setExtensionReason] = useState("");
  const [submittingExtension, setSubmittingExtension] = useState(false);

  const [remindingBusiness, setRemindingBusiness] = useState<ExpiringBusiness | null>(null);
  const [submittingReminder, setSubmittingReminder] = useState(false);
  const [submittingBulkReminders, setSubmittingBulkReminders] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/v1/super-admin/businesses/expiring?timeframe=${timeframe}&search=${encodeURIComponent(search)}`
      );
      if (res.ok) {
        const data = await res.json();
        setBusinesses(data.businesses || []);
        if (data.counts) setCounts(data.counts);
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Failed to load expiring subscriptions");
      }
    } catch {
      toast.error("Network connection error");
    } finally {
      setLoading(false);
    }
  }, [timeframe, search]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login");
    } else if (session?.user && (session.user as any).role !== "SUPER_ADMIN") {
      router.push("/dashboard");
    } else if (status === "authenticated") {
      fetchData();
    }
  }, [status, session, router, fetchData]);

  const handleExtend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!extendingBusiness) return;
    if (extensionReason.trim().length < 5) {
      toast.error("Audit rationale must be at least 5 characters long.");
      return;
    }

    setSubmittingExtension(true);
    try {
      const res = await fetch("/api/v1/super-admin/businesses/expiring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "extend_subscription",
          businessId: extendingBusiness.id,
          days: extensionDays,
          reason: extensionReason.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to extend subscription");

      toast.success(`Successfully extended ${extendingBusiness.name} by ${extensionDays} days.`);
      setExtendingBusiness(null);
      setExtensionReason("");
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to extend subscription");
    } finally {
      setSubmittingExtension(false);
    }
  };

  const handleSendReminder = async () => {
    if (!remindingBusiness) return;
    setSubmittingReminder(true);
    try {
      const res = await fetch("/api/v1/super-admin/businesses/expiring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send_reminder",
          businessId: remindingBusiness.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to dispatch reminder");

      toast.success(`Renewal reminder dispatched to ${remindingBusiness.name}.`);
      setRemindingBusiness(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to send reminder");
    } finally {
      setSubmittingReminder(false);
    }
  };

  const handleSendBulkReminders = async () => {
    if (
      !confirm(
        "Are you sure you want to broadcast renewal reminder notices to all businesses expiring within 30 days?"
      )
    ) {
      return;
    }

    setSubmittingBulkReminders(true);
    try {
      const res = await fetch("/api/v1/super-admin/businesses/expiring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send_bulk_reminders" }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to dispatch bulk reminders");

      toast.success(data.message || "Bulk renewal reminders dispatched successfully.");
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to send bulk reminders");
    } finally {
      setSubmittingBulkReminders(false);
    }
  };

  const getExportOptions = (): ExportOptions => ({
    filename: `expiring-subscriptions-${new Date().toISOString().split("T")[0]}`,
    title: "Expiring Subscriptions Report",
    subtitle: "Businesses requiring renewal attention or grace extension",
    dateRange: timeframe === "all" ? "All Timeframes" : `Filter: ${timeframe}`,
    columns: [
      { header: "Business Name", key: "name", width: 25 },
      { header: "Plan", key: "plan", width: 15 },
      { header: "Days Left", key: "daysLeft", width: 12 },
      { header: "Expiration Date", key: "endDate", width: 16 },
      { header: "Owner Name", key: "ownerName", width: 20 },
      { header: "Owner Email", key: "ownerEmail", width: 25 },
      { header: "Phone", key: "phone", width: 16 },
      { header: "Status", key: "status", width: 14 },
    ],
    data: businesses.map((b) => ({
      name: b.name,
      plan: b.subscription.plan,
      daysLeft: b.subscription.daysLeft,
      endDate: new Date(b.subscription.endDate).toLocaleDateString(),
      ownerName: b.owner?.name || "N/A",
      ownerEmail: b.owner?.email || b.email || "N/A",
      phone: b.owner?.phone || b.phone || "N/A",
      status: b.subscription.status,
    })),
  });

  const renderUrgencyBadge = (daysLeft: number) => {
    if (daysLeft < 0) {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-semibold bg-[#FAF2F4] text-[#6B2837] border border-[#E8D7DA]">
          <ShieldAlert className="h-3 w-3" /> Expired ({Math.abs(daysLeft)}d ago)
        </span>
      );
    }
    if (daysLeft <= 7) {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-semibold bg-rose-50 text-rose-800 border border-rose-200">
          <AlertTriangle className="h-3 w-3" /> Critical ({daysLeft}d left)
        </span>
      );
    }
    if (daysLeft <= 14) {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
          <Clock className="h-3 w-3" /> At Risk ({daysLeft}d left)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-semibold bg-[#F7F3EC] text-[#71675E] border border-[#D8CEC1]">
        <Calendar className="h-3 w-3" /> Expiring ({daysLeft}d left)
      </span>
    );
  };

  return (
    <div className="space-y-2.5 pb-8 text-[#292320]">
      {/* 1. Header (Clean, Minimalist) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-1 border-b border-[#D8CEC1]">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-[#292320]">
            Expiring Subscriptions
          </h1>
          <p className="text-[11px] text-[#71675E] mt-0.5">
            Monitor and manage business subscriptions nearing their renewal dates or trial endings.
          </p>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => fetchData()}
            disabled={loading}
            className="p-1.5 text-[#71675E] hover:text-[#292320] bg-[#FFFCF7] border border-[#D8CEC1] rounded-md hover:bg-[#EEE7DD] transition-colors cursor-pointer"
            title="Refresh subscriptions"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
          <ExportDropdown
            getExportOptions={getExportOptions}
            buttonText="Export Data"
            variant="outline"
          />
          <button
            onClick={handleSendBulkReminders}
            disabled={submittingBulkReminders}
            className="px-3 py-1.5 bg-[#6B2837] hover:bg-[#521E2A] text-white rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
          >
            <Bell className="h-3.5 w-3.5" />
            <span>{submittingBulkReminders ? "Dispatching..." : "Send Reminders to All"}</span>
          </button>
        </div>
      </div>

      {/* 2. Compact Minimalist KPI Cards (Clean, compact ~48px height) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        <div
          onClick={() => setTimeframe(timeframe === "soon" ? "all" : "soon")}
          className={`py-2 px-3 rounded-md bg-[#FFFCF7] border transition-all cursor-pointer ${
            timeframe === "soon" ? "border-[#6B2837] ring-1 ring-[#6B2837]" : "border-[#D8CEC1]"
          }`}
        >
          <div className="flex items-center justify-between text-[11px] text-[#71675E] font-medium">
            <span>Expiring Soon</span>
            <Clock className="h-3.5 w-3.5 text-[#71675E]" />
          </div>
          <div className="mt-0.5 text-lg font-bold tracking-tight text-[#292320] tabular-nums">
            {counts.expiringSoon}
          </div>
        </div>

        <div
          onClick={() => setTimeframe(timeframe === "risk" ? "all" : "risk")}
          className={`py-2 px-3 rounded-md bg-[#FFFCF7] border transition-all cursor-pointer ${
            timeframe === "risk" ? "border-[#6B2837] ring-1 ring-[#6B2837]" : "border-[#D8CEC1]"
          }`}
        >
          <div className="flex items-center justify-between text-[11px] text-[#71675E] font-medium">
            <span>At Risk (14d)</span>
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
          </div>
          <div className="mt-0.5 text-lg font-bold tracking-tight text-[#292320] tabular-nums">
            {counts.atRisk}
          </div>
        </div>

        <div
          onClick={() => setTimeframe(timeframe === "critical" ? "all" : "critical")}
          className={`py-2 px-3 rounded-md bg-[#FFFCF7] border transition-all cursor-pointer ${
            timeframe === "critical" ? "border-[#6B2837] ring-1 ring-[#6B2837]" : "border-[#D8CEC1]"
          }`}
        >
          <div className="flex items-center justify-between text-[11px] text-[#71675E] font-medium">
            <span>Critical (7d)</span>
            <ShieldAlert className="h-3.5 w-3.5 text-rose-600" />
          </div>
          <div className="mt-0.5 text-lg font-bold tracking-tight text-[#292320] tabular-nums">
            {counts.critical}
          </div>
        </div>

        <div
          onClick={() => setTimeframe(timeframe === "expired" ? "all" : "expired")}
          className={`py-2 px-3 rounded-md bg-[#FFFCF7] border transition-all cursor-pointer ${
            timeframe === "expired" ? "border-[#6B2837] ring-1 ring-[#6B2837]" : "border-[#D8CEC1]"
          }`}
        >
          <div className="flex items-center justify-between text-[11px] text-[#71675E] font-medium">
            <span>Expired</span>
            <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />
          </div>
          <div className="mt-0.5 text-lg font-bold tracking-tight text-[#292320] tabular-nums">
            {counts.expired}
          </div>
        </div>
      </div>

      {/* 3. Full-width Search Bar with Timeframe Pills in one compact row */}
      <div className="flex flex-col sm:flex-row items-center gap-2">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-[#71675E]" />
          <input
            type="text"
            placeholder="Search expiring businesses by name, slug, or owner email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-[#FFFCF7] border border-[#D8CEC1] rounded-md text-xs text-[#292320] placeholder:text-[#71675E] focus:outline-none focus:border-[#6B2837] transition-all"
          />
        </div>

        <div className="flex items-center gap-1 self-end sm:self-auto text-xs flex-wrap">
          <button
            onClick={() => setTimeframe("all")}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
              timeframe === "all"
                ? "bg-[#6B2837] text-white font-semibold"
                : "bg-[#FFFCF7] border border-[#D8CEC1] text-[#71675E] hover:text-[#292320]"
            }`}
          >
            All ({counts.total})
          </button>
          <button
            onClick={() => setTimeframe("soon")}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
              timeframe === "soon"
                ? "bg-[#6B2837] text-white font-semibold"
                : "bg-[#FFFCF7] border border-[#D8CEC1] text-[#71675E] hover:text-[#292320]"
            }`}
          >
            Expiring ({counts.expiringSoon})
          </button>
          <button
            onClick={() => setTimeframe("critical")}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
              timeframe === "critical"
                ? "bg-[#6B2837] text-white font-semibold"
                : "bg-[#FFFCF7] border border-[#D8CEC1] text-[#71675E] hover:text-[#292320]"
            }`}
          >
            Critical ({counts.critical})
          </button>
        </div>
      </div>

      {/* 4. Main Content: Renewal Queue Table Card */}
      <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-md overflow-hidden">
        {/* Table Card Header */}
        <div className="py-2 px-3 border-b border-[#D8CEC1] flex items-center justify-between bg-[#FFFCF7]">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#292320]">
            RENEWAL QUEUE ({businesses.length})
          </div>
          <div className="flex items-center gap-3 text-[11px] font-medium text-[#71675E]">
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500"></span>
              At Risk
            </span>
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500"></span>
              Critical / Expired
            </span>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-[#71675E] flex items-center justify-center gap-2">
            <RefreshCw className="h-3.5 w-3.5 animate-spin text-[#6B2837]" />
            <span>Loading renewal queue...</span>
          </div>
        ) : businesses.length === 0 ? (
          <div className="py-10 px-4 text-center">
            <div className="h-10 w-10 rounded-full border border-emerald-300 bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-2">
              <Check className="h-5 w-5 stroke-[2.5]" />
            </div>
            <h3 className="text-xs font-bold text-[#292320]">All subscriptions healthy</h3>
            <p className="text-[11px] text-[#71675E] mt-0.5">
              No business subscriptions currently require renewal attention.
            </p>
            <Link
              href="/dashboard/super-admin/businesses"
              className="inline-block mt-2 text-[11px] font-semibold text-[#6B2837] hover:underline"
            >
              View all businesses &rarr;
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#D8CEC1] bg-[#F7F3EC] text-[#71675E] font-semibold text-[10px] uppercase tracking-wider">
                  <th className="py-2 px-3">Business / Property</th>
                  <th className="py-2 px-3">Plan & Status</th>
                  <th className="py-2 px-3">Urgency</th>
                  <th className="py-2 px-3">End Date</th>
                  <th className="py-2 px-3">Owner Info</th>
                  <th className="py-2 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D8CEC1]/50">
                {businesses.map((b) => (
                  <tr key={b.id} className="hover:bg-[#F7F3EC]/50 transition-colors">
                    {/* Business Details */}
                    <td className="py-2 px-3">
                      <Link
                        href={`/dashboard/super-admin/businesses/${b.id}`}
                        className="font-semibold text-xs text-[#292320] hover:text-[#6B2837] hover:underline"
                      >
                        {b.name}
                      </Link>
                      <span className="text-[10px] text-[#71675E] font-mono ml-2">
                        /{b.slug} &bull; {b.address || "Nepal"}
                      </span>
                    </td>

                    {/* Plan */}
                    <td className="py-2 px-3 whitespace-nowrap">
                      <span className="font-semibold text-xs text-[#292320]">{b.subscription.plan}</span>
                      <span className="text-[10px] text-[#71675E] uppercase font-mono ml-1.5">
                        ({b.subscription.billingCycle})
                      </span>
                    </td>

                    {/* Urgency Badge */}
                    <td className="py-2 px-3 whitespace-nowrap">
                      {renderUrgencyBadge(b.subscription.daysLeft)}
                    </td>

                    {/* End Date */}
                    <td className="py-2 px-3 whitespace-nowrap text-xs text-[#71675E] font-mono">
                      {new Date(b.subscription.endDate).toLocaleDateString("en-US", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>

                    {/* Owner Info */}
                    <td className="py-2 px-3">
                      <span className="text-xs text-[#292320] font-medium">{b.owner?.name || "N/A"}</span>
                      <span className="text-[10px] text-[#71675E] font-mono ml-2">
                        {b.owner?.email || b.email || "N/A"}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-2 px-3 whitespace-nowrap text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          onClick={() => setExtendingBusiness(b)}
                          className="px-2 py-1 text-[11px] font-medium text-[#292320] bg-[#FFFCF7] border border-[#D8CEC1] rounded hover:bg-[#EEE7DD] transition-colors cursor-pointer inline-flex items-center gap-1"
                        >
                          <CalendarPlus className="h-3 w-3 text-[#6B2837]" />
                          <span>Extend</span>
                        </button>
                        <button
                          onClick={() => setRemindingBusiness(b)}
                          className="px-2 py-1 text-[11px] font-semibold text-white bg-[#6B2837] rounded hover:bg-[#521E2A] transition-colors cursor-pointer inline-flex items-center gap-1"
                        >
                          <Bell className="h-3 w-3" />
                          <span>Remind</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Minimalist Pagination Footer */}
        <div className="py-2 px-3 border-t border-[#D8CEC1] flex items-center justify-between text-[11px] text-[#71675E] bg-[#FFFCF7]">
          <div>
            Showing {businesses.length > 0 ? `1 to ${businesses.length}` : "0"} of {businesses.length}
          </div>
          <div className="flex items-center gap-1">
            <button
              disabled
              className="p-1 rounded border border-[#D8CEC1] text-[#71675E] opacity-50 cursor-not-allowed"
            >
              <ChevronLeft className="h-3 w-3" />
            </button>
            <span className="px-1.5 py-0.5 font-medium text-[#292320]">Page 1 of 1</span>
            <button
              disabled
              className="p-1 rounded border border-[#D8CEC1] text-[#71675E] opacity-50 cursor-not-allowed"
            >
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>

      {/* 5. Extension Modal */}
      {extendingBusiness && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg max-w-md w-full p-4 space-y-3 shadow-lg">
            <div className="flex items-center justify-between pb-2 border-b border-[#D8CEC1]">
              <h3 className="text-xs font-bold text-[#292320]">
                Extend Subscription &bull; {extendingBusiness.name}
              </h3>
              <button
                onClick={() => setExtendingBusiness(null)}
                className="text-[#71675E] hover:text-[#292320] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleExtend} className="space-y-2.5 text-xs">
              <div>
                <label className="text-[10px] font-semibold text-[#292320] block mb-1">
                  Extension Duration
                </label>
                <select
                  value={extensionDays}
                  onChange={(e) => setExtensionDays(Number(e.target.value))}
                  className="w-full px-2 py-1 bg-[#F7F3EC] border border-[#D8CEC1] rounded text-xs text-[#292320] focus:outline-none"
                >
                  <option value={7}>7 Days Grace</option>
                  <option value={14}>14 Days (Standard)</option>
                  <option value={30}>30 Days (1 Month)</option>
                  <option value={60}>60 Days (2 Months)</option>
                  <option value={90}>90 Days (Quarter)</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-semibold text-[#292320] block mb-1">
                  Audit Rationale / Notes
                </label>
                <textarea
                  value={extensionReason}
                  onChange={(e) => setExtensionReason(e.target.value)}
                  placeholder="Reason for extension (e.g., Bank transfer clearance in progress)"
                  rows={2}
                  className="w-full p-2 bg-[#F7F3EC] border border-[#D8CEC1] rounded text-xs text-[#292320] focus:outline-none focus:border-[#6B2837]"
                  required
                />
              </div>

              <div className="flex justify-end gap-1.5 pt-2 border-t border-[#D8CEC1]">
                <button
                  type="button"
                  onClick={() => setExtendingBusiness(null)}
                  className="px-2.5 py-1 border border-[#D8CEC1] rounded text-xs font-medium text-[#71675E] hover:text-[#292320] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingExtension}
                  className="px-3.5 py-1 bg-[#6B2837] hover:bg-[#521E2A] text-white rounded text-xs font-semibold cursor-pointer disabled:opacity-50"
                >
                  {submittingExtension ? "Extending..." : "Confirm Extension"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Send Reminder Confirmation Modal */}
      {remindingBusiness && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg max-w-md w-full p-4 space-y-3 shadow-lg">
            <div className="flex items-center justify-between pb-2 border-b border-[#D8CEC1]">
              <h3 className="text-xs font-bold text-[#292320]">Dispatch Renewal Notice</h3>
              <button
                onClick={() => setRemindingBusiness(null)}
                className="text-[#71675E] hover:text-[#292320] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-[#71675E] leading-relaxed">
              Send an in-app urgent renewal alert and email notification to the property owner of{" "}
              <strong className="text-[#292320]">{remindingBusiness.name}</strong>?
            </p>

            <div className="flex justify-end gap-1.5 pt-2 border-t border-[#D8CEC1]">
              <button
                onClick={() => setRemindingBusiness(null)}
                className="px-2.5 py-1 border border-[#D8CEC1] rounded text-xs font-medium text-[#71675E] hover:text-[#292320] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSendReminder}
                disabled={submittingReminder}
                className="px-3.5 py-1 bg-[#6B2837] hover:bg-[#521E2A] text-white rounded text-xs font-semibold cursor-pointer disabled:opacity-50 flex items-center gap-1"
              >
                <Bell className="h-3 w-3" />
                <span>{submittingReminder ? "Sending..." : "Dispatch Notice"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
