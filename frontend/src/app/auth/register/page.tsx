"use client";

import React from "react";
import BusinessOnboardingWizard from "@/components/business-onboarding-wizard";

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-slate-50/50 py-8 px-4 sm:px-6 lg:px-8">
      <BusinessOnboardingWizard mode="PUBLIC_USER" />
    </div>
  );
}
