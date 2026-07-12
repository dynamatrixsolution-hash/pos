"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import {
  CreditCard,
  Check,
  Zap,
  Users,
  Store,
  Calendar,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";

interface SubscriptionDetails {
  subscription: {
    id: string;
    plan: string;
    status: string;
    startDate: string;
    endDate: string;
    userLimit: number;
    branchLimit: number;
  };
  metrics: {
    branchCount: number;
    userCount: number;
  };
  plans: {
    id: string;
    name: string;
    price: number;
    currency: string;
    duration: string;
    desc: string;
    features?: Record<string, boolean>;
  }[];
}

export default function SubscriptionsPage() {
  const { data: session } = useSession();
  
  const [data, setData] = React.useState<SubscriptionDetails | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [errorMsg, setErrorMsg] = React.useState("");
  const [successMsg, setSuccessMsg] = React.useState("");
  const [showUpgradeModal, setShowUpgradeModal] = React.useState(false);
  const [selectedPlan, setSelectedPlan] = React.useState<any | null>(null);

  const loadSubscription = async () => {
    try {
      const res = await fetch("/api/v1/subscriptions");
      if (res.ok) {
        const json = await res.json();
        setData(json);
      } else {
        setErrorMsg("Failed to load subscription metrics");
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("Network error loading subscription metrics");
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    loadSubscription();
  }, []);

  const triggerUpgrade = (plan: any) => {
    setSelectedPlan(plan);
    setShowUpgradeModal(true);
  };

  const confirmUpgrade = async () => {
    if (!selectedPlan || !data) return;
    
    setIsLoading(true);
    setShowUpgradeModal(false);
    
    try {
      const res = await fetch("/api/v1/subscriptions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: selectedPlan.id }),
      });
      
      const resJson = await res.json();
      if (!res.ok) {
        throw new Error(resJson.error || "Failed to upgrade subscription");
      }

      setSuccessMsg(`Congratulations! Your workspace has been upgraded to the "${selectedPlan.name}" plan.`);
      loadSubscription();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to upgrade subscription");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="h-96 flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="text-xs text-muted-foreground">Retrieving active license metrics...</p>
        </div>
      </div>
    );
  }

  const activePlan = data?.subscription.plan || "FREE_TRIAL";
  const userCount = data?.metrics.userCount || 0;
  const userLimit = data?.subscription.userLimit || 1;
  const branchCount = data?.metrics.branchCount || 0;
  const branchLimit = data?.subscription.branchLimit || 1;

  const userPercent = Math.min((userCount / userLimit) * 100, 100);
  const branchPercent = Math.min((branchCount / branchLimit) * 100, 100);

  const daysRemaining = data
    ? Math.max(
        Math.ceil(
          (new Date(data.subscription.endDate).getTime() - new Date().getTime()) /
            (1000 * 60 * 60 * 24)
        ),
        0
      )
    : 0;

  const platformPlans = data?.plans || [];
  const plansList = platformPlans.map((plan) => {
    const isCurrentActive =
      activePlan.toUpperCase() === plan.id.toUpperCase() ||
      activePlan.toUpperCase() === plan.name.toUpperCase() ||
      (activePlan === "FREE_TRIAL" && plan.id === "Starter");

    const planFeatures = Object.keys(plan.features || {}).filter(f => plan.features?.[f] !== false);
    
    let featuresList = planFeatures;
    if (planFeatures.length === 0) {
      if (plan.id.toUpperCase() === "STARTER") {
        featuresList = ["1 Branch Limit", "1 User Limit", "Up to 100 Products", "Max Category 10", "Daily Reports Only", "No Receipt Printing"];
      } else if (plan.id.toUpperCase() === "PROFESSIONAL") {
        featuresList = ["2 Branches Limit", "5 Users (1 Owner, 4 Staff)", "Up to 1000 Products", "Unlimited Categories", "Full Reporting Enabled", "Receipt Printing Enabled"];
      } else {
        featuresList = ["5 Branches Limit", "20 Users (1 Owner, 19 Staff)", "Unlimited Products", "Unlimited Categories", "Full Reporting Enabled", "Receipt Printing Enabled"];
      }
    }

    return {
      id: plan.id,
      name: plan.name,
      price: `Rs. ${plan.price}`,
      period: plan.duration || "1 Month",
      features: featuresList,
      active: isCurrentActive,
      disabled: plan.id === "Starter" && !isCurrentActive,
    };
  });

  return (
    <div className="space-y-6">
      {/* 1. Header banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card border border-border p-5 rounded-2xl">
        <div>
          <h1 className="text-2xl font-black">Subscription License</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Monitor limits, check billing renewal schedules, and unlock premium enterprise tools.
          </p>
        </div>
      </div>

      {/* Messages */}
      {errorMsg && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive text-xs p-4 rounded-xl flex items-start gap-2">
          <AlertTriangle className="h-4.5 w-4.5 mt-0.5 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="bg-primary/10 border border-primary/20 text-primary text-xs p-4 rounded-xl flex items-start gap-2">
          <ShieldCheck className="h-4.5 w-4.5 mt-0.5 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* 2. Limits and Details Row */}
      {data && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Plan Status Card */}
          <div className="bg-card border border-border rounded-2xl p-5 flex flex-col justify-between shadow-sm">
            <div>
              <span className="text-[10px] bg-primary/15 text-primary border border-primary/20 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                Active Tier
              </span>
              <h2 className="text-xl font-black mt-2 text-foreground uppercase tracking-wide">
                {activePlan.replace("_", " ")}
              </h2>
              <div className="space-y-3 mt-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  <span>Renews/Expires: {new Date(data.subscription.endDate).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-primary" />
                  <span>Billing Status: <span className="font-semibold text-primary">{data.subscription.status}</span></span>
                </div>
              </div>
            </div>

            <div className="border-t border-border pt-4 mt-6 flex justify-between items-center text-xs">
              <span>Remaining Evaluation Time:</span>
              <span className="font-black text-foreground">{daysRemaining} Days</span>
            </div>
          </div>

          {/* User Limits Meter */}
          <div className="bg-card border border-border rounded-2xl p-5 flex flex-col justify-between shadow-sm">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">User Limits</span>
                <span className="text-xs font-black">{userCount} / {userLimit}</span>
              </div>
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Users className="h-4.5 w-4.5 text-primary" />
                Staff Members Registered
              </h3>
              
              {/* Progress bar */}
              <div className="w-full bg-secondary h-2.5 rounded-full overflow-hidden mt-6">
                <div
                  className="bg-primary h-full rounded-full transition-all duration-500"
                  style={{ width: `${userPercent}%` }}
                />
              </div>
            </div>

            <p className="text-[10px] text-muted-foreground mt-4">
              Your active plan permits registering up to {userLimit} cashier, manager, or owner logins.
            </p>
          </div>

          {/* Branch Limits Meter */}
          <div className="bg-card border border-border rounded-2xl p-5 flex flex-col justify-between shadow-sm">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Branch Limits</span>
                <span className="text-xs font-black">{branchCount} / {branchLimit}</span>
              </div>
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Store className="h-4.5 w-4.5 text-primary" />
                Physical Branch Outlets
              </h3>

              {/* Progress bar */}
              <div className="w-full bg-secondary h-2.5 rounded-full overflow-hidden mt-6">
                <div
                  className="bg-primary h-full rounded-full transition-all duration-500"
                  style={{ width: `${branchPercent}%` }}
                />
              </div>
            </div>

            <p className="text-[10px] text-muted-foreground mt-4">
              Your active plan permits managing up to {branchLimit} parallel store locations.
            </p>
          </div>
        </div>
      )}

      {/* 3. Tiers pricing list */}
      <div className="space-y-6">
        <div className="text-center max-w-xl mx-auto space-y-2 mt-8">
          <h2 className="text-xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight">
            Available Scaling Upgrade Packages
          </h2>
          <p className="text-xs text-muted-foreground">
            Select the billing tier that best aligns with your sales volume, branches capacity, and staffing requirements.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch pt-4">
          {plansList.map((plan) => {
            const isProfessional = plan.id === "Professional";
            return (
              <div
                key={plan.name}
                className={`bg-gradient-to-b from-white to-slate-50/40 dark:from-slate-900 dark:to-slate-950/40 border rounded-2xl flex flex-col justify-between shadow-sm relative overflow-hidden transition-all duration-300 hover:shadow-lg ${
                  plan.active
                    ? "border-[#064E3B] ring-2 ring-[#064E3B]/10"
                    : isProfessional
                    ? "border-amber-500/40 hover:border-amber-500/70"
                    : "border-slate-200 dark:border-slate-800 hover:border-slate-350"
                } ${isProfessional ? "pt-10" : "pt-6"} pb-6 px-6`}
              >
                {/* Custom Badges */}
                {isProfessional && (
                  <div className="absolute top-0 right-0 left-0 bg-gradient-to-r from-amber-500 to-amber-600 text-white text-[8px] font-black uppercase tracking-widest py-1 text-center font-mono">
                    ★ Most Popular Option ★
                  </div>
                )}
                {plan.active && (
                  <div className="absolute top-3.5 right-4 bg-[#064E3B] text-white text-[8px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full shadow-xs">
                    Active Plan
                  </div>
                )}

                <div>
                  <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-wide">
                    {plan.name} Plan
                  </h3>
                  <div className="flex items-baseline gap-1 mt-4 mb-6">
                    <span className="text-3xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight">{plan.price}</span>
                    <span className="text-xs text-muted-foreground font-semibold">/ {plan.period}</span>
                  </div>

                  <ul className="space-y-4 border-t border-slate-100 dark:border-slate-800/80 pt-5 text-xs text-slate-600 dark:text-slate-350 font-medium">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2.5">
                        <Check className="h-4 w-4 text-[#064E3B] dark:text-[#34D399] flex-shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-8">
                  {plan.active ? (
                    <div className="w-full py-2.5 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 text-center font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 select-none">
                      <ShieldCheck className="h-4 w-4" />
                      <span>Current License Active</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => triggerUpgrade(plan)}
                      disabled={plan.disabled}
                      className={`w-full py-2.5 rounded-xl text-xs font-black transition-all uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer border-none ${
                        plan.disabled
                          ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-60"
                          : "bg-[#064E3B] hover:bg-[#053F30] text-white shadow-md shadow-emerald-900/10 hover:shadow-emerald-900/20"
                      }`}
                    >
                      <span>Upgrade Plan</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Upgrade Checkout Dialog Overlay */}
      {showUpgradeModal && selectedPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <div>
              <h2 className="text-base font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Zap className="h-5 w-5 text-amber-500" />
                Confirm Plan Upgrade
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Upgrading limits will apply instantly to your active workspace.
              </p>
            </div>

            <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800/80 p-4 rounded-2xl text-xs space-y-2 text-slate-600 dark:text-slate-350">
              <div className="flex justify-between">
                <span>Selected Plan:</span>
                <span className="font-bold text-slate-800 dark:text-slate-100">{selectedPlan.name}</span>
              </div>
              <div className="flex justify-between">
                <span>Billing Frequency:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-100">Monthly Recurring</span>
              </div>
              <div className="border-t border-slate-200 dark:border-slate-800 pt-2 flex justify-between font-black text-sm text-slate-800 dark:text-slate-100">
                <span>Due Immediately:</span>
                <span className="text-[#064E3B] dark:text-[#34D399]">{selectedPlan.price}</span>
              </div>
            </div>

            <div className="flex gap-2.5 justify-end pt-2">
              <button
                onClick={() => setShowUpgradeModal(false)}
                className="px-4 py-2 bg-white hover:bg-slate-50 border border-black text-black text-xs font-bold rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={confirmUpgrade}
                className="px-5 py-2 bg-[#064E3B] hover:bg-[#053F30] text-white rounded-xl text-xs font-black shadow-md transition-all uppercase tracking-wider cursor-pointer border-none"
              >
                Confirm & Pay
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
