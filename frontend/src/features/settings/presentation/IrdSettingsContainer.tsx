"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSettingsStore } from "../state/settings.store";
import { settingsRepository } from "../repositories/settings.repository";
import {
  ShieldCheck,
  Save,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Play,
  Calendar,
} from "lucide-react";
import { Notify } from "@/lib/notify";

export function IrdSettingsContainer() {
  const { cbmsConfig, loading, saving, loadCbmsConfig, updateCbmsConfig } = useSettingsStore();

  const [formData, setFormData] = useState<any>({
    enabled: true,
    sellerPan: "",
    username: "",
    password: "",
    apiUrl: "https://cbms.ird.gov.np/api/bill",
    autoSync: true,
  });

  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Fiscal Year
  const [fiscalYearData, setFiscalYearData] = useState<any>({
    fiscalYear: "2081/82",
    startDate: "2081-04-01",
    endDate: "2082-03-31",
  });

  const loadAll = useCallback(async () => {
    try {
      await loadCbmsConfig();
      const fy = await settingsRepository.fetchFiscalYear();
      if (fy) setFiscalYearData(fy);
    } catch (err) {
      console.error("Failed to load IRD & FY config:", err);
    }
  }, [loadCbmsConfig]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (cbmsConfig) {
      setFormData((prev: any) => ({ ...prev, ...cbmsConfig }));
    }
  }, [cbmsConfig]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateCbmsConfig(formData);
    await settingsRepository.updateFiscalYear(fiscalYearData);
  };

  const handleTestConnection = async () => {
    try {
      setTestLoading(true);
      setTestResult(null);
      const res = await settingsRepository.testIrdConnection();
      setTestResult(res);
      if (res.success) Notify.success("Connected to IRD CBMS successfully");
      else Notify.error(res.message || "IRD CBMS handshake failed");
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || "Connection timed out" });
      Notify.error(err.message || "Connection timed out");
    } finally {
      setTestLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#EEE7DD] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-[#6B2837]" />
            <h1 className="text-xl font-bold text-[#292320] tracking-tight">IRD CBMS Real-Time Integration</h1>
          </div>
          <p className="text-xs text-[#71675E] mt-0.5">
            Configure Central Billing Monitoring System (CBMS) API credentials & Fiscal Year compliance
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadAll()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#292320] bg-[#FFFCF7] border border-[#EEE7DD] rounded-md hover:bg-[#F7F3EC] transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={handleTestConnection}
            disabled={testLoading}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#292320] bg-[#FFFCF7] border border-[#EEE7DD] rounded-md hover:bg-[#F7F3EC] transition-colors"
          >
            <Play className={`h-3.5 w-3.5 ${testLoading ? "animate-spin" : ""}`} />
            Test CBMS Ping
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#6B2837] rounded-md hover:bg-[#521E2A] transition-colors shadow-sm"
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? "Saving..." : "Save Credentials"}
          </button>
        </div>
      </div>

      {testResult && (
        <div
          className={`p-4 rounded-lg border text-xs flex items-center gap-3 ${
            testResult.success
              ? "bg-[#EBF4F0] border-[#C3DED0] text-[#28634B]"
              : "bg-[#FCEEEE] border-[#E9B6B7] text-[#B33432]"
          }`}
        >
          {testResult.success ? (
            <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
          ) : (
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
          )}
          <div>
            <div className="font-bold">
              {testResult.success ? "IRD CBMS Handshake Valid" : "Handshake Failed"}
            </div>
            <div>{testResult.message}</div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-xs text-[#71675E] bg-[#FFFCF7] border border-[#EEE7DD] rounded-lg">
          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-[#6B2837]" />
          Verifying IRD parameters...
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          <div className="bg-[#FFFCF7] border border-[#EEE7DD] rounded-lg p-5 space-y-4">
            <h3 className="text-sm font-bold text-[#292320] border-b border-[#EEE7DD] pb-3">
              Government CBMS Gateway Credentials
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-[#292320] mb-1">Seller PAN *</label>
                <input
                  type="text"
                  required
                  value={formData.sellerPan || ""}
                  onChange={(e) => setFormData({ ...formData, sellerPan: e.target.value })}
                  placeholder="9-digit PAN"
                  className="w-full px-3 py-2 font-mono bg-[#F7F3EC] border border-[#EEE7DD] rounded-md text-[#292320] outline-none focus:border-[#6B2837]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#292320] mb-1">CBMS Username *</label>
                <input
                  type="text"
                  required
                  value={formData.username || ""}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full px-3 py-2 bg-[#F7F3EC] border border-[#EEE7DD] rounded-md text-[#292320] outline-none focus:border-[#6B2837]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#292320] mb-1">CBMS Password</label>
                <input
                  type="password"
                  value={formData.password || ""}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Leave unchanged to keep existing"
                  className="w-full px-3 py-2 bg-[#F7F3EC] border border-[#EEE7DD] rounded-md text-[#292320] outline-none focus:border-[#6B2837]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#292320] mb-1">API Endpoint URL</label>
                <input
                  type="url"
                  required
                  value={formData.apiUrl || ""}
                  onChange={(e) => setFormData({ ...formData, apiUrl: e.target.value })}
                  className="w-full px-3 py-2 font-mono bg-[#F7F3EC] border border-[#EEE7DD] rounded-md text-[#292320] outline-none focus:border-[#6B2837]"
                />
              </div>
            </div>

            <div className="p-4 bg-[#F7F3EC] rounded-lg border border-[#EEE7DD] flex items-center justify-between text-xs">
              <div>
                <div className="font-semibold text-[#292320]">Real-Time Sync on Sale Finalization</div>
                <div className="text-[11px] text-[#71675E]">
                  Transmit invoices to IRD servers immediately upon settling orders
                </div>
              </div>
              <input
                type="checkbox"
                checked={!!formData.autoSync}
                onChange={(e) => setFormData({ ...formData, autoSync: e.target.checked })}
                className="h-4 w-4 rounded text-[#6B2837]"
              />
            </div>
          </div>

          {/* Fiscal Year Settings */}
          <div className="bg-[#FFFCF7] border border-[#EEE7DD] rounded-lg p-5 space-y-4">
            <h3 className="text-sm font-bold text-[#292320] border-b border-[#EEE7DD] pb-3">
              Fiscal Year Compliance Period
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-[#292320] mb-1">Fiscal Year Label</label>
                <input
                  type="text"
                  value={fiscalYearData.fiscalYear || "2081/82"}
                  onChange={(e) => setFiscalYearData({ ...fiscalYearData, fiscalYear: e.target.value })}
                  className="w-full px-3 py-2 font-mono bg-[#F7F3EC] border border-[#EEE7DD] rounded-md text-[#292320] outline-none focus:border-[#6B2837]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#292320] mb-1">Start Date (BS / AD)</label>
                <input
                  type="date"
                  value={fiscalYearData.startDate || ""}
                  onChange={(e) => setFiscalYearData({ ...fiscalYearData, startDate: e.target.value })}
                  className="w-full px-3 py-2 bg-[#F7F3EC] border border-[#EEE7DD] rounded-md text-[#292320] outline-none focus:border-[#6B2837]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#292320] mb-1">End Date (BS / AD)</label>
                <input
                  type="date"
                  value={fiscalYearData.endDate || ""}
                  onChange={(e) => setFiscalYearData({ ...fiscalYearData, endDate: e.target.value })}
                  className="w-full px-3 py-2 bg-[#F7F3EC] border border-[#EEE7DD] rounded-md text-[#292320] outline-none focus:border-[#6B2837]"
                />
              </div>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}

