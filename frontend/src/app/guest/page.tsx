"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  QrCode,
  Bell,
  CheckCircle2,
  Truck,
  ShoppingBag,
  UtensilsCrossed,
} from "lucide-react";
import { registerWebPushToken } from "@/lib/firebase-client";

interface LastRestaurant {
  publicCode: string;
  businessName: string;
  businessLogo?: string | null;
  branchName?: string | null;
  locationLabel?: string | null;
  visitedAt?: number;
}

const LAST_RESTAURANT_KEY = "restroinn_last_guest_restaurant_v1";

export default function GuestAppHomePage() {
  const router = useRouter();
  const [lastVisited, setLastVisited] = useState<LastRestaurant | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [alertsEnabled, setAlertsEnabled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(LAST_RESTAURANT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as LastRestaurant;
        if (parsed?.publicCode) {
          setLastVisited(parsed);
        }
      }
    } catch {
      // ignore
    }

    if ("Notification" in window && Notification.permission === "granted") {
      setAlertsEnabled(true);
    }
  }, []);

  const handleOpenManualCode = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = manualCode.trim();
    if (!cleaned) return;
    const match = cleaned.match(/\/guest\/qr\/([^/?#]+)/i);
    const code = match ? match[1] : cleaned;
    router.push(`/guest/qr/${encodeURIComponent(code)}`);
  };

  const handleEnableAlerts = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const token = await registerWebPushToken({ publicCode: lastVisited?.publicCode || null });
    if (token || Notification.permission === "granted") {
      setAlertsEnabled(true);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F3EC] text-[#292320] flex flex-col">
      {/* Header */}
      <header className="w-full bg-[#FFFCF7] border-b border-[#D8CEC1] px-4 py-3">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img
              src={lastVisited?.businessLogo || "/icons/icon-192.png"}
              alt={lastVisited?.businessName || "RestroInn"}
              className="w-8 h-8 rounded-lg border border-[#D8CEC1] object-cover"
            />
            <div>
              <h1 className="text-sm font-bold text-[#292320] leading-tight">
                {lastVisited?.businessName || "RestroInn Dining"}
              </h1>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#71675E]">
                Customer Self-Service
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleEnableAlerts}
            disabled={alertsEnabled}
            className={`h-8 px-2.5 rounded-md border text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer ${
              alertsEnabled
                ? "border-[#C3DED0] bg-[#F1F7F4] text-[#28634B]"
                : "border-[#D8CEC1] bg-[#F7F3EC] text-[#292320]"
            }`}
          >
            {alertsEnabled ? (
              <CheckCircle2 className="w-3.5 h-3.5" />
            ) : (
              <Bell className="w-3.5 h-3.5 text-[#6B2837]" />
            )}
            <span>{alertsEnabled ? "Alerts On" : "Enable Alerts"}</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-md mx-auto px-4 py-5 space-y-4">
        {lastVisited ? (
          <section className="rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] overflow-hidden">
            <div className="h-28 relative bg-[#EEE7DD]">
              <img
                src="/assets/clean-restaurant.jpg"
                alt={lastVisited.businessName}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] flex items-center justify-center overflow-hidden shrink-0">
                  {lastVisited.businessLogo ? (
                    <img
                      src={lastVisited.businessLogo}
                      alt={lastVisited.businessName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <UtensilsCrossed className="w-5 h-5 text-[#6B2837]" />
                  )}
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B2837]">
                    Welcome Back
                  </span>
                  <h2 className="text-base font-bold text-[#292320] leading-tight truncate">
                    {lastVisited.businessName}
                  </h2>
                  {lastVisited.branchName && (
                    <p className="text-xs text-[#71675E] truncate">{lastVisited.branchName}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Link
                  href={`/guest/qr/${encodeURIComponent(lastVisited.publicCode)}?mode=DELIVERY`}
                  className="h-11 rounded-md bg-[#6B2837] hover:bg-[#541E2A] text-[#FFFCF7] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Truck className="w-4 h-4" />
                  <span>Order Delivery</span>
                </Link>
                <Link
                  href={`/guest/qr/${encodeURIComponent(lastVisited.publicCode)}?mode=TAKEAWAY`}
                  className="h-11 rounded-md border border-[#D8CEC1] bg-[#F7F3EC] hover:bg-[#EEE7DD] text-[#292320] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <ShoppingBag className="w-4 h-4 text-[#6B2837]" />
                  <span>Order Takeaway</span>
                </Link>
              </div>
              <p className="text-[11px] text-[#71675E] leading-relaxed">
                Want to dine in? Please sit at an available table and scan the QR code on that table.
              </p>
            </div>
          </section>
        ) : (
          <section className="rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] p-5 text-center space-y-2.5">
            <div className="w-12 h-12 rounded-full bg-[#F7F3EC] border border-[#D8CEC1] text-[#6B2837] flex items-center justify-center mx-auto">
              <QrCode className="w-6 h-6" />
            </div>
            <h2 className="text-base font-bold text-[#292320]">Ready to Order?</h2>
            <p className="text-xs text-[#71675E] leading-relaxed">
              Scan the QR code on your dining table or hotel room to browse the menu, order takeaway or delivery, and receive offers.
            </p>
          </section>
        )}

        {/* Dine-In Table QR Entry */}
        <section className="rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] p-4 space-y-2.5">
          <h3 className="text-xs font-bold text-[#292320]">
            Seated at a Table? Enter Table / Room QR Code
          </h3>
          <form onSubmit={handleOpenManualCode} className="flex items-center gap-2">
            <input
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="e.g. restro-t01"
              className="flex-1 h-9 px-3 rounded-md border border-[#D8CEC1] bg-[#F7F3EC] text-xs text-[#292320] placeholder:text-[#71675E] focus:outline-none focus:bg-[#FFFCF7] focus:border-[#6B2837]"
            />
            <button
              type="submit"
              className="h-9 px-4 rounded-md bg-[#292320] hover:bg-[#6B2837] text-[#FFFCF7] text-xs font-bold cursor-pointer transition-colors"
            >
              Open
            </button>
          </form>
        </section>
      </main>

      <footer className="w-full py-4 px-4 text-center text-[11px] text-[#71675E] flex items-center justify-center gap-3">
        <Link href="/terms" className="hover:text-[#292320] underline underline-offset-2">
          Terms
        </Link>
        <span>•</span>
        <Link href="/privacy" className="hover:text-[#292320] underline underline-offset-2">
          Privacy
        </Link>
      </footer>
    </div>
  );
}
