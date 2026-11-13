"use client";

import React from "react";
import { BedDouble, UserCheck, Wrench } from "lucide-react";
import { useHotelRoomsStore } from "../../state/hotel-rooms.store";
import { useHotelUiStore } from "../../state/hotel-ui.store";
import { HotelRoom } from "../../models/hotel.types";

export const RoomRackView: React.FC = () => {
  const rooms = useHotelRoomsStore((s) => s.rooms);
  const loading = useHotelRoomsStore((s) => s.loading);
  const setShowFastCheckInModal = useHotelUiStore((s) => s.setShowFastCheckInModal);
  const setShowHousekeepingModal = useHotelUiStore((s) => s.setShowHousekeepingModal);
  const searchQuery = useHotelUiStore((s) => s.searchQuery);
  const selectedRoomTypeFilter = useHotelUiStore((s) => s.selectedRoomTypeFilter);
  const selectedFloorFilter = useHotelUiStore((s) => s.selectedFloorFilter);

  const filtered = rooms.filter((r) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      if (!r.roomNumber.toLowerCase().includes(q) && !r.roomType.name.toLowerCase().includes(q)) {
        return false;
      }
    }
    if (selectedRoomTypeFilter !== "ALL" && r.roomTypeId !== selectedRoomTypeFilter) return false;
    if (selectedFloorFilter !== "ALL" && r.floorId !== selectedFloorFilter) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-12">
        <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-[#6B2837] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2.5">
        {filtered.map((room) => {
          const isClean = room.status === "VACANT_CLEAN";
          const isOccupied = room.status.startsWith("OCCUPIED");
          const isDirty = room.status === "VACANT_DIRTY";

          let colorClass = "border-[#D8CEC1] bg-[#FFFCF7] text-[#292320]";
          if (isClean) colorClass = "border-[#C8DFCD] bg-[#EDF5ED] text-[#2D6A4F]";
          else if (isDirty) colorClass = "border-[#FDE68A] bg-[#FFFBEB] text-[#B45309]";
          else if (isOccupied) colorClass = "border-[#E9CDD3] bg-[#F8EEF0] text-[#6B2837]";

          return (
            <button
              key={room.id}
              type="button"
              onClick={() => {
                if (isClean) setShowFastCheckInModal(true, room);
                else setShowHousekeepingModal(true, room);
              }}
              className={`p-3 rounded-lg border text-left flex flex-col justify-between gap-2 shadow-2xs hover:shadow-xs transition-all cursor-pointer ${colorClass}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-black tracking-tight">{room.roomNumber}</span>
                <span className="text-[10px] font-bold uppercase">{room.roomType.code}</span>
              </div>

              <div className="text-[11px] truncate font-medium">
                {isOccupied && room.activeStay
                  ? room.activeStay.guestName
                  : room.status.replace("_", " ")}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

