"use client";

import React, { useState, useEffect } from "react";
import { UserCheck, X } from "lucide-react";
import { useHotelUiStore } from "../../state/hotel-ui.store";
import { useHotelRoomsStore } from "../../state/hotel-rooms.store";
import { parseMoney } from "@/lib/currency";

export const FastCheckInModal: React.FC = () => {
  const show = useHotelUiStore((s) => s.showFastCheckInModal);
  const setShow = useHotelUiStore((s) => s.setShowFastCheckInModal);
  const selectedRoomForAction = useHotelUiStore((s) => s.selectedRoomForAction);

  const rooms = useHotelRoomsStore((s) => s.rooms);
  const fastCheckIn = useHotelRoomsStore((s) => s.fastCheckIn);
  const actionLoading = useHotelRoomsStore((s) => s.actionLoading);

  const vacantRooms = rooms.filter((r) => r.status === "VACANT_CLEAN");

  const [roomId, setRoomId] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [idType, setIdType] = useState("CITIZENSHIP");
  const [idNumber, setIdNumber] = useState("");
  const [expectedCheckOut, setExpectedCheckOut] = useState(() => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    return tomorrow.toISOString().slice(0, 10);
  });
  const [nightlyRate, setNightlyRate] = useState("4500");
  const [advancePaid, setAdvancePaid] = useState("0");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (selectedRoomForAction) {
      setRoomId(selectedRoomForAction.id);
      if (selectedRoomForAction.roomType?.baseRate !== undefined) {
        setNightlyRate(String(parseMoney(selectedRoomForAction.roomType.baseRate)));
      }
    } else if (vacantRooms.length > 0) {
      setRoomId(vacantRooms[0].id);
      if (vacantRooms[0].roomType?.baseRate !== undefined) {
        setNightlyRate(String(parseMoney(vacantRooms[0].roomType.baseRate)));
      }
    }
  }, [selectedRoomForAction, show]);

  if (!show) return null;

  const handleRoomChange = (rId: string) => {
    setRoomId(rId);
    const found = rooms.find((r) => r.id === rId);
    if (found?.roomType?.baseRate !== undefined) {
      setNightlyRate(String(parseMoney(found.roomType.baseRate)));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomId) return;
    await fastCheckIn({
      roomId,
      guestName,
      guestPhone: guestPhone || undefined,
      guestEmail: guestEmail || undefined,
      guestIdType: idType,
      guestIdNumber: idNumber || undefined,
      expectedCheckOut: new Date(`${expectedCheckOut}T12:00:00.000Z`).toISOString(),
      ratePerNight: Number(nightlyRate) || 0,
      paidAmount: Number(advancePaid) || 0,
      notes: notes || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#292320]/50 p-4 backdrop-blur-xs select-none">
      <div className="w-full max-w-lg rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] p-5 space-y-4 shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#D8CEC1] pb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#16A34A] text-white">
              <UserCheck className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#292320]">Fast Guest Check-In</h3>
              <p className="text-[11px] text-[#71675E]">
                Register walk-in or expected guest and open room stay folio
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShow(false)}
            className="h-8 w-8 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] flex items-center justify-center text-[#71675E] hover:text-[#292320] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-3.5 pr-1">
          {/* Room Selection & Rate */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#292320] mb-1">Select Room *</label>
              <select
                value={roomId}
                onChange={(e) => handleRoomChange(e.target.value)}
                required
                className="w-full text-xs px-3 py-2 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] text-[#292320] focus:border-[#6B2837] focus:outline-none"
              >
                {vacantRooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    Room {r.roomNumber} ({r.roomType.name} - Rs. {r.roomType.baseRate})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#292320] mb-1">Rate Per Night (Rs.) *</label>
              <input
                type="number"
                value={nightlyRate}
                onChange={(e) => setNightlyRate(e.target.value)}
                required
                className="w-full text-xs px-3 py-2 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] text-[#292320] tabular-nums focus:border-[#6B2837] focus:outline-none"
              />
            </div>
          </div>

          {/* Guest Name & Phone */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#292320] mb-1">Guest Full Name *</label>
              <input
                type="text"
                placeholder="e.g. Ramesh KC"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                required
                className="w-full text-xs px-3 py-2 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] text-[#292320] focus:border-[#6B2837] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#292320] mb-1">Phone Number</label>
              <input
                type="text"
                placeholder="e.g. 9841234567"
                value={guestPhone}
                onChange={(e) => setGuestPhone(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] text-[#292320] focus:border-[#6B2837] focus:outline-none"
              />
            </div>
          </div>

          {/* Email & ID Proof */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#292320] mb-1">ID Document</label>
              <select
                value={idType}
                onChange={(e) => setIdType(e.target.value)}
                className="w-full text-xs px-2.5 py-2 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] text-[#292320] focus:border-[#6B2837] focus:outline-none"
              >
                <option value="CITIZENSHIP">Citizenship</option>
                <option value="PASSPORT">Passport</option>
                <option value="DRIVING_LICENSE">Driving License</option>
                <option value="NATIONAL_ID">National ID</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#292320] mb-1">ID Number</label>
              <input
                type="text"
                placeholder="Document #"
                value={idNumber}
                onChange={(e) => setIdNumber(e.target.value)}
                className="w-full text-xs px-2.5 py-2 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] text-[#292320] focus:border-[#6B2837] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#292320] mb-1">Expected Checkout *</label>
              <input
                type="date"
                value={expectedCheckOut}
                onChange={(e) => setExpectedCheckOut(e.target.value)}
                required
                className="w-full text-xs px-2.5 py-2 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] text-[#292320] focus:border-[#6B2837] focus:outline-none"
              />
            </div>
          </div>

          {/* Advance Deposit & Notes */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#292320] mb-1">Advance Deposit (Rs.)</label>
              <input
                type="number"
                value={advancePaid}
                onChange={(e) => setAdvancePaid(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] text-[#292320] tabular-nums focus:border-[#6B2837] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#292320] mb-1">Special Notes</label>
              <input
                type="text"
                placeholder="e.g. Extra pillows, early breakfast"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] text-[#292320] focus:border-[#6B2837] focus:outline-none"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-[#D8CEC1] flex items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShow(false)}
              className="px-4 py-2 text-xs font-medium rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-[#71675E] hover:bg-[#EEE7DD] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={actionLoading}
              className="px-5 py-2 text-xs font-bold rounded-lg bg-[#16A34A] hover:bg-[#15803D] text-white cursor-pointer shadow-xs transition-colors flex items-center gap-1.5"
            >
              <UserCheck className="h-4 w-4" />
              <span>{actionLoading ? "Checking In..." : "Confirm Check-In"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

