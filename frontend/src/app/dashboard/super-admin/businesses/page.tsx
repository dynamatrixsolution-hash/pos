"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import BusinessOnboardingWizard from "@/components/business-onboarding-wizard";
import ExportDropdown from "@/components/export-dropdown";
import { ExportOptions } from "@/lib/export-service";
import { toast } from "@/components/toast";
import {
  Building2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Plus,
  Search,
  Eye,
  Trash,
  RefreshCw,
  Sliders,
  ChevronLeft,
  ChevronRight,
  X,
  Pencil,
} from "lucide-react";

interface BusinessItem {
  id: string;
  name: string;
  slug: string;
  currency: string;
  logo?: string | null;
  createdAt: string;
  settings?: any;
  subscription?: {
    plan: string;
    status: string;
    endDate: string;
    userLimit?: number;
    branchLimit?: number;
  } | null;
  users?: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    isActive: boolean;
  }[];
  _count?: {
    branches: number;
    users: number;
  };
}

export default function SuperAdminBusinessesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");

  const [activeTab, setActiveTab] = useState<"all" | "add" | "suspended">("all");
  const [businesses, setBusinesses] = useState<BusinessItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedBusiness, setSelectedBusiness] = useState<BusinessItem | null>(null);

  // Modals / Action States
  const [isOverrideOpen, setIsOverrideOpen] = useState(false);
  const [customFeatures, setCustomFeatures] = useState<Record<string, boolean>>({});
  const [customLimits, setCustomLimits] = useState<Record<string, number>>({});

  useEffect(() => {
    if (tabParam === "add") {
      setActiveTab("add");
    } else if (tabParam === "suspended") {
      setActiveTab("suspended");
    } else {
      setActiveTab("all");
    }
  }, [tabParam]);

  const fetchBusinesses = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/super-admin/businesses");
      if (!res.ok) {
        throw new Error("Failed to load platform businesses");
      }
      const data = await res.json();
      setBusinesses(data.businesses || []);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to load businesses");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login");
    } else if (session?.user && (session.user as any).role !== "SUPER_ADMIN") {
      router.push("/dashboard");
    } else if (status === "authenticated") {
      fetchBusinesses();
    }
  }, [status, session, router, fetchBusinesses]);

  // Handle Tenant Actions
  const handleAction = async (businessId: string, action: string, payload: any = {}) => {
    try {
      const res = await fetch(`/api/v1/super-admin/businesses/${businessId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Action execution failed");
      }

      toast.success(data.message || `Action '${action}' completed successfully.`);
      setIsOverrideOpen(false);
      fetchBusinesses();
    } catch (err: any) {
      toast.error(err.message || "Failed to execute tenant action");
    }
  };

  const handleDeleteBusiness = async (businessId: string) => {
    if (
      !confirm(
        "Are you absolutely sure you want to permanently delete this business? This action cascades and deletes ALL data, branches, products, and sales logs!"
      )
    )
      return;

    try {
      const res = await fetch(`/api/v1/super-admin/businesses/${businessId}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete business");
      }

      toast.success("Business deleted successfully");
      setSelectedBusiness(null);
      fetchBusinesses();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete business");
    }
  };

  // Filter listings
  const filtered = businesses.filter((b) => {
    const matchesSearch =
      b.name.toLowerCase().includes(search.toLowerCase()) ||
      b.slug.toLowerCase().includes(search.toLowerCase()) ||
      (b.users?.[0]?.email || "").toLowerCase().includes(search.toLowerCase());

    if (activeTab === "suspended") {
      return matchesSearch && b.subscription?.status === "SUSPENDED";
    }
    return matchesSearch;
  });

  const totalBusinesses = businesses.length;
  const activeSubs = businesses.filter((b) => b.subscription?.status === "ACTIVE").length;
  const trialSubs = businesses.filter((b) => b.subscription?.plan === "FREE_TRIAL" || b.subscription?.plan === "STARTER").length;
  const suspendedSubs = businesses.filter((b) => b.subscription?.status === "SUSPENDED").length;

  // Populate custom override sliders
  const openOverrideControls = (b: BusinessItem) => {
    setSelectedBusiness(b);
    const sets = b.settings || {};
    setCustomFeatures(
      sets.customFeatures || {
        "POS Billing": true,
        Products: true,
        Inventory: true,
        Purchases: true,
        Customers: true,
        Suppliers: true,
        Reports: true,
        Expenses: true,
        Payments: true,
        "Multi Branch": true,
        Warehouses: true,
        "Device Control": true,
        "Activity Logs": true,
        Barcode: true,
        "Batch Tracking": true,
        "Expiry Tracking": true,
        "API Access": true,
        "Backup System": true,
      }
    );
    setCustomLimits(
      sets.customLimits || {
        users: b.subscription?.userLimit || 5,
        branches: b.subscription?.branchLimit || 1,
        warehouses: 2,
        products: 10000,
        transactions: 2000,
      }
    );
    setIsOverrideOpen(true);
  };

  // Prepare export function
  const getExportOptions = (): ExportOptions => ({
    filename: `tenant-registry-${new Date().toISOString().split("T")[0]}`,
    title: "Registered Businesses & Tenants Directory",
    subtitle: "Complete platform tenant directory report",
    dateRange: "All Time",
    columns: [
      { header: "Business Name", key: "name", width: 25 },
      { header: "Slug", key: "slug", width: 18 },
      { header: "Currency", key: "currency", width: 10 },
      { header: "Plan", key: "plan", width: 15 },
      { header: "Status", key: "status", width: 12 },
      { header: "End Date", key: "endDate", width: 14 },
      { header: "Branches", key: "branches", width: 10 },
      { header: "Users", key: "users", width: 10 },
      { header: "Owner Email", key: "ownerEmail", width: 25 },
    ],
    data: businesses.map((b) => ({
      name: b.name,
      slug: b.slug,
      currency: b.currency,
      plan: b.subscription?.plan || "N/A",
      status: b.subscription?.status || "INACTIVE",
      endDate: b.subscription?.endDate
        ? new Date(b.subscription.endDate).toISOString().split("T")[0]
        : "N/A",
      branches: b._count?.branches || 0,
      users: b._count?.users || 0,
      ownerEmail: b.users?.[0]?.email || "N/A",
    })),
  });

  return (
    <div className="space-y-2.5 pb-8 text-[#292320]">
      {/* 1. Header (Clean, Minimalist) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-1 border-b border-[#D8CEC1]">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-[#292320]">
            Registered Businesses
          </h1>
          <p className="text-[11px] text-[#71675E] mt-0.5">
            Manage platform business tenants, subscription status, and access credentials.
          </p>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => fetchBusinesses()}
            disabled={loading}
            className="p-1.5 text-[#71675E] hover:text-[#292320] bg-[#FFFCF7] border border-[#D8CEC1] rounded-md hover:bg-[#EEE7DD] transition-colors cursor-pointer"
            title="Refresh businesses"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
          <ExportDropdown
            getExportOptions={getExportOptions}
            buttonText="Export Data"
            variant="outline"
          />
          <button
            onClick={() => {
              setActiveTab(activeTab === "add" ? "all" : "add");
            }}
            className="px-2.5 py-1.5 bg-[#FFFCF7] hover:bg-[#EEE7DD] text-[#292320] border border-[#D8CEC1] rounded-md text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
            title="Toggle inline registration wizard"
          >
            <span>{activeTab === "add" ? "Close Wizard" : "Quick Add"}</span>
          </button>
          <Link
            href="/dashboard/super-admin/onboarding/register"
            className="px-3 py-1.5 bg-[#6B2837] hover:bg-[#521E2A] text-white rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Register Business</span>
          </Link>
        </div>
      </div>

      {/* 2. Compact Minimalist KPI Cards (Clean, compact ~48px height) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        <div className="py-2 px-3 rounded-md bg-[#FFFCF7] border border-[#D8CEC1]">
          <div className="flex items-center justify-between text-[11px] text-[#71675E] font-medium">
            <span>Total Businesses</span>
            <Building2 className="h-3.5 w-3.5 text-[#6B2837]" />
          </div>
          <div className="mt-0.5 text-lg font-bold tracking-tight text-[#292320] tabular-nums">
            {totalBusinesses}
          </div>
        </div>

        <div className="py-2 px-3 rounded-md bg-[#FFFCF7] border border-[#D8CEC1]">
          <div className="flex items-center justify-between text-[11px] text-[#71675E] font-medium">
            <span>Active Tenants</span>
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
          </div>
          <div className="mt-0.5 text-lg font-bold tracking-tight text-[#292320] tabular-nums">
            {activeSubs}
          </div>
        </div>

        <div className="py-2 px-3 rounded-md bg-[#FFFCF7] border border-[#D8CEC1]">
          <div className="flex items-center justify-between text-[11px] text-[#71675E] font-medium">
            <span>Free Trials / Starter</span>
            <Clock className="h-3.5 w-3.5 text-amber-500" />
          </div>
          <div className="mt-0.5 text-lg font-bold tracking-tight text-[#292320] tabular-nums">
            {trialSubs}
          </div>
        </div>

        <div className="py-2 px-3 rounded-md bg-[#FFFCF7] border border-[#D8CEC1]">
          <div className="flex items-center justify-between text-[11px] text-[#71675E] font-medium">
            <span>Suspended</span>
            <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />
          </div>
          <div className="mt-0.5 text-lg font-bold tracking-tight text-[#292320] tabular-nums">
            {suspendedSubs}
          </div>
        </div>
      </div>

      {/* 3. Tab Content / Provisioning Wizard or Main Table */}
      {activeTab === "add" ? (
        <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-md p-4">
          <div className="flex items-center justify-between pb-2 border-b border-[#D8CEC1] mb-3">
            <h3 className="text-xs font-bold text-[#292320]">Provision New Hospitality Business</h3>
            <button
              onClick={() => setActiveTab("all")}
              className="text-[11px] text-[#71675E] hover:text-[#292320] cursor-pointer"
            >
              Cancel &rarr;
            </button>
          </div>
          <BusinessOnboardingWizard
            mode="SUPER_ADMIN"
            onSuccess={() => {
              setActiveTab("all");
              fetchBusinesses();
            }}
          />
        </div>
      ) : (
        <>
          {/* Full-width Search & Filters in one compact row */}
          <div className="flex flex-col sm:flex-row items-center gap-2">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-[#71675E]" />
              <input
                type="text"
                placeholder="Search businesses by name, slug, or owner email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-[#FFFCF7] border border-[#D8CEC1] rounded-md text-xs text-[#292320] placeholder:text-[#71675E] focus:outline-none focus:border-[#6B2837] transition-all"
              />
            </div>

            <div className="flex items-center gap-1 self-end sm:self-auto text-xs">
              <button
                onClick={() => setActiveTab("all")}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                  activeTab === "all"
                    ? "bg-[#6B2837] text-white font-semibold"
                    : "bg-[#FFFCF7] border border-[#D8CEC1] text-[#71675E] hover:text-[#292320]"
                }`}
              >
                All ({totalBusinesses})
              </button>
              <button
                onClick={() => setActiveTab("suspended")}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                  activeTab === "suspended"
                    ? "bg-[#6B2837] text-white font-semibold"
                    : "bg-[#FFFCF7] border border-[#D8CEC1] text-[#71675E] hover:text-[#292320]"
                }`}
              >
                Suspended ({suspendedSubs})
              </button>
            </div>
          </div>

          {/* Main Content: Businesses Table Card */}
          <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-md overflow-hidden">
            {/* Table Card Header */}
            <div className="py-2 px-3 border-b border-[#D8CEC1] flex items-center justify-between bg-[#FFFCF7]">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#292320]">
                REGISTERED TENANTS ({filtered.length})
              </div>
              <div className="flex items-center gap-3 text-[11px] font-medium text-[#71675E]">
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-600"></span>
                  Active
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500"></span>
                  Suspended
                </span>
              </div>
            </div>

            {loading ? (
              <div className="p-8 text-center text-xs text-[#71675E] flex items-center justify-center gap-2">
                <RefreshCw className="h-3.5 w-3.5 animate-spin text-[#6B2837]" />
                <span>Loading registered tenants...</span>
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-10 px-4 text-center">
                <div className="h-10 w-10 rounded-full border border-[#D8CEC1] bg-[#F7F3EC] text-[#71675E] flex items-center justify-center mx-auto mb-2">
                  <Building2 className="h-5 w-5 stroke-[2]" />
                </div>
                <h3 className="text-xs font-bold text-[#292320]">No businesses found</h3>
                <p className="text-[11px] text-[#71675E] mt-0.5">
                  {search ? "No tenants match your search query." : "No registered businesses found in directory."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#D8CEC1] bg-[#F7F3EC] text-[#71675E] font-semibold text-[10px] uppercase tracking-wider">
                      <th className="py-2 px-3">Business / Property</th>
                      <th className="py-2 px-3">Owner & Contact</th>
                      <th className="py-2 px-3 text-center">Plan Status</th>
                      <th className="py-2 px-3 text-center">Limits</th>
                      <th className="py-2 px-3">Provisioned</th>
                      <th className="py-2 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D8CEC1]/50">
                    {filtered.map((b) => {
                      const owner = b.users?.[0];
                      const isActive = b.subscription?.status === "ACTIVE";

                      return (
                        <tr key={b.id} className="hover:bg-[#F7F3EC]/50 transition-colors">
                          {/* Business Details */}
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-2.5">
                              {b.logo || b.settings?.logo ? (
                                <img
                                  src={b.logo || b.settings?.logo}
                                  alt={b.name}
                                  className="h-7 w-7 rounded object-cover border border-[#D8CEC1] bg-[#FFFCF7] shrink-0"
                                />
                              ) : (
                                <div className="h-7 w-7 rounded bg-[#6B2837] text-white flex items-center justify-center font-bold text-[10px] shrink-0 border border-[#D8CEC1]">
                                  {b.name.slice(0, 2).toUpperCase()}
                                </div>
                              )}
                              <div>
                                <Link
                                  href={`/dashboard/super-admin/businesses/${b.id}`}
                                  className="font-semibold text-xs text-[#292320] hover:text-[#6B2837] hover:underline block leading-tight"
                                >
                                  {b.name}
                                </Link>
                                <span className="text-[10px] text-[#71675E] font-mono">
                                  /{b.slug} &bull; {b.currency}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Owner Info */}
                          <td className="py-2 px-3">
                            {owner ? (
                              <>
                                <span className="text-xs text-[#292320] font-medium">{owner.name}</span>
                                <span className="text-[10px] text-[#71675E] font-mono ml-2">
                                  {owner.email}
                                </span>
                              </>
                            ) : (
                              <span className="text-rose-600 italic text-[11px]">No Owner</span>
                            )}
                          </td>

                          {/* Plan Status */}
                          <td className="py-2 px-3 text-center whitespace-nowrap">
                            {b.subscription ? (
                              <div className="inline-flex items-center gap-1.5">
                                <span
                                  className={`px-1.5 py-0.2 rounded text-[10px] font-semibold border ${
                                    isActive
                                      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                      : "bg-rose-50 text-rose-800 border-rose-200"
                                  }`}
                                >
                                  {b.subscription.plan}
                                </span>
                                <span className="text-[10px] text-[#71675E] font-mono">
                                  exp: {new Date(b.subscription.endDate).toLocaleDateString()}
                                </span>
                              </div>
                            ) : (
                              <span className="text-rose-600 text-[10px] font-semibold">No Sub</span>
                            )}
                          </td>

                          {/* Limits */}
                          <td className="py-2 px-3 text-center whitespace-nowrap text-[#71675E] font-mono text-[11px]">
                            {b._count?.branches || 1} br &bull; {b._count?.users || 1} usr
                          </td>

                          {/* Provisioned Date */}
                          <td className="py-2 px-3 whitespace-nowrap text-xs text-[#71675E] font-mono">
                            {new Date(b.createdAt).toLocaleDateString("en-US", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </td>

                          {/* Actions */}
                          <td className="py-2 px-3 whitespace-nowrap text-right">
                            <div className="inline-flex items-center gap-1">
                              <Link
                                href={`/dashboard/super-admin/businesses/${b.id}`}
                                className="p-1 text-[#292320] bg-[#FFFCF7] border border-[#D8CEC1] rounded hover:bg-[#EEE7DD] transition-colors cursor-pointer"
                                title="View details"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Link>
                              <Link
                                href={`/dashboard/super-admin/businesses/${b.id}/edit`}
                                className="p-1 text-[#6B2837] bg-[#FFFCF7] border border-[#D8CEC1] rounded hover:bg-[#EEE7DD] transition-colors cursor-pointer"
                                title="Edit business profile & logo"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Link>
                              <button
                                onClick={() => openOverrideControls(b)}
                                className="p-1 text-amber-700 bg-[#FFFCF7] border border-[#D8CEC1] rounded hover:bg-[#EEE7DD] transition-colors cursor-pointer"
                                title="Overrides"
                              >
                                <Sliders className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteBusiness(b.id)}
                                className="p-1 text-rose-600 bg-[#FFFCF7] border border-[#D8CEC1] rounded hover:bg-rose-50 transition-colors cursor-pointer"
                                title="Delete tenant"
                              >
                                <Trash className="h-3.5 w-3.5" />
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

            {/* Minimalist Pagination Footer */}
            <div className="py-2 px-3 border-t border-[#D8CEC1] flex items-center justify-between text-[11px] text-[#71675E] bg-[#FFFCF7]">
              <div>
                Showing {filtered.length > 0 ? `1 to ${filtered.length}` : "0"} of {filtered.length}
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
        </>
      )}

      {/* 4. Overrides Modal */}
      {selectedBusiness && isOverrideOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-[#FFFCF7] rounded-lg w-full max-w-xl p-4 border border-[#D8CEC1] shadow-lg space-y-3 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-[#D8CEC1] pb-2">
              <div>
                <h3 className="text-xs font-bold text-[#292320]">Custom Overrides</h3>
                <p className="text-[11px] text-[#71675E] mt-0.5">
                  Modify plan parameters and limits for {selectedBusiness.name}
                </p>
              </div>
              <button
                onClick={() => setIsOverrideOpen(false)}
                className="text-[#71675E] hover:text-[#292320] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Plan selection */}
            <div className="grid grid-cols-2 gap-2.5 p-2.5 bg-[#F7F3EC] rounded border border-[#D8CEC1]">
              <div>
                <label className="text-[10px] font-semibold text-[#292320] block mb-1">
                  Subscription Plan
                </label>
                <select
                  id="override-plan-select"
                  defaultValue={selectedBusiness.subscription?.plan || "BASIC"}
                  className="w-full px-2 py-1 bg-[#FFFCF7] border border-[#D8CEC1] rounded text-xs text-[#292320] focus:outline-none"
                >
                  <option value="FREE_TRIAL">Starter (Free Trial)</option>
                  <option value="BASIC">Basic License</option>
                  <option value="PREMIUM">Professional License</option>
                  <option value="ENTERPRISE">Enterprise License</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-semibold text-[#292320] block mb-1">
                  Extend Months
                </label>
                <input
                  type="number"
                  id="override-duration-input"
                  defaultValue="0"
                  className="w-full px-2 py-1 bg-[#FFFCF7] border border-[#D8CEC1] rounded text-xs text-[#292320] focus:outline-none"
                />
              </div>
            </div>

            {/* Limits */}
            <div className="space-y-1.5">
              <h4 className="text-[11px] font-bold text-[#292320] uppercase tracking-wider">
                Workspace Limits
              </h4>
              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div>
                  <label className="text-[10px] text-[#71675E] block mb-0.5">Max Users</label>
                  <input
                    type="number"
                    value={customLimits.users || 5}
                    onChange={(e) => setCustomLimits({ ...customLimits, users: Number(e.target.value) })}
                    className="w-full px-2 py-1 border border-[#D8CEC1] rounded bg-[#F7F3EC] text-xs text-[#292320] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#71675E] block mb-0.5">Max Branches</label>
                  <input
                    type="number"
                    value={customLimits.branches || 1}
                    onChange={(e) => setCustomLimits({ ...customLimits, branches: Number(e.target.value) })}
                    className="w-full px-2 py-1 border border-[#D8CEC1] rounded bg-[#F7F3EC] text-xs text-[#292320] focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-1.5 pt-2 border-t border-[#D8CEC1]">
              <button
                onClick={() => setIsOverrideOpen(false)}
                className="px-2.5 py-1 border border-[#D8CEC1] rounded text-xs font-medium text-[#71675E] hover:text-[#292320] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const selPlan = (document.getElementById("override-plan-select") as HTMLSelectElement)?.value;
                  const duration = Number((document.getElementById("override-duration-input") as HTMLInputElement)?.value || 0);
                  handleAction(selectedBusiness.id, "PLAN_OVERRIDE", {
                    plan: selPlan,
                    durationMonths: duration,
                    customFeatures,
                    customLimits,
                  });
                }}
                className="px-3.5 py-1 bg-[#6B2837] hover:bg-[#521E2A] text-white rounded text-xs font-semibold cursor-pointer"
              >
                Apply Overrides
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
