"use client";

import React, { useState } from "react";
import { X, Plus, Save } from "lucide-react";
import { useHotelFoliosStore } from "../../state/hotel-folios.store";

export const PostChargeModal: React.FC = () => {
  const isPostChargeModalOpen = useHotelFoliosStore((s) => s.isPostChargeModalOpen);
  const setIsPostChargeModalOpen = useHotelFoliosStore((s) => s.setIsPostChargeModalOpen);
  const selectedFolio = useHotelFoliosStore((s) => s.selectedFolio);
  const isActionLoading = useHotelFoliosStore((s) => s.isActionLoading);
  const postCharge = useHotelFoliosStore((s) => s.postCharge);

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("INCIDENTAL");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!isPostChargeModalOpen || !selectedFolio) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(amount);
    if (!description.trim()) {
      setError("Description is required.");
      return;
    }
    if (!val || val <= 0) {
      setError("Please enter a valid amount greater than 0.");
      return;
    }

    setError(null);
    const ok = await postCharge({
      description: description.trim(),
      amount: val,
      category,
      notes,
    });

    if (ok) {
      setDescription("");
      setAmount("");
      setNotes("");
    } else {
      setError("Failed to post charge. Please try again.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#292320]/50 p-4 select-none">
      <div className="w-full max-w-md rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-[#D8CEC1] bg-[#FFFCF7] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#6B2837] text-white">
              <Plus className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#292320]">
                Post Folio Charge — Room {selectedFolio.roomNumber || ""}
              </h3>
              <p className="text-[11px] text-[#71675E]">
                Guest: {selectedFolio.guestName} (#{selectedFolio.folioNumber})
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsPostChargeModalOpen(false)}
            className="h-8 w-8 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] flex items-center justify-center text-[#71675E] hover:text-[#292320] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-3.5">
          {error && (
            <div className="p-2.5 rounded-lg border border-red-200 bg-red-50 text-xs font-bold text-[#DC2626]">
              {error}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-[#292320]">Charge Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full text-xs px-2.5 py-2 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] focus:border-[#6B2837] focus:outline-none cursor-pointer"
            >
              <option value="MINIBAR">Minibar Consumption</option>
              <option value="LAUNDRY">Laundry / Dry Cleaning</option>
              <option value="RESTAURANT">Room Service / F&amp;B</option>
              <option value="ROOM_NIGHT">Additional Room Charge</option>
              <option value="DAMAGE">Property Damage / Replacement</option>
              <option value="INCIDENTAL">Other Incidental Service</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-[#292320]">
              Description <span className="text-[#DC2626]">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. 2x Himalayan Spring Water, Laundry Service"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] focus:border-[#6B2837] focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-[#292320]">
              Charge Amount (Rs.) <span className="text-[#DC2626]">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              required
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] font-mono font-bold tabular-nums focus:border-[#6B2837] focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-[#71675E]">Notes / Reference</label>
            <input
              type="text"
              placeholder="e.g. Voucher #104, Minibar inspection receipt"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] focus:border-[#6B2837] focus:outline-none"
            />
          </div>

          {/* Footer */}
          <div className="pt-3 border-t border-[#D8CEC1] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsPostChargeModalOpen(false)}
              disabled={isActionLoading}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-[#71675E] cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isActionLoading}
              className="px-4 py-1.5 text-xs font-bold rounded-lg bg-[#6B2837] hover:bg-[#541E2A] text-white flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              <span>{isActionLoading ? "Posting..." : "Post Charge"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

