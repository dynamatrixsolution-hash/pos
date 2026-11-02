import React from "react";
import Link from "next/link";
import { ArrowLeft, ShieldCheck, Lock } from "lucide-react";

export const metadata = {
  title: "Privacy Policy – RestroInn",
  description: "Privacy policy and guest data handling procedures for RestroInn Hospitality Management.",
};

export default function PrivacyPage() {
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
        <Link
          href="/dashboard"
          className="text-xs font-semibold text-[#6B2837] hover:underline flex items-center gap-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Dashboard</span>
        </Link>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-10 space-y-8">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#28634B]">
            Data Governance & Privacy
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#292320] mt-1">
            Privacy Policy
          </h1>
          <p className="text-xs text-[#71675E] mt-1">
            Last updated: November 1, 2026
          </p>
        </div>

        <div className="space-y-6 text-sm text-[#292320] leading-relaxed bg-[#FFFCF7] p-6 rounded-lg border border-[#D8CEC1]">
          <section className="space-y-2">
            <h2 className="text-base font-bold text-[#6B2837] flex items-center gap-2">
              <Lock className="w-4 h-4 text-[#A77B38]" />
              <span>1. Guest Privacy & Turnover Protection</span>
            </h2>
            <p className="text-[#71675E]">
              RestroInn implements strict tenant isolation and guest privacy barriers. When hotel guests check out, room QR tokens and session grants are invalidated immediately to prevent subsequent occupants from viewing prior guest folios or charges.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-[#6B2837]">
              2. Data Collected & Processed
            </h2>
            <p className="text-[#71675E]">
              We process operational records required for hospitality billing and fiscal compliance, including guest names, room reservations, dining order histories, and audit timestamps. Cardholder account numbers are never stored directly in plain text.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-[#6B2837]">
              3. Data Retention & Legal Storage
            </h2>
            <p className="text-[#71675E]">
              Invoice archives, tax receipts, and ledger audit entries are stored securely in compliance with national revenue authority mandates and data retention standards.
            </p>
          </section>
        </div>
      </main>

      <footer className="px-6 py-4 border-t border-[#D8CEC1] text-center text-xs text-[#71675E] bg-[#FFFCF7]">
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link href="/terms" className="hover:text-[#292320] underline">
            Terms of Service
          </Link>
          <span>•</span>
          <Link href="/auth/login" className="hover:text-[#292320] underline">
            Sign In
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

