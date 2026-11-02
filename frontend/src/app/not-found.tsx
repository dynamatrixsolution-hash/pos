"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, Home, Compass, ShieldCheck } from "lucide-react";
import StatusGraphic from "@/components/status-graphic";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#F7F3EC] text-[#292320] flex flex-col justify-between selection:bg-[#6B2837] selection:text-[#FFFCF7]">
      {/* Top subtle navbar / brand indicator */}
      <header className="px-6 py-4 flex items-center justify-between border-b border-[#D8CEC1]">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="h-8 w-8 rounded-md bg-[#6B2837] flex items-center justify-center text-[#FFFCF7] font-bold text-sm border border-[#541E2A]">
            R
          </div>
          <span className="font-bold text-sm tracking-tight text-[#292320]">
            RestroInn
          </span>
        </Link>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#71675E]">
          Error 404 • Page Not Found
        </span>
      </header>

      {/* Main 404 Layout: Left Typography & Actions, Right Animated Hospitality/Compass Graphic */}
      <main className="flex-1 flex items-center justify-center px-6 py-12 sm:py-16">
        <div className="max-w-4xl w-full grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
          
          {/* Left Column: Clear Status, Headline, Explanation & Actions */}
          <div className="lg:col-span-7 space-y-6 text-left">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#EEE7DD] border border-[#D8CEC1] text-[#6B2837] text-xs font-semibold">
              <Compass className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: "12s" }} />
              <span>Route Coordinates Missing</span>
            </div>

            <div className="space-y-2">
              <h1 className="text-6xl sm:text-7xl font-extrabold tracking-tight text-[#6B2837] tabular-nums">
                404
              </h1>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#292320]">
                Oops! Page not found.
              </h2>
            </div>

            <p className="text-sm text-[#71675E] leading-relaxed max-w-md">
              The page you are looking for doesn’t exist or has been relocated by staff. Let’s get you back on track to your orders, rooms, or POS terminal.
            </p>

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

          {/* Right Column: Global Reusable Status Graphic */}
          <div className="lg:col-span-5 flex items-center justify-center">
            <StatusGraphic badgeText="404 lost" />
          </div>

        </div>
      </main>

      {/* Footer with Terms of Service and Privacy Policy */}
      <footer className="px-6 py-4 border-t border-[#D8CEC1] text-center text-xs text-[#71675E]">
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link href="/terms" className="hover:text-[#292320] underline transition-colors">
            Terms of Service
          </Link>
          <span>•</span>
          <Link href="/privacy" className="hover:text-[#292320] underline transition-colors">
            Privacy Policy
          </Link>
          <span>•</span>
          <Link href="/auth/login" className="hover:text-[#292320] underline transition-colors">
            POS Terminal Login
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
