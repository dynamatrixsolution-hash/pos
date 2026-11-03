"use client";

import React, { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, LogIn, ShieldAlert, ShieldCheck } from "lucide-react";
import StatusGraphic from "@/components/status-graphic";

function AuthErrorContent() {
  const searchParams = useSearchParams();
  const errorCode = searchParams.get("error") || "AuthenticationError";

  const getErrorInfo = (code: string) => {
    switch (code) {
      case "Configuration":
        return {
          badge: "Config Fault",
          codeNumber: "AUTH",
          title: "Authentication Configuration Issue",
          description:
            "The authentication system encountered a server configuration mismatch or missing credentials. Property administrators can verify the secret configuration in the platform environment.",
        };
      case "AccessDenied":
        return {
          badge: "Access Denied",
          codeNumber: "403",
          title: "Terminal Access Denied",
          description:
            "Your account does not have sufficient role permissions to access this terminal or operational section. Please verify your staff credentials.",
        };
      case "Verification":
        return {
          badge: "Verification",
          codeNumber: "EXPIRED",
          title: "Verification Token Expired",
          description:
            "The verification link or sign-in token has expired or has already been used. Please request a new link from the login portal.",
        };
      case "OAuthSignin":
      case "OAuthCallback":
      case "OAuthCreateAccount":
      case "EmailCreateAccount":
      case "Callback":
        return {
          badge: "Provider Error",
          codeNumber: "OAUTH",
          title: "Provider Handshake Failed",
          description:
            "Unable to complete sign-in through the authentication provider. Please try signing in directly with your staff email and password.",
        };
      case "SessionRequired":
        return {
          badge: "Session Expired",
          codeNumber: "401",
          title: "Session Expired",
          description:
            "Your terminal session has expired due to inactivity. Please sign in again to resume POS billing, table management, or front desk operations.",
        };
      default:
        return {
          badge: "Auth Error",
          codeNumber: "AUTH",
          title: "Unable to Authenticate Terminal",
          description:
            "An error occurred while verifying your credentials. Please return to the login page and try again, or consult your hotel/restaurant shift manager.",
        };
    }
  };

  const errorDetails = getErrorInfo(errorCode);

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
          Authentication • Security Gateway
        </span>
      </header>

      {/* Main Content Layout */}
      <main className="flex-1 flex items-center justify-center px-6 py-12 sm:py-16">
        <div className="max-w-4xl w-full grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
          
          {/* Left Column */}
          <div className="lg:col-span-7 space-y-5 text-left">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#FAEAEC] border border-[#E9B6B7] text-[#B33432] text-xs font-semibold">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>{errorDetails.title}</span>
            </div>

            <div className="space-y-1.5">
              <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight text-[#6B2837] tabular-nums">
                {errorDetails.codeNumber}
              </h1>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#292320]">
                {errorDetails.title}
              </h2>
            </div>

            <p className="text-sm text-[#71675E] leading-relaxed max-w-md">
              {errorDetails.description}
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== "undefined") {
                    window.history.length > 1 ? window.history.back() : (window.location.href = "/auth/login");
                  }
                }}
                className="px-4 py-2.5 rounded-md border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] hover:bg-[#EEE7DD] text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Go Back</span>
              </button>

              <Link
                href="/auth/login"
                className="px-5 py-2.5 rounded-md bg-[#6B2837] hover:bg-[#541E2A] text-[#FFFCF7] text-xs font-semibold flex items-center gap-2 transition-colors shadow-xs"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In to Terminal</span>
              </Link>
            </div>
          </div>

          {/* Right Column: Animated Status Graphic */}
          <div className="lg:col-span-5 flex items-center justify-center">
            <StatusGraphic badgeText={errorDetails.badge} />
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

export default function AuthErrorPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F7F3EC] flex items-center justify-center">
          <div className="h-64 w-64 rounded-lg bg-[#EEE7DD] animate-pulse" />
        </div>
      }
    >
      <AuthErrorContent />
    </Suspense>
  );
}
