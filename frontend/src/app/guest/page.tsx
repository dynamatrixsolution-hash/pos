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
  Camera,
  ChevronRight,
  Moon,
  Sun,
} from "lucide-react";
import { registerWebPushToken } from "@/lib/firebase-client";
import { QrCameraScannerModal } from "@/features/guest-portal/components/QrCameraScannerModal";

interface LastRestaurant {
  publicCode: string;
  businessName: string;
  businessLogo?: string | null;
  branchName?: string | null;
  locationLabel?: string | null;
  visitedAt?: number;
}

interface SavedOrderRef {
  orderId: string;
  orderNumber: string;
  phone: string;
  orderType: "DELIVERY" | "TAKEAWAY";
  publicCode: string;
  createdAt: number;
}

const LAST_RESTAURANT_KEY = "restroinn_last_guest_restaurant_v1";
const SAVED_CHANNEL_ORDERS_KEY = "restroinn_guest_channel_orders_v1";
const GUEST_THEME_KEY = "restroinn_guest_theme_v1";

export default function GuestAppHomePage() {
  const router = useRouter();
  const [lastVisited, setLastVisited] = useState<LastRestaurant | null>(null);
  const [recentOrders, setRecentOrders] = useState<SavedOrderRef[]>([]);
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(LAST_RESTAURANT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as LastRestaurant;
        if (parsed?.publicCode) setLastVisited(parsed);
      }
      const rawOrders = localStorage.getItem(SAVED_CHANNEL_ORDERS_KEY);
      if (rawOrders) {
        const parsedOrders = JSON.parse(rawOrders);
        if (Array.isArray(parsedOrders)) setRecentOrders(parsedOrders.slice(0, 3));
      }
      const savedTheme = localStorage.getItem(GUEST_THEME_KEY);
      if (savedTheme === "dark" || savedTheme === "light") {
        setTheme(savedTheme);
      } else if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
        setTheme("dark");
      }
    } catch {
      // ignore storage errors
    }

    if ("Notification" in window && Notification.permission === "granted") {
      setAlertsEnabled(true);
    }
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try {
      localStorage.setItem(GUEST_THEME_KEY, next);
    } catch {}
  };

  const handleEnableAlerts = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const token = await registerWebPushToken({ publicCode: lastVisited?.publicCode || null });
    if (token || Notification.permission === "granted") {
      setAlertsEnabled(true);
    }
  };

  return (
    <div
      data-theme={theme}
      className="guest-shell min-h-[100dvh] flex flex-col"
    >
      {/* Top App Bar — 4px grid, 44px tap targets, hairline border */}
      <header
        className="w-full px-4 py-3 shrink-0"
        style={{
          backgroundColor: "var(--guest-surface)",
          borderBottom: "1px solid var(--guest-border)",
        }}
      >
        <div className="max-w-lg mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={lastVisited?.businessLogo || "/icons/icon-192.png"}
              alt={lastVisited?.businessName || "RestroInn"}
              className="w-11 h-11 rounded-[8px] object-cover shrink-0"
              style={{ border: "1px solid var(--guest-border)" }}
            />
            <div className="min-w-0">
              <h1 className="text-base font-semibold leading-snug truncate">
                {lastVisited?.businessName || "RestroInn Dining"}
              </h1>
              <p
                className="text-sm font-normal leading-snug truncate"
                style={{ color: "var(--guest-muted)" }}
              >
                {lastVisited?.branchName || "Guest Ordering"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              className="w-11 h-11 rounded-[8px] inline-flex items-center justify-center cursor-pointer transition-colors"
              style={{
                backgroundColor: "var(--guest-surface-subtle)",
                border: "1px solid var(--guest-border)",
                color: "var(--guest-fg)",
              }}
            >
              {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            <button
              type="button"
              onClick={handleEnableAlerts}
              disabled={alertsEnabled}
              className="min-h-[44px] px-3 rounded-[8px] text-sm font-semibold inline-flex items-center gap-2 cursor-pointer transition-colors"
              style={
                alertsEnabled
                  ? {
                      backgroundColor: "var(--guest-success-bg)",
                      color: "var(--guest-success)",
                      border: "1px solid var(--guest-success-border)",
                    }
                  : {
                      backgroundColor: "var(--guest-surface-subtle)",
                      color: "var(--guest-fg)",
                      border: "1px solid var(--guest-border)",
                    }
              }
            >
              {alertsEnabled ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <Bell className="w-4 h-4 shrink-0" style={{ color: "var(--guest-accent-text)" }} />
              )}
              <span>{alertsEnabled ? "Alerts On" : "Alerts"}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content — 24px (space-y-6) between distinct groups, 8px inside groups */}
      <main className="flex-1 w-full max-w-lg mx-auto px-4 py-6 flex flex-col gap-6">
        {/* Section 1: Restaurant Hero + Single Primary Fill Action */}
        <section className="guest-card overflow-hidden">
          <div
            className="h-44 relative"
            style={{ backgroundColor: "var(--guest-surface-subtle)" }}
          >
            <img
              src="/assets/clean-restaurant.jpg"
              alt={lastVisited?.businessName || "Dining room"}
              className="w-full h-full object-cover"
            />
            <div
              className="absolute inset-x-0 bottom-0 px-4 py-3 flex items-center justify-between gap-3"
              style={{ backgroundColor: "rgba(24, 20, 18, 0.78)" }}
            >
              <div className="min-w-0">
                <p className="text-sm font-normal text-[#EAE2D9]">
                  {lastVisited ? "Welcome back" : "Digital dining"}
                </p>
                <h2 className="text-lg font-semibold text-[#FFFCF7] leading-snug truncate">
                  {lastVisited?.businessName || "Scan a table QR to start"}
                </h2>
              </div>
              <div className="w-10 h-10 rounded-[8px] bg-[#FFFCF7] flex items-center justify-center shrink-0">
                <UtensilsCrossed className="w-5 h-5 text-[#6B2837]" />
              </div>
            </div>
          </div>

          <div className="p-4 space-y-3">
            {lastVisited ? (
              <>
                {/* One filled primary button for this section */}
                <Link
                  href={`/guest/qr/${encodeURIComponent(lastVisited.publicCode)}?mode=DELIVERY`}
                  className="guest-btn-primary w-full px-4 py-3 flex items-center justify-between gap-3"
                >
                  <span className="inline-flex items-center gap-3 min-w-0">
                    <Truck className="w-5 h-5 shrink-0" />
                    <span className="text-left min-w-0">
                      <span className="block text-base font-semibold leading-snug">
                        Order Delivery
                      </span>
                      <span className="block text-sm font-normal opacity-90 truncate">
                        Cash on Delivery or Online QR
                      </span>
                    </span>
                  </span>
                  <ChevronRight className="w-5 h-5 shrink-0" />
                </Link>

                {/* Secondary outlined button */}
                <Link
                  href={`/guest/qr/${encodeURIComponent(lastVisited.publicCode)}?mode=TAKEAWAY`}
                  className="guest-btn-secondary w-full px-4 py-3 flex items-center justify-between gap-3"
                >
                  <span className="inline-flex items-center gap-3 min-w-0">
                    <ShoppingBag
                      className="w-5 h-5 shrink-0"
                      style={{ color: "var(--guest-accent-text)" }}
                    />
                    <span className="text-left min-w-0">
                      <span className="block text-base font-semibold leading-snug">
                        Order Takeaway
                      </span>
                      <span
                        className="block text-sm font-normal truncate"
                        style={{ color: "var(--guest-muted)" }}
                      >
                        Order ahead and pick up at counter
                      </span>
                    </span>
                  </span>
                  <ChevronRight
                    className="w-5 h-5 shrink-0"
                    style={{ color: "var(--guest-muted)" }}
                  />
                </Link>
              </>
            ) : (
              <div className="space-y-3">
                <p
                  className="text-base font-normal max-w-[65ch]"
                  style={{ color: "var(--guest-muted)" }}
                >
                  You haven&apos;t visited a restaurant yet. Tap below to scan the QR code on your dining table or room to open the menu.
                </p>
                <button
                  type="button"
                  onClick={() => setScannerOpen(true)}
                  className="guest-btn-primary w-full px-4 inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Camera className="w-5 h-5 shrink-0" />
                  <span>Scan Table QR Code</span>
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Section 2: Recent Orders (if any) */}
        {recentOrders.length > 0 && (
          <section className="guest-card p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-semibold">My Recent Orders</h3>
              <span
                className="text-sm font-normal tabular-nums"
                style={{ color: "var(--guest-muted)" }}
              >
                {recentOrders.length} active
              </span>
            </div>
            <div className="space-y-2">
              {recentOrders.map((ord) => (
                <Link
                  key={ord.orderNumber}
                  href={`/guest/qr/${encodeURIComponent(ord.publicCode)}?mode=${ord.orderType}&tab=TRACKER`}
                  className="min-h-[52px] px-3 py-2 rounded-[8px] flex items-center justify-between gap-3 transition-colors"
                  style={{
                    backgroundColor: "var(--guest-surface-subtle)",
                    border: "1px solid var(--guest-border)",
                  }}
                >
                  <div className="min-w-0">
                    <div
                      className="text-base font-semibold tabular-nums truncate"
                      style={{ color: "var(--guest-accent-text)" }}
                    >
                      #{ord.orderNumber}
                    </div>
                    <div
                      className="text-sm font-normal"
                      style={{ color: "var(--guest-muted)" }}
                    >
                      {ord.orderType === "DELIVERY" ? "Delivery" : "Takeaway"} • Track live status
                    </div>
                  </div>
                  <ChevronRight
                    className="w-5 h-5 shrink-0"
                    style={{ color: "var(--guest-muted)" }}
                  />
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Section 3: Dine-In QR Scanner Card (when user already has a restaurant saved) */}
        {lastVisited && (
          <section className="guest-card p-4 space-y-4 mt-auto">
            <div className="flex items-start gap-3">
              <div
                className="w-11 h-11 rounded-[8px] flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: "var(--guest-accent-soft)",
                  color: "var(--guest-accent-text)",
                }}
              >
                <QrCode className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-semibold leading-snug">
                  Seated at a dining table?
                </h3>
                <p
                  className="text-sm font-normal max-w-[65ch]"
                  style={{ color: "var(--guest-muted)" }}
                >
                  Sit at an available table and scan its QR code to order dine-in directly from your phone.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setScannerOpen(true)}
              className="guest-btn-secondary w-full px-4 inline-flex items-center justify-center gap-2 font-semibold cursor-pointer"
            >
              <Camera className="w-5 h-5 shrink-0" style={{ color: "var(--guest-accent-text)" }} />
              <span>Scan Table QR Code</span>
            </button>
          </section>
        )}
      </main>

      <footer
        className="w-full py-4 px-4 text-center text-sm flex items-center justify-center gap-4 shrink-0"
        style={{
          backgroundColor: "var(--guest-surface)",
          borderTop: "1px solid var(--guest-border)",
          color: "var(--guest-muted)",
        }}
      >
        <Link href="/terms" className="min-h-[44px] inline-flex items-center underline underline-offset-4">
          Terms of Service
        </Link>
        <span aria-hidden="true">•</span>
        <Link href="/privacy" className="min-h-[44px] inline-flex items-center underline underline-offset-4">
          Privacy Policy
        </Link>
      </footer>

      {scannerOpen && (
        <QrCameraScannerModal
          onClose={() => setScannerOpen(false)}
          onDetected={(code) => {
            setScannerOpen(false);
            router.push(`/guest/qr/${encodeURIComponent(code)}`);
          }}
        />
      )}
    </div>
  );
}
