"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "@/components/toast";
import { ArrowLeft, RefreshCw, Save } from "lucide-react";

interface BusinessDetail {
  id: string;
  name: string;
  slug: string;
  currency: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  logo: string | null;
  settings?: any;
  taxConfig?: any;
  status: "ACTIVE" | "SUSPENDED" | "PENDING" | "CLOSED";
}

export default function EditBusinessPage() {
  const params = useParams();
  const router = useRouter();
  const businessId = params.id as string;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [business, setBusiness] = useState<BusinessDetail | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [logo, setLogo] = useState("");
  const [businessType, setBusinessType] = useState("RESTAURANT");
  const [currency, setCurrency] = useState("NPR");
  const [taxNumber, setTaxNumber] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  const fetchBusiness = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/v1/super-admin/businesses/${businessId}`);
      if (!res.ok) throw new Error("Failed to load business details");
      const data = await res.json();
      const b = data.business;
      setBusiness(b);

      setName(b.name || "");
      setSlug(b.slug || "");
      setLogo(b.logo || b.settings?.logo || "");
      setBusinessType(b.settings?.businessType || b.subscription?.packageType || "RESTAURANT");
      setCurrency(b.currency || "NPR");
      setTaxNumber(b.taxConfig?.taxNumber || "");
      setEmail(b.email || "");
      setPhone(b.phone || "");
      setAddress(b.address || "");
    } catch (err: any) {
      toast.error(err.message || "Failed to load business");
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    fetchBusiness();
  }, [fetchBusiness]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file (PNG, JPG, WebP).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image file must be under 5MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      setLogo(uploadEvent.target?.result as string);
      toast.success("Logo uploaded.");
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setLogo("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Business name is required.");
      return;
    }
    if (!slug.trim()) {
      toast.error("Subdomain slug is required.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/v1/super-admin/businesses/${businessId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "UPDATE_PROFILE",
          payload: {
            name: name.trim(),
            slug: slug.trim().toLowerCase(),
            logo: logo.trim() || null,
            businessType,
            currency,
            taxNumber: taxNumber.trim() || null,
            email: email.trim() || null,
            phone: phone.trim() || null,
            address: address.trim() || null,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update business profile");
      }

      toast.success("Business updated successfully.");
      router.push(`/dashboard/super-admin/businesses/${businessId}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to update business");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4 text-[#292320]">
        <div className="h-6 w-32 bg-[#EEE7DD] animate-pulse rounded" />
        <div className="h-96 bg-[#EEE7DD] animate-pulse rounded-lg" />
      </div>
    );
  }

  if (!business) {
    return (
      <div className="max-w-md mx-auto py-12 text-center text-[#292320]">
        <h2 className="text-sm font-bold">Business Not Found</h2>
        <Link
          href="/dashboard/super-admin/businesses"
          className="inline-block mt-3 text-xs text-[#6B2837] font-semibold underline"
        >
          Return to Directory
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4 text-[#292320]">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href={`/dashboard/super-admin/businesses/${businessId}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#71675E] hover:text-[#292320] transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Business
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/super-admin/businesses/${businessId}`}
            className="px-3 py-1.5 text-xs font-medium text-[#71675E] hover:text-[#292320]"
          >
            Cancel
          </Link>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-[#6B2837] hover:bg-[#521E2A] text-[#FFFCF7] text-xs font-bold rounded-md transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
          >
            {saving ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </button>
        </div>
      </div>

      {/* Main Single Card Form */}
      <form onSubmit={handleSubmit} className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg p-5 shadow-xs space-y-4">
        {/* Business Logo & Name Row */}
        <div className="flex items-center gap-4 pb-4 border-b border-[#EEE7DD]">
          <div className="relative shrink-0">
            {logo ? (
              <img
                src={logo}
                alt="Logo"
                className="h-16 w-16 rounded-lg object-cover border border-[#D8CEC1] bg-[#F7F3EC]"
              />
            ) : (
              <div className="h-16 w-16 rounded-lg bg-[#6B2837] text-white flex items-center justify-center font-bold text-lg border border-[#D8CEC1]">
                {name ? name.slice(0, 2).toUpperCase() : "BI"}
              </div>
            )}
          </div>

          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
                id="edit-logo-input"
              />
              <label
                htmlFor="edit-logo-input"
                className="px-2.5 py-1 bg-[#FFFCF7] hover:bg-[#EEE7DD] text-[#292320] border border-[#D8CEC1] rounded text-xs font-medium cursor-pointer transition-colors shadow-2xs"
              >
                Upload Logo
              </label>
              {logo && (
                <button
                  type="button"
                  onClick={handleRemoveLogo}
                  className="text-xs text-[#B91C1C] hover:underline font-medium cursor-pointer"
                >
                  Remove
                </button>
              )}
            </div>
            <p className="text-[11px] text-[#71675E]">PNG, JPG, or WebP (max 5MB)</p>
          </div>
        </div>

        {/* Inputs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
          {/* Legal Business Name */}
          <div className="sm:col-span-2 space-y-1">
            <label className="font-semibold text-[#292320] block">Legal Business Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Dynamatrix Solution"
              className="w-full px-3 py-1.5 bg-[#F7F3EC] focus:bg-[#FFFCF7] border border-[#D8CEC1] rounded-md font-medium text-xs focus:outline-none focus:border-[#6B2837] transition-colors"
            />
          </div>

          {/* Subdomain Slug */}
          <div className="space-y-1">
            <label className="font-semibold text-[#292320] block">Workspace Subdomain</label>
            <div className="flex items-center border border-[#D8CEC1] rounded-md bg-[#F7F3EC] focus-within:bg-[#FFFCF7] focus-within:border-[#6B2837]">
              <input
                type="text"
                required
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                placeholder="dynamatrixsolution"
                className="w-full px-2.5 py-1.5 bg-transparent font-mono text-xs focus:outline-none"
              />
              <span className="text-[10px] text-[#71675E] pr-2.5 font-mono select-none">
                .restroinn.com
              </span>
            </div>
          </div>

          {/* Category */}
          <div className="space-y-1">
            <label className="font-semibold text-[#71675E] block">Category</label>
            <select
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-[#F7F3EC] focus:bg-[#FFFCF7] border border-[#D8CEC1] rounded-md text-xs font-medium focus:outline-none focus:border-[#6B2837]"
            >
              <option value="RESTAURANT">Restaurant & Cafe</option>
              <option value="HOTEL">Hotel & Resort</option>
              <option value="BOTH">Hotel + Restaurant</option>
            </select>
          </div>

          {/* Currency */}
          <div className="space-y-1">
            <label className="font-semibold text-[#71675E] block">Currency</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-[#F7F3EC] focus:bg-[#FFFCF7] border border-[#D8CEC1] rounded-md text-xs font-medium focus:outline-none focus:border-[#6B2837]"
            >
              <option value="NPR">NPR (Rs.)</option>
              <option value="USD">USD ($)</option>
              <option value="INR">INR (₹)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
            </select>
          </div>

          {/* PAN / VAT */}
          <div className="space-y-1">
            <label className="font-semibold text-[#71675E] block">PAN / VAT Number</label>
            <input
              type="text"
              value={taxNumber}
              onChange={(e) => setTaxNumber(e.target.value)}
              placeholder="e.g. 601992834"
              className="w-full px-3 py-1.5 bg-[#F7F3EC] focus:bg-[#FFFCF7] border border-[#D8CEC1] rounded-md font-mono text-xs focus:outline-none focus:border-[#6B2837]"
            />
          </div>

          {/* Contact Email */}
          <div className="space-y-1">
            <label className="font-semibold text-[#71675E] block">Contact Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="info@business.com"
              className="w-full px-3 py-1.5 bg-[#F7F3EC] focus:bg-[#FFFCF7] border border-[#D8CEC1] rounded-md text-xs focus:outline-none focus:border-[#6B2837]"
            />
          </div>

          {/* Contact Phone */}
          <div className="space-y-1">
            <label className="font-semibold text-[#71675E] block">Contact Phone</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+977 9800000000"
              className="w-full px-3 py-1.5 bg-[#F7F3EC] focus:bg-[#FFFCF7] border border-[#D8CEC1] rounded-md text-xs focus:outline-none focus:border-[#6B2837]"
            />
          </div>

          {/* Physical Address */}
          <div className="sm:col-span-2 space-y-1">
            <label className="font-semibold text-[#71675E] block">Physical Address</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. Lakeside Ward 6, Pokhara, Nepal"
              className="w-full px-3 py-1.5 bg-[#F7F3EC] focus:bg-[#FFFCF7] border border-[#D8CEC1] rounded-md text-xs focus:outline-none focus:border-[#6B2837]"
            />
          </div>
        </div>

        {/* Footer Save Action */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#EEE7DD]">
          <Link
            href={`/dashboard/super-admin/businesses/${businessId}`}
            className="px-3 py-1.5 text-xs font-medium text-[#71675E] hover:text-[#292320]"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-1.5 bg-[#6B2837] hover:bg-[#521E2A] text-[#FFFCF7] text-xs font-bold rounded-md transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
