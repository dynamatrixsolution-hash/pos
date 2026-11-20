"use client";

import { toast, ToastType } from "@/components/toast";

/**
 * Universal Global Notification & Snackbar Class
 * RestroInn POS & PMS
 * 
 * Ensures all success, failure/error, and system messages across the entire project
 * are displayed via modern semantic snackbars/toasts.
 * Inline messages are strictly reserved for form field validation.
 */
const AUTH_ERROR_MESSAGES: Record<string, string> = {
  CredentialsSignin: "Your email or password does not match. Please check and try again.",
  AccessDenied: "Access denied. Your account or business subscription may be inactive.",
  Configuration: "Authentication service configuration error. Please contact your administrator.",
  Verification: "Verification link expired or invalid. Please request a new one.",
};

export function getErrorMessage(
  err: unknown,
  fallback = "Something went wrong. Please try again."
): string {
  if (!err) return fallback;

  if (typeof err === "string") {
    return AUTH_ERROR_MESSAGES[err] || err;
  }

  const anyErr = err as { statusCode?: number; message?: string; error?: string; code?: string };
  const code = anyErr.error || anyErr.code;
  if (code && AUTH_ERROR_MESSAGES[code]) {
    return AUTH_ERROR_MESSAGES[code];
  }

  if (typeof anyErr.statusCode === "number") {
    if (anyErr.statusCode >= 502 && anyErr.statusCode <= 504) {
      return "Server is temporarily unreachable. Please wait a moment and try again.";
    }
    if (anyErr.statusCode === 500) {
      return anyErr.message && !anyErr.message.startsWith("Request failed")
        ? anyErr.message
        : "A server error occurred. Please try again or contact support.";
    }
  }

  const msg = anyErr.message || "";
  if (AUTH_ERROR_MESSAGES[msg]) return AUTH_ERROR_MESSAGES[msg];
  if (/failed to fetch|networkerror|network request failed|load failed/i.test(msg)) {
    return "Cannot connect to the server. Please check your internet connection or try again.";
  }

  return msg.trim() || fallback;
}

export class Notify {
  static success(message: string, duration = 4000): void {
    toast.success(message, duration);
  }

  static failure(message: string, duration = 5000): void {
    toast.error(message, duration);
  }

  static error(message: string, duration = 5000): void {
    toast.error(message, duration);
  }

  static fromError(err: unknown, fallback?: string, duration = 5000): void {
    toast.error(getErrorMessage(err, fallback), duration);
  }

  static warning(message: string, duration = 4500): void {
    toast.warning(message, duration);
  }

  static info(message: string, duration = 4000): void {
    toast.info(message, duration);
  }

  static show(message: string, type: ToastType = "info", duration = 4000): void {
    toast.show(message, type, duration);
  }
}

// Global browser window binding for scripts or legacy callers
if (typeof window !== "undefined") {
  (window as unknown as { Notify: typeof Notify }).Notify = Notify;
}

export default Notify;

