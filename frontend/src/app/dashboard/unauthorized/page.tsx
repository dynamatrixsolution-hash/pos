"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, Home, ShieldAlert, Lock, UserCheck, ShieldCheck } from "lucide-react";
import StatusGraphic from "@/components/status-graphic";

export default function DashboardUnauthorizedPage() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center p-6 text-[#292320]">
      <div className="max-w-4xl w-full grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
        
        {/* Left Column: Role Restriction Typography & CTAs */}
        <div className="lg:col-span-7 space-y-6 text-left">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#FAF4ED] border border-[#B33432]/30 text-[#B33432] text-xs font-semibold">
            <ShieldAlert className="w-3.5 h-3.5 text-[#B33432]" />
            <span>403 Forbidden • Access Restricted</span>
          </div>

          <div className="space-y-2">
            <h1 className="text-6xl sm:text-7xl font-extrabold tracking-tight text-[#B33432] tabular-nums">
              403
            </h1>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#292320]">
              Access not authorized.
            </h2>
          </div>

          <p className="text-sm text-[#71675E] leading-relaxed max-w-md">
            Your authenticated role or staff terminal does not have clearance to view this module. If you require permission, ask your property manager or administrator to update your role permissions.
          </p>

          <div className="p-3.5 rounded-lg bg-[#FFFCF7] border border-[#D8CEC1] text-xs text-[#71675E] space-y-1 max-w-md">
            <div className="flex items-center gap-2 font-semibold text-[#292320]">
              <Lock className="w-3.5 h-3.5 text-[#A77B38]" />
              <span>Role-Based Access Control (RBAC) Active</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              Financial ledgers, staff audits, and terminal configuration require specific security grants (`OWNER`, `MANAGER`, or `ADMIN`).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.history.length > 1 ? window.history.back() : (window.location.href = "/dashboard");
                }
              }}
              className="px-4 py-2.5 rounded-md border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] hover:bg-[#EEE7DD] text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Go Back</span>
            </button>

            <Link
              href="/dashboard"
              className="px-5 py-2.5 rounded-md bg-[#6B2837] hover:bg-[#541E2A] text-[#FFFCF7] text-xs font-semibold flex items-center gap-2 transition-colors shadow-xs"
            >
              <Home className="w-3.5 h-3.5" />
              <span>Back to Dashboard</span>
            </Link>
          </div>
        </div>

        {/* Right Column: Reusable Status Graphic with 403 Lock Status */}
        <div className="lg:col-span-5 flex items-center justify-center">
          <StatusGraphic badgeText="403 lock" />
        </div>

      </div>
    </div>
  );
}

