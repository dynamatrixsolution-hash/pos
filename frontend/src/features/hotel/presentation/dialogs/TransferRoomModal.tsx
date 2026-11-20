"use client";

import React, { useState } from "react";
import { X, ArrowRightLeft, Save, AlertTriangle } from "lucide-react";
import { useHotelStaysStore } from "../../state/hotel-stays.store";

export const TransferRoomModal: React.FC = () => {
  const transferTarget = useHotelStaysStore((s) => s.transferTarget);
  const closeTransferModal = useHotelStaysStore((s) => s.closeTransferModal);
  const rooms = useHotelStaysStore((s) => s.rooms);
  const isActionLoading = useHotelStaysStore((s) => s.isActionLoading);
  const submitTransfer = useHotelStaysStore((s) => s.submitTransfer);

  const [targetRoomId, setTargetRoomId] = useState("");
  const [reason, setReason] = useState("Guest requested room upgrade / relocation");
  const [error, setError] = useState<string | null>(null);

  if (!transferTarget) return null;

  // Filter available rooms
  const availableRooms = rooms.filter(
    (r) => r.id !== transferTarget.roomId && (r.status === "VACANT_CLEAN" || r.status === "VACANT_DIRTY")
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetRoomId) {
      setError("Please select a destination room.");
      return;
    }

    setError(null);
    const ok = await submitTransfer(targetRoomId, reason);
    if (!ok) {
      setError("Failed to execute room transfer. Destination room may be occupied.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#292320]/50 p-4 select-none">
      <div className="w-full max-w-md rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-[#D8CEC1] bg-[#FFFCF7] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#B45309] text-white">
              <ArrowRightLeft className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#292320]">
                Transfer Room — {transferTarget.guestName}
              </h3>
              <p className="text-[11px] text-[#71675E]">
                Currently in Room {transferTarget.room?.roomNumber || "Unassigned"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={closeTransferModal}
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
              Destination Room <span className="text-[#DC2626]">*</span>
            </label>
            <select
              value={targetRoomId}
              onChange={(e) => setTargetRoomId(e.target.value)}
              className="w-full text-xs px-2.5 py-2 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] focus:border-[#6B2837] focus:outline-none cursor-pointer"
            >
              <option value="">Select vacant destination room...</option>
              {availableRooms.map((r) => (
                <option key={r.id} value={r.id}>
                  Room {r.roomNumber} ({r.roomType?.name || "Room"} • {r.status.replace("_", " ")})
                </option>
              ))}
            </select>
            {availableRooms.length === 0 && (
              <p className="text-[10px] text-amber-700 font-semibold mt-1 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                <span>No vacant clean/dirty rooms available. Check tape chart allocations.</span>
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-[#71675E]">Transfer Reason / Audit Notes</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Guest AC maintenance, room upgrade, quiet side request"
              className="w-full text-xs px-3 py-2 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] focus:border-[#6B2837] focus:outline-none"
            />
          </div>

          {/* Footer */}
          <div className="pt-3 border-t border-[#D8CEC1] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={closeTransferModal}
              disabled={isActionLoading}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-[#71675E] cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isActionLoading || !targetRoomId}
              className="px-4 py-1.5 text-xs font-bold rounded-lg bg-[#B45309] hover:bg-[#92400E] text-white flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
            >
              <ArrowRightLeft className="h-3.5 w-3.5" />
              <span>{isActionLoading ? "Transferring..." : "Confirm Room Transfer"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

