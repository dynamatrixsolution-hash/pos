"use client";

import React, { useState, useEffect } from "react";
import { useHotelReservationsStore } from "../state/hotel-reservations.store";
import { HotelReservation } from "../models/hotel.types";
import { formatNPR, parseMoney } from "@/lib/currency";
import { Calendar, Plus, KeyRound, XCircle, RefreshCw, X, Loader2 } from "lucide-react";
import { Notify } from "@/lib/notify";

const STATUS_FILTERS = [
  "ALL",
  "CONFIRMED",
  "CHECKED_IN",
  "CHECKED_OUT",
  "CANCELLED",
  "NO_SHOW",
] as const;

export function ReservationsContainer() {
  const {
    reservations,
    roomTypes,
    rooms,
    statusFilter,
    loading,
    actionLoading,
    setStatusFilter,
    loadReservations,
    createReservation,
    updateReservationStatus,
    checkInReservation,
  } = useHotelReservationsStore();

  // Create Modal
  const [showNewModal, setShowNewModal] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [roomTypeId, setRoomTypeId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [checkInDate, setCheckInDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [checkOutDate, setCheckOutDate] = useState(() => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    return tomorrow.toISOString().slice(0, 10);
  });
  const [adults, setAdults] = useState("2");
  const [children, setChildren] = useState("0");
  const [ratePlan, setRatePlan] = useState("STANDARD");
  const [nightlyRate, setNightlyRate] = useState("4500");
  const [depositAmount, setDepositAmount] = useState("0");
  const [specialRequests, setSpecialRequests] = useState("");

  // Check In Modal
  const [checkInItem, setCheckInItem] = useState<HotelReservation | null>(null);
  const [selectedCheckInRoomId, setSelectedCheckInRoomId] = useState("");
  const [checkInIdType, setCheckInIdType] = useState("CITIZENSHIP");
  const [checkInIdNumber, setCheckInIdNumber] = useState("");
  const [checkInPaidAmount, setCheckInPaidAmount] = useState("0");

  useEffect(() => {
    loadReservations();
  }, [loadReservations]);

  const handleRoomTypeChange = (newRtId: string) => {
    setRoomTypeId(newRtId);
    setRoomId("");
    const found = roomTypes.find((r) => r.id === newRtId);
    if (found) {
      setNightlyRate(String(parseMoney(found.baseRate)));
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomTypeId) {
      Notify.warning("Please select a Room Type");
      return;
    }
    const success = await createReservation({
      guestName,
      guestPhone: guestPhone || undefined,
      guestEmail: guestEmail || undefined,
      roomTypeId,
      roomId: roomId || undefined,
      checkInDate: new Date(`${checkInDate}T14:00:00.000Z`).toISOString(),
      checkOutDate: new Date(`${checkOutDate}T12:00:00.000Z`).toISOString(),
      adults: Number(adults) || 1,
      children: Number(children) || 0,
      ratePlan,
      nightlyRate: Number(nightlyRate) || 0,
      depositAmount: Number(depositAmount) || 0,
      specialRequests: specialRequests || undefined,
    });
    if (success) {
      setShowNewModal(false);
      setGuestName("");
      setGuestPhone("");
      setGuestEmail("");
      setRoomId("");
      setDepositAmount("0");
      setSpecialRequests("");
    }
  };

  const openCheckIn = (rsv: HotelReservation) => {
    setCheckInItem(rsv);
    if (rsv.roomId) {
      setSelectedCheckInRoomId(rsv.roomId);
    } else {
      const candidate = rooms.find((rm) => rm.roomTypeId === rsv.roomTypeId && rm.status === "VACANT_CLEAN");
      setSelectedCheckInRoomId(candidate?.id || "");
    }
    setCheckInPaidAmount(String(parseMoney(rsv.depositAmount)));
  };

  const handleConfirmCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkInItem || !selectedCheckInRoomId) {
      Notify.warning("Please select a clean room for check-in");
      return;
    }
    const success = await checkInReservation({
      reservationId: checkInItem.id,
      roomId: selectedCheckInRoomId,
      guestName: checkInItem.guestName,
      guestPhone: checkInItem.guestPhone || undefined,
      guestEmail: checkInItem.guestEmail || undefined,
      guestIdType: checkInIdType,
      guestIdNumber: checkInIdNumber || undefined,
      expectedCheckOut: checkInItem.checkOutDate,
      ratePerNight: parseMoney(checkInItem.nightlyRate),
      paidAmount: Number(checkInPaidAmount) || 0,
    });
    if (success) {
      setCheckInItem(null);
      setCheckInIdNumber("");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "CONFIRMED":
        return "bg-[#FDF6E9] text-[#946000] border-[#EDD7AD]";
      case "CHECKED_IN":
        return "bg-[#F9EFF1] text-[#6B2837] border-[#E3C6CC]";
      case "CHECKED_OUT":
        return "bg-[#EBF4F0] text-[#28634B] border-[#C3DED0]";
      case "CANCELLED":
      case "NO_SHOW":
      default:
        return "bg-[#FCEEEE] text-[#B33432] border-[#E9B6B7]";
    }
  };

  const matchingRoomsForForm = rooms.filter((rm) => !roomTypeId || rm.roomTypeId === roomTypeId);
  const vacantCleanRoomsForCheckIn = rooms.filter((rm) => rm.status === "VACANT_CLEAN");

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#EEE7DD] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-[#6B2837]" />
            <h1 className="text-xl font-bold text-[#292320] tracking-tight">Hotel Reservations</h1>
          </div>
          <p className="text-xs text-[#71675E] mt-0.5">
            Bookings, deposit collection, room allocations & arrivals
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadReservations()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#292320] bg-[#FFFCF7] border border-[#EEE7DD] rounded-md hover:bg-[#F7F3EC] transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={() => setShowNewModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#6B2837] rounded-md hover:bg-[#521E2A] transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4" />
            New Reservation
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 border-b border-[#EEE7DD] pb-2 overflow-x-auto">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              statusFilter === s
                ? "bg-[#6B2837] text-white"
                : "text-[#71675E] hover:text-[#292320] hover:bg-[#F7F3EC]"
            }`}
          >
            {s.replace("_", " ")}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="p-8 text-center text-xs text-[#71675E] bg-[#FFFCF7] border border-[#EEE7DD] rounded-lg">
          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-[#6B2837]" />
          Loading reservations...
        </div>
      ) : reservations.length === 0 ? (
        <div className="p-10 text-center bg-[#FFFCF7] border border-[#EEE7DD] rounded-lg">
          <Calendar className="h-8 w-8 text-[#71675E] mx-auto mb-2 opacity-50" />
          <h3 className="text-sm font-semibold text-[#292320]">No reservations found</h3>
          <p className="text-xs text-[#71675E] mt-1">There are no bookings matching this status filter.</p>
        </div>
      ) : (
        <div className="bg-[#FFFCF7] border border-[#EEE7DD] rounded-lg overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#EEE7DD] bg-[#F7F3EC] text-[#71675E]">
                <th className="py-2.5 px-3 font-semibold">Res #</th>
                <th className="py-2.5 px-3 font-semibold">Guest</th>
                <th className="py-2.5 px-3 font-semibold">Room / Type</th>
                <th className="py-2.5 px-3 font-semibold">Check-In</th>
                <th className="py-2.5 px-3 font-semibold">Check-Out</th>
                <th className="py-2.5 px-3 font-semibold text-right">Est. Total</th>
                <th className="py-2.5 px-3 font-semibold text-right">Deposit</th>
                <th className="py-2.5 px-3 font-semibold">Status</th>
                <th className="py-2.5 px-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEE7DD]">
              {reservations.map((rsv) => (
                <tr key={rsv.id} className="hover:bg-[#F7F3EC]/50 transition-colors">
                  <td className="py-2.5 px-3 font-mono text-[#292320] font-medium">
                    {rsv.reservationNumber}
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="font-semibold text-[#292320]">{rsv.guestName}</div>
                    {rsv.guestPhone && <div className="text-[11px] text-[#71675E]">{rsv.guestPhone}</div>}
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="font-medium text-[#292320]">{rsv.roomType?.name || "Standard Room"}</div>
                    <div className="text-[11px] text-[#71675E]">
                      {rsv.room?.roomNumber ? `Assigned: Room ${rsv.room.roomNumber}` : "Unassigned Room"}
                    </div>
                  </td>
                  <td className="py-2.5 px-3 tabular-nums text-[#292320]">
                    {new Date(rsv.checkInDate).toLocaleDateString()}
                  </td>
                  <td className="py-2.5 px-3 tabular-nums text-[#292320]">
                    {new Date(rsv.checkOutDate).toLocaleDateString()} ({rsv.nights} n)
                  </td>
                  <td className="py-2.5 px-3 tabular-nums text-right font-medium text-[#292320]">
                    {formatNPR(parseMoney(rsv.totalEstimated))}
                  </td>
                  <td className="py-2.5 px-3 tabular-nums text-right font-medium text-[#28634B]">
                    {formatNPR(parseMoney(rsv.depositAmount))}
                  </td>
                  <td className="py-2.5 px-3">
                    <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold border ${getStatusBadge(rsv.status)}`}>
                      {rsv.status}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {rsv.status === "CONFIRMED" && (
                        <>
                          <button
                            onClick={() => openCheckIn(rsv)}
                            disabled={actionLoading}
                            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-[#6B2837] bg-[#F9EFF1] hover:bg-[#F2DFE4] rounded border border-[#E3C6CC] transition-colors"
                          >
                            <KeyRound className="h-3 w-3" />
                            Check In
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Cancel reservation ${rsv.reservationNumber}?`)) {
                                updateReservationStatus(rsv.id, "CANCELLED");
                              }
                            }}
                            disabled={actionLoading}
                            className="p-1 text-[#B33432] hover:bg-[#FCEEEE] rounded transition-colors"
                            title="Cancel Booking"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* New Reservation Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-[#FFFCF7] border border-[#EEE7DD] rounded-xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#EEE7DD] pb-3">
              <h3 className="text-base font-bold text-[#292320]">New Hotel Reservation</h3>
              <button onClick={() => setShowNewModal(false)} className="p-1 rounded text-[#71675E] hover:bg-[#F7F3EC]">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#292320] mb-1">Guest Name *</label>
                  <input
                    type="text"
                    required
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="Full Guest Name"
                    className="w-full px-3 py-2 bg-[#F7F3EC] border border-[#EEE7DD] rounded-md focus:border-[#6B2837] outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#292320] mb-1">Guest Phone</label>
                  <input
                    type="tel"
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                    placeholder="98XXXXXXXX"
                    className="w-full px-3 py-2 bg-[#F7F3EC] border border-[#EEE7DD] rounded-md focus:border-[#6B2837] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#292320] mb-1">Room Type *</label>
                  <select
                    required
                    value={roomTypeId}
                    onChange={(e) => handleRoomTypeChange(e.target.value)}
                    className="w-full px-3 py-2 bg-[#F7F3EC] border border-[#EEE7DD] rounded-md focus:border-[#6B2837] outline-none"
                  >
                    <option value="">Select Room Type</option>
                    {roomTypes.map((rt) => (
                      <option key={rt.id} value={rt.id}>
                        {rt.name} ({formatNPR(parseMoney(rt.baseRate))}/night)
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-[#292320] mb-1">Assigned Room (Optional)</label>
                  <select
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value)}
                    className="w-full px-3 py-2 bg-[#F7F3EC] border border-[#EEE7DD] rounded-md focus:border-[#6B2837] outline-none"
                  >
                    <option value="">Leave Unassigned (Assign at Check-In)</option>
                    {matchingRoomsForForm.map((rm) => (
                      <option key={rm.id} value={rm.id}>
                        Room {rm.roomNumber} ({rm.status})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#292320] mb-1">Check-In Date *</label>
                  <input
                    type="date"
                    required
                    value={checkInDate}
                    onChange={(e) => setCheckInDate(e.target.value)}
                    className="w-full px-3 py-2 bg-[#F7F3EC] border border-[#EEE7DD] rounded-md focus:border-[#6B2837] outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#292320] mb-1">Check-Out Date *</label>
                  <input
                    type="date"
                    required
                    value={checkOutDate}
                    onChange={(e) => setCheckOutDate(e.target.value)}
                    className="w-full px-3 py-2 bg-[#F7F3EC] border border-[#EEE7DD] rounded-md focus:border-[#6B2837] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-[#292320] mb-1">Rate / Night (NPR)</label>
                  <input
                    type="number"
                    value={nightlyRate}
                    onChange={(e) => setNightlyRate(e.target.value)}
                    className="w-full px-3 py-2 tabular-nums bg-[#F7F3EC] border border-[#EEE7DD] rounded-md focus:border-[#6B2837] outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#292320] mb-1">Deposit Paid (NPR)</label>
                  <input
                    type="number"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    className="w-full px-3 py-2 tabular-nums bg-[#F7F3EC] border border-[#EEE7DD] rounded-md focus:border-[#6B2837] outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#292320] mb-1">Rate Plan</label>
                  <input
                    type="text"
                    value={ratePlan}
                    onChange={(e) => setRatePlan(e.target.value)}
                    className="w-full px-3 py-2 bg-[#F7F3EC] border border-[#EEE7DD] rounded-md focus:border-[#6B2837] outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#292320] mb-1">Special Requests</label>
                <textarea
                  rows={2}
                  value={specialRequests}
                  onChange={(e) => setSpecialRequests(e.target.value)}
                  placeholder="e.g. Extra towels, quiet room, late check-in"
                  className="w-full px-3 py-2 bg-[#F7F3EC] border border-[#EEE7DD] rounded-md focus:border-[#6B2837] outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#EEE7DD]">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-3.5 py-2 font-medium text-[#292320] bg-[#FFFCF7] border border-[#EEE7DD] rounded-md hover:bg-[#F7F3EC]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 font-semibold text-white bg-[#6B2837] rounded-md hover:bg-[#521E2A] transition-colors"
                >
                  {actionLoading ? "Saving..." : "Confirm Booking"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Check In Modal */}
      {checkInItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-[#FFFCF7] border border-[#EEE7DD] rounded-xl max-w-md w-full p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#EEE7DD] pb-3">
              <h3 className="text-base font-bold text-[#292320]">
                Check-In: {checkInItem.reservationNumber}
              </h3>
              <button onClick={() => setCheckInItem(null)} className="p-1 rounded text-[#71675E] hover:bg-[#F7F3EC]">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmCheckIn} className="space-y-4 text-xs">
              <div className="bg-[#F7F3EC] p-3 rounded border border-[#EEE7DD]">
                <div className="font-semibold text-[#292320]">{checkInItem.guestName}</div>
                <div className="text-[#71675E]">
                  Type: {checkInItem.roomType?.name} • Rate: {formatNPR(parseMoney(checkInItem.nightlyRate))}/night
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#292320] mb-1">Assign Clean Room *</label>
                <select
                  required
                  value={selectedCheckInRoomId}
                  onChange={(e) => setSelectedCheckInRoomId(e.target.value)}
                  className="w-full px-3 py-2 bg-[#F7F3EC] border border-[#EEE7DD] rounded-md focus:border-[#6B2837] outline-none"
                >
                  <option value="">Select Clean Room</option>
                  {vacantCleanRoomsForCheckIn.map((rm) => (
                    <option key={rm.id} value={rm.id}>
                      Room {rm.roomNumber} ({rm.roomType?.name || "Room"})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#292320] mb-1">ID Type</label>
                  <select
                    value={checkInIdType}
                    onChange={(e) => setCheckInIdType(e.target.value)}
                    className="w-full px-3 py-2 bg-[#F7F3EC] border border-[#EEE7DD] rounded-md focus:border-[#6B2837] outline-none"
                  >
                    <option value="CITIZENSHIP">Citizenship</option>
                    <option value="PASSPORT">Passport</option>
                    <option value="DRIVING_LICENSE">Driving License</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-[#292320] mb-1">ID Number</label>
                  <input
                    type="text"
                    value={checkInIdNumber}
                    onChange={(e) => setCheckInIdNumber(e.target.value)}
                    placeholder="Document #"
                    className="w-full px-3 py-2 bg-[#F7F3EC] border border-[#EEE7DD] rounded-md focus:border-[#6B2837] outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#292320] mb-1">Advance / Paid Amount (NPR)</label>
                <input
                  type="number"
                  value={checkInPaidAmount}
                  onChange={(e) => setCheckInPaidAmount(e.target.value)}
                  className="w-full px-3 py-2 tabular-nums bg-[#F7F3EC] border border-[#EEE7DD] rounded-md focus:border-[#6B2837] outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#EEE7DD]">
                <button
                  type="button"
                  onClick={() => setCheckInItem(null)}
                  className="px-3.5 py-2 font-medium text-[#292320] bg-[#FFFCF7] border border-[#EEE7DD] rounded-md hover:bg-[#F7F3EC]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 font-semibold text-white bg-[#6B2837] rounded-md hover:bg-[#521E2A] transition-colors"
                >
                  {actionLoading ? "Processing..." : "Complete Check-In"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

