"use client";

import React, { useState, useEffect } from "react";
import { X, CreditCard, Plus, Trash2, CheckCircle2 } from "lucide-react";
import { useHotelFoliosStore } from "../../state/hotel-folios.store";
import { FolioPaymentSplit } from "../../models/hotel.types";

function formatNPR(amount: number | string | undefined): string {
  const val = Number(amount) || 0;
  return `Rs. ${val.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export const SettleFolioModal: React.FC = () => {
  const isSettleModalOpen = useHotelFoliosStore((s) => s.isSettleModalOpen);
  const setIsSettleModalOpen = useHotelFoliosStore((s) => s.setIsSettleModalOpen);
  const selectedFolio = useHotelFoliosStore((s) => s.selectedFolio);
  const isActionLoading = useHotelFoliosStore((s) => s.isActionLoading);
  const settleFolio = useHotelFoliosStore((s) => s.settleFolio);

  const [tenders, setTenders] = useState<FolioPaymentSplit[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (selectedFolio && isSettleModalOpen) {
      setTenders([
        {
          id: "t-1",
          method: "CASH",
          amount: Math.max(0, selectedFolio.balance),
          notes: "",
        },
      ]);
      setError(null);
    }
  }, [selectedFolio, isSettleModalOpen]);

  if (!isSettleModalOpen || !selectedFolio) return null;

  const totalTendered = tenders.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  const balanceDue = selectedFolio.balance;
  const remaining = balanceDue - totalTendered;

  const handleAddTender = () => {
    setTenders((prev) => [
      ...prev,
      {
        id: `t-${Date.now()}`,
        method: "CARD",
        amount: Math.max(0, remaining),
        notes: "",
      },
    ]);
  };

  const handleRemoveTender = (id: string) => {
    if (tenders.length <= 1) return;
    setTenders((prev) => prev.filter((t) => t.id !== id));
  };

  const handleUpdateTender = (id: string, field: keyof FolioPaymentSplit, val: any) => {
    setTenders((prev) =>
      prev.map((t) => (t.id === id ? { ...t, [field]: val } : t))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totalTendered <= 0) {
      setError("Please specify a payment amount greater than 0.");
      return;
    }

    setError(null);
    const ok = await settleFolio(tenders);
    if (!ok) {
      setError("Failed to settle folio. Please try again.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#292320]/50 p-4 backdrop-blur-xs select-none">
      <div className="w-full max-w-lg rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-[#D8CEC1] bg-[#FFFCF7] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#16A34A] text-white">
              <CreditCard className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#292320]">
                Settle Folio — Room {selectedFolio.roomNumber || ""}
              </h3>
              <p className="text-[11px] text-[#71675E]">
                Guest: {selectedFolio.guestName} (#{selectedFolio.folioNumber})
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsSettleModalOpen(false)}
            className="h-8 w-8 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] flex items-center justify-center text-[#71675E] hover:text-[#292320] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Balance Ribbon */}
        <div className="px-5 py-3 border-b border-[#D8CEC1] bg-[#F7F3EC]/70 flex items-center justify-between text-xs">
          <div>
            <span className="text-[#71675E] block text-[10px] uppercase font-bold">Outstanding Balance:</span>
            <span className="font-mono font-bold text-sm text-[#292320] tabular-nums">
              {formatNPR(balanceDue)}
            </span>
          </div>

          <div>
            <span className="text-[#71675E] block text-[10px] uppercase font-bold">Total Tendered:</span>
            <span className="font-mono font-bold text-sm text-[#16A34A] tabular-nums">
              {formatNPR(totalTendered)}
            </span>
          </div>

          <div className="text-right">
            <span className="text-[#71675E] block text-[10px] uppercase font-bold">Remaining:</span>
            <span
              className={`font-mono font-bold text-sm tabular-nums ${
                remaining > 0 ? "text-[#DC2626]" : "text-[#16A34A]"
              }`}
            >
              {formatNPR(remaining)}
            </span>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-2.5 rounded-lg border border-red-200 bg-red-50 text-xs font-bold text-[#DC2626]">
              {error}
            </div>
          )}

          {/* Tender Split Lines */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-[#292320]">Payment Split &amp; Methods</label>
              <button
                type="button"
                onClick={handleAddTender}
                className="text-[11px] font-bold text-[#6B2837] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Plus className="h-3 w-3" />
                <span>+ Split Payment</span>
              </button>
            </div>

            {tenders.map((tender, i) => (
              <div
                key={tender.id}
                className="p-3 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] flex items-center gap-2"
              >
                <select
                  value={tender.method}
                  onChange={(e) => handleUpdateTender(tender.id, "method", e.target.value)}
                  className="w-36 text-xs px-2.5 py-1.5 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] text-[#292320] focus:border-[#6B2837] focus:outline-none cursor-pointer"
                >
                  <option value="CASH">Cash</option>
                  <option value="CARD">Credit / Debit Card</option>
                  <option value="FONEPAY">Fonepay Dynamic QR</option>
                  <option value="KHALTI">Khalti Digital Wallet</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                </select>

                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={tender.amount}
                  onChange={(e) => handleUpdateTender(tender.id, "amount", parseFloat(e.target.value) || 0)}
                  className="flex-1 text-xs px-3 py-1.5 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] font-mono font-bold tabular-nums focus:border-[#6B2837] focus:outline-none"
                  placeholder="Amount"
                />

                {tenders.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveTender(tender.id)}
                    className="p-1 rounded text-[#71675E] hover:text-[#DC2626] hover:bg-red-50 cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="pt-3 border-t border-[#D8CEC1] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsSettleModalOpen(false)}
              disabled={isActionLoading}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-[#71675E] cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isActionLoading || totalTendered <= 0}
              className="px-4 py-1.5 text-xs font-bold rounded-lg bg-[#16A34A] hover:bg-[#15803D] text-white flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>{isActionLoading ? "Settling..." : `Settle & Pay ${formatNPR(totalTendered)}`}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

