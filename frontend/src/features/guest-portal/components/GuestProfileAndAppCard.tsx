"use client";

import React, { useState, useEffect } from "react";
import { UserCheck, Smartphone, Bell, CheckCircle2, Download } from "lucide-react";

interface GuestProfileAndAppCardProps {
  businessName: string;
  sessionToken: string | null;
  onEnsureSession: () => Promise<string | null>;
  onNotify: (msg: string, type?: "success" | "error" | "info") => void;
}

const PROFILE_STORAGE_KEY = "restroinn_guest_saved_profile_v1";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function GuestProfileAndAppCard({
  businessName,
  sessionToken,
  onEnsureSession,
  onNotify,
}: GuestProfileAndAppCardProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [alertsEnabled, setAlertsEnabled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.name) setName(parsed.name);
        if (parsed?.phone) setPhone(parsed.phone);
        if (parsed?.email) setEmail(parsed.email);
        if (parsed?.name && parsed?.phone) setSaved(true);
      }
    } catch {
      // ignore storage errors
    }

    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsStandalone(Boolean(standalone));

    if ("Notification" in window && Notification.permission === "granted") {
      setAlertsEnabled(true);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2 || phone.trim().length < 7) {
      onNotify("Please enter your name and phone number.", "error");
      return;
    }

    setSaving(true);
    try {
      const token = sessionToken || (await onEnsureSession());
      if (!token) {
        onNotify("Start your table session first to save your details.", "info");
        return;
      }

      const res = await fetch("/api/v1/guest/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-guest-session-token": token,
        },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        onNotify(data.error || "Could not save your details.", "error");
        return;
      }

      try {
        localStorage.setItem(
          PROFILE_STORAGE_KEY,
          JSON.stringify({ name: name.trim(), phone: phone.trim(), email: email.trim() })
        );
      } catch {
        // ignore
      }
      setSaved(true);
      onNotify("Details saved! You'll get personalized receipts & exclusive offers.", "success");
    } catch {
      onNotify("Network error while saving your details.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleInstallApp = async () => {
    if (installPrompt) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setIsStandalone(true);
        setInstallPrompt(null);
        onNotify(`${businessName} added to your home screen!`, "success");
      }
      return;
    }
    setShowIosGuide((prev) => !prev);
  };

  const handleEnableOfferAlerts = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      onNotify("Notifications are not supported on this browser.", "info");
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm === "granted") {
      setAlertsEnabled(true);
      onNotify("Offer & kitchen alerts enabled!", "success");
    } else {
      onNotify("Please allow notifications in browser settings to receive offers.", "info");
    }
  };

  return (
    <div className="space-y-3">
      {/* Optional Customer Details Card */}
      <section className="rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-[#292320] flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-[#6B2837]" />
              <span>Save Your Details (Optional)</span>
            </h3>
            <p className="text-xs text-[#71675E] mt-0.5">
              Faster repeat visits, digital receipts, and exclusive offers from {businessName}.
            </p>
          </div>
          {saved && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#F1F7F4] border border-[#C3DED0] text-[10px] font-bold text-[#28634B] shrink-0">
              <CheckCircle2 className="w-3 h-3" />
              Saved
            </span>
          )}
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-2.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label htmlFor="guest-profile-name" className="block text-[11px] font-semibold text-[#71675E] mb-1">
                Full Name *
              </label>
              <input
                id="guest-profile-name"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setSaved(false);
                }}
                placeholder="Your name"
                className="w-full h-9 px-3 rounded-md border border-[#D8CEC1] bg-[#F7F3EC] text-xs text-[#292320] placeholder:text-[#71675E] focus:outline-none focus:bg-[#FFFCF7] focus:border-[#6B2837]"
              />
            </div>
            <div>
              <label htmlFor="guest-profile-phone" className="block text-[11px] font-semibold text-[#71675E] mb-1">
                Phone Number *
              </label>
              <input
                id="guest-profile-phone"
                type="tel"
                inputMode="numeric"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  setSaved(false);
                }}
                placeholder="98XXXXXXXX"
                className="w-full h-9 px-3 rounded-md border border-[#D8CEC1] bg-[#F7F3EC] text-xs text-[#292320] placeholder:text-[#71675E] focus:outline-none focus:bg-[#FFFCF7] focus:border-[#6B2837] tabular-nums"
              />
            </div>
          </div>

          <div>
            <label htmlFor="guest-profile-email" className="block text-[11px] font-semibold text-[#71675E] mb-1">
              Email (Optional)
            </label>
            <input
              id="guest-profile-email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setSaved(false);
              }}
              placeholder="you@example.com"
              className="w-full h-9 px-3 rounded-md border border-[#D8CEC1] bg-[#F7F3EC] text-xs text-[#292320] placeholder:text-[#71675E] focus:outline-none focus:bg-[#FFFCF7] focus:border-[#6B2837]"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full h-9 rounded-md border border-[#6B2837] bg-[#FFFCF7] hover:bg-[#6B2837] text-[#6B2837] hover:text-[#FFFCF7] text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
          >
            {saving ? "Saving..." : saved ? "Update My Details" : "Save My Details"}
          </button>
        </form>
      </section>

      {/* Install as Mobile App (PWA) & Offer Notifications */}
      <section className="rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] p-4 space-y-2.5">
        <div className="flex items-start gap-2.5">
          <div className="w-8 h-8 rounded-md bg-[#F7F3EC] border border-[#D8CEC1] flex items-center justify-center shrink-0">
            <Smartphone className="w-4 h-4 text-[#6B2837]" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-[#292320]">Install App &amp; Get Exclusive Offers</h3>
            <p className="text-xs text-[#71675E] mt-0.5 leading-snug">
              Add {businessName} to your home screen for instant ordering and weekend deals (e.g., 30% Off &amp; Buy 1 Get 1).
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {!isStandalone && (
            <button
              type="button"
              onClick={handleInstallApp}
              className="h-9 px-3 rounded-md bg-[#6B2837] hover:bg-[#541E2A] text-[#FFFCF7] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Install App</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleEnableOfferAlerts}
            disabled={alertsEnabled}
            className={`h-9 px-3 rounded-md border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              isStandalone ? "col-span-2" : ""
            } ${
              alertsEnabled
                ? "border-[#C3DED0] bg-[#F1F7F4] text-[#28634B]"
                : "border-[#D8CEC1] bg-[#F7F3EC] hover:bg-[#EEE7DD] text-[#292320]"
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            <span>{alertsEnabled ? "Offer Alerts On" : "Get Offer Alerts"}</span>
          </button>
        </div>

        {showIosGuide && (
          <div className="rounded-md border border-[#D8CEC1] bg-[#F7F3EC] p-2.5 text-[11px] text-[#292320] leading-relaxed">
            <strong>Install on iPhone / Android:</strong> Tap your browser&apos;s{" "}
            <strong>Share</strong> (or <strong>⋮ Menu</strong>) button and choose{" "}
            <strong>&ldquo;Add to Home Screen&rdquo;</strong>.
          </div>
        )}
      </section>
    </div>
  );
}
