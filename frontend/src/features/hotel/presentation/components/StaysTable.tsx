"use client";

import React, { useMemo } from "react";
import {
  BedDouble,
  User,
  Phone,
  ArrowRightLeft,
  CalendarPlus,
  LogOut,
  Calendar,
  AlertCircle,
} from "lucide-react";
import { useHotelStaysStore } from "../../state/hotel-stays.store";
import { HotelStay } from "../../models/hotel.types";

function formatNPR(amount: number | string | undefined): string {
  const val = Number(amount) || 0;
  return `Rs. ${val.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export const StaysTable: React.FC = () => {
  const stays = useHotelStaysStore((s) => s.stays);
  const isLoading = useHotelStaysStore((s) => s.isLoading);
  const statusFilter = useHotelStaysStore((s) => s.statusFilter);
  const search = useHotelStaysStore((s) => s.search);

  const openTransferModal = useHotelStaysStore((s) => s.openTransferModal);
  const openExtendModal = useHotelStaysStore((s) => s.openExtendModal);
  const openCheckOutModal = useHotelStaysStore((s) => s.openCheckOutModal);

  const filteredStays = useMemo(() => {
    return stays.filter((stay) => {
      // 1. Status Filter
      if (statusFilter === "IN_HOUSE") {
        if (stay.status === "CHECKED_OUT") return false;
      } else if (statusFilter === "CHECKED_OUT") {
        if (stay.status !== "CHECKED_OUT") return false;
      }

      // 2. Search
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const guest = (stay.guestName || "").toLowerCase();
        const stayNum = (stay.stayNumber || "").toLowerCase();
        const roomNum = (stay.room?.roomNumber || "").toLowerCase();
        const phone = (stay.guestPhone || "").toLowerCase();
        if (!guest.includes(q) && !stayNum.includes(q) && !roomNum.includes(q) && !phone.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [stays, statusFilter, search]);

  if (isLoading && stays.length === 0) {
    return (
      <div className="rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] p-8 space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-12 rounded-lg bg-[#EEE7DD]/60 animate-pulse" />
        ))}
      </div>
    );
  }

  if (filteredStays.length === 0) {
    return (
      <div className="py-16 text-center rounded-xl border border-dashed border-[#D8CEC1] bg-[#FFFCF7] space-y-3">
        <BedDouble className="h-10 w-10 text-[#71675E]/40 mx-auto" />
        <h3 className="font-bold text-sm text-[#292320]">No guest stays found</h3>
        <p className="text-xs text-[#71675E] max-w-sm mx-auto">
          No stays match your search or selected filter. You can register a new check-in above.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] shadow-2xs overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-[#D8CEC1] bg-[#F7F3EC]/80 text-[#71675E] font-bold uppercase tracking-wider text-[11px]">
              <th className="py-3 px-4">Room &amp; Stay #</th>
              <th className="py-3 px-3">Guest Information</th>
              <th className="py-3 px-3">Check-In / Out</th>
              <th className="py-3 px-3 text-right">Nightly Rate</th>
              <th className="py-3 px-3 text-right">Total Charges</th>
              <th className="py-3 px-3 text-right">Paid</th>
              <th className="py-3 px-3 text-right">Balance Due</th>
              <th className="py-3 px-4 text-right">Front Desk Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#D8CEC1]/60">
            {filteredStays.map((stay) => {
              const total = Number(stay.totalCharges) || 0;
              const paid = Number(stay.paidAmount) || 0;
              const balance = Math.max(0, total - paid);
              const isActive = stay.status === "ACTIVE" || stay.status === "EXTENDED";

              return (
                <tr
                  key={stay.id}
                  className="hover:bg-[#F7F3EC]/50 transition-colors group text-[#292320]"
                >
                  {/* Room & Stay Number */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2.5">
                      <div className="h-9 w-9 rounded-lg bg-[#6B2837] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                        {stay.room?.roomNumber || "RM"}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-xs text-[#292320]">
                          Room {stay.room?.roomNumber || "Unassigned"}
                        </div>
                        <div className="text-[10px] text-[#71675E] font-mono">
                          #{stay.stayNumber}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Guest Information */}
                  <td className="py-3 px-3">
                    <div className="space-y-0.5">
                      <div className="font-bold text-xs text-[#292320] flex items-center gap-1.5">
                        <User className="h-3 w-3 text-[#71675E]" />
                        <span>{stay.guestName}</span>
                      </div>
                      {stay.guestPhone && (
                        <div className="text-[11px] text-[#71675E] flex items-center gap-1">
                          <Phone className="h-2.5 w-2.5 text-[#71675E]" />
                          <span>{stay.guestPhone}</span>
                        </div>
                      )}
                      {stay.guestIdNumber && (
                        <div className="text-[10px] text-[#71675E] font-mono">
                          {stay.guestIdType || "ID"}: {stay.guestIdNumber}
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Check-In / Expected Out */}
                  <td className="py-3 px-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-[11px] text-[#2D6A4F] font-semibold">
                        <span>In:</span>
                        <span>{formatDate(stay.checkInTime)}</span>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-[#B45309] font-semibold">
                        <span>Out:</span>
                        <span>{formatDate(stay.expectedCheckOut)}</span>
                      </div>
                    </div>
                  </td>

                  {/* Rate Per Night */}
                  <td className="py-3 px-3 text-right font-mono text-xs tabular-nums text-[#71675E]">
                    {formatNPR(stay.ratePerNight)}
                  </td>

                  {/* Total Charges */}
                  <td className="py-3 px-3 text-right font-mono text-xs tabular-nums text-[#292320] font-semibold">
                    {formatNPR(stay.totalCharges)}
                  </td>

                  {/* Paid Amount */}
                  <td className="py-3 px-3 text-right font-mono text-xs tabular-nums text-[#16A34A] font-semibold">
                    {formatNPR(stay.paidAmount)}
                  </td>

                  {/* Balance Due */}
                  <td className="py-3 px-3 text-right font-mono text-xs font-bold tabular-nums">
                    <span className={balance > 0 ? "text-[#DC2626]" : "text-[#71675E]"}>
                      {formatNPR(balance)}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="py-3 px-4 text-right">
                    {isActive ? (
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => openTransferModal(stay)}
                          className="h-7 px-2 rounded-md border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-xs font-semibold text-[#B45309] flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                          title="Transfer guest to another room"
                        >
                          <ArrowRightLeft className="h-3 w-3" />
                          <span className="hidden sm:inline">Transfer</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => openExtendModal(stay)}
                          className="h-7 px-2 rounded-md border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-xs font-semibold text-[#6B2837] flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                          title="Extend guest stay nights"
                        >
                          <CalendarPlus className="h-3 w-3" />
                          <span className="hidden sm:inline">Extend</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => openCheckOutModal(stay)}
                          className="h-7 px-2.5 rounded-md bg-[#16A34A] hover:bg-[#15803D] text-xs font-bold text-white flex items-center gap-1 transition-colors cursor-pointer shadow-xs"
                          title="Settle folio & complete checkout"
                        >
                          <LogOut className="h-3 w-3" />
                          <span>Check Out</span>
                        </button>
                      </div>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#F7F3EC] text-[#71675E] border border-[#D8CEC1]">
                        Completed
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

