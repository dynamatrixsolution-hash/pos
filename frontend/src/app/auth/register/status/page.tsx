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
  ArrowRight,
  RefreshCw,
  Copy,
  Check,
  ShieldCheck,
  Edit,
  ExternalLink,
} from "lucide-react";
import { Notify } from "@/lib/notify";

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
      setFetchError(err.message || "Failed to load request status.");
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
    Notify.info("Tracking code copied to clipboard.");
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

      Notify.success("Your changes have been resubmitted for admin review.");
      setIsEditOpen(false);
      fetchStatus();
    } catch (err: any) {
      Notify.failure(err.message || "Error resubmitting changes.");
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F3EC] text-[#292320] py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* ======================================================== */}
        {/* TOP HEADER: BRAND + TRACKING LOOKUP                      */}
        {/* ======================================================== */}
        <div className="bg-[#FFFCF7] border border-[#D8CEC1] p-5 sm:p-6 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#6B2837]" />
              <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-[#6B2837]">
                RestroInn Hospitality Platform
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-[#292320] tracking-tight">
              Registration Request Status
            </h1>
            <p className="text-xs sm:text-sm text-[#71675E]">
              Track real-time tenant provisioning, verification stages, and terminal access.
            </p>
          </div>

          {/* Quick Search */}
          <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-auto shrink-0 flex items-center gap-2">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#71675E]" />
              <input
                type="text"
                placeholder="Code (e.g. REQ-2026-55MV)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-[#FAF7F2] border border-[#D8CEC1] rounded-lg text-xs font-semibold text-[#292320] placeholder:text-[#9E938B] focus:outline-none focus:bg-white focus:border-[#6B2837] focus:ring-1 focus:ring-[#6B2837]"
              />
            </div>
            <button
              type="submit"
              className="px-3.5 py-2 bg-[#6B2837] hover:bg-[#541E2A] text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
            >
              Track
            </button>
          </form>
        </div>

        {/* ======================================================== */}
        {/* SKELETON LOADER                                          */}
        {/* ======================================================== */}
        {isLoading && (
          <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-xl p-8 space-y-6">
            <div className="flex justify-between items-center">
              <div className="space-y-2">
                <div className="h-3 w-32 bg-[#EEE7DD] rounded-sm animate-pulse" />
                <div className="h-7 w-48 bg-[#EEE7DD] rounded-md animate-pulse" />
              </div>
              <div className="h-9 w-40 bg-[#EEE7DD] rounded-lg animate-pulse" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-16 bg-[#EEE7DD] rounded-lg animate-pulse" />
              ))}
            </div>
            <div className="h-44 bg-[#EEE7DD] rounded-lg animate-pulse" />
          </div>
        )}

        {/* ======================================================== */}
        {/* NOT FOUND / ERROR STATE                                  */}
        {/* ======================================================== */}
        {!isLoading && (fetchError || !requestData) && (
          <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-xl p-10 sm:p-14 text-center space-y-4 shadow-xs">
            <div className="w-12 h-12 rounded-full bg-[#FAF0F1] border border-[#E9B6B7] text-[#B33432] flex items-center justify-center mx-auto">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-[#292320]">Registration Request Not Located</h3>
              <p className="text-xs sm:text-sm text-[#71675E] max-w-md mx-auto">
                {fetchError || "We could not find a registration request with the specified tracking code. Please verify the code or start a new workspace registration."}
              </p>
            </div>
            <div className="flex justify-center items-center gap-3 pt-2">
              <Link
                href="/auth/register"
                className="px-5 py-2.5 bg-[#6B2837] hover:bg-[#541E2A] text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                Register New Workspace
              </Link>
              <Link
                href="/auth/login"
                className="px-5 py-2.5 bg-[#FFFCF7] hover:bg-[#EEE7DD] border border-[#D8CEC1] text-[#292320] rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                Sign In
              </Link>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* MAIN STATUS VIEW                                         */}
        {/* ======================================================== */}
        {!isLoading && requestData && (
          <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-xl p-6 sm:p-8 space-y-7 shadow-xs">
            
            {/* 1. Tracking Reference & Primary Status Pill */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-[#EEE7DD]">
              <div>
                <span className="text-[11px] font-bold text-[#71675E] uppercase tracking-wider block">
                  Tracking Reference Code
                </span>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-2xl sm:text-3xl font-mono font-black text-[#140F0C] tracking-wide">
                    {requestData.trackingCode}
                  </span>
                  <button
                    onClick={() => handleCopyCode(requestData.trackingCode)}
                    className="p-1.5 hover:bg-[#EEE7DD] rounded-md text-[#71675E] hover:text-[#292320] transition-colors cursor-pointer border border-[#D8CEC1]/60"
                    title="Copy Tracking Code"
                  >
                    {copied ? <Check className="h-4 w-4 text-[#28634B]" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Status Pill with Strict Semantic Isolation */}
              <div>
                {requestData.status === "PENDING" && (
                  <div className="flex items-center gap-2.5 bg-[#FDF5E7] text-[#946000] border border-[#EDD7AD] px-4 py-2.5 rounded-lg">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#946000] opacity-60" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#946000]" />
                    </span>
                    <div>
                      <p className="text-xs font-black uppercase tracking-wider">Under Admin Review</p>
                      <p className="text-[10px] text-[#946000]/80 font-medium">Pending platform authorization</p>
                    </div>
                  </div>
                )}

                {requestData.status === "APPROVED" && (
                  <div className="flex items-center gap-2.5 bg-[#EAF3EE] text-[#28634B] border border-[#C3DED0] px-4 py-2.5 rounded-lg">
                    <CheckCircle className="h-4 w-4 text-[#28634B]" />
                    <div>
                      <p className="text-xs font-black uppercase tracking-wider">Workspace Approved</p>
                      <p className="text-[10px] text-[#28634B]/80 font-medium">Tenant provisioned & active</p>
                    </div>
                  </div>
                )}

                {requestData.status === "CHANGES_REQUESTED" && (
                  <div className="flex items-center gap-2.5 bg-[#EDF4F9] text-[#315F85] border border-[#B8D2E6] px-4 py-2.5 rounded-lg">
                    <AlertTriangle className="h-4 w-4 text-[#315F85]" />
                    <div>
                      <p className="text-xs font-black uppercase tracking-wider">Action Required</p>
                      <p className="text-[10px] text-[#315F85]/80 font-medium">Super Admin requested changes</p>
                    </div>
                  </div>
                )}

                {requestData.status === "REJECTED" && (
                  <div className="flex items-center gap-2.5 bg-[#FAEAEC] text-[#B33432] border border-[#E9B6B7] px-4 py-2.5 rounded-lg">
                    <XCircle className="h-4 w-4 text-[#B33432]" />
                    <div>
                      <p className="text-xs font-black uppercase tracking-wider">Request Declined</p>
                      <p className="text-[10px] text-[#B33432]/80 font-medium">See admin notes below</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 2. Visual Timeline */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-[#71675E] uppercase tracking-wider">
                Provisioning Progress Timeline
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                {[
                  {
                    title: "1. Request Submitted",
                    status: "DONE",
                    desc: new Date(requestData.createdAt).toLocaleDateString(),
                  },
                  {
                    title: "2. Admin Verification",
                    status:
                      requestData.status === "APPROVED"
                        ? "DONE"
                        : requestData.status === "REJECTED"
                        ? "REJECTED"
                        : "IN_PROGRESS",
                    desc:
                      requestData.status === "PENDING"
                        ? "Reviewing details"
                        : requestData.status === "CHANGES_REQUESTED"
                        ? "Action required"
                        : requestData.status === "REJECTED"
                        ? "Declined"
                        : "Verified",
                  },
                  {
                    title: "3. Tenant Setup",
                    status: requestData.status === "APPROVED" ? "DONE" : "PENDING",
                    desc: requestData.status === "APPROVED" ? "Schema generated" : "Queued",
                  },
                  {
                    title: "4. Workspace Access",
                    status: requestData.status === "APPROVED" ? "DONE" : "PENDING",
                    desc: requestData.status === "APPROVED" ? "Terminal live" : "Awaiting approval",
                  },
                ].map((step, idx) => {
                  let stepStyle = "bg-[#FAF7F2] border-[#D8CEC1] text-[#71675E]";
                  let icon = <span className="w-2 h-2 rounded-full bg-[#D8CEC1]" />;

                  if (step.status === "DONE") {
                    stepStyle = "bg-[#EAF3EE] border-[#C3DED0] text-[#28634B]";
                    icon = <Check className="h-3.5 w-3.5 text-[#28634B]" />;
                  } else if (step.status === "IN_PROGRESS") {
                    stepStyle = "bg-[#FDF5E7] border-[#EDD7AD] text-[#946000]";
                    icon = <Clock className="h-3.5 w-3.5 text-[#946000]" />;
                  } else if (step.status === "REJECTED") {
                    stepStyle = "bg-[#FAEAEC] border-[#E9B6B7] text-[#B33432]";
                    icon = <XCircle className="h-3.5 w-3.5 text-[#B33432]" />;
                  }

                  return (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg border transition-colors ${stepStyle}`}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-xs">
                        {icon}
                        <span>{step.title}</span>
                      </div>
                      <p className="text-[11px] mt-1 opacity-85 font-medium pl-5">{step.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 3. Action Banners */}
            {requestData.status === "APPROVED" && (
              <div className="bg-[#EAF3EE] border border-[#C3DED0] p-5 rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-[#28634B] flex items-center gap-2">
                    <CheckCircle className="h-4 w-4" /> Your RestroInn Workspace is Live!
                  </h4>
                  <p className="text-xs text-[#28634B]/90">
                    Your tenant schema is active at <strong className="font-mono">{requestData.slug}.restroinn.com</strong>. You may now sign in using your administrator credentials.
                  </p>
                </div>
                <Link
                  href="/auth/login"
                  className="px-5 py-2.5 bg-[#28634B] hover:bg-[#1E4D3A] text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shrink-0 transition-colors"
                >
                  <span>Sign In to Terminal</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            )}

            {requestData.status === "CHANGES_REQUESTED" && (
              <div className="bg-[#EDF4F9] border border-[#B8D2E6] p-5 rounded-lg space-y-3">
                <div className="flex items-center gap-2 text-[#315F85]">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <h4 className="text-xs font-bold uppercase tracking-wider">
                    Administrator Instructions
                  </h4>
                </div>
                <p className="text-xs text-[#292320] bg-white border border-[#D8CEC1] p-3 rounded-md font-medium">
                  {requestData.adminNotes || "Please review and revise your submitted business details."}
                </p>
                <button
                  type="button"
                  onClick={() => setIsEditOpen(true)}
                  className="px-4 py-2 bg-[#315F85] hover:bg-[#254A68] text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Edit className="h-3.5 w-3.5" />
                  <span>Revise & Resubmit Application</span>
                </button>
              </div>
            )}

            {requestData.status === "REJECTED" && (
              <div className="bg-[#FAEAEC] border border-[#E9B6B7] p-5 rounded-lg space-y-2 text-[#B33432]">
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 shrink-0" />
                  <h4 className="text-xs font-bold uppercase tracking-wider">
                    Application Rejection Reason
                  </h4>
                </div>
                <p className="text-xs text-[#292320] bg-white border border-[#E9B6B7] p-3 rounded-md font-medium">
                  {requestData.rejectionReason || "The business registration was declined by the platform administrator."}
                </p>
              </div>
            )}

            {/* 4. Submitted Application Summary Grid */}
            <div className="space-y-3 pt-2">
              <h3 className="text-xs font-bold text-[#71675E] uppercase tracking-wider border-b border-[#EEE7DD] pb-2">
                Submitted Application Summary
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
                <div className="bg-[#FAF7F2] border border-[#D8CEC1] p-3.5 rounded-lg space-y-1">
                  <span className="text-[10px] text-[#71675E] font-bold uppercase tracking-wider block">
                    Business Name
                  </span>
                  <p className="text-sm font-bold text-[#292320]">{requestData.businessName}</p>
                </div>

                <div className="bg-[#FAF7F2] border border-[#D8CEC1] p-3.5 rounded-lg space-y-1">
                  <span className="text-[10px] text-[#71675E] font-bold uppercase tracking-wider block">
                    Workspace Subdomain
                  </span>
                  <p className="text-sm font-mono font-bold text-[#6B2837]">
                    {requestData.slug}.restroinn.com
                  </p>
                </div>

                <div className="bg-[#FAF7F2] border border-[#D8CEC1] p-3.5 rounded-lg space-y-1">
                  <span className="text-[10px] text-[#71675E] font-bold uppercase tracking-wider block">
                    Industry Type
                  </span>
                  <p className="text-sm font-bold text-[#292320]">
                    {requestData.businessType === "RESTAURANT"
                      ? "Restaurant & Café"
                      : requestData.businessType === "HOTEL"
                      ? "Hotel & Stay"
                      : "Hotel + Restaurant"}
                  </p>
                </div>

                <div className="bg-[#FAF7F2] border border-[#D8CEC1] p-3.5 rounded-lg space-y-1">
                  <span className="text-[10px] text-[#71675E] font-bold uppercase tracking-wider block">
                    Operating Currency
                  </span>
                  <p className="text-sm font-bold text-[#292320]">{requestData.currency}</p>
                </div>

                <div className="bg-[#FAF7F2] border border-[#D8CEC1] p-3.5 rounded-lg space-y-1">
                  <span className="text-[10px] text-[#71675E] font-bold uppercase tracking-wider block">
                    Requested Tier
                  </span>
                  <p className="text-sm font-bold text-[#28634B]">
                    {requestData.plan} Tier ({requestData.billingCycle})
                  </p>
                </div>

                <div className="bg-[#FAF7F2] border border-[#D8CEC1] p-3.5 rounded-lg space-y-1">
                  <span className="text-[10px] text-[#71675E] font-bold uppercase tracking-wider block">
                    Administrator Contact
                  </span>
                  <p className="text-sm font-bold text-[#292320] truncate">
                    {requestData.ownerName}
                  </p>
                  <p className="text-xs text-[#71675E] truncate">{requestData.ownerEmail}</p>
                </div>
              </div>
            </div>

            {/* 5. Support & Legal Notice */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-4 border-t border-[#EEE7DD] text-xs text-[#71675E]">
              <p>
                Questions about your request? Contact{" "}
                <a href="mailto:support@restroinn.com" className="text-[#6B2837] font-bold hover:underline">
                  support@restroinn.com
                </a>
              </p>
              <div className="flex items-center gap-2.5">
                <Link href="/terms" className="hover:underline">
                  Terms of Service
                </Link>
                <span>•</span>
                <Link href="/privacy" className="hover:underline">
                  Privacy Policy
                </Link>
                <span>•</span>
                <Link href="/auth/login" className="text-[#6B2837] font-bold hover:underline">
                  Back to Sign In
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* RESUBMIT MODAL (IF CHANGES_REQUESTED)                     */}
        {/* ======================================================== */}
        {isEditOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#292320]/40 p-4 select-none">
            <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-xl max-w-lg w-full p-6 space-y-4 shadow-md">
              <div className="flex justify-between items-center border-b border-[#EEE7DD] pb-3">
                <h3 className="text-base font-bold text-[#292320]">Revise Registration Details</h3>
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="text-xs text-[#71675E] hover:text-[#292320] font-semibold cursor-pointer"
                >
                  Cancel
                </button>
              </div>

              <form onSubmit={handleResubmitChanges} className="space-y-3.5 text-xs">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[#71675E] uppercase block">
                    Business Name
                  </label>
                  <input
                    type="text"
                    value={editForm.businessName}
                    onChange={(e) => setEditForm({ ...editForm, businessName: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-[#D8CEC1] rounded-lg text-xs font-semibold text-[#292320] focus:outline-none focus:border-[#6B2837]"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[#71675E] uppercase block">
                    Workspace Subdomain Slug
                  </label>
                  <input
                    type="text"
                    value={editForm.slug}
                    onChange={(e) => setEditForm({ ...editForm, slug: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-[#D8CEC1] rounded-lg text-xs font-semibold text-[#292320] focus:outline-none focus:border-[#6B2837]"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-[#71675E] uppercase block">
                      Owner Full Name
                    </label>
                    <input
                      type="text"
                      value={editForm.ownerName}
                      onChange={(e) => setEditForm({ ...editForm, ownerName: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-[#D8CEC1] rounded-lg text-xs font-semibold text-[#292320] focus:outline-none focus:border-[#6B2837]"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-[#71675E] uppercase block">
                      Owner Email
                    </label>
                    <input
                      type="email"
                      value={editForm.ownerEmail}
                      onChange={(e) => setEditForm({ ...editForm, ownerEmail: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-[#D8CEC1] rounded-lg text-xs font-semibold text-[#292320] focus:outline-none focus:border-[#6B2837]"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingEdit}
                  className="w-full py-2.5 bg-[#6B2837] hover:bg-[#541E2A] text-white font-bold rounded-lg text-xs transition-colors cursor-pointer disabled:opacity-50 mt-2"
                >
                  {isSubmittingEdit ? "Submitting Revisions..." : "Resubmit Application for Review"}
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
        <div className="min-h-screen flex items-center justify-center bg-[#F7F3EC]">
          <div className="text-center space-y-2">
            <RefreshCw className="h-6 w-6 text-[#6B2837] animate-spin mx-auto" />
            <p className="text-xs text-[#71675E] font-medium">Loading status tracker...</p>
          </div>
        </div>
      }
    >
      <StatusContent />
    </Suspense>
  );
}
