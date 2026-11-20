"use client";

import React, { useState } from "react";
import { X, LogOut, CreditCard, AlertCircle } from "lucide-react";
import { useHotelStaysStore } from "../../state/hotel-stays.store";

function formatNPR(amount: number | string | undefined): string {
  const val = Number(amount) || 0;
  return `Rs. ${val.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export const CheckOutModal: React.FC = () => {
  const checkOutTarget = useHotelStaysStore((s) => s.checkOutTarget);
  const closeCheckOutModal = useHotelStaysStore((s) => s.closeCheckOutModal);
  const folioBalance = useHotelStaysStore((s) => s.folioBalance);
  const isLoadingFolio = useHotelStaysStore((s) => s.isLoadingFolio);
  const isActionLoading = useHotelStaysStore((s) => s.isActionLoading);
  const submitCheckOut = useHotelStaysStore((s) => s.submitCheckOut);

  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [paidAmount, setPaidAmount] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!checkOutTarget) return null;

  const dueBalance = folioBalance ?? Math.max(0, Number(checkOutTarget.totalCharges) - Number(checkOutTarget.paidAmount));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const amount = parseFloat(paidAmount) || (dueBalance > 0 ? dueBalance : 0);
    const ok = await submitCheckOut(paymentMethod, amount);
    if (!ok) {
      setError("Failed to execute check-out. Please ensure all folio charges are settled.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#292320]/50 p-4 select-none">
      <div className="w-full max-w-md rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-[#D8CEC1] bg-[#FFFCF7] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#16A34A] text-white">
              <LogOut className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#292320]">
                Guest Check-Out — Room {checkOutTarget.room?.roomNumber || ""}
              </h3>
              <p className="text-[11px] text-[#71675E]">
                {checkOutTarget.guestName} (#{checkOutTarget.stayNumber})
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={closeCheckOutModal}
            className="h-8 w-8 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] flex items-center justify-center text-[#71675E] hover:text-[#292320] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Balance Strip */}
        <div className="px-5 py-3.5 border-b border-[#D8CEC1] bg-[#F7F3EC]/70 flex items-center justify-between text-xs">
          <div>
            <span className="text-[#71675E] block text-[11px]">Outstanding Folio Balance:</span>
            {isLoadingFolio ? (
              <span className="font-bold text-[#71675E]">Calculating balance...</span>
            ) : (
              <span
                className={`font-mono font-black text-base tabular-nums ${
                  dueBalance > 0 ? "text-[#DC2626]" : "text-[#16A34A]"
                }`}
              >
                {formatNPR(dueBalance)}
              </span>
            )}
          </div>

          {dueBalance === 0 && !isLoadingFolio && (
            <span className="px-2 py-1 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
              Folio Fully Settled
            </span>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-xs font-bold text-[#DC2626]">
              {error}
            </div>
          )}

          {dueBalance > 0 && (
            <>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[#292320]">Settlement Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full text-xs px-2.5 py-2 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] focus:border-[#6B2837] focus:outline-none cursor-pointer"
                >
                  <option value="CASH">Cash Payment</option>
                  <option value="CARD">Credit / Debit Card (POS Terminal)</option>
                  <option value="FONEPAY">Fonepay Dynamic QR</option>
                  <option value="KHALTI">Khalti Digital Wallet</option>
                  <option value="BANK_TRANSFER">Direct Bank Transfer</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[#292320]">Amount to Collect (Rs.)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder={dueBalance.toString()}
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] font-mono font-bold tabular-nums focus:border-[#6B2837] focus:outline-none"
                />
              </div>
            </>
          )}

          <div className="p-3 rounded-lg border border-dashed border-[#D8CEC1] bg-[#F7F3EC]/50 text-[11px] text-[#71675E] leading-relaxed">
            Completing check-out will mark Room {checkOutTarget.room?.roomNumber} as <strong>Vacant Dirty</strong>, notify housekeeping for room turnover, and finalize the guest billing folio.
          </div>

          {/* Footer */}
          <div className="pt-3 border-t border-[#D8CEC1] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={closeCheckOutModal}
              disabled={isActionLoading}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-[#71675E] cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isActionLoading}
              className="px-4 py-1.5 text-xs font-bold rounded-lg bg-[#16A34A] hover:bg-[#15803D] text-white flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>{isActionLoading ? "Processing..." : "Complete Check-Out"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

