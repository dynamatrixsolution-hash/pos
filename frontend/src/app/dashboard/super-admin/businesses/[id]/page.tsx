"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Notify } from "@/lib/notify";
import {
  ArrowLeft,
  Building,
  Shield,
  CreditCard,
  LifeBuoy,
  History,
  CheckCircle2,
  AlertTriangle,
  Clock,
  KeyRound,
  Ban,
  UserCheck,
  Send,
  Plus,
  Copy,
  Check,
  RefreshCw,
  Sliders,
  DollarSign,
  FileText,
  Lock,
} from "lucide-react";

interface Branch {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  isMain: boolean;
  isActive: boolean;
}

interface UserSummary {
  id: string;
  name: string;
  email: string;
  role: string;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
}

interface SubscriptionDetails {
  id: string;
  plan: string;
  status: string;
  billingCycle: string;
  packageType: string;
  enabledModules: string[];
  customLimits: any;
  startDate: string;
  endDate: string;
  trialEndsAt: string | null;
  gracePeriodDays: number;
  userLimit: number;
  branchLimit: number;
}

interface InvoicePayment {
  id: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  reference: string | null;
  recordedAt: string;
  recordedBy?: { name: string; email: string };
}

interface SubscriptionInvoice {
  id: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  status: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  dueDate: string;
  paidAt: string | null;
  notes: string | null;
  payments: InvoicePayment[];
}

interface SupportNote {
  id: string;
  title: string;
  content: string;
  priority: string;
  category: string;
  isResolved: boolean;
  resolvedAt: string | null;
  createdAt: string;
  author: { name: string; email: string };
}

interface AuditLogEntry {
  id: string;
  action: string;
  reason: string;
  targetType: string;
  beforeState: any;
  afterState: any;
  createdAt: string;
  actor: { name: string; email: string };
}

interface BusinessDetail {
  id: string;
  name: string;
  slug: string;
  currency: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  status: "ACTIVE" | "SUSPENDED" | "PENDING" | "CLOSED";
  suspendedReason: string | null;
  suspendedAt: string | null;
  createdAt: string;
  branches: Branch[];
  users: UserSummary[];
  subscription: SubscriptionDetails | null;
  subscriptionInvoices: SubscriptionInvoice[];
  subscriptionPayments: any[];
  platformSupportNotes: SupportNote[];
  platformAuditLogs: AuditLogEntry[];
  metrics: {
    totalInvoiced: number;
    totalPaid: number;
    balanceDue: number;
    branchCount: number;
    userCount: number;
  };
}

const ALL_HOSPITALITY_MODULES = [
  { key: "POS", label: "Point of Sale", desc: "Fast bar & dining counter billing" },
  { key: "TABLES", label: "Table Management", desc: "Floor zones & active dining sessions" },
  { key: "MENU", label: "Dining Menus", desc: "Food, beverage, and modifier groups" },
  { key: "KDS", label: "Kitchen Display (KDS)", desc: "Cook ticket routing & prep stations" },
  { key: "ROOMS", label: "Room Inventory", desc: "Room types, numbers & clean status" },
  { key: "RESERVATIONS", label: "Front Desk & Stays", desc: "Guest booking, check-in & checkout" },
  { key: "HOUSEKEEPING", label: "Housekeeping Desk", desc: "Room maid tasks & priority turnaround" },
  { key: "FOLIOS", label: "Guest Folios", desc: "Room night charges, deposits & settlements" },
  { key: "ROOM_SERVICE", label: "Room Service Orders", desc: "Cross-charging restaurant bills to room folios" },
];

export default function BusinessDetailPage() {
  const params = useParams();
  const router = useRouter();
  const businessId = params.id as string;

  const [business, setBusiness] = useState<BusinessDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "subscription" | "billing" | "support" | "activity">("overview");

  // Modals & Action States
  const [actionLoading, setActionLoading] = useState(false);
  const [suspendModalOpen, setSuspendModalOpen] = useState(false);
  const [suspendReason, setSuspendReason] = useState("");

  const [subEditModalOpen, setSubEditModalOpen] = useState(false);
  const [editPlan, setEditPlan] = useState("STARTER");
  const [editPackage, setEditPackage] = useState("RESTAURANT");
  const [editBillingCycle, setEditBillingCycle] = useState("MONTHLY");
  const [editModules, setEditModules] = useState<string[]>([]);
  const [editUserLimit, setEditUserLimit] = useState(5);
  const [editBranchLimit, setEditBranchLimit] = useState(1);
  const [editReason, setEditReason] = useState("");

  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<SubscriptionInvoice | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState("BANK_TRANSFER");
  const [paymentRef, setPaymentRef] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [paymentReason, setPaymentReason] = useState("");

  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [notePriority, setNotePriority] = useState("NORMAL");
  const [noteCategory, setNoteCategory] = useState("GENERAL");

  const [resetInviteUrl, setResetInviteUrl] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const fetchBusinessData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/v1/super-admin/businesses/${businessId}`);
      if (!res.ok) {
        throw new Error("Failed to load business details");
      }
      const data = await res.json();
      setBusiness(data.business);

      if (data.business.subscription) {
        const sub = data.business.subscription;
        setEditPlan(sub.plan || "STARTER");
        setEditPackage(sub.packageType || "RESTAURANT");
        setEditBillingCycle(sub.billingCycle || "MONTHLY");
        setEditModules(sub.enabledModules || []);
        setEditUserLimit(sub.userLimit || 5);
        setEditBranchLimit(sub.branchLimit || 1);
      }
    } catch (err: any) {
      Notify.error(err.message || "Failed to load business details");
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    fetchBusinessData();
  }, [fetchBusinessData]);

  // Quick module toggle handler
  const toggleModule = (moduleKey: string) => {
    setEditModules((prev) =>
      prev.includes(moduleKey) ? prev.filter((m) => m !== moduleKey) : [...prev, moduleKey]
    );
  };

  // 1. Suspend Business
  const handleSuspend = async () => {
    if (!suspendReason.trim()) {
      Notify.warning("Please provide a mandatory reason for suspending this tenant account.");
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch(`/api/v1/super-admin/businesses/${businessId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "SUSPEND",
          payload: { reason: suspendReason.trim() },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to suspend account");

      Notify.success("Account suspended successfully. Active tenant sessions terminated.");
      setSuspendModalOpen(false);
      setSuspendReason("");
      fetchBusinessData();
    } catch (err: any) {
      Notify.error(err.message || "Failed to suspend business");
    } finally {
      setActionLoading(false);
    }
  };

  // 2. Reactivate Business
  const handleActivate = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/v1/super-admin/businesses/${businessId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ACTIVATE",
          payload: { reason: "Account reactivated by platform administration" },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reactivate account");

      Notify.success("Account reactivated successfully.");
      fetchBusinessData();
    } catch (err: any) {
      Notify.error(err.message || "Failed to reactivate business");
    } finally {
      setActionLoading(false);
    }
  };

  // 3. Save Subscription & Module Entitlements
  const handleSaveSubscription = async () => {
    if (!editReason.trim()) {
      Notify.warning("A mandatory audit reason is required when modifying tenant subscription & modules.");
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch(`/api/v1/super-admin/businesses/${businessId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "UPDATE_SUBSCRIPTION",
          payload: {
            plan: editPlan,
            packageType: editPackage,
            billingCycle: editBillingCycle,
            enabledModules: editModules,
            userLimit: Number(editUserLimit),
            branchLimit: Number(editBranchLimit),
            reason: editReason.trim(),
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update subscription");

      Notify.success("Subscription & module entitlements updated.");
      setSubEditModalOpen(false);
      setEditReason("");
      fetchBusinessData();
    } catch (err: any) {
      Notify.error(err.message || "Failed to update subscription");
    } finally {
      setActionLoading(false);
    }
  };

  // 4. Record SaaS Subscription Payment
  const handleRecordPayment = async () => {
    if (!selectedInvoice) return;
    if (paymentAmount <= 0) {
      Notify.warning("Please enter a valid payment amount greater than zero.");
      return;
    }
    if (!paymentReason.trim()) {
      Notify.warning("A reason/reference description is required for audit logs.");
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch(`/api/v1/super-admin/businesses/${businessId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "RECORD_PAYMENT",
          payload: {
            invoiceId: selectedInvoice.id,
            amount: paymentAmount,
            paymentMethod,
            reference: paymentRef,
            notes: paymentNotes,
            reason: paymentReason.trim(),
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to record payment");

      Notify.success("SaaS subscription payment recorded.");
      setPaymentModalOpen(false);
      setSelectedInvoice(null);
      setPaymentAmount(0);
      setPaymentRef("");
      setPaymentNotes("");
      setPaymentReason("");
      fetchBusinessData();
    } catch (err: any) {
      Notify.error(err.message || "Failed to record payment");
    } finally {
      setActionLoading(false);
    }
  };

  // 5. Generate Owner Password Reset Invitation
  const handleDispatchPasswordReset = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/v1/super-admin/businesses/${businessId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "DISPATCH_PASSWORD_RESET",
          payload: { reason: "Super Admin generated owner password reset invitation link" },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate reset link");

      setResetInviteUrl(data.inviteUrl);
      Notify.success(data.message || "Password reset invitation generated.");
      fetchBusinessData();
    } catch (err: any) {
      Notify.error(err.message || "Failed to generate password reset invitation");
    } finally {
      setActionLoading(false);
    }
  };

  // 6. Revoke All Sessions
  const handleRevokeSessions = async () => {
    if (!confirm("Are you sure you want to revoke all active sessions for this business? Users will be forced to log in again.")) {
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch(`/api/v1/super-admin/businesses/${businessId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "REVOKE_SESSIONS",
          payload: { reason: "Security access recovery: administrative session termination" },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to revoke sessions");

      Notify.success("All tenant sessions revoked successfully.");
      fetchBusinessData();
    } catch (err: any) {
      Notify.error(err.message || "Failed to revoke sessions");
    } finally {
      setActionLoading(false);
    }
  };

  // 7. Add Internal Support Note
  const handleAddNote = async () => {
    if (!noteTitle.trim() || !noteContent.trim()) {
      Notify.warning("Please provide both title and content for the support note.");
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch(`/api/v1/super-admin/businesses/${businessId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ADD_SUPPORT_NOTE",
          payload: {
            title: noteTitle.trim(),
            content: noteContent.trim(),
            priority: notePriority,
            category: noteCategory,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to log note");

      Notify.success("Internal support note logged.");
      setNoteModalOpen(false);
      setNoteTitle("");
      setNoteContent("");
      fetchBusinessData();
    } catch (err: any) {
      Notify.error(err.message || "Failed to save support note");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 max-w-7xl mx-auto space-y-6">
        <div className="h-8 w-48 bg-[#EEE7DD] animate-pulse rounded-md" />
        <div className="h-40 bg-[#EEE7DD] animate-pulse rounded-lg" />
        <div className="h-96 bg-[#EEE7DD] animate-pulse rounded-lg" />
      </div>
    );
  }

  if (!business) {
    return (
      <div className="p-12 text-center max-w-md mx-auto">
        <AlertTriangle className="h-10 w-10 text-[#B91C1C] mx-auto mb-3" />
        <h2 className="text-lg font-bold text-[#292320]">Business Not Found</h2>
        <p className="text-sm text-[#71675E] mt-1">This business does not exist or may have been removed.</p>
        <Link
          href="/dashboard/super-admin/businesses"
          className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-[#6B2837] text-[#FFFCF7] text-xs font-semibold rounded-md"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Return to Directory
        </Link>
      </div>
    );
  }

  const owner = business.users.find((u) => u.role === "OWNER") || business.users[0];

  return (
    <div className="min-h-screen bg-[#F7F3EC] p-6 sm:p-8 text-[#292320]">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link
            href="/dashboard/super-admin/businesses"
            className="inline-flex items-center gap-2 text-xs font-semibold text-[#71675E] hover:text-[#292320] transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Business Directory
          </Link>

          <div className="flex items-center gap-2">
            {business.status === "SUSPENDED" ? (
              <button
                onClick={handleActivate}
                disabled={actionLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#15803D] hover:bg-[#15803D]/90 text-[#FFFCF7] text-xs font-bold rounded-md transition-colors shadow-sm disabled:opacity-50"
              >
                <UserCheck className="h-3.5 w-3.5" /> Activate Business
              </button>
            ) : (
              <button
                onClick={() => setSuspendModalOpen(true)}
                disabled={actionLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#B91C1C] hover:bg-[#B91C1C]/90 text-[#FFFCF7] text-xs font-bold rounded-md transition-colors shadow-sm disabled:opacity-50"
              >
                <Ban className="h-3.5 w-3.5" /> Suspend Business
              </button>
            )}
          </div>
        </div>

        {/* Business Header Card */}
        <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg p-6 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight text-[#292320]">{business.name}</h1>
                <span
                  className={`px-2.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider border ${
                    business.status === "ACTIVE"
                      ? "bg-[#15803D]/10 text-[#15803D] border-[#15803D]/20"
                      : business.status === "SUSPENDED"
                      ? "bg-[#B91C1C]/10 text-[#B91C1C] border-[#B91C1C]/20"
                      : "bg-[#B45309]/10 text-[#B45309] border-[#B45309]/20"
                  }`}
                >
                  {business.status}
                </span>
                <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-[#EEE7DD] text-[#71675E] border border-[#D8CEC1]">
                  {business.subscription?.packageType || "RESTAURANT"}
                </span>
              </div>
              <p className="text-xs text-[#71675E]">
                Workspace Slug: <span className="font-mono text-[#292320]">{business.slug}.restroinn.com</span> • Currency:{" "}
                <span className="font-semibold text-[#292320]">{business.currency}</span> • ID:{" "}
                <span className="font-mono text-[11px] text-[#71675E]">{business.id}</span>
              </p>
              {business.suspendedReason && (
                <div className="mt-2 text-xs text-[#B91C1C] bg-[#B91C1C]/10 px-3 py-1.5 rounded-md border border-[#B91C1C]/20">
                  <span className="font-bold">Suspension Notice:</span> {business.suspendedReason}
                </div>
              )}
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-[#F7F3EC] p-3 rounded-md border border-[#EEE7DD] text-center min-w-[100px]">
                <div className="text-[10px] uppercase font-bold text-[#71675E]">Branches</div>
                <div className="text-base font-bold tabular-nums text-[#292320] mt-0.5">
                  {business.metrics.branchCount}
                </div>
              </div>
              <div className="bg-[#F7F3EC] p-3 rounded-md border border-[#EEE7DD] text-center min-w-[100px]">
                <div className="text-[10px] uppercase font-bold text-[#71675E]">Staff Users</div>
                <div className="text-base font-bold tabular-nums text-[#292320] mt-0.5">
                  {business.metrics.userCount}
                </div>
              </div>
              <div className="bg-[#F7F3EC] p-3 rounded-md border border-[#EEE7DD] text-center min-w-[110px]">
                <div className="text-[10px] uppercase font-bold text-[#71675E]">Balance Due</div>
                <div className="text-base font-bold tabular-nums text-[#6B2837] mt-0.5">
                  Rs. {business.metrics.balanceDue.toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          {/* Canonical 5-Tab Bar */}
          <div className="flex border-b border-[#D8CEC1] gap-6 mt-6 pt-2">
            {[
              { id: "overview", label: "Overview", icon: Building },
              { id: "subscription", label: "Subscription & Modules", icon: Sliders },
              { id: "billing", label: "Billing & Invoices", icon: CreditCard },
              { id: "support", label: "Support & Recovery", icon: LifeBuoy },
              { id: "activity", label: "Activity & Audit", icon: History },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`pb-3 text-xs font-bold transition-all border-b-2 uppercase tracking-wider flex items-center gap-1.5 cursor-pointer ${
                    isActive
                      ? "border-[#6B2837] text-[#6B2837]"
                      : "border-transparent text-[#71675E] hover:text-[#292320]"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* TAB 1: OVERVIEW */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Identity & Owner */}
            <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg p-5 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#71675E] border-b border-[#EEE7DD] pb-2">
                Business Identity & Owner
              </h3>
              <div className="space-y-3 text-xs">
                <div className="flex justify-between py-1 border-b border-[#EEE7DD]/60">
                  <span className="text-[#71675E]">Legal Name</span>
                  <span className="font-semibold text-[#292320]">{business.name}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#EEE7DD]/60">
                  <span className="text-[#71675E]">Registered Email</span>
                  <span className="font-semibold text-[#292320]">{business.email || "Not specified"}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#EEE7DD]/60">
                  <span className="text-[#71675E]">Contact Phone</span>
                  <span className="font-semibold text-[#292320]">{business.phone || "Not specified"}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#EEE7DD]/60">
                  <span className="text-[#71675E]">Physical Address</span>
                  <span className="font-semibold text-[#292320]">{business.address || "Not specified"}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#EEE7DD]/60">
                  <span className="text-[#71675E]">Account Owner</span>
                  <span className="font-semibold text-[#292320]">{owner?.name || "No Owner Assigned"}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#EEE7DD]/60">
                  <span className="text-[#71675E]">Owner Login Email</span>
                  <span className="font-mono text-[#292320]">{owner?.email || "N/A"}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-[#71675E]">Created Date</span>
                  <span className="font-semibold tabular-nums text-[#292320]">
                    {new Date(business.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Branches List */}
            <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-[#EEE7DD] pb-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#71675E]">
                  Provisioned Branches ({business.branches.length})
                </h3>
              </div>
              <div className="divide-y divide-[#EEE7DD] max-h-72 overflow-y-auto">
                {business.branches.map((b) => (
                  <div key={b.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-[#292320] flex items-center gap-2">
                        {b.name}
                        {b.isMain && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 bg-[#6B2837]/10 text-[#6B2837] rounded">
                            Main Desk
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#71675E]">{b.address || "No address assigned"}</div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        b.isActive ? "bg-[#15803D]/10 text-[#15803D]" : "bg-[#B91C1C]/10 text-[#B91C1C]"
                      }`}
                    >
                      {b.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: SUBSCRIPTION & MODULES */}
        {activeTab === "subscription" && (
          <div className="space-y-6">
            <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg p-6">
              <div className="flex items-center justify-between border-b border-[#EEE7DD] pb-4 mb-4">
                <div>
                  <h3 className="text-sm font-bold text-[#292320]">Plan & Hospitality Package</h3>
                  <p className="text-xs text-[#71675E]">
                    Control package tier, active modules, and platform limits. Server strictly blocks unauthorized modules.
                  </p>
                </div>
                <button
                  onClick={() => setSubEditModalOpen(true)}
                  className="px-3.5 py-1.5 bg-[#6B2837] text-[#FFFCF7] text-xs font-bold rounded-md hover:bg-[#6B2837]/90 transition-colors"
                >
                  Edit Package & Entitlements
                </button>
              </div>

              {business.subscription ? (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs mb-6">
                  <div className="bg-[#F7F3EC] p-3.5 rounded-md border border-[#EEE7DD]">
                    <div className="text-[#71675E] font-medium text-[11px]">Subscription Plan</div>
                    <div className="font-black text-[#292320] text-sm mt-0.5 uppercase tracking-wide">
                      {business.subscription.plan}
                    </div>
                  </div>
                  <div className="bg-[#F7F3EC] p-3.5 rounded-md border border-[#EEE7DD]">
                    <div className="text-[#71675E] font-medium text-[11px]">Package Domain</div>
                    <div className="font-black text-[#292320] text-sm mt-0.5 uppercase tracking-wide">
                      {business.subscription.packageType}
                    </div>
                  </div>
                  <div className="bg-[#F7F3EC] p-3.5 rounded-md border border-[#EEE7DD]">
                    <div className="text-[#71675E] font-medium text-[11px]">Billing Cycle</div>
                    <div className="font-black text-[#292320] text-sm mt-0.5 uppercase tracking-wide">
                      {business.subscription.billingCycle}
                    </div>
                  </div>
                  <div className="bg-[#F7F3EC] p-3.5 rounded-md border border-[#EEE7DD]">
                    <div className="text-[#71675E] font-medium text-[11px]">Renewal Date</div>
                    <div className="font-black text-[#292320] text-sm mt-0.5 tabular-nums">
                      {new Date(business.subscription.endDate).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-[#B45309]/10 text-[#B45309] rounded-md text-xs font-bold mb-6">
                  No subscription currently active for this business.
                </div>
              )}

              {/* Active Modules Grid */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#71675E]">
                  Server-Enforced Hospitality Modules
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {ALL_HOSPITALITY_MODULES.map((mod) => {
                    const isEnabled = business.subscription?.enabledModules?.includes(mod.key);
                    return (
                      <div
                        key={mod.key}
                        className={`p-3 rounded-md border transition-all ${
                          isEnabled
                            ? "bg-[#15803D]/5 border-[#15803D]/30"
                            : "bg-[#F7F3EC]/50 border-[#EEE7DD] opacity-60"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-[#292320]">{mod.label}</span>
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              isEnabled ? "bg-[#15803D] text-[#FFFCF7]" : "bg-[#D8CEC1] text-[#71675E]"
                            }`}
                          >
                            {isEnabled ? "Enabled" : "Disabled"}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#71675E] mt-1">{mod.desc}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Resource Limits */}
              <div className="mt-6 pt-4 border-t border-[#EEE7DD]">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#71675E] mb-3">Resource Limits</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="bg-[#F7F3EC] p-3 rounded-md border border-[#EEE7DD]">
                    <span className="text-[#71675E]">Max Staff Users</span>
                    <div className="font-bold tabular-nums text-sm text-[#292320] mt-0.5">
                      {business.subscription?.userLimit || 5}
                    </div>
                  </div>
                  <div className="bg-[#F7F3EC] p-3 rounded-md border border-[#EEE7DD]">
                    <span className="text-[#71675E]">Max Branches</span>
                    <div className="font-bold tabular-nums text-sm text-[#292320] mt-0.5">
                      {business.subscription?.branchLimit || 1}
                    </div>
                  </div>
                  <div className="bg-[#F7F3EC] p-3 rounded-md border border-[#EEE7DD]">
                    <span className="text-[#71675E]">Hotel Rooms Limit</span>
                    <div className="font-bold tabular-nums text-sm text-[#292320] mt-0.5">
                      {business.subscription?.customLimits?.roomsLimit || "Uncapped"}
                    </div>
                  </div>
                  <div className="bg-[#F7F3EC] p-3 rounded-md border border-[#EEE7DD]">
                    <span className="text-[#71675E]">Restaurant Tables Limit</span>
                    <div className="font-bold tabular-nums text-sm text-[#292320] mt-0.5">
                      {business.subscription?.customLimits?.tablesLimit || "Uncapped"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: BILLING & INVOICES */}
        {activeTab === "billing" && (
          <div className="space-y-6">
            {/* SaaS Invoices Table */}
            <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg p-6">
              <div className="flex items-center justify-between border-b border-[#EEE7DD] pb-4 mb-4">
                <div>
                  <h3 className="text-sm font-bold text-[#292320]">RestroInn Platform Subscription Invoices</h3>
                  <p className="text-xs text-[#71675E]">
                    SaaS subscription charges payable to RestroInn. (Tenant restaurant sales are kept strictly separate).
                  </p>
                </div>
              </div>

              {business.subscriptionInvoices.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#71675E]">
                  No subscription invoices recorded yet for this business.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#D8CEC1] text-[#71675E] font-bold uppercase tracking-wider text-[10px] pb-2">
                        <th className="py-2.5 px-3">Invoice Number</th>
                        <th className="py-2.5 px-3">Billing Period</th>
                        <th className="py-2.5 px-3">Due Date</th>
                        <th className="py-2.5 px-3 text-right">Amount</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EEE7DD]">
                      {business.subscriptionInvoices.map((inv) => {
                        const totalPaid = inv.payments.reduce((s, p) => s + Number(p.amount), 0);
                        const isPaid = inv.status === "PAID" || totalPaid >= Number(inv.amount);
                        return (
                          <tr key={inv.id} className="hover:bg-[#F7F3EC]/50 transition-colors">
                            <td className="py-3 px-3 font-mono font-bold text-[#292320]">{inv.invoiceNumber}</td>
                            <td className="py-3 px-3 tabular-nums text-[#71675E]">
                              {new Date(inv.billingPeriodStart).toLocaleDateString()} –{" "}
                              {new Date(inv.billingPeriodEnd).toLocaleDateString()}
                            </td>
                            <td className="py-3 px-3 tabular-nums text-[#71675E]">
                              {new Date(inv.dueDate).toLocaleDateString()}
                            </td>
                            <td className="py-3 px-3 text-right font-bold tabular-nums text-[#292320]">
                              Rs. {Number(inv.amount).toLocaleString()}
                            </td>
                            <td className="py-3 px-3 text-center">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${
                                  isPaid
                                    ? "bg-[#15803D]/10 text-[#15803D] border-[#15803D]/20"
                                    : inv.status === "OVERDUE"
                                    ? "bg-[#B91C1C]/10 text-[#B91C1C] border-[#B91C1C]/20"
                                    : "bg-[#B45309]/10 text-[#B45309] border-[#B45309]/20"
                                }`}
                              >
                                {isPaid ? "PAID" : inv.status}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right">
                              {!isPaid && (
                                <button
                                  onClick={() => {
                                    setSelectedInvoice(inv);
                                    setPaymentAmount(Number(inv.amount) - totalPaid);
                                    setPaymentModalOpen(true);
                                  }}
                                  className="px-2.5 py-1 bg-[#15803D] text-[#FFFCF7] text-[11px] font-bold rounded hover:bg-[#15803D]/90 transition-colors"
                                >
                                  Record Payment
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Payments Ledger */}
            <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg p-6">
              <h3 className="text-sm font-bold text-[#292320] border-b border-[#EEE7DD] pb-3 mb-4">
                Platform Payment Receipts
              </h3>
              {business.subscriptionPayments.length === 0 ? (
                <div className="py-6 text-center text-xs text-[#71675E]">No payment receipts logged yet.</div>
              ) : (
                <div className="divide-y divide-[#EEE7DD]">
                  {business.subscriptionPayments.map((p) => (
                    <div key={p.id} className="py-3 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-bold text-[#292320]">
                          Rs. {Number(p.amount).toLocaleString()}{" "}
                          <span className="text-[#71675E] font-normal">via {p.paymentMethod}</span>
                        </div>
                        <div className="text-[11px] text-[#71675E] mt-0.5">
                          Ref: <span className="font-mono">{p.reference || "N/A"}</span> • Invoice:{" "}
                          <span className="font-mono">{p.invoice?.invoiceNumber || "N/A"}</span>
                        </div>
                      </div>
                      <div className="text-right tabular-nums text-[#71675E] text-[11px]">
                        <div>{new Date(p.recordedAt).toLocaleDateString()}</div>
                        <div className="text-[10px]">By {p.recordedBy?.name || "Super Admin"}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: SUPPORT & ACCESS RECOVERY */}
        {activeTab === "support" && (
          <div className="space-y-6">
            {/* Access Recovery & Credentials Security Card */}
            <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg p-6">
              <h3 className="text-sm font-bold text-[#292320] border-b border-[#EEE7DD] pb-3 mb-4">
                Support & Credential Recovery
              </h3>
              <p className="text-xs text-[#71675E] mb-4">
                RestroInn enforces strict zero-knowledge security: super admins can never view or manually set passwords
                for business owners. Use one-time invitations or session termination.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-[#F7F3EC] p-4 rounded-md border border-[#EEE7DD] space-y-2">
                  <div className="flex items-center gap-2 font-bold text-xs text-[#292320]">
                    <KeyRound className="h-4 w-4 text-[#6B2837]" />
                    Send Owner Password Reset Invitation
                  </div>
                  <p className="text-[11px] text-[#71675E]">
                    Generates a cryptographically secure 24-hour single-use token sent to{" "}
                    <span className="font-mono font-bold text-[#292320]">{owner?.email}</span>.
                  </p>
                  <button
                    onClick={handleDispatchPasswordReset}
                    disabled={actionLoading}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#6B2837] text-[#FFFCF7] text-xs font-bold rounded hover:bg-[#6B2837]/90 transition-colors disabled:opacity-50"
                  >
                    <Send className="h-3.5 w-3.5" /> Generate Reset Link
                  </button>

                  {resetInviteUrl && (
                    <div className="mt-3 p-3 bg-[#FFFCF7] border border-[#D8CEC1] rounded-md space-y-1">
                      <div className="text-[10px] font-bold text-[#15803D] flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> One-Time Invitation Link Ready:
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          readOnly
                          value={resetInviteUrl}
                          className="w-full text-[11px] font-mono bg-[#F7F3EC] p-1.5 rounded border border-[#D8CEC1]"
                        />
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(resetInviteUrl);
                            setCopiedLink(true);
                            setTimeout(() => setCopiedLink(false), 2000);
                            Notify.success("Invitation link copied to clipboard.");
                          }}
                          className="px-2.5 py-1.5 bg-[#EEE7DD] hover:bg-[#D8CEC1] rounded text-xs font-bold"
                        >
                          {copiedLink ? <Check className="h-3.5 w-3.5 text-[#15803D]" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-[#F7F3EC] p-4 rounded-md border border-[#EEE7DD] space-y-2">
                  <div className="flex items-center gap-2 font-bold text-xs text-[#292320]">
                    <Lock className="h-4 w-4 text-[#B91C1C]" />
                    Revoke Active Tenant Sessions
                  </div>
                  <p className="text-[11px] text-[#71675E]">
                    Terminates all open client sessions immediately if compromise or credential leakage is suspected.
                  </p>
                  <button
                    onClick={handleRevokeSessions}
                    disabled={actionLoading}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#B91C1C] text-[#FFFCF7] text-xs font-bold rounded hover:bg-[#B91C1C]/90 transition-colors disabled:opacity-50"
                  >
                    <Ban className="h-3.5 w-3.5" /> Revoke All Sessions Now
                  </button>
                </div>
              </div>
            </div>

            {/* Internal Notes & Support Requests */}
            <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg p-6">
              <div className="flex items-center justify-between border-b border-[#EEE7DD] pb-3 mb-4">
                <div>
                  <h3 className="text-sm font-bold text-[#292320]">Internal Support Notes</h3>
                  <p className="text-xs text-[#71675E]">Private administrative logs and troubleshooting records.</p>
                </div>
                <button
                  onClick={() => setNoteModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#6B2837] text-[#FFFCF7] text-xs font-bold rounded hover:bg-[#6B2837]/90 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Support Note
                </button>
              </div>

              {business.platformSupportNotes.length === 0 ? (
                <div className="py-6 text-center text-xs text-[#71675E]">No support notes recorded yet.</div>
              ) : (
                <div className="space-y-3">
                  {business.platformSupportNotes.map((note) => (
                    <div key={note.id} className="p-3.5 bg-[#F7F3EC] rounded-md border border-[#EEE7DD] space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-[#292320]">{note.title}</span>
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.2 bg-[#EEE7DD] text-[#71675E] text-[10px] font-bold rounded uppercase">
                            {note.category}
                          </span>
                          <span
                            className={`px-2 py-0.2 text-[10px] font-bold rounded uppercase ${
                              note.priority === "URGENT" || note.priority === "HIGH"
                                ? "bg-[#B91C1C]/10 text-[#B91C1C]"
                                : "bg-[#15803D]/10 text-[#15803D]"
                            }`}
                          >
                            {note.priority}
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-[#71675E]">{note.content}</p>
                      <div className="text-[10px] text-[#71675E] pt-1">
                        By {note.author?.name} on {new Date(note.createdAt).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 5: ACTIVITY & AUDIT LOG */}
        {activeTab === "activity" && (
          <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg p-6">
            <h3 className="text-sm font-bold text-[#292320] border-b border-[#EEE7DD] pb-3 mb-4">
              Platform Audit Trail & Change Diff
            </h3>
            <p className="text-xs text-[#71675E] mb-4">
              All sensitive administrative actions (suspensions, entitlement changes, access recovery) require mandatory
              reasons and are logged permanently.
            </p>

            {business.platformAuditLogs.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#71675E]">No audit logs recorded for this business.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#D8CEC1] text-[#71675E] font-bold uppercase tracking-wider text-[10px] pb-2">
                      <th className="py-2.5 px-3">Timestamp</th>
                      <th className="py-2.5 px-3">Actor</th>
                      <th className="py-2.5 px-3">Action</th>
                      <th className="py-2.5 px-3">Mandatory Reason</th>
                      <th className="py-2.5 px-3">Diff / State</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EEE7DD]">
                    {business.platformAuditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-[#F7F3EC]/50 transition-colors">
                        <td className="py-3 px-3 tabular-nums text-[#71675E] whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                        <td className="py-3 px-3 font-semibold text-[#292320] whitespace-nowrap">
                          {log.actor?.name || "System"}
                        </td>
                        <td className="py-3 px-3">
                          <span className="font-mono text-[10px] bg-[#EEE7DD] text-[#71675E] px-2 py-0.5 rounded font-bold">
                            {log.action}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-[#292320] max-w-xs">{log.reason}</td>
                        <td className="py-3 px-3 font-mono text-[10px] text-[#71675E]">
                          {log.afterState ? (
                            <details className="cursor-pointer">
                              <summary className="text-[#6B2837] hover:underline">View details</summary>
                              <pre className="p-2 bg-[#F7F3EC] rounded mt-1 overflow-x-auto max-w-sm text-[9px]">
                                {JSON.stringify({ before: log.beforeState, after: log.afterState }, null, 2)}
                              </pre>
                            </details>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL 1: SUSPEND ACCOUNT MODAL */}
      {suspendModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#292320]/60 flex items-center justify-center p-4">
          <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-[#B91C1C] flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" /> Confirm Account Suspension
            </h3>
            <p className="text-xs text-[#71675E]">
              Suspending this business will immediately terminate active login sessions and prevent access to all POS,
              hotel, and dining terminals.
            </p>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#292320]">Mandatory Reason for Suspension *</label>
              <textarea
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                placeholder="e.g. Overdue subscription invoice past 30-day grace period; fraud investigation..."
                rows={3}
                className="w-full text-xs p-2.5 border border-[#D8CEC1] rounded-md bg-[#F7F3EC] focus:bg-[#FFFCF7] focus:outline-none focus:border-[#6B2837]"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setSuspendModalOpen(false)}
                className="px-3 py-1.5 text-xs font-bold text-[#71675E] hover:text-[#292320]"
              >
                Cancel
              </button>
              <button
                onClick={handleSuspend}
                disabled={actionLoading || !suspendReason.trim()}
                className="px-4 py-1.5 bg-[#B91C1C] hover:bg-[#B91C1C]/90 text-[#FFFCF7] text-xs font-bold rounded-md disabled:opacity-50"
              >
                {actionLoading ? "Suspending..." : "Confirm Suspension"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT SUBSCRIPTION & MODULES */}
      {subEditModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#292320]/60 flex items-center justify-center p-4">
          <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg max-w-2xl w-full p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-[#292320]">Edit Subscription & Module Entitlements</h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-bold text-[#71675E]">Plan Tier</label>
                <select
                  value={editPlan}
                  onChange={(e) => setEditPlan(e.target.value)}
                  className="w-full text-xs p-2 mt-1 border border-[#D8CEC1] rounded-md bg-[#F7F3EC]"
                >
                  <option value="STARTER">Starter</option>
                  <option value="PROFESSIONAL">Professional</option>
                  <option value="ENTERPRISE">Enterprise</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-[#71675E]">Package Domain</label>
                <select
                  value={editPackage}
                  onChange={(e) => setEditPackage(e.target.value)}
                  className="w-full text-xs p-2 mt-1 border border-[#D8CEC1] rounded-md bg-[#F7F3EC]"
                >
                  <option value="RESTAURANT">Restaurant Only</option>
                  <option value="HOTEL">Hotel Only</option>
                  <option value="BOTH">Hotel + Restaurant</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-[#71675E]">Billing Cycle</label>
                <select
                  value={editBillingCycle}
                  onChange={(e) => setEditBillingCycle(e.target.value)}
                  className="w-full text-xs p-2 mt-1 border border-[#D8CEC1] rounded-md bg-[#F7F3EC]"
                >
                  <option value="MONTHLY">Monthly</option>
                  <option value="ANNUAL">Annual</option>
                </select>
              </div>
            </div>

            {/* Modules Checkbox Selector */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-[#292320]">Enabled Hospitality Modules</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {ALL_HOSPITALITY_MODULES.map((mod) => (
                  <label
                    key={mod.key}
                    className="flex items-center gap-2 p-2 bg-[#F7F3EC] rounded border border-[#EEE7DD] cursor-pointer hover:bg-[#EEE7DD]/60"
                  >
                    <input
                      type="checkbox"
                      checked={editModules.includes(mod.key)}
                      onChange={() => toggleModule(mod.key)}
                      className="rounded border-[#D8CEC1] text-[#6B2837] focus:ring-[#6B2837]"
                    />
                    <div>
                      <div className="font-semibold text-[#292320]">{mod.label}</div>
                      <div className="text-[10px] text-[#71675E]">{mod.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Limits */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-[#71675E]">Max Staff Users</label>
                <input
                  type="number"
                  value={editUserLimit}
                  onChange={(e) => setEditUserLimit(Number(e.target.value))}
                  className="w-full text-xs p-2 mt-1 border border-[#D8CEC1] rounded-md bg-[#F7F3EC]"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-[#71675E]">Max Branches</label>
                <input
                  type="number"
                  value={editBranchLimit}
                  onChange={(e) => setEditBranchLimit(Number(e.target.value))}
                  className="w-full text-xs p-2 mt-1 border border-[#D8CEC1] rounded-md bg-[#F7F3EC]"
                />
              </div>
            </div>

            {/* Mandatory Reason */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#292320]">Mandatory Audit Reason *</label>
              <textarea
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                placeholder="Explain why this tier or module entitlement was changed..."
                rows={2}
                className="w-full text-xs p-2 border border-[#D8CEC1] rounded-md bg-[#F7F3EC]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#EEE7DD]">
              <button
                onClick={() => setSubEditModalOpen(false)}
                className="px-3 py-1.5 text-xs font-bold text-[#71675E]"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSubscription}
                disabled={actionLoading || !editReason.trim()}
                className="px-4 py-1.5 bg-[#6B2837] hover:bg-[#6B2837]/90 text-[#FFFCF7] text-xs font-bold rounded-md disabled:opacity-50"
              >
                {actionLoading ? "Saving..." : "Save Entitlements"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: RECORD PAYMENT MODAL */}
      {paymentModalOpen && selectedInvoice && (
        <div className="fixed inset-0 z-50 bg-[#292320]/60 flex items-center justify-center p-4">
          <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-[#292320]">Record SaaS Subscription Payment</h3>
            <p className="text-xs text-[#71675E]">
              Recording payment for invoice <span className="font-mono font-bold">{selectedInvoice.invoiceNumber}</span>{" "}
              (Total Amount: Rs. {Number(selectedInvoice.amount).toLocaleString()})
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-[#71675E]">Payment Amount (NPR) *</label>
                <input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(Number(e.target.value))}
                  className="w-full text-xs p-2 mt-1 border border-[#D8CEC1] rounded-md bg-[#F7F3EC]"
                />
              </div>

              <div>
                <label className="font-bold text-[#71675E]">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full text-xs p-2 mt-1 border border-[#D8CEC1] rounded-md bg-[#F7F3EC]"
                >
                  <option value="BANK_TRANSFER">Bank Wire / Deposit</option>
                  <option value="ESEWA">eSewa Merchant</option>
                  <option value="KHALTI">Khalti Merchant</option>
                  <option value="CASH">Cash Office Collection</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-[#71675E]">Transaction / Bank Reference</label>
                <input
                  type="text"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  placeholder="e.g. TXN-NABIL-99124..."
                  className="w-full text-xs p-2 mt-1 border border-[#D8CEC1] rounded-md bg-[#F7F3EC]"
                />
              </div>

              <div>
                <label className="font-bold text-[#71675E]">Mandatory Audit Reason *</label>
                <textarea
                  value={paymentReason}
                  onChange={(e) => setPaymentReason(e.target.value)}
                  placeholder="e.g. Verified wire transfer against Bank statement..."
                  rows={2}
                  className="w-full text-xs p-2 mt-1 border border-[#D8CEC1] rounded-md bg-[#F7F3EC]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#EEE7DD]">
              <button onClick={() => setPaymentModalOpen(false)} className="px-3 py-1.5 text-xs font-bold text-[#71675E]">
                Cancel
              </button>
              <button
                onClick={handleRecordPayment}
                disabled={actionLoading || paymentAmount <= 0 || !paymentReason.trim()}
                className="px-4 py-1.5 bg-[#15803D] hover:bg-[#15803D]/90 text-[#FFFCF7] text-xs font-bold rounded-md disabled:opacity-50"
              >
                {actionLoading ? "Recording..." : "Record Payment Receipt"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: ADD INTERNAL SUPPORT NOTE */}
      {noteModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#292320]/60 flex items-center justify-center p-4">
          <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-[#292320]">Log Internal Support Note</h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-[#71675E]">Note Title *</label>
                <input
                  type="text"
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  placeholder="e.g. Kitchen printer setup guidance..."
                  className="w-full text-xs p-2 mt-1 border border-[#D8CEC1] rounded-md bg-[#F7F3EC]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-[#71675E]">Category</label>
                  <select
                    value={noteCategory}
                    onChange={(e) => setNoteCategory(e.target.value)}
                    className="w-full text-xs p-2 mt-1 border border-[#D8CEC1] rounded-md bg-[#F7F3EC]"
                  >
                    <option value="GENERAL">General</option>
                    <option value="TECHNICAL">Technical / Hardware</option>
                    <option value="BILLING">Billing / Invoicing</option>
                    <option value="ACCESS">Access & Credentials</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-[#71675E]">Priority</label>
                  <select
                    value={notePriority}
                    onChange={(e) => setNotePriority(e.target.value)}
                    className="w-full text-xs p-2 mt-1 border border-[#D8CEC1] rounded-md bg-[#F7F3EC]"
                  >
                    <option value="LOW">Low</option>
                    <option value="NORMAL">Normal</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-[#71675E]">Details & Resolution Notes *</label>
                <textarea
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder="Enter detailed notes regarding this support touchpoint..."
                  rows={3}
                  className="w-full text-xs p-2 mt-1 border border-[#D8CEC1] rounded-md bg-[#F7F3EC]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#EEE7DD]">
              <button onClick={() => setNoteModalOpen(false)} className="px-3 py-1.5 text-xs font-bold text-[#71675E]">
                Cancel
              </button>
              <button
                onClick={handleAddNote}
                disabled={actionLoading || !noteTitle.trim() || !noteContent.trim()}
                className="px-4 py-1.5 bg-[#6B2837] hover:bg-[#6B2837]/90 text-[#FFFCF7] text-xs font-bold rounded-md disabled:opacity-50"
              >
                {actionLoading ? "Saving..." : "Save Support Note"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

