"use client";

import React, { useState, useEffect } from "react";
import { Download, Smartphone, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "restroinn_pwa_popup_dismissed_until";

export function InstallAppPopup({ businessName }: { businessName: string }) {
  const [visible, setVisible] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showManualSteps, setShowManualSteps] = useState(false);

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

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    // Show clean floating install prompt after 3.5 seconds so guest sees the menu first
    const timer = setTimeout(() => setVisible(true), 3500);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
    };
  }, []);

  if (!visible) return null;

  const handleDismiss = () => {
    setVisible(false);
    try {
      // Remind again after 7 days
      localStorage.setItem(DISMISS_KEY, String(Date.now() + 7 * 24 * 60 * 60 * 1000));
    } catch {
      // ignore
    }
  };

  const handleInstall = async () => {
    if (installPrompt) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setVisible(false);
      }
      setInstallPrompt(null);
      return;
    }
    setShowManualSteps((prev) => !prev);
  };

  return (
    <div
      className="fixed bottom-16 left-0 right-0 z-40 max-w-lg mx-auto px-3 pb-[env(safe-area-inset-bottom)] pointer-events-none"
      role="dialog"
      aria-label={`Install ${businessName} app`}
    >
      <div className="pointer-events-auto rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] p-3 space-y-2.5 shadow-xs">
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex items-start gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-md bg-[#6B2837] text-[#FFFCF7] flex items-center justify-center shrink-0 mt-0.5">
              <Smartphone className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-[#292320] leading-snug">
                Install {businessName} App
              </p>
              <p className="text-[11px] text-[#71675E] leading-snug mt-0.5">
                Order faster next time &amp; get instant offers (30% off, BOGO deals).
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

        {showManualSteps && (
          <div className="rounded-md bg-[#F7F3EC] border border-[#EEE7DD] px-2.5 py-2 text-[11px] text-[#292320] leading-snug">
            Tap your browser&apos;s <strong>Share</strong> (iPhone) or <strong>⋮ Menu</strong> (Android), then select{" "}
            <strong>&ldquo;Add to Home Screen&rdquo;</strong>.
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
