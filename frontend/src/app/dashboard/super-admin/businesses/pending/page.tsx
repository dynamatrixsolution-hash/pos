"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Hourglass,
  Clock,
  AlertTriangle,
  Calendar,
  Search,
  RefreshCw,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import ExportDropdown from "@/components/export-dropdown";
import { ExportOptions } from "@/lib/export-service";
import { toast } from "@/components/toast";

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
  selectedModules?: any;
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

  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [counts, setCounts] = useState({ total: 0, pending: 0, changesRequested: 0, approved: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedRequest, setSelectedRequest] = useState<RequestItem | null>(null);

  // Action states
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [actionModal, setActionModal] = useState<{
    request: RequestItem;
    type: "APPROVE" | "REJECT" | "REQUEST_CHANGES";
  } | null>(null);
  const [modalReason, setModalReason] = useState("");

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/super-admin/requests?status=PENDING&search=${encodeURIComponent(search)}`);
      if (res.ok) {
        const data = await res.json();
        setRequests(data.requests || []);
        if (data.counts) setCounts(data.counts);
      } else {
        throw new Error(`Server returned status ${res.status}`);
      }
    } catch (err: any) {
      console.error("Fetch registration requests error:", err);
      toast.error(err.message || "Failed to load pending applications");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login");
    } else if (session?.user && (session.user as any).role !== "SUPER_ADMIN") {
      router.push("/dashboard");
    } else if (status === "authenticated") {
      fetchRequests();
    }
  }, [status, session, router, fetchRequests]);

  // Execute Approval / Rejection / Changes Requested
  const handleExecuteAction = async (requestId: string, action: "APPROVE" | "REJECT" | "REQUEST_CHANGES", reasonText?: string) => {
    setActionLoadingId(requestId);

    try {
      const endpoint =
        action === "APPROVE"
          ? `/api/v1/super-admin/requests/${requestId}/approve`
          : action === "REJECT"
          ? `/api/v1/super-admin/requests/${requestId}/reject`
          : `/api/v1/super-admin/requests/${requestId}/request-changes`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          reason: reasonText || "Approved by Super Admin",
          adminNotes: reasonText || "Approved by Super Admin",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to process approval action");
      }

      toast.success(
        action === "APPROVE"
          ? `Application successfully approved! New business provisioned.`
          : action === "REJECT"
          ? `Application has been rejected.`
          : `Requested modifications submitted to applicant.`
      );

      setActionModal(null);
      setSelectedRequest(null);
      setModalReason("");
      await fetchRequests();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Server error while processing request");
    } finally {
      setActionLoadingId(null);
    }
  };

  const getExportOptions = (): ExportOptions => ({
    filename: `pending-verification-${new Date().toISOString().split("T")[0]}`,
    title: "Pending Business Verification Queue",
    subtitle: "Onboarding verification applications awaiting platform approval",
    dateRange: "Status: PENDING",
    columns: [
      { header: "Tracking Code", key: "trackingCode", width: 18 },
      { header: "Business Name", key: "businessName", width: 25 },
      { header: "Type", key: "businessType", width: 16 },
      { header: "Plan", key: "plan", width: 14 },
      { header: "Owner Name", key: "ownerName", width: 20 },
      { header: "Owner Email", key: "ownerEmail", width: 25 },
      { header: "Region", key: "address", width: 20 },
      { header: "Status", key: "status", width: 12 },
      { header: "Submitted", key: "createdAt", width: 14 },
    ],
    data: requests.map((r) => ({
      trackingCode: r.trackingCode,
      businessName: r.businessName,
      businessType: formatBusinessType(r.businessType),
      plan: r.plan,
      ownerName: r.ownerName,
      ownerEmail: r.ownerEmail,
      address: r.address || "N/A",
      status: r.status,
      createdAt: new Date(r.createdAt).toLocaleDateString("en-US", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
    })),
  });

  function formatBusinessType(type: string) {
    if (!type) return "Restaurant";
    const u = type.toUpperCase();
    if (u.includes("HOTEL") && (u.includes("REST") || u.includes("BOTH"))) return "Hotel & Restaurant";
    if (u.includes("HOTEL") || u.includes("STAY")) return "Hotel & Resort";
    if (u.includes("CAFE") || u.includes("BAKERY")) return "Cafe & Bakery";
    return "Restaurant";
  }

  return (
    <div className="space-y-2.5 pb-8 text-[#292320]">
      {/* 1. Header (Ultra Clean, Minimalist) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-1 border-b border-[#D8CEC1]">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-[#292320]">
            Pending Verification
          </h1>
          <p className="text-[11px] text-[#71675E] mt-0.5">
            Review and verify business registration applications across Nepal.
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => fetchRequests()}
            disabled={loading}
            className="p-1.5 text-[#71675E] hover:text-[#292320] bg-[#FFFCF7] border border-[#D8CEC1] rounded-md hover:bg-[#EEE7DD] transition-colors cursor-pointer"
            title="Refresh queue"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
          <ExportDropdown
            getExportOptions={getExportOptions}
            buttonText="Export Data"
            variant="outline"
          />
        </div>
      </div>

      {/* 2. Slim Minimalist KPI Cards (Clean, compact ~48px height) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        <div className="py-2 px-3 rounded-md bg-[#FFFCF7] border border-[#D8CEC1]">
          <div className="flex items-center justify-between text-[11px] text-[#71675E] font-medium">
            <span>Total Pending</span>
            <Hourglass className="h-3.5 w-3.5 text-amber-500" />
          </div>
          <div className="mt-0.5 text-lg font-bold tracking-tight text-[#292320] tabular-nums">
            {counts.pending}
          </div>
        </div>

        <div className="py-2 px-3 rounded-md bg-[#FFFCF7] border border-[#D8CEC1]">
          <div className="flex items-center justify-between text-[11px] text-[#71675E] font-medium">
            <span>Under Review</span>
            <Clock className="h-3.5 w-3.5 text-emerald-600" />
          </div>
          <div className="mt-0.5 text-lg font-bold tracking-tight text-[#292320] tabular-nums">
            {counts.changesRequested}
          </div>
        </div>

        <div className="py-2 px-3 rounded-md bg-[#FFFCF7] border border-[#D8CEC1]">
          <div className="flex items-center justify-between text-[11px] text-[#71675E] font-medium">
            <span>High Priority</span>
            <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />
          </div>
          <div className="mt-0.5 text-lg font-bold tracking-tight text-[#292320] tabular-nums">
            0
          </div>
        </div>

        <div className="py-2 px-3 rounded-md bg-[#FFFCF7] border border-[#D8CEC1]">
          <div className="flex items-center justify-between text-[11px] text-[#71675E] font-medium">
            <span>Avg. Review Time</span>
            <Calendar className="h-3.5 w-3.5 text-emerald-600" />
          </div>
          <div className="mt-0.5 text-lg font-bold tracking-tight text-[#292320] tabular-nums">
            1.2 hrs
          </div>
        </div>
      </div>

      {/* 3. Sleek Search Bar */}
      <div className="relative">
        <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-[#71675E]" />
        <input
          type="text"
          placeholder="Search pending businesses by name, code or admin..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-8 pr-3 py-1.5 bg-[#FFFCF7] border border-[#D8CEC1] rounded-md text-xs text-[#292320] placeholder:text-[#71675E] focus:outline-none focus:border-[#6B2837] transition-all"
        />
      </div>

      {/* 4. Main Content: Verification Queue Table Card */}
      <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-md overflow-hidden">
        {/* Table Card Header */}
        <div className="py-2 px-3 border-b border-[#D8CEC1] flex items-center justify-between bg-[#FFFCF7]">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#292320]">
            VERIFICATION QUEUE ({requests.length})
          </div>

          <div className="flex items-center gap-3 text-[11px] font-medium text-[#71675E]">
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500"></span>
              Pending
            </span>
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600"></span>
              Ready
            </span>
          </div>
        </div>

        {/* Table Content */}
        {loading ? (
          <div className="p-8 text-center text-xs text-[#71675E] flex items-center justify-center gap-2">
            <RefreshCw className="h-3.5 w-3.5 animate-spin text-[#6B2837]" />
            <span>Loading verification queue...</span>
          </div>
        ) : requests.length === 0 ? (
          /* Clean Empty State */
          <div className="py-10 px-4 text-center">
            <div className="h-10 w-10 rounded-full border border-emerald-300 bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-2">
              <Check className="h-5 w-5 stroke-[2.5]" />
            </div>
            <h3 className="text-xs font-bold text-[#292320]">Verification queue is clear</h3>
            <p className="text-[11px] text-[#71675E] mt-0.5">
              No business applications currently require verification.
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
                  <th className="py-2 px-3">Type</th>
                  <th className="py-2 px-3">Region</th>
                  <th className="py-2 px-3">Submitted</th>
                  <th className="py-2 px-3">Admin Info</th>
                  <th className="py-2 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D8CEC1]/50">
                {requests.map((r) => (
                  <tr key={r.id} className="hover:bg-[#F7F3EC]/50 transition-colors">
                    {/* Business Name & Code */}
                    <td className="py-2 px-3">
                      <span className="font-semibold text-xs text-[#292320]">{r.businessName}</span>
                      <span className="text-[10px] text-[#71675E] font-mono ml-2">
                        {r.trackingCode}
                      </span>
                    </td>

                    {/* Business Type */}
                    <td className="py-2 px-3 whitespace-nowrap text-xs text-[#292320]">
                      {formatBusinessType(r.businessType)}
                    </td>

                    {/* Region */}
                    <td className="py-2 px-3 whitespace-nowrap text-xs text-[#71675E]">
                      {r.address || "Nepal"}
                    </td>

                    {/* Submitted Date */}
                    <td className="py-2 px-3 whitespace-nowrap text-xs text-[#71675E] font-mono">
                      {new Date(r.createdAt).toLocaleDateString("en-US", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>

                    {/* Admin Contact */}
                    <td className="py-2 px-3">
                      <div className="text-xs text-[#292320] font-medium">{r.ownerName}</div>
                      <div className="text-[10px] text-[#71675E] font-mono">
                        {r.ownerEmail}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-2 px-3 whitespace-nowrap text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          onClick={() => setSelectedRequest(r)}
                          className="px-2 py-1 text-[11px] font-medium text-[#292320] bg-[#FFFCF7] border border-[#D8CEC1] rounded hover:bg-[#EEE7DD] transition-colors cursor-pointer"
                        >
                          Inspect
                        </button>
                        <button
                          onClick={() => handleExecuteAction(r.id, "APPROVE")}
                          disabled={actionLoadingId === r.id}
                          className="px-2.5 py-1 text-[11px] font-semibold text-white bg-[#6B2837] rounded hover:bg-[#521E2A] transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-1"
                        >
                          {actionLoadingId === r.id ? (
                            <RefreshCw className="h-3 w-3 animate-spin" />
                          ) : (
                            <Check className="h-3 w-3" />
                          )}
                          <span>Approve</span>
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
            Showing {requests.length > 0 ? `1 to ${requests.length}` : "0"} of {requests.length}
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

      {/* 5. Clean Inspection / Review Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg max-w-lg w-full p-4 space-y-3 shadow-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-[#D8CEC1]">
              <div>
                <h3 className="text-sm font-bold text-[#292320]">{selectedRequest.businessName}</h3>
                <p className="text-[11px] text-[#71675E] font-mono mt-0.5">Code: {selectedRequest.trackingCode}</p>
              </div>
              <button
                onClick={() => setSelectedRequest(null)}
                className="text-[#71675E] hover:text-[#292320] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="grid grid-cols-2 gap-2 p-2.5 bg-[#F7F3EC] rounded border border-[#D8CEC1]">
                <div>
                  <span className="text-[#71675E] block text-[10px]">Business Type</span>
                  <strong className="text-[#292320] text-xs">{formatBusinessType(selectedRequest.businessType)}</strong>
                </div>
                <div>
                  <span className="text-[#71675E] block text-[10px]">Requested Plan</span>
                  <strong className="text-[#292320] text-xs">{selectedRequest.plan} ({selectedRequest.billingCycle})</strong>
                </div>
                <div>
                  <span className="text-[#71675E] block text-[10px]">Region / Address</span>
                  <span className="text-[#292320] text-xs">{selectedRequest.address || "N/A"}</span>
                </div>
                <div>
                  <span className="text-[#71675E] block text-[10px]">PAN / Tax Number</span>
                  <span className="text-[#292320] text-xs">{selectedRequest.taxNumber || "Not provided"}</span>
                </div>
              </div>

              <div className="p-2.5 bg-[#F7F3EC] rounded border border-[#D8CEC1] space-y-1">
                <span className="text-[#71675E] block text-[10px] font-semibold uppercase">Owner Information</span>
                <div className="flex justify-between">
                  <span className="text-[#71675E]">Name:</span>
                  <strong className="text-[#292320]">{selectedRequest.ownerName}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#71675E]">Email:</span>
                  <span className="text-[#292320] font-mono text-[11px]">{selectedRequest.ownerEmail}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#71675E]">Phone:</span>
                  <span className="text-[#292320]">{selectedRequest.ownerPhone || selectedRequest.phone || "N/A"}</span>
                </div>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-1.5 border-t border-[#D8CEC1]">
              <button
                onClick={() => {
                  const req = selectedRequest;
                  setSelectedRequest(null);
                  setActionModal({ request: req, type: "REJECT" });
                }}
                className="px-2.5 py-1 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded hover:bg-rose-100 cursor-pointer"
              >
                Reject
              </button>
              <button
                onClick={() => {
                  const req = selectedRequest;
                  setSelectedRequest(null);
                  setActionModal({ request: req, type: "REQUEST_CHANGES" });
                }}
                className="px-2.5 py-1 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded hover:bg-amber-100 cursor-pointer"
              >
                Request Changes
              </button>
              <button
                onClick={() => handleExecuteAction(selectedRequest.id, "APPROVE")}
                disabled={actionLoadingId === selectedRequest.id}
                className="px-3.5 py-1 text-xs font-semibold text-white bg-[#6B2837] rounded hover:bg-[#521E2A] cursor-pointer flex items-center gap-1"
              >
                {actionLoadingId === selectedRequest.id ? (
                  <RefreshCw className="h-3 w-3 animate-spin" />
                ) : (
                  <Check className="h-3 w-3" />
                )}
                <span>Approve & Provision</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Action Reason Dialog (Reject or Request Changes) */}
      {actionModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg max-w-md w-full p-4 space-y-3 shadow-md">
            <div className="flex items-center justify-between pb-2 border-b border-[#D8CEC1]">
              <h3 className="text-xs font-bold text-[#292320]">
                {actionModal.type === "REJECT" ? "Reject Application" : "Request Changes"}
              </h3>
              <button
                onClick={() => setActionModal(null)}
                className="text-[#71675E] hover:text-[#292320] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-[11px] text-[#71675E]">
              Provide a rationale for {actionModal.request.businessName}. This reason will be logged in the audit trail.
            </p>

            <textarea
              value={modalReason}
              onChange={(e) => setModalReason(e.target.value)}
              placeholder="Enter review notes or reason..."
              rows={2}
              className="w-full p-2 bg-[#F7F3EC] border border-[#D8CEC1] rounded text-xs text-[#292320] focus:outline-none focus:border-[#6B2837]"
            />

            <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-[#D8CEC1]">
              <button
                onClick={() => setActionModal(null)}
                className="px-2.5 py-1 text-xs font-medium text-[#71675E] hover:text-[#292320] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  handleExecuteAction(
                    actionModal.request.id,
                    actionModal.type,
                    modalReason.trim() || undefined
                  )
                }
                disabled={!modalReason.trim() || actionLoadingId === actionModal.request.id}
                className={`px-3 py-1 text-xs font-semibold rounded text-white cursor-pointer disabled:opacity-50 ${
                  actionModal.type === "REJECT" ? "bg-rose-700 hover:bg-rose-800" : "bg-amber-700 hover:bg-amber-800"
                }`}
              >
                Confirm {actionModal.type === "REJECT" ? "Rejection" : "Request"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
