"use client";

import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useHotelRoomsStore } from "../../state/hotel-rooms.store";
import { useHotelUiStore } from "../../state/hotel-ui.store";
import { HotelRoom, Allocation } from "../../models/hotel.types";

function getAllocationForCell(room: HotelRoom, dateStr: string): Allocation | null {
  if (!room.allocations || room.allocations.length === 0) return null;
  const current = new Date(`${dateStr}T12:00:00.000Z`).getTime();
  return (
    room.allocations.find((a) => {
      const s = new Date(a.startDate).getTime();
      const e = new Date(a.endDate).getTime();
      return current >= s && current < e;
    }) || null
  );
}

export const TapeChartTimeline: React.FC = () => {
  const rooms = useHotelRoomsStore((s) => s.rooms);
  const dates = useHotelRoomsStore((s) => s.dates);
  const loading = useHotelRoomsStore((s) => s.loading);
  const loadInitialData = useHotelRoomsStore((s) => s.loadInitialData);

  const horizonDays = useHotelUiStore((s) => s.horizonDays);
  const setHorizonDays = useHotelUiStore((s) => s.setHorizonDays);
  const startDate = useHotelUiStore((s) => s.startDate);
  const setStartDate = useHotelUiStore((s) => s.setStartDate);

  const handlePrevHorizon = () => {
    const cur = new Date(`${startDate}T00:00:00.000Z`);
    const prev = new Date(cur.getTime() - horizonDays * 24 * 60 * 60 * 1000);
    setStartDate(prev.toISOString().slice(0, 10));
    loadInitialData();
  };

  const handleNextHorizon = () => {
    const cur = new Date(`${startDate}T00:00:00.000Z`);
    const next = new Date(cur.getTime() + horizonDays * 24 * 60 * 60 * 1000);
    setStartDate(next.toISOString().slice(0, 10));
    loadInitialData();
  };

  const handleToday = () => {
    setStartDate(new Date().toISOString().slice(0, 10));
    loadInitialData();
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-12">
        <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-[#6B2837] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3">
      {/* Date Navigation Strip */}
      <div className="flex items-center justify-between gap-3 p-3 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7]">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrevHorizon}
            className="p-1.5 rounded-md border border-[#D8CEC1] hover:bg-[#EEE7DD] text-[#71675E] cursor-pointer"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleToday}
            className="px-2.5 py-1 text-xs font-bold rounded-md border border-[#D8CEC1] hover:bg-[#EEE7DD] text-[#292320] cursor-pointer"
          >
            Today
          </button>
          <button
            type="button"
            onClick={handleNextHorizon}
            className="p-1.5 rounded-md border border-[#D8CEC1] hover:bg-[#EEE7DD] text-[#71675E] cursor-pointer"
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          <span className="text-xs font-bold text-[#292320] ml-2">
            Timeline starting: {new Date(`${startDate}T00:00:00.000Z`).toLocaleDateString()}
          </span>
        </div>

        <div className="flex items-center gap-1 rounded-md border border-[#D8CEC1] bg-[#F7F3EC] p-0.5 text-xs">
          <button
            type="button"
            onClick={() => {
              setHorizonDays(7);
              loadInitialData();
            }}
            className={`px-2.5 py-1 rounded text-xs font-bold cursor-pointer ${
              horizonDays === 7 ? "bg-[#6B2837] text-white" : "text-[#71675E]"
            }`}
          >
            7 Days
          </button>
          <button
            type="button"
            onClick={() => {
              setHorizonDays(14);
              loadInitialData();
            }}
            className={`px-2.5 py-1 rounded text-xs font-bold cursor-pointer ${
              horizonDays === 14 ? "bg-[#6B2837] text-white" : "text-[#71675E]"
            }`}
          >
            14 Days
          </button>
        </div>
      </div>

      {/* Matrix Table */}
      <div className="rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] overflow-x-auto shadow-2xs">
        <table className="w-full text-left border-collapse min-w-[700px]">
          <thead>
            <tr className="bg-[#F7F3EC] border-b border-[#D8CEC1] text-[11px] font-bold uppercase tracking-wider text-[#71675E]">
              <th className="py-2.5 px-3 sticky left-0 bg-[#F7F3EC] z-10 w-44 border-r border-[#D8CEC1]">
                Room Details
              </th>
              {dates.map((d) => {
                const parsed = new Date(`${d}T00:00:00.000Z`);
                const isToday = d === new Date().toISOString().slice(0, 10);
                return (
                  <th
                    key={d}
                    className={`py-2 px-1 text-center border-r border-[#D8CEC1] last:border-r-0 min-w-[70px] ${
                      isToday ? "bg-[#6B2837]/10 text-[#6B2837]" : ""
                    }`}
                  >
                    <div>
                      {parsed.toLocaleDateString("en-US", {
                        weekday: "short",
                        timeZone: "UTC",
                      })}
                    </div>
                    <div className="text-xs font-black text-[#292320]">
                      {parsed.getUTCDate()}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#D8CEC1] text-xs">
            {rooms.map((room) => (
              <tr key={room.id} className="hover:bg-[#F7F3EC]/50">
                <td className="py-2 px-3 sticky left-0 bg-[#FFFCF7] z-10 border-r border-[#D8CEC1]">
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="font-bold text-[#292320]">Room {room.roomNumber}</span>
                    <span className="text-[10px] text-[#71675E] font-medium">
                      {room.roomType.code}
                    </span>
                  </div>
                </td>
                {dates.map((dateStr) => {
                  const alloc = getAllocationForCell(room, dateStr);
                  if (!alloc) {
                    return (
                      <td
                        key={dateStr}
                        className="py-1 px-1 border-r border-[#D8CEC1]/60 last:border-r-0 text-center"
                      >
                        <div className="h-7 rounded border border-dashed border-[#D8CEC1]/60 flex items-center justify-center">
                          <span className="text-[9px] text-[#D8CEC1]">·</span>
                        </div>
                      </td>
                    );
                  }

                  const isStay = alloc.allocationType === "STAY";
                  const isMaint = alloc.allocationType === "MAINTENANCE";
                  const bgClass = isStay
                    ? "bg-[#6B2837] text-white"
                    : isMaint
                    ? "bg-[#DC2626] text-white"
                    : "bg-[#2D6A4F] text-white";

                  const title = isStay
                    ? alloc.stay?.guestName || "Stay"
                    : isMaint
                    ? "Maintenance"
                    : alloc.reservation?.guestName || "Reserved";

                  return (
                    <td
                      key={dateStr}
                      className="py-1 px-1 border-r border-[#D8CEC1]/60 last:border-r-0 text-center"
                    >
                      <div
                        title={`${title} (${alloc.startDate.slice(0, 10)} to ${alloc.endDate.slice(0, 10)})`}
                        className={`h-7 px-1 rounded text-[10px] font-bold flex items-center justify-center truncate shadow-2xs ${bgClass}`}
                      >
                        <span className="truncate">{title}</span>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

