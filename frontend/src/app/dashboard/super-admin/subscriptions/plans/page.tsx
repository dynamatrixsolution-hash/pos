"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Layers,
  Settings,
  Plus,
  Check,
  X,
  CreditCard,
  Edit2,
  Trash2,
  Sparkles,
  Shield,
  Building2,
  Users,
  Store,
  Sliders,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

interface PlanTier {
  id: string;
  name: string;
  tier: string;
  subtitle: string;
  priceMonthly: number;
  priceAnnual: number;
  currency: string;
  isPopular?: boolean;
  isCustomPrice?: boolean;
  limits: {
    tables: number;
    staff: number;
    branches: number;
    rooms?: number;
  };
}

interface FeatureItem {
  name: string;
  basic: boolean;
  standard: boolean;
  professional: boolean;
  enterprise: boolean;
}

interface FeatureCategory {
  category: string;
  features: FeatureItem[];
}

interface GlobalSettings {
  defaultCurrency: string;
  trialPeriodDays: number;
  gracePeriodDays: number;
  taxRate: number;
  autoInvoice: boolean;
}

export default function PlansAndPricingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<PlanTier[]>([]);
  const [featureMatrix, setFeatureMatrix] = useState<FeatureCategory[]>([]);
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings>({
    defaultCurrency: "NPR",
    trialPeriodDays: 14,
    gracePeriodDays: 7,
    taxRate: 13,
    autoInvoice: true,
  });

  // Modals
  const [showGlobalSettingsModal, setShowGlobalSettingsModal] = useState(false);
  const [showCreatePlanModal, setShowCreatePlanModal] = useState(false);
  const [editingPlanLimits, setEditingPlanLimits] = useState<PlanTier | null>(null);
  const [isEditingMatrix, setIsEditingMatrix] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states for Plan Limits Edit
  const [editTables, setEditTables] = useState(15);
  const [editStaff, setEditStaff] = useState(5);
  const [editBranches, setEditBranches] = useState(1);
  const [editRooms, setEditRooms] = useState(0);

  // Form states for Create Plan
  const [newPlanName, setNewPlanName] = useState("");
  const [newPlanSubtitle, setNewPlanSubtitle] = useState("");
  const [newPriceMonthly, setNewPriceMonthly] = useState(1500);
  const [newPriceAnnual, setNewPriceAnnual] = useState(15000);

  // Feedback Notification
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const fetchPlansData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/super-admin/subscriptions");
      if (res.ok) {
        const data = await res.json();
        if (data.plans) setPlans(data.plans);
        if (data.featureMatrix) setFeatureMatrix(data.featureMatrix);
        if (data.globalSettings) setGlobalSettings(data.globalSettings);
      } else {
        const err = await res.json().catch(() => ({}));
        setFeedback({ type: "error", message: err.error || "Failed to load plans data" });
      }
    } catch {
      setFeedback({ type: "error", message: "Network connection error loading plans." });
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
      fetchPlansData();
    }
  }, [status, session, router, fetchPlansData]);

  // Handle Plan Limits Save
  const handleSavePlanLimits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlanLimits) return;
    setIsSubmitting(true);
    try {
      const updatedPlans = plans.map((p) => {
        if (p.id === editingPlanLimits.id) {
          return {
            ...p,
            limits: {
              tables: editTables,
              staff: editStaff,
              branches: editBranches,
              rooms: editRooms,
            },
          };
        }
        return p;
      });

      const res = await fetch("/api/v1/super-admin/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "UPDATE_PLANS",
          plans: updatedPlans,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update plan limits");

      setPlans(updatedPlans);
      setEditingPlanLimits(null);
      setFeedback({ type: "success", message: `Updated limits for ${editingPlanLimits.name} plan.` });
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Create Plan
  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlanName.trim()) return;
    setIsSubmitting(true);
    try {
      const newTier: PlanTier = {
        id: newPlanName.toLowerCase().replace(/\s+/g, "-"),
        name: newPlanName.trim(),
        tier: newPlanName.toUpperCase().replace(/\s+/g, "_"),
        subtitle: newPlanSubtitle.trim() || "Hospitality subscription tier",
        priceMonthly: newPriceMonthly,
        priceAnnual: newPriceAnnual,
        currency: "NPR",
        isPopular: false,
        limits: {
          tables: 50,
          staff: 20,
          branches: 2,
          rooms: 25,
        },
      };

      const updatedPlans = [...plans, newTier];
      const res = await fetch("/api/v1/super-admin/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "UPDATE_PLANS",
          plans: updatedPlans,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create plan");

      setPlans(updatedPlans);
      setShowCreatePlanModal(false);
      setNewPlanName("");
      setNewPlanSubtitle("");
      setFeedback({ type: "success", message: `Plan '${newPlanName}' created successfully.` });
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Global Settings Save
  const handleSaveGlobalSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/v1/super-admin/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "UPDATE_GLOBAL_SETTINGS",
          globalSettings,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update global settings");

      setShowGlobalSettingsModal(false);
      setFeedback({ type: "success", message: "Global subscription settings updated." });
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle Feature in Matrix
  const handleToggleFeature = (catIndex: number, featIndex: number, planKey: "basic" | "standard" | "professional" | "enterprise") => {
    if (!isEditingMatrix) return;
    const nextMatrix = [...featureMatrix];
    nextMatrix[catIndex].features[featIndex][planKey] = !nextMatrix[catIndex].features[featIndex][planKey];
    setFeatureMatrix(nextMatrix);
  };

  const handleSaveFeatureMatrix = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/v1/super-admin/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "UPDATE_FEATURE_MATRIX",
          featureMatrix,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save feature matrix");

      setIsEditingMatrix(false);
      setFeedback({ type: "success", message: "Feature matrix configuration saved." });
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 text-[#292320]">
      {/* 1. Header with Breadcrumbs & Action Buttons matching Screenshot 2 */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#292320]">Plans & Pricing</h1>
          <p className="text-xs text-[#71675E] mt-0.5">
            Manage subscription tiers, feature limits, and add-on modules dynamically.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/dashboard/super-admin/subscriptions"
            className="px-3 py-1.5 bg-[#FFFCF7] hover:bg-[#F7F3EC] border border-[#D8CEC1] rounded-md text-xs font-semibold text-[#292320] transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <CreditCard className="h-3.5 w-3.5 text-[#6B2837]" />
            <span>All Subscriptions</span>
          </Link>

          <button
            onClick={() => setShowGlobalSettingsModal(true)}
            className="px-3.5 py-1.5 bg-[#FFFCF7] hover:bg-[#F7F3EC] border border-[#D8CEC1] text-[#292320] rounded-md text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Settings className="h-3.5 w-3.5 text-[#71675E]" />
            <span>Global Settings</span>
          </button>

          <button
            onClick={() => setShowCreatePlanModal(true)}
            className="px-3.5 py-1.5 bg-[#6B2837] hover:bg-[#521E2A] text-white rounded-md text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
            <span>+ Create New Plan</span>
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-3 text-xs rounded-md border flex items-center justify-between ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-rose-50 text-rose-800 border-rose-200"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
            )}
            <span className="font-medium">{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* 2. 4-Plan Cards Grid matching Screenshot 2 */}
      {loading ? (
        <div className="p-12 text-center space-y-3 bg-[#FFFCF7] border border-[#D8CEC1]/80 rounded-lg">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#6B2837] border-t-transparent mx-auto" />
          <p className="text-xs text-[#71675E]">Loading subscription tiers...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {plans.map((plan) => {
            const isProfessional = plan.isPopular;
            return (
              <div
                key={plan.id}
                className={`relative bg-[#FFFCF7] rounded-lg border p-4 flex flex-col justify-between transition-all ${
                  isProfessional
                    ? "border-[#6B2837] ring-1 ring-[#6B2837]/30 shadow-xs"
                    : "border-[#D8CEC1]/80 hover:border-[#D8CEC1]"
                }`}
              >
                {/* Most Popular Badge on Top Right */}
                {isProfessional && (
                  <span className="absolute -top-2.5 right-4 px-2 py-0.5 bg-[#6B2837] text-white text-[9px] font-bold tracking-wider uppercase rounded-full">
                    MOST POPULAR
                  </span>
                )}

                <div>
                  {/* Title & Edit Icon */}
                  <div className="flex justify-between items-start">
                    <div>
                      <h3
                        className={`text-sm font-bold tracking-tight ${
                          plan.tier === "BASIC"
                            ? "text-emerald-700"
                            : plan.tier === "STANDARD"
                            ? "text-blue-700"
                            : plan.tier === "PROFESSIONAL"
                            ? "text-[#6B2837]"
                            : "text-amber-700"
                        }`}
                      >
                        {plan.name}
                      </h3>
                      <p className="text-[11px] text-[#71675E] mt-0.5 line-clamp-1">{plan.subtitle}</p>
                    </div>
                    <div className="flex items-center gap-1 text-[#71675E]">
                      <button
                        onClick={() => {
                          setEditingPlanLimits(plan);
                          setEditTables(plan.limits.tables);
                          setEditStaff(plan.limits.staff);
                          setEditBranches(plan.limits.branches);
                          setEditRooms(plan.limits.rooms || 0);
                        }}
                        title="Edit limits"
                        className="p-1 hover:bg-[#EEE7DD] rounded cursor-pointer"
                      >
                        <Edit2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>

                  {/* Pricing Display */}
                  <div className="mt-3 pb-3 border-b border-[#D8CEC1]/60">
                    {plan.isCustomPrice ? (
                      <div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-xl font-bold tracking-tight text-[#292320]">Custom</span>
                          <span className="text-xs text-[#71675E]">/mo</span>
                        </div>
                        <p className="text-[10px] text-[#71675E] mt-0.5">or Custom /year</p>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-xl font-bold tracking-tight text-[#292320] tabular-nums">
                            {plan.currency} {plan.priceMonthly.toLocaleString()}
                          </span>
                          <span className="text-xs text-[#71675E]">/mo</span>
                        </div>
                        <p className="text-[10px] text-[#71675E] mt-0.5 tabular-nums">
                          or {plan.currency} {plan.priceAnnual.toLocaleString()} /year
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Resource Limits List */}
                  <div className="py-3 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-[#71675E]">
                        <Building2 className="h-3.5 w-3.5 text-[#6B2837]" />
                        <span>Dining Tables</span>
                      </div>
                      <span className="font-semibold text-[#292320] tabular-nums">
                        {plan.limits.tables >= 900 ? "Unlimited" : `Up to ${plan.limits.tables}`}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-[#71675E]">
                        <Users className="h-3.5 w-3.5 text-blue-600" />
                        <span>Staff Accounts</span>
                      </div>
                      <span className="font-semibold text-[#292320] tabular-nums">
                        {plan.limits.staff >= 900 ? "Unlimited" : `Up to ${plan.limits.staff}`}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-[#71675E]">
                        <Store className="h-3.5 w-3.5 text-emerald-600" />
                        <span>Property Branches</span>
                      </div>
                      <span className="font-semibold text-[#292320] tabular-nums">
                        {plan.limits.branches >= 90 ? "Unlimited" : `${plan.limits.branches} Branch`}
                      </span>
                    </div>

                    {plan.limits.rooms !== undefined && plan.limits.rooms > 0 && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-[#71675E]">
                          <Shield className="h-3.5 w-3.5 text-purple-600" />
                          <span>Hotel Rooms</span>
                        </div>
                        <span className="font-semibold text-[#292320] tabular-nums">
                          {plan.limits.rooms >= 900 ? "Unlimited" : `Up to ${plan.limits.rooms}`}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Edit Plan Limits Button */}
                <div className="pt-2">
                  <button
                    onClick={() => {
                      setEditingPlanLimits(plan);
                      setEditTables(plan.limits.tables);
                      setEditStaff(plan.limits.staff);
                      setEditBranches(plan.limits.branches);
                      setEditRooms(plan.limits.rooms || 0);
                    }}
                    className={`w-full py-2 rounded-md text-xs font-semibold transition-colors cursor-pointer text-center ${
                      isProfessional
                        ? "bg-[#6B2837] text-white hover:bg-[#521E2A]"
                        : "bg-[#FFFCF7] hover:bg-[#F7F3EC] border border-[#D8CEC1] text-[#292320]"
                    }`}
                  >
                    Edit Plan Limits
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 3. Feature Matrix Configuration Table matching Screenshot 2 */}
      <div className="bg-[#FFFCF7] border border-[#D8CEC1]/80 rounded-lg overflow-hidden shadow-xs">
        <div className="p-4 border-b border-[#D8CEC1]/80 flex justify-between items-center bg-[#F7F3EC]/40">
          <div className="flex items-center gap-2">
            <Sliders className="h-4 w-4 text-[#6B2837]" />
            <h2 className="text-xs font-bold text-[#292320]">Feature Matrix Configuration</h2>
          </div>

          <div className="flex items-center gap-2">
            {isEditingMatrix ? (
              <>
                <button
                  onClick={() => setIsEditingMatrix(false)}
                  className="px-3 py-1 border border-[#D8CEC1] text-xs font-semibold rounded-md hover:bg-[#FFFCF7] text-[#292320] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveFeatureMatrix}
                  disabled={isSubmitting}
                  className="px-3 py-1 bg-[#6B2837] text-white text-xs font-semibold rounded-md hover:bg-[#521E2A] cursor-pointer"
                >
                  {isSubmitting ? "Saving..." : "Save Matrix"}
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsEditingMatrix(true)}
                className="text-xs font-semibold text-[#6B2837] hover:underline cursor-pointer"
              >
                Manage Features
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#D8CEC1] bg-[#F7F3EC]/80 text-[#71675E] font-semibold uppercase text-[10px] tracking-wider">
                <th className="py-2.5 px-4 w-1/3">Module / Feature</th>
                <th className="py-2.5 px-4 text-center font-bold text-emerald-800">BASIC</th>
                <th className="py-2.5 px-4 text-center font-bold text-blue-800">STANDARD</th>
                <th className="py-2.5 px-4 text-center font-bold text-[#6B2837]">PROFESSIONAL</th>
                <th className="py-2.5 px-4 text-center font-bold text-amber-800">ENTERPRISE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D8CEC1]/50">
              {featureMatrix.map((cat, catIdx) => (
                <React.Fragment key={cat.category}>
                  {/* Category Header Row */}
                  <tr className="bg-[#FAF2F4]/40 font-bold text-[11px] text-[#6B2837]">
                    <td colSpan={5} className="py-2 px-4">
                      {cat.category}
                    </td>
                  </tr>

                  {/* Feature Rows */}
                  {cat.features.map((feat, featIdx) => (
                    <tr
                      key={feat.name}
                      className="hover:bg-[#F7F3EC]/30 transition-colors"
                    >
                      <td className="py-2.5 px-4 text-[#292320] font-medium pl-6">
                        {feat.name}
                      </td>

                      {/* BASIC */}
                      <td
                        onClick={() => handleToggleFeature(catIdx, featIdx, "basic")}
                        className={`py-2.5 px-4 text-center ${isEditingMatrix ? "cursor-pointer hover:bg-emerald-50" : ""}`}
                      >
                        {feat.basic ? (
                          <Check className="h-4 w-4 text-emerald-600 mx-auto" />
                        ) : (
                          <span className="text-[#D8CEC1] font-bold">—</span>
                        )}
                      </td>

                      {/* STANDARD */}
                      <td
                        onClick={() => handleToggleFeature(catIdx, featIdx, "standard")}
                        className={`py-2.5 px-4 text-center ${isEditingMatrix ? "cursor-pointer hover:bg-blue-50" : ""}`}
                      >
                        {feat.standard ? (
                          <Check className="h-4 w-4 text-emerald-600 mx-auto" />
                        ) : (
                          <span className="text-[#D8CEC1] font-bold">—</span>
                        )}
                      </td>

                      {/* PROFESSIONAL */}
                      <td
                        onClick={() => handleToggleFeature(catIdx, featIdx, "professional")}
                        className={`py-2.5 px-4 text-center ${isEditingMatrix ? "cursor-pointer hover:bg-[#FAF2F4]" : ""}`}
                      >
                        {feat.professional ? (
                          <Check className="h-4 w-4 text-emerald-600 mx-auto" />
                        ) : (
                          <span className="text-[#D8CEC1] font-bold">—</span>
                        )}
                      </td>

                      {/* ENTERPRISE */}
                      <td
                        onClick={() => handleToggleFeature(catIdx, featIdx, "enterprise")}
                        className={`py-2.5 px-4 text-center ${isEditingMatrix ? "cursor-pointer hover:bg-amber-50" : ""}`}
                      >
                        {feat.enterprise ? (
                          <Check className="h-4 w-4 text-emerald-600 mx-auto" />
                        ) : (
                          <span className="text-[#D8CEC1] font-bold">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: Edit Plan Limits */}
      {editingPlanLimits && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg max-w-sm w-full p-5 space-y-4 shadow-md text-[#292320]">
            <div className="flex justify-between items-start border-b border-[#D8CEC1] pb-3">
              <div>
                <h3 className="text-sm font-bold text-[#292320]">Edit Plan Limits</h3>
                <p className="text-xs text-[#71675E] mt-0.5">{editingPlanLimits.name} Tier</p>
              </div>
              <button
                onClick={() => setEditingPlanLimits(null)}
                className="text-[#71675E] hover:text-[#292320] p-1 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSavePlanLimits} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-[#71675E] uppercase mb-1">
                  Dining Tables Limit
                </label>
                <input
                  type="number"
                  min={1}
                  max={999}
                  value={editTables}
                  onChange={(e) => setEditTables(Number(e.target.value))}
                  className="w-full p-2 bg-[#F7F3EC] border border-[#D8CEC1] rounded-md text-xs text-[#292320]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#71675E] uppercase mb-1">
                  Staff Accounts Limit
                </label>
                <input
                  type="number"
                  min={1}
                  max={999}
                  value={editStaff}
                  onChange={(e) => setEditStaff(Number(e.target.value))}
                  className="w-full p-2 bg-[#F7F3EC] border border-[#D8CEC1] rounded-md text-xs text-[#292320]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#71675E] uppercase mb-1">
                  Property Branches Limit
                </label>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={editBranches}
                  onChange={(e) => setEditBranches(Number(e.target.value))}
                  className="w-full p-2 bg-[#F7F3EC] border border-[#D8CEC1] rounded-md text-xs text-[#292320]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#71675E] uppercase mb-1">
                  Hotel Rooms Limit
                </label>
                <input
                  type="number"
                  min={0}
                  max={999}
                  value={editRooms}
                  onChange={(e) => setEditRooms(Number(e.target.value))}
                  className="w-full p-2 bg-[#F7F3EC] border border-[#D8CEC1] rounded-md text-xs text-[#292320]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#D8CEC1]">
                <button
                  type="button"
                  onClick={() => setEditingPlanLimits(null)}
                  className="px-3 py-1.5 border border-[#D8CEC1] text-xs font-semibold rounded-md hover:bg-[#F7F3EC] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 bg-[#6B2837] text-white text-xs font-semibold rounded-md hover:bg-[#521E2A] disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? "Saving..." : "Save Limits"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Global Settings */}
      {showGlobalSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg max-w-sm w-full p-5 space-y-4 shadow-md text-[#292320]">
            <div className="flex justify-between items-start border-b border-[#D8CEC1] pb-3">
              <div>
                <h3 className="text-sm font-bold text-[#292320]">Global Subscription Settings</h3>
                <p className="text-xs text-[#71675E] mt-0.5">Platform defaults and billing rules.</p>
              </div>
              <button
                onClick={() => setShowGlobalSettingsModal(false)}
                className="text-[#71675E] hover:text-[#292320] p-1 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveGlobalSettings} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-[#71675E] uppercase mb-1">
                  Default Platform Currency
                </label>
                <select
                  value={globalSettings.defaultCurrency}
                  onChange={(e) => setGlobalSettings({ ...globalSettings, defaultCurrency: e.target.value })}
                  className="w-full p-2 bg-[#F7F3EC] border border-[#D8CEC1] rounded-md text-xs text-[#292320]"
                >
                  <option value="NPR">Nepalese Rupee (NPR)</option>
                  <option value="INR">Indian Rupee (INR)</option>
                  <option value="USD">US Dollar (USD)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#71675E] uppercase mb-1">
                  Trial Period Duration (Days)
                </label>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={globalSettings.trialPeriodDays}
                  onChange={(e) => setGlobalSettings({ ...globalSettings, trialPeriodDays: Number(e.target.value) })}
                  className="w-full p-2 bg-[#F7F3EC] border border-[#D8CEC1] rounded-md text-xs text-[#292320]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#71675E] uppercase mb-1">
                  Grace Period (Days after Expiry)
                </label>
                <input
                  type="number"
                  min={0}
                  max={30}
                  value={globalSettings.gracePeriodDays}
                  onChange={(e) => setGlobalSettings({ ...globalSettings, gracePeriodDays: Number(e.target.value) })}
                  className="w-full p-2 bg-[#F7F3EC] border border-[#D8CEC1] rounded-md text-xs text-[#292320]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#71675E] uppercase mb-1">
                  VAT Rate (%)
                </label>
                <input
                  type="number"
                  min={0}
                  max={30}
                  value={globalSettings.taxRate}
                  onChange={(e) => setGlobalSettings({ ...globalSettings, taxRate: Number(e.target.value) })}
                  className="w-full p-2 bg-[#F7F3EC] border border-[#D8CEC1] rounded-md text-xs text-[#292320]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#D8CEC1]">
                <button
                  type="button"
                  onClick={() => setShowGlobalSettingsModal(false)}
                  className="px-3 py-1.5 border border-[#D8CEC1] text-xs font-semibold rounded-md hover:bg-[#F7F3EC] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 bg-[#6B2837] text-white text-xs font-semibold rounded-md hover:bg-[#521E2A] disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? "Saving..." : "Save Settings"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Create New Plan */}
      {showCreatePlanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg max-w-md w-full p-5 space-y-4 shadow-md text-[#292320]">
            <div className="flex justify-between items-start border-b border-[#D8CEC1] pb-3">
              <div>
                <h3 className="text-sm font-bold text-[#292320]">Create New Plan Tier</h3>
                <p className="text-xs text-[#71675E] mt-0.5">Define a customized hospitality subscription package.</p>
              </div>
              <button
                onClick={() => setShowCreatePlanModal(false)}
                className="text-[#71675E] hover:text-[#292320] p-1 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePlan} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-[#71675E] uppercase mb-1">
                  Plan Name <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Resort Deluxe"
                  value={newPlanName}
                  onChange={(e) => setNewPlanName(e.target.value)}
                  className="w-full p-2 bg-[#F7F3EC] border border-[#D8CEC1] rounded-md text-xs text-[#292320]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#71675E] uppercase mb-1">
                  Target Audience / Subtitle
                </label>
                <input
                  type="text"
                  placeholder="e.g. For large luxury resorts with multiple dining outlets"
                  value={newPlanSubtitle}
                  onChange={(e) => setNewPlanSubtitle(e.target.value)}
                  className="w-full p-2 bg-[#F7F3EC] border border-[#D8CEC1] rounded-md text-xs text-[#292320]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#71675E] uppercase mb-1">
                    Monthly Price (NPR)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={newPriceMonthly}
                    onChange={(e) => setNewPriceMonthly(Number(e.target.value))}
                    className="w-full p-2 bg-[#F7F3EC] border border-[#D8CEC1] rounded-md text-xs text-[#292320]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#71675E] uppercase mb-1">
                    Annual Price (NPR)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={newPriceAnnual}
                    onChange={(e) => setNewPriceAnnual(Number(e.target.value))}
                    className="w-full p-2 bg-[#F7F3EC] border border-[#D8CEC1] rounded-md text-xs text-[#292320]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#D8CEC1]">
                <button
                  type="button"
                  onClick={() => setShowCreatePlanModal(false)}
                  className="px-3 py-1.5 border border-[#D8CEC1] text-xs font-semibold rounded-md hover:bg-[#F7F3EC] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 bg-[#6B2837] text-white text-xs font-semibold rounded-md hover:bg-[#521E2A] disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? "Creating..." : "Create Plan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

