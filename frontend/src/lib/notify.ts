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

