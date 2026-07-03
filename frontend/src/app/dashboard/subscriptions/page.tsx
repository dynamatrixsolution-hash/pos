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
      if (plan.id === "Starter") {
        featuresList = ["1 Operating Branch", "Up to 5 Users", "Basic POS checkout", "Daily Reporting"];
      } else if (plan.id === "Business") {
        featuresList = ["Up to 5 Operating Branches", "Up to 15 Registered Users", "Inventory Expiry Alerts", "Supplier & Customer Ledger", "Advanced Profit/Loss Analytics"];
      } else if (plan.id === "Professional") {
        featuresList = ["Up to 20 Operating Branches", "Up to 100 Registered Users", "Stock Transfer Approval Queues", "Custom OpenAPI endpoint keys", "24/7 Dedicated Priority Phone Support"];
      } else {
        featuresList = ["Unlimited Operating Branches", "Unlimited Registered Users", "All SaaS Modules Enabled", "Dedicated Backup Storage", "Priority Dedicated Support line"];
      }
    }

    return {
      id: plan.id,
      name: plan.name,
      price: `$${plan.price}`,
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
      <div>
        <h2 className="text-base font-bold mb-4">Available Scaling Upgrade Packages</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plansList.map((plan) => (
            <div
              key={plan.name}
              className={`bg-card border rounded-2xl p-6 flex flex-col justify-between shadow-sm relative overflow-hidden transition-all ${
                plan.active
                  ? "border-primary ring-1 ring-primary"
                  : "border-border hover:border-border/80"
              }`}
            >
              {plan.active && (
                <div className="absolute top-3 right-3 bg-primary text-primary-foreground text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded">
                  Current
                </div>
              )}

              <div>
                <h3 className="text-sm font-bold text-foreground">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mt-4 mb-6">
                  <span className="text-3xl font-black text-foreground">{plan.price}</span>
                  <span className="text-xs text-muted-foreground">/ {plan.period}</span>
                </div>

                <ul className="space-y-3.5 border-t border-border/50 pt-5 text-xs text-muted-foreground">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5">
                      <Check className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-8">
                {plan.active ? (
                  <div className="w-full py-2 bg-primary/10 text-primary border border-primary/20 text-center font-bold rounded-xl text-xs flex items-center justify-center gap-1.5">
                    <ShieldCheck className="h-4 w-4" />
                    <span>Plan Active</span>
                  </div>
                ) : (
                  <button
                    onClick={() => triggerUpgrade(plan)}
                    disabled={plan.disabled}
                    className={`w-full py-2 rounded-xl text-xs font-black transition-all uppercase tracking-wider flex items-center justify-center gap-1.5 ${
                      plan.disabled
                        ? "bg-secondary text-muted-foreground cursor-not-allowed border border-border"
                        : "bg-primary text-primary-foreground hover:bg-primary/95 shadow-md shadow-primary/10"
                    }`}
                  >
                    <span>Upgrade Plan</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Upgrade Checkout Dialog Overlay */}
      {showUpgradeModal && selectedPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="bg-card border border-border w-full max-w-md rounded-2xl p-6 shadow-xl space-y-4 animate-in zoom-in-95 duration-150">
            <div>
              <h2 className="text-lg font-black flex items-center gap-2">
                <Zap className="h-5 w-5 text-amber-500" />
                Confirm Plan Upgrade
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Upgrading limits will apply instantly to your active workspace.
              </p>
            </div>

            <div className="bg-secondary/50 border border-border p-4 rounded-xl text-xs space-y-2">
              <div className="flex justify-between">
                <span>Selected Plan:</span>
                <span className="font-bold text-foreground">{selectedPlan.name}</span>
              </div>
              <div className="flex justify-between">
                <span>Billing Frequency:</span>
                <span className="font-semibold text-foreground">Monthly Recurring</span>
              </div>
              <div className="border-t border-border/80 pt-2 flex justify-between font-bold text-sm text-foreground">
                <span>Due Immediately:</span>
                <span className="text-primary">{selectedPlan.price}</span>
              </div>
            </div>

            <div className="flex gap-2.5 justify-end">
              <button
                onClick={() => setShowUpgradeModal(false)}
                className="px-4 py-2 border border-border hover:bg-secondary rounded-xl text-xs font-bold text-muted-foreground transition-all"
              >
                Cancel
              </button>
              <button
                onClick={confirmUpgrade}
                className="px-5 py-2 bg-primary text-primary-foreground hover:bg-primary/95 rounded-xl text-xs font-black shadow-lg shadow-primary/20 transition-all uppercase tracking-wider"
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
