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

const LAST_RESTAURANT_KEY = "restroinn_last_guest_restaurant_v1";

export default function GuestAppHomePage() {
  const router = useRouter();
  const [lastVisited, setLastVisited] = useState<LastRestaurant | null>(null);
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);

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

  const handleEnableAlerts = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const token = await registerWebPushToken({ publicCode: lastVisited?.publicCode || null });
    if (token || Notification.permission === "granted") {
      setAlertsEnabled(true);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#F7F3EC] text-[#292320] flex flex-col">
      {/* Top App Bar */}
      <header className="w-full bg-[#FFFCF7] border-b border-[#D8CEC1] px-4 py-3 shrink-0">
        <div className="max-w-md mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src={lastVisited?.businessLogo || "/icons/icon-192.png"}
              alt={lastVisited?.businessName || "RestroInn"}
              className="w-9 h-9 rounded-lg border border-[#D8CEC1] object-cover shrink-0"
            />
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-[#292320] leading-tight truncate">
                {lastVisited?.businessName || "RestroInn Dining"}
              </h1>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#71675E] truncate">
                {lastVisited?.branchName || "Customer Ordering App"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleEnableAlerts}
            disabled={alertsEnabled}
            className={`h-8 px-2.5 rounded-md border text-[11px] font-semibold inline-flex items-center gap-1 shrink-0 cursor-pointer ${
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

      {/* Full-Height Structured App Body */}
      <main className="flex-1 w-full max-w-md mx-auto px-4 py-4 flex flex-col gap-3.5">
        {/* Hero Banner Card */}
        <section className="rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] overflow-hidden">
          <div className="h-40 relative bg-[#EEE7DD]">
            <img
              src="/assets/clean-restaurant.jpg"
              alt={lastVisited?.businessName || "Dining"}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-x-0 bottom-0 bg-[#292320]/75 px-4 py-2.5 flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#EEE7DD]">
                  {lastVisited ? "Welcome Back" : "Digital Dining & Delivery"}
                </p>
                <h2 className="text-sm font-bold text-[#FFFCF7] truncate">
                  {lastVisited?.businessName || "Scan a Table QR to Begin"}
                </h2>
              </div>
              <div className="w-8 h-8 rounded-md bg-[#FFFCF7] flex items-center justify-center shrink-0">
                <UtensilsCrossed className="w-4 h-4 text-[#6B2837]" />
              </div>
            </div>
          </div>

          <div className="p-3.5 space-y-2.5">
            {lastVisited ? (
              <>
                <Link
                  href={`/guest/qr/${encodeURIComponent(lastVisited.publicCode)}?mode=DELIVERY`}
                  className="w-full p-3 rounded-lg bg-[#6B2837] hover:bg-[#541E2A] text-[#FFFCF7] flex items-center justify-between gap-3 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-md bg-[#FFFCF7]/15 flex items-center justify-center shrink-0">
                      <Truck className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold">Order Delivery</div>
                      <div className="text-[11px] text-[#F7F3EC]/85 truncate">
                        Delivered to your address • Cash on Delivery or QR
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 shrink-0" />
                </Link>

                <Link
                  href={`/guest/qr/${encodeURIComponent(lastVisited.publicCode)}?mode=TAKEAWAY`}
                  className="w-full p-3 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] hover:bg-[#EEE7DD] text-[#292320] flex items-center justify-between gap-3 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-md border border-[#D8CEC1] bg-[#FFFCF7] flex items-center justify-center shrink-0">
                      <ShoppingBag className="w-5 h-5 text-[#6B2837]" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold">Order Takeaway</div>
                      <div className="text-[11px] text-[#71675E] truncate">
                        Order ahead &amp; pick up fresh at the counter
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#71675E] shrink-0" />
                </Link>
              </>
            ) : (
              <p className="text-xs text-[#71675E] leading-relaxed">
                Scan a restaurant table or hotel room QR code to browse the digital menu, order food, and unlock delivery &amp; takeaway.
              </p>
            )}
          </div>
        </section>

        {/* Dine-In Camera QR Scanner Card */}
        <section className="rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] p-4 space-y-3 mt-auto">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] flex items-center justify-center text-[#6B2837] shrink-0">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-[#292320]">
                Seated at a Dining Table?
              </h3>
              <p className="text-[11px] text-[#71675E] leading-relaxed mt-0.5">
                To dine in, sit at an available table and scan the table&apos;s QR code with your camera.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setScannerOpen(true)}
            className="w-full h-11 rounded-md bg-[#292320] hover:bg-[#6B2837] text-[#FFFCF7] text-xs font-bold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Camera className="w-4 h-4" />
            <span>Scan Table QR Code</span>
          </button>
        </section>
      </main>

      <footer className="w-full py-3.5 px-4 border-t border-[#EEE7DD] bg-[#FFFCF7] text-center text-[11px] text-[#71675E] flex items-center justify-center gap-3 shrink-0">
        <Link href="/terms" className="hover:text-[#292320] underline underline-offset-2">
          Terms of Service
        </Link>
        <span>•</span>
        <Link href="/privacy" className="hover:text-[#292320] underline underline-offset-2">
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
