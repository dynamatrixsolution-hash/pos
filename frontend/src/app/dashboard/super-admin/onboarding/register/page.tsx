"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, Rocket } from "lucide-react";
import BusinessOnboardingWizard from "@/components/business-onboarding-wizard";

export default function SuperAdminRegisterTenantPage() {
  return (
    <div className="space-y-6 text-[#292320]">
      {/* Header & Back Link */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#FFFCF7] border border-[#D8CEC1]/80 p-5 rounded-lg shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-xs text-[#71675E] font-medium mb-1">
            <Link href="/dashboard/super-admin" className="hover:text-[#6B2837]">
              Platform
            </Link>
            <span>/</span>
            <Link href="/dashboard/super-admin/onboarding" className="hover:text-[#6B2837]">
              Onboarding
            </Link>
            <span>/</span>
            <span className="text-[#292320] font-semibold">New Registration</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-[#292320] flex items-center gap-2">
            <Rocket className="h-5 w-5 text-[#6B2837]" /> Provision New Business
          </h1>
          <p className="text-xs text-[#71675E] mt-0.5">
            Register and onboard a restaurant, hotel, or retail property directly into the platform directory.
          </p>
        </div>

        <Link
          href="/dashboard/super-admin/onboarding"
          className="px-3.5 py-2 bg-[#FFFCF7] hover:bg-[#F7F3EC] border border-[#D8CEC1] text-[#292320] rounded-md text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5"
        >
          <ArrowLeft className="h-4 w-4 text-[#71675E]" /> Back to Pipeline
        </Link>
      </div>

      {/* Embedded Wizard in Super Admin Mode */}
      <div className="bg-[#FFFCF7] border border-[#D8CEC1]/80 p-6 rounded-lg shadow-xs">
        <BusinessOnboardingWizard mode="SUPER_ADMIN" />
      </div>
    </div>
  );
}

