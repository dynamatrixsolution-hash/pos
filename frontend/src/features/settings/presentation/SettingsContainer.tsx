"use client";

import React, { useState, useEffect } from "react";
import { useSettingsStore } from "../state/settings.store";
import {
  Settings,
  Store,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  Printer,
  ShieldCheck,
  Save,
  RefreshCw,
  Loader2,
  CheckCircle,
} from "lucide-react";
import { Notify } from "@/lib/notify";

export function SettingsContainer() {
  const { settings, loading, saving, loadSettings, updateSettings } = useSettingsStore();

  const [activeTab, setActiveTab] = useState<"profile" | "tax" | "pos" | "branding">("profile");

  // Form states
  const [formData, setFormData] = useState<any>({});

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    if (settings) {
      setFormData(settings);
    }
  }, [settings]);

  const handleChange = (field: string, val: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: val }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateSettings(formData);
  };

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#EEE7DD] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-[#6B2837]" />
            <h1 className="text-xl font-bold text-[#292320] tracking-tight">Business & POS Settings</h1>
          </div>
          <p className="text-xs text-[#71675E] mt-0.5">
            Store profile, tax configuration, thermal receipt printer formatting & digital payment parameters
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadSettings()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#292320] bg-[#FFFCF7] border border-[#EEE7DD] rounded-md hover:bg-[#F7F3EC] transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#6B2837] rounded-md hover:bg-[#521E2A] transition-colors shadow-sm"
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? "Saving Changes..." : "Save Settings"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[#EEE7DD] pb-2">
        {[
          ["profile", "Store Profile", Store],
          ["tax", "Taxes & Compliance", ShieldCheck],
          ["pos", "POS & Receipt Printer", Printer],
          ["branding", "Logos & QR Payments", CreditCard],
        ].map(([key, label, Icon]: any) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              activeTab === key
                ? "bg-[#6B2837] text-white"
                : "text-[#71675E] hover:text-[#292320] hover:bg-[#F7F3EC]"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="p-12 text-center text-xs text-[#71675E] bg-[#FFFCF7] border border-[#EEE7DD] rounded-lg">
          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-[#6B2837]" />
          Loading business configuration...
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          {/* Tab 1: Profile */}
          {activeTab === "profile" && (
            <div className="bg-[#FFFCF7] border border-[#EEE7DD] rounded-lg p-5 space-y-4">
              <h3 className="text-sm font-bold text-[#292320] border-b border-[#EEE7DD] pb-3">
                Business & Outlet Identity
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-semibold text-[#292320] mb-1">Business Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name || ""}
                    onChange={(e) => handleChange("name", e.target.value)}
                    className="w-full px-3 py-2 bg-[#F7F3EC] border border-[#EEE7DD] rounded-md text-[#292320] outline-none focus:border-[#6B2837]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#292320] mb-1">Contact Phone</label>
                  <input
                    type="tel"
                    value={formData.phone || ""}
                    onChange={(e) => handleChange("phone", e.target.value)}
                    className="w-full px-3 py-2 bg-[#F7F3EC] border border-[#EEE7DD] rounded-md text-[#292320] outline-none focus:border-[#6B2837]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#292320] mb-1">Official Email</label>
                  <input
                    type="email"
                    value={formData.email || ""}
                    onChange={(e) => handleChange("email", e.target.value)}
                    className="w-full px-3 py-2 bg-[#F7F3EC] border border-[#EEE7DD] rounded-md text-[#292320] outline-none focus:border-[#6B2837]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#292320] mb-1">Physical Address</label>
                  <input
                    type="text"
                    value={formData.address || ""}
                    onChange={(e) => handleChange("address", e.target.value)}
                    className="w-full px-3 py-2 bg-[#F7F3EC] border border-[#EEE7DD] rounded-md text-[#292320] outline-none focus:border-[#6B2837]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#292320] mb-1">PAN / VAT Number</label>
                  <input
                    type="text"
                    value={formData.panNumber || formData.vatNumber || ""}
                    onChange={(e) => handleChange("panNumber", e.target.value)}
                    className="w-full px-3 py-2 font-mono bg-[#F7F3EC] border border-[#EEE7DD] rounded-md text-[#292320] outline-none focus:border-[#6B2837]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#292320] mb-1">Active Fiscal Year</label>
                  <input
                    type="text"
                    value={formData.fiscalYear || "2081/82"}
                    onChange={(e) => handleChange("fiscalYear", e.target.value)}
                    className="w-full px-3 py-2 font-mono bg-[#F7F3EC] border border-[#EEE7DD] rounded-md text-[#292320] outline-none focus:border-[#6B2837]"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Taxes & Compliance */}
          {activeTab === "tax" && (
            <div className="bg-[#FFFCF7] border border-[#EEE7DD] rounded-lg p-5 space-y-4">
              <h3 className="text-sm font-bold text-[#292320] border-b border-[#EEE7DD] pb-3">
                Taxation & Invoice Structuring
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-4 bg-[#F7F3EC] rounded-lg border border-[#EEE7DD] space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-[#292320]">13% Value Added Tax (VAT)</div>
                      <div className="text-[11px] text-[#71675E]">Apply VAT to sales invoices</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={!!formData.enableVat}
                      onChange={(e) => handleChange("enableVat", e.target.checked)}
                      className="h-4 w-4 rounded text-[#6B2837] focus:ring-[#6B2837]"
                    />
                  </div>
                </div>

                <div className="p-4 bg-[#F7F3EC] rounded-lg border border-[#EEE7DD] space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-[#292320]">10% Service Charge</div>
                      <div className="text-[11px] text-[#71675E]">Apply restaurant service fee</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={!!formData.enableServiceCharge}
                      onChange={(e) => handleChange("enableServiceCharge", e.target.checked)}
                      className="h-4 w-4 rounded text-[#6B2837] focus:ring-[#6B2837]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-[#292320] mb-1">Invoice Prefix</label>
                  <input
                    type="text"
                    value={formData.invoicePrefix || "INV-"}
                    onChange={(e) => handleChange("invoicePrefix", e.target.value)}
                    className="w-full px-3 py-2 font-mono bg-[#F7F3EC] border border-[#EEE7DD] rounded-md text-[#292320] outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: POS & Printer */}
          {activeTab === "pos" && (
            <div className="bg-[#FFFCF7] border border-[#EEE7DD] rounded-lg p-5 space-y-4">
              <h3 className="text-sm font-bold text-[#292320] border-b border-[#EEE7DD] pb-3">
                Thermal Receipt Printer Formatting
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-semibold text-[#292320] mb-1">Paper Roll Width</label>
                  <select
                    value={formData.paperWidth || "80mm"}
                    onChange={(e) => handleChange("paperWidth", e.target.value)}
                    className="w-full px-3 py-2 bg-[#F7F3EC] border border-[#EEE7DD] rounded-md text-[#292320] outline-none"
                  >
                    <option value="80mm">80mm (Standard POS Thermal)</option>
                    <option value="58mm">58mm (Compact Mobile Roll)</option>
                  </select>
                </div>

                <div className="p-4 bg-[#F7F3EC] rounded-lg border border-[#EEE7DD] flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-[#292320]">Auto-Print on Order Settle</div>
                    <div className="text-[11px] text-[#71675E]">Trigger print dialog immediately upon tender</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={!!formData.autoPrintReceipt}
                    onChange={(e) => handleChange("autoPrintReceipt", e.target.checked)}
                    className="h-4 w-4 rounded text-[#6B2837]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#292320] mb-1">Receipt Header Greeting</label>
                  <input
                    type="text"
                    value={formData.receiptHeader || "Welcome to Merosathi"}
                    onChange={(e) => handleChange("receiptHeader", e.target.value)}
                    className="w-full px-3 py-2 bg-[#F7F3EC] border border-[#EEE7DD] rounded-md text-[#292320] outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#292320] mb-1">Receipt Footer Note</label>
                  <input
                    type="text"
                    value={formData.receiptFooter || "Thank you for your visit! Please visit again."}
                    onChange={(e) => handleChange("receiptFooter", e.target.value)}
                    className="w-full px-3 py-2 bg-[#F7F3EC] border border-[#EEE7DD] rounded-md text-[#292320] outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Tab 4: Branding */}
          {activeTab === "branding" && (
            <div className="bg-[#FFFCF7] border border-[#EEE7DD] rounded-lg p-5 space-y-4">
              <h3 className="text-sm font-bold text-[#292320] border-b border-[#EEE7DD] pb-3">
                Logos & Digital Payment QR
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-semibold text-[#292320] mb-1">Store Logo URL</label>
                  <input
                    type="url"
                    value={formData.logoUrl || ""}
                    onChange={(e) => handleChange("logoUrl", e.target.value)}
                    placeholder="https://..."
                    className="w-full px-3 py-2 bg-[#F7F3EC] border border-[#EEE7DD] rounded-md text-[#292320] outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#292320] mb-1">Payment Static QR URL (Fonepay/Khalti)</label>
                  <input
                    type="url"
                    value={formData.qrCodeUrl || ""}
                    onChange={(e) => handleChange("qrCodeUrl", e.target.value)}
                    placeholder="https://..."
                    className="w-full px-3 py-2 bg-[#F7F3EC] border border-[#EEE7DD] rounded-md text-[#292320] outline-none"
                  />
                </div>
              </div>
            </div>
          )}
        </form>
      )}
    </div>
  );
}

