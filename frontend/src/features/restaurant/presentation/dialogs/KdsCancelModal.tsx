"use client";

import React, { useState } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { useRestaurantKdsStore } from "../../state/restaurant-kds.store";

export const KdsCancelModal: React.FC = () => {
  const cancellingOrder = useRestaurantKdsStore((s) => s.cancellingOrder);
  const setCancellingOrder = useRestaurantKdsStore((s) => s.setCancellingOrder);
  const submitCancelOrder = useRestaurantKdsStore((s) => s.submitCancelOrder);

  const [reason, setReason] = useState("Customer requested cancellation");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!cancellingOrder) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    await submitCancelOrder(reason);
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#292320]/60 p-4 backdrop-blur-xs select-none">
      <div className="w-full max-w-sm rounded-xl border border-red-200 bg-[#FFFCF7] p-5 space-y-4 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-red-100 text-[#DC2626] shrink-0">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-black text-[#292320]">
              Void Order from Kitchen?
            </h4>
            <p className="text-xs text-[#DC2626] font-bold mt-1">
              Notice: Table {cancellingOrder.tableNumber}
            </p>
            <p className="text-[11px] text-[#71675E] mt-1 leading-relaxed">
              Cancelling this order will void the kitchen round and remove the items from preparation.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-[#292320]">Void Reason</label>
            <input
              type="text"
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Out of ingredients, duplicate order..."
              className="w-full h-8 px-2.5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-xs text-[#292320] focus:border-[#6B2837] focus:outline-none"
            />
          </div>

          <div className="pt-2 border-t border-[#D8CEC1] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setCancellingOrder(null)}
              disabled={isSubmitting}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-[#71675E] cursor-pointer"
            >
              No, Keep Order
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-1.5 text-xs font-bold rounded-lg bg-[#DC2626] hover:bg-[#B91C1C] text-white flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>{isSubmitting ? "Voiding..." : "Yes, Void Order"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

