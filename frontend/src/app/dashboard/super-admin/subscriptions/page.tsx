"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  CreditCard,
  FileText,
  Clock,
  TrendingUp,
  AlertTriangle,
  Search,
  Filter,
  Plus,
  ArrowUpRight,
  CheckCircle2,
  X,
  ChevronDown,
  RefreshCw,
  Eye,
  RotateCw,
  MoreVertical,
  Layers,
  Building2,
  DollarSign,
  Calendar,
  Check,
} from "lucide-react";
import ExportDropdown from "@/components/export-dropdown";
import { ExportOptions } from "@/lib/export-service";

interface SubscriptionItem {
  id: string;
  businessId: string;
  businessName: string;
  businessSlug: string;
  businessLocation: string;
  plan: string;
  billingCycle: string;
  tablesUsed: number;
  tableLimit: number;
  staffUsed: number;
  staffLimit: number;
  amount: number;
  nextRenewal: string;
  paymentStatus: "PAID" | "UNPAID" | "PENDING";
  status: "ACTIVE" | "EXPIRING_SOON" | "SUSPENDED" | "EXPIRED";
  createdAt: string;
}

interface KPIs {
  totalActive: number;
  expiring7Days: number;
  mrr: number;
  overdueCount: number;
  renewalRate: number;
}

interface PlanDistItem {
  name: string;
  count: number;
  percentage: number;
  color: string;
}

interface RecentActivityItem {
  id: string;
  type: string;
  title: string;
  amount?: number;
  currency: string;
  date: string;
  invoiceNumber?: string;
}

export default function SubscriptionsDirectoryPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [subscriptions, setSubscriptions] = useState<SubscriptionItem[]>([]);
  const [kpis, setKpis] = useState<KPIs>({
    totalActive: 0,
    expiring7Days: 0,
    mrr: 0,
    overdueCount: 0,
    renewalRate: 98.5,
  });
  const [planDistribution, setPlanDistribution] = useState<PlanDistItem[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivityItem[]>([]);

  // Navigation Tabs & Filters
  const [activeTab, setActiveTab] = useState<"all" | "active" | "expiring" | "overdue" | "suspended">("all");
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("ALL");
  const [cycleFilter, setCycleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [paymentFilter, setPaymentFilter] = useState("ALL");

  // Selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Modals
  const [inspectItem, setInspectItem] = useState<SubscriptionItem | null>(null);
  const [renewItem, setRenewItem] = useState<SubscriptionItem | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [renewMonths, setRenewMonths] = useState(12);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form for New Subscription
  const [newBusinessId, setNewBusinessId] = useState("");
  const [newPlan, setNewPlan] = useState("Professional");
  const [newCycle, setNewCycle] = useState("MONTHLY");

  // Feedback Notification
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const fetchSubscriptions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (planFilter !== "ALL") params.set("plan", planFilter);
      if (cycleFilter !== "ALL") params.set("cycle", cycleFilter);
      if (statusFilter !== "ALL") params.set("status", statusFilter);

      const res = await fetch(`/api/v1/super-admin/subscriptions?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setSubscriptions(data.subscriptions || []);
        if (data.kpis) setKpis(data.kpis);
        if (data.planDistribution) setPlanDistribution(data.planDistribution);
        if (data.recentActivity) setRecentActivity(data.recentActivity);
      } else {
        const err = await res.json().catch(() => ({}));
        setFeedback({ type: "error", message: err.error || "Failed to load subscriptions" });
      }
    } catch {
      setFeedback({ type: "error", message: "Network connection error loading subscriptions." });
    } finally {
      setLoading(false);
    }
  }, [search, planFilter, cycleFilter, statusFilter]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login");
    } else if (session?.user && (session.user as any).role !== "SUPER_ADMIN") {
      router.push("/dashboard");
    } else if (status === "authenticated") {
      fetchSubscriptions();
    }
  }, [status, session, router, fetchSubscriptions]);

  // Tab Filtering
  const filteredSubscriptions = useMemo(() => {
    let list = subscriptions;

    if (activeTab === "active") {
      list = list.filter((s) => s.status === "ACTIVE" || s.status === "EXPIRING_SOON");
    } else if (activeTab === "expiring") {
      list = list.filter((s) => s.status === "EXPIRING_SOON");
    } else if (activeTab === "overdue") {
      list = list.filter((s) => s.paymentStatus === "UNPAID" || s.status === "EXPIRED");
    } else if (activeTab === "suspended") {
      list = list.filter((s) => s.status === "SUSPENDED" || s.status === "EXPIRED");
    }

    if (paymentFilter !== "ALL") {
      list = list.filter((s) => s.paymentStatus === paymentFilter);
    }

    return list;
  }, [subscriptions, activeTab, paymentFilter]);

  // Selection
  const toggleSelectAll = () => {
    if (selectedIds.length === filteredSubscriptions.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredSubscriptions.map((s) => s.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Actions
  const handleRenew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renewItem) return;
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/v1/super-admin/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "RENEW_SUBSCRIPTION",
          businessId: renewItem.businessId,
          plan: renewItem.plan,
          billingCycle: renewItem.billingCycle.toUpperCase(),
          durationMonths: renewMonths,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to renew subscription");

      setFeedback({ type: "success", message: `Subscription renewed successfully for ${renewItem.businessName}.` });
      setRenewItem(null);
      fetchSubscriptions();
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBusinessId) {
      setFeedback({ type: "error", message: "Please select a restaurant property." });
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/v1/super-admin/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ASSIGN_PLAN",
          businessId: newBusinessId,
          plan: newPlan,
          billingCycle: newCycle,
          durationMonths: newCycle === "ANNUAL" ? 12 : 1,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to assign subscription");

      setFeedback({ type: "success", message: "Subscription assigned successfully." });
      setShowAddModal(false);
      fetchSubscriptions();
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Export
  const getExportOptions = (): ExportOptions => ({
    filename: `restroinn-subscriptions-${new Date().toISOString().split("T")[0]}`,
    title: "Subscriptions & Billing Directory",
    subtitle: "Complete active, renewal, and billing portfolio across RestroInn",
    dateRange: activeTab === "all" ? "All Platform Subscriptions" : `Segment: ${activeTab}`,
    columns: [
      { header: "Restaurant / Property", key: "businessName", width: 25 },
      { header: "Location", key: "businessLocation", width: 20 },
      { header: "Plan", key: "plan", width: 15 },
      { header: "Billing Cycle", key: "billingCycle", width: 14 },
      { header: "Tables Used", key: "tablesUsed", width: 14 },
      { header: "Staff Used", key: "staffUsed", width: 14 },
      { header: "Amount (NPR)", key: "amount", width: 15 },
      { header: "Next Renewal", key: "nextRenewal", width: 16 },
      { header: "Payment Status", key: "paymentStatus", width: 14 },
      { header: "Status", key: "status", width: 12 },
    ],
    data: filteredSubscriptions.map((s) => ({
      businessName: s.businessName,
      businessLocation: s.businessLocation,
      plan: s.plan,
      billingCycle: s.billingCycle,
      tablesUsed: `${s.tablesUsed} / ${s.tableLimit}`,
      staffUsed: `${s.staffUsed} / ${s.staffLimit}`,
      amount: s.amount.toLocaleString(),
      nextRenewal: new Date(s.nextRenewal).toLocaleDateString(),
      paymentStatus: s.paymentStatus,
      status: s.status,
    })),
  });

  return (
    <div className="space-y-5 text-[#292320]">
      {/* 1. Header with Top Tools matching Screenshot 1 */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#292320]">Subscriptions & Billing</h1>
          <p className="text-xs text-[#71675E] mt-0.5">
            Manage restaurant & hotel subscriptions, plans, invoices, renewals and billing across RestroInn.
          </p>
        </div>

        {/* Action Tools */}
        <div className="flex items-center gap-2 flex-wrap w-full lg:w-auto">
          {/* Quick Search */}
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#71675E]" />
            <input
              type="text"
              placeholder="Search subscriptions, restaurants..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-[#FFFCF7] border border-[#D8CEC1] rounded-md text-xs text-[#292320] placeholder-[#71675E] focus:outline-none focus:ring-1 focus:ring-[#6B2837]"
            />
          </div>

          <Link
            href="/dashboard/super-admin/subscriptions/plans"
            className="px-3 py-1.5 bg-[#FFFCF7] hover:bg-[#F7F3EC] border border-[#D8CEC1] rounded-md text-xs font-semibold text-[#292320] transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Layers className="h-3.5 w-3.5 text-[#6B2837]" />
            <span>Plans & Pricing</span>
          </Link>

          <ExportDropdown
            getExportOptions={getExportOptions}
            buttonText="Export Data"
            variant="outline"
          />

          <button
            onClick={() => setShowAddModal(true)}
            className="px-3.5 py-1.5 bg-[#6B2837] hover:bg-[#521E2A] text-white rounded-md text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
            <span>+ Add Subscription</span>
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
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

      {/* 2. 5-KPI Cards Row matching Screenshot 1 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Total Active Subscriptions */}
        <div
          onClick={() => setActiveTab("active")}
          className="bg-[#FFFCF7] rounded-lg border border-[#D8CEC1]/80 hover:border-[#D8CEC1] p-3 transition-all flex items-center justify-between gap-2 cursor-pointer"
        >
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium text-[#71675E] truncate">Total Active Subscriptions</p>
            <p className="text-xl font-bold tracking-tight text-[#292320] tabular-nums mt-0.5">
              {kpis.totalActive}
            </p>
          </div>
          <div className="h-8 w-8 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center shrink-0">
            <FileText className="h-4 w-4" />
          </div>
        </div>

        {/* Expiring in 7 Days */}
        <div
          onClick={() => setActiveTab("expiring")}
          className="bg-[#FFFCF7] rounded-lg border border-[#D8CEC1]/80 hover:border-[#D8CEC1] p-3 transition-all flex items-center justify-between gap-2 cursor-pointer"
        >
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium text-[#71675E] truncate">Expiring in 7 Days</p>
            <p className="text-xl font-bold tracking-tight text-amber-700 tabular-nums mt-0.5">
              {kpis.expiring7Days}
            </p>
          </div>
          <div className="h-8 w-8 rounded-md bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center shrink-0">
            <Clock className="h-4 w-4" />
          </div>
        </div>

        {/* MRR / Revenue */}
        <div className="bg-[#FFFCF7] rounded-lg border border-[#D8CEC1]/80 p-3 flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium text-[#71675E] truncate">MRR / Revenue</p>
            <p className="text-xl font-bold tracking-tight text-emerald-700 tabular-nums mt-0.5">
              NPR {(kpis.mrr / 1000).toFixed(1)}k
            </p>
          </div>
          <div className="h-8 w-8 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center shrink-0 font-bold text-xs">
            $
          </div>
        </div>

        {/* Overdue Accounts */}
        <div
          onClick={() => setActiveTab("overdue")}
          className="bg-[#FFFCF7] rounded-lg border border-[#D8CEC1]/80 hover:border-[#D8CEC1] p-3 transition-all flex items-center justify-between gap-2 cursor-pointer"
        >
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium text-[#71675E] truncate">Overdue Accounts</p>
            <p className="text-xl font-bold tracking-tight text-rose-700 tabular-nums mt-0.5">
              {kpis.overdueCount}
            </p>
          </div>
          <div className="h-8 w-8 rounded-md bg-rose-50 text-rose-700 border border-rose-200 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-4 w-4" />
          </div>
        </div>

        {/* Renewal Rate */}
        <div className="bg-[#FFFCF7] rounded-lg border border-[#D8CEC1]/80 p-3 flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium text-[#71675E] truncate">Renewal Rate</p>
            <p className="text-xl font-bold tracking-tight text-blue-700 tabular-nums mt-0.5">
              {kpis.renewalRate.toFixed(1)}%
            </p>
          </div>
          <div className="h-8 w-8 rounded-md bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center shrink-0">
            <TrendingUp className="h-4 w-4" />
          </div>
        </div>
      </div>

      {/* 3. Sub-Navigation Tabs matching Screenshot 1 */}
      <div className="flex border-b border-[#D8CEC1] gap-6 text-xs font-semibold overflow-x-auto">
        <button
          onClick={() => setActiveTab("all")}
          className={`pb-2.5 border-b-2 whitespace-nowrap cursor-pointer transition-colors ${
            activeTab === "all"
              ? "border-[#6B2837] text-[#6B2837]"
              : "border-transparent text-[#71675E] hover:text-[#292320]"
          }`}
        >
          All ({subscriptions.length})
        </button>
        <button
          onClick={() => setActiveTab("active")}
          className={`pb-2.5 border-b-2 whitespace-nowrap cursor-pointer transition-colors ${
            activeTab === "active"
              ? "border-[#6B2837] text-[#6B2837]"
              : "border-transparent text-[#71675E] hover:text-[#292320]"
          }`}
        >
          Active ({kpis.totalActive})
        </button>
        <button
          onClick={() => setActiveTab("expiring")}
          className={`pb-2.5 border-b-2 whitespace-nowrap cursor-pointer transition-colors ${
            activeTab === "expiring"
              ? "border-[#6B2837] text-[#6B2837]"
              : "border-transparent text-[#71675E] hover:text-[#292320]"
          }`}
        >
          Expiring Soon ({kpis.expiring7Days})
        </button>
        <button
          onClick={() => setActiveTab("overdue")}
          className={`pb-2.5 border-b-2 whitespace-nowrap cursor-pointer transition-colors ${
            activeTab === "overdue"
              ? "border-[#6B2837] text-[#6B2837]"
              : "border-transparent text-[#71675E] hover:text-[#292320]"
          }`}
        >
          Overdue ({kpis.overdueCount})
        </button>
        <button
          onClick={() => setActiveTab("suspended")}
          className={`pb-2.5 border-b-2 whitespace-nowrap cursor-pointer transition-colors ${
            activeTab === "suspended"
              ? "border-[#6B2837] text-[#6B2837]"
              : "border-transparent text-[#71675E] hover:text-[#292320]"
          }`}
        >
          Suspended (0)
        </button>
      </div>

      {/* 4. Filter Toolbar matching Screenshot 1 */}
      <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Plan Dropdown */}
          <div className="relative">
            <select
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value)}
              className="appearance-none border border-[#D8CEC1] rounded-md pl-2.5 pr-7 py-1.5 text-xs font-medium text-[#292320] bg-[#FFFCF7] focus:outline-none focus:ring-1 focus:ring-[#6B2837] cursor-pointer"
            >
              <option value="ALL">All Plans</option>
              <option value="STARTER">Starter</option>
              <option value="STANDARD">Standard</option>
              <option value="PROFESSIONAL">Professional</option>
              <option value="ENTERPRISE">Enterprise</option>
            </select>
            <ChevronDown className="h-3.5 w-3.5 text-[#71675E] absolute right-2 top-2 pointer-events-none" />
          </div>

          {/* Billing Cycle */}
          <div className="relative">
            <select
              value={cycleFilter}
              onChange={(e) => setCycleFilter(e.target.value)}
              className="appearance-none border border-[#D8CEC1] rounded-md pl-2.5 pr-7 py-1.5 text-xs font-medium text-[#292320] bg-[#FFFCF7] focus:outline-none focus:ring-1 focus:ring-[#6B2837] cursor-pointer"
            >
              <option value="ALL">All Billing Cycles</option>
              <option value="MONTHLY">Monthly</option>
              <option value="ANNUAL">Annual</option>
            </select>
            <ChevronDown className="h-3.5 w-3.5 text-[#71675E] absolute right-2 top-2 pointer-events-none" />
          </div>

          {/* Status */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="appearance-none border border-[#D8CEC1] rounded-md pl-2.5 pr-7 py-1.5 text-xs font-medium text-[#292320] bg-[#FFFCF7] focus:outline-none focus:ring-1 focus:ring-[#6B2837] cursor-pointer"
            >
              <option value="ALL">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="EXPIRING_SOON">Expiring Soon</option>
              <option value="EXPIRED">Expired</option>
            </select>
            <ChevronDown className="h-3.5 w-3.5 text-[#71675E] absolute right-2 top-2 pointer-events-none" />
          </div>

          {/* Payment Status */}
          <div className="relative">
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="appearance-none border border-[#D8CEC1] rounded-md pl-2.5 pr-7 py-1.5 text-xs font-medium text-[#292320] bg-[#FFFCF7] focus:outline-none focus:ring-1 focus:ring-[#6B2837] cursor-pointer"
            >
              <option value="ALL">All Payment Status</option>
              <option value="PAID">Paid</option>
              <option value="UNPAID">Unpaid</option>
            </select>
            <ChevronDown className="h-3.5 w-3.5 text-[#71675E] absolute right-2 top-2 pointer-events-none" />
          </div>

          <button
            onClick={() => fetchSubscriptions()}
            title="Refresh list"
            className="p-1.5 bg-[#FFFCF7] hover:bg-[#F7F3EC] border border-[#D8CEC1] text-[#71675E] hover:text-[#292320] rounded-md transition-colors cursor-pointer"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Bulk Actions */}
        <div className="relative">
          <button
            disabled={selectedIds.length === 0}
            className="px-3 py-1.5 border border-[#D8CEC1] rounded-md text-xs font-medium text-[#292320] bg-[#FFFCF7] hover:bg-[#F7F3EC] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer"
          >
            <span>Bulk Actions ({selectedIds.length})</span>
            <ChevronDown className="h-3.5 w-3.5 text-[#71675E]" />
          </button>
        </div>
      </div>

      {/* 5. Subscriptions Data Table matching Screenshot 1 */}
      <div className="bg-[#FFFCF7] border border-[#D8CEC1]/80 rounded-lg overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-12 text-center space-y-3">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#6B2837] border-t-transparent mx-auto" />
            <p className="text-xs text-[#71675E]">Loading subscriptions directory...</p>
          </div>
        ) : filteredSubscriptions.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <CreditCard className="h-8 w-8 text-[#71675E] mx-auto opacity-50" />
            <p className="text-xs font-semibold text-[#292320]">No subscriptions found</p>
            <p className="text-[11px] text-[#71675E]">
              {search.trim()
                ? "No subscriptions matched your search criteria."
                : "No subscriptions in this category."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#D8CEC1] bg-[#F7F3EC]/80 text-[#71675E] font-semibold uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-3 w-8">
                    <input
                      type="checkbox"
                      checked={
                        selectedIds.length === filteredSubscriptions.length && filteredSubscriptions.length > 0
                      }
                      onChange={toggleSelectAll}
                      className="rounded border-[#D8CEC1] text-[#6B2837] focus:ring-[#6B2837] cursor-pointer"
                    />
                  </th>
                  <th className="py-2.5 px-3">Restaurant / Property</th>
                  <th className="py-2.5 px-3">Plan</th>
                  <th className="py-2.5 px-3">Billing Cycle</th>
                  <th className="py-2.5 px-3">Tables / Rooms</th>
                  <th className="py-2.5 px-3">Staff Used</th>
                  <th className="py-2.5 px-3">Amount</th>
                  <th className="py-2.5 px-3">Next Renewal</th>
                  <th className="py-2.5 px-3">Payment Status</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D8CEC1]/60">
                {filteredSubscriptions.map((s) => {
                  const isSelected = selectedIds.includes(s.id);
                  const tablePercent = Math.min(100, Math.round((s.tablesUsed / s.tableLimit) * 100));
                  const staffPercent = Math.min(100, Math.round((s.staffUsed / s.staffLimit) * 100));

                  return (
                    <tr
                      key={s.id}
                      className={`hover:bg-[#F7F3EC]/40 transition-colors ${
                        isSelected ? "bg-[#FAF2F4]/60" : ""
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3 px-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOne(s.id)}
                          className="rounded border-[#D8CEC1] text-[#6B2837] focus:ring-[#6B2837] cursor-pointer"
                        />
                      </td>

                      {/* Property / Restaurant */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-md bg-[#EEE7DD] text-[#6B2837] flex items-center justify-center font-bold text-xs shrink-0 border border-[#D8CEC1]">
                            {s.businessName.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-[#292320] leading-tight">{s.businessName}</div>
                            <div className="text-[11px] text-[#71675E] leading-tight mt-0.5">
                              {s.businessLocation}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Plan */}
                      <td className="py-3 px-3">
                        <span
                          className={`inline-block font-semibold text-xs ${
                            s.plan === "Professional"
                              ? "text-purple-700 font-bold"
                              : s.plan === "Standard"
                              ? "text-blue-700"
                              : s.plan === "Enterprise"
                              ? "text-amber-700 font-bold"
                              : "text-emerald-700"
                          }`}
                        >
                          {s.plan}
                        </span>
                      </td>

                      {/* Billing Cycle */}
                      <td className="py-3 px-3 text-[#71675E]">
                        {s.billingCycle}
                      </td>

                      {/* Tables / Rooms Used */}
                      <td className="py-3 px-3">
                        <div className="space-y-1 max-w-[100px]">
                          <div className="flex justify-between text-[11px] tabular-nums text-[#292320] font-medium">
                            <span>{s.tablesUsed}</span>
                            <span className="text-[#71675E]">/ {s.tableLimit}</span>
                          </div>
                          <div className="w-full bg-[#EEE7DD] h-1.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                tablePercent > 85 ? "bg-rose-500" : "bg-[#6B2837]"
                              }`}
                              style={{ width: `${tablePercent}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Staff Used */}
                      <td className="py-3 px-3">
                        <div className="space-y-1 max-w-[100px]">
                          <div className="flex justify-between text-[11px] tabular-nums text-[#292320] font-medium">
                            <span>{s.staffUsed}</span>
                            <span className="text-[#71675E]">/ {s.staffLimit}</span>
                          </div>
                          <div className="w-full bg-[#EEE7DD] h-1.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                staffPercent > 85 ? "bg-rose-500" : "bg-emerald-600"
                              }`}
                              style={{ width: `${staffPercent}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Amount */}
                      <td className="py-3 px-3 font-semibold text-[#292320] tabular-nums">
                        NPR {s.amount.toLocaleString()}
                      </td>

                      {/* Next Renewal */}
                      <td className="py-3 px-3 text-[#71675E] tabular-nums text-[11px]">
                        {new Date(s.nextRenewal).toLocaleDateString(undefined, {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })}
                      </td>

                      {/* Payment Status */}
                      <td className="py-3 px-3">
                        {s.paymentStatus === "PAID" ? (
                          <span className="text-[11px] font-semibold text-emerald-600">
                            Paid
                          </span>
                        ) : (
                          <span className="text-[11px] font-semibold text-rose-600">
                            Unpaid
                          </span>
                        )}
                      </td>

                      {/* Status ◎ ACTIVE */}
                      <td className="py-3 px-3">
                        {s.status === "ACTIVE" || s.status === "EXPIRING_SOON" ? (
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600">
                            <span className="h-2 w-2 rounded-full border border-emerald-500 flex items-center justify-center shrink-0">
                              <span className="h-1 w-1 rounded-full bg-emerald-500" />
                            </span>
                            <span>ACTIVE</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-rose-600">
                            <span className="h-2 w-2 rounded-full border border-rose-500 flex items-center justify-center shrink-0">
                              <span className="h-1 w-1 rounded-full bg-rose-500" />
                            </span>
                            <span>EXPIRED</span>
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5 text-[#71675E]">
                          <button
                            onClick={() => setInspectItem(s)}
                            title="Inspect details"
                            className="p-1 rounded hover:bg-[#EEE7DD] hover:text-[#292320] transition-colors cursor-pointer"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setRenewItem(s)}
                            title="Renew subscription"
                            className="p-1 rounded hover:bg-[#EEE7DD] hover:text-[#6B2837] transition-colors cursor-pointer"
                          >
                            <RotateCw className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setInspectItem(s)}
                            title="More options"
                            className="p-1 rounded hover:bg-[#EEE7DD] hover:text-[#292320] transition-colors cursor-pointer"
                          >
                            <MoreVertical className="h-3.5 w-3.5" />
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

        {/* Table Footer */}
        <div className="p-3 border-t border-[#D8CEC1]/80 flex flex-col sm:flex-row justify-between items-center gap-2 text-xs text-[#71675E]">
          <div>
            Showing 1 to {filteredSubscriptions.length} of {filteredSubscriptions.length} results
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px]">Rows per page: 10</span>
            <div className="flex items-center gap-1">
              <button className="h-6 w-6 rounded bg-[#6B2837] text-white font-bold flex items-center justify-center text-xs">
                1
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 6. Bottom 3 Analytics Cards Row matching Screenshot 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pt-2">
        {/* Card 1: Plan Distribution */}
        <div className="bg-[#FFFCF7] border border-[#D8CEC1]/80 rounded-lg p-4 space-y-3">
          <h3 className="text-xs font-bold text-[#292320] tracking-tight">Plan Distribution</h3>
          <div className="flex items-center gap-5 pt-1">
            {/* Donut representation */}
            <div className="relative h-24 w-24 shrink-0 flex items-center justify-center">
              <svg className="h-full w-full transform -rotate-90" viewBox="0 0 36 36">
                <circle
                  cx="18"
                  cy="18"
                  r="14"
                  fill="transparent"
                  stroke="#EEE7DD"
                  strokeWidth="5"
                />
                <circle
                  cx="18"
                  cy="18"
                  r="14"
                  fill="transparent"
                  stroke="#6B2837"
                  strokeWidth="5"
                  strokeDasharray="60 100"
                  strokeLinecap="round"
                />
                <circle
                  cx="18"
                  cy="18"
                  r="14"
                  fill="transparent"
                  stroke="#3B82F6"
                  strokeWidth="5"
                  strokeDasharray="25 100"
                  strokeDashoffset="-60"
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="text-sm font-bold text-[#292320]">{subscriptions.length}</span>
                <span className="text-[9px] text-[#71675E]">Total</span>
              </div>
            </div>

            {/* Legend list */}
            <div className="flex-1 space-y-1.5 text-xs">
              {planDistribution.map((item) => (
                <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-[#292320] font-medium text-[11px]">{item.name}</span>
                  </div>
                  <div className="text-[#71675E] text-[11px] tabular-nums">
                    {item.count} <span className="opacity-75">({item.percentage}%)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Card 2: MRR / Revenue Trend */}
        <div className="bg-[#FFFCF7] border border-[#D8CEC1]/80 rounded-lg p-4 space-y-3">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-semibold text-[#71675E]">MRR / Revenue Trend</p>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-base font-bold text-[#292320] tabular-nums">
                  NPR {(kpis.mrr / 1000).toFixed(2)}k
                </span>
                <span className="text-[10px] text-emerald-700 font-semibold flex items-center">
                  <ArrowUpRight className="h-3 w-3" /> +15.3% vs last month
                </span>
              </div>
            </div>
            <span className="text-[10px] text-[#71675E] border border-[#D8CEC1] px-2 py-0.5 rounded">
              This Month
            </span>
          </div>

          {/* Area chart simulation */}
          <div className="h-20 w-full pt-2">
            <svg className="w-full h-full overflow-visible" viewBox="0 0 200 60" preserveAspectRatio="none">
              <defs>
                <linearGradient id="mrrGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#6B2837" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#6B2837" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <path
                d="M0,50 Q40,35 80,40 T160,20 T200,10 L200,60 L0,60 Z"
                fill="url(#mrrGrad)"
              />
              <path
                d="M0,50 Q40,35 80,40 T160,20 T200,10"
                fill="none"
                stroke="#6B2837"
                strokeWidth="2"
              />
            </svg>
            <div className="flex justify-between text-[9px] text-[#71675E] pt-1">
              <span>May 1</span>
              <span>May 8</span>
              <span>May 15</span>
              <span>May 22</span>
              <span>May 30</span>
            </div>
          </div>
        </div>

        {/* Card 3: Recent Billing Activity */}
        <div className="bg-[#FFFCF7] border border-[#D8CEC1]/80 rounded-lg p-4 space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-bold text-[#292320]">Recent Billing Activity</h3>
            <Link
              href="/dashboard/super-admin/revenue"
              className="text-[11px] text-[#6B2837] font-semibold hover:underline"
            >
              View Invoices →
            </Link>
          </div>

          <div className="space-y-2.5">
            {recentActivity.map((act) => (
              <div key={act.id} className="flex items-start gap-2 text-xs">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 mt-1.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[#292320] font-medium leading-tight truncate">
                    {act.title}
                  </p>
                  <p className="text-[10px] text-[#71675E] tabular-nums mt-0.5">
                    {act.currency} {act.amount?.toLocaleString()} • {act.invoiceNumber}
                  </p>
                </div>
                <span className="text-[10px] text-[#71675E] shrink-0">
                  {new Date(act.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* MODAL: Inspect Details */}
      {inspectItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg max-w-md w-full p-5 space-y-4 shadow-md text-[#292320]">
            <div className="flex justify-between items-start border-b border-[#D8CEC1] pb-3">
              <div>
                <h3 className="text-sm font-bold text-[#292320]">Subscription Details</h3>
                <p className="text-xs text-[#71675E] mt-0.5">{inspectItem.businessName}</p>
              </div>
              <button
                onClick={() => setInspectItem(null)}
                className="text-[#71675E] hover:text-[#292320] p-1 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="p-3 bg-[#F7F3EC] rounded-md border border-[#D8CEC1] space-y-1">
                <p className="text-[10px] font-bold text-[#71675E] uppercase tracking-wider">Plan & Billing</p>
                <p className="font-semibold text-[#292320] text-sm">{inspectItem.plan} ({inspectItem.billingCycle})</p>
                <p className="text-[#71675E]">Rate: NPR {inspectItem.amount.toLocaleString()} / period</p>
                <p className="text-[#71675E]">Payment Status: <span className="font-bold text-emerald-700">{inspectItem.paymentStatus}</span></p>
              </div>

              <div className="p-3 bg-[#F7F3EC] rounded-md border border-[#D8CEC1] space-y-1">
                <p className="text-[10px] font-bold text-[#71675E] uppercase tracking-wider">Hospitality Resource Limits</p>
                <p className="text-[#292320]">Dining Tables & Rooms: <span className="font-bold">{inspectItem.tablesUsed}</span> / {inspectItem.tableLimit}</p>
                <p className="text-[#292320]">Staff & Cashier Accounts: <span className="font-bold">{inspectItem.staffUsed}</span> / {inspectItem.staffLimit}</p>
              </div>

              <div className="p-3 bg-[#F7F3EC] rounded-md border border-[#D8CEC1] space-y-1">
                <p className="text-[10px] font-bold text-[#71675E] uppercase tracking-wider">Renewal Timeline</p>
                <p className="text-[#71675E]">Active Since: {new Date(inspectItem.createdAt).toLocaleDateString()}</p>
                <p className="text-[#71675E]">Next Renewal Date: <span className="font-bold text-[#292320]">{new Date(inspectItem.nextRenewal).toLocaleDateString()}</span></p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#D8CEC1]">
              <button
                onClick={() => setInspectItem(null)}
                className="px-3.5 py-1.5 border border-[#D8CEC1] text-xs font-semibold rounded-md bg-[#FFFCF7] text-[#292320] hover:bg-[#F7F3EC] cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Renew Subscription */}
      {renewItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg max-w-sm w-full p-5 space-y-4 shadow-md text-[#292320]">
            <div className="flex justify-between items-start border-b border-[#D8CEC1] pb-3">
              <div>
                <h3 className="text-sm font-bold text-[#292320]">Renew Subscription</h3>
                <p className="text-xs text-[#71675E] mt-0.5">{renewItem.businessName}</p>
              </div>
              <button
                onClick={() => setRenewItem(null)}
                className="text-[#71675E] hover:text-[#292320] p-1 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleRenew} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-[#71675E] uppercase mb-1">
                  Extension Duration
                </label>
                <select
                  value={renewMonths}
                  onChange={(e) => setRenewMonths(Number(e.target.value))}
                  className="w-full p-2 bg-[#F7F3EC] border border-[#D8CEC1] rounded-md text-xs text-[#292320]"
                >
                  <option value={1}>1 Month Extension</option>
                  <option value={3}>3 Months Extension</option>
                  <option value={6}>6 Months Extension</option>
                  <option value={12}>1 Year Extension</option>
                </select>
              </div>

              <div className="p-3 bg-[#FAF2F4] border border-[#E8D7DA] rounded-md text-xs space-y-1">
                <p className="text-[#6B2837] font-semibold">Active Plan: {renewItem.plan}</p>
                <p className="text-[11px] text-[#71675E]">This will push the renewal date forward and mark the subscription status as Active.</p>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#D8CEC1]">
                <button
                  type="button"
                  onClick={() => setRenewItem(null)}
                  className="px-3 py-1.5 border border-[#D8CEC1] text-xs font-semibold rounded-md hover:bg-[#F7F3EC] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 bg-[#6B2837] text-white text-xs font-semibold rounded-md hover:bg-[#521E2A] disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? "Extending..." : "Confirm Extension"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Add / Assign Subscription */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg max-w-md w-full p-5 space-y-4 shadow-md text-[#292320]">
            <div className="flex justify-between items-start border-b border-[#D8CEC1] pb-3">
              <div>
                <h3 className="text-sm font-bold text-[#292320]">Assign Subscription Plan</h3>
                <p className="text-xs text-[#71675E] mt-0.5">Activate or upgrade a restaurant / hotel property.</p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-[#71675E] hover:text-[#292320] p-1 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAddSubscription} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-[#71675E] uppercase mb-1">
                  Target Restaurant / Property <span className="text-rose-600">*</span>
                </label>
                <select
                  required
                  value={newBusinessId}
                  onChange={(e) => setNewBusinessId(e.target.value)}
                  className="w-full p-2 bg-[#F7F3EC] border border-[#D8CEC1] rounded-md text-xs text-[#292320]"
                >
                  <option value="">Select a property...</option>
                  {subscriptions.map((s) => (
                    <option key={s.businessId} value={s.businessId}>
                      {s.businessName} ({s.businessLocation})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#71675E] uppercase mb-1">
                    Select Plan Tier
                  </label>
                  <select
                    value={newPlan}
                    onChange={(e) => setNewPlan(e.target.value)}
                    className="w-full p-2 bg-[#F7F3EC] border border-[#D8CEC1] rounded-md text-xs text-[#292320]"
                  >
                    <option value="Starter">Starter (NPR 700/mo)</option>
                    <option value="Standard">Standard (NPR 1,200/mo)</option>
                    <option value="Professional">Professional (NPR 2,000/mo)</option>
                    <option value="Enterprise">Enterprise (Custom)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#71675E] uppercase mb-1">
                    Billing Cycle
                  </label>
                  <select
                    value={newCycle}
                    onChange={(e) => setNewCycle(e.target.value)}
                    className="w-full p-2 bg-[#F7F3EC] border border-[#D8CEC1] rounded-md text-xs text-[#292320]"
                  >
                    <option value="MONTHLY">Monthly</option>
                    <option value="ANNUAL">Annual (10 Months Rate)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#D8CEC1]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 border border-[#D8CEC1] text-xs font-semibold rounded-md hover:bg-[#F7F3EC] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 bg-[#6B2837] text-white text-xs font-semibold rounded-md hover:bg-[#521E2A] disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? "Activating..." : "Activate Plan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
