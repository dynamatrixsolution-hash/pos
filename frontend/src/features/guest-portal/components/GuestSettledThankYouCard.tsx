"use client";

import React from "react";
import { Star, ShoppingBag, Truck, QrCode, CheckCircle2, UtensilsCrossed } from "lucide-react";

interface GuestSettledThankYouCardProps {
  businessName: string;
  businessLogo?: string | null;
  branchName?: string | null;
  tableLabel?: string | null;
  hasGoogleReview?: boolean;
  takeawayEnabled?: boolean;
  deliveryEnabled?: boolean;
  onRateGoogle?: () => void;
  onStartTakeaway: () => void;
  onStartDelivery: () => void;
  onScanNewTable: () => void;
}

export function GuestSettledThankYouCard({
  businessName,
  businessLogo,
  branchName,
  tableLabel,
  hasGoogleReview,
  takeawayEnabled = true,
  deliveryEnabled = true,
  onRateGoogle,
  onStartTakeaway,
  onStartDelivery,
  onScanNewTable,
}: GuestSettledThankYouCardProps) {
  return (
    <div className="min-h-[85dvh] flex items-center justify-center px-4 py-8">
      <div className="guest-card w-full max-w-md overflow-hidden">
        {/* Restaurant Identity Header */}
        <div
          className="p-6 text-center space-y-3"
          style={{
            backgroundColor: "var(--guest-surface-subtle)",
            borderBottom: "1px solid var(--guest-border)",
          }}
        >
          <div
            className="w-16 h-16 rounded-[12px] mx-auto flex items-center justify-center overflow-hidden"
            style={{
              backgroundColor: "var(--guest-surface)",
              border: "1px solid var(--guest-border)",
            }}
          >
            {businessLogo ? (
              <img
                src={businessLogo}
                alt={businessName}
                className="w-full h-full object-cover"
              />
            ) : (
              <UtensilsCrossed className="w-7 h-7" style={{ color: "var(--guest-accent)" }} />
            )}
          </div>

          <span
            className="inline-flex items-center gap-2 px-3 py-1 rounded-[8px] text-sm font-semibold"
            style={{
              backgroundColor: "var(--guest-success-bg)",
              color: "var(--guest-success)",
              border: "1px solid var(--guest-success-border)",
            }}
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Bill Settled</span>
          </span>

          <div className="space-y-1">
            <h1 className="text-xl font-semibold leading-snug">
              Thank you for dining with {businessName}
            </h1>
            {branchName && (
              <p className="text-sm font-normal" style={{ color: "var(--guest-muted)" }}>
                {branchName}
                {tableLabel ? ` • ${tableLabel}` : ""}
              </p>
            )}
          </div>

          <p
            className="text-base font-normal max-w-[60ch] mx-auto"
            style={{ color: "var(--guest-muted)" }}
          >
            It was a pleasure serving you today. We hope every dish brought warmth to your table and look forward to welcoming you back soon.
          </p>
        </div>

        {/* Actions: One filled primary CTA + clean secondary actions */}
        <div className="p-4 space-y-4">
          {hasGoogleReview && onRateGoogle && (
            <button
              type="button"
              onClick={onRateGoogle}
              className="guest-btn-primary w-full px-4 inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <Star className="w-5 h-5 shrink-0" />
              <span>Share Your Experience on Google</span>
            </button>
          )}

          <div className="space-y-2">
            <p className="text-sm font-semibold text-center" style={{ color: "var(--guest-muted)" }}>
              Order again anytime for delivery or pickup
            </p>
            <div className="grid grid-cols-2 gap-2">
              {deliveryEnabled && (
                <button
                  type="button"
                  onClick={onStartDelivery}
                  className={
                    !hasGoogleReview
                      ? "guest-btn-primary px-3 inline-flex items-center justify-center gap-2 cursor-pointer"
                      : "guest-btn-secondary px-3 inline-flex items-center justify-center gap-2 cursor-pointer"
                  }
                >
                  <Truck className="w-4 h-4 shrink-0" />
                  <span>Delivery</span>
                </button>
              )}
              {takeawayEnabled && (
                <button
                  type="button"
                  onClick={onStartTakeaway}
                  className="guest-btn-secondary px-3 inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  <ShoppingBag
                    className="w-4 h-4 shrink-0"
                    style={{ color: "var(--guest-accent)" }}
                  />
                  <span>Takeaway</span>
                </button>
              )}
            </div>
          </div>

          <div
            className="pt-3 text-center"
            style={{ borderTop: "1px solid var(--guest-border)" }}
          >
            <button
              type="button"
              onClick={onScanNewTable}
              className="min-h-[44px] px-3 text-sm font-medium inline-flex items-center justify-center gap-2 cursor-pointer"
              style={{ color: "var(--guest-muted)" }}
            >
              <QrCode className="w-4 h-4 shrink-0" />
              <span>Dining again? Scan an available table QR</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
