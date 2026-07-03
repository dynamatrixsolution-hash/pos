"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  CreditCard,
  Layers,
  Shield,
  Laptop,
  Receipt,
  Plus,
  Coins,
  CheckCircle,
  AlertTriangle,
  Settings,
  Edit,
  Trash,
} from "lucide-react";

interface PlanItem {
  id: string;
  name: string;
  price: number;
  currency: string;
  duration: string;
  desc: string;
  features?: Record<string, boolean>;
}

interface CurrencyItem {
  code: string;
  name: string;
  symbol: string;
  allowed: boolean;
}

export default function SubscriptionManagementPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<"plans" | "toggles" | "limits" | "currency">("plans");
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [features, setFeatures] = useState<Record<string, boolean>>({});
  const [limits, setLimits] = useState<Record<string, Record<string, number>>>({});
  const [currencies, setCurrencies] = useState<CurrencyItem[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errMsg, setErrMsg] = useState("");

  // Plan Edit states
  const [editingPlan, setEditingPlan] = useState<PlanItem | null>(null);
  const [isPlanFormOpen, setIsPlanFormOpen] = useState(false);
  const [planName, setPlanName] = useState("");
  const [planPrice, setPlanPrice] = useState(0);
  const [planCurrency, setPlanCurrency] = useState("USD");
  const [planDuration, setPlanDuration] = useState("1 Month");
  const [planDesc, setPlanDesc] = useState("");
  const [planFeatures, setPlanFeatures] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login");
    } else if (session?.user && (session.user as any).role !== "SUPER_ADMIN") {
      router.push("/dashboard");
    } else if (status === "authenticated") {
      loadConfigs();
    }
  }, [status, session, router]);

  const loadConfigs = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/super-admin/subscriptions");
      if (res.ok) {
        const data = await res.json();
        setPlans(data.plans || []);
        setFeatures(data.features || {});
        setLimits(data.limits || {});
        setCurrencies(data.currencies || []);
      }
    } catch (err) {
      console.error("Load subscriptions config error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfigs = async (updatedData: any) => {
    setSaving(true);
    setErrMsg("");
    setSuccessMsg("");
    try {
      const res = await fetch("/api/v1/super-admin/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedData),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update configurations");
      }

      setSuccessMsg("Platform subscription settings saved successfully");
      loadConfigs();
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err: any) {
      setErrMsg(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSavePlan = () => {
    let updatedPlans = [...plans];
    if (editingPlan) {
      // Edit mode
      updatedPlans = plans.map(p => p.id === editingPlan.id ? {
        ...p,
        name: planName,
        price: Number(planPrice),
        currency: planCurrency,
        duration: planDuration,
        desc: planDesc,
        features: planFeatures
      } : p);
    } else {
      // Add mode
      const newPlan = {
        id: planName.toLowerCase().replace(/\s+/g, "-"),
        name: planName,
        price: Number(planPrice),
        currency: planCurrency,
        duration: planDuration,
        desc: planDesc,
        features: planFeatures
      };
      updatedPlans.push(newPlan);
    }

    handleSaveConfigs({ plans: updatedPlans });
    setIsPlanFormOpen(false);
    setEditingPlan(null);
  };

  const handleDeletePlan = (planId: string) => {
    if (!confirm("Are you sure you want to delete this subscription plan?")) return;
    const updatedPlans = plans.filter(p => p.id !== planId);
    handleSaveConfigs({ plans: updatedPlans });
  };

  const handleToggleFeature = (f: string) => {
    const updatedFeatures = { ...features, [f]: !features[f] };
    setFeatures(updatedFeatures);
    handleSaveConfigs({ features: updatedFeatures });
  };

  const handleLimitChange = (planId: string, limitKey: string, val: number) => {
    const updatedLimits = {
      ...limits,
      [planId]: {
        ...limits[planId],
        [limitKey]: Number(val)
      }
    };
    setLimits(updatedLimits);
  };

  const handleToggleCurrency = (code: string) => {
    const updatedCurrencies = currencies.map(c => c.code === code ? { ...c, allowed: !c.allowed } : c);
    setCurrencies(updatedCurrencies);
    handleSaveConfigs({ currencies: updatedCurrencies });
  };

  if (loading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent mx-auto" />
          <p className="text-xs text-muted-foreground">Loading configurations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-[#0F172A]">
      {/* 1. Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white border border-slate-200/80 p-6 rounded-3xl">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <CreditCard className="h-5.5 w-5.5 text-blue-600" /> Subscription Management
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure subscription tiers, manage custom feature toggles, set plan limitations, and currencies.
          </p>
        </div>
      </div>

      {/* 2. Messages */}
      {errMsg && (
        <div className="p-3 bg-red-50 text-red-650 text-xs rounded-xl font-bold border border-red-100 flex items-center gap-2">
          <AlertTriangle className="h-4.5 w-4.5 flex-shrink-0" /> {errMsg}
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-emerald-50 text-emerald-600 text-xs rounded-xl font-bold border border-emerald-100 flex items-center gap-2">
          <CheckCircle className="h-4.5 w-4.5 flex-shrink-0" /> {successMsg}
        </div>
      )}

      {/* 3. Tab selection */}
      <div className="flex border-b border-slate-200 gap-6">
        <button
          onClick={() => setActiveTab("plans")}
          className={`pb-3 text-xs font-bold transition-all border-b-2 uppercase tracking-wider cursor-pointer ${
            activeTab === "plans" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-450 hover:text-slate-700"
          }`}
        >
          Subscription Plans
        </button>
        <button
          onClick={() => setActiveTab("toggles")}
          className={`pb-3 text-xs font-bold transition-all border-b-2 uppercase tracking-wider cursor-pointer ${
            activeTab === "toggles" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-450 hover:text-slate-700"
          }`}
        >
          Feature Toggles
        </button>
        <button
          onClick={() => setActiveTab("limits")}
          className={`pb-3 text-xs font-bold transition-all border-b-2 uppercase tracking-wider cursor-pointer ${
            activeTab === "limits" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-450 hover:text-slate-700"
          }`}
        >
          Plan Limits
        </button>
        <button
          onClick={() => setActiveTab("currency")}
          className={`pb-3 text-xs font-bold transition-all border-b-2 uppercase tracking-wider cursor-pointer ${
            activeTab === "currency" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-450 hover:text-slate-700"
          }`}
        >
          Currency Control
        </button>
      </div>

      {/* 4. PLANS BUILDER */}
      {activeTab === "plans" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left panel: Plan list */}
          <div className={`${isPlanFormOpen ? "lg:col-span-8" : "lg:col-span-12"} space-y-4`}>
            <div className="flex justify-between items-center bg-white border border-slate-200/80 p-4 rounded-xl">
              <span className="text-xs text-slate-450 font-medium">Create and manage your subscription tiers.</span>
              {!isPlanFormOpen && (
                <button
                  onClick={() => {
                    setEditingPlan(null);
                    setPlanName("");
                    setPlanPrice(0);
                    setPlanCurrency("USD");
                    setPlanDuration("1 Month");
                    setPlanDesc("");
                    setPlanFeatures({ ...features });
                    setIsPlanFormOpen(true);
                  }}
                  className="flex items-center gap-2 px-3.5 py-2 bg-blue-600 text-white hover:bg-blue-500 rounded-lg text-xs font-bold transition-all uppercase tracking-wider cursor-pointer"
                >
                  <Plus className="h-4 w-4" /> Create Tiers
                </button>
              )}
            </div>

            <div className={`grid grid-cols-1 gap-6 ${isPlanFormOpen ? "md:grid-cols-2" : "md:grid-cols-2 lg:grid-cols-4"}`}>
              {plans.map((p) => (
                <div key={p.id} className="bg-white border border-slate-200/80 rounded-2xl p-6 flex flex-col justify-between hover:shadow-md transition-shadow relative">
                  <div>
                    <h3 className="text-base font-black text-slate-800">{p.name}</h3>
                    <p className="text-xs text-slate-450 mt-1 min-h-[40px]">{p.desc}</p>
                    <div className="mt-4 border-t border-slate-100 pt-4">
                      <span className="text-3xl font-black text-blue-600">${p.price}</span>
                      <span className="text-xs text-slate-450 ml-1">/ {p.duration}</span>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-6 border-t border-slate-100 pt-4">
                    <button
                      onClick={() => {
                        setEditingPlan(p);
                        setPlanName(p.name);
                        setPlanPrice(p.price);
                        setPlanCurrency(p.currency);
                        setPlanDuration(p.duration);
                        setPlanDesc(p.desc);
                        setPlanFeatures(p.features || { ...features });
                        setIsPlanFormOpen(true);
                      }}
                      className="flex-1 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-bold border border-slate-200 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Edit className="h-3.5 w-3.5" /> Edit
                    </button>
                    <button
                      onClick={() => handleDeletePlan(p.id)}
                      className="p-2 hover:bg-red-50 text-red-500 rounded-lg border border-slate-200 hover:border-red-150 cursor-pointer"
                    >
                      <Trash className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right panel: Inline Create/Edit Form */}
          {isPlanFormOpen && (
            <div className="lg:col-span-4 bg-white rounded-3xl p-6 border border-slate-200 space-y-4">
              <h3 className="text-base font-bold flex items-center gap-2">
                <Coins className="h-5 w-5 text-blue-600" /> {editingPlan ? "Modify Plan" : "Create Plan Tier"}
              </h3>
              <p className="text-xs text-slate-450 border-b border-slate-100 pb-3">
                Configure base naming details, pricing structures, and validity schedules.
              </p>

              <div className="space-y-4 text-xs font-semibold">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Plan Name</label>
                  <input
                    type="text"
                    value={planName}
                    onChange={(e) => setPlanName(e.target.value)}
                    placeholder="e.g. Starter"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Base Price ($)</label>
                    <input
                      type="number"
                      value={planPrice}
                      onChange={(e) => setPlanPrice(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Validity Period</label>
                    <input
                      type="text"
                      value={planDuration}
                      onChange={(e) => setPlanDuration(e.target.value)}
                      placeholder="e.g. 1 Month"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Plan Description</label>
                  <textarea
                    value={planDesc}
                    onChange={(e) => setPlanDesc(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white"
                  />
                </div>

                <div className="space-y-2 border-t border-slate-100 pt-4">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Included Features</label>
                  <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                    {Object.keys(features).map((f) => (
                      <label key={f} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg cursor-pointer border border-slate-100">
                        <span className="text-[11px] font-bold text-slate-600 truncate mr-2">{f}</span>
                        <input
                          type="checkbox"
                          checked={planFeatures[f] !== false}
                          onChange={(e) => setPlanFeatures({ ...planFeatures, [f]: e.target.checked })}
                          className="h-4 w-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                        />
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-6 border-t border-slate-100 mt-4">
                <button
                  onClick={() => { setIsPlanFormOpen(false); setEditingPlan(null); }}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSavePlan}
                  disabled={!planName}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold shadow-md cursor-pointer"
                >
                  Save Tier Profile
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. FEATURE TOGGLE SWITCH BOARD */}
      {activeTab === "toggles" && (
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 space-y-6">
          <div>
            <h2 className="text-sm font-bold">Global SaaS Feature Switches</h2>
            <p className="text-xs text-slate-450 mt-0.5">Toggle platform functionality on/off dynamically. These changes act as system default baselines.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.keys(features).map((f) => (
              <div key={f} className="flex justify-between items-center p-3.5 hover:bg-slate-50 border border-slate-100 rounded-xl transition-all">
                <span className="text-xs font-bold text-slate-750">{f}</span>
                <label className="relative inline-flex items-center cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={features[f]}
                    onChange={() => handleToggleFeature(f)}
                    className="h-4.5 w-4.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                  />
                  <span className={`text-[10px] font-black ml-2 uppercase ${features[f] ? "text-emerald-650" : "text-slate-400"}`}>
                    {features[f] ? "ON" : "OFF"}
                  </span>
                </label>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. PLAN LIMITS SETTINGS */}
      {activeTab === "limits" && (
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 space-y-6">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-bold">Plan Limit Controls</h2>
              <p className="text-xs text-slate-450 mt-0.5">Configure operational bounds for each subscription level tier.</p>
            </div>
            <button
              onClick={() => handleSaveConfigs({ limits })}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
            >
              {saving ? "Saving limits..." : "Save Configured Limits"}
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {Object.keys(limits).map((planId) => (
              <div key={planId} className="bg-slate-50 border border-slate-150 p-5 rounded-2xl space-y-4">
                <h3 className="text-sm font-black text-blue-600 uppercase tracking-wider border-b border-slate-200 pb-1.5">{planId} Plan Limits</h3>
                
                <div className="grid grid-cols-2 gap-4 text-xs font-semibold">
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-450 uppercase">Users Limit</label>
                    <input
                      type="number"
                      value={limits[planId].users}
                      onChange={(e) => handleLimitChange(planId, "users", Number(e.target.value))}
                      className="w-full px-3 py-1.5 border border-slate-200 bg-white rounded-lg focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-450 uppercase">Branches Limit</label>
                    <input
                      type="number"
                      value={limits[planId].branches}
                      onChange={(e) => handleLimitChange(planId, "branches", Number(e.target.value))}
                      className="w-full px-3 py-1.5 border border-slate-200 bg-white rounded-lg focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-450 uppercase">Warehouses Limit</label>
                    <input
                      type="number"
                      value={limits[planId].warehouses}
                      onChange={(e) => handleLimitChange(planId, "warehouses", Number(e.target.value))}
                      className="w-full px-3 py-1.5 border border-slate-200 bg-white rounded-lg focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-450 uppercase">Products Limit</label>
                    <input
                      type="number"
                      value={limits[planId].products}
                      onChange={(e) => handleLimitChange(planId, "products", Number(e.target.value))}
                      className="w-full px-3 py-1.5 border border-slate-200 bg-white rounded-lg focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-450 uppercase">Monthly Transactions</label>
                    <input
                      type="number"
                      value={limits[planId].transactions}
                      onChange={(e) => handleLimitChange(planId, "transactions", Number(e.target.value))}
                      className="w-full px-3 py-1.5 border border-slate-200 bg-white rounded-lg focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-450 uppercase">Devices Limit</label>
                    <input
                      type="number"
                      value={limits[planId].devices}
                      onChange={(e) => handleLimitChange(planId, "devices", Number(e.target.value))}
                      className="w-full px-3 py-1.5 border border-slate-200 bg-white rounded-lg focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 7. CURRENCY CONTROL SHEET */}
      {activeTab === "currency" && (
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 space-y-6">
          <div>
            <h2 className="text-sm font-bold">Currency Management</h2>
            <p className="text-xs text-slate-450 mt-0.5">Control allowed transaction currencies. Tenant accounts will only be allowed to use permitted active currencies.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {currencies.map((c) => (
              <div key={c.code} className="flex justify-between items-center p-4 border border-slate-100 hover:bg-slate-50/60 rounded-xl transition-all">
                <div>
                  <h4 className="text-sm font-bold text-slate-750 flex items-center gap-1.5">
                    {c.code} ({c.symbol})
                  </h4>
                  <p className="text-[10px] text-slate-400 font-semibold">{c.name}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={c.allowed}
                    onChange={() => handleToggleCurrency(c.code)}
                    className="h-4.5 w-4.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                  />
                  <span className={`text-[10px] font-black ml-2 uppercase ${c.allowed ? "text-blue-600" : "text-slate-450"}`}>
                    {c.allowed ? "ALLOWED" : "RESTRICTED"}
                  </span>
                </label>
              </div>
            ))}
          </div>
        </div>
      )}


    </div>
  );
}
