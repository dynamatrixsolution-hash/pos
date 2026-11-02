"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Eye,
  EyeOff,
  Loader2,
  Store,
  Building,
  Layers,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { Notify } from "@/lib/notify";

interface FormData {
  businessName: string;
  slug: string;
  businessType: string;
  currency: string;
  taxNumber: string;
  phone: string;
  email: string;
  address: string;

  plan: string;
  billingCycle: string;
  durationMonths: number;
  selectedModules: Record<string, boolean>;

  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  password: string;
}

export default function RegisterPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState<FormData>({
    businessName: "",
    slug: "",
    businessType: "RESTAURANT",
    currency: "NPR",
    taxNumber: "",
    phone: "",
    email: "",
    address: "",

    plan: "STARTER",
    billingCycle: "MONTHLY",
    durationMonths: 12,
    selectedModules: {
      posBilling: true,
      inventory: true,
      hotelRooms: false,
      kdsKitchen: true,
      doubleEntryAccounting: false,
      guestQrPortal: false,
      reports: true,
      multiBranch: false,
    },

    ownerName: "",
    ownerEmail: "",
    ownerPhone: "",
    password: "",
  });

  // Auto-generate slug from business name if user hasn't explicitly edited it
  const handleBusinessNameChange = (val: string) => {
    const generatedSlug = val
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    setFormData((prev) => ({
      ...prev,
      businessName: val,
      slug: prev.slug === "" || prev.slug === prev.businessName.toLowerCase().replace(/[^a-z0-9]+/g, "-") ? generatedSlug : prev.slug,
    }));

    if (fieldErrors.businessName) {
      setFieldErrors((prev) => ({ ...prev, businessName: "" }));
    }
  };

  const validateStep = (step: number): boolean => {
    const errors: Record<string, string> = {};

    if (step === 1) {
      if (!formData.businessName.trim() || formData.businessName.length < 2) {
        errors.businessName = "Business name must be at least 2 characters.";
      }
      if (!formData.slug.trim() || formData.slug.length < 3 || !/^[a-z0-9-]+$/.test(formData.slug)) {
        errors.slug = "Workspace address must be 3+ lowercase characters (letters, numbers, hyphens).";
      }
      if (!formData.email.trim() || !/\S+@\S+\.\S+/.test(formData.email)) {
        errors.email = "Please enter a valid business email address.";
      }
    } else if (step === 3) {
      if (!formData.ownerName.trim() || formData.ownerName.length < 2) {
        errors.ownerName = "Administrator full name is required (min 2 characters).";
      }
      if (!formData.ownerEmail.trim() || !/\S+@\S+\.\S+/.test(formData.ownerEmail)) {
        errors.ownerEmail = "Please enter a valid administrator email address.";
      }
      if (!formData.password || formData.password.length < 6) {
        errors.password = "Password must be at least 6 characters long.";
      }
    }

    setFieldErrors(errors);

    const firstError = Object.values(errors)[0];
    if (firstError) {
      Notify.warning(firstError);
      return false;
    }
    return true;
  };

  const handleNextStep = () => {
    if (validateStep(currentStep)) {
      if (currentStep < 4) {
        setCurrentStep((prev) => prev + 1);
      } else {
        handleSubmit();
      }
    }
  };

  const handlePrevStep = () => {
    setFieldErrors({});
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSubmit = async () => {
    setIsLoading(true);

    try {
      const res = await fetch("/api/v1/auth/register-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const json = await res.json();
      if (!res.ok) {
        const detailMsg = typeof json.details === "string" ? json.details : json.details ? JSON.stringify(json.details) : "";
        throw new Error(json.error ? `${json.error}${detailMsg ? `: ${detailMsg}` : ""}` : "Failed to submit registration request.");
      }

      Notify.success("Workspace registration request submitted successfully!");
      router.push(`/auth/register/status?id=${json.request.id}&code=${json.request.trackingCode}`);
    } catch (err: any) {
      Notify.failure(err.message || "An error occurred during submission.");
      setIsLoading(false);
    }
  };

  return (
    <div className="h-screen w-screen overflow-hidden flex items-center justify-center bg-[#F2EDE4] p-1.5 sm:p-2.5 md:p-3.5 select-none">
      {/* Outer Enclosed Layout Card matching login screen proportions */}
      <div className="w-full max-w-[1440px] h-[calc(100vh-14px)] sm:h-[calc(100vh-20px)] md:h-[calc(100vh-28px)] max-h-[1020px] bg-[#FAF8F5] rounded-xl sm:rounded-2xl border border-[#D5CEC2] shadow-sm flex flex-col md:flex-row overflow-hidden">
        
        {/* ======================================================== */}
        {/* LEFT CONTAINER: SVG HERO POSTER (ZERO CLIPPING)          */}
        {/* Uses register-hero.svg as an SVG vector image            */}
        {/* ======================================================== */}
        <div className="hidden md:flex h-full aspect-[682/1024] max-w-[44%] shrink-0 relative bg-[#1B1512] border-r border-[#D5CEC2] overflow-hidden items-center justify-center">
          <img
            src="/assets/register-hero.svg"
            alt="RestroInn - Make room for better service. Built around your hospitality."
            className="w-full h-full object-cover block"
          />
        </div>

        {/* Mobile top image banner */}
        <div className="block md:hidden w-full h-40 sm:h-48 relative bg-[#1B1512] shrink-0 border-b border-[#D5CEC2]">
          <img
            src="/assets/register-hero.svg"
            alt="RestroInn - Make room for better service"
            className="w-full h-full object-cover object-top block"
          />
        </div>

        {/* ======================================================== */}
        {/* RIGHT CONTAINER: 4-STEP ONBOARDING FORM                  */}
        {/* ======================================================== */}
        <div className="flex-1 h-full flex flex-col justify-between bg-[#FAF8F5] px-6 sm:px-10 lg:px-14 xl:px-16 py-5 sm:py-7 lg:py-8 overflow-y-auto">
          
          {/* Header Row: Top Navigation Link */}
          <div className="flex justify-end items-center gap-1.5 text-xs sm:text-sm font-medium shrink-0">
            <span className="text-[#6D635C]">Already registered?</span>
            <Link
              href="/auth/login"
              className="text-[#6A2635] font-bold hover:underline inline-flex items-center gap-1 transition-colors ml-1"
            >
              <span>Sign in</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Stepper Progress Bar */}
          <div className="max-w-md mx-auto w-full pt-2 pb-4 shrink-0">
            <div className="flex items-center justify-between">
              {/* Step 1 */}
              <div className="flex flex-col items-center">
                <div
                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    currentStep === 1
                      ? "bg-[#6A2635] text-white shadow-xs ring-2 ring-[#6A2635]/20"
                      : currentStep > 1
                      ? "bg-[#28634B] text-white"
                      : "border border-[#CDC4B7] text-[#71675E] bg-white"
                  }`}
                >
                  {currentStep > 1 ? <Check className="w-4 h-4" /> : "1"}
                </div>
                <span
                  className={`text-[11px] sm:text-xs mt-1.5 font-semibold ${
                    currentStep === 1 ? "text-[#6A2635] font-bold" : currentStep > 1 ? "text-[#28634B]" : "text-[#71675E]"
                  }`}
                >
                  Business
                </span>
              </div>

              <div className={`flex-1 h-[1px] mx-2.5 sm:mx-3 transition-colors ${currentStep > 1 ? "bg-[#28634B]" : "bg-[#DDD4C7]"}`} />

              {/* Step 2 */}
              <div className="flex flex-col items-center">
                <div
                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    currentStep === 2
                      ? "bg-[#6A2635] text-white shadow-xs ring-2 ring-[#6A2635]/20"
                      : currentStep > 2
                      ? "bg-[#28634B] text-white"
                      : "border border-[#CDC4B7] text-[#71675E] bg-white"
                  }`}
                >
                  {currentStep > 2 ? <Check className="w-4 h-4" /> : "2"}
                </div>
                <span
                  className={`text-[11px] sm:text-xs mt-1.5 font-semibold ${
                    currentStep === 2 ? "text-[#6A2635] font-bold" : currentStep > 2 ? "text-[#28634B]" : "text-[#71675E]"
                  }`}
                >
                  Plan
                </span>
              </div>

              <div className={`flex-1 h-[1px] mx-2.5 sm:mx-3 transition-colors ${currentStep > 2 ? "bg-[#28634B]" : "bg-[#DDD4C7]"}`} />

              {/* Step 3 */}
              <div className="flex flex-col items-center">
                <div
                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    currentStep === 3
                      ? "bg-[#6A2635] text-white shadow-xs ring-2 ring-[#6A2635]/20"
                      : currentStep > 3
                      ? "bg-[#28634B] text-white"
                      : "border border-[#CDC4B7] text-[#71675E] bg-white"
                  }`}
                >
                  {currentStep > 3 ? <Check className="w-4 h-4" /> : "3"}
                </div>
                <span
                  className={`text-[11px] sm:text-xs mt-1.5 font-semibold ${
                    currentStep === 3 ? "text-[#6A2635] font-bold" : currentStep > 3 ? "text-[#28634B]" : "text-[#71675E]"
                  }`}
                >
                  Account
                </span>
              </div>

              <div className={`flex-1 h-[1px] mx-2.5 sm:mx-3 transition-colors ${currentStep > 3 ? "bg-[#28634B]" : "bg-[#DDD4C7]"}`} />

              {/* Step 4 */}
              <div className="flex flex-col items-center">
                <div
                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    currentStep === 4
                      ? "bg-[#6A2635] text-white shadow-xs ring-2 ring-[#6A2635]/20"
                      : "border border-[#CDC4B7] text-[#71675E] bg-white"
                  }`}
                >
                  4
                </div>
                <span
                  className={`text-[11px] sm:text-xs mt-1.5 font-semibold ${
                    currentStep === 4 ? "text-[#6A2635] font-bold" : "text-[#71675E]"
                  }`}
                >
                  Review
                </span>
              </div>
            </div>
          </div>

          {/* Form Step Body */}
          <div className="max-w-xl mx-auto w-full my-auto py-2">
            
            {/* STEP 1: BUSINESS BASICS */}
            {currentStep === 1 && (
              <div className="space-y-4 sm:space-y-4.5">
                <div className="space-y-1">
                  <h1 className="text-2xl sm:text-3xl lg:text-[34px] font-black tracking-tight text-[#140F0C] leading-tight">
                    Tell us about your business
                  </h1>
                  <p className="text-sm sm:text-base text-[#61574F] font-normal">
                    Start with the basics. Set up your account next.
                  </p>
                </div>

                <div className="space-y-3.5 pt-1">
                  {/* Business Name */}
                  <div className="space-y-1">
                    <label className="text-xs sm:text-sm font-bold text-[#1F1915] block">
                      Business name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Lakeside Retreat"
                      value={formData.businessName}
                      onChange={(e) => handleBusinessNameChange(e.target.value)}
                      className={`w-full px-3.5 py-2.5 sm:py-3 bg-white border rounded-lg text-sm sm:text-base font-medium text-[#1F1915] placeholder:text-[#9E938B] focus:outline-none focus:border-[#6A2635] focus:ring-1 focus:ring-[#6A2635] transition-all ${
                        fieldErrors.businessName ? "border-[#B33432]" : "border-[#CDC4B7]"
                      }`}
                    />
                    {fieldErrors.businessName && (
                      <span className="text-xs text-[#B33432] font-semibold block">
                        {fieldErrors.businessName}
                      </span>
                    )}
                  </div>

                  {/* Business Type (3 Segmented Radios) */}
                  <div className="space-y-1">
                    <label className="text-xs sm:text-sm font-bold text-[#1F1915] block">
                      Business type
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-1 bg-[#FAF7F2] border border-[#CDC4B7] rounded-lg">
                      <label
                        className={`flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer transition-colors ${
                          formData.businessType === "RESTAURANT"
                            ? "bg-white shadow-xs border border-[#D5CEC2]"
                            : "hover:bg-white/60"
                        }`}
                      >
                        <input
                          type="radio"
                          name="businessType"
                          checked={formData.businessType === "RESTAURANT"}
                          onChange={() => setFormData({ ...formData, businessType: "RESTAURANT" })}
                          className="accent-[#6A2635] w-4 h-4 cursor-pointer"
                        />
                        <span className="text-xs sm:text-[13px] font-semibold text-[#1F1915]">
                          Restaurant & café
                        </span>
                      </label>

                      <label
                        className={`flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer transition-colors ${
                          formData.businessType === "HOTEL"
                            ? "bg-white shadow-xs border border-[#D5CEC2]"
                            : "hover:bg-white/60"
                        }`}
                      >
                        <input
                          type="radio"
                          name="businessType"
                          checked={formData.businessType === "HOTEL"}
                          onChange={() => setFormData({ ...formData, businessType: "HOTEL" })}
                          className="accent-[#6A2635] w-4 h-4 cursor-pointer"
                        />
                        <span className="text-xs sm:text-[13px] font-semibold text-[#1F1915]">
                          Hotel & stay
                        </span>
                      </label>

                      <label
                        className={`flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer transition-colors ${
                          formData.businessType === "BOTH"
                            ? "bg-white shadow-xs border border-[#D5CEC2]"
                            : "hover:bg-white/60"
                        }`}
                      >
                        <input
                          type="radio"
                          name="businessType"
                          checked={formData.businessType === "BOTH"}
                          onChange={() => setFormData({ ...formData, businessType: "BOTH" })}
                          className="accent-[#6A2635] w-4 h-4 cursor-pointer"
                        />
                        <span className="text-xs sm:text-[13px] font-semibold text-[#1F1915]">
                          Hotel + restaurant
                        </span>
                      </label>
                    </div>
                  </div>

                  {/* 2-Column: Workspace Address + Currency */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs sm:text-sm font-bold text-[#1F1915] block">
                        Workspace address
                      </label>
                      <div
                        className={`flex rounded-lg border bg-white overflow-hidden transition-all focus-within:border-[#6A2635] focus-within:ring-1 focus-within:ring-[#6A2635] ${
                          fieldErrors.slug ? "border-[#B33432]" : "border-[#CDC4B7]"
                        }`}
                      >
                        <input
                          type="text"
                          placeholder="lakeside-retreat"
                          value={formData.slug}
                          onChange={(e) => {
                            setFormData({
                              ...formData,
                              slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
                            });
                            if (fieldErrors.slug) setFieldErrors({ ...fieldErrors, slug: "" });
                          }}
                          className="w-full min-w-0 px-3 py-2.5 sm:py-3 text-xs sm:text-sm font-medium text-[#1F1915] placeholder:text-[#9E938B] focus:outline-none bg-transparent"
                        />
                        <span className="px-2.5 py-2.5 sm:py-3 bg-[#FAF7F2] border-l border-[#CDC4B7] text-xs text-[#71675E] font-medium flex items-center select-none shrink-0">
                          .restroinn.com
                        </span>
                      </div>
                      {fieldErrors.slug && (
                        <span className="text-xs text-[#B33432] font-semibold block">
                          {fieldErrors.slug}
                        </span>
                      )}
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs sm:text-sm font-bold text-[#1F1915] block">
                        Currency
                      </label>
                      <select
                        value={formData.currency}
                        onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                        className="w-full px-3 py-2.5 sm:py-3 bg-white border border-[#CDC4B7] rounded-lg text-xs sm:text-sm font-medium text-[#1F1915] focus:outline-none focus:border-[#6A2635] focus:ring-1 focus:ring-[#6A2635]"
                      >
                        <option value="NPR">NPR — Nepalese rupee</option>
                        <option value="INR">INR — Indian rupee</option>
                        <option value="USD">USD — US Dollar</option>
                        <option value="EUR">EUR — Euro</option>
                        <option value="GBP">GBP — British Pound</option>
                        <option value="AED">AED — UAE Dirham</option>
                      </select>
                    </div>
                  </div>

                  {/* 2-Column: Business Email + Phone */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs sm:text-sm font-bold text-[#1F1915] block">
                        Business email
                      </label>
                      <input
                        type="email"
                        placeholder="hello@yourbusiness.com"
                        value={formData.email}
                        onChange={(e) => {
                          setFormData({ ...formData, email: e.target.value });
                          if (fieldErrors.email) setFieldErrors({ ...fieldErrors, email: "" });
                        }}
                        className={`w-full px-3.5 py-2.5 sm:py-3 bg-white border rounded-lg text-xs sm:text-sm font-medium text-[#1F1915] placeholder:text-[#9E938B] focus:outline-none focus:border-[#6A2635] focus:ring-1 focus:ring-[#6A2635] ${
                          fieldErrors.email ? "border-[#B33432]" : "border-[#CDC4B7]"
                        }`}
                      />
                      {fieldErrors.email && (
                        <span className="text-xs text-[#B33432] font-semibold block">
                          {fieldErrors.email}
                        </span>
                      )}
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs sm:text-sm font-bold text-[#1F1915] block">
                        Phone number
                      </label>
                      <input
                        type="tel"
                        placeholder="+977"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full px-3.5 py-2.5 sm:py-3 bg-white border border-[#CDC4B7] rounded-lg text-xs sm:text-sm font-medium text-[#1F1915] placeholder:text-[#9E938B] focus:outline-none focus:border-[#6A2635] focus:ring-1 focus:ring-[#6A2635]"
                      />
                    </div>
                  </div>

                  {/* Business Address */}
                  <div className="space-y-1">
                    <label className="text-xs sm:text-sm font-bold text-[#1F1915] block">
                      Business address
                    </label>
                    <input
                      type="text"
                      placeholder="Street, city"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full px-3.5 py-2.5 sm:py-3 bg-white border border-[#CDC4B7] rounded-lg text-xs sm:text-sm font-medium text-[#1F1915] placeholder:text-[#9E938B] focus:outline-none focus:border-[#6A2635] focus:ring-1 focus:ring-[#6A2635]"
                    />
                  </div>

                  {/* Tax Registration Number */}
                  <div className="space-y-1">
                    <label className="text-xs sm:text-sm font-bold text-[#1F1915] block">
                      Tax registration number (optional)
                    </label>
                    <input
                      type="text"
                      placeholder="PAN / VAT number"
                      value={formData.taxNumber}
                      onChange={(e) => setFormData({ ...formData, taxNumber: e.target.value })}
                      className="w-full px-3.5 py-2.5 sm:py-3 bg-white border border-[#CDC4B7] rounded-lg text-xs sm:text-sm font-medium text-[#1F1915] placeholder:text-[#9E938B] focus:outline-none focus:border-[#6A2635] focus:ring-1 focus:ring-[#6A2635]"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2: PLAN & MODULES */}
            {currentStep === 2 && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[#140F0C] leading-tight">
                    Choose your plan & capabilities
                  </h1>
                  <p className="text-sm sm:text-base text-[#61574F] font-normal">
                    Select the tier that best matches your venue’s scale.
                  </p>
                </div>

                {/* Plan Selection Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  {/* STARTER */}
                  <div
                    onClick={() => setFormData({ ...formData, plan: "STARTER" })}
                    className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
                      formData.plan === "STARTER"
                        ? "border-[#6A2635] bg-[#FAF3F4] ring-1 ring-[#6A2635]"
                        : "border-[#CDC4B7] bg-white hover:border-[#6A2635]/50"
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#6A2635]">
                        Starter
                      </span>
                      <input
                        type="radio"
                        name="plan"
                        checked={formData.plan === "STARTER"}
                        onChange={() => {}}
                        className="accent-[#6A2635]"
                      />
                    </div>
                    <div className="mt-2 text-lg font-black text-[#140F0C]">Rs. 499<span className="text-xs font-normal text-[#71675E]">/mo</span></div>
                    <div className="text-[11px] text-[#71675E] mt-0.5">Setup: Rs. 4,999</div>
                    <p className="text-[11px] text-[#61574F] mt-2">Single branch, fast touch POS & basic inventory.</p>
                  </div>

                  {/* GROWTH */}
                  <div
                    onClick={() => setFormData({ ...formData, plan: "GROWTH" })}
                    className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
                      formData.plan === "GROWTH"
                        ? "border-[#6A2635] bg-[#FAF3F4] ring-1 ring-[#6A2635]"
                        : "border-[#CDC4B7] bg-white hover:border-[#6A2635]/50"
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#6A2635]">
                        Growth
                      </span>
                      <input
                        type="radio"
                        name="plan"
                        checked={formData.plan === "GROWTH"}
                        onChange={() => {}}
                        className="accent-[#6A2635]"
                      />
                    </div>
                    <div className="mt-2 text-lg font-black text-[#140F0C]">Rs. 1,499<span className="text-xs font-normal text-[#71675E]">/mo</span></div>
                    <div className="text-[11px] text-[#71675E] mt-0.5">Setup: Rs. 9,999</div>
                    <p className="text-[11px] text-[#61574F] mt-2">Multi-table dining, KDS, rooms, & full inventory.</p>
                  </div>

                  {/* ENTERPRISE */}
                  <div
                    onClick={() => setFormData({ ...formData, plan: "ENTERPRISE" })}
                    className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
                      formData.plan === "ENTERPRISE"
                        ? "border-[#6A2635] bg-[#FAF3F4] ring-1 ring-[#6A2635]"
                        : "border-[#CDC4B7] bg-white hover:border-[#6A2635]/50"
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#6A2635]">
                        Enterprise
                      </span>
                      <input
                        type="radio"
                        name="plan"
                        checked={formData.plan === "ENTERPRISE"}
                        onChange={() => {}}
                        className="accent-[#6A2635]"
                      />
                    </div>
                    <div className="mt-2 text-lg font-black text-[#140F0C]">Rs. 3,999<span className="text-xs font-normal text-[#71675E]">/mo</span></div>
                    <div className="text-[11px] text-[#71675E] mt-0.5">Setup: Customized</div>
                    <p className="text-[11px] text-[#61574F] mt-2">Unlimited branches, guest QR, folios, & IRD sync.</p>
                  </div>
                </div>

                {/* Modules Checklist */}
                <div className="space-y-2 pt-2">
                  <label className="text-xs sm:text-sm font-bold text-[#1F1915] block">
                    Enabled capabilities
                  </label>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {[
                      { key: "posBilling", label: "POS Billing & Invoicing" },
                      { key: "inventory", label: "Stock & Inventory Control" },
                      { key: "kdsKitchen", label: "Kitchen Display (KDS)" },
                      { key: "hotelRooms", label: "Hotel Rooms & Stays" },
                      { key: "guestQrPortal", label: "Guest QR Ordering" },
                      { key: "doubleEntryAccounting", label: "Double-Entry Accounting" },
                      { key: "reports", label: "Analytics & Reports" },
                      { key: "multiBranch", label: "Multi-Branch Support" },
                    ].map((mod) => (
                      <label
                        key={mod.key}
                        className="flex items-center gap-2 p-2 bg-white border border-[#CDC4B7] rounded-md cursor-pointer hover:bg-[#FAF7F2]"
                      >
                        <input
                          type="checkbox"
                          checked={formData.selectedModules[mod.key] || false}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              selectedModules: {
                                ...formData.selectedModules,
                                [mod.key]: e.target.checked,
                              },
                            })
                          }
                          className="accent-[#6A2635] w-3.5 h-3.5"
                        />
                        <span className="text-[12px] font-medium text-[#1F1915]">{mod.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: ADMINISTRATOR ACCOUNT */}
            {currentStep === 3 && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[#140F0C] leading-tight">
                    Set up your administrator account
                  </h1>
                  <p className="text-sm sm:text-base text-[#61574F] font-normal">
                    This account will hold master privileges over your new workspace.
                  </p>
                </div>

                <div className="space-y-3 pt-1">
                  <div className="space-y-1">
                    <label className="text-xs sm:text-sm font-bold text-[#1F1915] block">
                      Administrator full name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. John Doe"
                      value={formData.ownerName}
                      onChange={(e) => {
                        setFormData({ ...formData, ownerName: e.target.value });
                        if (fieldErrors.ownerName) setFieldErrors({ ...fieldErrors, ownerName: "" });
                      }}
                      className={`w-full px-3.5 py-2.5 sm:py-3 bg-white border rounded-lg text-xs sm:text-sm font-medium text-[#1F1915] placeholder:text-[#9E938B] focus:outline-none focus:border-[#6A2635] focus:ring-1 focus:ring-[#6A2635] ${
                        fieldErrors.ownerName ? "border-[#B33432]" : "border-[#CDC4B7]"
                      }`}
                    />
                    {fieldErrors.ownerName && (
                      <span className="text-xs text-[#B33432] font-semibold block">
                        {fieldErrors.ownerName}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs sm:text-sm font-bold text-[#1F1915] block">
                      Administrator email
                    </label>
                    <input
                      type="email"
                      placeholder="admin@yourbusiness.com"
                      value={formData.ownerEmail}
                      onChange={(e) => {
                        setFormData({ ...formData, ownerEmail: e.target.value });
                        if (fieldErrors.ownerEmail) setFieldErrors({ ...fieldErrors, ownerEmail: "" });
                      }}
                      className={`w-full px-3.5 py-2.5 sm:py-3 bg-white border rounded-lg text-xs sm:text-sm font-medium text-[#1F1915] placeholder:text-[#9E938B] focus:outline-none focus:border-[#6A2635] focus:ring-1 focus:ring-[#6A2635] ${
                        fieldErrors.ownerEmail ? "border-[#B33432]" : "border-[#CDC4B7]"
                      }`}
                    />
                    {fieldErrors.ownerEmail && (
                      <span className="text-xs text-[#B33432] font-semibold block">
                        {fieldErrors.ownerEmail}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs sm:text-sm font-bold text-[#1F1915] block">
                      Administrator phone
                    </label>
                    <input
                      type="tel"
                      placeholder="+977"
                      value={formData.ownerPhone}
                      onChange={(e) => setFormData({ ...formData, ownerPhone: e.target.value })}
                      className="w-full px-3.5 py-2.5 sm:py-3 bg-white border border-[#CDC4B7] rounded-lg text-xs sm:text-sm font-medium text-[#1F1915] placeholder:text-[#9E938B] focus:outline-none focus:border-[#6A2635] focus:ring-1 focus:ring-[#6A2635]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs sm:text-sm font-bold text-[#1F1915] block">
                      Account password
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={formData.password}
                        onChange={(e) => {
                          setFormData({ ...formData, password: e.target.value });
                          if (fieldErrors.password) setFieldErrors({ ...fieldErrors, password: "" });
                        }}
                        className={`w-full pl-3.5 pr-10 py-2.5 sm:py-3 bg-white border rounded-lg text-xs sm:text-sm font-medium text-[#1F1915] placeholder:text-[#9E938B] focus:outline-none focus:border-[#6A2635] focus:ring-1 focus:ring-[#6A2635] ${
                          fieldErrors.password ? "border-[#B33432]" : "border-[#CDC4B7]"
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7A6E66] hover:text-[#1F1915] p-1 cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {fieldErrors.password && (
                      <span className="text-xs text-[#B33432] font-semibold block">
                        {fieldErrors.password}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* STEP 4: REVIEW & CONFIRM */}
            {currentStep === 4 && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[#140F0C] leading-tight">
                    Review your workspace request
                  </h1>
                  <p className="text-sm sm:text-base text-[#61574F] font-normal">
                    Confirm your details before our provisioning team activates your workspace.
                  </p>
                </div>

                <div className="bg-white border border-[#D5CEC2] rounded-lg p-4 space-y-3 text-xs sm:text-sm">
                  <div className="flex justify-between py-1 border-b border-[#EEE7DD]">
                    <span className="text-[#71675E] font-medium">Business Name:</span>
                    <span className="font-bold text-[#140F0C]">{formData.businessName}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#EEE7DD]">
                    <span className="text-[#71675E] font-medium">Workspace URL:</span>
                    <span className="font-bold text-[#6A2635]">{formData.slug}.restroinn.com</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#EEE7DD]">
                    <span className="text-[#71675E] font-medium">Business Type:</span>
                    <span className="font-semibold text-[#140F0C]">
                      {formData.businessType === "RESTAURANT"
                        ? "Restaurant & Café"
                        : formData.businessType === "HOTEL"
                        ? "Hotel & Stay"
                        : "Hotel + Restaurant"}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#EEE7DD]">
                    <span className="text-[#71675E] font-medium">Operating Currency:</span>
                    <span className="font-semibold text-[#140F0C]">{formData.currency}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#EEE7DD]">
                    <span className="text-[#71675E] font-medium">Selected Tier:</span>
                    <span className="font-bold text-[#6A2635]">{formData.plan} PLAN</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#EEE7DD]">
                    <span className="text-[#71675E] font-medium">Administrator:</span>
                    <span className="font-semibold text-[#140F0C]">{formData.ownerName} ({formData.ownerEmail})</span>
                  </div>
                </div>

                <div className="p-3 bg-[#F2F6F9] border border-[#B8D2E6] rounded-lg text-xs text-[#315F85] flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    Your registration request will generate a unique tracking ID and proceed to verification. No charges are billed until activation.
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Form Actions Row (Footer of Card) */}
          <div className="pt-3 border-t border-[#EEE7DD] shrink-0">
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-sm font-semibold text-[#71675E]">
                Step {currentStep} of 4
              </span>
              <div className="flex items-center gap-2.5">
                {currentStep > 1 && (
                  <button
                    type="button"
                    onClick={handlePrevStep}
                    disabled={isLoading}
                    className="px-4 py-2 sm:py-2.5 rounded-lg border border-[#CDC4B7] bg-white text-[#292320] text-xs sm:text-sm font-bold hover:bg-[#FAF7F2] transition-colors cursor-pointer"
                  >
                    Back
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleNextStep}
                  disabled={isLoading}
                  className="px-6 sm:px-8 py-2.5 sm:py-3 rounded-lg bg-[#6A2635] hover:bg-[#521C28] text-white text-xs sm:text-sm font-bold flex items-center gap-2 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <>
                      <span>{currentStep === 4 ? "Submit Request" : "Continue"}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Bottom Legal Links */}
            <div className="flex justify-end items-center gap-2 text-[11px] sm:text-xs text-[#8C8074] pt-2">
              <Link href="/terms" className="hover:underline">
                Terms of Service
              </Link>
              <span>|</span>
              <Link href="/privacy" className="hover:underline">
                Privacy Policy
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
