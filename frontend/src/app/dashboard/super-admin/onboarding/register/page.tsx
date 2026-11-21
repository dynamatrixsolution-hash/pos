"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import BusinessOnboardingWizard from "@/components/business-onboarding-wizard";

export default function SuperAdminRegisterTenantPage() {
  return (
    <div className="space-y-4 text-[#292320]">
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard/super-admin/onboarding"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#71675E] hover:text-[#292320] transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Pipeline
        </Link>
      </div>

      {/* Embedded Wizard in Super Admin Mode */}
      <div className="bg-[#FFFCF7] border border-[#D8CEC1]/80 p-6 rounded-lg shadow-xs">
        <BusinessOnboardingWizard mode="SUPER_ADMIN" />
      </div>
    </div>
  );
}

