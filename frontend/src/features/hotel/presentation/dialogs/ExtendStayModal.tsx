"use client";

import React, { useState, useEffect } from "react";
import { X, CalendarPlus, Save } from "lucide-react";
import { useHotelStaysStore } from "../../state/hotel-stays.store";

export const ExtendStayModal: React.FC = () => {
  const extendTarget = useHotelStaysStore((s) => s.extendTarget);
  const closeExtendModal = useHotelStaysStore((s) => s.closeExtendModal);
  const isActionLoading = useHotelStaysStore((s) => s.isActionLoading);
  const submitExtend = useHotelStaysStore((s) => s.submitExtend);

  const [newCheckOut, setNewCheckOut] = useState("");
  const [advancePaid, setAdvancePaid] = useState("0");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (extendTarget) {
      // Default to +1 day from current expected check out
      try {
        const cur = new Date(extendTarget.expectedCheckOut);
        cur.setDate(cur.getDate() + 1);
        const iso = cur.toISOString().slice(0, 16);
        setNewCheckOut(iso);
      } catch {
        setNewCheckOut("");
      }
      setAdvancePaid("0");
      setNotes("");
      setError(null);
    }
  }, [extendTarget]);

  if (!extendTarget) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCheckOut) {
      setError("Please select a new checkout date and time.");
      return;
    }

    setError(null);
    const ok = await submitExtend(
      new Date(newCheckOut).toISOString(),
      parseFloat(advancePaid) || 0,
      notes
    );

    if (!ok) {
      setError("Failed to extend stay. Please check the checkout date.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#292320]/50 p-4 select-none">
      <div className="w-full max-w-md rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-[#D8CEC1] bg-[#FFFCF7] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#6B2837] text-white">
              <CalendarPlus className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#292320]">
                Extend Stay — Room {extendTarget.room?.roomNumber || ""}
              </h3>
              <p className="text-[11px] text-[#71675E]">
                Guest: {extendTarget.guestName} (#{extendTarget.stayNumber})
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={closeExtendModal}
            className="h-8 w-8 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] flex items-center justify-center text-[#71675E] hover:text-[#292320] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-xs font-bold text-[#DC2626]">
              {error}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-[#292320]">
              New Expected Check-Out Date &amp; Time <span className="text-[#DC2626]">*</span>
            </label>
            <input
              type="datetime-local"
              required
              value={newCheckOut}
              onChange={(e) => setNewCheckOut(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] focus:border-[#6B2837] focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-[#71675E]">Additional Advance Paid (Rs.)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={advancePaid}
              onChange={(e) => setAdvancePaid(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] font-mono tabular-nums focus:border-[#6B2837] focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-[#71675E]">Extension Notes</label>
            <input
              type="text"
              placeholder="e.g. Guest extended for 2 more nights for city tour"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] focus:border-[#6B2837] focus:outline-none"
            />
          </div>

          {/* Footer */}
          <div className="pt-3 border-t border-[#D8CEC1] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={closeExtendModal}
              disabled={isActionLoading}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-[#71675E] cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isActionLoading || !newCheckOut}
              className="px-4 py-1.5 text-xs font-bold rounded-lg bg-[#6B2837] hover:bg-[#541E2A] text-white flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              <span>{isActionLoading ? "Saving..." : "Commit Extension"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

