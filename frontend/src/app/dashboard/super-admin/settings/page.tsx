"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Settings,
  Sliders,
  CreditCard,
  Radio,
  ShieldAlert,
  Save,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Lock,
  Mail,
  Phone,
  Clock,
  Globe,
  MessageSquare,
  History,
  X,
  FileCode,
  Shield,
  ArrowRight,
} from "lucide-react";
import { toast } from "@/components/toast";

interface AuditHistoryItem {
  id: string;
  action: string;
  reason: string;
  beforeState: any;
  afterState: any;
  createdAt: string;
  userName: string;
  userEmail: string;
  role: string;
  ipAddress: string;
}

export default function PlatformSettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<"general" | "subscription" | "gateways" | "maintenance">("general");
  const [loading, setLoading] = useState(true);
  const [reloading, setReloading] = useState(false);

  // Settings State
  const [generalConfig, setGeneralConfig] = useState({
    platformName: "RestroInn Platform",
    supportEmail: "support@restroinn.com",
    emergencyPhone: "+977-1-4400000",
    timeZone: "Asia/Kathmandu",
    taxSystem: "NEPAL_IRD_VAT",
    defaultCurrency: "NPR",
  });

  const [subDefaults, setSubDefaults] = useState({
    trialDurationDays: 14,
    gracePeriodDays: 7,
    invoiceDueDays: 15,
    defaultCurrency: "NPR",
    autoReminderDaysBeforeDue: 3,
  });

  const [gatewaySettings, setGatewaySettings] = useState({
    smsProvider: "SPARROW_SMS",
    smsApiKey: "mock-sparrow-key-2026",
    smsSenderId: "RestroInn",
    emailProvider: "SMTP",
    emailSender: "noreply@restroinn.com",
    smtpHost: "smtp.mailgun.org",
    smtpPort: 587,
  });

  const [maintenanceMode, setMaintenanceMode] = useState({
    enabled: false,
    message: "RestroInn is currently undergoing scheduled platform upgrades. We will be back online shortly.",
    allowedIps: ["127.0.0.1", "::1"],
  });

  // Recent audit trail & drawer
  const [recentAudits, setRecentAudits] = useState<AuditHistoryItem[]>([]);
  const [auditDrawerOpen, setAuditDrawerOpen] = useState(false);

  // Modal / Confirmation State
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [pendingKey, setPendingKey] = useState<string>("");
  const [pendingValue, setPendingValue] = useState<any>(null);
  const [pendingLabel, setPendingLabel] = useState<string>("");
  const [auditReason, setAuditReason] = useState("");
  const [saving, setSaving] = useState(false);

  // Stable guard against re-fetching and layout flashes on tab focus or session reference changes
  const hasLoadedRef = useRef(false);

  const loadSettings = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent && !hasLoadedRef.current) setLoading(true);
      else setReloading(true);

      const res = await fetch("/api/v1/super-admin/settings");
      if (res.ok) {
        const data = await res.json();
        if (data.settings?.GENERAL_CONFIG) setGeneralConfig(data.settings.GENERAL_CONFIG);
        if (data.settings?.SUBSCRIPTION_DEFAULTS) setSubDefaults(data.settings.SUBSCRIPTION_DEFAULTS);
        if (data.settings?.GATEWAY_SETTINGS) setGatewaySettings(data.settings.GATEWAY_SETTINGS);
        if (data.settings?.MAINTENANCE_MODE) setMaintenanceMode(data.settings.MAINTENANCE_MODE);
        if (data.recentAudits) setRecentAudits(data.recentAudits);
      } else {
        throw new Error("Failed to load settings");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load platform settings");
    } finally {
      setLoading(false);
      setReloading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login");
    } else if (status === "authenticated") {
      const userRole = (session?.user as any)?.role;
      if (userRole && userRole !== "SUPER_ADMIN") {
        router.push("/dashboard");
        return;
      }

      if (!hasLoadedRef.current) {
        hasLoadedRef.current = true;
        loadSettings(false);
      }
    }
  }, [status, session?.user, router, loadSettings]);

  const initiateSave = (key: string, value: any, label: string) => {
    setPendingKey(key);
    setPendingValue(value);
    setPendingLabel(label);
    setAuditReason("");
    setAuditModalOpen(true);
  };

  const confirmSave = async () => {
    if (!auditReason.trim() || auditReason.trim().length < 5) {
      toast.error("A valid administrative audit reason (min 5 characters) is required");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/v1/super-admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: pendingKey,
          value: pendingValue,
          reason: auditReason.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update configuration");

      setAuditModalOpen(false);
      toast.success(`${pendingLabel} saved and audit logged successfully`);
      loadSettings(true);
    } catch (err: any) {
      toast.error(err.message || "An error occurred while saving");
    } finally {
      setSaving(false);
    }
  };

  if (loading && !hasLoadedRef.current) {
    return (
      <div className="max-w-[1400px] mx-auto space-y-2 text-[#292320]">
        <div className="h-4 w-40 bg-[#EEE7DD] animate-pulse rounded" />
        <div className="h-7 w-64 bg-[#EEE7DD] animate-pulse rounded" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 bg-[#EEE7DD] animate-pulse rounded-lg" />
          ))}
        </div>
        <div className="h-96 bg-[#EEE7DD] animate-pulse rounded-lg" />
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto space-y-2 text-[#292320]">
      {/* 1. Breadcrumb right above header */}
      <div>
        <div className="flex items-center gap-1.5 text-xs text-[#71675E] mb-0.5">
          <Link href="/dashboard/super-admin" className="hover:text-[#6B2837] transition-colors">
            Platform
          </Link>
          <span>/</span>
          <span className="text-[#292320] font-medium">System settings</span>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[#292320]">System settings</h1>
            <p className="text-xs text-[#71675E] leading-normal">
              Configure global platform identity, subscription defaults, Nepal messaging gateways, and maintenance lockdown.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setAuditDrawerOpen(true)}
              className="px-2.5 py-1 text-xs font-semibold rounded border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] hover:bg-[#EEE7DD] transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <History className="w-3.5 h-3.5 text-[#6B2837]" />
              <span>Audit History ({recentAudits.length})</span>
            </button>

            <button
              onClick={() => loadSettings(true)}
              disabled={reloading}
              className="px-2.5 py-1 text-xs font-semibold rounded border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] hover:bg-[#EEE7DD] transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RotateCw className={`w-3.5 h-3.5 text-[#71675E] ${reloading ? "animate-spin" : ""}`} />
              <span>Reload</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Connected 4-Column Metric Strip (Padding strictly <= 7px) */}
      <div className="grid grid-cols-2 md:grid-cols-4 border border-[#D8CEC1] rounded-lg bg-[#FFFCF7] divide-x divide-y md:divide-y-0 divide-[#D8CEC1] overflow-hidden shadow-2xs">
        {/* Col 1: Platform Identity */}
        <div className="py-1.5 px-3">
          <span className="text-[11px] font-medium text-[#71675E] block leading-tight">
            Platform Identity
          </span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-xs font-bold text-[#292320] truncate">
              {generalConfig.platformName}
            </span>
            <span className="text-[10px] text-[#71675E] tabular-nums">
              ({generalConfig.timeZone.split("/")[1] || generalConfig.timeZone})
            </span>
          </div>
        </div>

        {/* Col 2: Fiscal Tax Compliance */}
        <div className="py-1.5 px-3">
          <span className="text-[11px] font-medium text-[#71675E] block leading-tight">
            Fiscal Tax Engine
          </span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-xs font-bold text-[#15803D]">
              Nepal IRD 13% VAT
            </span>
            <span className="text-[10px] text-[#71675E]">
              {generalConfig.defaultCurrency}
            </span>
          </div>
        </div>

        {/* Col 3: Messaging Gateways */}
        <div className="py-1.5 px-3">
          <span className="text-[11px] font-medium text-[#71675E] block leading-tight">
            Gateways Dispatch
          </span>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-xs font-bold text-[#6B2837]">
              {gatewaySettings.smsProvider}
            </span>
            <span className="text-[10px] text-[#71675E]">
              SMTP Active
            </span>
          </div>
        </div>

        {/* Col 4: Maintenance Lockdown */}
        <div className="py-1.5 px-3">
          <span className="text-[11px] font-medium text-[#71675E] block leading-tight">
            Maintenance Lockdown
          </span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span
              className={`text-xs font-bold uppercase px-1.5 py-0.5 rounded ${
                maintenanceMode.enabled
                  ? "bg-[#B91C1C]/10 text-[#B91C1C]"
                  : "bg-[#15803D]/10 text-[#15803D]"
              }`}
            >
              {maintenanceMode.enabled ? "ACTIVE (LOCKDOWN)" : "DISABLED (NORMAL)"}
            </span>
          </div>
        </div>
      </div>

      {/* Maintenance Mode Warning if actively engaged */}
      {maintenanceMode.enabled && (
        <div className="py-1.5 px-3 rounded-lg border border-[#F8B4B4] bg-[#FDE8E8] text-[#9C3232] flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0 text-[#9C3232]" />
            <span>
              <strong>MAINTENANCE MODE ENGAGED:</strong> Tenant workspaces are currently locked. Only authorized admin IPs can access services.
            </span>
          </div>
          <button
            onClick={() => setActiveTab("maintenance")}
            className="text-[11px] font-bold underline hover:text-[#802424]"
          >
            Manage Lockdown →
          </button>
        </div>
      )}

      {/* 3. Main Settings Container */}
      <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg overflow-hidden shadow-2xs">
        {/* Tab Navigation Strip (Padding strictly <= 7px) */}
        <div className="py-1.5 px-3 border-b border-[#D8CEC1] flex items-center gap-1 overflow-x-auto bg-[#FFFCF7]">
          {[
            { id: "general", label: "General & Branding", icon: Sliders },
            { id: "subscription", label: "Subscription Defaults", icon: CreditCard },
            { id: "gateways", label: "Gateways & SMS", icon: Radio },
            { id: "maintenance", label: "Maintenance & Lockdown", icon: ShieldAlert },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeTab === tab.id
                    ? "bg-[#6B2837] text-white"
                    : "text-[#71675E] hover:text-[#292320] hover:bg-[#EEE7DD]"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab 1: General & Branding */}
        {activeTab === "general" && (
          <div className="p-4 space-y-4">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#71675E]">
                Core Platform Identity
              </h2>
              <p className="text-xs text-[#292320] mt-0.5">
                General SaaS brand properties displayed across client portals, fiscal invoices, and notifications.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-3xl">
              <div>
                <label className="block text-xs font-medium text-[#292320] mb-1">Platform Name</label>
                <input
                  type="text"
                  value={generalConfig.platformName}
                  onChange={(e) => setGeneralConfig({ ...generalConfig, platformName: e.target.value })}
                  className="w-full text-xs px-2.5 py-1.5 rounded border border-[#D8CEC1] bg-[#F7F3EC] text-[#292320] focus:outline-none focus:border-[#6B2837]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#292320] mb-1">Support Contact Email</label>
                <input
                  type="email"
                  value={generalConfig.supportEmail}
                  onChange={(e) => setGeneralConfig({ ...generalConfig, supportEmail: e.target.value })}
                  className="w-full text-xs px-2.5 py-1.5 rounded border border-[#D8CEC1] bg-[#F7F3EC] text-[#292320] focus:outline-none focus:border-[#6B2837]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#292320] mb-1">Emergency Operations Hotline</label>
                <input
                  type="text"
                  value={generalConfig.emergencyPhone}
                  onChange={(e) => setGeneralConfig({ ...generalConfig, emergencyPhone: e.target.value })}
                  className="w-full text-xs px-2.5 py-1.5 rounded border border-[#D8CEC1] bg-[#F7F3EC] text-[#292320] focus:outline-none focus:border-[#6B2837]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#292320] mb-1">Default Platform Timezone</label>
                <input
                  type="text"
                  value={generalConfig.timeZone}
                  onChange={(e) => setGeneralConfig({ ...generalConfig, timeZone: e.target.value })}
                  className="w-full text-xs px-2.5 py-1.5 rounded border border-[#D8CEC1] bg-[#F7F3EC] text-[#292320] focus:outline-none focus:border-[#6B2837]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#292320] mb-1">Fiscal Tax Compliance Engine</label>
                <select
                  value={generalConfig.taxSystem}
                  onChange={(e) => setGeneralConfig({ ...generalConfig, taxSystem: e.target.value })}
                  className="w-full text-xs px-2.5 py-1.5 rounded border border-[#D8CEC1] bg-[#F7F3EC] text-[#292320] focus:outline-none focus:border-[#6B2837]"
                >
                  <option value="NEPAL_IRD_VAT">Nepal Inland Revenue Department (IRD 13% VAT)</option>
                  <option value="GENERAL_SALES_TAX">Standard Flat Sales Tax</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#292320] mb-1">Base Platform Currency</label>
                <input
                  type="text"
                  value={generalConfig.defaultCurrency}
                  disabled
                  className="w-full text-xs px-2.5 py-1.5 rounded border border-[#D8CEC1] bg-[#EEE7DD] text-[#71675E] cursor-not-allowed font-mono"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-[#D8CEC1] flex justify-end">
              <button
                onClick={() => initiateSave("GENERAL_CONFIG", generalConfig, "General Platform Identity")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-[#6B2837] text-white hover:bg-[#521E2A] transition-colors cursor-pointer shadow-2xs"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save General Identity</span>
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: Subscription Defaults */}
        {activeTab === "subscription" && (
          <div className="p-4 space-y-4">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#71675E]">
                Subscription & Lifecycle Policies
              </h2>
              <p className="text-xs text-[#292320] mt-0.5">
                Control trial durations, payment grace periods before suspension, and automated invoice renewal reminders.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-3xl">
              <div>
                <label className="block text-xs font-medium text-[#292320] mb-1">Free Trial Duration (Days)</label>
                <input
                  type="number"
                  min={1}
                  max={90}
                  value={subDefaults.trialDurationDays}
                  onChange={(e) => setSubDefaults({ ...subDefaults, trialDurationDays: Number(e.target.value) })}
                  className="w-full text-xs px-2.5 py-1.5 rounded border border-[#D8CEC1] bg-[#F7F3EC] text-[#292320] tabular-nums font-mono focus:outline-none focus:border-[#6B2837]"
                />
                <p className="text-[11px] text-[#71675E] mt-0.5">Default days granted when a business registration is approved.</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#292320] mb-1">Overdue Grace Period (Days)</label>
                <input
                  type="number"
                  min={0}
                  max={30}
                  value={subDefaults.gracePeriodDays}
                  onChange={(e) => setSubDefaults({ ...subDefaults, gracePeriodDays: Number(e.target.value) })}
                  className="w-full text-xs px-2.5 py-1.5 rounded border border-[#D8CEC1] bg-[#F7F3EC] text-[#292320] tabular-nums font-mono focus:outline-none focus:border-[#6B2837]"
                />
                <p className="text-[11px] text-[#71675E] mt-0.5">Avoids abruptly blocking active hotel checkout or restaurant POS.</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#292320] mb-1">Invoice Payment Term (Days)</label>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={subDefaults.invoiceDueDays}
                  onChange={(e) => setSubDefaults({ ...subDefaults, invoiceDueDays: Number(e.target.value) })}
                  className="w-full text-xs px-2.5 py-1.5 rounded border border-[#D8CEC1] bg-[#F7F3EC] text-[#292320] tabular-nums font-mono focus:outline-none focus:border-[#6B2837]"
                />
                <p className="text-[11px] text-[#71675E] mt-0.5">Standard Net-D days before a platform subscription invoice is overdue.</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#292320] mb-1">Renewal Reminder (Days Before Due)</label>
                <input
                  type="number"
                  min={1}
                  max={14}
                  value={subDefaults.autoReminderDaysBeforeDue}
                  onChange={(e) => setSubDefaults({ ...subDefaults, autoReminderDaysBeforeDue: Number(e.target.value) })}
                  className="w-full text-xs px-2.5 py-1.5 rounded border border-[#D8CEC1] bg-[#F7F3EC] text-[#292320] tabular-nums font-mono focus:outline-none focus:border-[#6B2837]"
                />
                <p className="text-[11px] text-[#71675E] mt-0.5">Triggers notification banner and email to tenant owner.</p>
              </div>
            </div>

            <div className="pt-3 border-t border-[#D8CEC1] flex justify-end">
              <button
                onClick={() => initiateSave("SUBSCRIPTION_DEFAULTS", subDefaults, "Subscription Policies")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-[#6B2837] text-white hover:bg-[#521E2A] transition-colors cursor-pointer shadow-2xs"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Subscription Policies</span>
              </button>
            </div>
          </div>
        )}

        {/* Tab 3: Gateways & SMS */}
        {activeTab === "gateways" && (
          <div className="p-4 space-y-4">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#71675E]">
                Messaging & Notification Gateways
              </h2>
              <p className="text-xs text-[#292320] mt-0.5">
                Connect Nepal Sparrow SMS API and platform transactional SMTP configurations.
              </p>
            </div>

            <div className="space-y-3 max-w-3xl">
              {/* Sparrow SMS */}
              <div className="p-3 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] space-y-2">
                <h3 className="text-xs font-bold text-[#292320] flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-[#6B2837]" />
                  Sparrow SMS Gateway (Nepal)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-medium text-[#71675E] mb-0.5">Provider</label>
                    <input
                      type="text"
                      value={gatewaySettings.smsProvider}
                      disabled
                      className="w-full text-xs px-2.5 py-1.5 rounded border border-[#D8CEC1] bg-[#EEE7DD] text-[#71675E]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[#292320] mb-0.5">Sender ID (Sender Mask)</label>
                    <input
                      type="text"
                      value={gatewaySettings.smsSenderId}
                      onChange={(e) => setGatewaySettings({ ...gatewaySettings, smsSenderId: e.target.value })}
                      className="w-full text-xs px-2.5 py-1.5 rounded border border-[#D8CEC1] bg-[#F7F3EC] text-[#292320] focus:outline-none focus:border-[#6B2837]"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-medium text-[#292320] mb-0.5">Sparrow SMS Secret Token</label>
                    <input
                      type="password"
                      value={gatewaySettings.smsApiKey}
                      onChange={(e) => setGatewaySettings({ ...gatewaySettings, smsApiKey: e.target.value })}
                      className="w-full text-xs px-2.5 py-1.5 rounded border border-[#D8CEC1] bg-[#F7F3EC] text-[#292320] focus:outline-none focus:border-[#6B2837]"
                    />
                  </div>
                </div>
              </div>

              {/* SMTP Email */}
              <div className="p-3 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] space-y-2">
                <h3 className="text-xs font-bold text-[#292320] flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-[#6B2837]" />
                  Transactional SMTP Email Gateway
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-medium text-[#292320] mb-0.5">SMTP Host</label>
                    <input
                      type="text"
                      value={gatewaySettings.smtpHost}
                      onChange={(e) => setGatewaySettings({ ...gatewaySettings, smtpHost: e.target.value })}
                      className="w-full text-xs px-2.5 py-1.5 rounded border border-[#D8CEC1] bg-[#F7F3EC] text-[#292320] focus:outline-none focus:border-[#6B2837]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[#292320] mb-0.5">Port</label>
                    <input
                      type="number"
                      value={gatewaySettings.smtpPort}
                      onChange={(e) => setGatewaySettings({ ...gatewaySettings, smtpPort: Number(e.target.value) })}
                      className="w-full text-xs px-2.5 py-1.5 rounded border border-[#D8CEC1] bg-[#F7F3EC] text-[#292320] tabular-nums font-mono focus:outline-none focus:border-[#6B2837]"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-medium text-[#292320] mb-0.5">From Sender Address</label>
                    <input
                      type="email"
                      value={gatewaySettings.emailSender}
                      onChange={(e) => setGatewaySettings({ ...gatewaySettings, emailSender: e.target.value })}
                      className="w-full text-xs px-2.5 py-1.5 rounded border border-[#D8CEC1] bg-[#F7F3EC] text-[#292320] focus:outline-none focus:border-[#6B2837]"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-[#D8CEC1] flex justify-end">
              <button
                onClick={() => initiateSave("GATEWAY_SETTINGS", gatewaySettings, "Gateway & SMS Settings")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-[#6B2837] text-white hover:bg-[#521E2A] transition-colors cursor-pointer shadow-2xs"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Gateways</span>
              </button>
            </div>
          </div>
        )}

        {/* Tab 4: Platform Maintenance Mode & Lockdown */}
        {activeTab === "maintenance" && (
          <div className="p-4 space-y-4">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#71675E]">
                Maintenance Mode & Access Lockdown
              </h2>
              <p className="text-xs text-[#292320] mt-0.5">
                Temporarily take client portals and public reservation engines offline during major database schema migrations or emergencies.
              </p>
            </div>

            <div className="p-3 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] flex items-center justify-between max-w-3xl">
              <div>
                <div className="text-xs font-bold text-[#292320]">Master Maintenance Mode Switch</div>
                <div className="text-[11px] text-[#71675E] mt-0.5">
                  {maintenanceMode.enabled
                    ? "Status: ACTIVE (Non-admin users cannot access workspace routes)"
                    : "Status: DISABLED (All tenant operations normal)"}
                </div>
              </div>
              <button
                onClick={() =>
                  setMaintenanceMode({
                    ...maintenanceMode,
                    enabled: !maintenanceMode.enabled,
                  })
                }
                className={`px-3 py-1.5 text-xs font-bold rounded transition-colors cursor-pointer ${
                  maintenanceMode.enabled
                    ? "bg-[#9C3232] text-white hover:bg-[#802424]"
                    : "bg-[#03543F] text-white hover:bg-[#023E2E]"
                }`}
              >
                {maintenanceMode.enabled ? "Disengage Maintenance Mode" : "Engage Maintenance Mode"}
              </button>
            </div>

            <div className="space-y-3 max-w-3xl">
              <div>
                <label className="block text-xs font-medium text-[#292320] mb-1">
                  Maintenance Notice Message (Rendered on Tenant Screens)
                </label>
                <textarea
                  rows={3}
                  value={maintenanceMode.message}
                  onChange={(e) => setMaintenanceMode({ ...maintenanceMode, message: e.target.value })}
                  className="w-full text-xs px-2.5 py-1.5 rounded border border-[#D8CEC1] bg-[#F7F3EC] text-[#292320] focus:outline-none focus:border-[#6B2837]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#292320] mb-1">
                  Bypass IP Addresses (Comma-Separated)
                </label>
                <input
                  type="text"
                  value={maintenanceMode.allowedIps.join(", ")}
                  onChange={(e) =>
                    setMaintenanceMode({
                      ...maintenanceMode,
                      allowedIps: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                    })
                  }
                  placeholder="127.0.0.1, ::1, 103.10.20.30"
                  className="w-full text-xs px-2.5 py-1.5 rounded border border-[#D8CEC1] bg-[#F7F3EC] text-[#292320] font-mono focus:outline-none focus:border-[#6B2837]"
                />
                <p className="text-[11px] text-[#71675E] mt-0.5">
                  Requests originating from these IP addresses bypass the maintenance lockdown screen.
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-[#D8CEC1] flex justify-end">
              <button
                onClick={() => initiateSave("MAINTENANCE_MODE", maintenanceMode, "Maintenance Lockdown State")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-[#6B2837] text-white hover:bg-[#521E2A] transition-colors cursor-pointer shadow-2xs"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Maintenance State</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 4. Mandatory Audit Reason Modal */}
      {auditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="w-full max-w-md bg-[#FFFCF7] rounded-lg border border-[#D8CEC1] p-4 shadow-xl space-y-3">
            <div className="flex items-center justify-between border-b border-[#EEE7DD] pb-2">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-[#6B2837]" />
                <h3 className="text-xs font-bold text-[#292320]">Administrative Confirmation Required</h3>
              </div>
              <button
                onClick={() => setAuditModalOpen(false)}
                className="text-[#71675E] hover:text-[#292320] p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <p className="text-xs text-[#71675E] leading-relaxed">
              Modifying <strong className="text-[#292320]">{pendingLabel}</strong> directly impacts platform-wide operations. A mandatory administrative justification is logged to the immutable audit trail.
            </p>

            <div>
              <label className="block text-xs font-semibold text-[#6B2837] mb-1">
                Mandatory Audit Justification (min 5 chars) *
              </label>
              <input
                type="text"
                value={auditReason}
                onChange={(e) => setAuditReason(e.target.value)}
                placeholder="e.g. Updating trial duration policy to 14 days for Q1"
                className="w-full text-xs px-2.5 py-1.5 rounded border border-[#D8CEC1] bg-[#F7F3EC] text-[#292320] focus:outline-none focus:border-[#6B2837]"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#EEE7DD]">
              <button
                type="button"
                onClick={() => setAuditModalOpen(false)}
                className="px-2.5 py-1 text-xs font-medium rounded border border-[#D8CEC1] text-[#71675E] hover:bg-[#EEE7DD]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving || auditReason.trim().length < 5}
                onClick={confirmSave}
                className="px-3 py-1 text-xs font-semibold rounded bg-[#6B2837] text-white hover:bg-[#521E2A] transition-colors disabled:opacity-50"
              >
                {saving ? "Applying..." : "Apply & Log Audit"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Right-Side Slide-Over Drawer for Recent Settings Audit Trail */}
      {auditDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
            onClick={() => setAuditDrawerOpen(false)}
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen sm:w-[580px] md:w-[720px] lg:w-[860px] max-w-[95vw] bg-[#FFFCF7] border-l border-[#D8CEC1] flex flex-col shadow-2xl">
              {/* Header */}
              <div className="py-2.5 px-4 border-b border-[#D8CEC1] flex items-center justify-between bg-[#FFFCF7]">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#6B2837]/10 text-[#6B2837]">
                    IMMUTABLE AUDIT TRAIL
                  </span>
                  <h2 className="text-sm font-bold text-[#292320]">
                    Settings Modification Log
                  </h2>
                </div>
                <button
                  onClick={() => setAuditDrawerOpen(false)}
                  className="p-1 text-[#71675E] hover:text-[#292320] rounded hover:bg-[#EEE7DD] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Sub-bar */}
              <div className="py-1.5 px-4 bg-[#F7F3EC] border-b border-[#D8CEC1] text-xs flex items-center justify-between text-[#71675E]">
                <span>Logged super admin policy mutations with mandatory administrative reasons</span>
                <span className="tabular-nums font-mono text-[11px]">{recentAudits.length} events recorded</span>
              </div>

              {/* Log List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {recentAudits.length === 0 ? (
                  <div className="py-12 text-center text-xs text-[#71675E]">
                    No settings mutations logged yet.
                  </div>
                ) : (
                  recentAudits.map((a) => (
                    <div
                      key={a.id}
                      className="p-3 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-[#6B2837] text-[11px]">
                          {a.action}
                        </span>
                        <span className="text-[10px] text-[#71675E] tabular-nums font-mono">
                          {new Date(a.createdAt).toLocaleString()}
                        </span>
                      </div>

                      <div className="text-[#292320] leading-snug">
                        <strong className="text-[#71675E] text-[11px]">Reason: </strong>
                        {a.reason}
                      </div>

                      <div className="flex items-center gap-3 text-[10px] text-[#71675E] pt-1 border-t border-[#EEE7DD]">
                        <span>Actor: <strong>{a.userName}</strong> ({a.role})</span>
                        <span>•</span>
                        <span>IP: <code className="font-mono">{a.ipAddress}</code></span>
                      </div>

                      {/* State transition diff if available */}
                      {a.afterState && (
                        <div className="mt-2 pt-2 border-t border-[#EEE7DD]">
                          <span className="text-[10px] font-bold text-[#71675E] uppercase block mb-1">
                            Mutation State (Payload)
                          </span>
                          <pre className="p-2 rounded bg-[#F7F3EC] border border-[#D8CEC1] text-[10px] font-mono overflow-x-auto text-[#292320]">
                            {JSON.stringify(a.afterState, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              <div className="py-2.5 px-4 border-t border-[#D8CEC1] flex items-center justify-between bg-[#FFFCF7]">
                <Link
                  href="/dashboard/super-admin/activity-logs"
                  className="text-xs font-semibold text-[#6B2837] hover:underline flex items-center gap-1"
                >
                  <span>Open Full Platform Audit Log</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>

                <button
                  onClick={() => setAuditDrawerOpen(false)}
                  className="px-3 py-1.5 rounded border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-[#292320] text-xs font-semibold transition-colors cursor-pointer"
                >
                  Close Drawer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
