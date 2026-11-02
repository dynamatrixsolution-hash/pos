"use client";

import { Notify } from "@/lib/notify";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { formatNPR, parseMoney, subMoney } from "@/lib/currency";
import {
  KeyRound,
  ArrowLeftRight,
  CalendarPlus,
  LogOut,
  RefreshCw,
  BedDouble,
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

interface Stay {
  id: string;
  stayNumber: string;
  guestName: string;
  guestPhone?: string | null;
  guestEmail?: string | null;
  guestIdType?: string | null;
  guestIdNumber?: string | null;
  roomId: string;
  checkInTime: string;
  expectedCheckOut: string;
  actualCheckOut?: string | null;
  status: "ACTIVE" | "EXTENDED" | "TRANSFERRED" | "CHECKED_OUT";
  ratePerNight: number | string;
  totalCharges: number | string;
  paidAmount: number | string;
  notes?: string | null;
  room?: Room;
}

export default function HotelStaysPage() {
  const [statusFilter, setStatusFilter] = useState<"IN_HOUSE" | "ALL" | "CHECKED_OUT">("IN_HOUSE");
  const [stays, setStays] = useState<Stay[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Transfer Room Modal
  const [transferStay, setTransferStay] = useState<Stay | null>(null);
  const [targetRoomId, setTargetRoomId] = useState("");
  const [transferReason, setTransferReason] = useState("Guest room preference / upgrade");

  // Extend Stay Modal
  const [extendModalStay, setExtendModalStay] = useState<Stay | null>(null);
  const [newExpectedCheckOut, setNewExpectedCheckOut] = useState("");
  const [additionalPaidAmount, setAdditionalPaidAmount] = useState("0");
  const [extendNotes, setExtendNotes] = useState("");

  // Check-Out Modal
  const [checkOutModalStay, setCheckOutModalStay] = useState<Stay | null>(null);
  const [settleAmount, setSettleAmount] = useState("0");
  const [enforceSettlement, setEnforceSettlement] = useState(true);
  const [checkOutNotes, setCheckOutNotes] = useState("");

  const loadStays = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const [staysRes, roomsRes] = await Promise.all([
        fetch("/api/v1/hotel/stays"),
        fetch("/api/v1/hotel/rooms"),
      ]);

      if (roomsRes.ok) {
        const rmData = await roomsRes.json();
        setRooms(rmData.rooms || []);
      }

      if (!staysRes.ok) {
        const err = await staysRes.json().catch(() => ({}));
        throw new Error(err.error || "Failed to load stays");
      }

      const data = await staysRes.json();
      setStays(data.stays || []);
    } catch (err: any) { Notify.failure(err.message || "Error loading stays"); } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStays();
  }, [loadStays]);

  const filteredStays = stays.filter((s) => {
    if (statusFilter === "IN_HOUSE") {
      return s.status === "ACTIVE" || s.status === "EXTENDED" || s.status === "TRANSFERRED";
    }
    if (statusFilter === "CHECKED_OUT") {
      return s.status === "CHECKED_OUT";
    }
    return true;
  });

  const vacantCleanRooms = rooms.filter((r) => r.status === "VACANT_CLEAN");

  const openTransferModal = (stay: Stay) => {
    setTransferStay(stay);
    const candidate = vacantCleanRooms.find((r) => r.id !== stay.roomId);
    setTargetRoomId(candidate?.id || "");
    setTransferReason("Guest room preference / upgrade");
  };

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferStay || !targetRoomId) return;
    try {
      setActionLoading(true);
      const res = await fetch(`/api/v1/hotel/stays/${transferStay.id}/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetRoomId,
          reason: transferReason || "Guest room transfer",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to transfer room");

      setTransferStay(null);
      await loadStays();
    } catch (err: any) {
      Notify.failure(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const openExtendModal = (stay: Stay) => {
    setExtendModalStay(stay);
    const curEnd = new Date(stay.expectedCheckOut);
    curEnd.setUTCDate(curEnd.getUTCDate() + 1);
    setNewExpectedCheckOut(curEnd.toISOString().slice(0, 10));
    setAdditionalPaidAmount("0");
    setExtendNotes("");
  };

  const handleExtendSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!extendModalStay || !newExpectedCheckOut) return;
    try {
      setActionLoading(true);
      const res = await fetch(`/api/v1/hotel/stays/${extendModalStay.id}/extend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newExpectedCheckOut: new Date(`${newExpectedCheckOut}T12:00:00.000Z`).toISOString(),
          additionalPaidAmount: Number(additionalPaidAmount) || 0,
          notes: extendNotes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to extend stay");

      setExtendModalStay(null);
      await loadStays();
    } catch (err: any) {
      Notify.failure(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const openCheckOutModal = (stay: Stay) => {
    setCheckOutModalStay(stay);
    const balanceDue = Math.max(
      0,
      parseMoney(subMoney(stay.totalCharges, stay.paidAmount))
    );
    setSettleAmount(String(balanceDue));
    setEnforceSettlement(true);
    setCheckOutNotes("");
  };

  const handleCheckOutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkOutModalStay) return;
    try {
      setActionLoading(true);
      const res = await fetch(`/api/v1/hotel/stays/${checkOutModalStay.id}/check-out`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settleAmount: Number(settleAmount) || 0,
          enforceSettlement,
          notes: checkOutNotes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Check-out failed");

      setCheckOutModalStay(null);
      await loadStays();
    } catch (err: any) {
      Notify.failure(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-sandstone pb-4">
        <div>
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-[#6B2837]" />
            <h1 className="text-xl font-bold text-espresso tracking-tight">In-House Stays</h1>
          </div>
          <p className="text-xs text-warmgray mt-0.5">
            Active guest stays, room transfers, stay extensions, and folio check-out settlement
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadStays}
            className="p-2 rounded-lg border border-sandstone bg-porcelain hover:bg-stone text-espresso cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
          <Link
            href="/dashboard/hotel/rooms"
            className="px-4 py-2 text-xs font-bold rounded-lg bg-[#6B2837] hover:bg-[#541E2A] text-[#FFFCF7] shadow-xs flex items-center gap-1.5"
          >
            <BedDouble className="h-3.5 w-3.5" />
            <span>Open Room Rack</span>
          </Link>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-2">
        {(
          [
            { id: "IN_HOUSE", label: "Active In-House" },
            { id: "CHECKED_OUT", label: "Checked Out" },
            { id: "ALL", label: "All Stays" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setStatusFilter(tab.id)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
              statusFilter === tab.id
                ? "bg-[#6B2837] text-[#FFFCF7] border-[#6B2837] shadow-xs"
                : "bg-porcelain text-espresso border-sandstone hover:bg-stone"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-md border border-[#E9B6B7] bg-[#FCEEEE] p-3 text-xs font-medium text-[#B33432]">
          {error}
        </div>
      )}

      {/* Stays Cards / Table */}
      {loading ? (
        <div className="rounded-md border border-sandstone bg-porcelain p-12 text-center text-xs text-warmgray">
          Loading guest stays...
        </div>
      ) : filteredStays.length === 0 ? (
        <div className="rounded-md border border-sandstone bg-porcelain p-12 text-center space-y-2">
          <div className="text-sm font-bold text-espresso">No Matching Stays</div>
          <p className="text-xs text-warmgray">
            Check in a walk-in guest from the Room Rack or check in a confirmed reservation.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredStays.map((stay) => {
            const isActive = stay.status !== "CHECKED_OUT";
            const balanceDue = parseMoney(subMoney(stay.totalCharges, stay.paidAmount));

            return (
              <div
                key={stay.id}
                className="rounded-md border border-sandstone bg-porcelain p-4 shadow-xs flex flex-col justify-between space-y-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-black text-espresso">
                        Room {stay.room?.roomNumber || "N/A"}
                      </span>
                      <span className="text-xs font-bold text-[#6B2837] bg-[#F9EFF1] border border-[#E3C6CC] px-2 py-0.5 rounded-full">
                        {stay.stayNumber}
                      </span>
                    </div>
                    <div className="text-sm font-bold text-espresso mt-1">{stay.guestName}</div>
                    <div className="text-xs text-warmgray">
                      {stay.guestPhone || "No phone"} •{" "}
                      {stay.guestIdType ? `${stay.guestIdType}: ${stay.guestIdNumber || ""}` : "ID on file"}
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                      isActive
                        ? "bg-[#F9EFF1] text-[#6B2837] border-[#E3C6CC]"
                        : "bg-[#EBF4F0] text-[#28634B] border-[#C3DED0]"
                    }`}
                  >
                    {stay.status}
                  </span>
                </div>

                {/* Dates & Folio Summary */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 rounded-lg bg-ivory/70 border border-sandstone/70 p-3 text-xs">
                  <div>
                    <span className="text-[10px] text-warmgray block uppercase font-semibold">
                      Check-In
                    </span>
                    <span className="font-bold text-espresso">
                      {new Date(stay.checkInTime).toLocaleDateString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-warmgray block uppercase font-semibold">
                      Expected Out
                    </span>
                    <span className="font-bold text-espresso">
                      {new Date(stay.expectedCheckOut).toLocaleDateString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-warmgray block uppercase font-semibold">
                      Total Charges
                    </span>
                    <span className="font-bold text-espresso">{formatNPR(stay.totalCharges)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-warmgray block uppercase font-semibold">
                      Balance Due
                    </span>
                    <span
                      className={`font-black ${
                        balanceDue > 0 ? "text-[#B33432]" : "text-[#28634B]"
                      }`}
                    >
                      {formatNPR(Math.max(0, balanceDue))}
                    </span>
                  </div>
                </div>

                {/* Action Bar */}
                {isActive && (
                  <div className="pt-2 border-t border-sandstone flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openTransferModal(stay)}
                      className="flex-1 py-1.5 px-3 rounded-lg border border-sandstone bg-ivory hover:bg-stone text-espresso text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <ArrowLeftRight className="h-3.5 w-3.5 text-[#6B2837]" />
                      <span>Transfer Room</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => openExtendModal(stay)}
                      className="flex-1 py-1.5 px-3 rounded-lg border border-[#EDD7AD] bg-[#FDF6E9] hover:opacity-90 text-[#946000] text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <CalendarPlus className="h-3.5 w-3.5" />
                      <span>Extend Stay</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => openCheckOutModal(stay)}
                      className="flex-1 py-1.5 px-3 rounded-lg bg-[#6B2837] hover:bg-[#541E2A] text-[#FFFCF7] text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      <span>Check Out</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Transfer Room Modal */}
      {transferStay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-espresso/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-md border border-sandstone bg-porcelain p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-sandstone pb-3">
              <h3 className="text-sm font-bold text-espresso">
                Transfer Room — {transferStay.guestName} (Rm {transferStay.room?.roomNumber})
              </h3>
              <button
                type="button"
                onClick={() => setTransferStay(null)}
                className="text-warmgray hover:text-espresso cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleTransferSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-espresso mb-1">
                  Target Vacant Clean Room *
                </label>
                <select
                  required
                  value={targetRoomId}
                  onChange={(e) => setTargetRoomId(e.target.value)}
                  className="w-full text-xs rounded-lg border border-sandstone bg-ivory/50 px-3 py-2 text-espresso focus:outline-none focus:border-[#6B2837]"
                >
                  <option value="">-- Choose Destination Room --</option>
                  {vacantCleanRooms
                    .filter((r) => r.id !== transferStay.roomId)
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        Room {r.roomNumber} — {r.roomType?.name || "Standard"} (
                        {formatNPR(r.roomType?.baseRate ?? 0)})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-espresso mb-1">
                  Transfer Reason *
                </label>
                <input
                  type="text"
                  required
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  className="w-full text-xs rounded-lg border border-sandstone bg-ivory/50 px-3 py-2 text-espresso focus:outline-none focus:border-[#6B2837]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-sandstone">
                <button
                  type="button"
                  onClick={() => setTransferStay(null)}
                  className="px-3.5 py-1.5 text-xs font-medium text-warmgray hover:text-espresso cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !targetRoomId}
                  className="px-4 py-1.5 text-xs font-bold rounded-lg bg-[#6B2837] hover:bg-[#541E2A] text-[#FFFCF7] disabled:opacity-50 cursor-pointer"
                >
                  {actionLoading ? "Transferring..." : "Confirm Room Transfer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Extend Stay Modal */}
      {extendModalStay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-espresso/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-md border border-sandstone bg-porcelain p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-sandstone pb-3">
              <h3 className="text-sm font-bold text-espresso">
                Extend Stay — {extendModalStay.guestName}
              </h3>
              <button
                type="button"
                onClick={() => setExtendModalStay(null)}
                className="text-warmgray hover:text-espresso cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleExtendSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-espresso mb-1">
                  New Expected Check-Out Date *
                </label>
                <input
                  type="date"
                  required
                  value={newExpectedCheckOut}
                  onChange={(e) => setNewExpectedCheckOut(e.target.value)}
                  className="w-full text-xs rounded-lg border border-sandstone bg-ivory/50 px-3 py-2 text-espresso focus:outline-none focus:border-[#6B2837]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-espresso mb-1">
                  Additional Advance Payment (NPR)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={additionalPaidAmount}
                  onChange={(e) => setAdditionalPaidAmount(e.target.value)}
                  className="w-full text-xs rounded-lg border border-sandstone bg-ivory/50 px-3 py-2 text-espresso focus:outline-none focus:border-[#6B2837]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-espresso mb-1">Notes</label>
                <input
                  type="text"
                  placeholder="Extended by guest request..."
                  value={extendNotes}
                  onChange={(e) => setExtendNotes(e.target.value)}
                  className="w-full text-xs rounded-lg border border-sandstone bg-ivory/50 px-3 py-2 text-espresso focus:outline-none focus:border-[#6B2837]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-sandstone">
                <button
                  type="button"
                  onClick={() => setExtendModalStay(null)}
                  className="px-3.5 py-1.5 text-xs font-medium text-warmgray hover:text-espresso cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-1.5 text-xs font-bold rounded-lg bg-[#6B2837] hover:bg-[#541E2A] text-[#FFFCF7] cursor-pointer"
                >
                  {actionLoading ? "Extending..." : "Confirm Extension"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Check-Out Modal */}
      {checkOutModalStay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-espresso/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-md border border-sandstone bg-porcelain p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-sandstone pb-3">
              <h3 className="text-sm font-bold text-espresso">
                Check Out Room {checkOutModalStay.room?.roomNumber} — {checkOutModalStay.guestName}
              </h3>
              <button
                type="button"
                onClick={() => setCheckOutModalStay(null)}
                className="text-warmgray hover:text-espresso cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCheckOutSubmit} className="space-y-3">
              <div className="rounded-lg bg-ivory p-3 border border-sandstone/70 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-warmgray">Total Stay Charges:</span>
                  <span className="font-bold text-espresso">
                    {formatNPR(checkOutModalStay.totalCharges)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-warmgray">Previously Paid:</span>
                  <span className="font-bold text-[#28634B]">
                    {formatNPR(checkOutModalStay.paidAmount)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-sandstone pt-1.5">
                  <span className="font-semibold text-espresso">Remaining Balance:</span>
                  <span className="font-black text-[#6B2837]">
                    {formatNPR(
                      subMoney(checkOutModalStay.totalCharges, checkOutModalStay.paidAmount)
                    )}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-espresso mb-1">
                  Final Settlement Payment Collected Now (NPR)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={settleAmount}
                  onChange={(e) => setSettleAmount(e.target.value)}
                  className="w-full text-xs rounded-lg border border-sandstone bg-ivory/50 px-3 py-2 text-espresso font-bold focus:outline-none focus:border-[#6B2837]"
                />
              </div>

              <label className="flex items-center gap-2 text-xs text-espresso cursor-pointer">
                <input
                  type="checkbox"
                  checked={enforceSettlement}
                  onChange={(e) => setEnforceSettlement(e.target.checked)}
                  className="rounded border-sandstone"
                />
                <span>Enforce zero unpaid balance before completing check-out</span>
              </label>

              <div>
                <label className="block text-xs font-semibold text-espresso mb-1">
                  Check-Out Notes
                </label>
                <input
                  type="text"
                  placeholder="Minibar checked, keys returned..."
                  value={checkOutNotes}
                  onChange={(e) => setCheckOutNotes(e.target.value)}
                  className="w-full text-xs rounded-lg border border-sandstone bg-ivory/50 px-3 py-2 text-espresso focus:outline-none focus:border-[#6B2837]"
                />
              </div>

              <div className="rounded-lg bg-[#FDF6E9] border border-[#EDD7AD] p-2.5 text-[11px] text-[#946000]">
                Checking out automatically transitions Room{" "}
                <strong>{checkOutModalStay.room?.roomNumber}</strong> to{" "}
                <strong>VACANT_DIRTY</strong> and dispatches a housekeeping turnover task.
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-sandstone">
                <button
                  type="button"
                  onClick={() => setCheckOutModalStay(null)}
                  className="px-3.5 py-1.5 text-xs font-medium text-warmgray hover:text-espresso cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-1.5 text-xs font-bold rounded-lg bg-[#6B2837] hover:bg-[#541E2A] text-[#FFFCF7] cursor-pointer"
                >
                  {actionLoading ? "Processing..." : "Complete Check-Out"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
