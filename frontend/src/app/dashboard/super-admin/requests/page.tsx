"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
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
  Sparkles,
  Check,
  X,
  FileText,
  Sliders,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

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

export default function BusinessApprovalCenterPage() {
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
    setIsSubmittingAction(true);
    setActionError("");
    setActionSuccess("");

    try {
      const res = await fetch(`/api/v1/super-admin/requests/${selectedRequest.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: actionType,
          rejectionReason,
          adminNotes,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to process request action.");
      }

      setActionSuccess(data.message || "Operation completed successfully");
      setTimeout(() => {
        setActionSuccess("");
        setSelectedRequest(null);
        setActionType(null);
        fetchRequests();
      }, 1500);
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setIsSubmittingAction(false);
    }
  };

  return (
    <div className="space-y-6 text-[#0F172A]">
      {/* 1. Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white border border-slate-200/80 p-6 rounded-3xl">
        <div>
          <h1 className="text-xl font-black flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-blue-600" /> Business Approval Center
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Review applicant submissions, approve workspaces to trigger tenant auto-provisioning, request changes, or decline requests.
          </p>
        </div>
      </div>

      {/* 2. Metrics Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div
          onClick={() => setActiveTab("ALL")}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            activeTab === "ALL" ? "bg-blue-50 border-blue-300 ring-2 ring-blue-500/20" : "bg-white border-slate-200/80 hover:bg-slate-50"
          }`}
        >
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Applications</p>
          <h3 className="text-2xl font-black text-slate-900 mt-1">{counts.total}</h3>
        </div>

        <div
          onClick={() => setActiveTab("PENDING")}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            activeTab === "PENDING" ? "bg-amber-50 border-amber-300 ring-2 ring-amber-500/20" : "bg-white border-slate-200/80 hover:bg-slate-50"
          }`}
        >
          <div className="flex justify-between items-center">
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Pending Review</p>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <h3 className="text-2xl font-black text-amber-700 mt-1">{counts.pending}</h3>
        </div>

        <div
          onClick={() => setActiveTab("CHANGES_REQUESTED")}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            activeTab === "CHANGES_REQUESTED" ? "bg-blue-50 border-blue-300 ring-2 ring-blue-500/20" : "bg-white border-slate-200/80 hover:bg-slate-50"
          }`}
        >
          <div className="flex justify-between items-center">
            <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Action Required</p>
            <AlertTriangle className="h-4 w-4 text-blue-500" />
          </div>
          <h3 className="text-2xl font-black text-blue-700 mt-1">{counts.changesRequested}</h3>
        </div>

        <div
          onClick={() => setActiveTab("APPROVED")}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            activeTab === "APPROVED" ? "bg-emerald-50 border-emerald-300 ring-2 ring-emerald-500/20" : "bg-white border-slate-200/80 hover:bg-slate-50"
          }`}
        >
          <div className="flex justify-between items-center">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Approved</p>
            <CheckCircle className="h-4 w-4 text-emerald-500" />
          </div>
          <h3 className="text-2xl font-black text-emerald-700 mt-1">{counts.approved}</h3>
        </div>

        <div
          onClick={() => setActiveTab("REJECTED")}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            activeTab === "REJECTED" ? "bg-red-50 border-red-300 ring-2 ring-red-500/20" : "bg-white border-slate-200/80 hover:bg-slate-50"
          }`}
        >
          <div className="flex justify-between items-center">
            <p className="text-[10px] font-bold uppercase tracking-wider text-red-700">Declined</p>
            <XCircle className="h-4 w-4 text-red-500" />
          </div>
          <h3 className="text-2xl font-black text-red-700 mt-1">{counts.rejected}</h3>
        </div>
      </div>

      {/* 3. Filter Tabs & Search Bar */}
      <div className="bg-white border border-slate-200/80 p-5 rounded-2xl flex flex-col sm:flex-row justify-between gap-4 items-center">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-2.5 h-4.5 w-4.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by business name, slug, email, or tracking code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 w-full px-4 py-2 border border-slate-200 rounded-xl bg-slate-50 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 focus:bg-white transition-all"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchRequests}
            className="p-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </div>
      </div>

      {/* 4. Requests Data Table */}
      <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden p-5 shadow-sm">
        {loading ? (
          <div className="py-16 text-center space-y-2">
            <RefreshCw className="h-8 w-8 text-blue-600 animate-spin mx-auto" />
            <p className="text-xs text-slate-500">Loading registration applications...</p>
          </div>
        ) : requests.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-400 space-y-2">
            <Building className="h-8 w-8 text-slate-300 mx-auto" />
            <p className="font-semibold text-slate-600">No registration requests found in this category.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider text-[9px] pb-3">
                  <th className="py-3 px-2">Tracking Code / Date</th>
                  <th className="py-3 px-2">Business & Subdomain</th>
                  <th className="py-3 px-2">Requested Plan</th>
                  <th className="py-3 px-2">Administrator Contact</th>
                  <th className="py-3 px-2 text-center">Status</th>
                  <th className="py-3 px-2 text-right">Review Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {requests.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-4 px-2">
                      <span className="font-mono font-black text-slate-800 text-xs">{item.trackingCode}</span>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="py-4 px-2">
                      <div className="font-bold text-slate-900 text-sm">{item.businessName}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[9px] font-mono text-blue-600 bg-blue-50 px-2 py-0.5 rounded font-semibold">
                          {item.slug}.dynapos.com
                        </span>
                        <span className="text-[9px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded uppercase font-bold">
                          {item.businessType}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-2">
                      <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded text-[10px] border border-emerald-100">
                        {item.plan} ({item.billingCycle})
                      </span>
                      <div className="text-[10px] text-slate-400 mt-1">
                        Currency: {item.currency}
                      </div>
                    </td>
                    <td className="py-4 px-2">
                      <div className="font-bold text-slate-800">{item.ownerName}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                        <Mail className="h-3 w-3" /> {item.ownerEmail}
                      </div>
                    </td>
                    <td className="py-4 px-2 text-center">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider border ${
                          item.status === "PENDING"
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : item.status === "APPROVED"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : item.status === "CHANGES_REQUESTED"
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : "bg-red-50 text-red-700 border-red-200"
                        }`}
                      >
                        {item.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="py-4 px-2 text-right">
                      <button
                        onClick={() => {
                          setSelectedRequest(item);
                          setActionType(null);
                          setRejectionReason("");
                          setAdminNotes("");
                        }}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
                      >
                        Review Request
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. REQUEST REVIEW SIDE DRAWER / MODAL */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs">
          <div className="w-full max-w-xl bg-white h-screen shadow-2xl p-6 overflow-y-auto border-l border-slate-100 flex flex-col justify-between animate-slide-in">
            <div className="space-y-6">
              {/* DRAWER HEADER */}
              <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-base font-black text-slate-900">{selectedRequest.businessName}</h3>
                  <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded mt-1 inline-block">
                    Ref Code: {selectedRequest.trackingCode}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedRequest(null)}
                  className="px-2.5 py-1.5 hover:bg-slate-100 text-xs font-semibold text-slate-500 rounded-lg cursor-pointer"
                >
                  Close
                </button>
              </div>

              {/* ACTION MESSAGES */}
              {actionError && (
                <div className="p-3 text-xs bg-red-50 text-red-600 rounded-xl font-bold border border-red-200">
                  {actionError}
                </div>
              )}
              {actionSuccess && (
                <div className="p-3 text-xs bg-emerald-50 text-emerald-600 rounded-xl font-bold border border-emerald-200 animate-pulse">
                  {actionSuccess}
                </div>
              )}

              {/* SUBMITTED APPLICATION DETAILS */}
              <div className="space-y-4">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/60 space-y-3">
                  <h4 className="text-xs font-bold text-blue-600 uppercase tracking-wider border-b border-slate-200/60 pb-1">
                    Business Identity
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-400 text-[10px] block">Workspace Subdomain</span>
                      <strong className="text-blue-600 font-mono">{selectedRequest.slug}.dynapos.com</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] block">Business Type</span>
                      <strong className="text-slate-800">{selectedRequest.businessType}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] block">Base Currency</span>
                      <strong className="text-slate-800">{selectedRequest.currency}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] block">Tax Reg (PAN/VAT)</span>
                      <strong className="text-slate-800">{selectedRequest.taxNumber || "N/A"}</strong>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/60 space-y-3">
                  <h4 className="text-xs font-bold text-blue-600 uppercase tracking-wider border-b border-slate-200/60 pb-1">
                    Requested Licensing Tier
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-400 text-[10px] block">Plan Tier</span>
                      <strong className="text-emerald-600">{selectedRequest.plan} Tier</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] block">Billing Frequency</span>
                      <strong className="text-slate-800">{selectedRequest.billingCycle} ({selectedRequest.durationMonths} Mos)</strong>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/60 space-y-3">
                  <h4 className="text-xs font-bold text-blue-600 uppercase tracking-wider border-b border-slate-200/60 pb-1">
                    Administrator Profile
                  </h4>
                  <div className="space-y-1 text-xs">
                    <p><span className="text-slate-400">Name:</span> <strong className="text-slate-800">{selectedRequest.ownerName}</strong></p>
                    <p><span className="text-slate-400">Login Email:</span> <strong className="text-slate-800">{selectedRequest.ownerEmail}</strong></p>
                    {selectedRequest.ownerPhone && <p><span className="text-slate-400">Phone:</span> <strong className="text-slate-800">{selectedRequest.ownerPhone}</strong></p>}
                  </div>
                </div>
              </div>

              {/* DECISION ACTION CONTROLS */}
              {selectedRequest.status !== "APPROVED" && (
                <div className="bg-slate-900 text-white p-5 rounded-3xl space-y-4 shadow-xl">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Super Admin Decision & Action
                  </h4>

                  {!actionType ? (
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => setActionType("APPROVE")}
                        className="py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1 shadow cursor-pointer"
                      >
                        <Check className="h-4 w-4" /> Approve
                      </button>
                      <button
                        onClick={() => setActionType("REQUEST_CHANGES")}
                        className="py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1 shadow cursor-pointer"
                      >
                        <AlertTriangle className="h-4 w-4" /> Edit Request
                      </button>
                      <button
                        onClick={() => setActionType("REJECT")}
                        className="py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1 shadow cursor-pointer"
                      >
                        <X className="h-4 w-4" /> Decline
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3 pt-1 border-t border-slate-800">
                      {actionType === "APPROVE" && (
                        <p className="text-xs text-emerald-400 font-semibold">
                          Approving will immediately create the business workspace, active subscription, main branch, and owner account in the database.
                        </p>
                      )}

                      {actionType === "REQUEST_CHANGES" && (
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Instructions / Notes for Applicant</label>
                          <textarea
                            value={adminNotes}
                            onChange={(e) => setAdminNotes(e.target.value)}
                            placeholder="e.g. Please provide your official registered VAT number..."
                            className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none"
                            rows={3}
                          />
                        </div>
                      )}

                      {actionType === "REJECT" && (
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Rejection Reason</label>
                          <textarea
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                            placeholder="e.g. Incomplete business verification details..."
                            className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none"
                            rows={3}
                          />
                        </div>
                      )}

                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={handleExecuteAction}
                          disabled={isSubmittingAction}
                          className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer ${
                            actionType === "APPROVE"
                              ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                              : actionType === "REQUEST_CHANGES"
                              ? "bg-blue-600 hover:bg-blue-500 text-white"
                              : "bg-red-600 hover:bg-red-500 text-white"
                          }`}
                        >
                          {isSubmittingAction ? "Processing..." : `Confirm ${actionType}`}
                        </button>
                        <button
                          onClick={() => setActionType(null)}
                          className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold cursor-pointer"
                        >
                          Back
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
