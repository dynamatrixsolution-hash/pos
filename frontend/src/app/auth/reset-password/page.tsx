"use client";

import React, { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Eye, EyeOff, KeyRound } from "lucide-react";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const email = searchParams.get("email") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const missingParams = !token || !email;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email, token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to reset password.");
      }
      setDone(true);
    } catch (err: any) {
      setError(err.message || "Unable to complete password reset.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F3EC] text-[#292320] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] p-6 space-y-5">
        <div className="flex items-center gap-3 border-b border-[#D8CEC1] pb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#6B2837] text-[#FFFCF7]">
            <KeyRound className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-[#292320]">Reset Account Password</h1>
            <p className="text-xs text-[#71675E]">RestroInn Hospitality Platform</p>
          </div>
        </div>

        {done ? (
          <div className="space-y-4 py-2 text-center">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-[#C3DED0] bg-[#EAF3EE] text-[#28634B]">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#292320]">Password Updated</h2>
              <p className="mt-1 text-xs text-[#71675E]">
                Your password for <span className="font-mono font-semibold text-[#292320]">{email}</span> has been reset.
              </p>
            </div>
            <Link
              href="/auth/login"
              className="inline-flex w-full items-center justify-center rounded-lg bg-[#6B2837] px-4 py-2.5 text-xs font-semibold text-[#FFFCF7] transition-colors hover:bg-[#541E2A]"
            >
              Continue to Sign In
            </Link>
          </div>
        ) : missingParams ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-[#E9B6B7] bg-[#FAEAEC] p-3 text-xs font-medium text-[#B33432]">
              This password reset link is incomplete or invalid. Please request a fresh reset link from your platform administrator.
            </div>
            <Link
              href="/auth/login"
              className="inline-flex w-full items-center justify-center rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] px-4 py-2 text-xs font-semibold text-[#292320] hover:bg-[#EEE7DD]"
            >
              Back to Sign In
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] px-3 py-2 text-xs">
              <span className="text-[#71675E]">Account: </span>
              <span className="font-mono font-semibold text-[#292320]">{email}</span>
            </div>

            {error && (
              <div className="rounded-lg border border-[#E9B6B7] bg-[#FAEAEC] p-3 text-xs font-medium text-[#B33432]">
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="new-password" className="block text-xs font-semibold text-[#292320]">
                New Password
              </label>
              <div className="relative">
                <input
                  id="new-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter at least 6 characters"
                  className="w-full rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] px-3 py-2 pr-9 text-xs text-[#292320] focus:border-[#6B2837] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#71675E] hover:text-[#292320] cursor-pointer"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="confirm-password" className="block text-xs font-semibold text-[#292320]">
                Confirm New Password
              </label>
              <input
                id="confirm-password"
                name="confirmPassword"
                type={showPassword ? "text" : "password"}
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your new password"
                className="w-full rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] px-3 py-2 text-xs text-[#292320] focus:border-[#6B2837] focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-[#6B2837] px-4 py-2.5 text-xs font-semibold text-[#FFFCF7] transition-colors hover:bg-[#541E2A] disabled:opacity-50 cursor-pointer"
            >
              {submitting ? "Updating Password..." : "Set New Password"}
            </button>

            <div className="text-center">
              <Link href="/auth/login" className="text-xs font-medium text-[#71675E] hover:text-[#6B2837]">
                Back to Sign In
              </Link>
            </div>
          </form>
        )}

        <div className="border-t border-[#D8CEC1] pt-3 text-center text-[11px] text-[#71675E]">
          By continuing, you agree to our{" "}
          <Link href="/terms" className="underline hover:text-[#292320]">Terms of Service</Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline hover:text-[#292320]">Privacy Policy</Link>.
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F7F3EC] flex items-center justify-center p-4">
          <div className="w-full max-w-md h-80 rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] animate-pulse" />
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
