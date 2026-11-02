"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Building,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Search,
  Eye,
  Mail,
  Phone,
  Globe,
  Calendar,
  Layers,
  Check,
  X,
  FileText,
  Sliders,
  RefreshCw,
  ShieldCheck,
  Building2,
} from "lucide-react";
import ExportDropdown from "@/components/export-dropdown";
import { ExportOptions } from "@/lib/export-service";

interface RequestItem {
  id: string;
  trackingCode: string;
  businessName: string;
  slug: string;
  businessType: string;
  currency: string;
  taxNumber?: string | null;
  phone?: string | null;
  email: string;
  address?: string | null;
  plan: string;
  billingCycle: string;
  durationMonths: number;
  selectedModules?: Record<string, boolean>;
  customLimits?: Record<string, number>;
  ownerName: string;
  ownerEmail: string;
  ownerPhone?: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CHANGES_REQUESTED";
  rejectionReason?: string | null;
  adminNotes?: string | null;
  createdBusinessId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function PendingApprovalsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<"ALL" | "PENDING" | "CHANGES_REQUESTED" | "APPROVED" | "REJECTED">("PENDING");
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [counts, setCounts] = useState({ total: 0, pending: 0, changesRequested: 0, approved: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedRequest, setSelectedRequest] = useState<RequestItem | null>(null);

  // Modal Action Form States
  const [actionType, setActionType] = useState<"APPROVE" | "REJECT" | "REQUEST_CHANGES" | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/super-admin/requests?status=${activeTab}&search=${encodeURIComponent(search)}`);
      if (res.ok) {
        const data = await res.json();
        setRequests(data.requests || []);
        if (data.counts) setCounts(data.counts);
      }
    } catch (err) {
      console.error("Fetch registration requests error:", err);
    } finally {
      setLoading(false);
    }
  }, [activeTab, search]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login");
    } else if (session?.user && (session.user as any).role !== "SUPER_ADMIN") {
      router.push("/dashboard");
    } else if (status === "authenticated") {
      fetchRequests();
    }
  }, [status, session, router, fetchRequests]);

  const handleExecuteAction = async () => {
    if (!selectedRequest || !actionType) return;
    if ((actionType === "REJECT" || actionType === "REQUEST_CHANGES") && !rejectionReason.trim()) {
      setActionError("A rationale/reason is mandatory for audit trail compliance.");
      return;
    }

    setIsSubmittingAction(true);
    setActionError("");
    setActionSuccess("");

    try {
      const endpoint =
        actionType === "APPROVE"
          ? `/api/v1/super-admin/requests/${selectedRequest.id}/approve`
          : actionType === "REJECT"
          ? `/api/v1/super-admin/requests/${selectedRequest.id}/reject`
          : `/api/v1/super-admin/requests/${selectedRequest.id}/request-changes`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: rejectionReason,
          adminNotes,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to process approval action");
      }

      setActionSuccess(
        actionType === "APPROVE"
          ? `Application successfully approved! New business provisioned.`
          : actionType === "REJECT"
          ? `Application rejected.`
          : `Requested modifications submitted to applicant.`
      );

      setActionType(null);
      setRejectionReason("");
      setAdminNotes("");
      setSelectedRequest(null);
      fetchRequests();
      setTimeout(() => setActionSuccess(""), 4000);
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const getExportOptions = (): ExportOptions => ({
    filename: `pending-applications-${new Date().toISOString().split("T")[0]}`,
    title: "Pending Business Applications Queue",
    subtitle: "Onboarding verification applications awaiting platform approval",
    dateRange: activeTab === "ALL" ? "All Applications" : `Status: ${activeTab}`,
    columns: [
      { header: "Tracking Code", key: "trackingCode", width: 18 },
      { header: "Business Name", key: "businessName", width: 25 },
      { header: "Type", key: "businessType", width: 14 },
      { header: "Plan", key: "plan", width: 14 },
      { header: "Billing Cycle", key: "billingCycle", width: 14 },
      { header: "Owner Name", key: "ownerName", width: 20 },
      { header: "Owner Email", key: "ownerEmail", width: 25 },
      { header: "Phone", key: "phone", width: 16 },
      { header: "Status", key: "status", width: 14 },
      { header: "Submitted", key: "createdAt", width: 14 },
    ],
    data: requests.map((r) => ({
      trackingCode: r.trackingCode,
      businessName: r.businessName,
      businessType: r.businessType,
      plan: r.plan,
      billingCycle: r.billingCycle,
      ownerName: r.ownerName,
      ownerEmail: r.ownerEmail,
      phone: r.phone || "N/A",
      status: r.status,
      createdAt: new Date(r.createdAt).toISOString().split("T")[0],
    })),
  });

  return (
    <div className="space-y-6 text-[#292320]">
      {/* 1. Header with Breadcrumbs & Export */}
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
            <span className="text-[#292320] font-semibold">Pending Approvals</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-[#292320]">Pending Approvals</h1>
          <p className="text-xs text-[#71675E] mt-0.5">
            Review and verify incoming business onboarding applications across Nepal.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <ExportDropdown
            getExportOptions={getExportOptions}
            buttonText="Export Applications"
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
          className="pb-2.5 border-b-2 border-[#6B2837] text-[#6B2837] whitespace-nowrap"
        >
          Pending Approvals ({counts.pending})
        </Link>
        <Link
          href="/dashboard/super-admin/businesses/expiring"
          className="pb-2.5 border-b-2 border-transparent text-[#71675E] hover:text-[#292320] whitespace-nowrap transition-colors"
        >
          Expiring Subscriptions
        </Link>
      </div>

      {/* 3. Feedback alerts */}
      {actionSuccess && (
        <div className="p-3 bg-emerald-50 text-emerald-800 text-xs rounded-md border border-emerald-200 flex items-center gap-2">
          <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600" />
          <span className="font-medium">{actionSuccess}</span>
        </div>
      )}

      {actionError && (
        <div className="p-3 bg-rose-50 text-rose-800 text-xs rounded-md border border-rose-200 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
          <span className="font-medium">{actionError}</span>
        </div>
      )}

      {/* 4. Metric KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-[#FFFCF7] border border-[#D8CEC1]/80 p-4 rounded-lg">
          <p className="text-[11px] font-semibold text-[#71675E] uppercase tracking-wider">Total Pending</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold text-[#6B2837] tabular-nums">{counts.pending}</span>
            <span className="text-xs text-[#71675E]">Ready for review</span>
          </div>
        </div>

        <div className="bg-[#FFFCF7] border border-[#D8CEC1]/80 p-4 rounded-lg">
          <p className="text-[11px] font-semibold text-[#71675E] uppercase tracking-wider">Changes Requested</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold text-amber-700 tabular-nums">{counts.changesRequested}</span>
            <span className="text-xs text-[#71675E]">Awaiting tenant</span>
          </div>
        </div>

        <div className="bg-[#FFFCF7] border border-[#D8CEC1]/80 p-4 rounded-lg">
          <p className="text-[11px] font-semibold text-[#71675E] uppercase tracking-wider">Approved</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold text-emerald-700 tabular-nums">{counts.approved}</span>
            <span className="text-xs text-[#71675E]">Provisioned</span>
          </div>
        </div>

        <div className="bg-[#FFFCF7] border border-[#D8CEC1]/80 p-4 rounded-lg">
          <p className="text-[11px] font-semibold text-[#71675E] uppercase tracking-wider">Avg Review Time</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold text-[#292320] tabular-nums">1.2 hrs</span>
            <span className="text-xs text-[#71675E]">Response speed</span>
          </div>
        </div>
      </div>

      {/* 5. Filter Toolbar */}
      <div className="bg-[#FFFCF7] border border-[#D8CEC1]/80 p-4 rounded-lg flex flex-col sm:flex-row justify-between items-center gap-3">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#71675E]" />
          <input
            type="text"
            placeholder="Search by business name, tracking code, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-[#F7F3EC] border border-[#D8CEC1] rounded-md text-xs text-[#292320] placeholder-[#71675E] focus:outline-none focus:ring-1 focus:ring-[#6B2837]"
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-[#F7F3EC] border border-[#D8CEC1] p-0.5 rounded-md text-[11px] font-medium">
            <button
              onClick={() => setActiveTab("PENDING")}
              className={`px-3 py-1 rounded cursor-pointer transition-colors ${
                activeTab === "PENDING" ? "bg-[#6B2837] text-white font-semibold" : "text-[#71675E] hover:text-[#292320]"
              }`}
            >
              Pending ({counts.pending})
            </button>
            <button
              onClick={() => setActiveTab("CHANGES_REQUESTED")}
              className={`px-3 py-1 rounded cursor-pointer transition-colors ${
                activeTab === "CHANGES_REQUESTED" ? "bg-[#6B2837] text-white font-semibold" : "text-[#71675E] hover:text-[#292320]"
              }`}
            >
              Changes Requested
            </button>
            <button
              onClick={() => setActiveTab("APPROVED")}
              className={`px-3 py-1 rounded cursor-pointer transition-colors ${
                activeTab === "APPROVED" ? "bg-[#6B2837] text-white font-semibold" : "text-[#71675E] hover:text-[#292320]"
              }`}
            >
              Approved
            </button>
            <button
              onClick={() => setActiveTab("ALL")}
              className={`px-3 py-1 rounded cursor-pointer transition-colors ${
                activeTab === "ALL" ? "bg-[#6B2837] text-white font-semibold" : "text-[#71675E] hover:text-[#292320]"
              }`}
            >
              All
            </button>
          </div>

          <button
            onClick={() => fetchRequests()}
            title="Refresh list"
            className="p-1.5 bg-[#F7F3EC] hover:bg-[#EEE7DD] border border-[#D8CEC1] text-[#71675E] hover:text-[#292320] rounded-md transition-colors cursor-pointer"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* 6. Applications Table */}
      <div className="bg-[#FFFCF7] border border-[#D8CEC1]/80 rounded-lg overflow-hidden shadow-xs">
        <div className="p-4 border-b border-[#D8CEC1]/80 flex justify-between items-center bg-[#F7F3EC]/50">
          <h2 className="text-sm font-bold text-[#292320]">
            Verification Queue
            <span className="ml-2 text-xs font-normal text-[#71675E] tabular-nums">
              ({requests.length} applications)
            </span>
          </h2>
        </div>

        {loading ? (
          <div className="p-12 text-center space-y-3">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#6B2837] border-t-transparent mx-auto" />
            <p className="text-xs text-[#71675E]">Loading queue...</p>
          </div>
        ) : requests.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <Building className="h-8 w-8 text-[#71675E] mx-auto opacity-50" />
            <p className="text-xs font-semibold text-[#292320]">No applications in queue</p>
            <p className="text-[11px] text-[#71675E]">
              {activeTab === "PENDING"
                ? "All pending registration applications have been reviewed."
                : "No applications found matching the selected filter."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#D8CEC1] bg-[#F7F3EC]/80 text-[#71675E] font-semibold uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-4">Business / Property</th>
                  <th className="py-2.5 px-3">Type & Plan</th>
                  <th className="py-2.5 px-3">Applicant / Admin</th>
                  <th className="py-2.5 px-3">Submitted</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D8CEC1]/60">
                {requests.map((r) => (
                  <tr key={r.id} className="hover:bg-[#F7F3EC]/40 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-[#292320] flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 text-[#6B2837] shrink-0" />
                        <span>{r.businessName}</span>
                      </div>
                      <div className="text-[11px] text-[#71675E] mt-0.5">
                        <span>Code: {r.trackingCode}</span>
                        {r.address && <span> • {r.address}</span>}
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <div className="font-semibold text-[#292320]">{r.plan}</div>
                      <div className="text-[10px] text-[#71675E] mt-0.5 uppercase tracking-wide">
                        {r.businessType} • {r.billingCycle}
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <div className="text-[#292320] font-medium">{r.ownerName}</div>
                      <div className="text-[11px] text-[#71675E] mt-0.5 flex items-center gap-1">
                        <Mail className="h-3 w-3 shrink-0" />
                        <span className="truncate max-w-[150px]">{r.ownerEmail}</span>
                      </div>
                    </td>

                    <td className="py-3 px-3 tabular-nums font-medium text-[#292320]">
                      {new Date(r.createdAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>

                    <td className="py-3 px-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${
                          r.status === "PENDING"
                            ? "bg-amber-50 text-amber-800 border-amber-200"
                            : r.status === "APPROVED"
                            ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                            : r.status === "CHANGES_REQUESTED"
                            ? "bg-blue-50 text-blue-800 border-blue-200"
                            : "bg-rose-50 text-rose-800 border-rose-200"
                        }`}
                      >
                        {r.status.replace("_", " ")}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedRequest(r)}
                          className="px-2.5 py-1 bg-[#FFFCF7] hover:bg-[#F7F3EC] border border-[#D8CEC1] text-[#292320] rounded text-[11px] font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="h-3 w-3 text-[#6B2837]" />
                          Inspect
                        </button>
                        {r.status === "PENDING" && (
                          <button
                            onClick={() => {
                              setSelectedRequest(r);
                              setActionType("APPROVE");
                            }}
                            className="px-2.5 py-1 bg-[#6B2837] hover:bg-[#521E2A] text-white rounded text-[11px] font-semibold shadow-2xs transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <Check className="h-3 w-3" />
                            Approve
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL: Review / Inspect / Action */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg max-w-lg w-full p-5 space-y-4 shadow-md text-[#292320] max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start border-b border-[#D8CEC1] pb-3">
              <div>
                <h3 className="text-sm font-bold text-[#292320]">Application Details</h3>
                <p className="text-xs text-[#71675E] mt-0.5">
                  Tracking Code: <span className="font-semibold text-[#292320]">{selectedRequest.trackingCode}</span>
                </p>
              </div>
              <button
                onClick={() => {
                  setSelectedRequest(null);
                  setActionType(null);
                }}
                className="text-[#71675E] hover:text-[#292320] p-1 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-[#F7F3EC] p-3 rounded-md border border-[#D8CEC1]">
                <p className="text-[10px] text-[#71675E] font-semibold uppercase">Business</p>
                <p className="font-bold text-[#292320] mt-0.5">{selectedRequest.businessName}</p>
                <p className="text-[11px] text-[#71675E]">Slug: {selectedRequest.slug}</p>
                <p className="text-[11px] text-[#71675E]">Type: {selectedRequest.businessType}</p>
              </div>

              <div className="bg-[#F7F3EC] p-3 rounded-md border border-[#D8CEC1]">
                <p className="text-[10px] text-[#71675E] font-semibold uppercase">Applicant</p>
                <p className="font-bold text-[#292320] mt-0.5">{selectedRequest.ownerName}</p>
                <p className="text-[11px] text-[#71675E]">{selectedRequest.ownerEmail}</p>
                <p className="text-[11px] text-[#71675E]">{selectedRequest.ownerPhone || "No phone provided"}</p>
              </div>
            </div>

            <div className="bg-[#F7F3EC] p-3 rounded-md border border-[#D8CEC1] text-xs">
              <p className="text-[10px] text-[#71675E] font-semibold uppercase">Subscription Requested</p>
              <div className="flex items-center gap-3 mt-1 font-semibold text-[#292320]">
                <span>Plan: {selectedRequest.plan}</span>
                <span>•</span>
                <span>Billing: {selectedRequest.billingCycle}</span>
                <span>•</span>
                <span>Duration: {selectedRequest.durationMonths} mo</span>
              </div>
            </div>

            {/* Action form if actionType is selected */}
            {actionType && (
              <div className="p-3.5 bg-[#FAF2F4] border border-[#E8D7DA] rounded-md space-y-3">
                <p className="text-xs font-bold text-[#6B2837]">
                  {actionType === "APPROVE"
                    ? "Confirm Business Provisioning"
                    : actionType === "REJECT"
                    ? "Reject Application"
                    : "Request Modifications"}
                </p>

                {(actionType === "REJECT" || actionType === "REQUEST_CHANGES") && (
                  <div>
                    <label className="block text-[11px] font-semibold text-[#71675E] uppercase mb-1">
                      Reason / Required Changes <span className="text-rose-600">*</span>
                    </label>
                    <textarea
                      rows={3}
                      required
                      placeholder="Specify rationale for this decision..."
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      className="w-full p-2 bg-[#FFFCF7] border border-[#D8CEC1] rounded text-xs text-[#292320]"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-semibold text-[#71675E] uppercase mb-1">
                    Internal Admin Notes (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Internal reference notes..."
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    className="w-full p-2 bg-[#FFFCF7] border border-[#D8CEC1] rounded text-xs text-[#292320]"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setActionType(null)}
                    className="px-3 py-1.5 border border-[#D8CEC1] text-xs font-semibold rounded bg-[#FFFCF7] text-[#292320] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleExecuteAction}
                    disabled={isSubmittingAction}
                    className="px-4 py-1.5 bg-[#6B2837] text-white text-xs font-semibold rounded hover:bg-[#521E2A] disabled:opacity-50 cursor-pointer"
                  >
                    {isSubmittingAction ? "Processing..." : "Confirm & Execute"}
                  </button>
                </div>
              </div>
            )}

            {!actionType && selectedRequest.status === "PENDING" && (
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#D8CEC1]">
                <button
                  onClick={() => setActionType("REJECT")}
                  className="px-3 py-1.5 border border-rose-300 text-rose-700 text-xs font-semibold rounded hover:bg-rose-50 cursor-pointer"
                >
                  Reject
                </button>
                <button
                  onClick={() => setActionType("REQUEST_CHANGES")}
                  className="px-3 py-1.5 border border-amber-300 text-amber-800 text-xs font-semibold rounded hover:bg-amber-50 cursor-pointer"
                >
                  Request Changes
                </button>
                <button
                  onClick={() => setActionType("APPROVE")}
                  className="px-4 py-1.5 bg-[#6B2837] text-white text-xs font-semibold rounded hover:bg-[#521E2A] cursor-pointer"
                >
                  Approve Application
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
