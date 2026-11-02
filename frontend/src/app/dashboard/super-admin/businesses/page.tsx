"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import BusinessOnboardingWizard from "@/components/business-onboarding-wizard";
import ExportDropdown from "@/components/export-dropdown";
import { ExportOptions } from "@/lib/export-service";
import {
  Building,
  Building2,
  Users,
  Layers,
  Plus,
  Search,
  Mail,
  Phone,
  Shield,
  ShieldCheck,
  Lock,
  Globe,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Coins,
  Settings,
  Eye,
  Trash,
  UserCheck,
  UserX,
  RefreshCw,
  Sliders,
  Check,
  Clock,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

interface BusinessItem {
  id: string;
  name: string;
  slug: string;
  currency: string;
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

const businessSchema = z.object({
  businessName: z.string().min(2, "Business name must be at least 2 characters"),
  slug: z.string().min(3, "Slug must be at least 3 characters").regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens"),
  currency: z.string(),
  businessType: z.enum(["RETAIL", "PHARMACY", "RESTAURANT", "WHOLESALE"]),
  ownerName: z.string().min(2, "Owner name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  phone: z.string().optional().nullable(),
  plan: z.enum(["FREE_TRIAL", "BASIC", "PREMIUM", "ENTERPRISE"]),
  durationMonths: z.number().min(1, "Duration must be at least 1 month").max(60),
});

type BusinessFormInputs = z.infer<typeof businessSchema>;

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
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");
  const [tempPassword, setTempPassword] = useState("");
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
  const [isOverrideOpen, setIsOverrideOpen] = useState(false);

  // Custom Feature & Limit override states
  const [customFeatures, setCustomFeatures] = useState<Record<string, boolean>>({});
  const [customLimits, setCustomLimits] = useState<Record<string, number>>({});

  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm<BusinessFormInputs>({
    resolver: zodResolver(businessSchema),
    defaultValues: {
      businessName: "",
      slug: "",
      currency: "USD",
      businessType: "RETAIL",
      ownerName: "",
      email: "",
      password: "",
      phone: "",
      plan: "FREE_TRIAL",
      durationMonths: 12,
    }
  });

  const businessNameValue = watch("businessName");
  const businessTypeValue = watch("businessType");

  // Sync tab with URL search parameter
  useEffect(() => {
    if (tabParam === "add") setActiveTab("add");
    else if (tabParam === "suspended") setActiveTab("suspended");
    else setActiveTab("all");
  }, [tabParam]);

  // Auto-generate slug from business name
  useEffect(() => {
    if (businessNameValue) {
      const generatedSlug = businessNameValue
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-");
      setValue("slug", generatedSlug, { shouldValidate: true });
    }
  }, [businessNameValue, setValue]);

  const fetchBusinesses = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/super-admin/businesses");
      if (res.ok) {
        const data = await res.json();
        setBusinesses(data.businesses || []);
      }
    } catch (err) {
      console.error("Fetch businesses error:", err);
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

  const onSubmit = async (data: BusinessFormInputs) => {
    setActionError("");
    setActionSuccess("");
    try {
      const res = await fetch("/api/v1/super-admin/businesses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || "Failed to provision business");
      }

      setActionSuccess(`Business "${data.businessName}" created successfully!`);
      setTimeout(() => {
        setActionSuccess("");
        reset();
        setActiveTab("all");
        router.push("/dashboard/super-admin/businesses?tab=all");
        fetchBusinesses();
      }, 2000);
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  const handleAction = async (businessId: string, action: string, payload?: any) => {
    setActionError("");
    setActionSuccess("");
    try {
      const res = await fetch(`/api/v1/super-admin/businesses/${businessId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, payload }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update business settings");
      }

      setActionSuccess(data.message || "Operation completed successfully");
      setIsResetPasswordOpen(false);
      setIsOverrideOpen(false);
      
      // Update locally selected business stats
      await fetchBusinesses();
      
      // Update currently focused selectedBusiness object reference
      const updated = businesses.find(b => b.id === businessId);
      if (updated) {
        setSelectedBusiness(updated);
      } else {
        setSelectedBusiness(null);
      }

      setTimeout(() => setActionSuccess(""), 3000);
    } catch (err: any) {
      setActionError(err.message);
      setTimeout(() => setActionError(""), 3000);
    }
  };

  const handleDeleteBusiness = async (businessId: string) => {
    if (!confirm("Are you absolutely sure you want to permanently delete this business? This action cascades and deletes ALL data, branches, products, and sales logs!")) return;
    setActionError("");
    setActionSuccess("");
    try {
      const res = await fetch(`/api/v1/super-admin/businesses/${businessId}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete business");
      }

      setActionSuccess("Business deleted successfully");
      setSelectedBusiness(null);
      fetchBusinesses();
      setTimeout(() => setActionSuccess(""), 3000);
    } catch (err: any) {
      setActionError(err.message);
      setTimeout(() => setActionError(""), 3000);
    }
  };

  // Filter listings
  const filtered = businesses.filter(b => {
    const matchesSearch = b.name.toLowerCase().includes(search.toLowerCase()) || 
      b.slug.toLowerCase().includes(search.toLowerCase()) ||
      (b.users?.[0]?.email || "").toLowerCase().includes(search.toLowerCase());

    if (activeTab === "suspended") {
      return matchesSearch && b.subscription?.status === "SUSPENDED";
    }
    return matchesSearch;
  });

  const totalBusinesses = businesses.length;
  const activeSubs = businesses.filter(b => b.subscription?.status === "ACTIVE").length;
  const trialSubs = businesses.filter(b => b.subscription?.plan === "FREE_TRIAL").length;
  const suspendedSubs = businesses.filter(b => b.subscription?.status === "SUSPENDED").length;

  if (status === "loading" || loading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#6B2837] border-t-transparent mx-auto" />
          <p className="text-xs text-muted-foreground">Loading platform directory...</p>
        </div>
      </div>
    );
  }

  // Populate custom override sliders
  const openOverrideControls = (b: BusinessItem) => {
    setSelectedBusiness(b);
    const sets = b.settings || {};
    setCustomFeatures(sets.customFeatures || {
      "POS Billing": true,
      "Products": true,
      "Inventory": true,
      "Purchases": true,
      "Customers": true,
      "Suppliers": true,
      "Reports": true,
      "Expenses": true,
      "Payments": true,
      "Multi Branch": true,
      "Warehouses": true,
      "Device Control": true,
      "Activity Logs": true,
      "Barcode": true,
      "Batch Tracking": true,
      "Expiry Tracking": true,
      "API Access": true,
      "Backup System": true,
    });
    setCustomLimits(sets.customLimits || {
      users: b.subscription?.userLimit || 5,
      branches: b.subscription?.branchLimit || 1,
      warehouses: 2,
      products: 10000,
      transactions: 2000,
    });
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
      endDate: b.subscription?.endDate ? new Date(b.subscription.endDate).toISOString().split("T")[0] : "N/A",
      branches: b._count?.branches || 0,
      users: b._count?.users || 0,
      ownerEmail: b.users?.[0]?.email || "N/A",
    })),
  });

  return (
    <div className="space-y-6 text-[#292320]">
      {/* 1. Header with Breadcrumbs & Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#FFFCF7] border border-[#D8CEC1]/80 p-5 rounded-lg">
        <div>
          <div className="flex items-center gap-2 text-xs text-[#71675E] font-medium mb-1">
            <Link href="/dashboard/super-admin" className="hover:text-[#6B2837]">
              Platform
            </Link>
            <span>/</span>
            <span className="text-[#292320] font-semibold">Businesses</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-[#292320] flex items-center gap-2">
            <Building2 className="h-5 w-5 text-[#6B2837]" /> Tenant Registry
          </h1>
          <p className="text-xs text-[#71675E] mt-0.5">
            Manage multi-tenant SaaS business tenants, subscription status, overrides, and credentials.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Link
            href="/dashboard/super-admin/businesses/pending"
            className="px-3.5 py-2 bg-[#FFFCF7] hover:bg-[#F7F3EC] border border-[#D8CEC1] text-[#292320] rounded-md text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5"
          >
            <ShieldCheck className="h-4 w-4 text-[#6B2837]" />
            Pending Approvals
          </Link>
          <ExportDropdown
            getExportOptions={getExportOptions}
            buttonText="Export Directory"
            variant="outline"
          />
          <button
            onClick={() => { setActiveTab("add"); router.push("/dashboard/super-admin/businesses?tab=add"); }}
            className="px-3.5 py-2 bg-[#6B2837] hover:bg-[#521E2A] text-white rounded-md text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="h-4 w-4" /> Add Business
          </button>
        </div>
      </div>

      {/* 2. Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#FFFCF7] border border-[#D8CEC1]/80 p-5 rounded-lg flex items-center gap-4">
          <div className="h-10 w-10 bg-[#6B2837]/10 text-[#6B2837] flex items-center justify-center rounded-md">
            <Building className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Businesses</p>
            <h3 className="text-xl font-black mt-0.5">{totalBusinesses}</h3>
          </div>
        </div>

        <div className="bg-[#FFFCF7] border border-[#D8CEC1]/80 p-5 rounded-lg flex items-center gap-4">
          <div className="h-10 w-10 bg-emerald-500/10 text-emerald-500 flex items-center justify-center rounded-md">
            <CheckCircle className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Active Tenants</p>
            <h3 className="text-xl font-black mt-0.5">{activeSubs}</h3>
          </div>
        </div>

        <div className="bg-[#FFFCF7] border border-[#D8CEC1]/80 p-5 rounded-lg flex items-center gap-4">
          <div className="h-10 w-10 bg-amber-500/10 text-amber-500 flex items-center justify-center rounded-md">
            <Coins className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Free Trials</p>
            <h3 className="text-xl font-black mt-0.5">{trialSubs}</h3>
          </div>
        </div>

        <div className="bg-[#FFFCF7] border border-[#D8CEC1]/80 p-5 rounded-lg flex items-center gap-4">
          <div className="h-10 w-10 bg-red-500/10 text-red-500 flex items-center justify-center rounded-md">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Suspended</p>
            <h3 className="text-xl font-black mt-0.5">{suspendedSubs}</h3>
          </div>
        </div>
      </div>

      {/* 3. Action Alerts */}
      {actionError && (
        <div className="p-3.5 text-xs bg-red-50 text-red-650 rounded-md font-bold border border-red-150 flex items-center gap-2">
          <AlertTriangle className="h-4.5 w-4.5 flex-shrink-0" /> {actionError}
        </div>
      )}

      {actionSuccess && (
        <div className="p-3.5 text-xs bg-emerald-50 text-emerald-600 rounded-md font-bold border border-emerald-150 flex items-center gap-2 animate-pulse">
          <CheckCircle className="h-4.5 w-4.5 flex-shrink-0" /> {actionSuccess}
        </div>
      )}

      {/* Sub-Menu Tabs matching Sidebar */}
      <div className="flex border-b border-[#D8CEC1] gap-6 text-xs font-semibold overflow-x-auto">
        <Link
          href="/dashboard/super-admin/businesses"
          className="pb-2.5 border-b-2 border-[#6B2837] text-[#6B2837] whitespace-nowrap"
        >
          All Businesses ({totalBusinesses})
        </Link>
        <Link
          href="/dashboard/super-admin/businesses/pending"
          className="pb-2.5 border-b-2 border-transparent text-[#71675E] hover:text-[#292320] whitespace-nowrap transition-colors"
        >
          Pending Approvals
        </Link>
        <Link
          href="/dashboard/super-admin/businesses/expiring"
          className="pb-2.5 border-b-2 border-transparent text-[#71675E] hover:text-[#292320] whitespace-nowrap transition-colors"
        >
          Expiring Subscriptions
        </Link>
      </div>

      {/* Tab Contents: ALL & SUSPENDED LISTS */}
      {activeTab !== "add" ? (
        <div className="space-y-4">
          <div className="bg-[#FFFCF7] border border-[#D8CEC1]/80 p-5 rounded-lg flex flex-col sm:flex-row justify-between gap-4 items-center">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-2.5 h-4.5 w-4.5 text-slate-450" />
              <input
                type="text"
                placeholder="Search by name, slug, or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 w-full px-4 py-2 border border-[#D8CEC1] rounded-lg bg-[#F7F3EC] text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-[#FFFCF7] transition-all"
              />
            </div>
          </div>

          <div className="bg-[#FFFCF7] border border-[#D8CEC1]/80 rounded-lg overflow-hidden p-5">
            {filtered.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-450">No businesses match the selection.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#D8CEC1] text-slate-450 font-bold uppercase tracking-wider text-[9px] pb-3">
                      <th className="py-3 px-2">Business Details</th>
                      <th className="py-3 px-2">Owner Credentials</th>
                      <th className="py-3 px-2 text-center">Plan Status</th>
                      <th className="py-3 px-2 text-center">Limits</th>
                      <th className="py-3 px-2 text-center">Provisioned</th>
                      <th className="py-3 px-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filtered.map((b) => {
                      const owner = b.users?.[0];
                      return (
                        <tr key={b.id} className="hover:bg-[#F7F3EC]/60 transition-colors">
                          <td className="py-4 px-2">
                            <Link href={`/dashboard/super-admin/businesses/${b.id}`} className="font-bold text-[#292320] text-sm hover:text-[#6B2837] hover:underline">{b.name}</Link>
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className="flex items-center gap-1 text-[9px] text-[#71675E] bg-[#EEE7DD] px-2 py-0.5 rounded">
                                <Globe className="w-2.5 h-2.5" /> slug: {b.slug}
                              </span>
                              <span className="text-[9px] text-[#71675E] bg-[#EEE7DD] px-2 py-0.5 rounded font-bold uppercase">
                                {b.currency}
                              </span>
                            </div>
                          </td>
                          <td className="py-4 px-2">
                            {owner ? (
                              <>
                                <div className="font-bold text-[#292320]">{owner.name}</div>
                                <div className="flex items-center gap-2 mt-1 text-[9px] text-slate-450">
                                  <Mail className="w-2.5 h-2.5" /> {owner.email}
                                </div>
                              </>
                            ) : (
                              <span className="text-red-500 font-bold italic">No Owner</span>
                            )}
                          </td>
                          <td className="py-4 px-2 text-center">
                            {b.subscription ? (
                              <div>
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-wider ${
                                  b.subscription.status === "ACTIVE" 
                                    ? "bg-emerald-50 text-emerald-600 border-emerald-100" 
                                    : "bg-red-50 text-red-500 border-red-100"
                                }`}>
                                  {b.subscription.plan} ({b.subscription.status})
                                </span>
                                <div className="text-[9px] text-slate-400 mt-1 font-medium">
                                  Expires: {new Date(b.subscription.endDate).toLocaleDateString()}
                                </div>
                              </div>
                            ) : (
                              <span className="text-red-500 font-bold italic">No Subscription</span>
                            )}
                          </td>
                          <td className="py-4 px-2 text-center text-[#71675E] text-[10px] font-bold">
                            <div>Branches: {b._count?.branches || 0}</div>
                            <div className="mt-0.5 text-slate-400">Users: {b._count?.users || 0}</div>
                          </td>
                          <td className="py-4 px-2 text-center text-slate-450 text-[10px]">
                            <div className="flex items-center justify-center gap-1 font-medium">
                              <Calendar className="h-3 w-3 opacity-60" />
                              {new Date(b.createdAt).toLocaleDateString()}
                            </div>
                          </td>
                          <td className="py-4 px-2 text-right">
                            <div className="flex justify-end gap-1.5">
                              <Link href={`/dashboard/super-admin/businesses/${b.id}`} className="p-1.5 hover:bg-[#EEE7DD] rounded-lg text-[#6B2837] border border-[#D8CEC1] hover:border-[#D8CEC1] cursor-pointer inline-flex items-center" title="Open 5-Tab Detail View"><Eye className="h-4 w-4" /></Link>
                              <button
                                onClick={() => openOverrideControls(b)}
                                className="p-1.5 hover:bg-[#EEE7DD] rounded-lg text-amber-500 border border-[#D8CEC1] hover:border-[#D8CEC1] cursor-pointer"
                                title="Configure Feature Overrides"
                              >
                                <Sliders className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteBusiness(b.id)}
                                className="p-1.5 hover:bg-red-50 rounded-lg text-red-500 border border-[#D8CEC1] hover:border-red-100 cursor-pointer"
                                title="Delete Tenant"
                              >
                                <Trash className="h-4 w-4" />
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
          </div>
        </div>
      ) : (
        /* Tab Contents: PROVISION WIZARD */
        <div className="py-2">
          <BusinessOnboardingWizard
            mode="SUPER_ADMIN"
            onSuccess={() => {
              setActiveTab("all");
              fetchBusinesses();
            }}
          />
        </div>
      )}

      {/* 5. Business Details Side Drawer / Modal */}
      {selectedBusiness && !isOverrideOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-[#FFFCF7] h-screen shadow-sm p-6 overflow-y-auto border-l border-[#D8CEC1] flex flex-col justify-between animate-slide-in">
            <div className="space-y-6">
              <div className="flex justify-between items-center border-b border-[#D8CEC1] pb-4">
                <div>
                  <h3 className="text-base font-bold text-[#292320]">{selectedBusiness.name} Details</h3>
                  <span className="text-[10px] text-slate-450 bg-[#EEE7DD] px-2 py-0.5 rounded mt-1 inline-block">ID: {selectedBusiness.id}</span>
                </div>
                <button
                  onClick={() => setSelectedBusiness(null)}
                  className="px-2.5 py-1.5 hover:bg-[#EEE7DD] text-xs font-semibold text-[#71675E] rounded-lg cursor-pointer"
                >
                  Close
                </button>
              </div>

              {/* Stats & Metadata */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#F7F3EC] p-3 rounded-md border border-[#D8CEC1]">
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Licensing Status</span>
                  <div className="mt-1 flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${selectedBusiness.subscription?.status === "ACTIVE" ? "bg-emerald-500" : "bg-red-500"}`} />
                    <span className="text-xs font-bold text-[#292320]">{selectedBusiness.subscription?.plan} ({selectedBusiness.subscription?.status})</span>
                  </div>
                </div>
                <div className="bg-[#F7F3EC] p-3 rounded-md border border-[#D8CEC1]">
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Default Currency</span>
                  <p className="text-xs font-bold text-[#292320] mt-1 uppercase">{selectedBusiness.currency}</p>
                </div>
              </div>

              {/* Owner Account Parameters */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-[#6B2837] uppercase tracking-wider border-b border-slate-150 pb-1">Business Owner Profile</h4>
                {selectedBusiness.users?.[0] ? (
                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="text-slate-400">Full Name:</span> <strong className="text-[#292320]">{selectedBusiness.users[0].name}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400">Email Login:</span> <strong className="text-[#292320]">{selectedBusiness.users[0].email}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400">Owner Active:</span>{" "}
                      <span className={`font-bold ${selectedBusiness.users[0].isActive ? "text-emerald-600" : "text-red-500"}`}>
                        {selectedBusiness.users[0].isActive ? "ACTIVE" : "BLOCKED"}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs italic text-red-500 font-semibold">No Owner account initialized.</p>
                )}
              </div>

              {/* Owner Credentials Management */}
              {selectedBusiness.users?.[0] && (
                <div className="space-y-3 bg-[#F7F3EC] p-4 rounded-lg border border-[#D8CEC1]">
                  <h4 className="text-xs font-bold text-[#71675E] uppercase tracking-wider">Access Controls</h4>
                  
                  {isResetPasswordOpen ? (
                    <div className="space-y-2 pt-2 border-t border-[#D8CEC1]">
                      <label className="text-[10px] font-bold text-slate-450 uppercase">Set New Temporary Password</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={tempPassword}
                          onChange={(e) => setTempPassword(e.target.value)}
                          placeholder="min. 6 characters"
                          className="flex-1 px-3 py-1.5 border border-[#D8CEC1] rounded-lg text-xs bg-[#FFFCF7] focus:outline-none"
                        />
                        <button
                          onClick={() => handleAction(selectedBusiness.id, "RESET_PASSWORD", { newPassword: tempPassword })}
                          className="px-3 py-1.5 bg-[#6B2837] hover:bg-[#521E2A] text-white rounded-lg text-xs font-bold cursor-pointer"
                        >
                          Apply
                        </button>
                        <button
                          onClick={() => setIsResetPasswordOpen(false)}
                          className="px-2 py-1.5 border border-[#D8CEC1] text-[#71675E] rounded-lg text-xs font-semibold hover:bg-[#EEE7DD] cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        onClick={() => { setTempPassword(""); setIsResetPasswordOpen(true); }}
                        className="py-2 text-center text-[10px] font-bold uppercase tracking-wider text-[#6B2837] hover:bg-blue-50 border border-blue-100 rounded-md transition-colors cursor-pointer"
                      >
                        Reset Password
                      </button>
                      <button
                        onClick={() => handleAction(selectedBusiness.id, "CREDENTIALS_CONTROL", { disableLogin: selectedBusiness.users?.[0].isActive })}
                        className={`py-2 text-center text-[10px] font-bold uppercase tracking-wider rounded-md border transition-colors cursor-pointer ${
                          selectedBusiness.users?.[0].isActive
                            ? "text-red-500 border-red-100 hover:bg-red-50"
                            : "text-emerald-600 border-emerald-100 hover:bg-emerald-50"
                        }`}
                      >
                        {selectedBusiness.users?.[0].isActive ? "Disable Login" : "Unlock Account"}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Quick Actions (Suspend/Activate) */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-[#71675E] uppercase tracking-wider border-b border-slate-150 pb-1">License Suspensions</h4>
                <div className="flex gap-2">
                  {selectedBusiness.subscription?.status === "SUSPENDED" ? (
                    <button
                      onClick={() => handleAction(selectedBusiness.id, "ACTIVATE")}
                      className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-md shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <UserCheck className="w-4 h-4" /> Activate Business
                    </button>
                  ) : (
                    <button
                      onClick={() => handleAction(selectedBusiness.id, "SUSPEND")}
                      className="flex-1 py-2.5 bg-red-500 hover:bg-red-650 text-white text-xs font-bold rounded-md shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <UserX className="w-4 h-4" /> Suspend Tenant
                    </button>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={() => setSelectedBusiness(null)}
              className="w-full py-2.5 mt-8 border border-[#D8CEC1] text-[#292320] rounded-md text-xs font-bold hover:bg-[#F7F3EC] cursor-pointer"
            >
              Back to Registry List
            </button>
          </div>
        </div>
      )}

      {/* 6. Feature & Limit Custom Overrides Modal */}
      {selectedBusiness && isOverrideOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-[#FFFCF7] rounded-lg w-full max-w-2xl p-6 shadow-sm border border-[#D8CEC1] my-8 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center border-b border-[#D8CEC1] pb-3 mb-4">
                <div>
                  <h3 className="text-base font-bold text-[#292320]">Custom System Overrides</h3>
                  <p className="text-[10px] text-slate-450">Assign plan values, modify limits, and activate/deactivate modules for {selectedBusiness.name}.</p>
                </div>
                <button
                  onClick={() => setIsOverrideOpen(false)}
                  className="px-2 py-1.5 hover:bg-[#EEE7DD] text-xs font-semibold text-[#71675E] rounded-lg cursor-pointer"
                >
                  Close
                </button>
              </div>

              {/* Plans Override Section */}
              <div className="bg-[#F7F3EC] p-4 rounded-lg border border-[#D8CEC1] mb-4 grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-450 uppercase">Update Subscription Plan</label>
                  <select
                    id="override-plan-select"
                    defaultValue={selectedBusiness.subscription?.plan || "BASIC"}
                    className="w-full px-3 py-1.5 bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg text-xs font-bold focus:outline-none"
                  >
                    <option value="FREE_TRIAL">Starter (Free Trial)</option>
                    <option value="BASIC">Basic License</option>
                    <option value="PREMIUM">Professional License</option>
                    <option value="ENTERPRISE">Enterprise License</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-450 uppercase">Extend Validity (Months)</label>
                  <input
                    type="number"
                    id="override-duration-input"
                    defaultValue="0"
                    className="w-full px-3 py-1.5 bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg text-xs font-semibold focus:outline-none"
                  />
                </div>
              </div>

              {/* Limits and Toggles Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-[40vh] overflow-y-auto pr-1">
                {/* Feature Toggles List */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-650 uppercase tracking-wider border-b border-[#D8CEC1] pb-1">Features Activation Toggles</h4>
                  <div className="space-y-2">
                    {Object.keys(customFeatures).map((f) => (
                      <label key={f} className="flex items-center justify-between p-2 hover:bg-[#F7F3EC] rounded-lg cursor-pointer border border-[#D8CEC1]">
                        <span className="text-xs font-bold text-[#71675E]">{f}</span>
                        <input
                          type="checkbox"
                          checked={customFeatures[f]}
                          onChange={(e) => setCustomFeatures({ ...customFeatures, [f]: e.target.checked })}
                          className="h-4.5 w-4.5 text-[#6B2837] rounded border-[#D8CEC1] focus:ring-blue-500"
                        />
                      </label>
                    ))}
                  </div>
                </div>

                {/* Plan Limits Config */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-650 uppercase tracking-wider border-b border-[#D8CEC1] pb-1">SaaS Workspace Limits</h4>
                  <div className="space-y-3 text-xs font-semibold">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-450 uppercase">Active Users Limit</label>
                      <input
                        type="number"
                        value={customLimits.users || 5}
                        onChange={(e) => setCustomLimits({ ...customLimits, users: Number(e.target.value) })}
                        className="w-full px-3 py-1.5 border border-[#D8CEC1] rounded-lg bg-[#F7F3EC] focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-450 uppercase">Store Branches Limit</label>
                      <input
                        type="number"
                        value={customLimits.branches || 1}
                        onChange={(e) => setCustomLimits({ ...customLimits, branches: Number(e.target.value) })}
                        className="w-full px-3 py-1.5 border border-[#D8CEC1] rounded-lg bg-[#F7F3EC] focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-450 uppercase">Warehouses Limit</label>
                      <input
                        type="number"
                        value={customLimits.warehouses || 2}
                        onChange={(e) => setCustomLimits({ ...customLimits, warehouses: Number(e.target.value) })}
                        className="w-full px-3 py-1.5 border border-[#D8CEC1] rounded-lg bg-[#F7F3EC] focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-450 uppercase">Max Products Catalog Size</label>
                      <input
                        type="number"
                        value={customLimits.products || 10000}
                        onChange={(e) => setCustomLimits({ ...customLimits, products: Number(e.target.value) })}
                        className="w-full px-3 py-1.5 border border-[#D8CEC1] rounded-lg bg-[#F7F3EC] focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-450 uppercase">Monthly Transactions limit</label>
                      <input
                        type="number"
                        value={customLimits.transactions || 2000}
                        onChange={(e) => setCustomLimits({ ...customLimits, transactions: Number(e.target.value) })}
                        className="w-full px-3 py-1.5 border border-[#D8CEC1] rounded-lg bg-[#F7F3EC] focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t border-[#D8CEC1] mt-4">
              <button
                onClick={() => setIsOverrideOpen(false)}
                className="px-4 py-2 border border-[#D8CEC1] rounded-lg text-xs font-semibold hover:bg-[#F7F3EC] cursor-pointer"
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
                className="flex-1 px-4 py-2 bg-[#6B2837] hover:bg-[#521E2A] text-white rounded-lg text-xs font-bold shadow-sm cursor-pointer"
              >
                Apply Custom Overrides
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
