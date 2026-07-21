"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Search,
  Building,
  Mail,
  Phone,
  Layers,
  ArrowRight,
  RefreshCw,
  Copy,
  Check,
  ShieldAlert,
  Sparkles,
  Store,
  Edit,
} from "lucide-react";

interface RegistrationRequestData {
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

function StatusContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const requestId = searchParams.get("id");
  const trackingCode = searchParams.get("code");

  const [requestData, setRequestData] = useState<RegistrationRequestData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Edit / Resubmit Modal State
  const [isEditOpen, setIsEditOpen] = useState<boolean>(false);
  const [editForm, setEditForm] = useState({
    businessName: "",
    slug: "",
    email: "",
    phone: "",
    ownerName: "",
    ownerEmail: "",
    password: "",
  });
  const [isSubmittingEdit, setIsSubmittingEdit] = useState<boolean>(false);
  const [editError, setEditError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!requestId && !trackingCode) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setFetchError(null);

    try {
      const param = requestId ? `id=${requestId}` : `code=${trackingCode}`;
      const res = await fetch(`/api/v1/auth/register-request?${param}`);
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Registration request not found.");
      }

      setRequestData(json.request);
      setEditForm({
        businessName: json.request.businessName,
        slug: json.request.slug,
        email: json.request.email,
        phone: json.request.phone || "",
        ownerName: json.request.ownerName,
        ownerEmail: json.request.ownerEmail,
        password: "",
      });
    } catch (err: any) {
      setFetchError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [requestId, trackingCode]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/auth/register/status?code=${searchQuery.trim().toUpperCase()}`);
    }
  };

  const handleResubmitChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestData) return;

    setIsSubmittingEdit(true);
    setEditError(null);

    try {
      const res = await fetch("/api/v1/auth/register-request", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: requestData.id,
          ...editForm,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to update request.");
      }

      setIsEditOpen(false);
      fetchStatus();
    } catch (err: any) {
      setEditError(err.message);
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* HEADER BAR */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white border border-slate-200/80 p-6 rounded-3xl shadow-sm">
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Building className="h-5 w-5 text-blue-600" /> Business Registration Request Status
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Track real-time approval status, provision timeline, and admin updates for your workspace.
            </p>
          </div>

          {/* SEARCH FOR ANOTHER CODE */}
          <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-auto">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search code (e.g. REQ-2026-X8A2)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-500"
            />
          </form>
        </div>

        {/* LOADING STATE */}
        {isLoading && (
          <div className="bg-white border border-slate-200/80 rounded-3xl p-12 text-center space-y-3">
            <RefreshCw className="h-8 w-8 text-blue-600 animate-spin mx-auto" />
            <p className="text-xs text-slate-500 font-medium">Fetching workspace registration request status...</p>
          </div>
        )}

        {/* NOT FOUND / ERROR STATE */}
        {!isLoading && (fetchError || !requestData) && (
          <div className="bg-white border border-slate-200/80 rounded-3xl p-12 text-center space-y-4">
            <ShieldAlert className="h-10 w-10 text-amber-500 mx-auto" />
            <div>
              <h3 className="text-base font-bold text-slate-900">Registration Request Not Found</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                We couldn't locate a registration request with the specified ID or tracking code. Please verify your tracking code or submit a new registration request.
              </p>
            </div>
            <div className="flex justify-center gap-3 pt-2">
              <Link
                href="/auth/register"
                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-md hover:bg-blue-500 transition-all"
              >
                New Registration
              </Link>
            </div>
          </div>
        )}

        {/* MAIN REQUEST STATUS CONTENT */}
        {!isLoading && requestData && (
          <div className="space-y-6">
            {/* STATUS BADGE & CODE CARD */}
            <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-6">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Tracking Reference Code</span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xl font-mono font-black text-slate-900">{requestData.trackingCode}</span>
                    <button
                      onClick={() => handleCopyCode(requestData.trackingCode)}
                      className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
                      title="Copy Tracking Code"
                    >
                      {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* STATUS BADGES */}
                <div>
                  {requestData.status === "PENDING" && (
                    <div className="flex items-center gap-2 bg-amber-50 text-amber-700 border border-amber-200 px-4 py-2 rounded-2xl">
                      <Clock className="h-5 w-5 text-amber-500 animate-pulse" />
                      <div>
                        <p className="text-xs font-black uppercase tracking-wider">Under Admin Review</p>
                        <p className="text-[10px] text-amber-600 font-medium">Pending Super Admin approval</p>
                      </div>
                    </div>
                  )}

                  {requestData.status === "APPROVED" && (
                    <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 border border-emerald-200 px-4 py-2 rounded-2xl">
                      <CheckCircle className="h-5 w-5 text-emerald-500" />
                      <div>
                        <p className="text-xs font-black uppercase tracking-wider">Workspace Approved!</p>
                        <p className="text-[10px] text-emerald-600 font-medium">Tenant provisioned & active</p>
                      </div>
                    </div>
                  )}

                  {requestData.status === "CHANGES_REQUESTED" && (
                    <div className="flex items-center gap-2 bg-blue-50 text-blue-700 border border-blue-200 px-4 py-2 rounded-2xl">
                      <AlertTriangle className="h-5 w-5 text-blue-500" />
                      <div>
                        <p className="text-xs font-black uppercase tracking-wider">Action Required</p>
                        <p className="text-[10px] text-blue-600 font-medium">Changes requested by admin</p>
                      </div>
                    </div>
                  )}

                  {requestData.status === "REJECTED" && (
                    <div className="flex items-center gap-2 bg-red-50 text-red-700 border border-red-200 px-4 py-2 rounded-2xl">
                      <XCircle className="h-5 w-5 text-red-500" />
                      <div>
                        <p className="text-xs font-black uppercase tracking-wider">Request Declined</p>
                        <p className="text-[10px] text-red-600 font-medium">See admin feedback below</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* VISUAL TIMELINE */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Provisioning Progress Timeline</h4>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  {[
                    {
                      title: "1. Request Submitted",
                      status: "DONE",
                      desc: new Date(requestData.createdAt).toLocaleDateString(),
                    },
                    {
                      title: "2. Admin Verification",
                      status: requestData.status === "APPROVED" ? "DONE" : requestData.status === "REJECTED" ? "REJECTED" : "IN_PROGRESS",
                      desc: requestData.status === "PENDING" ? "Reviewing details" : requestData.status === "CHANGES_REQUESTED" ? "Changes requested" : "Verified",
                    },
                    {
                      title: "3. Tenant Provisioning",
                      status: requestData.status === "APPROVED" ? "DONE" : "PENDING",
                      desc: requestData.status === "APPROVED" ? "DB schema ready" : "Queued",
                    },
                    {
                      title: "4. Workspace Access",
                      status: requestData.status === "APPROVED" ? "DONE" : "PENDING",
                      desc: requestData.status === "APPROVED" ? "Sign in enabled" : "Pending approval",
                    },
                  ].map((step, idx) => (
                    <div
                      key={idx}
                      className={`p-3.5 rounded-2xl border ${
                        step.status === "DONE"
                          ? "bg-emerald-50/50 border-emerald-200 text-emerald-900"
                          : step.status === "IN_PROGRESS"
                          ? "bg-amber-50/50 border-amber-200 text-amber-900"
                          : step.status === "REJECTED"
                          ? "bg-red-50/50 border-red-200 text-red-900"
                          : "bg-slate-50 border-slate-200 text-slate-500"
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        {step.status === "DONE" ? (
                          <CheckCircle className="h-4 w-4 text-emerald-600" />
                        ) : step.status === "IN_PROGRESS" ? (
                          <Clock className="h-4 w-4 text-amber-600 animate-spin" />
                        ) : step.status === "REJECTED" ? (
                          <XCircle className="h-4 w-4 text-red-600" />
                        ) : (
                          <div className="h-3.5 w-3.5 rounded-full border border-slate-300" />
                        )}
                        <span className="text-xs font-bold">{step.title}</span>
                      </div>
                      <p className="text-[10px] mt-1 opacity-80">{step.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* ADMIN FEEDBACK BANNER (IF CHANGES OR REJECTED OR APPROVED) */}
              {requestData.status === "APPROVED" && (
                <div className="bg-emerald-500 text-white p-6 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-lg shadow-emerald-500/20">
                  <div>
                    <h3 className="text-base font-black flex items-center gap-2">
                      <Sparkles className="h-5 w-5" /> Your DynaPOS Workspace is Ready!
                    </h3>
                    <p className="text-xs text-emerald-100 mt-1">
                      Your business tenant has been fully provisioned. You can now sign in using your administrator email and password.
                    </p>
                  </div>
                  <Link
                    href="/auth/login"
                    className="px-6 py-2.5 bg-white text-emerald-700 hover:bg-emerald-50 rounded-xl text-xs font-black shadow transition-all flex items-center gap-2 flex-shrink-0"
                  >
                    Proceed to Sign In <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              )}

              {requestData.status === "CHANGES_REQUESTED" && (
                <div className="bg-blue-50 border border-blue-200 p-5 rounded-2xl space-y-3 text-blue-900">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-blue-600" />
                    <h4 className="text-sm font-bold">Action Required: Administrator Instructions</h4>
                  </div>
                  <p className="text-xs text-blue-800 bg-white p-3.5 rounded-xl border border-blue-100 font-medium">
                    "{requestData.adminNotes || "Please review and update your submitted registration details."}"
                  </p>
                  <button
                    onClick={() => setIsEditOpen(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold shadow hover:bg-blue-500 transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Edit className="h-4 w-4" /> Revise & Resubmit Details
                  </button>
                </div>
              )}

              {requestData.status === "REJECTED" && (
                <div className="bg-red-50 border border-red-200 p-5 rounded-2xl space-y-2 text-red-900">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-5 w-5 text-red-600" />
                    <h4 className="text-sm font-bold">Registration Request Declined</h4>
                  </div>
                  <p className="text-xs text-red-800 bg-white p-3.5 rounded-xl border border-red-100 font-medium">
                    "{requestData.rejectionReason || "The business registration request was rejected by platform administrator."}"
                  </p>
                </div>
              )}
            </div>

            {/* SUBMITTED DETAILS SUMMARY CARD */}
            <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-3">
                Submitted Application Summary
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Business Name</span>
                  <p className="font-bold text-slate-900 mt-0.5">{requestData.businessName}</p>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Workspace Subdomain</span>
                  <p className="font-mono text-blue-600 font-bold mt-0.5">{requestData.slug}.dynapos.com</p>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Industry Type</span>
                  <p className="font-bold text-slate-800 mt-0.5">{requestData.businessType}</p>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Base Currency</span>
                  <p className="font-bold text-slate-800 mt-0.5">{requestData.currency}</p>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Requested Plan</span>
                  <p className="font-bold text-emerald-600 mt-0.5">{requestData.plan} Tier ({requestData.billingCycle})</p>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Administrator Contact</span>
                  <p className="font-bold text-slate-800 mt-0.5">{requestData.ownerName} ({requestData.ownerEmail})</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* RESUBMIT MODAL (IF CHANGES_REQUESTED) */}
        {isEditOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-scale-in">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <h3 className="text-base font-bold text-slate-900">Revise Registration Details</h3>
                <button onClick={() => setIsEditOpen(false)} className="text-slate-400 hover:text-slate-600 text-xs">
                  Cancel
                </button>
              </div>

              {editError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs font-semibold rounded-xl">
                  {editError}
                </div>
              )}

              <form onSubmit={handleResubmitChanges} className="space-y-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Business Name</label>
                  <input
                    type="text"
                    value={editForm.businessName}
                    onChange={(e) => setEditForm({ ...editForm, businessName: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Subdomain Slug</label>
                  <input
                    type="text"
                    value={editForm.slug}
                    onChange={(e) => setEditForm({ ...editForm, slug: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Owner Name</label>
                    <input
                      type="text"
                      value={editForm.ownerName}
                      onChange={(e) => setEditForm({ ...editForm, ownerName: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Owner Email</label>
                    <input
                      type="email"
                      value={editForm.ownerEmail}
                      onChange={(e) => setEditForm({ ...editForm, ownerEmail: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingEdit}
                  className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl text-xs shadow-md hover:bg-blue-500 transition-all uppercase tracking-wider"
                >
                  {isSubmittingEdit ? "Submitting..." : "Resubmit for Review"}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function RegistrationStatusPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="text-center space-y-2">
            <RefreshCw className="h-8 w-8 text-blue-600 animate-spin mx-auto" />
            <p className="text-xs text-slate-500">Loading status tracker...</p>
          </div>
        </div>
      }
    >
      <StatusContent />
    </Suspense>
  );
}
