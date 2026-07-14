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
  User,
  FileText,
  Upload,
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
  panDocument: z.string().optional().nullable(),
  ppPhoto: z.string().optional().nullable(),
});

type BusinessFormInputs = z.infer<typeof businessSchema>;

export default function SuperAdminBusinessesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");

  const [activeTab, setActiveTab] = useState<"all" | "add" | "suspended">("all");
  const [currentStep, setCurrentStep] = useState(1);
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

  const { register, handleSubmit, reset, watch, setValue, trigger, formState: { errors, isSubmitting } } = useForm<BusinessFormInputs>({
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
  const slugValue = watch("slug");
  const planValue = watch("plan");
  const durationMonthsValue = watch("durationMonths");
  const currencyValue = watch("currency");
  const ownerNameValue = watch("ownerName");
  const emailValue = watch("email");
  const phoneValue = watch("phone");
  const panDocumentValue = watch("panDocument");
  const ppPhotoValue = watch("ppPhoto");

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, targetField: "panDocument" | "ppPhoto") => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setValue(targetField, reader.result as string, { shouldValidate: true });
    };
    reader.readAsDataURL(file);
  };

  // Multi-step helpers
  const handleNextStep = async () => {
    let fieldsToValidate: Array<keyof BusinessFormInputs> = [];
    if (currentStep === 1) {
      fieldsToValidate = ["businessName", "slug", "businessType", "currency"];
    } else if (currentStep === 2) {
      fieldsToValidate = ["plan", "durationMonths"];
    } else if (currentStep === 3) {
      fieldsToValidate = ["ownerName", "email", "password", "phone"];
    }

    const isValid = await trigger(fieldsToValidate);
    if (isValid) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handlePrevStep = () => {
    setCurrentStep((prev) => Math.max(1, prev - 1));
  };

  const handleDone = () => {
    reset();
    setCurrentStep(1);
    setActiveTab("all");
    router.push("/dashboard/super-admin/businesses?tab=all");
    fetchBusinesses();
  };

  // Sync tab with URL search parameter
  useEffect(() => {
    if (tabParam === "add") {
      setActiveTab("add");
      setCurrentStep(1);
    } else if (tabParam === "suspended") {
      setActiveTab("suspended");
    } else {
      setActiveTab("all");
    }
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
      setCurrentStep(5);
      fetchBusinesses();
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
        /* Tab Contents: PROVISION MULTI-STEP PROGRESS STEPPER WIZARD & PREVIEW SIDEBAR */
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Form Stepper Progress */}
          <div className="lg:col-span-7 bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm">
            {/* Progress Timeline Bar */}
            <div className="mb-8 border-b border-slate-100 pb-6 print:hidden">
              <div className="flex items-center justify-between max-w-xl mx-auto">
                {[
                  { num: 1, label: "Basic Info" },
                  { num: 2, label: "Plan & Terms" },
                  { num: 3, label: "Billing & Files" },
                  { num: 4, label: "Review" },
                  { num: 5, label: "Completion" },
                ].map((step, idx, arr) => (
                  <React.Fragment key={step.num}>
                    {/* Step Node */}
                    <div className="flex flex-col items-center flex-1 relative">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center border-2 text-xs font-black transition-all duration-300 ${
                          currentStep > step.num
                            ? "bg-emerald-500 border-emerald-500 text-white"
                            : currentStep === step.num
                            ? "bg-[#064E3B] border-[#064E3B] text-white ring-4 ring-[#064E3B]/10 scale-105"
                            : "bg-white border-slate-200 text-slate-400"
                        }`}
                      >
                        {currentStep > step.num ? (
                          <Check className="h-4.5 w-4.5 stroke-[3]" />
                        ) : (
                          <span>{step.num}</span>
                        )}
                      </div>
                      <span
                        className={`text-[9px] font-extrabold uppercase tracking-wider mt-2.5 transition-all text-center max-w-[100px] ${
                          currentStep === step.num
                            ? "text-[#064E3B]"
                            : currentStep > step.num
                            ? "text-emerald-600"
                            : "text-slate-400"
                        }`}
                      >
                        {step.label}
                      </span>
                    </div>

                    {/* Connecting Line */}
                    {idx < arr.length - 1 && (
                      <div className="flex-1 h-[2px] bg-slate-200 relative -top-3">
                        <div
                          className="absolute left-0 top-0 h-full bg-emerald-500 transition-all duration-300"
                          style={{ width: currentStep > step.num ? "100%" : "0%" }}
                        />
                      </div>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* Form Step Panels */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* STEP 1: Basic Information */}
              {currentStep === 1 && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-3 duration-200">
                  <div className="border-b border-slate-100 pb-3">
                    <h3 className="text-sm font-bold text-slate-800">Basic Information</h3>
                    <p className="text-[11px] text-slate-455 mt-0.5">Setup the workspace name, URL domain, and business operational category.</p>
                  </div>

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

                    <div className="space-y-2 col-span-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Business Type</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {[
                          { id: "RETAIL", label: "Retail / Supermarket", desc: "For grocery, boutiques, general stores" },
                          { id: "PHARMACY", label: "Pharmacy Medical", desc: "Batch & expiry tracking, medicine layouts" },
                          { id: "RESTAURANT", label: "Restaurant & Cafe", desc: "Waiters, table management, dining types" },
                          { id: "WHOLESALE", label: "Wholesale Trade", desc: "Bulk prices, customer credit limit logs" },
                        ].map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setValue("businessType", item.id as any, { shouldValidate: true })}
                            className={`flex flex-col text-left p-3.5 border rounded-2xl transition-all cursor-pointer ${
                              businessTypeValue === item.id
                                ? "border-blue-600 bg-blue-50/40 ring-1 ring-blue-500"
                                : "border-slate-200 bg-slate-50 hover:bg-slate-100/50"
                            }`}
                          >
                            <span className="text-xs font-bold text-slate-800">{item.label}</span>
                            <span className="text-[10px] text-slate-450 mt-1 font-medium">{item.desc}</span>
                          </button>
                        ))}
                      </div>
                      {errors.businessType && <span className="text-[9px] text-red-500 block mt-1">{errors.businessType.message}</span>}
                    </div>

                    <div className="space-y-1 col-span-2 sm:col-span-1">
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
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex justify-end">
                    <button
                      type="button"
                      onClick={handleNextStep}
                      className="px-6 py-2.5 bg-[#064E3B] hover:bg-[#053F30] text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer uppercase tracking-wider"
                    >
                      Next Step
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 2: Plan, Limits & Modules */}
              {currentStep === 2 && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-3 duration-200">
                  <div className="border-b border-slate-100 pb-3">
                    <h3 className="text-sm font-bold text-slate-800">Plan, Limits & Modules</h3>
                    <p className="text-[11px] text-slate-455 mt-0.5">Select a subscription licensing template and define the contract term duration.</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

                  <div className="pt-4 border-t border-slate-100 flex justify-between gap-3">
                    <button
                      type="button"
                      onClick={handlePrevStep}
                      className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer uppercase tracking-wider text-slate-600"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={handleNextStep}
                      className="px-6 py-2.5 bg-[#064E3B] hover:bg-[#053F30] text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer uppercase tracking-wider"
                    >
                      Next Step
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: Billing & Contacts (PP Photo & PAN Document included) */}
              {currentStep === 3 && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-3 duration-200">
                  <div className="border-b border-slate-100 pb-3">
                    <h3 className="text-sm font-bold text-slate-800">Billing & Contacts</h3>
                    <p className="text-[11px] text-slate-455 mt-0.5">Setup administrative details, credentials, and business registering files.</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

                    {/* PP Photo Upload */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Owner Profile Photo (PP)</label>
                      <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 p-3 rounded-lg">
                        {ppPhotoValue ? (
                          <div className="relative">
                            <img src={ppPhotoValue} className="w-12 h-12 rounded-lg object-cover border border-slate-250" />
                            <button
                              type="button"
                              onClick={() => setValue("ppPhoto", null, { shouldValidate: true })}
                              className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-650 transition-all cursor-pointer"
                            >
                              <Trash className="h-3 w-3" />
                            </button>
                          </div>
                        ) : (
                          <div className="w-12 h-12 bg-slate-100 border border-dashed border-slate-350 rounded-lg flex items-center justify-center text-slate-400">
                            <User className="h-6 w-6" />
                          </div>
                        )}
                        <div className="flex-1">
                          <label className="inline-block px-3 py-1.5 bg-[#064E3B] hover:bg-[#053F30] text-white rounded-lg text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-all">
                            Select Photo
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleFileUpload(e, "ppPhoto")}
                              className="hidden"
                            />
                          </label>
                          <p className="text-[9px] text-slate-400 mt-1">PNG, JPG up to 2MB</p>
                        </div>
                      </div>
                    </div>

                    {/* Business Registration / PAN Document Upload */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">PAN / Registration Document</label>
                      <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 p-3 rounded-lg">
                        {panDocumentValue ? (
                          <div className="relative flex items-center gap-2 bg-emerald-50 border border-emerald-100 p-2 rounded-lg w-full">
                            <FileText className="h-6 w-6 text-emerald-600 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] font-bold text-emerald-700 truncate">PAN_Document.pdf</p>
                              <p className="text-[8px] text-emerald-600">Document Uploaded</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setValue("panDocument", null, { shouldValidate: true })}
                              className="bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-all cursor-pointer"
                            >
                              <Trash className="h-3 w-3" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="w-12 h-12 bg-slate-100 border border-dashed border-slate-355 rounded-lg flex items-center justify-center text-slate-400">
                              <Upload className="h-5 w-5" />
                            </div>
                            <div className="flex-1">
                              <label className="inline-block px-3 py-1.5 bg-[#064E3B] hover:bg-[#053F30] text-white rounded-lg text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-all">
                                Upload File
                                <input
                                  type="file"
                                  accept=".pdf,image/*"
                                  onChange={(e) => handleFileUpload(e, "panDocument")}
                                  className="hidden"
                                />
                              </label>
                              <p className="text-[9px] text-slate-400 mt-1">PDF or image up to 5MB</p>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex justify-between gap-3">
                    <button
                      type="button"
                      onClick={handlePrevStep}
                      className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer uppercase tracking-wider text-slate-600"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={handleNextStep}
                      className="px-6 py-2.5 bg-[#064E3B] hover:bg-[#053F30] text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer uppercase tracking-wider"
                    >
                      Next Step
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 4: Review & Confirm */}
              {currentStep === 4 && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-3 duration-200">
                  <div className="border-b border-slate-100 pb-3">
                    <h3 className="text-sm font-bold text-slate-800">Review & Confirm</h3>
                    <p className="text-[11px] text-slate-455 mt-0.5">Please review the provision inputs below before building the tenant workspace.</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-slate-50 border border-slate-200/50 rounded-2xl p-4 text-xs">
                      <h4 className="font-extrabold uppercase text-[9px] text-[#064E3B] tracking-wider mb-2 border-b border-slate-200/60 pb-1">Workspace Core</h4>
                      <div className="space-y-1.5 font-semibold text-slate-600">
                        <div>Name: <span className="font-bold text-slate-800">{businessNameValue}</span></div>
                        <div>Slug: <span className="font-bold text-slate-800">slug: {slugValue}</span></div>
                        <div>Type: <span className="font-bold text-[#064E3B]">{businessTypeValue}</span></div>
                        <div>Currency: <span className="font-bold text-slate-800 uppercase">{currencyValue}</span></div>
                      </div>
                    </div>

                    <div className="bg-slate-50 border border-slate-200/50 rounded-2xl p-4 text-xs">
                      <h4 className="font-extrabold uppercase text-[9px] text-[#064E3B] tracking-wider mb-2 border-b border-slate-200/60 pb-1">Contract Parameters</h4>
                      <div className="space-y-1.5 font-semibold text-slate-600">
                        <div>Licensing Tier: <span className="font-bold text-slate-800 uppercase">{planValue === "FREE_TRIAL" ? "Starter (Free)" : planValue}</span></div>
                        <div>Validity: <span className="font-bold text-slate-800">{durationMonthsValue} Months</span></div>
                      </div>
                    </div>

                    <div className="bg-slate-50 border border-slate-200/50 rounded-2xl p-4 text-xs col-span-2">
                      <h4 className="font-extrabold uppercase text-[9px] text-[#064E3B] tracking-wider mb-2 border-b border-slate-200/60 pb-1">Owner Contact Details</h4>
                      <div className="grid grid-cols-2 gap-2 font-semibold text-slate-600">
                        <div>Name: <span className="font-bold text-slate-800">{ownerNameValue}</span></div>
                        <div>Email: <span className="font-bold text-slate-800">{emailValue}</span></div>
                        <div>Phone: <span className="font-bold text-slate-800">{phoneValue || "Not Provided"}</span></div>
                        <div className="col-span-2 mt-2 pt-2 border-t border-slate-200/60 grid grid-cols-2 gap-2">
                          <div>PP Photo: <span className={`font-bold ${ppPhotoValue ? 'text-emerald-600' : 'text-slate-400'}`}>{ppPhotoValue ? '✓ Uploaded' : 'Not Uploaded'}</span></div>
                          <div>PAN Document: <span className={`font-bold ${panDocumentValue ? 'text-emerald-600' : 'text-slate-400'}`}>{panDocumentValue ? '✓ Uploaded' : 'Not Uploaded'}</span></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {actionError && (
                    <div className="bg-red-50 border border-red-200 text-red-600 p-4.5 rounded-2xl text-xs font-semibold">
                      {actionError}
                    </div>
                  )}

                  <div className="pt-4 border-t border-slate-100 flex justify-between gap-3">
                    <button
                      type="button"
                      onClick={handlePrevStep}
                      className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer uppercase tracking-wider text-slate-600"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer uppercase tracking-wider disabled:opacity-50"
                    >
                      {isSubmitting ? "Provisioning..." : "Confirm & Provision"}
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 5: Completion */}
              {currentStep === 5 && (
                <div className="text-center py-10 space-y-5 animate-in fade-in zoom-in-95 duration-350">
                  <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-950/20 rounded-full flex items-center justify-center mx-auto text-emerald-600 dark:text-emerald-400 shadow-xs border border-emerald-100">
                    <CheckCircle className="w-10 h-10 stroke-[2]" />
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="text-lg font-black text-slate-800">Workspace Initialized!</h3>
                    <p className="text-xs text-slate-450 max-w-sm mx-auto leading-relaxed">
                      Tenant organization <span className="font-bold text-slate-800">"{businessNameValue}"</span> has been successfully provisioned. The owner credentials have been generated and limits deployed.
                    </p>
                  </div>
                  <div className="pt-4 flex justify-center">
                    <button
                      type="button"
                      onClick={handleDone}
                      className="px-6 py-2.5 bg-[#064E3B] hover:bg-[#053F30] text-white rounded-xl text-xs font-bold transition-all cursor-pointer uppercase tracking-wider shadow-sm"
                    >
                      Go to Business List
                    </button>
                  </div>
                </div>
              )}
            </form>
          </div>

          {/* Right Column: Information Preview Widgets (matching screenshot layout) */}
          <div className="lg:col-span-5 space-y-6">
            {/* Widget 1: Institution Preview */}
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs relative">
              <div className="flex justify-between items-start mb-4">
                <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider">Institution Preview</h4>
                <span className="bg-[#E8F5E9] text-[#2E7D32] text-[8px] font-black tracking-widest uppercase px-2 py-0.5 rounded-full">
                  Live preview
                </span>
              </div>

              <div className="flex flex-col items-center py-4 border-b border-slate-100">
                {ppPhotoValue ? (
                  <img
                    src={ppPhotoValue}
                    className="w-16 h-16 rounded-2xl object-cover border border-slate-200"
                    alt="Institution Logo Preview"
                  />
                ) : (
                  <div className="w-16 h-16 bg-[#E8F5E9] rounded-2xl flex items-center justify-center text-[#2E7D32] border border-[#C8E6C9]">
                    <Building className="h-8 w-8 stroke-[1.8]" />
                  </div>
                )}
                <h3 className="text-sm font-black text-slate-850 mt-3 truncate max-w-full">
                  {businessNameValue || "Institution Name"}
                </h3>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-[10px] text-slate-450 font-bold capitalize">
                    {businessTypeValue?.toLowerCase() || "School"}
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                  <span className="text-[9px] font-black uppercase tracking-wider text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                    {planValue === "FREE_TRIAL" ? "Draft" : planValue || "Draft"}
                  </span>
                </div>
              </div>

              {/* Metadata rows */}
              <div className="mt-4 space-y-2.5 text-xs text-slate-650">
                <div className="flex justify-between items-center border-b border-slate-50 pb-2">
                  <div className="flex items-center gap-2 text-slate-400 font-bold uppercase text-[9px] tracking-wider">
                    <User className="h-3.5 w-3.5 text-slate-400" />
                    <span>Owner</span>
                  </div>
                  <span className="font-bold text-slate-800 truncate max-w-[180px]">
                    {ownerNameValue || "—"}
                  </span>
                </div>

                <div className="flex justify-between items-center border-b border-slate-50 pb-2">
                  <div className="flex items-center gap-2 text-slate-400 font-bold uppercase text-[9px] tracking-wider">
                    <Mail className="h-3.5 w-3.5 text-slate-400" />
                    <span>Email</span>
                  </div>
                  <span className="font-bold text-slate-800 truncate max-w-[180px]">
                    {emailValue || "—"}
                  </span>
                </div>

                <div className="flex justify-between items-center border-b border-slate-50 pb-2">
                  <div className="flex items-center gap-2 text-slate-400 font-bold uppercase text-[9px] tracking-wider">
                    <Phone className="h-3.5 w-3.5 text-slate-400" />
                    <span>Phone</span>
                  </div>
                  <span className="font-bold text-slate-800 truncate max-w-[180px]">
                    {phoneValue || "—"}
                  </span>
                </div>

                <div className="flex justify-between items-center pb-1">
                  <div className="flex items-center gap-2 text-slate-400 font-bold uppercase text-[9px] tracking-wider">
                    <Globe className="h-3.5 w-3.5 text-slate-400" />
                    <span>Region / Currency</span>
                  </div>
                  <span className="font-bold text-slate-800 uppercase">
                    {currencyValue || "—"}
                  </span>
                </div>
              </div>
            </div>

            {/* Widget 2: Workflow Steps Panel */}
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs">
              <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider mb-4">Workflow</h4>
              <div className="space-y-3.5">
                {[
                  { num: 1, label: "Create institution draft" },
                  { num: 2, label: "Enter core information" },
                  { num: 3, label: "Validate code and contact details" },
                  { num: 4, label: "Save draft" },
                  { num: 5, label: "Proceed to verification" },
                ].map((step) => {
                  const isCompleted = currentStep > step.num;
                  const isActive = currentStep === step.num;

                  return (
                    <div key={step.num} className="flex items-center gap-3">
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black border ${
                          isCompleted
                            ? "bg-emerald-100 border-emerald-200 text-emerald-700"
                            : isActive
                            ? "bg-[#064E3B] border-[#064E3B] text-white"
                            : "bg-slate-50 border-slate-200 text-slate-400"
                        }`}
                      >
                        {step.num}
                      </div>
                      <span
                        className={`text-xs font-semibold ${
                          isActive
                            ? "text-[#064E3B] font-bold"
                            : isCompleted
                            ? "text-emerald-700"
                            : "text-slate-400"
                        }`}
                      >
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Widget 3: Database Spec Data Model Mapping */}
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs">
              <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider mb-4">Database & Data Model</h4>
              
              <div className="space-y-4 text-xs">
                <div>
                  <h5 className="font-extrabold uppercase text-[9px] text-slate-450 tracking-wider mb-1.5">Primary Tables</h5>
                  <ul className="space-y-1 text-slate-650 font-semibold list-disc list-inside">
                    <li>businesses</li>
                    <li>subscriptions</li>
                  </ul>
                </div>

                <div>
                  <h5 className="font-extrabold uppercase text-[9px] text-slate-450 tracking-wider mb-2">Key Fields (Businesses)</h5>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      "business_name",
                      "slug",
                      "business_type",
                      "owner_name",
                      "official_email",
                      "official_phone",
                      "address",
                      "currency",
                      "pan_document",
                      "pp_photo",
                      "created_at",
                      "updated_at",
                    ].map((key) => (
                      <span
                        key={key}
                        className="bg-emerald-50 border border-emerald-100 text-[#2E7D32] text-[9px] font-bold px-2 py-0.5 rounded"
                      >
                        {key}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
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
