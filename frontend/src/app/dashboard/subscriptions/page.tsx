"use client";

import * as React from "react";
import {
  CreditCard,
  Check,
  Users,
  Store,
  Calendar,
  ShieldCheck,
  AlertTriangle,
  Clock,
  ArrowRight,
  X,
} from "lucide-react";
import { apiClient } from "@/core/api/api-client";

interface PlatformPlan {
  id: string;
  name: string;
  tier?: string;
  subtitle?: string;
  priceMonthly: number;
  priceAnnual: number;
  currency?: string;
  isPopular?: boolean;
  limits?: {
    tables?: number;
    staff?: number;
    branches?: number;
    rooms?: number;
  };
}

interface SubscriptionDetails {
  subscription: {
    id: string;
    plan: string;
    status: string;
    billingCycle?: string;
    packageType?: string;
    enabledModules?: string[];
    startDate: string;
    endDate: string;
    userLimit: number;
    branchLimit: number;
  };
  metrics: {
    branchCount: number;
    userCount: number;
  };
  plans: PlatformPlan[];
  pendingUpgradeInvoice?: {
    id: string;
    invoiceNumber: string;
    amount: number;
    currency: string;
    status: string;
    notes?: string;
    createdAt: string;
  } | null;
}

export default function SubscriptionsPage() {
  const [data, setData] = React.useState<SubscriptionDetails | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [billingCycle, setBillingCycle] = React.useState<"MONTHLY" | "ANNUAL">("MONTHLY");
  const [errorMsg, setErrorMsg] = React.useState("");
  const [successMsg, setSuccessMsg] = React.useState("");

  const [selectedPlan, setSelectedPlan] = React.useState<PlatformPlan | null>(null);
  const [paymentMethod, setPaymentMethod] = React.useState<"BANK_TRANSFER" | "FONEPAY" | "ESEWA" | "KHALTI">("BANK_TRANSFER");
  const [paymentReference, setPaymentReference] = React.useState("");
  const [notes, setNotes] = React.useState("");

  const loadSubscription = React.useCallback(async () => {
    try {
      const json = await apiClient.settings.getSubscription();
      setData(json);
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to load subscription details.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadSubscription();
  }, [loadSubscription]);

  const handleRequestUpgrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlan) return;
    if (paymentReference.trim().length < 3) {
      setErrorMsg("Please enter a valid payment transaction reference or voucher ID.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg("");
    setSuccessMsg("");
    try {
      const res = await apiClient.settings.updateSubscription({
        plan: selectedPlan.id,
        billingCycle,
        paymentMethod,
        paymentReference: paymentReference.trim(),
        notes: notes.trim() || undefined,
      });
      setSuccessMsg(
        res?.message ||
          "Upgrade request submitted. Your plan will activate once payment is verified by RestroInn Billing."
      );
      setSelectedPlan(null);
      setPaymentReference("");
      setNotes("");
      await loadSubscription();
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to submit upgrade request.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-20 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-40 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-72 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const activePlan = data?.subscription.plan || "STARTER";
  const userCount = data?.metrics.userCount || 0;
  const userLimit = data?.subscription.userLimit || 1;
  const branchCount = data?.metrics.branchCount || 0;
  const branchLimit = data?.subscription.branchLimit || 1;
  const userPercent = Math.min((userCount / Math.max(1, userLimit)) * 100, 100);
  const branchPercent = Math.min((branchCount / Math.max(1, branchLimit)) * 100, 100);
  const daysRemaining = data
    ? Math.max(
        Math.ceil((new Date(data.subscription.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
        0
      )
    : 0;
  const pendingInvoice = data?.pendingUpgradeInvoice || null;
  const plans = data?.plans || [];

  const formatLimit = (val?: number, label?: string) => {
    if (!val || val <= 0) return `No ${label}`;
    if (val >= 999) return `Unlimited ${label}`;
    return `Up to ${val} ${label}`;
  };

  return (
    <div className="space-y-6 text-[#292320]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] p-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#292320]">Subscription License</h1>
          <p className="text-xs text-[#71675E] mt-0.5">
            Monitor active workspace limits, renewal schedule, and request verified plan upgrades.
          </p>
        </div>

        {/* Monthly / Annual Billing Cycle Toggle */}
        <div className="inline-flex rounded-lg border border-[#D8CEC1] bg-[#EEE7DD] p-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setBillingCycle("MONTHLY")}
            className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
              billingCycle === "MONTHLY" ? "bg-[#FFFCF7] text-[#292320]" : "text-[#71675E] hover:text-[#292320]"
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setBillingCycle("ANNUAL")}
            className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
              billingCycle === "ANNUAL" ? "bg-[#FFFCF7] text-[#292320]" : "text-[#71675E] hover:text-[#292320]"
            }`}
          >
            Annual (Save 2 mo)
          </button>
        </div>
      </div>

      {/* Feedback Banners */}
      {errorMsg && (
        <div className="rounded-lg border border-[#E9B6B7] bg-[#FAEAEC] text-[#B33432] text-xs p-3.5 flex items-start gap-2 font-medium">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="rounded-lg border border-[#C3DED0] bg-[#EAF3EE] text-[#28634B] text-xs p-3.5 flex items-start gap-2 font-medium">
          <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
      {pendingInvoice && (
        <div className="rounded-lg border border-[#EDD7AD] bg-[#FDF5E7] text-[#946000] text-xs p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-start gap-2.5">
            <Clock className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              <p className="font-bold">
                Upgrade Payment Pending Verification ({pendingInvoice.invoiceNumber})
              </p>
              <p className="mt-0.5 text-[11px]">
                Amount: {pendingInvoice.currency} {pendingInvoice.amount.toLocaleString()} • Your plan will activate automatically once RestroInn Billing verifies your payment reference.
              </p>
            </div>
          </div>
          <span className="shrink-0 rounded-md border border-[#EDD7AD] bg-[#FFFCF7] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider">
            Pending Review
          </span>
        </div>
      )}

      {/* Active Subscription & Usage Meters */}
      {data && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] p-5 flex flex-col justify-between">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-md border border-[#C3DED0] bg-[#EAF3EE] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#28634B]">
                Active Tier
              </span>
              <h2 className="text-xl font-bold mt-2 text-[#292320] uppercase tracking-tight">
                {activePlan.replace(/_/g, " ")}
              </h2>
              <div className="space-y-2.5 mt-4 text-xs text-[#71675E]">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-[#6B2837]" />
                  <span>Expires: {new Date(data.subscription.endDate).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-[#6B2837]" />
                  <span>
                    Status: <span className="font-semibold text-[#292320]">{data.subscription.status}</span>
                  </span>
                </div>
              </div>
            </div>
            <div className="border-t border-[#D8CEC1] pt-3 mt-5 flex justify-between items-center text-xs">
              <span className="text-[#71675E]">Days Remaining</span>
              <span className="font-bold text-[#292320] tabular-nums">{daysRemaining} Days</span>
            </div>
          </div>

          <div className="rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] p-5 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-bold text-[#71675E] uppercase tracking-wider">User Limits</span>
                <span className="text-xs font-bold tabular-nums">{userCount} / {userLimit}</span>
              </div>
              <h3 className="text-sm font-bold flex items-center gap-2 text-[#292320]">
                <Users className="h-4 w-4 text-[#6B2837]" />
                Staff Accounts Registered
              </h3>
              <div className="w-full bg-[#EEE7DD] h-2 rounded-full overflow-hidden mt-5">
                <div className="bg-[#6B2837] h-full rounded-full" style={{ width: `${userPercent}%` }} />
              </div>
            </div>
            <p className="text-[11px] text-[#71675E] mt-4">
              Your active license allows up to {userLimit} staff logins.
            </p>
          </div>

          <div className="rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] p-5 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-bold text-[#71675E] uppercase tracking-wider">Branch Limits</span>
                <span className="text-xs font-bold tabular-nums">{branchCount} / {branchLimit}</span>
              </div>
              <h3 className="text-sm font-bold flex items-center gap-2 text-[#292320]">
                <Store className="h-4 w-4 text-[#6B2837]" />
                Physical Branch Outlets
              </h3>
              <div className="w-full bg-[#EEE7DD] h-2 rounded-full overflow-hidden mt-5">
                <div className="bg-[#6B2837] h-full rounded-full" style={{ width: `${branchPercent}%` }} />
              </div>
            </div>
            <p className="text-[11px] text-[#71675E] mt-4">
              Your active license allows up to {branchLimit} branch locations.
            </p>
          </div>
        </div>
      )}

      {/* Synced Platform Plans Grid */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-[#292320]">Platform Plans &amp; Pricing</h2>
            <p className="text-xs text-[#71675E]">
              Live pricing and limits synced directly from RestroInn Platform Administration.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
          {plans.map((plan) => {
            const isCurrentActive =
              activePlan.toUpperCase() === plan.id.toUpperCase() ||
              activePlan.toUpperCase() === plan.name.toUpperCase() ||
              (activePlan.toUpperCase() === "FREE_TRIAL" && plan.name.toUpperCase() === "STARTER");

            const displayPrice =
              billingCycle === "ANNUAL"
                ? Number(plan.priceAnnual || Number(plan.priceMonthly || 0) * 10)
                : Number(plan.priceMonthly || 0);
            const currency = plan.currency || "NPR";

            const limitsList = [
              formatLimit(plan.limits?.tables, "Dining Tables"),
              formatLimit(plan.limits?.staff, "Staff Accounts"),
              formatLimit(plan.limits?.branches, "Branches"),
              plan.limits?.rooms ? formatLimit(plan.limits.rooms, "Hotel Rooms") : "Restaurant & POS Suite",
            ];

            return (
              <div
                key={plan.id}
                className={`rounded-lg border bg-[#FFFCF7] p-5 flex flex-col justify-between relative ${
                  isCurrentActive
                    ? "border-[#28634B] ring-1 ring-[#28634B]/20"
                    : plan.isPopular
                    ? "border-[#6B2837]"
                    : "border-[#D8CEC1]"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-[#292320]">{plan.name}</h3>
                    {isCurrentActive ? (
                      <span className="rounded-md border border-[#C3DED0] bg-[#EAF3EE] px-2 py-0.5 text-[10px] font-bold text-[#28634B]">
                        Active
                      </span>
                    ) : plan.isPopular ? (
                      <span className="rounded-md bg-[#6B2837] px-2 py-0.5 text-[10px] font-bold text-[#FFFCF7]">
                        Popular
                      </span>
                    ) : null}
                  </div>
                  {plan.subtitle && (
                    <p className="text-[11px] text-[#71675E] mt-1 min-h-[30px]">{plan.subtitle}</p>
                  )}

                  <div className="mt-4 pb-4 border-b border-[#D8CEC1] flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-[#292320] tabular-nums">
                      {currency} {displayPrice.toLocaleString()}
                    </span>
                    <span className="text-xs text-[#71675E]">
                      /{billingCycle === "ANNUAL" ? "year" : "month"}
                    </span>
                  </div>

                  <ul className="space-y-2.5 pt-4 text-xs text-[#292320]">
                    {limitsList.map((item) => (
                      <li key={item} className="flex items-center gap-2">
                        <Check className="h-3.5 w-3.5 text-[#28634B] shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-6">
                  {isCurrentActive ? (
                    <div className="w-full py-2 rounded-lg border border-[#C3DED0] bg-[#EAF3EE] text-[#28634B] text-center font-semibold text-xs flex items-center justify-center gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Current Active Plan
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={Boolean(pendingInvoice)}
                      onClick={() => {
                        setErrorMsg("");
                        setSelectedPlan(plan);
                      }}
                      className="w-full py-2 rounded-lg bg-[#6B2837] hover:bg-[#541E2A] text-[#FFFCF7] text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span>{pendingInvoice ? "Upgrade Pending" : "Request Upgrade"}</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Verified Upgrade Request Modal */}
      {selectedPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#292320]/45 p-4">
          <div className="w-full max-w-md rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[#D8CEC1] pb-3">
              <div>
                <h2 className="text-sm font-bold text-[#292320]">Request Plan Upgrade</h2>
                <p className="text-[11px] text-[#71675E]">
                  Submit payment proof for RestroInn Billing verification.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPlan(null)}
                className="p-1 rounded-md text-[#71675E] hover:bg-[#EEE7DD] cursor-pointer"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleRequestUpgrade} className="space-y-3.5 text-xs">
              <div className="rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] p-3.5 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-[#71675E]">Requested Plan:</span>
                  <span className="font-bold text-[#292320]">{selectedPlan.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#71675E]">Billing Cycle:</span>
                  <span className="font-semibold text-[#292320]">
                    {billingCycle === "ANNUAL" ? "Annual" : "Monthly"}
                  </span>
                </div>
                <div className="flex justify-between border-t border-[#D8CEC1] pt-2 font-bold text-sm">
                  <span>Amount Payable:</span>
                  <span className="text-[#6B2837] tabular-nums">
                    {selectedPlan.currency || "NPR"}{" "}
                    {(billingCycle === "ANNUAL"
                      ? Number(selectedPlan.priceAnnual || Number(selectedPlan.priceMonthly || 0) * 10)
                      : Number(selectedPlan.priceMonthly || 0)
                    ).toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block font-semibold text-[#292320]">Payment Method *</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  className="w-full rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] px-3 py-2 text-xs text-[#292320] focus:border-[#6B2837] focus:outline-none"
                >
                  <option value="BANK_TRANSFER">Bank Transfer / ConnectIPS</option>
                  <option value="FONEPAY">Fonepay QR</option>
                  <option value="ESEWA">eSewa</option>
                  <option value="KHALTI">Khalti</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block font-semibold text-[#292320]">
                  Transaction Reference / Voucher ID *
                </label>
                <input
                  type="text"
                  required
                  minLength={3}
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  placeholder="e.g. TXN-98412045 or bank slip number"
                  className="w-full rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] px-3 py-2 text-xs font-mono text-[#292320] focus:border-[#6B2837] focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-semibold text-[#71675E]">Notes (Optional)</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Account holder name or remarks"
                  className="w-full rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] px-3 py-2 text-xs text-[#292320] focus:border-[#6B2837] focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-[#D8CEC1] pt-3">
                <button
                  type="button"
                  onClick={() => setSelectedPlan(null)}
                  className="px-3.5 py-2 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-xs font-semibold text-[#292320] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || paymentReference.trim().length < 3}
                  className="px-4 py-2 rounded-lg bg-[#6B2837] hover:bg-[#541E2A] text-[#FFFCF7] text-xs font-semibold cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? "Submitting..." : "Submit Upgrade Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
