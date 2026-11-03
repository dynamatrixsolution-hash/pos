"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { RefreshCw, Home } from "lucide-react";
import StatusGraphic from "@/components/status-graphic";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Critical Root Error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-[#F7F3EC] text-[#292320] flex flex-col justify-between m-0 font-sans">
        <header className="px-6 py-4 flex items-center justify-between border-b border-[#D8CEC1]">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-md bg-[#6B2837] flex items-center justify-center text-[#FFFCF7] font-bold text-sm">
              R
            </div>
            <span className="font-bold text-sm tracking-tight text-[#292320]">
              RestroInn
            </span>
          </div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#71675E]">
            Critical Platform Exception
          </span>
        </header>

        <main className="flex-1 flex items-center justify-center px-6 py-12">
          <div className="max-w-4xl w-full grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-7 space-y-5 text-left">
              <h1 className="text-5xl font-extrabold text-[#6B2837] tabular-nums">
                System Fault
              </h1>
              <p className="text-sm text-[#71675E] leading-relaxed max-w-md">
                A critical framework error interrupted this session. You can reload the application runtime or return to the root dashboard.
              </p>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => reset()}
                  className="px-5 py-2.5 rounded-md bg-[#6B2837] hover:bg-[#541E2A] text-[#FFFCF7] text-xs font-semibold flex items-center gap-2 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Reload Session</span>
                </button>
                <Link
                  href="/dashboard"
                  className="px-4 py-2.5 rounded-md border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] text-xs font-semibold flex items-center gap-2 cursor-pointer"
                >
                  <Home className="w-3.5 h-3.5" />
                  <span>Dashboard</span>
                </Link>
              </div>
            </div>

            <div className="lg:col-span-5 flex items-center justify-center">
              <StatusGraphic badgeText="Fatal Fault" />
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
