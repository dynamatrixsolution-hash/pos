"use client";

import React, { useState } from "react";
import { AlertTriangle, RotateCcw, X } from "lucide-react";
import { usePaymentsStore } from "../../state/payments.store";

export const ReversePaymentModal: React.FC = () => {
  const reversingPayment = usePaymentsStore((s) => s.reversingPayment);
  const setReversingPayment = usePaymentsStore((s) => s.setReversingPayment);
  const submitReversePayment = usePaymentsStore((s) => s.submitReversePayment);
  const isSaving = usePaymentsStore((s) => s.isSaving);

  const [reason, setReason] = useState("Erroneous transaction entry");

  if (!reversingPayment) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitReversePayment(reason);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#292320]/50 p-4 select-none">
      <div className="w-full max-w-sm rounded-xl border border-red-200 bg-[#FFFCF7] p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-red-100 text-[#DC2626] shrink-0">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-[#292320]">Reverse Payment Transaction?</h4>
            <p className="text-xs text-[#71675E] mt-1 leading-relaxed">
              This will post a counter-balancing debit/credit reversing the payment of{" "}
              <strong className="text-[#292320]">
                Rs. {Number(reversingPayment.amount).toLocaleString("en-IN")}
              </strong>{" "}
              in the general ledger.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-[#292320]">Reversal Reason *</label>
            <input
              type="text"
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Guest paid incorrect amount / Duplicate"
              className="w-full h-8 px-2.5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-xs text-[#292320] focus:border-[#6B2837] focus:outline-none"
            />
          </div>

          <div className="pt-2 border-t border-[#D8CEC1] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setReversingPayment(null)}
              disabled={isSaving}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-[#71675E] cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-1.5 text-xs font-bold rounded-lg bg-[#DC2626] hover:bg-[#B91C1C] text-white flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>{isSaving ? "Reversing..." : "Confirm Reversal"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

