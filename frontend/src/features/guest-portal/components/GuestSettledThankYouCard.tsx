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
    <div className="min-h-[75vh] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] overflow-hidden">
        {/* Restaurant Identity Header */}
        <div className="p-6 text-center border-b border-[#EEE7DD] bg-[#F7F3EC]">
          <div className="w-16 h-16 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] mx-auto flex items-center justify-center overflow-hidden mb-3">
            {businessLogo ? (
              <img
                src={businessLogo}
                alt={businessName}
                className="w-full h-full object-cover"
              />
            ) : (
              <UtensilsCrossed className="w-7 h-7 text-[#6B2837]" />
            )}
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md border border-[#C3DED0] bg-[#F1F7F4] text-[#28634B] text-[11px] font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Bill Settled &amp; Session Completed</span>
          </span>
          <h1 className="text-xl font-bold text-[#292320] mt-3 leading-tight">
            Thank You for Dining with {businessName}
          </h1>
          {branchName && (
            <p className="text-xs font-medium text-[#71675E] mt-0.5">
              {branchName}
              {tableLabel ? ` • ${tableLabel}` : ""}
            </p>
          )}
          <p className="text-xs text-[#71675E] leading-relaxed mt-3 max-w-sm mx-auto">
            It was a pleasure serving you today. We hope every dish brought warmth to your table, and we look forward to welcoming you back again soon.
          </p>
        </div>

        {/* Actions */}
        <div className="p-5 space-y-2.5">
          {hasGoogleReview && onRateGoogle && (
            <button
              type="button"
              onClick={onRateGoogle}
              className="w-full h-11 rounded-md bg-[#6B2837] hover:bg-[#541E2A] text-[#FFFCF7] text-xs font-bold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Star className="w-4 h-4" />
              <span>Share Your Experience on Google</span>
            </button>
          )}

          <div className="pt-1">
            <p className="text-[11px] font-semibold text-[#71675E] mb-2 text-center">
              Craving something later? Order directly for pickup or delivery:
            </p>
            <div className="grid grid-cols-2 gap-2">
              {deliveryEnabled && (
                <button
                  type="button"
                  onClick={onStartDelivery}
                  className="h-10 rounded-md border border-[#D8CEC1] bg-[#F7F3EC] hover:bg-[#EEE7DD] text-[#292320] text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Truck className="w-3.5 h-3.5 text-[#6B2837]" />
                  <span>Order Delivery</span>
                </button>
              )}
              {takeawayEnabled && (
                <button
                  type="button"
                  onClick={onStartTakeaway}
                  className="h-10 rounded-md border border-[#D8CEC1] bg-[#F7F3EC] hover:bg-[#EEE7DD] text-[#292320] text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <ShoppingBag className="w-3.5 h-3.5 text-[#6B2837]" />
                  <span>Order Takeaway</span>
                </button>
              )}
            </div>
          </div>

          <div className="pt-2 border-t border-[#EEE7DD] text-center">
            <button
              type="button"
              onClick={onScanNewTable}
              className="text-[11px] font-medium text-[#71675E] hover:text-[#292320] inline-flex items-center gap-1.5 cursor-pointer"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Dining again? Sit at an available table and scan its QR code</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
