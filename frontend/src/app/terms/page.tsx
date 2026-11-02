import React from "react";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";

export const metadata = {
  title: "Terms of Service – RestroInn",
  description: "Terms and conditions governing the use of RestroInn Point of Sale and Hospitality Management.",
};

export default function TermsPage() {
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
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#A77B38]">
            Legal Agreements
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#292320] mt-1">
            Terms of Service
          </h1>
          <p className="text-xs text-[#71675E] mt-1">
            Last updated: November 1, 2026
          </p>
        </div>

        <div className="space-y-6 text-sm text-[#292320] leading-relaxed bg-[#FFFCF7] p-6 rounded-lg border border-[#D8CEC1]">
          <section className="space-y-2">
            <h2 className="text-base font-bold text-[#6B2837]">
              1. Acceptance of Terms
            </h2>
            <p className="text-[#71675E]">
              By accessing, registering for, or operating the RestroInn Point of Sale and Hotel Management Platform, you agree to comply with and be bound by these Terms of Service. If you are operating on behalf of an entity, you confirm that you have the authority to bind such entity.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-[#6B2837]">
              2. Terminal & Account Security
            </h2>
            <p className="text-[#71675E]">
              Users are responsible for safeguarding login credentials, cash drawer access codes, and device lock identifiers. All activity conducted under authenticated staff, cashier, or manager profiles remains the operational responsibility of the account holder.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-[#6B2837]">
              3. Financial Compliance & Fiscal Records
            </h2>
            <p className="text-[#71675E]">
              RestroInn provides immutable transaction registers, double-entry ledgers, and fiscal reporting integrations (including IRD-compliant auditing). You agree not to manipulate or attempt to alter synchronized sales invoices or tax registers.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-[#6B2837]">
              4. Availability & Offline Resilience
            </h2>
            <p className="text-[#71675E]">
              While RestroInn provides offline transaction buffering and local print spooling during network interruptions, you acknowledge that synchronized ledger reconciliation requires intermittent network availability.
            </p>
          </section>
        </div>
      </main>

      <footer className="px-6 py-4 border-t border-[#D8CEC1] text-center text-xs text-[#71675E] bg-[#FFFCF7]">
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link href="/privacy" className="hover:text-[#292320] underline">
            Privacy Policy
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

