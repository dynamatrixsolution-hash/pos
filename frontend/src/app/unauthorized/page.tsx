"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, Home, ShieldAlert, Lock, ShieldCheck } from "lucide-react";
import StatusGraphic from "@/components/status-graphic";

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen bg-[#F7F3EC] text-[#292320] flex flex-col justify-between selection:bg-[#6B2837] selection:text-[#FFFCF7]">
      <header className="px-6 py-4 flex items-center justify-between border-b border-[#D8CEC1] bg-[#FFFCF7]">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="h-8 w-8 rounded-md bg-[#6B2837] flex items-center justify-center text-[#FFFCF7] font-bold text-sm border border-[#541E2A]">
            R
          </div>
          <span className="font-bold text-sm tracking-tight text-[#292320]">
            RestroInn
          </span>
        </Link>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#B33432]">
          Security Gate • 403 Forbidden
        </span>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12 sm:py-16">
        <div className="max-w-4xl w-full grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
          
          <div className="lg:col-span-7 space-y-6 text-left">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#FAF4ED] border border-[#B33432]/30 text-[#B33432] text-xs font-semibold">
              <ShieldAlert className="w-3.5 h-3.5 text-[#B33432]" />
              <span>Permission Denied</span>
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
              Your staff account does not have sufficient role clearance for this page or resource. Please check with your supervisor or administrator.
            </p>

            <div className="p-3.5 rounded-lg bg-[#FFFCF7] border border-[#D8CEC1] text-xs text-[#71675E] space-y-1 max-w-md">
              <div className="flex items-center gap-2 font-semibold text-[#292320]">
                <Lock className="w-3.5 h-3.5 text-[#A77B38]" />
                <span>Security Clearance Required</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                Contact your property administrator if you believe your account role assignment is incorrect.
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
                <span>Return to Dashboard</span>
              </Link>
            </div>
          </div>

          <div className="lg:col-span-5 flex items-center justify-center">
            <StatusGraphic badgeText="403 lock" />
          </div>

        </div>
      </main>

      <footer className="px-6 py-4 border-t border-[#D8CEC1] text-center text-xs text-[#71675E] bg-[#FFFCF7]">
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link href="/terms" className="hover:text-[#292320] underline transition-colors">
            Terms of Service
          </Link>
          <span>•</span>
          <Link href="/privacy" className="hover:text-[#292320] underline transition-colors">
            Privacy Policy
          </Link>
          <span>•</span>
          <span className="inline-flex items-center gap-1 text-[#28634B]">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>RestroInn Platform</span>
          </span>
        </div>
      </footer>
    </div>
  );
}

