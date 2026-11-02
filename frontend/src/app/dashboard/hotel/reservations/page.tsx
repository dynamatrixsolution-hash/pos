"use client";

import { Notify } from "@/lib/notify";

import React, { useState, useEffect, useCallback } from "react";
import { formatNPR, parseMoney } from "@/lib/currency";
import {
  Calendar,
  Plus,
  KeyRound,
  XCircle,
  RefreshCw,
  UserCheck,
  X,
} from "lucide-react";

interface RoomType {
  id: string;
  name: string;
  code: string;
  baseRate: number | string;
}

interface Room {
  id: string;
  roomNumber: string;
  roomTypeId: string;
  status: string;
  roomType?: RoomType;
}

interface Reservation {
  id: string;
  reservationNumber: string;
  guestName: string;
  guestPhone?: string | null;
  guestEmail?: string | null;
  roomTypeId: string;
  roomId?: string | null;
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  adults: number;
  children: number;
  status: "CONFIRMED" | "CHECKED_IN" | "CHECKED_OUT" | "CANCELLED" | "NO_SHOW";
  ratePlan: string;
  nightlyRate: number | string;
  totalEstimated: number | string;
  depositAmount: number | string;
  specialRequests?: string | null;
  roomType?: RoomType;
  room?: Room | null;
}

const STATUS_FILTERS = [
  "ALL",
  "CONFIRMED",
  "CHECKED_IN",
  "CHECKED_OUT",
  "CANCELLED",
  "NO_SHOW",
] as const;

export default function HotelReservationsPage() {
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // + New Reservation Modal
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

  // Check-In Modal for Confirmed Reservation
  const [checkInReservation, setCheckInReservation] = useState<Reservation | null>(null);
  const [selectedCheckInRoomId, setSelectedCheckInRoomId] = useState("");
  const [checkInIdType, setCheckInIdType] = useState("CITIZENSHIP");
  const [checkInIdNumber, setCheckInIdNumber] = useState("");
  const [checkInPaidAmount, setCheckInPaidAmount] = useState("0");

  const loadReservations = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const statusQuery =
        statusFilter !== "ALL" ? `?status=${encodeURIComponent(statusFilter)}` : "";

      const [resList, rtRes, rmRes] = await Promise.all([
        fetch(`/api/v1/hotel/reservations${statusQuery}`),
        fetch("/api/v1/hotel/room-types"),
        fetch("/api/v1/hotel/rooms"),
      ]);

      if (rtRes.ok) {
        const rtData = await rtRes.json();
        const rts: RoomType[] = rtData.roomTypes || [];
        setRoomTypes(rts);
        if (rts.length > 0 && !roomTypeId) {
          setRoomTypeId(rts[0].id);
          setNightlyRate(String(parseMoney(rts[0].baseRate)));
        }
      }

      if (rmRes.ok) {
        const rmData = await rmRes.json();
        setRooms(rmData.rooms || []);
      }

      if (!resList.ok) {
        const err = await resList.json().catch(() => ({}));
        throw new Error(err.error || "Failed to load reservations");
      }

      const data = await resList.json();
      setReservations(data.reservations || []);
    } catch (err: any) { Notify.failure(err.message || "Error loading reservations"); } finally {
      setLoading(false);
    }
  }, [statusFilter, roomTypeId]);

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

  const handleCreateReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomTypeId) {
      Notify.warning("Please select a Room Type.");
      return;
    }
    try {
      setActionLoading(true);
      const res = await fetch("/api/v1/hotel/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create reservation");

      setShowNewModal(false);
      setGuestName("");
      setGuestPhone("");
      setGuestEmail("");
      setRoomId("");
      setDepositAmount("0");
      setSpecialRequests("");
      await loadReservations();
    } catch (err: any) {
      Notify.failure(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const openCheckInDialog = (rsv: Reservation) => {
    setCheckInReservation(rsv);
    if (rsv.roomId) {
      setSelectedCheckInRoomId(rsv.roomId);
    } else {
      const candidate = rooms.find(
        (rm) => rm.roomTypeId === rsv.roomTypeId && rm.status === "VACANT_CLEAN"
      );
      setSelectedCheckInRoomId(candidate?.id || "");
    }
    setCheckInPaidAmount(String(parseMoney(rsv.depositAmount)));
  };

  const handleConfirmCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkInReservation || !selectedCheckInRoomId) {
      Notify.warning("Please select a Vacant Clean room for check-in.");
      return;
    }
    try {
      setActionLoading(true);
      const res = await fetch("/api/v1/hotel/stays/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reservationId: checkInReservation.id,
          roomId: selectedCheckInRoomId,
          guestName: checkInReservation.guestName,
          guestPhone: checkInReservation.guestPhone || undefined,
          guestEmail: checkInReservation.guestEmail || undefined,
          guestIdType: checkInIdType,
          guestIdNumber: checkInIdNumber || undefined,
          expectedCheckOut: checkInReservation.checkOutDate,
          ratePerNight: parseMoney(checkInReservation.nightlyRate),
          paidAmount: Number(checkInPaidAmount) || 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Check-in failed");

      setCheckInReservation(null);
      setCheckInIdNumber("");
      await loadReservations();
    } catch (err: any) {
      Notify.failure(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelReservation = async (rsv: Reservation) => {
    if (!confirm(`Cancel reservation ${rsv.reservationNumber} for ${rsv.guestName}?`)) return;
    try {
      setActionLoading(true);
      const res = await fetch(`/api/v1/hotel/reservations/${rsv.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "CANCELLED",
          reason: "Cancelled by staff from Reservations desk",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to cancel reservation");
      await loadReservations();
    } catch (err: any) {
      Notify.failure(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status: Reservation["status"]) => {
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

  const matchingRoomsForForm = rooms.filter(
    (rm) => !roomTypeId || rm.roomTypeId === roomTypeId
  );

  const vacantCleanRoomsForCheckIn = rooms.filter((rm) => rm.status === "VACANT_CLEAN");

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-sandstone pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-[#6B2837]" />
            <h1 className="text-xl font-bold text-espresso tracking-tight">
              Hotel Reservations
            </h1>
          </div>
          <p className="text-xs text-warmgray mt-0.5">
            Manage advance bookings, room pre-allocations, deposits, and one-click guest check-in
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadReservations}
            className="p-2 rounded-lg border border-sandstone bg-porcelain hover:bg-stone text-espresso cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            type="button"
            onClick={() => setShowNewModal(true)}
            className="px-4 py-2 text-xs font-bold rounded-lg bg-[#6B2837] hover:bg-[#541E2A] text-[#FFFCF7] shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New Reservation</span>
          </button>
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {STATUS_FILTERS.map((st) => {
          const active = statusFilter === st;
          return (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all whitespace-nowrap cursor-pointer ${
                active
                  ? "bg-[#6B2837] text-[#FFFCF7] border-[#6B2837] shadow-xs"
                  : "bg-porcelain text-espresso border-sandstone hover:bg-stone"
              }`}
            >
              {st.replace("_", " ")}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="rounded-md border border-[#E9B6B7] bg-[#FCEEEE] p-3 text-xs font-medium text-[#B33432]">
          {error}
        </div>
      )}

      {/* Reservations Table */}
      <div className="rounded-md border border-sandstone bg-porcelain shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-warmgray">Loading reservations...</div>
        ) : reservations.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <div className="text-sm font-bold text-espresso">No Reservations Found</div>
            <p className="text-xs text-warmgray">
              Create a new reservation to reserve room inventory and track guest arrivals.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-sandstone bg-ivory/70 text-[11px] font-bold uppercase text-warmgray">
                  <th className="px-4 py-3">Booking #</th>
                  <th className="px-4 py-3">Guest</th>
                  <th className="px-4 py-3">Room Type / Room</th>
                  <th className="px-4 py-3">Check-In → Check-Out</th>
                  <th className="px-4 py-3">Rate / Total</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Quick Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sandstone/60 text-xs">
                {reservations.map((rsv) => (
                  <tr key={rsv.id} className="hover:bg-ivory/40 transition-colors">
                    <td className="px-4 py-3 font-extrabold text-espresso whitespace-nowrap">
                      {rsv.reservationNumber}
                      <div className="text-[10px] font-medium text-warmgray">
                        {rsv.adults}A {rsv.children > 0 ? `• ${rsv.children}C` : ""} •{" "}
                        {rsv.ratePlan}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-espresso">{rsv.guestName}</div>
                      <div className="text-[11px] text-warmgray">
                        {rsv.guestPhone || rsv.guestEmail || "Walk-in / Direct"}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-espresso">
                        {rsv.roomType?.name || "Standard"}
                      </div>
                      <div className="text-[11px] text-warmgray">
                        {rsv.room ? `Assigned: Rm ${rsv.room.roomNumber}` : "Unassigned Room"}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="font-semibold text-espresso">
                        {new Date(rsv.checkInDate).toLocaleDateString()} →{" "}
                        {new Date(rsv.checkOutDate).toLocaleDateString()}
                      </div>
                      <div className="text-[10px] text-warmgray">{rsv.nights} Night(s)</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="font-bold text-espresso">
                        {formatNPR(rsv.totalEstimated)}
                      </div>
                      <div className="text-[10px] text-warmgray">
                        {formatNPR(rsv.nightlyRate)}/night • Dep: {formatNPR(rsv.depositAmount)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${getStatusBadge(
                          rsv.status
                        )}`}
                      >
                        {rsv.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {rsv.status === "CONFIRMED" ? (
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openCheckInDialog(rsv)}
                            className="px-3 py-1.5 rounded-lg bg-[#6B2837] hover:bg-[#541E2A] text-[#FFFCF7] text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <UserCheck className="h-3 w-3" />
                            <span>Check In Now</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCancelReservation(rsv)}
                            className="px-2.5 py-1.5 rounded-lg border border-[#E9B6B7] bg-[#FCEEEE] text-[#B33432] text-[11px] font-semibold hover:opacity-90 flex items-center gap-1 cursor-pointer"
                          >
                            <XCircle className="h-3 w-3" />
                            <span>Cancel</span>
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-warmgray italic">No actions</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* + New Reservation Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-espresso/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-md border border-sandstone bg-porcelain p-5 space-y-4 shadow-sm max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-sandstone pb-3">
              <h3 className="text-sm font-bold text-espresso">Create New Reservation</h3>
              <button
                type="button"
                onClick={() => setShowNewModal(false)}
                className="text-warmgray hover:text-espresso cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateReservation} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-espresso mb-1">
                    Guest Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Full Name"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    className="w-full text-xs rounded-lg border border-sandstone bg-ivory/50 px-3 py-2 text-espresso focus:outline-none focus:border-[#6B2837]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-espresso mb-1">Phone</label>
                  <input
                    type="text"
                    placeholder="+977 98..."
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                    className="w-full text-xs rounded-lg border border-sandstone bg-ivory/50 px-3 py-2 text-espresso focus:outline-none focus:border-[#6B2837]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-espresso mb-1">Email</label>
                  <input
                    type="email"
                    placeholder="guest@mail.com"
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                    className="w-full text-xs rounded-lg border border-sandstone bg-ivory/50 px-3 py-2 text-espresso focus:outline-none focus:border-[#6B2837]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-espresso mb-1">
                    Room Type *
                  </label>
                  <select
                    required
                    value={roomTypeId}
                    onChange={(e) => handleRoomTypeChange(e.target.value)}
                    className="w-full text-xs rounded-lg border border-sandstone bg-ivory/50 px-3 py-2 text-espresso focus:outline-none focus:border-[#6B2837]"
                  >
                    <option value="">-- Select Room Type --</option>
                    {roomTypes.map((rt) => (
                      <option key={rt.id} value={rt.id}>
                        {rt.name} ({formatNPR(rt.baseRate)})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-espresso mb-1">
                    Assign Specific Room (Optional)
                  </label>
                  <select
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value)}
                    className="w-full text-xs rounded-lg border border-sandstone bg-ivory/50 px-3 py-2 text-espresso focus:outline-none focus:border-[#6B2837]"
                  >
                    <option value="">-- Any Available Room --</option>
                    {matchingRoomsForForm.map((rm) => (
                      <option key={rm.id} value={rm.id}>
                        Room {rm.roomNumber} ({rm.status})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-espresso mb-1">
                    Check-In Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={checkInDate}
                    onChange={(e) => setCheckInDate(e.target.value)}
                    className="w-full text-xs rounded-lg border border-sandstone bg-ivory/50 px-2.5 py-2 text-espresso focus:outline-none focus:border-[#6B2837]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-espresso mb-1">
                    Check-Out Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={checkOutDate}
                    onChange={(e) => setCheckOutDate(e.target.value)}
                    className="w-full text-xs rounded-lg border border-sandstone bg-ivory/50 px-2.5 py-2 text-espresso focus:outline-none focus:border-[#6B2837]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-espresso mb-1">Adults</label>
                  <input
                    type="number"
                    min="1"
                    value={adults}
                    onChange={(e) => setAdults(e.target.value)}
                    className="w-full text-xs rounded-lg border border-sandstone bg-ivory/50 px-2.5 py-2 text-espresso focus:outline-none focus:border-[#6B2837]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-espresso mb-1">
                    Children
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={children}
                    onChange={(e) => setChildren(e.target.value)}
                    className="w-full text-xs rounded-lg border border-sandstone bg-ivory/50 px-2.5 py-2 text-espresso focus:outline-none focus:border-[#6B2837]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-espresso mb-1">
                    Rate Plan
                  </label>
                  <select
                    value={ratePlan}
                    onChange={(e) => setRatePlan(e.target.value)}
                    className="w-full text-xs rounded-lg border border-sandstone bg-ivory/50 px-3 py-2 text-espresso focus:outline-none focus:border-[#6B2837]"
                  >
                    <option value="STANDARD">STANDARD (EP)</option>
                    <option value="BB">BED & BREAKFAST (BB)</option>
                    <option value="MAP">HALF BOARD (MAP)</option>
                    <option value="AP">FULL BOARD (AP)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-espresso mb-1">
                    Nightly Rate (NPR)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={nightlyRate}
                    onChange={(e) => setNightlyRate(e.target.value)}
                    className="w-full text-xs rounded-lg border border-sandstone bg-ivory/50 px-3 py-2 text-espresso focus:outline-none focus:border-[#6B2837]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-espresso mb-1">
                    Advance Deposit (NPR)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    className="w-full text-xs rounded-lg border border-sandstone bg-ivory/50 px-3 py-2 text-espresso focus:outline-none focus:border-[#6B2837]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-espresso mb-1">
                  Special Requests
                </label>
                <textarea
                  rows={2}
                  placeholder="Late arrival, airport transfer, dietary notes..."
                  value={specialRequests}
                  onChange={(e) => setSpecialRequests(e.target.value)}
                  className="w-full text-xs rounded-lg border border-sandstone bg-ivory/50 px-3 py-2 text-espresso focus:outline-none focus:border-[#6B2837]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-sandstone">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-3.5 py-2 text-xs font-medium text-warmgray hover:text-espresso cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 text-xs font-bold rounded-lg bg-[#6B2837] hover:bg-[#541E2A] text-[#FFFCF7] cursor-pointer"
                >
                  {actionLoading ? "Creating..." : "Confirm Reservation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Check In Now Modal for Confirmed Reservation */}
      {checkInReservation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-espresso/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-md border border-sandstone bg-porcelain p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-sandstone pb-3">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-[#6B2837]" />
                <h3 className="text-sm font-bold text-espresso">
                  Check In {checkInReservation.reservationNumber}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCheckInReservation(null)}
                className="text-warmgray hover:text-espresso cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmCheckIn} className="space-y-3">
              <div className="rounded-lg bg-ivory p-3 border border-sandstone/70 text-xs space-y-1">
                <div className="font-bold text-espresso">{checkInReservation.guestName}</div>
                <div className="text-warmgray">
                  {checkInReservation.roomType?.name} • {checkInReservation.nights} Night(s) •{" "}
                  {formatNPR(checkInReservation.nightlyRate)}/night
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-espresso mb-1">
                  Assign Vacant Clean Room *
                </label>
                <select
                  required
                  value={selectedCheckInRoomId}
                  onChange={(e) => setSelectedCheckInRoomId(e.target.value)}
                  className="w-full text-xs rounded-lg border border-sandstone bg-ivory/50 px-3 py-2 text-espresso focus:outline-none focus:border-[#6B2837]"
                >
                  <option value="">-- Select Vacant Clean Room --</option>
                  {vacantCleanRoomsForCheckIn.map((rm) => (
                    <option key={rm.id} value={rm.id}>
                      Room {rm.roomNumber} ({rm.roomType?.name || "Room"})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-espresso mb-1">ID Type</label>
                  <select
                    value={checkInIdType}
                    onChange={(e) => setCheckInIdType(e.target.value)}
                    className="w-full text-xs rounded-lg border border-sandstone bg-ivory/50 px-3 py-2 text-espresso focus:outline-none focus:border-[#6B2837]"
                  >
                    <option value="PASSPORT">PASSPORT</option>
                    <option value="CITIZENSHIP">CITIZENSHIP</option>
                    <option value="DRIVING_LICENSE">DRIVING_LICENSE</option>
                    <option value="NATIONAL_ID">NATIONAL_ID</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-espresso mb-1">
                    ID Number
                  </label>
                  <input
                    type="text"
                    placeholder="Passport / ID #"
                    value={checkInIdNumber}
                    onChange={(e) => setCheckInIdNumber(e.target.value)}
                    className="w-full text-xs rounded-lg border border-sandstone bg-ivory/50 px-3 py-2 text-espresso focus:outline-none focus:border-[#6B2837]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-espresso mb-1">
                  Advance Paid at Check-In (NPR)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={checkInPaidAmount}
                  onChange={(e) => setCheckInPaidAmount(e.target.value)}
                  className="w-full text-xs rounded-lg border border-sandstone bg-ivory/50 px-3 py-2 text-espresso focus:outline-none focus:border-[#6B2837]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-sandstone">
                <button
                  type="button"
                  onClick={() => setCheckInReservation(null)}
                  className="px-3.5 py-1.5 text-xs font-medium text-warmgray hover:text-espresso cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !selectedCheckInRoomId}
                  className="px-4 py-1.5 text-xs font-bold rounded-lg bg-[#6B2837] hover:bg-[#541E2A] text-[#FFFCF7] disabled:opacity-50 cursor-pointer"
                >
                  {actionLoading ? "Checking In..." : "Confirm Check-In"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
