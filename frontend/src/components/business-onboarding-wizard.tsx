"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Building,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  Layers,
  Store,
  Users,
  CreditCard,
  Sparkles,
  Globe,
  Coins,
  Lock,
  Mail,
  Phone,
  MapPin,
  Check,
  FileText,
  Package,
  Calendar,
  AlertCircle,
  Eye,
  EyeOff,
  ShoppingBag,
} from "lucide-react";

export interface OnboardingWizardProps {
  mode?: "PUBLIC_USER" | "SUPER_ADMIN";
  onSuccess?: () => void;
}

export default function BusinessOnboardingWizard({
  mode = "PUBLIC_USER",
  onSuccess,
}: OnboardingWizardProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState<boolean>(false);

  // Form State
  const [formData, setFormData] = useState({
    // Step 1: Business Info
    businessName: "",
    slug: "",
    businessType: "RETAIL",
    currency: "USD",
    taxNumber: "",
    phone: "",
    email: "",
    address: "",

    // Step 2: Plan & Modules
    plan: "STARTER",
    billingCycle: "MONTHLY",
    durationMonths: 12,
    selectedModules: {
      posBilling: true,
      inventory: true,
      batchExpiry: false,
      purchases: true,
      customers: true,
      suppliers: true,
      expenses: true,
      reports: true,
      multiBranch: false,
      warehouses: false,
      apiAccess: false,
      deviceControl: true,
    } as Record<string, boolean>,

    customLimits: {
      users: 3,
      branches: 1,
      warehouses: 1,
      products: 5000,
    },

    // Step 3: Owner Account
    ownerName: "",
    ownerEmail: "",
    ownerPhone: "",
    password: "",
  });

  // Auto-generate slug from business name
  useEffect(() => {
    if (formData.businessName && !formData.slug) {
      const generatedSlug = formData.businessName
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-");
      setFormData((prev) => ({ ...prev, slug: generatedSlug }));
    }
  }, [formData.businessName]);

  // Keep owner email synced with business email if empty
  const handleEmailChange = (val: string) => {
    setFormData((prev) => ({
      ...prev,
      email: val,
      ownerEmail: prev.ownerEmail || val,
    }));
  };

  const handleModuleToggle = (moduleKey: string) => {
    setFormData((prev) => ({
      ...prev,
      selectedModules: {
        ...prev.selectedModules,
        [moduleKey]: !prev.selectedModules[moduleKey],
      },
    }));
  };

  const handlePlanSelect = (planKey: string) => {
    let limits = { users: 3, branches: 1, warehouses: 1, products: 5000 };
    if (planKey === "PROFESSIONAL") {
      limits = { users: 5, branches: 2, warehouses: 2, products: 20000 };
    } else if (planKey === "ENTERPRISE") {
      limits = { users: 20, branches: 5, warehouses: 5, products: 100000 };
    } else if (planKey === "CUSTOM") {
      limits = { users: 10, branches: 3, warehouses: 3, products: 50000 };
    }

    setFormData((prev) => ({
      ...prev,
      plan: planKey,
      customLimits: limits,
      selectedModules: {
        ...prev.selectedModules,
        multiBranch: planKey !== "STARTER",
        warehouses: planKey !== "STARTER",
        apiAccess: planKey === "ENTERPRISE" || planKey === "CUSTOM",
      },
    }));
  };

  const validateStep = (step: number): boolean => {
    setErrorMessage(null);
    if (step === 1) {
      if (!formData.businessName.trim() || formData.businessName.length < 2) {
        setErrorMessage("Please enter a valid business name (at least 2 characters).");
        return false;
      }
      if (!formData.slug.trim() || formData.slug.length < 3 || !/^[a-z0-9-]+$/.test(formData.slug)) {
        setErrorMessage("Please enter a valid URL slug (lowercase letters, numbers, hyphens only).");
        return false;
      }
      if (!formData.email.trim() || !/\S+@\S+\.\S+/.test(formData.email)) {
        setErrorMessage("Please enter a valid business contact email.");
        return false;
      }
    } else if (step === 3) {
      if (!formData.ownerName.trim() || formData.ownerName.length < 2) {
        setErrorMessage("Please enter the administrator's full name.");
        return false;
      }
      if (!formData.ownerEmail.trim() || !/\S+@\S+\.\S+/.test(formData.ownerEmail)) {
        setErrorMessage("Please enter a valid administrator email address.");
        return false;
      }
      if (!formData.password || formData.password.length < 6) {
        setErrorMessage("Password must be at least 6 characters long.");
        return false;
      }
    }
    return true;
  };

  const handleNextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, 4));
    }
  };

  const handlePrevStep = () => {
    setErrorMessage(null);
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep(3)) return;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      if (mode === "PUBLIC_USER") {
        // Submit self-service registration request
        const res = await fetch("/api/v1/auth/register-request", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });

        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error || "Failed to submit registration request.");
        }

        // Redirect to Waiting for Approval page with request ID & tracking code
        router.push(`/auth/register/status?id=${json.request.id}&code=${json.request.trackingCode}`);
      } else {
        // Super Admin direct provisioning
        const res = await fetch("/api/v1/super-admin/businesses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });

        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error || "Failed to provision business tenant.");
        }

        if (onSuccess) {
          onSuccess();
        } else {
          router.push("/dashboard/super-admin/businesses?tab=all");
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || "An error occurred during submission.");
    } finally {
      setIsLoading(false);
    }
  };

  const activeModulesCount = Object.values(formData.selectedModules).filter(Boolean).length;

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {/* HEADER BAR */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-xl bg-blue-600/10 flex items-center justify-center text-blue-600">
                <ShoppingBag className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl font-black text-slate-900 tracking-tight">
                  {mode === "SUPER_ADMIN" ? "Provision New SaaS Tenant" : "Create your DynaPOS Workspace"}
                </h1>
                <p className="text-xs text-slate-500 font-medium">
                  {mode === "SUPER_ADMIN"
                    ? "Direct multi-step provisioning wizard with plan customization & module overrides."
                    : "Complete the multi-step onboarding to submit your business workspace for approval."}
                </p>
              </div>
            </div>
          </div>

          {mode === "PUBLIC_USER" && (
            <div className="text-xs text-slate-500 font-medium">
              Already registered?{" "}
              <Link href="/auth/login" className="text-blue-600 font-bold hover:underline">
                Sign In
              </Link>
            </div>
          )}
        </div>

        {/* STEP PROGRESS INDICATOR BAR */}
        <div className="mt-8 pt-6 border-t border-slate-100">
          <div className="grid grid-cols-4 gap-2 md:gap-4 relative">
            {[
              { num: 1, title: "Business Info", desc: "Identity & Type" },
              { num: 2, title: "Plan & Modules", desc: "SaaS Features" },
              { num: 3, title: "Owner Account", desc: "Admin Credentials" },
              { num: 4, title: "Review & Finalize", desc: "Confirmation" },
            ].map((step) => {
              const isCompleted = currentStep > step.num;
              const isActive = currentStep === step.num;

              return (
                <div
                  key={step.num}
                  onClick={() => {
                    if (step.num < currentStep) setCurrentStep(step.num);
                  }}
                  className={`flex flex-col md:flex-row items-center md:items-start gap-2 p-2.5 rounded-2xl transition-all cursor-pointer ${
                    isActive
                      ? "bg-blue-50/70 border border-blue-200"
                      : isCompleted
                      ? "bg-slate-50 hover:bg-slate-100/70"
                      : "opacity-60 pointer-events-none"
                  }`}
                >
                  <div
                    className={`h-7 w-7 rounded-xl flex items-center justify-center text-xs font-bold transition-all flex-shrink-0 ${
                      isCompleted
                        ? "bg-emerald-500 text-white"
                        : isActive
                        ? "bg-blue-600 text-white shadow-md shadow-blue-500/25"
                        : "bg-slate-200 text-slate-500"
                    }`}
                  >
                    {isCompleted ? <Check className="h-4 w-4" /> : step.num}
                  </div>

                  <div className="text-center md:text-left hidden sm:block">
                    <p
                      className={`text-xs font-bold leading-tight ${
                        isActive ? "text-blue-700" : isCompleted ? "text-slate-800" : "text-slate-500"
                      }`}
                    >
                      {step.title}
                    </p>
                    <p className="text-[10px] text-slate-400 font-medium">{step.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ERROR ALERT */}
      {errorMessage && (
        <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-2xl text-xs font-semibold flex items-center gap-3 animate-shake">
          <AlertCircle className="h-4.5 w-4.5 flex-shrink-0 text-red-500" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* MAIN CONTENT 2-COLUMN GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* LEFT / CENTER FORM COLUMN (2 COLS) */}
        <div className="lg:col-span-2 bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-sm">
          {/* STEP 1: BUSINESS INFORMATION */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="border-b border-slate-100 pb-4">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Building className="h-5 w-5 text-blue-600" /> Step 1: Business Identity & Details
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Specify your company name, industry type, base workspace URL, and contact details.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Business / Store Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.businessName}
                    onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                    placeholder="e.g. Apex Hypermarket Ltd."
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Workspace Subdomain Slug <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.slug}
                      onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })}
                      placeholder="apex-hypermarket"
                      className="w-full pl-3 pr-16 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-medium focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all"
                    />
                    <span className="absolute right-3 top-3 text-[9px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                      .dynapos.com
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Base Currency <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all"
                  >
                    <option value="USD">USD ($) - US Dollar</option>
                    <option value="EUR">EUR (€) - Euro</option>
                    <option value="GBP">GBP (£) - British Pound</option>
                    <option value="INR">INR (₹) - Indian Rupee</option>
                    <option value="NPR">NPR (Rs.) - Nepalese Rupee</option>
                    <option value="AUD">AUD ($) - Australian Dollar</option>
                  </select>
                </div>

                {/* BUSINESS TYPE SELECTION CARDS */}
                <div className="space-y-2 sm:col-span-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Business Industry Type
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { id: "RETAIL", label: "Retail & Supermarket", desc: "Grocery, fashion, electronics, retail POS" },
                      { id: "PHARMACY", label: "Pharmacy & Healthcare", desc: "Medicine batches, expiry dates, drug search" },
                      { id: "RESTAURANT", label: "Restaurant & Cafe", desc: "Table billing, kitchen orders, waiter app" },
                      { id: "WHOLESALE", label: "Wholesale & Trading", desc: "Bulk pricing, customer credit, ledger logs" },
                    ].map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setFormData({ ...formData, businessType: item.id })}
                        className={`flex flex-col text-left p-3.5 border rounded-2xl transition-all cursor-pointer ${
                          formData.businessType === item.id
                            ? "border-blue-600 bg-blue-50/50 ring-2 ring-blue-500/20"
                            : "border-slate-200 bg-slate-50/50 hover:bg-slate-100/70"
                        }`}
                      >
                        <span className="text-xs font-bold text-slate-900">{item.label}</span>
                        <span className="text-[10px] text-slate-500 mt-1 font-medium">{item.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Tax Registration No. (PAN/VAT/GST)
                  </label>
                  <input
                    type="text"
                    value={formData.taxNumber}
                    onChange={(e) => setFormData({ ...formData, taxNumber: e.target.value })}
                    placeholder="e.g. VAT-984719283"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Contact Phone
                  </label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+1 (555) 019-2831"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all"
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Business Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleEmailChange(e.target.value)}
                    placeholder="contact@apexstore.com"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all"
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Official Business Address
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Suite 400, Financial Center, New York, NY"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: PLAN & MODULES SELECTION */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="border-b border-slate-100 pb-4">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Layers className="h-5 w-5 text-blue-600" /> Step 2: Plan Selection & Module Configuration
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Choose a subscription plan tier and toggle active modules tailored for your POS workflow.
                </p>
              </div>

              {/* PLAN SELECTION CARDS */}
              <div className="space-y-3">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Select Subscription Plan
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { id: "STARTER", title: "Starter Trial", price: "Free (30 Days)", users: "3 Users", branch: "1 Branch", tag: "Popular" },
                    { id: "PROFESSIONAL", title: "Professional", price: "$49 / month", users: "5 Users", branch: "2 Branches", tag: "Recommended" },
                    { id: "ENTERPRISE", title: "Enterprise", price: "$149 / month", users: "20 Users", branch: "5 Branches", tag: "Unlimited" },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handlePlanSelect(p.id)}
                      className={`relative flex flex-col justify-between p-4 border rounded-2xl text-left transition-all cursor-pointer ${
                        formData.plan === p.id
                          ? "border-blue-600 bg-blue-50/60 ring-2 ring-blue-500/20 shadow-sm"
                          : "border-slate-200 bg-slate-50/40 hover:bg-slate-100/60"
                      }`}
                    >
                      <div>
                        <span className="text-[9px] font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full uppercase tracking-wider">
                          {p.tag}
                        </span>
                        <h4 className="font-bold text-slate-900 text-sm mt-2">{p.title}</h4>
                        <p className="text-xs font-black text-blue-700 mt-1">{p.price}</p>
                      </div>
                      <div className="mt-3 pt-3 border-t border-slate-200/60 text-[10px] text-slate-500 space-y-0.5">
                        <p>• {p.users}</p>
                        <p>• {p.branch}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* MODULE TOGGLES GRID */}
              <div className="space-y-3 pt-2">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Enable ERP & POS Modules ({activeModulesCount} Selected)
                  </label>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {[
                    { key: "posBilling", label: "POS Billing Terminal", desc: "Fast receipt printing, barcode scanner, cart sales" },
                    { key: "inventory", label: "Inventory Management", desc: "Real-time stock levels, cost prices, alert limits" },
                    { key: "batchExpiry", label: "Batch & Expiry Tracking", desc: "Essential for medicine, pharmacy & perishable items" },
                    { key: "purchases", label: "Purchases & Inbound Stock", desc: "Supplier purchase orders, goods receipt notes" },
                    { key: "customers", label: "Customer Debt & Credit", desc: "Ledgers, retail balances, payment history" },
                    { key: "suppliers", label: "Supplier Accounts", desc: "Supplier ledgers, payable balances" },
                    { key: "expenses", label: "Expenses & Accounts", desc: "Vouchers, daily operating expense logs" },
                    { key: "reports", label: "Analytics & Reports", desc: "Sales breakdown, gross margins, profit logs" },
                    { key: "multiBranch", label: "Multi-Branch Management", desc: "Centralized control across multiple locations" },
                    { key: "warehouses", label: "Warehouse Management", desc: "Central depot stock transfers & adjustments" },
                  ].map((m) => {
                    const isChecked = !!formData.selectedModules[m.key];
                    return (
                      <div
                        key={m.key}
                        onClick={() => handleModuleToggle(m.key)}
                        className={`flex items-start gap-3 p-3 rounded-2xl border transition-all cursor-pointer ${
                          isChecked
                            ? "bg-blue-50/40 border-blue-200"
                            : "bg-slate-50/50 border-slate-200 hover:bg-slate-100/50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="mt-0.5 h-4 w-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                        />
                        <div>
                          <p className="text-xs font-bold text-slate-800">{m.label}</p>
                          <p className="text-[10px] text-slate-500 leading-tight mt-0.5">{m.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: OWNER ADMINISTRATOR ACCOUNT */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="border-b border-slate-100 pb-4">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-blue-600" /> Step 3: Owner Administrator Account
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Setup the master admin credentials to manage your business workspace.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.ownerName}
                    onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                    placeholder="Alex Owner"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Administrator Email (Sign In Username) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={formData.ownerEmail}
                    onChange={(e) => setFormData({ ...formData, ownerEmail: e.target.value })}
                    placeholder="owner@company.com"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Administrator Direct Phone
                  </label>
                  <input
                    type="text"
                    value={formData.ownerPhone}
                    onChange={(e) => setFormData({ ...formData, ownerPhone: e.target.value })}
                    placeholder="+1 (555) 019-2831"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all"
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="••••••••••••"
                      className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Must be at least 6 characters. This will be used to log into your workspace dashboard.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: REVIEW & FINALIZE */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div className="border-b border-slate-100 pb-4">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-blue-600" /> Step 4: Review Registration Details
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  {mode === "SUPER_ADMIN"
                    ? "Review configured workspace parameters before immediate tenant activation."
                    : "Review your submitted information before submitting for Super Admin approval."}
                </p>
              </div>

              {/* SUMMARY GRID */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/80 p-5 rounded-2xl border border-slate-200/60">
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Business Identity</span>
                  <p className="text-sm font-bold text-slate-900 mt-0.5">{formData.businessName}</p>
                  <p className="text-xs text-blue-600 font-mono mt-0.5">{formData.slug}.dynapos.com</p>
                  <p className="text-[10px] text-slate-500 mt-1">Type: {formData.businessType} | Currency: {formData.currency}</p>
                </div>

                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Subscription & Limits</span>
                  <p className="text-sm font-bold text-emerald-600 mt-0.5">{formData.plan} Plan</p>
                  <p className="text-xs text-slate-600 mt-0.5">{formData.customLimits.users} Users | {formData.customLimits.branches} Branch</p>
                  <p className="text-[10px] text-slate-500 mt-1">{activeModulesCount} ERP Modules Enabled</p>
                </div>

                <div className="sm:col-span-2 pt-3 border-t border-slate-200/60">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Administrator Account</span>
                  <p className="text-xs font-bold text-slate-800 mt-0.5">{formData.ownerName} ({formData.ownerEmail})</p>
                  {formData.ownerPhone && <p className="text-[10px] text-slate-500">Phone: {formData.ownerPhone}</p>}
                </div>
              </div>

              {mode === "PUBLIC_USER" ? (
                <div className="p-4 bg-blue-50/70 border border-blue-100 rounded-2xl text-xs text-blue-800 space-y-1">
                  <p className="font-bold flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-blue-600" /> Multi-Tenant Approval Policy
                  </p>
                  <p className="text-[11px] text-blue-700 leading-relaxed">
                    Upon submission, your request will be reviewed by our platform administration team. You will be provided a real-time status tracker link to follow approval progress.
                  </p>
                </div>
              ) : (
                <div className="p-4 bg-emerald-50/70 border border-emerald-100 rounded-2xl text-xs text-emerald-800 space-y-1">
                  <p className="font-bold flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" /> Super Admin Instant Provisioning
                  </p>
                  <p className="text-[11px] text-emerald-700 leading-relaxed">
                    Submitting this form will immediately instantiate database records, active subscription licenses, main branch structures, and owner access credentials.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* STEP CONTROLS (NAV BUTTONS) */}
          <div className="mt-8 pt-6 border-t border-slate-100 flex justify-between items-center">
            {currentStep > 1 ? (
              <button
                type="button"
                onClick={handlePrevStep}
                disabled={isLoading}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" /> Previous
              </button>
            ) : (
              <div />
            )}

            {currentStep < 4 ? (
              <button
                type="button"
                onClick={handleNextStep}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md shadow-blue-500/20 transition-all cursor-pointer"
              >
                Continue <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isLoading}
                className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-lg shadow-emerald-500/25 transition-all uppercase tracking-wider disabled:opacity-50 cursor-pointer"
              >
                {isLoading
                  ? "Processing..."
                  : mode === "SUPER_ADMIN"
                  ? "Provision Business Tenant"
                  : "Submit Registration Request"}
              </button>
            )}
          </div>
        </div>

        {/* RIGHT SIDEBAR (SUMMARY CARD & INFO PANEL) */}
        <div className="space-y-4">
          {/* LIVE SUMMARY CARD */}
          <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden">
            <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-blue-600/20 rounded-full blur-2xl pointer-events-none" />

            <div className="flex justify-between items-center border-b border-slate-800 pb-4 mb-4">
              <div className="flex items-center gap-2">
                <Store className="h-4.5 w-4.5 text-blue-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Live Preview</span>
              </div>
              <span className="text-[9px] font-bold bg-blue-600/30 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full">
                Step {currentStep} of 4
              </span>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Business Workspace</span>
                <h4 className="font-bold text-white text-base mt-0.5 truncate">
                  {formData.businessName || "Your Store Name"}
                </h4>
                <p className="text-[11px] text-blue-400 font-mono mt-0.5 truncate">
                  {formData.slug || "workspace-slug"}.dynapos.com
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
                <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/50">
                  <span className="text-[9px] text-slate-400 font-bold uppercase block">Selected Plan</span>
                  <span className="text-xs font-bold text-emerald-400 mt-0.5 block">{formData.plan}</span>
                </div>
                <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/50">
                  <span className="text-[9px] text-slate-400 font-bold uppercase block">Currency</span>
                  <span className="text-xs font-bold text-white mt-0.5 block">{formData.currency}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800">
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block mb-2">
                  Active Modules ({activeModulesCount})
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(formData.selectedModules)
                    .filter(([_, active]) => active)
                    .slice(0, 6)
                    .map(([key]) => (
                      <span key={key} className="text-[9px] font-semibold bg-slate-800 text-slate-300 border border-slate-700 px-2 py-0.5 rounded-md">
                        {key.replace(/([A-Z])/g, " $1").trim()}
                      </span>
                    ))}
                  {activeModulesCount > 6 && (
                    <span className="text-[9px] font-semibold text-blue-400">+{activeModulesCount - 6} more</span>
                  )}
                </div>
              </div>

              {formData.ownerName && (
                <div className="pt-2 border-t border-slate-800 text-[11px]">
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Administrator</span>
                  <p className="font-bold text-slate-200 mt-0.5">{formData.ownerName}</p>
                  <p className="text-slate-400 text-[10px]">{formData.ownerEmail}</p>
                </div>
              )}
            </div>
          </div>

          {/* SAAS BENEFITS CARD */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-5 space-y-3">
            <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-blue-600" /> Platform Infrastructure Benefits
            </h4>
            <div className="space-y-2 text-[11px] text-slate-600">
              <div className="flex items-start gap-2">
                <CheckCircle className="h-3.5 w-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
                <span>Isolated tenant database data & audit logging</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="h-3.5 w-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
                <span>Multi-branch real-time stock sync & transfer tools</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="h-3.5 w-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
                <span>Role-based access control & device authorizations</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
