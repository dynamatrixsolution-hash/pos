"use client";

import React, { useState, useEffect } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastMessage {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

const TOAST_EVENT = "restroinn-toast-event";

export const toast = {
  show(message: string, type: ToastType = "info", duration = 4000) {
    if (typeof window !== "undefined") {
      let sanitizedMessage = message;
      if (
        typeof message === "string" &&
        (message.includes("is not valid JSON") ||
          message.includes("Unexpected token"))
      ) {
        sanitizedMessage = "Internal Server Error. Please try again.";
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
  error(message: string, duration = 5000) {
    this.show(message, "error", duration);
  },
  info(message: string, duration = 4000) {
    this.show(message, "info", duration);
  },
  warning(message: string, duration = 4000) {
    this.show(message, "warning", duration);
  },
};

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
}

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
      }, detail.duration || 4500);
    };

    window.addEventListener(TOAST_EVENT, handleToast);

    // Gracefully route any legacy window.alert calls to the toast notification system
    if (typeof window !== "undefined") {
      (window as any).alert = (msg?: any) => {
        toast.warning(String(msg || "Notification"));
      };
    }

    return () => {
      window.removeEventListener(TOAST_EVENT, handleToast);
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-5 right-5 z-[99999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none select-none no-print"
    >
      {toasts.map((t) => {
        let containerStyle =
          "bg-[#FFFCF7] text-[#292320] border-[#D8CEC1]";
        let icon = <Info className="h-4 w-4 text-[#315F85] shrink-0" />;

        if (t.type === "success") {
          containerStyle =
            "bg-[#F1F7F4] text-[#28634B] border-[#C3DED0]";
          icon = <CheckCircle2 className="h-4 w-4 text-[#28634B] shrink-0" />;
        } else if (t.type === "error") {
          containerStyle =
            "bg-[#FAF0F1] text-[#B33432] border-[#E9B6B7]";
          icon = <AlertCircle className="h-4 w-4 text-[#B33432] shrink-0" />;
        } else if (t.type === "warning") {
          containerStyle =
            "bg-[#FDF7ED] text-[#946000] border-[#EDD7AD]";
          icon = <AlertCircle className="h-4 w-4 text-[#946000] shrink-0" />;
        } else if (t.type === "info") {
          containerStyle =
            "bg-[#F2F6F9] text-[#315F85] border-[#B8D2E6]";
          icon = <Info className="h-4 w-4 text-[#315F85] shrink-0" />;
        }

        return (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-2.5 p-3.5 rounded-lg border shadow-xs animate-in slide-in-from-bottom-3 fade-in duration-200 transition-all ${containerStyle}`}
          >
            <div className="shrink-0 mt-0.5">{icon}</div>
            <div className="flex-1 text-xs font-semibold leading-relaxed">
              {t.message}
            </div>
            <button
              type="button"
              onClick={() =>
                setToasts((prev) => prev.filter((item) => item.id !== t.id))
              }
              className="shrink-0 opacity-60 hover:opacity-100 p-0.5 rounded cursor-pointer transition-opacity"
              aria-label="Close notification"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
