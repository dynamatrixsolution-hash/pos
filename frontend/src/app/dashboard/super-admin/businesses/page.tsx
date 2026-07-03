"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Building,
  Users,
  Layers,
  Plus,
  Search,
  Mail,
  Phone,
  Shield,
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
      ownerName: "",
      email: "",
      password: "",
      phone: "",
      plan: "FREE_TRIAL",
      durationMonths: 12,
    }
  });

  const businessNameValue = watch("businessName");

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
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent mx-auto" />
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

  return (
    <div className="space-y-6 text-[#0F172A]">
      {/* 1. Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white border border-slate-200/80 p-6 rounded-3xl">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Building className="h-5.5 w-5.5 text-blue-600" /> Tenant Registry
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage multi-tenant SaaS business tenants, subscription status, overrides, and credentials.
          </p>
        </div>
      </div>

      {/* 2. Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200/80 p-5 rounded-2xl flex items-center gap-4">
          <div className="h-10 w-10 bg-blue-600/10 text-blue-600 flex items-center justify-center rounded-xl">
            <Building className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Businesses</p>
            <h3 className="text-xl font-black mt-0.5">{totalBusinesses}</h3>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 p-5 rounded-2xl flex items-center gap-4">
          <div className="h-10 w-10 bg-emerald-500/10 text-emerald-500 flex items-center justify-center rounded-xl">
            <CheckCircle className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Active Tenants</p>
            <h3 className="text-xl font-black mt-0.5">{activeSubs}</h3>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 p-5 rounded-2xl flex items-center gap-4">
          <div className="h-10 w-10 bg-amber-500/10 text-amber-500 flex items-center justify-center rounded-xl">
            <Coins className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Free Trials</p>
            <h3 className="text-xl font-black mt-0.5">{trialSubs}</h3>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 p-5 rounded-2xl flex items-center gap-4">
          <div className="h-10 w-10 bg-red-500/10 text-red-500 flex items-center justify-center rounded-xl">
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
        <div className="p-3.5 text-xs bg-red-50 text-red-650 rounded-xl font-bold border border-red-150 flex items-center gap-2">
          <AlertTriangle className="h-4.5 w-4.5 flex-shrink-0" /> {actionError}
        </div>
      )}

      {actionSuccess && (
        <div className="p-3.5 text-xs bg-emerald-50 text-emerald-600 rounded-xl font-bold border border-emerald-150 flex items-center gap-2 animate-pulse">
          <CheckCircle className="h-4.5 w-4.5 flex-shrink-0" /> {actionSuccess}
        </div>
      )}

      {/* 4. Tab selection */}
      <div className="flex border-b border-slate-200 gap-6">
        <button
          onClick={() => { setActiveTab("all"); router.push("/dashboard/super-admin/businesses?tab=all"); }}
          className={`pb-3 text-xs font-bold transition-all border-b-2 uppercase tracking-wider cursor-pointer ${
            activeTab === "all" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-450 hover:text-slate-700"
          }`}
        >
          All Businesses
        </button>
        <button
          onClick={() => { setActiveTab("add"); router.push("/dashboard/super-admin/businesses?tab=add"); }}
          className={`pb-3 text-xs font-bold transition-all border-b-2 uppercase tracking-wider cursor-pointer ${
            activeTab === "add" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-450 hover:text-slate-700"
          }`}
        >
          Add Business
        </button>
        <button
          onClick={() => { setActiveTab("suspended"); router.push("/dashboard/super-admin/businesses?tab=suspended"); }}
          className={`pb-3 text-xs font-bold transition-all border-b-2 uppercase tracking-wider cursor-pointer ${
            activeTab === "suspended" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-450 hover:text-slate-700"
          }`}
        >
          Suspended Businesses ({suspendedSubs})
        </button>
      </div>

      {/* Tab Contents: ALL & SUSPENDED LISTS */}
      {activeTab !== "add" ? (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200/80 p-5 rounded-2xl flex flex-col sm:flex-row justify-between gap-4 items-center">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-2.5 h-4.5 w-4.5 text-slate-450" />
              <input
                type="text"
                placeholder="Search by name, slug, or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 w-full px-4 py-2 border border-slate-200 rounded-lg bg-slate-50 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white transition-all"
              />
            </div>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden p-5">
            {filtered.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-450">No businesses match the selection.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-450 font-bold uppercase tracking-wider text-[9px] pb-3">
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
                        <tr key={b.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-4 px-2">
                            <div className="font-bold text-slate-800 text-sm">{b.name}</div>
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className="flex items-center gap-1 text-[9px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                                <Globe className="w-2.5 h-2.5" /> slug: {b.slug}
                              </span>
                              <span className="text-[9px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded font-bold uppercase">
                                {b.currency}
                              </span>
                            </div>
                          </td>
                          <td className="py-4 px-2">
                            {owner ? (
                              <>
                                <div className="font-bold text-slate-700">{owner.name}</div>
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
                          <td className="py-4 px-2 text-center text-slate-500 text-[10px] font-bold">
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
                              <button
                                onClick={() => setSelectedBusiness(b)}
                                className="p-1.5 hover:bg-slate-100 rounded-lg text-blue-600 border border-slate-100 hover:border-slate-200 cursor-pointer"
                                title="View Details & Credentials"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => openOverrideControls(b)}
                                className="p-1.5 hover:bg-slate-100 rounded-lg text-amber-500 border border-slate-100 hover:border-slate-200 cursor-pointer"
                                title="Configure Feature Overrides"
                              >
                                <Sliders className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteBusiness(b.id)}
                                className="p-1.5 hover:bg-red-50 rounded-lg text-red-500 border border-slate-100 hover:border-red-100 cursor-pointer"
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
        /* Tab Contents: PROVISION FORM */
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 max-w-xl mx-auto shadow-sm">
          <h3 className="text-base font-bold mb-1 flex items-center gap-2">
            <Building className="h-5 w-5 text-blue-600" /> Provision New Tenant Business
          </h3>
          <p className="text-xs text-slate-400 mb-6 border-b border-slate-100 pb-3">
            Setup active subscription variables, workstation currencies, and owner account credentials.
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Business Name</label>
                <input
                  type="text"
                  {...register("businessName")}
                  placeholder="e.g. MedCare Pharmacy"
                  className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-lg text-xs focus:outline-none focus:bg-white focus:ring-1 ${errors.businessName ? 'border-red-300 focus:ring-red-400' : 'border-slate-200 focus:ring-blue-500'}`}
                />
                {errors.businessName && <span className="text-[9px] text-red-500">{errors.businessName.message}</span>}
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Subdomain Slug</label>
                <input
                  type="text"
                  {...register("slug")}
                  placeholder="medcare-pharmacy"
                  className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-lg text-xs focus:outline-none focus:bg-white focus:ring-1 ${errors.slug ? 'border-red-300 focus:ring-red-400' : 'border-slate-200 focus:ring-blue-500'}`}
                />
                {errors.slug && <span className="text-[9px] text-red-500">{errors.slug.message}</span>}
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Default Currency</label>
                <select
                  {...register("currency")}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-500"
                >
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="INR">INR (₹)</option>
                  <option value="NPR">NPR (Rs.)</option>
                  <option value="AUD">AUD (A$)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Owner Name</label>
                <input
                  type="text"
                  {...register("ownerName")}
                  placeholder="Sarah Lin"
                  className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-lg text-xs focus:outline-none focus:bg-white focus:ring-1 ${errors.ownerName ? 'border-red-300 focus:ring-red-400' : 'border-slate-200 focus:ring-blue-500'}`}
                />
                {errors.ownerName && <span className="text-[9px] text-red-500">{errors.ownerName.message}</span>}
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Email Address</label>
                <input
                  type="email"
                  {...register("email")}
                  placeholder="owner@medcare.com"
                  className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-lg text-xs focus:outline-none focus:bg-white focus:ring-1 ${errors.email ? 'border-red-300 focus:ring-red-400' : 'border-slate-200 focus:ring-blue-500'}`}
                />
                {errors.email && <span className="text-[9px] text-red-500">{errors.email.message}</span>}
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Temporary Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-3.5 w-3.5 text-slate-450" />
                  <input
                    type="password"
                    {...register("password")}
                    placeholder="••••••••"
                    className={`w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border rounded-lg text-xs focus:outline-none focus:bg-white focus:ring-1 ${errors.password ? 'border-red-300 focus:ring-red-400' : 'border-slate-200 focus:ring-blue-500'}`}
                  />
                </div>
                {errors.password && <span className="text-[9px] text-red-500">{errors.password.message}</span>}
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Owner Phone</label>
                <input
                  type="text"
                  {...register("phone")}
                  placeholder="+1-555-0133"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Plan Template</label>
                <select
                  {...register("plan")}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-500"
                >
                  <option value="FREE_TRIAL">Starter (Free Trial)</option>
                  <option value="BASIC">Basic License</option>
                  <option value="PREMIUM">Professional License</option>
                  <option value="ENTERPRISE">Enterprise License</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Subscription Months</label>
                <input
                  type="number"
                  {...register("durationMonths", { valueAsNumber: true })}
                  className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-lg text-xs focus:outline-none focus:bg-white focus:ring-1 ${errors.durationMonths ? 'border-red-300 focus:ring-red-400' : 'border-slate-200 focus:ring-blue-500'}`}
                />
                {errors.durationMonths && <span className="text-[9px] text-red-500">{errors.durationMonths.message}</span>}
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-md hover:-translate-y-0.5 transition-all uppercase tracking-wider disabled:opacity-50 disabled:translate-y-0"
            >
              {isSubmitting ? "Provisioning..." : "Provision Tenant"}
            </button>
          </form>
        </div>
      )}

      {/* 5. Business Details Side Drawer / Modal */}
      {selectedBusiness && !isOverrideOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white h-screen shadow-2xl p-6 overflow-y-auto border-l border-slate-100 flex flex-col justify-between animate-slide-in">
            <div className="space-y-6">
              <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-800">{selectedBusiness.name} Details</h3>
                  <span className="text-[10px] text-slate-450 bg-slate-100 px-2 py-0.5 rounded mt-1 inline-block">ID: {selectedBusiness.id}</span>
                </div>
                <button
                  onClick={() => setSelectedBusiness(null)}
                  className="px-2.5 py-1.5 hover:bg-slate-100 text-xs font-semibold text-slate-500 rounded-lg cursor-pointer"
                >
                  Close
                </button>
              </div>

              {/* Stats & Metadata */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Licensing Status</span>
                  <div className="mt-1 flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${selectedBusiness.subscription?.status === "ACTIVE" ? "bg-emerald-500" : "bg-red-500"}`} />
                    <span className="text-xs font-bold text-slate-700">{selectedBusiness.subscription?.plan} ({selectedBusiness.subscription?.status})</span>
                  </div>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Default Currency</span>
                  <p className="text-xs font-bold text-slate-700 mt-1 uppercase">{selectedBusiness.currency}</p>
                </div>
              </div>

              {/* Owner Account Parameters */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-blue-600 uppercase tracking-wider border-b border-slate-150 pb-1">Business Owner Profile</h4>
                {selectedBusiness.users?.[0] ? (
                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="text-slate-400">Full Name:</span> <strong className="text-slate-700">{selectedBusiness.users[0].name}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400">Email Login:</span> <strong className="text-slate-700">{selectedBusiness.users[0].email}</strong>
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
                <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider">Access Controls</h4>
                  
                  {isResetPasswordOpen ? (
                    <div className="space-y-2 pt-2 border-t border-slate-200">
                      <label className="text-[10px] font-bold text-slate-450 uppercase">Set New Temporary Password</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={tempPassword}
                          onChange={(e) => setTempPassword(e.target.value)}
                          placeholder="min. 6 characters"
                          className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none"
                        />
                        <button
                          onClick={() => handleAction(selectedBusiness.id, "RESET_PASSWORD", { newPassword: tempPassword })}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold cursor-pointer"
                        >
                          Apply
                        </button>
                        <button
                          onClick={() => setIsResetPasswordOpen(false)}
                          className="px-2 py-1.5 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-100 cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        onClick={() => { setTempPassword(""); setIsResetPasswordOpen(true); }}
                        className="py-2 text-center text-[10px] font-bold uppercase tracking-wider text-blue-600 hover:bg-blue-50 border border-blue-100 rounded-xl transition-colors cursor-pointer"
                      >
                        Reset Password
                      </button>
                      <button
                        onClick={() => handleAction(selectedBusiness.id, "CREDENTIALS_CONTROL", { disableLogin: selectedBusiness.users?.[0].isActive })}
                        className={`py-2 text-center text-[10px] font-bold uppercase tracking-wider rounded-xl border transition-colors cursor-pointer ${
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
                <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider border-b border-slate-150 pb-1">License Suspensions</h4>
                <div className="flex gap-2">
                  {selectedBusiness.subscription?.status === "SUSPENDED" ? (
                    <button
                      onClick={() => handleAction(selectedBusiness.id, "ACTIVATE")}
                      className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <UserCheck className="w-4 h-4" /> Activate Business
                    </button>
                  ) : (
                    <button
                      onClick={() => handleAction(selectedBusiness.id, "SUSPEND")}
                      className="flex-1 py-2.5 bg-red-500 hover:bg-red-650 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <UserX className="w-4 h-4" /> Suspend Tenant
                    </button>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={() => setSelectedBusiness(null)}
              className="w-full py-2.5 mt-8 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 cursor-pointer"
            >
              Back to Registry List
            </button>
          </div>
        </div>
      )}

      {/* 6. Feature & Limit Custom Overrides Modal */}
      {selectedBusiness && isOverrideOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-2xl p-6 shadow-2xl border border-slate-200 my-8 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-800">Custom System Overrides</h3>
                  <p className="text-[10px] text-slate-450">Assign plan values, modify limits, and activate/deactivate modules for {selectedBusiness.name}.</p>
                </div>
                <button
                  onClick={() => setIsOverrideOpen(false)}
                  className="px-2 py-1.5 hover:bg-slate-100 text-xs font-semibold text-slate-500 rounded-lg cursor-pointer"
                >
                  Close
                </button>
              </div>

              {/* Plans Override Section */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 mb-4 grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-450 uppercase">Update Subscription Plan</label>
                  <select
                    id="override-plan-select"
                    defaultValue={selectedBusiness.subscription?.plan || "BASIC"}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold focus:outline-none"
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
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none"
                  />
                </div>
              </div>

              {/* Limits and Toggles Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-[40vh] overflow-y-auto pr-1">
                {/* Feature Toggles List */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-650 uppercase tracking-wider border-b border-slate-100 pb-1">Features Activation Toggles</h4>
                  <div className="space-y-2">
                    {Object.keys(customFeatures).map((f) => (
                      <label key={f} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg cursor-pointer border border-slate-100">
                        <span className="text-xs font-bold text-slate-600">{f}</span>
                        <input
                          type="checkbox"
                          checked={customFeatures[f]}
                          onChange={(e) => setCustomFeatures({ ...customFeatures, [f]: e.target.checked })}
                          className="h-4.5 w-4.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                        />
                      </label>
                    ))}
                  </div>
                </div>

                {/* Plan Limits Config */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-650 uppercase tracking-wider border-b border-slate-100 pb-1">SaaS Workspace Limits</h4>
                  <div className="space-y-3 text-xs font-semibold">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-450 uppercase">Active Users Limit</label>
                      <input
                        type="number"
                        value={customLimits.users || 5}
                        onChange={(e) => setCustomLimits({ ...customLimits, users: Number(e.target.value) })}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-slate-50 focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-450 uppercase">Store Branches Limit</label>
                      <input
                        type="number"
                        value={customLimits.branches || 1}
                        onChange={(e) => setCustomLimits({ ...customLimits, branches: Number(e.target.value) })}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-slate-50 focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-450 uppercase">Warehouses Limit</label>
                      <input
                        type="number"
                        value={customLimits.warehouses || 2}
                        onChange={(e) => setCustomLimits({ ...customLimits, warehouses: Number(e.target.value) })}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-slate-50 focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-450 uppercase">Max Products Catalog Size</label>
                      <input
                        type="number"
                        value={customLimits.products || 10000}
                        onChange={(e) => setCustomLimits({ ...customLimits, products: Number(e.target.value) })}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-slate-50 focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-450 uppercase">Monthly Transactions limit</label>
                      <input
                        type="number"
                        value={customLimits.transactions || 2000}
                        onChange={(e) => setCustomLimits({ ...customLimits, transactions: Number(e.target.value) })}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-slate-50 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t border-slate-100 mt-4">
              <button
                onClick={() => setIsOverrideOpen(false)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold hover:bg-slate-50 cursor-pointer"
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
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold shadow-md cursor-pointer"
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
