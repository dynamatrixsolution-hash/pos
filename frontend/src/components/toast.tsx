"use client";

import React, { useState, useEffect } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

type ToastType = "success" | "error" | "info" | "warning";

interface ToastMessage {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

const TOAST_EVENT = "dynapos-toast-event";

export const toast = {
  show(message: string, type: ToastType = "info", duration = 4000) {
    if (typeof window !== "undefined") {
      let sanitizedMessage = message;
      if (typeof message === "string" && (
        message.includes("is not valid JSON") || 
        message.includes("Unexpected token")
      )) {
        sanitizedMessage = "Internal Server Error";
      }
      const event = new CustomEvent(TOAST_EVENT, {
        detail: { type, message: sanitizedMessage, duration } as ToastMessage,
      });
      window.dispatchEvent(event);
    }
  },
  success(message: string, duration = 4000) {
    this.show(message, "success", duration);
  },
  error(message: string, duration = 4000) {
    this.show(message, "error", duration);
  },
  info(message: string, duration = 4000) {
    this.show(message, "info", duration);
  },
  warning(message: string, duration = 4000) {
    this.show(message, "warning", duration);
  },
};

export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const handleToast = (e: Event) => {
      const detail = (e as CustomEvent<ToastMessage>).detail;
      const id = Math.random().toString(36).substring(2, 9);
      const newToast = { ...detail, id };
      
      setToasts((prev) => [...prev, newToast]);

      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, detail.duration || 4000);
    };

    window.addEventListener(TOAST_EVENT, handleToast);
    return () => window.removeEventListener(TOAST_EVENT, handleToast);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-3 max-w-sm w-full no-print">
      {toasts.map((t) => {
        let bg = "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100";
        let icon = <Info className="h-5 w-5 text-blue-500" />;

        if (t.type === "success") {
          bg = "bg-emerald-500 text-white border-emerald-600 shadow-emerald-500/10";
          icon = <CheckCircle2 className="h-5 w-5 text-white" />;
        } else if (t.type === "error") {
          bg = "bg-rose-500 text-white border-rose-600 shadow-rose-500/10";
          icon = <AlertCircle className="h-5 w-5 text-white" />;
        } else if (t.type === "warning") {
          bg = "bg-amber-500 text-white border-amber-600 shadow-amber-500/10";
          icon = <AlertCircle className="h-5 w-5 text-white" />;
        } else if (t.type === "info") {
          bg = "bg-blue-600 text-white border-blue-700 shadow-blue-500/10";
          icon = <Info className="h-5 w-5 text-white" />;
        }

        return (
          <div
            key={t.id}
            className={`flex items-start gap-3 p-4 rounded-2xl border shadow-xl animate-in slide-in-from-bottom-5 fade-in duration-300 ${bg}`}
          >
            <div className="shrink-0 mt-0.5">{icon}</div>
            <div className="flex-1 text-xs font-bold leading-relaxed">{t.message}</div>
            <button
              onClick={() => setToasts((prev) => prev.filter((item) => item.id !== t.id))}
              className="shrink-0 text-white/70 hover:text-white hover:bg-white/10 p-0.5 rounded-lg transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
