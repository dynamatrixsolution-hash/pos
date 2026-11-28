"use client";

import React, { useEffect, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { useRestaurantKdsStore } from "../../state/restaurant-kds.store";

const QUICK_REASONS = [
  "Out of stock",
  "Ingredient unavailable",
  "Kitchen unable to prepare",
  "Duplicate order",
];

export const KdsCancelModal: React.FC = () => {
  const cancellingTarget = useRestaurantKdsStore((s) => s.cancellingTarget);
  const setCancellingTarget = useRestaurantKdsStore((s) => s.setCancellingTarget);
  const submitCancelTarget = useRestaurantKdsStore((s) => s.submitCancelTarget);

  const [reason, setReason] = useState("Out of stock");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (cancellingTarget) {
      setReason("Out of stock");
    }
  }, [cancellingTarget]);

  useEffect(() => {
    if (!cancellingTarget) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSubmitting) setCancellingTarget(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [cancellingTarget, isSubmitting, setCancellingTarget]);

  if (!cancellingTarget) return null;

  const isLine = cancellingTarget.kind === "LINE";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    await submitCancelTarget(reason);
    setIsSubmitting(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#292320]/40 p-4 select-none"
      role="dialog"
      aria-modal="true"
      aria-labelledby="kds-cancel-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) setCancellingTarget(null);
      }}
    >
      <div className="w-full max-w-sm rounded-xl border border-[#E9B6B7] bg-[#FFFCF7] p-5 space-y-4">
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex items-start gap-2.5 min-w-0">
            <div className="p-2 rounded-lg bg-[#FAEAEC] text-[#B33432] border border-[#E9B6B7] shrink-0">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h4 id="kds-cancel-title" className="text-sm font-bold text-[#292320]">
                {isLine
                  ? `Cancel ${cancellingTarget.quantity}x ${cancellingTarget.itemName}?`
                  : `Cancel Order (${cancellingTarget.tableNumber})?`}
              </h4>
              <p className="text-[11px] text-[#71675E] mt-1 leading-relaxed">
                {isLine
                  ? `This item will be removed from ${cancellingTarget.tableNumber}. The waiter and guest will be notified immediately.`
                  : "All items in this order will be cancelled. The waiter and guest will be notified immediately."}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setCancellingTarget(null)}
            disabled={isSubmitting}
            aria-label="Close modal"
            className="text-[#71675E] hover:text-[#292320] cursor-pointer shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <label htmlFor="kds-cancel-reason" className="text-[11px] font-semibold text-[#292320]">
              Cancellation Reason
            </label>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_REASONS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setReason(preset)}
                  className={`px-2 py-1 rounded-md text-[11px] font-medium border cursor-pointer transition-colors ${
                    reason === preset
                      ? "bg-[#6B2837] text-[#FFFCF7] border-[#6B2837]"
                      : "bg-[#F7F3EC] text-[#292320] border-[#D8CEC1] hover:bg-[#EEE7DD]"
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
            <input
              id="kds-cancel-reason"
              type="text"
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Enter reason for waiter & guest..."
              className="w-full h-8 px-2.5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-xs text-[#292320] focus:border-[#6B2837] focus:outline-none"
            />
          </div>

          <div className="pt-2 border-t border-[#D8CEC1] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setCancellingTarget(null)}
              disabled={isSubmitting}
              className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-[#292320] cursor-pointer transition-colors"
            >
              Keep
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#B33432] hover:bg-[#992826] text-[#FFFCF7] cursor-pointer transition-colors disabled:opacity-50"
            >
              {isSubmitting ? "Cancelling..." : isLine ? "Cancel Item" : "Cancel Order"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
