"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Home, RefreshCw, AlertTriangle, ShieldCheck } from "lucide-react";
import StatusGraphic from "@/components/status-graphic";

export default function GlobalAppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("RestroInn Application Error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#F7F3EC] text-[#292320] flex flex-col justify-between selection:bg-[#6B2837] selection:text-[#FFFCF7]">
      {/* Header */}
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
          System Alert • Status 500
        </span>
      </header>

      {/* Main Content Layout */}
      <main className="flex-1 flex items-center justify-center px-6 py-12 sm:py-16">
        <div className="max-w-4xl w-full grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
          
          {/* Left Column */}
          <div className="lg:col-span-7 space-y-5 text-left">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#FAEAEC] border border-[#E9B6B7] text-[#B33432] text-xs font-semibold">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Operational Interruption</span>
            </div>

            <div className="space-y-1.5">
              <h1 className="text-6xl sm:text-7xl font-extrabold tracking-tight text-[#6B2837] tabular-nums">
                500
              </h1>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#292320]">
                Unexpected System Error
              </h2>
            </div>

            <p className="text-sm text-[#71675E] leading-relaxed max-w-md">
              The application encountered an unexpected runtime fault while processing this transaction. Operational data integrity remains preserved.
            </p>

            {error.digest && (
              <p className="text-[11px] font-mono text-[#71675E] bg-[#EEE7DD] px-2.5 py-1 rounded border border-[#D8CEC1] inline-block tabular-nums">
                Event Reference: {error.digest}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => reset()}
                className="px-5 py-2.5 rounded-md bg-[#6B2837] hover:bg-[#541E2A] text-[#FFFCF7] text-xs font-semibold flex items-center gap-2 transition-colors shadow-xs cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Try Again</span>
              </button>

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
                className="px-4 py-2.5 rounded-md border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] hover:bg-[#EEE7DD] text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Home className="w-3.5 h-3.5" />
                <span>Dashboard</span>
              </Link>
            </div>
          </div>

          {/* Right Column: Reusable Animated Graphic */}
          <div className="lg:col-span-5 flex items-center justify-center">
            <StatusGraphic badgeText="500 fault" />
          </div>

        </div>
      </main>

      {/* Footer */}
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
