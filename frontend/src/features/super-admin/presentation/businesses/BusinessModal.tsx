"use client";

import React, { useState, useEffect } from "react";
import { X, Building2, Save, ShieldCheck } from "lucide-react";
import { useSuperAdminBusinessesStore } from "../../state/super-admin-businesses.store";
import { TenantStatus } from "../../models/super-admin.types";

export const BusinessModal: React.FC = () => {
  const isModalOpen = useSuperAdminBusinessesStore((s) => s.isModalOpen);
  const closeModal = useSuperAdminBusinessesStore((s) => s.closeModal);
  const editingBusiness = useSuperAdminBusinessesStore((s) => s.editingBusiness);
  const saveBusiness = useSuperAdminBusinessesStore((s) => s.saveBusiness);
  const isSaving = useSuperAdminBusinessesStore((s) => s.isSaving);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [panVat, setPanVat] = useState("");
  const [address, setAddress] = useState("");
  const [plan, setPlan] = useState("ENTERPRISE");
  const [status, setStatus] = useState<TenantStatus>("ACTIVE");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editingBusiness) {
      setName(editingBusiness.name || "");
      setSlug(editingBusiness.slug || "");
      setPhone(editingBusiness.phone || "");
      setEmail(editingBusiness.email || "");
      setPanVat(editingBusiness.panVat || "");
      setAddress(editingBusiness.address || "");
      setPlan(editingBusiness.planName || editingBusiness.plan || "ENTERPRISE");
      setStatus(editingBusiness.status || "ACTIVE");
    } else {
      setName("");
      setSlug("");
      setPhone("");
      setEmail("");
      setPanVat("");
      setAddress("");
      setPlan("ENTERPRISE");
      setStatus("ACTIVE");
    }
    setError(null);
  }, [editingBusiness, isModalOpen]);

  if (!isModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Business organization name is required");
      return;
    }

    const payload = {
      name: name.trim(),
      slug: slug.trim() || undefined,
      phone: phone.trim() || null,
      email: email.trim() || null,
      panVat: panVat.trim() || null,
      address: address.trim() || null,
      plan,
      status,
    };

    const ok = await saveBusiness(payload);
    if (!ok) {
      setError("Failed to save tenant organization");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#292320]/50 p-4 backdrop-blur-xs select-none">
      <div className="w-full max-w-lg rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] p-5 space-y-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#D8CEC1] pb-3 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-[#6B2837] text-white">
              <Building2 className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#292320]">
                {editingBusiness ? "Edit Tenant Profile" : "Provision New Tenant"}
              </h3>
              <p className="text-[11px] text-[#71675E]">
                Configure multi-tenant workspace credentials and subscription tiers
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={closeModal}
            className="h-8 w-8 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] flex items-center justify-center text-[#71675E] hover:text-[#292320] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="p-2.5 rounded-lg border border-red-200 bg-red-50 text-xs text-[#DC2626] font-medium shrink-0">
            {error}
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[#292320]">Business Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Annapurna Grand Resort"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!editingBusiness) {
                    setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "-"));
                  }
                }}
                className="w-full h-8 px-2.5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-xs font-semibold text-[#292320] focus:border-[#6B2837] focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[#292320]">URL Slug</label>
              <input
                type="text"
                placeholder="e.g. annapurna-resort"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="w-full h-8 px-2.5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-xs font-mono text-[#292320] focus:border-[#6B2837] focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[#292320]">Primary Phone</label>
              <input
                type="text"
                placeholder="e.g. 01-4412345"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full h-8 px-2.5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-xs font-mono text-[#292320] focus:border-[#6B2837] focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[#292320]">PAN / VAT</label>
              <input
                type="text"
                placeholder="9-digit PAN/VAT"
                value={panVat}
                onChange={(e) => setPanVat(e.target.value)}
                className="w-full h-8 px-2.5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-xs font-mono text-[#292320] focus:border-[#6B2837] focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-[#292320]">Billing Email</label>
            <input
              type="email"
              placeholder="billing@annapurnaresort.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-8 px-2.5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-xs text-[#292320] focus:border-[#6B2837] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[#292320]">Subscription Plan</label>
              <select
                value={plan}
                onChange={(e) => setPlan(e.target.value)}
                className="w-full h-8 px-2.5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-xs font-semibold text-[#292320] focus:border-[#6B2837] focus:outline-none"
              >
                <option value="STARTER">Starter Tier</option>
                <option value="PROFESSIONAL">Professional Tier</option>
                <option value="ENTERPRISE">Enterprise (Hospitality Suite)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[#292320]">Tenant Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TenantStatus)}
                className="w-full h-8 px-2.5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-xs font-semibold text-[#292320] focus:border-[#6B2837] focus:outline-none"
              >
                <option value="ACTIVE">Active</option>
                <option value="TRIAL">Trial Period</option>
                <option value="SUSPENDED">Suspended</option>
                <option value="EXPIRED">Expired</option>
              </select>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-[#D8CEC1] flex items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={closeModal}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-[#71675E] cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-1.5 text-xs font-bold rounded-lg bg-[#6B2837] hover:bg-[#541E2A] text-white flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              <span>{isSaving ? "Saving..." : editingBusiness ? "Save Changes" : "Create Tenant"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

