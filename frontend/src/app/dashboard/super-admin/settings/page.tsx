"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
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
} from "lucide-react";

export default function PlatformSettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<"general" | "subscription" | "gateways" | "maintenance">("general");
  const [loading, setLoading] = useState(true);

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

  // Modal / Feedback state
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [pendingKey, setPendingKey] = useState<string>("");
  const [pendingValue, setPendingValue] = useState<any>(null);
  const [auditReason, setAuditReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login");
    } else if (session?.user && (session.user as any).role !== "SUPER_ADMIN") {
      router.push("/dashboard");
    } else if (status === "authenticated") {
      loadSettings();
    }
  }, [status, session, router]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/super-admin/settings");
      if (res.ok) {
        const data = await res.json();
        if (data.settings.GENERAL_CONFIG) setGeneralConfig(data.settings.GENERAL_CONFIG);
        if (data.settings.SUBSCRIPTION_DEFAULTS) setSubDefaults(data.settings.SUBSCRIPTION_DEFAULTS);
        if (data.settings.GATEWAY_SETTINGS) setGatewaySettings(data.settings.GATEWAY_SETTINGS);
        if (data.settings.MAINTENANCE_MODE) setMaintenanceMode(data.settings.MAINTENANCE_MODE);
      }
    } catch (err) {
      console.error("Failed to load settings:", err);
    } finally {
      setLoading(false);
    }
  };

  const initiateSave = (key: string, value: any) => {
    setPendingKey(key);
    setPendingValue(value);
    setAuditReason("");
    setAuditModalOpen(true);
  };

  const confirmSave = async () => {
    if (!auditReason.trim() || auditReason.trim().length < 5) {
      alert("A valid administrative audit reason (min 5 characters) is required");
      return;
    }

    setSaving(true);
    setFeedback(null);
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
      setFeedback({ type: "success", text: "Settings saved and audit logged successfully" });
      setTimeout(() => setFeedback(null), 4000);
      loadSettings();
    } catch (err: any) {
      setFeedback({ type: "error", text: err.message || "An error occurred" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-[#D8CEC1]">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider font-semibold text-[#71675E]">Platform Administration</span>
            <span className="text-[#D8CEC1]">•</span>
            <span className="text-xs uppercase tracking-wider font-semibold text-[#6B2837]">Configuration</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#292320] mt-1">Platform Settings & Control</h1>
          <p className="text-sm text-[#71675E] mt-0.5">
            Configure global SaaS policies, subscription rules, Nepal SMS gateways, and platform maintenance mode.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={loadSettings}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] hover:bg-[#F7F3EC] transition-colors cursor-pointer"
          >
            <RotateCw className="w-3.5 h-3.5 text-[#71675E]" />
            Reload
          </button>
        </div>
      </div>

      {/* Feedback banner */}
      {feedback && (
        <div
          className={`p-3.5 rounded-lg border text-xs flex items-center gap-2.5 ${
            feedback.type === "success"
              ? "bg-[#DEF7EC] border-[#BCF0DA] text-[#03543F]"
              : "bg-[#FDE8E8] border-[#F8B4B4] text-[#9C3232]"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Maintenance Mode Alert Banner if active */}
      {maintenanceMode.enabled && (
        <div className="p-4 rounded-lg border border-[#F8B4B4] bg-[#FDE8E8] text-[#9C3232] flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 mt-0.5 shrink-0" />
          <div>
            <span className="font-bold text-xs">MAINTENANCE MODE IS ACTIVELY ENGAGED</span>
            <p className="text-xs mt-0.5 leading-relaxed">
              Client businesses and customer portals are currently locked with the maintenance notice. Only authorized admin IPs can access services.
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-[#D8CEC1] gap-6 text-xs font-semibold">
        <button
          onClick={() => setActiveTab("general")}
          className={`pb-3 transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === "general"
              ? "border-b-2 border-[#6B2837] text-[#6B2837]"
              : "text-[#71675E] hover:text-[#292320]"
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          General & Branding
        </button>

        <button
          onClick={() => setActiveTab("subscription")}
          className={`pb-3 transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === "subscription"
              ? "border-b-2 border-[#6B2837] text-[#6B2837]"
              : "text-[#71675E] hover:text-[#292320]"
          }`}
        >
          <CreditCard className="w-3.5 h-3.5" />
          Subscription Defaults & Billing
        </button>

        <button
          onClick={() => setActiveTab("gateways")}
          className={`pb-3 transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === "gateways"
              ? "border-b-2 border-[#6B2837] text-[#6B2837]"
              : "text-[#71675E] hover:text-[#292320]"
          }`}
        >
          <Radio className="w-3.5 h-3.5" />
          Gateways & SMS
        </button>

        <button
          onClick={() => setActiveTab("maintenance")}
          className={`pb-3 transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === "maintenance"
              ? "border-b-2 border-[#6B2837] text-[#6B2837]"
              : "text-[#71675E] hover:text-[#292320]"
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          Platform Maintenance & Lockdown
        </button>
      </div>

      {/* Tab 1: General & Branding */}
      {activeTab === "general" && (
        <div className="p-6 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] space-y-6">
          <div>
            <h2 className="text-sm font-bold text-[#292320]">Core Platform Identity</h2>
            <p className="text-xs text-[#71675E] mt-0.5">
              General SaaS brand properties displayed across client portals, fiscal invoices, and notifications.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-3xl">
            <div>
              <label className="block text-xs font-semibold text-[#292320] mb-1">Platform Name</label>
              <input
                type="text"
                value={generalConfig.platformName}
                onChange={(e) => setGeneralConfig({ ...generalConfig, platformName: e.target.value })}
                className="w-full text-xs px-3 py-2 rounded-md border border-[#D8CEC1] bg-[#F7F3EC] text-[#292320] focus:outline-none focus:border-[#6B2837]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#292320] mb-1">Support Contact Email</label>
              <input
                type="email"
                value={generalConfig.supportEmail}
                onChange={(e) => setGeneralConfig({ ...generalConfig, supportEmail: e.target.value })}
                className="w-full text-xs px-3 py-2 rounded-md border border-[#D8CEC1] bg-[#F7F3EC] text-[#292320] focus:outline-none focus:border-[#6B2837]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#292320] mb-1">Emergency Operations Hotline</label>
              <input
                type="text"
                value={generalConfig.emergencyPhone}
                onChange={(e) => setGeneralConfig({ ...generalConfig, emergencyPhone: e.target.value })}
                className="w-full text-xs px-3 py-2 rounded-md border border-[#D8CEC1] bg-[#F7F3EC] text-[#292320] focus:outline-none focus:border-[#6B2837]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#292320] mb-1">Default Platform Timezone</label>
              <input
                type="text"
                value={generalConfig.timeZone}
                onChange={(e) => setGeneralConfig({ ...generalConfig, timeZone: e.target.value })}
                className="w-full text-xs px-3 py-2 rounded-md border border-[#D8CEC1] bg-[#F7F3EC] text-[#292320] focus:outline-none focus:border-[#6B2837]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#292320] mb-1">Fiscal Tax Compliance Engine</label>
              <select
                value={generalConfig.taxSystem}
                onChange={(e) => setGeneralConfig({ ...generalConfig, taxSystem: e.target.value })}
                className="w-full text-xs px-3 py-2 rounded-md border border-[#D8CEC1] bg-[#F7F3EC] text-[#292320] focus:outline-none focus:border-[#6B2837]"
              >
                <option value="NEPAL_IRD_VAT">Nepal Inland Revenue Department (IRD 13% VAT)</option>
                <option value="GENERAL_SALES_TAX">Standard Flat Sales Tax</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#292320] mb-1">Base Currency</label>
              <input
                type="text"
                value={generalConfig.defaultCurrency}
                disabled
                className="w-full text-xs px-3 py-2 rounded-md border border-[#D8CEC1] bg-[#EEE7DD] text-[#71675E] cursor-not-allowed"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-[#D8CEC1] flex justify-end">
            <button
              onClick={() => initiateSave("GENERAL_CONFIG", generalConfig)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-md bg-[#6B2837] text-[#FFFCF7] hover:bg-[#521E2A] transition-colors cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              Save General Identity
            </button>
          </div>
        </div>
      )}

      {/* Tab 2: Subscription Defaults */}
      {activeTab === "subscription" && (
        <div className="p-6 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] space-y-6">
          <div>
            <h2 className="text-sm font-bold text-[#292320]">Subscription & Lifecycle Policies</h2>
            <p className="text-xs text-[#71675E] mt-0.5">
              Control trial durations, payment grace periods before suspension, and automated invoice renewal reminders.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-3xl">
            <div>
              <label className="block text-xs font-semibold text-[#292320] mb-1">Free Trial Duration (Days)</label>
              <input
                type="number"
                min={1}
                max={90}
                value={subDefaults.trialDurationDays}
                onChange={(e) => setSubDefaults({ ...subDefaults, trialDurationDays: Number(e.target.value) })}
                className="w-full text-xs px-3 py-2 rounded-md border border-[#D8CEC1] bg-[#F7F3EC] text-[#292320] tabular-nums focus:outline-none focus:border-[#6B2837]"
              />
              <p className="text-[11px] text-[#71675E] mt-0.5">Default days granted when a business registration is approved.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#292320] mb-1">Overdue Grace Period (Days)</label>
              <input
                type="number"
                min={0}
                max={30}
                value={subDefaults.gracePeriodDays}
                onChange={(e) => setSubDefaults({ ...subDefaults, gracePeriodDays: Number(e.target.value) })}
                className="w-full text-xs px-3 py-2 rounded-md border border-[#D8CEC1] bg-[#F7F3EC] text-[#292320] tabular-nums focus:outline-none focus:border-[#6B2837]"
              />
              <p className="text-[11px] text-[#71675E] mt-0.5">Avoids abruptly blocking active hotel checkout or restaurant POS.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#292320] mb-1">Invoice Payment Term (Days)</label>
              <input
                type="number"
                min={1}
                max={60}
                value={subDefaults.invoiceDueDays}
                onChange={(e) => setSubDefaults({ ...subDefaults, invoiceDueDays: Number(e.target.value) })}
                className="w-full text-xs px-3 py-2 rounded-md border border-[#D8CEC1] bg-[#F7F3EC] text-[#292320] tabular-nums focus:outline-none focus:border-[#6B2837]"
              />
              <p className="text-[11px] text-[#71675E] mt-0.5">Standard Net-D days before a platform subscription invoice is overdue.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#292320] mb-1">Renewal Reminder (Days Before Expiry)</label>
              <input
                type="number"
                min={1}
                max={14}
                value={subDefaults.autoReminderDaysBeforeDue}
                onChange={(e) => setSubDefaults({ ...subDefaults, autoReminderDaysBeforeDue: Number(e.target.value) })}
                className="w-full text-xs px-3 py-2 rounded-md border border-[#D8CEC1] bg-[#F7F3EC] text-[#292320] tabular-nums focus:outline-none focus:border-[#6B2837]"
              />
              <p className="text-[11px] text-[#71675E] mt-0.5">Triggers notification banner and email to tenant owner.</p>
            </div>
          </div>

          <div className="pt-4 border-t border-[#D8CEC1] flex justify-end">
            <button
              onClick={() => initiateSave("SUBSCRIPTION_DEFAULTS", subDefaults)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-md bg-[#6B2837] text-[#FFFCF7] hover:bg-[#521E2A] transition-colors cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              Save Subscription Rules
            </button>
          </div>
        </div>
      )}

      {/* Tab 3: Gateways & SMS */}
      {activeTab === "gateways" && (
        <div className="p-6 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] space-y-6">
          <div>
            <h2 className="text-sm font-bold text-[#292320]">Messaging & Notification Gateways</h2>
            <p className="text-xs text-[#71675E] mt-0.5">
              Connect Nepal Sparrow SMS API and platform transactional SMTP configurations.
            </p>
          </div>

          <div className="space-y-4 max-w-3xl">
            <div className="p-4 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] space-y-3">
              <h3 className="text-xs font-bold text-[#292320] flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-[#6B2837]" />
                Sparrow SMS Gateway (Nepal)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#292320] mb-1">Provider</label>
                  <input
                    type="text"
                    value={gatewaySettings.smsProvider}
                    disabled
                    className="w-full text-xs px-3 py-1.5 rounded-md border border-[#D8CEC1] bg-[#EEE7DD] text-[#71675E]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#292320] mb-1">Sender ID (Sender Mask)</label>
                  <input
                    type="text"
                    value={gatewaySettings.smsSenderId}
                    onChange={(e) => setGatewaySettings({ ...gatewaySettings, smsSenderId: e.target.value })}
                    className="w-full text-xs px-3 py-1.5 rounded-md border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] focus:outline-none focus:border-[#6B2837]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-[#292320] mb-1">Sparrow SMS Secret Token</label>
                  <input
                    type="password"
                    value={gatewaySettings.smsApiKey}
                    onChange={(e) => setGatewaySettings({ ...gatewaySettings, smsApiKey: e.target.value })}
                    className="w-full text-xs px-3 py-1.5 rounded-md border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] focus:outline-none focus:border-[#6B2837]"
                  />
                </div>
              </div>
            </div>

            <div className="p-4 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] space-y-3">
              <h3 className="text-xs font-bold text-[#292320] flex items-center gap-2">
                <Mail className="w-4 h-4 text-[#6B2837]" />
                Transactional SMTP Email Gateway
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#292320] mb-1">SMTP Host</label>
                  <input
                    type="text"
                    value={gatewaySettings.smtpHost}
                    onChange={(e) => setGatewaySettings({ ...gatewaySettings, smtpHost: e.target.value })}
                    className="w-full text-xs px-3 py-1.5 rounded-md border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] focus:outline-none focus:border-[#6B2837]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#292320] mb-1">Port</label>
                  <input
                    type="number"
                    value={gatewaySettings.smtpPort}
                    onChange={(e) => setGatewaySettings({ ...gatewaySettings, smtpPort: Number(e.target.value) })}
                    className="w-full text-xs px-3 py-1.5 rounded-md border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] tabular-nums focus:outline-none focus:border-[#6B2837]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-[#292320] mb-1">From Sender Address</label>
                  <input
                    type="email"
                    value={gatewaySettings.emailSender}
                    onChange={(e) => setGatewaySettings({ ...gatewaySettings, emailSender: e.target.value })}
                    className="w-full text-xs px-3 py-1.5 rounded-md border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] focus:outline-none focus:border-[#6B2837]"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-[#D8CEC1] flex justify-end">
            <button
              onClick={() => initiateSave("GATEWAY_SETTINGS", gatewaySettings)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-md bg-[#6B2837] text-[#FFFCF7] hover:bg-[#521E2A] transition-colors cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              Save Gateways
            </button>
          </div>
        </div>
      )}

      {/* Tab 4: Platform Maintenance Mode & Lockdown */}
      {activeTab === "maintenance" && (
        <div className="p-6 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] space-y-6">
          <div>
            <h2 className="text-sm font-bold text-[#292320]">Maintenance Mode & Access Lockdown</h2>
            <p className="text-xs text-[#71675E] mt-0.5">
              Temporarily take client portals and public reservation engines offline during major database schema migrations or emergencies.
            </p>
          </div>

          <div className="p-4 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] flex items-center justify-between max-w-3xl">
            <div>
              <div className="text-xs font-bold text-[#292320]">Master Maintenance Mode Switch</div>
              <div className="text-xs text-[#71675E] mt-0.5">
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
              className={`px-4 py-2 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                maintenanceMode.enabled
                  ? "bg-[#9C3232] text-[#FFFCF7] hover:bg-[#802424]"
                  : "bg-[#03543F] text-[#FFFCF7] hover:bg-[#023E2E]"
              }`}
            >
              {maintenanceMode.enabled ? "Disengage Maintenance Mode" : "Engage Maintenance Mode"}
            </button>
          </div>

          <div className="space-y-4 max-w-3xl">
            <div>
              <label className="block text-xs font-semibold text-[#292320] mb-1">
                Maintenance Notice Message (Rendered on Tenant Screens)
              </label>
              <textarea
                rows={3}
                value={maintenanceMode.message}
                onChange={(e) => setMaintenanceMode({ ...maintenanceMode, message: e.target.value })}
                className="w-full text-xs px-3 py-2 rounded-md border border-[#D8CEC1] bg-[#F7F3EC] text-[#292320] focus:outline-none focus:border-[#6B2837]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#292320] mb-1">
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
                className="w-full text-xs px-3 py-2 rounded-md border border-[#D8CEC1] bg-[#F7F3EC] text-[#292320] focus:outline-none focus:border-[#6B2837]"
              />
              <p className="text-[11px] text-[#71675E] mt-0.5">
                Requests originating from these IP addresses bypass the maintenance lockdown screen.
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-[#D8CEC1] flex justify-end">
            <button
              onClick={() => initiateSave("MAINTENANCE_MODE", maintenanceMode)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-md bg-[#6B2837] text-[#FFFCF7] hover:bg-[#521E2A] transition-colors cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              Save Maintenance State
            </button>
          </div>
        </div>
      )}

      {/* Mandatory Audit Reason Dialog */}
      {auditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="w-full max-w-md bg-[#FFFCF7] rounded-lg border border-[#D8CEC1] p-5 shadow-xl space-y-4">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-[#6B2837]" />
              <h3 className="text-sm font-bold text-[#292320]">Administrative Confirmation Required</h3>
            </div>
            <p className="text-xs text-[#71675E]">
              Modifying platform-level configurations directly impacts all client businesses on RestroInn. Please provide a clear audit trail rationale.
            </p>

            <div>
              <label className="block text-xs font-semibold text-[#6B2837] mb-1">
                Audit Reason (min 5 characters) *
              </label>
              <input
                type="text"
                value={auditReason}
                onChange={(e) => setAuditReason(e.target.value)}
                placeholder="e.g. Updating trial duration policy to 14 days for Q1"
                className="w-full text-xs px-3 py-2 rounded-md border border-[#D8CEC1] bg-[#F7F3EC] text-[#292320] focus:outline-none focus:border-[#6B2837]"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAuditModalOpen(false)}
                className="px-3 py-1.5 text-xs font-medium rounded-md border border-[#D8CEC1] text-[#71675E]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving || auditReason.trim().length < 5}
                onClick={confirmSave}
                className="px-3 py-1.5 text-xs font-semibold rounded-md bg-[#6B2837] text-[#FFFCF7] hover:bg-[#521E2A] disabled:opacity-50"
              >
                {saving ? "Saving..." : "Apply & Log Audit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
