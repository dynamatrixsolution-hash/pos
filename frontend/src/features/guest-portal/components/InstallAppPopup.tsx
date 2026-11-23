"use client";

import React, { useState, useEffect } from "react";
import { Download, Smartphone, X } from "lucide-react";
import {
  getDeferredInstallPrompt,
  INSTALL_READY_EVENT,
  triggerNativeInstall,
} from "@/components/pwa-registrar";

const DISMISS_KEY = "restroinn_pwa_popup_dismissed_until";

export function InstallAppPopup({ businessName }: { businessName: string }) {
  const [visible, setVisible] = useState(false);
  const [hasNativePrompt, setHasNativePrompt] = useState(false);
  const [showIosSteps, setShowIosSteps] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) return;

    try {
      const until = Number(localStorage.getItem(DISMISS_KEY) || "0");
      if (until > Date.now()) return;
    } catch {
      // ignore
    }

    if (getDeferredInstallPrompt()) {
      setHasNativePrompt(true);
    }

    const onReady = () => {
      setHasNativePrompt(true);
      setVisible(true);
    };
    window.addEventListener(INSTALL_READY_EVENT, onReady);

    const timer = setTimeout(() => setVisible(true), 3000);
    return () => {
      clearTimeout(timer);
      window.removeEventListener(INSTALL_READY_EVENT, onReady);
    };
  }, []);

  if (!visible) return null;

  const handleDismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now() + 7 * 24 * 60 * 60 * 1000));
    } catch {
      // ignore
    }
  };

  const handleInstall = async () => {
    const outcome = await triggerNativeInstall();
    if (outcome === "accepted") {
      setVisible(false);
      return;
    }
    if (outcome === "dismissed") {
      setHasNativePrompt(false);
      return;
    }
    // Native beforeinstallprompt not exposed (e.g., iOS Safari or already installed)
    setShowIosSteps((prev) => !prev);
  };

  return (
    <div
      className="fixed bottom-16 left-0 right-0 z-40 max-w-lg mx-auto px-3 pb-[env(safe-area-inset-bottom)] pointer-events-none"
      role="dialog"
      aria-label={`Install ${businessName} app`}
    >
      <div className="pointer-events-auto rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] p-3 space-y-2.5">
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex items-start gap-2.5 min-w-0">
            <img
              src="/icons/icon-192.png"
              alt={businessName}
              className="w-9 h-9 rounded-lg border border-[#D8CEC1] object-cover shrink-0"
            />
            <div className="min-w-0">
              <p className="text-xs font-bold text-[#292320] leading-snug">
                Install {businessName} App
              </p>
              <p className="text-[11px] text-[#71675E] leading-snug mt-0.5">
                {hasNativePrompt
                  ? "Install directly to your phone app drawer for instant access & offers."
                  : "Add to your home screen for full-screen app mode & exclusive offers."}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss install prompt"
            className="text-[#71675E] hover:text-[#292320] p-1 rounded cursor-pointer shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {showIosSteps && (
          <div className="rounded-md bg-[#F7F3EC] border border-[#EEE7DD] px-2.5 py-2 text-[11px] text-[#292320] leading-snug flex items-start gap-2">
            <Smartphone className="w-3.5 h-3.5 text-[#6B2837] shrink-0 mt-0.5" />
            <span>
              In Safari or your browser menu, tap <strong>Share</strong> or <strong>⋮ Menu</strong> and choose{" "}
              <strong>Install App / Add to Home Screen</strong>.
            </span>
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleDismiss}
            className="h-8 px-3 rounded-md border border-[#D8CEC1] bg-[#F7F3EC] hover:bg-[#EEE7DD] text-[11px] font-semibold text-[#71675E] cursor-pointer"
          >
            Not now
          </button>
          <button
            type="button"
            onClick={handleInstall}
            className="h-8 px-3.5 rounded-md bg-[#6B2837] hover:bg-[#541E2A] text-[#FFFCF7] text-[11px] font-bold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Install App</span>
          </button>
        </div>
      </div>
    </div>
  );
}
