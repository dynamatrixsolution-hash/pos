"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Settings,
  Mail,
  Database,
  Coins,
  CheckCircle,
  AlertTriangle,
  Building,
  Key,
} from "lucide-react";

interface SMTPConfig {
  host: string;
  port: number;
  user: string;
  encryption: string;
}

interface BackupConfig {
  enabled: boolean;
  frequency: string;
  retentionDays: number;
  destination: string;
}

interface GeneralConfig {
  name: string;
  phone: string;
  email: string;
  address: string;
  taxName: string;
  defaultRate: number;
}

export default function PlatformSettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<"general" | "smtp" | "backups">("general");
  const [smtp, setSmtp] = useState<SMTPConfig | null>(null);
  const [backups, setBackups] = useState<BackupConfig | null>(null);
  const [general, setGeneral] = useState<GeneralConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errMsg, setErrMsg] = useState("");

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
        setSmtp(data.smtp);
        setBackups(data.backups);
        setGeneral(data.general);
      }
    } catch (err) {
      console.error("Load platform settings error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrMsg("");
    setSuccessMsg("");
    try {
      const res = await fetch("/api/v1/super-admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ smtp, backups, general }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save settings");
      }

      setSuccessMsg("Platform settings saved successfully");
      loadSettings();
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err: any) {
      setErrMsg(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent mx-auto" />
          <p className="text-xs text-muted-foreground">Syncing platform parameters...</p>
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
            <Settings className="h-5.5 w-5.5 text-blue-600" /> Platform Settings
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage global SMTP mail configurations, default database automated backup triggers, and metadata.
          </p>
        </div>
      </div>

      {/* 2. Messages */}
      {successMsg && (
        <div className="p-3 bg-emerald-50 text-emerald-600 text-xs rounded-xl font-bold border border-emerald-100 flex items-center gap-2">
          <CheckCircle className="h-4.5 w-4.5 flex-shrink-0" /> {successMsg}
        </div>
      )}

      {errMsg && (
        <div className="p-3 bg-red-50 text-red-650 text-xs rounded-xl font-bold border border-red-100 flex items-center gap-2">
          <AlertTriangle className="h-4.5 w-4.5 flex-shrink-0" /> {errMsg}
        </div>
      )}

      {/* 3. Tab selection */}
      <div className="flex border-b border-slate-200 gap-6">
        <button
          onClick={() => setActiveTab("general")}
          className={`pb-3 text-xs font-bold transition-all border-b-2 uppercase tracking-wider cursor-pointer ${
            activeTab === "general" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-450 hover:text-slate-700"
          }`}
        >
          General Configuration
        </button>
        <button
          onClick={() => setActiveTab("smtp")}
          className={`pb-3 text-xs font-bold transition-all border-b-2 uppercase tracking-wider cursor-pointer ${
            activeTab === "smtp" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-450 hover:text-slate-700"
          }`}
        >
          SMTP Mail Gateway
        </button>
        <button
          onClick={() => setActiveTab("backups")}
          className={`pb-3 text-xs font-bold transition-all border-b-2 uppercase tracking-wider cursor-pointer ${
            activeTab === "backups" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-450 hover:text-slate-700"
          }`}
        >
          Automated Backups
        </button>
      </div>

      {/* 4. SETTINGS FORM CONTAINER */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-6 max-w-xl mx-auto shadow-sm">
        <form onSubmit={handleSaveSettings} className="space-y-6 text-xs font-semibold">
          
          {/* GENERAL TAB */}
          {activeTab === "general" && general && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-1.5">
                <Building className="h-4.5 w-4.5 text-blue-600" /> Platform Details
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-450 uppercase">Platform Name</label>
                  <input
                    type="text"
                    value={general.name}
                    onChange={(e) => setGeneral({ ...general, name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-450 uppercase">Contact Email</label>
                  <input
                    type="email"
                    value={general.email}
                    onChange={(e) => setGeneral({ ...general, email: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-450 uppercase">Support Phone</label>
                  <input
                    type="text"
                    value={general.phone}
                    onChange={(e) => setGeneral({ ...general, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-450 uppercase">HQ address office</label>
                  <input
                    type="text"
                    value={general.address}
                    onChange={(e) => setGeneral({ ...general, address: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white"
                  />
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4 grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-450 uppercase">Default Tax Name</label>
                  <input
                    type="text"
                    value={general.taxName}
                    onChange={(e) => setGeneral({ ...general, taxName: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-450 uppercase">Default Rate (%)</label>
                  <input
                    type="number"
                    value={general.defaultRate}
                    onChange={(e) => setGeneral({ ...general, defaultRate: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* SMTP TAB */}
          {activeTab === "smtp" && smtp && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-1.5">
                <Mail className="h-4.5 w-4.5 text-blue-600" /> Outbound Mail Transfer Protocol
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-450 uppercase">SMTP Hostname</label>
                  <input
                    type="text"
                    value={smtp.host}
                    onChange={(e) => setSmtp({ ...smtp, host: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-450 uppercase">SMTP Port</label>
                  <input
                    type="number"
                    value={smtp.port}
                    onChange={(e) => setSmtp({ ...smtp, port: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-450 uppercase">SMTP User</label>
                  <input
                    type="text"
                    value={smtp.user}
                    onChange={(e) => setSmtp({ ...smtp, user: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-450 uppercase">SMTP Password</label>
                  <div className="relative">
                    <Key className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="password"
                      placeholder="••••••••••••••••"
                      className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1 w-1/2">
                <label className="text-[10px] text-slate-450 uppercase">Encryption security</label>
                <select
                  value={smtp.encryption}
                  onChange={(e) => setSmtp({ ...smtp, encryption: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none cursor-pointer"
                >
                  <option value="TLS">TLS Secure Connection</option>
                  <option value="SSL">SSL Secure Connection</option>
                  <option value="NONE">No Encryption Protocol</option>
                </select>
              </div>
            </div>
          )}

          {/* BACKUPS TAB */}
          {activeTab === "backups" && backups && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-1.5">
                <Database className="h-4.5 w-4.5 text-blue-600" /> Database Backup Strategies
              </h3>

              <label className="flex justify-between items-center p-3 border border-slate-150 hover:bg-slate-50 rounded-xl cursor-pointer">
                <div>
                  <span className="text-xs font-bold text-slate-750">Database Automated Backups</span>
                  <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Toggle backup execution schedulers on/off.</p>
                </div>
                <input
                  type="checkbox"
                  checked={backups.enabled}
                  onChange={(e) => setBackups({ ...backups, enabled: e.target.checked })}
                  className="h-4.5 w-4.5 text-blue-600 rounded border-slate-300"
                />
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-450 uppercase">Backup frequency</label>
                  <select
                    value={backups.frequency}
                    onChange={(e) => setBackups({ ...backups, frequency: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none cursor-pointer"
                  >
                    <option value="DAILY">Once every 24 hours</option>
                    <option value="WEEKLY">Once every 7 days</option>
                    <option value="HOURLY">Once every 1 hour (Enterprise)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-450 uppercase">Retention logs (days)</label>
                  <input
                    type="number"
                    value={backups.retentionDays}
                    onChange={(e) => setBackups({ ...backups, retentionDays: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white"
                  />
                </div>
              </div>

              <div className="space-y-1 w-1/2">
                <label className="text-[10px] text-slate-450 uppercase">Cloud storage destination</label>
                <select
                  value={backups.destination}
                  onChange={(e) => setBackups({ ...backups, destination: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none cursor-pointer"
                >
                  <option value="AWS_S3_SECURE">Secure AWS S3 Bucket storage</option>
                  <option value="GOOGLE_CLOUD">Google Cloud Storage Vault</option>
                  <option value="LOCAL_FS">Platform Server Local Storage</option>
                </select>
              </div>
            </div>
          )}

          {/* Form Submit */}
          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-md hover:-translate-y-0.5 transition-all uppercase tracking-wider disabled:opacity-50"
          >
            {saving ? "Saving settings..." : "Apply Configurations"}
          </button>
        </form>
      </div>
    </div>
  );
}
