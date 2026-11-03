"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, Home, ShieldAlert, Lock, UserCheck, LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

export default function DashboardUnauthorizedPage() {
  return (
    <div className="min-h-[75vh] flex items-center justify-center p-6 text-[#292320]">
      <div className="max-w-xl w-full bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg p-6 sm:p-8 space-y-6 shadow-2xs">
        {/* Header Badge */}
        <div className="flex items-center justify-between border-b border-[#EEE7DD] pb-4">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-[#B91C1C]/10 text-[#B91C1C] text-xs font-semibold">
            <ShieldAlert className="w-4 h-4 text-[#B91C1C]" />
            <span>403 Forbidden • Access Restricted</span>
          </div>
          <span className="text-[11px] font-mono text-[#71675E] uppercase tracking-wider">
            RBAC Enforcement
          </span>
        </div>

        {/* Content */}
        <div className="space-y-3">
          <div className="text-4xl font-extrabold tracking-tight text-[#292320] tabular-nums font-mono">
            403
          </div>
          <h1 className="text-lg font-bold tracking-tight text-[#292320]">
            Access Clearance Not Granted
          </h1>
          <p className="text-xs text-[#71675E] leading-relaxed">
            Your current authenticated account role does not have permission to view or manage this specific module. If you believe this is in error, contact your property owner or platform administrator.
          </p>
        </div>

        {/* Security Grants Info Card */}
        <div className="p-3.5 rounded-lg bg-[#F7F3EC] border border-[#D8CEC1] text-xs text-[#71675E] space-y-1.5">
          <div className="flex items-center gap-1.5 font-semibold text-[#292320]">
            <Lock className="w-3.5 h-3.5 text-[#6B2837]" />
            <span>Security Policy Note</span>
          </div>
          <p className="text-[11px] leading-relaxed">
            Business management, financial ledgers, inventory audits, and terminal settings require valid role clearance (<code className="px-1 py-0.5 rounded bg-[#EEE7DD] text-[#292320] font-mono">OWNER</code>, <code className="px-1 py-0.5 rounded bg-[#EEE7DD] text-[#292320] font-mono">MANAGER</code>, or <code className="px-1 py-0.5 rounded bg-[#EEE7DD] text-[#292320] font-mono">SUPER_ADMIN</code>).
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#EEE7DD]">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.history.length > 1 ? window.history.back() : (window.location.href = "/dashboard");
                }
              }}
              className="px-3 py-1.5 rounded border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] hover:bg-[#EEE7DD] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Go Back</span>
            </button>

            <Link
              href="/dashboard"
              className="px-3.5 py-1.5 rounded bg-[#6B2837] hover:bg-[#521E2A] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs"
            >
              <Home className="w-3.5 h-3.5" />
              <span>Workspace Dashboard</span>
            </Link>
          </div>

          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/auth/login" })}
            className="text-xs font-medium text-[#71675E] hover:text-[#B91C1C] flex items-center gap-1 cursor-pointer"
          >
            <LogOut className="w-3 h-3" />
            <span>Switch Account</span>
          </button>
        </div>
      </div>
    </div>
  );
}
