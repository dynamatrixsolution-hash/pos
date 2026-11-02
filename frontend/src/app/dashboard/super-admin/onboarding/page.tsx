"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Rocket,
  Search,
  RefreshCw,
  Plus,
  Building2,
  Mail,
  Phone,
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowRight,
  Eye,
  Sliders,
  Check,
  X,
  ShieldCheck,
  Layers,
  Sparkles,
} from "lucide-react";
import ExportDropdown from "@/components/export-dropdown";
import { ExportOptions } from "@/lib/export-service";

interface OnboardingRegistration {
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
  ownerName: string;
  ownerEmail: string;
  ownerPhone?: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CHANGES_REQUESTED";
  onboardingStep: number;
  onboardingProgress: number;
  createdAt: string;
}

interface OnboardingCounts {
  total: number;
  inProgress: number;
  pending: number;
  approved: number;
  changesRequested: number;
  rejected: number;
}

export default function SuperAdminOnboardingPipelinePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<"ALL" | "IN_PROGRESS" | "PENDING" | "APPROVED">("ALL");
  const [search, setSearch] = useState("");
  const [registrations, setRegistrations] = useState<OnboardingRegistration[]>([]);
  const [counts, setCounts] = useState<OnboardingCounts>({
    total: 0,
    inProgress: 0,
    pending: 0,
    approved: 0,
    changesRequested: 0,
    rejected: 0,
  });

  const [selectedReg, setSelectedReg] = useState<OnboardingRegistration | null>(null);

  const fetchOnboardingData = useCallback(async () => {
    setLoading(true);
    try {
      let filterParam = activeFilter;
      if (activeFilter === "IN_PROGRESS") {
        filterParam = "ALL"; // we will filter in-progress clientside or via API
      }

      const res = await fetch(
        `/api/v1/super-admin/onboarding?status=${filterParam}&search=${encodeURIComponent(search)}`
      );
      if (res.ok) {
        const data = await res.json();
        let list: OnboardingRegistration[] = data.registrations || [];
        if (activeFilter === "IN_PROGRESS") {
          list = list.filter((r) => r.status === "PENDING" || r.status === "CHANGES_REQUESTED");
        }
        setRegistrations(list);
        if (data.counts) setCounts(data.counts);
      }
    } catch (err) {
      console.error("Fetch onboarding pipeline error:", err);
    } finally {
      setLoading(false);
    }
  }, [activeFilter, search]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login");
    } else if (session?.user && (session.user as any).role !== "SUPER_ADMIN") {
      router.push("/dashboard");
    } else if (status === "authenticated") {
      fetchOnboardingData();
    }
  }, [status, session, router, fetchOnboardingData]);

  const getExportOptions = (): ExportOptions => ({
    filename: `onboarding-pipeline-${new Date().toISOString().split("T")[0]}`,
    title: "Tenant Onboarding & Registration Pipeline",
    subtitle: "Complete tracking of onboarding workspaces across Nepal",
    dateRange: activeFilter === "ALL" ? "All Time" : `Filter: ${activeFilter}`,
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
      { header: "Progress %", key: "onboardingProgress", width: 12 },
      { header: "Submitted", key: "createdAt", width: 14 },
    ],
    data: registrations.map((r) => ({
      trackingCode: r.trackingCode,
      businessName: r.businessName,
      businessType: r.businessType,
      plan: r.plan,
      billingCycle: r.billingCycle,
      ownerName: r.ownerName,
      ownerEmail: r.ownerEmail,
      phone: r.phone || "N/A",
      status: r.status,
      onboardingProgress: `${r.onboardingProgress}%`,
      createdAt: new Date(r.createdAt).toISOString().split("T")[0],
    })),
  });

  return (
    <div className="space-y-6 text-[#292320]">
      {/* 1. Header with Breadcrumbs & Action Buttons */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#FFFCF7] border border-[#D8CEC1]/80 p-5 rounded-lg shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-xs text-[#71675E] font-medium mb-1">
            <Link href="/dashboard/super-admin" className="hover:text-[#6B2837]">
              Platform
            </Link>
            <span>/</span>
            <span className="text-[#292320] font-semibold">Onboarding</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-[#292320] flex items-center gap-2">
            <Rocket className="h-5 w-5 text-[#6B2837]" /> All Registrations
          </h1>
          <p className="text-xs text-[#71675E] mt-0.5">
            Track and oversee tenant onboarding pipelines, self-service drafts, and verification statuses across Nepal.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <ExportDropdown
            getExportOptions={getExportOptions}
            buttonText="Export Data"
            variant="outline"
          />
          <Link
            href="/dashboard/super-admin/onboarding/register"
            className="px-3.5 py-2 bg-[#6B2837] hover:bg-[#521E2A] text-white rounded-md text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5"
          >
            <Plus className="h-4 w-4" /> Add Business
          </Link>
        </div>
      </div>

      {/* 2. NexaEdu-matched 4-KPI Overview Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Total Registrations */}
        <div
          onClick={() => setActiveFilter("ALL")}
          className={`bg-[#FFFCF7] border p-4 rounded-lg cursor-pointer transition-all ${
            activeFilter === "ALL"
              ? "border-[#6B2837] ring-1 ring-[#6B2837]/30 shadow-xs"
              : "border-[#D8CEC1]/80 hover:border-[#D8CEC1]"
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#71675E]">Total Registrations</p>
            <Building2 className="h-4 w-4 text-[#71675E]" />
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-bold tracking-tight text-[#292320] tabular-nums">{counts.total}</span>
            <span className="text-xs text-[#71675E]">All time</span>
          </div>
        </div>

        {/* In Progress */}
        <div
          onClick={() => setActiveFilter("IN_PROGRESS")}
          className={`bg-[#FFFCF7] border p-4 rounded-lg cursor-pointer transition-all ${
            activeFilter === "IN_PROGRESS"
              ? "border-amber-600 ring-1 ring-amber-600/30 shadow-xs"
              : "border-[#D8CEC1]/80 hover:border-[#D8CEC1]"
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-800">In Progress</p>
            <Clock className="h-4 w-4 text-amber-600" />
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-bold tracking-tight text-amber-800 tabular-nums">{counts.inProgress}</span>
            <span className="text-xs text-amber-700">Currently active</span>
          </div>
        </div>

        {/* Pending Approval */}
        <div
          onClick={() => setActiveFilter("PENDING")}
          className={`bg-[#FFFCF7] border p-4 rounded-lg cursor-pointer transition-all ${
            activeFilter === "PENDING"
              ? "border-[#6B2837] ring-1 ring-[#6B2837]/30 shadow-xs"
              : "border-[#D8CEC1]/80 hover:border-[#D8CEC1]"
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6B2837]">Pending Approval</p>
            <AlertTriangle className="h-4 w-4 text-[#6B2837]" />
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-bold tracking-tight text-[#6B2837] tabular-nums">{counts.pending}</span>
            <span className="text-xs text-[#71675E]">Awaiting review</span>
          </div>
        </div>

        {/* Fully Approved */}
        <div
          onClick={() => setActiveFilter("APPROVED")}
          className={`bg-[#FFFCF7] border p-4 rounded-lg cursor-pointer transition-all ${
            activeFilter === "APPROVED"
              ? "border-emerald-600 ring-1 ring-emerald-600/30 shadow-xs"
              : "border-[#D8CEC1]/80 hover:border-[#D8CEC1]"
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-800">Approved</p>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-bold tracking-tight text-emerald-800 tabular-nums">{counts.approved}</span>
            <span className="text-xs text-emerald-700">Provisioned</span>
          </div>
        </div>
      </div>

      {/* 3. Filter Toolbar & Search */}
      <div className="bg-[#FFFCF7] border border-[#D8CEC1]/80 p-4 rounded-lg flex flex-col sm:flex-row justify-between items-center gap-3">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#71675E]" />
          <input
            type="text"
            placeholder="Search by business name, slug, email, or tracking code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-[#F7F3EC] border border-[#D8CEC1] rounded-md text-xs text-[#292320] placeholder-[#71675E] focus:outline-none focus:ring-1 focus:ring-[#6B2837]"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex bg-[#F7F3EC] border border-[#D8CEC1] p-0.5 rounded-md text-[11px] font-medium">
            <button
              onClick={() => setActiveFilter("ALL")}
              className={`px-3 py-1 rounded cursor-pointer transition-colors ${
                activeFilter === "ALL" ? "bg-[#6B2837] text-white font-semibold" : "text-[#71675E] hover:text-[#292320]"
              }`}
            >
              All ({counts.total})
            </button>
            <button
              onClick={() => setActiveFilter("IN_PROGRESS")}
              className={`px-3 py-1 rounded cursor-pointer transition-colors ${
                activeFilter === "IN_PROGRESS"
                  ? "bg-[#6B2837] text-white font-semibold"
                  : "text-[#71675E] hover:text-[#292320]"
              }`}
            >
              In Progress ({counts.inProgress})
            </button>
            <button
              onClick={() => setActiveFilter("PENDING")}
              className={`px-3 py-1 rounded cursor-pointer transition-colors ${
                activeFilter === "PENDING"
                  ? "bg-[#6B2837] text-white font-semibold"
                  : "text-[#71675E] hover:text-[#292320]"
              }`}
            >
              Pending ({counts.pending})
            </button>
            <button
              onClick={() => setActiveFilter("APPROVED")}
              className={`px-3 py-1 rounded cursor-pointer transition-colors ${
                activeFilter === "APPROVED"
                  ? "bg-[#6B2837] text-white font-semibold"
                  : "text-[#71675E] hover:text-[#292320]"
              }`}
            >
              Approved ({counts.approved})
            </button>
          </div>

          <button
            onClick={() => fetchOnboardingData()}
            title="Refresh pipeline"
            className="p-1.5 bg-[#F7F3EC] hover:bg-[#EEE7DD] border border-[#D8CEC1] text-[#71675E] hover:text-[#292320] rounded-md transition-colors cursor-pointer"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* 4. Onboarding Pipeline Table */}
      <div className="bg-[#FFFCF7] border border-[#D8CEC1]/80 rounded-lg overflow-hidden shadow-xs">
        <div className="p-4 border-b border-[#D8CEC1]/80 flex justify-between items-center bg-[#F7F3EC]/50">
          <h2 className="text-sm font-bold text-[#292320]">
            Registrations Directory
            <span className="ml-2 text-xs font-normal text-[#71675E] tabular-nums">
              ({registrations.length} workspaces)
            </span>
          </h2>
        </div>

        {loading ? (
          <div className="p-12 text-center space-y-3">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#6B2837] border-t-transparent mx-auto" />
            <p className="text-xs text-[#71675E]">Loading onboarding pipeline...</p>
          </div>
        ) : registrations.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <Rocket className="h-8 w-8 text-[#71675E] mx-auto opacity-50" />
            <p className="text-xs font-semibold text-[#292320]">No onboarding registrations found</p>
            <p className="text-[11px] text-[#71675E]">
              {search.trim()
                ? "No registrations match your search criteria."
                : "No tenants currently in the onboarding pipeline."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#D8CEC1] bg-[#F7F3EC]/80 text-[#71675E] font-semibold uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-4">Business / Property</th>
                  <th className="py-2.5 px-3">Type & Plan</th>
                  <th className="py-2.5 px-3">Owner Contact</th>
                  <th className="py-2.5 px-3">Pipeline Stage</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Registered</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D8CEC1]/60">
                {registrations.map((r) => (
                  <tr key={r.id} className="hover:bg-[#F7F3EC]/40 transition-colors">
                    {/* Business Name */}
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

                    {/* Plan */}
                    <td className="py-3 px-3">
                      <div className="font-semibold text-[#292320]">{r.plan}</div>
                      <div className="text-[10px] text-[#71675E] mt-0.5 uppercase tracking-wide">
                        {r.businessType} • {r.billingCycle}
                      </div>
                    </td>

                    {/* Owner */}
                    <td className="py-3 px-3">
                      <div className="text-[#292320] font-medium">{r.ownerName}</div>
                      <div className="text-[11px] text-[#71675E] mt-0.5 flex items-center gap-1">
                        <Mail className="h-3 w-3 shrink-0" />
                        <span className="truncate max-w-[150px]">{r.ownerEmail}</span>
                      </div>
                    </td>

                    {/* Pipeline Stage with Progress Bar */}
                    <td className="py-3 px-3 min-w-[140px]">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-[#292320] mb-1">
                        <span>Step {r.onboardingStep} of 5</span>
                        <span className="tabular-nums text-[#71675E]">{r.onboardingProgress}%</span>
                      </div>
                      <div className="w-full bg-[#EEE7DD] h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${
                            r.status === "APPROVED"
                              ? "bg-emerald-600"
                              : r.status === "CHANGES_REQUESTED"
                              ? "bg-amber-600"
                              : "bg-[#6B2837]"
                          }`}
                          style={{ width: `${r.onboardingProgress}%` }}
                        />
                      </div>
                    </td>

                    {/* Status Badge */}
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

                    {/* Submitted Date */}
                    <td className="py-3 px-3 tabular-nums font-medium text-[#292320]">
                      {new Date(r.createdAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedReg(r)}
                          className="px-2.5 py-1 bg-[#FFFCF7] hover:bg-[#F7F3EC] border border-[#D8CEC1] text-[#292320] rounded text-[11px] font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="h-3 w-3 text-[#6B2837]" />
                          Inspect
                        </button>
                        {r.status === "PENDING" && (
                          <Link
                            href="/dashboard/super-admin/businesses/pending"
                            className="px-2.5 py-1 bg-[#6B2837] hover:bg-[#521E2A] text-white rounded text-[11px] font-semibold shadow-2xs transition-colors flex items-center gap-1"
                          >
                            <ShieldCheck className="h-3 w-3" />
                            Verify
                          </Link>
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

      {/* INSPECT MODAL */}
      {selectedReg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg max-w-lg w-full p-5 space-y-4 shadow-md text-[#292320]">
            <div className="flex justify-between items-start border-b border-[#D8CEC1] pb-3">
              <div>
                <h3 className="text-sm font-bold text-[#292320]">Onboarding Registration Details</h3>
                <p className="text-xs text-[#71675E] mt-0.5">
                  Tracking Code: <span className="font-semibold text-[#292320]">{selectedReg.trackingCode}</span>
                </p>
              </div>
              <button
                onClick={() => setSelectedReg(null)}
                className="text-[#71675E] hover:text-[#292320] p-1 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-[#F7F3EC] p-3 rounded-md border border-[#D8CEC1]">
                <p className="text-[10px] text-[#71675E] font-semibold uppercase">Business</p>
                <p className="font-bold text-[#292320] mt-0.5">{selectedReg.businessName}</p>
                <p className="text-[11px] text-[#71675E]">Slug: {selectedReg.slug}</p>
                <p className="text-[11px] text-[#71675E]">Type: {selectedReg.businessType}</p>
                <p className="text-[11px] text-[#71675E]">Address: {selectedReg.address || "N/A"}</p>
              </div>

              <div className="bg-[#F7F3EC] p-3 rounded-md border border-[#D8CEC1]">
                <p className="text-[10px] text-[#71675E] font-semibold uppercase">Applicant</p>
                <p className="font-bold text-[#292320] mt-0.5">{selectedReg.ownerName}</p>
                <p className="text-[11px] text-[#71675E]">{selectedReg.ownerEmail}</p>
                <p className="text-[11px] text-[#71675E]">{selectedReg.ownerPhone || "No phone provided"}</p>
              </div>
            </div>

            <div className="bg-[#F7F3EC] p-3 rounded-md border border-[#D8CEC1] text-xs">
              <p className="text-[10px] text-[#71675E] font-semibold uppercase">Plan & Duration</p>
              <div className="flex items-center gap-3 mt-1 font-semibold text-[#292320]">
                <span>Tier: {selectedReg.plan}</span>
                <span>•</span>
                <span>Billing: {selectedReg.billingCycle}</span>
                <span>•</span>
                <span>Duration: {selectedReg.durationMonths} Months</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#D8CEC1]">
              <button
                onClick={() => setSelectedReg(null)}
                className="px-3.5 py-1.5 border border-[#D8CEC1] text-xs font-semibold rounded-md bg-[#FFFCF7] text-[#292320] hover:bg-[#F7F3EC] cursor-pointer"
              >
                Close
              </button>
              {selectedReg.status === "PENDING" && (
                <Link
                  href="/dashboard/super-admin/businesses/pending"
                  className="px-4 py-1.5 bg-[#6B2837] text-white text-xs font-semibold rounded-md hover:bg-[#521E2A] flex items-center gap-1.5"
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Proceed to Verification
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

