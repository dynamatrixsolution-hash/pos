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
  Building,
  Mail,
  Phone,
  ShieldAlert,
  ArrowUpRight,
  CheckCircle2,
  X,
  Send,
  CalendarPlus,
  Building2,
  Users,
} from "lucide-react";
import ExportDropdown from "@/components/export-dropdown";
import { ExportOptions } from "@/lib/export-service";

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
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

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
        setFeedback({ type: "error", message: err.error || "Failed to load expiring subscriptions" });
      }
    } catch {
      setFeedback({ type: "error", message: "Network connection error" });
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
      setFeedback({ type: "error", message: "Audit rationale must be at least 5 characters long." });
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

      setFeedback({
        type: "success",
        message: `Successfully extended ${extendingBusiness.name} by ${extensionDays} days.`,
      });
      setExtendingBusiness(null);
      setExtensionReason("");
      fetchData();
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message });
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

      setFeedback({
        type: "success",
        message: `Renewal reminder notice dispatched to ${remindingBusiness.name}.`,
      });
      setRemindingBusiness(null);
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message });
    } finally {
      setSubmittingReminder(false);
    }
  };

  const handleSendBulkReminders = async () => {
    if (!confirm("Are you sure you want to broadcast renewal reminder notices to all businesses expiring within 30 days?")) {
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

      setFeedback({
        type: "success",
        message: data.message || "Bulk renewal reminders dispatched successfully.",
      });
      fetchData();
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message });
    } finally {
      setSubmittingBulkReminders(false);
    }
  };

  // Prepare data for multi-format export
  const getExportOptions = (): ExportOptions => ({
    filename: `expiring-subscriptions-${new Date().toISOString().split("T")[0]}`,
    title: "Expiring Subscriptions & Renewals Report",
    subtitle: "Businesses requiring renewal or grace period follow-up",
    dateRange: timeframe === "all" ? "Within 30 Days" : `Urgency: ${timeframe}`,
    columns: [
      { header: "Business Name", key: "name", width: 25 },
      { header: "Slug", key: "slug", width: 18 },
      { header: "Plan", key: "plan", width: 15 },
      { header: "Billing Cycle", key: "billingCycle", width: 14 },
      { header: "Expiry Date", key: "endDate", width: 14 },
      { header: "Days Left", key: "daysLeft", width: 10 },
      { header: "Urgency", key: "urgency", width: 14 },
      { header: "Owner Name", key: "ownerName", width: 20 },
      { header: "Owner Email", key: "ownerEmail", width: 25 },
      { header: "Status", key: "status", width: 12 },
    ],
    data: businesses.map((b) => ({
      name: b.name,
      slug: b.slug,
      plan: b.subscription.plan,
      billingCycle: b.subscription.billingCycle,
      endDate: new Date(b.subscription.endDate).toISOString().split("T")[0],
      daysLeft: b.subscription.daysLeft,
      urgency: b.subscription.urgency,
      ownerName: b.owner?.name || "N/A",
      ownerEmail: b.owner?.email || b.email || "N/A",
      ownerPhone: b.owner?.phone || b.phone || "N/A",
      status: b.subscription.status,
    })),
  });

  const getUrgencyBadge = (daysLeft: number, status: string) => {
    if (daysLeft < 0 || status === "EXPIRED") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-[#FAF2F4] text-[#6B2837] border border-[#E8D7DA]">
          <ShieldAlert className="h-3 w-3" /> Expired ({Math.abs(daysLeft)}d ago)
        </span>
      );
    }
    if (daysLeft <= 7) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
          <AlertTriangle className="h-3 w-3" /> Critical ({daysLeft}d left)
        </span>
      );
    }
    if (daysLeft <= 14) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
          <Clock className="h-3 w-3" /> At Risk ({daysLeft}d left)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-[#F7F3EC] text-[#71675E] border border-[#D8CEC1]">
        <Calendar className="h-3 w-3" /> Expiring ({daysLeft}d left)
      </span>
    );
  };

  return (
    <div className="space-y-6 text-[#292320]">
      {/* 1. Header with Breadcrumbs & Top Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#FFFCF7] border border-[#D8CEC1]/80 p-5 rounded-lg">
        <div>
          <div className="flex items-center gap-2 text-xs text-[#71675E] font-medium mb-1">
            <Link href="/dashboard/super-admin" className="hover:text-[#6B2837]">
              Platform
            </Link>
            <span>/</span>
            <Link href="/dashboard/super-admin/businesses" className="hover:text-[#6B2837]">
              Businesses
            </Link>
            <span>/</span>
            <span className="text-[#292320] font-semibold">Expiring Subscriptions</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-[#292320]">Expiring Subscriptions</h1>
          <p className="text-xs text-[#71675E] mt-0.5">
            Monitor and manage subscriptions nearing their renewal dates or trial endings across the platform.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleSendBulkReminders}
            disabled={submittingBulkReminders}
            className="px-3.5 py-2 bg-[#FFFCF7] hover:bg-[#F7F3EC] border border-[#D8CEC1] text-[#292320] rounded-md text-xs font-semibold shadow-xs transition-colors flex items-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            <Bell className="h-3.5 w-3.5 text-[#6B2837]" />
            {submittingBulkReminders ? "Dispatching..." : "Send Reminders to All"}
          </button>
          <ExportDropdown
            getExportOptions={getExportOptions}
            buttonText="Export Renewals"
            variant="outline"
          />
        </div>
      </div>

      {/* Sub-Menu Tabs matching Sidebar */}
      <div className="flex border-b border-[#D8CEC1] gap-6 text-xs font-semibold overflow-x-auto">
        <Link
          href="/dashboard/super-admin/businesses"
          className="pb-2.5 border-b-2 border-transparent text-[#71675E] hover:text-[#292320] whitespace-nowrap transition-colors"
        >
          All Businesses
        </Link>
        <Link
          href="/dashboard/super-admin/businesses/pending"
          className="pb-2.5 border-b-2 border-transparent text-[#71675E] hover:text-[#292320] whitespace-nowrap transition-colors"
        >
          Pending Approvals
        </Link>
        <Link
          href="/dashboard/super-admin/businesses/expiring"
          className="pb-2.5 border-b-2 border-[#6B2837] text-[#6B2837] whitespace-nowrap"
        >
          Expiring Subscriptions ({counts.expiringSoon + counts.expired})
        </Link>
      </div>

      {/* 3. Feedback Banner */}
      {feedback && (
        <div
          className={`p-3 text-xs rounded-md border flex items-center justify-between ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-rose-50 text-rose-800 border-rose-200"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
            )}
            <span className="font-medium">{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* 4. 4-KPI Urgency Metric Grid matching NexaEdu */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          onClick={() => setTimeframe("soon")}
          className={`bg-[#FFFCF7] border p-4 rounded-lg cursor-pointer transition-all ${
            timeframe === "soon" ? "border-[#6B2837] ring-1 ring-[#6B2837]/30 shadow-xs" : "border-[#D8CEC1]/80 hover:border-[#D8CEC1]"
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#71675E]">Expiring Soon</p>
            <Clock className="h-4 w-4 text-[#71675E]" />
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-bold tracking-tight text-[#292320] tabular-nums">
              {counts.expiringSoon}
            </span>
            <span className="text-xs text-[#71675E]">Within 30 days</span>
          </div>
        </div>

        <div
          onClick={() => setTimeframe("critical")}
          className={`bg-[#FFFCF7] border p-4 rounded-lg cursor-pointer transition-all ${
            timeframe === "critical" ? "border-rose-600 ring-1 ring-rose-600/30 shadow-xs" : "border-[#D8CEC1]/80 hover:border-[#D8CEC1]"
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-rose-700">Critical (&lt; 7 Days)</p>
            <AlertTriangle className="h-4 w-4 text-rose-600" />
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-bold tracking-tight text-rose-700 tabular-nums">
              {counts.critical}
            </span>
            <span className="text-xs text-rose-600">Immediate action</span>
          </div>
        </div>

        <div
          onClick={() => setTimeframe("risk")}
          className={`bg-[#FFFCF7] border p-4 rounded-lg cursor-pointer transition-all ${
            timeframe === "risk" ? "border-amber-600 ring-1 ring-amber-600/30 shadow-xs" : "border-[#D8CEC1]/80 hover:border-[#D8CEC1]"
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-800">At Risk (8–14 Days)</p>
            <Clock className="h-4 w-4 text-amber-700" />
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-bold tracking-tight text-amber-800 tabular-nums">
              {counts.atRisk}
            </span>
            <span className="text-xs text-amber-700">Follow-up needed</span>
          </div>
        </div>

        <div
          onClick={() => setTimeframe("expired")}
          className={`bg-[#FFFCF7] border p-4 rounded-lg cursor-pointer transition-all ${
            timeframe === "expired" ? "border-[#6B2837] ring-1 ring-[#6B2837]/30 shadow-xs" : "border-[#D8CEC1]/80 hover:border-[#D8CEC1]"
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6B2837]">Already Expired</p>
            <ShieldAlert className="h-4 w-4 text-[#6B2837]" />
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-bold tracking-tight text-[#6B2837] tabular-nums">
              {counts.expired}
            </span>
            <span className="text-xs text-[#71675E]">Service halted / grace</span>
          </div>
        </div>
      </div>

      {/* 5. Filter Toolbar */}
      <div className="bg-[#FFFCF7] border border-[#D8CEC1]/80 p-4 rounded-lg flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#71675E]" />
          <input
            type="text"
            placeholder="Search by business name, slug, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-[#F7F3EC] border border-[#D8CEC1] rounded-md text-xs text-[#292320] placeholder-[#71675E] focus:outline-none focus:ring-1 focus:ring-[#6B2837]"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-[#F7F3EC] border border-[#D8CEC1] p-0.5 rounded-md text-[11px] font-medium">
            <button
              onClick={() => setTimeframe("all")}
              className={`px-2.5 py-1 rounded cursor-pointer transition-colors ${
                timeframe === "all" ? "bg-[#6B2837] text-white font-semibold" : "text-[#71675E] hover:text-[#292320]"
              }`}
            >
              All Expiring
            </button>
            <button
              onClick={() => setTimeframe("critical")}
              className={`px-2.5 py-1 rounded cursor-pointer transition-colors ${
                timeframe === "critical" ? "bg-[#6B2837] text-white font-semibold" : "text-[#71675E] hover:text-[#292320]"
              }`}
            >
              Critical
            </button>
            <button
              onClick={() => setTimeframe("risk")}
              className={`px-2.5 py-1 rounded cursor-pointer transition-colors ${
                timeframe === "risk" ? "bg-[#6B2837] text-white font-semibold" : "text-[#71675E] hover:text-[#292320]"
              }`}
            >
              At Risk
            </button>
            <button
              onClick={() => setTimeframe("soon")}
              className={`px-2.5 py-1 rounded cursor-pointer transition-colors ${
                timeframe === "soon" ? "bg-[#6B2837] text-white font-semibold" : "text-[#71675E] hover:text-[#292320]"
              }`}
            >
              Expiring Soon
            </button>
            <button
              onClick={() => setTimeframe("expired")}
              className={`px-2.5 py-1 rounded cursor-pointer transition-colors ${
                timeframe === "expired" ? "bg-[#6B2837] text-white font-semibold" : "text-[#71675E] hover:text-[#292320]"
              }`}
            >
              Expired
            </button>
          </div>

          <button
            onClick={() => fetchData()}
            title="Refresh list"
            className="p-1.5 bg-[#F7F3EC] hover:bg-[#EEE7DD] border border-[#D8CEC1] text-[#71675E] hover:text-[#292320] rounded-md transition-colors cursor-pointer"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* 6. Subscriptions Table */}
      <div className="bg-[#FFFCF7] border border-[#D8CEC1]/80 rounded-lg overflow-hidden shadow-xs">
        <div className="p-4 border-b border-[#D8CEC1]/80 flex justify-between items-center bg-[#F7F3EC]/50">
          <div>
            <h2 className="text-sm font-bold text-[#292320]">
              Expiring Subscriptions List
              <span className="ml-2 text-xs font-normal text-[#71675E] tabular-nums">
                ({businesses.length} records)
              </span>
            </h2>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center space-y-3">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#6B2837] border-t-transparent mx-auto" />
            <p className="text-xs text-[#71675E]">Loading expiring subscriptions...</p>
          </div>
        ) : businesses.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <Building className="h-8 w-8 text-[#71675E] mx-auto opacity-50" />
            <p className="text-xs font-semibold text-[#292320]">No expiring subscriptions found</p>
            <p className="text-[11px] text-[#71675E]">
              {timeframe === "all"
                ? "All active businesses currently have healthy subscription balances."
                : `No businesses match the "${timeframe}" urgency criteria.`}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#D8CEC1] bg-[#F7F3EC]/80 text-[#71675E] font-semibold uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-4">Business / Property</th>
                  <th className="py-2.5 px-3">Plan & Type</th>
                  <th className="py-2.5 px-3">Administrator</th>
                  <th className="py-2.5 px-3">Expiry Date</th>
                  <th className="py-2.5 px-3">Days Left</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D8CEC1]/60">
                {businesses.map((b) => (
                  <tr key={b.id} className="hover:bg-[#F7F3EC]/40 transition-colors">
                    {/* Business Name */}
                    <td className="py-3 px-4">
                      <div className="font-bold text-[#292320] flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 text-[#6B2837] shrink-0" />
                        <span>{b.name}</span>
                      </div>
                      <div className="text-[11px] text-[#71675E] flex items-center gap-2 mt-0.5">
                        <span>{b.slug}</span>
                        {b.address && <span>• {b.address}</span>}
                      </div>
                    </td>

                    {/* Plan */}
                    <td className="py-3 px-3">
                      <div className="font-semibold text-[#292320]">{b.subscription.plan}</div>
                      <div className="text-[10px] text-[#71675E] mt-0.5 uppercase tracking-wide">
                        {b.subscription.billingCycle} • {b.subscription.packageType || "POS"}
                      </div>
                    </td>

                    {/* Admin contact */}
                    <td className="py-3 px-3">
                      <div className="text-[#292320] font-medium">
                        {b.owner?.name || "No designated owner"}
                      </div>
                      <div className="text-[11px] text-[#71675E] mt-0.5 flex items-center gap-1">
                        <Mail className="h-3 w-3 shrink-0" />
                        <span className="truncate max-w-[150px]">
                          {b.owner?.email || b.email || "N/A"}
                        </span>
                      </div>
                    </td>

                    {/* Expiry Date */}
                    <td className="py-3 px-3 tabular-nums font-medium text-[#292320]">
                      {new Date(b.subscription.endDate).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </td>

                    {/* Days Left badge */}
                    <td className="py-3 px-3">
                      {getUrgencyBadge(b.subscription.daysLeft, b.subscription.status)}
                    </td>

                    {/* Action buttons */}
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => {
                            setRemindingBusiness(b);
                          }}
                          title="Send renewal reminder notice"
                          className="px-2.5 py-1 bg-[#FFFCF7] hover:bg-[#F7F3EC] border border-[#D8CEC1] text-[#292320] rounded text-[11px] font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <Send className="h-3 w-3 text-[#6B2837]" />
                          Remind
                        </button>
                        <button
                          onClick={() => {
                            setExtendingBusiness(b);
                            setExtensionDays(14);
                            setExtensionReason("");
                          }}
                          title="Extend subscription or grace period"
                          className="px-2.5 py-1 bg-[#6B2837] hover:bg-[#521E2A] text-white rounded text-[11px] font-semibold shadow-2xs transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <CalendarPlus className="h-3 w-3" />
                          Extend
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL: Extend Subscription */}
      {extendingBusiness && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg max-w-md w-full p-5 space-y-4 shadow-md text-[#292320]">
            <div className="flex justify-between items-start border-b border-[#D8CEC1] pb-3">
              <div>
                <h3 className="text-sm font-bold text-[#292320]">Extend Subscription</h3>
                <p className="text-xs text-[#71675E] mt-0.5">
                  Tenant: <span className="font-semibold text-[#292320]">{extendingBusiness.name}</span>
                </p>
              </div>
              <button
                onClick={() => setExtendingBusiness(null)}
                className="text-[#71675E] hover:text-[#292320] p-1 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleExtend} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#71675E] mb-1">
                  Extension Duration
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[7, 14, 30].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setExtensionDays(d)}
                      className={`py-1.5 px-3 rounded-md text-xs font-semibold border cursor-pointer transition-colors ${
                        extensionDays === d
                          ? "bg-[#6B2837] text-white border-[#6B2837]"
                          : "bg-[#F7F3EC] text-[#292320] border-[#D8CEC1] hover:bg-[#EEE7DD]"
                      }`}
                    >
                      +{d} Days
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#71675E] mb-1">
                  Current Expiry
                </label>
                <div className="p-2 bg-[#F7F3EC] border border-[#D8CEC1] rounded-md text-xs tabular-nums text-[#71675E]">
                  {new Date(extendingBusiness.subscription.endDate).toLocaleDateString()}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#71675E] mb-1">
                  Administrative Rationale / Reason <span className="text-rose-600">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="State the audit rationale for this extension (e.g. Wire transfer pending verification)..."
                  value={extensionReason}
                  onChange={(e) => setExtensionReason(e.target.value)}
                  className="w-full p-2.5 bg-[#F7F3EC] border border-[#D8CEC1] rounded-md text-xs text-[#292320] placeholder-[#71675E] focus:outline-none focus:ring-1 focus:ring-[#6B2837]"
                />
                <p className="text-[10px] text-[#71675E] mt-1">
                  Audit logs record all extensions with your administrator identity.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#D8CEC1]">
                <button
                  type="button"
                  onClick={() => setExtendingBusiness(null)}
                  className="px-3 py-1.5 border border-[#D8CEC1] text-[#292320] text-xs font-semibold rounded-md hover:bg-[#F7F3EC] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingExtension || extensionReason.trim().length < 5}
                  className="px-4 py-1.5 bg-[#6B2837] text-white text-xs font-semibold rounded-md hover:bg-[#521E2A] disabled:opacity-50 cursor-pointer"
                >
                  {submittingExtension ? "Extending..." : "Confirm Extension"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Send Renewal Reminder */}
      {remindingBusiness && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg max-w-md w-full p-5 space-y-4 shadow-md text-[#292320]">
            <div className="flex justify-between items-start border-b border-[#D8CEC1] pb-3">
              <div>
                <h3 className="text-sm font-bold text-[#292320]">Dispatch Renewal Reminder</h3>
                <p className="text-xs text-[#71675E] mt-0.5">
                  Business: <span className="font-semibold text-[#292320]">{remindingBusiness.name}</span>
                </p>
              </div>
              <button
                onClick={() => setRemindingBusiness(null)}
                className="text-[#71675E] hover:text-[#292320] p-1 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-3 bg-[#FAF2F4] border border-[#E8D7DA] rounded-md text-xs space-y-1 text-[#292320]">
              <div className="font-semibold text-[#6B2837]">Notice Preview:</div>
              <div className="text-[#71675E] text-[11px] leading-relaxed">
                "Your subscription plan ({remindingBusiness.subscription.plan}) expires on{" "}
                {new Date(remindingBusiness.subscription.endDate).toLocaleDateString()}. Please renew promptly to ensure uninterrupted access."
              </div>
            </div>

            <p className="text-xs text-[#71675E]">
              This will publish an in-app warning banner and notification for the business administrator.
            </p>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#D8CEC1]">
              <button
                type="button"
                onClick={() => setRemindingBusiness(null)}
                className="px-3 py-1.5 border border-[#D8CEC1] text-[#292320] text-xs font-semibold rounded-md hover:bg-[#F7F3EC] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendReminder}
                disabled={submittingReminder}
                className="px-4 py-1.5 bg-[#6B2837] text-white text-xs font-semibold rounded-md hover:bg-[#521E2A] disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
              >
                <Send className="h-3.5 w-3.5" />
                {submittingReminder ? "Dispatching..." : "Send Notice"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
