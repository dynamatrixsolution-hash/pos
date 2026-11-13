"use client";

import React from "react";
import { BedDouble, Plus, Edit3, Trash2 } from "lucide-react";
import { useHotelRoomsStore } from "../../state/hotel-rooms.store";
import { useHotelUiStore } from "../../state/hotel-ui.store";
import { formatNPR } from "@/lib/currency";

export const RoomTypesManager: React.FC = () => {
  const roomTypes = useHotelRoomsStore((s) => s.roomTypes);
  const rooms = useHotelRoomsStore((s) => s.rooms);
  const deleteRoomType = useHotelRoomsStore((s) => s.deleteRoomType);

  const setShowRoomTypeModal = useHotelUiStore((s) => s.setShowRoomTypeModal);
  const setEditingRoomType = useHotelUiStore((s) => s.setEditingRoomType);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {/* Banner */}
      <div className="p-4 rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
        <div>
          <h2 className="text-base font-bold text-[#292320]">Room Types &amp; Categories</h2>
          <p className="text-xs text-[#71675E] mt-0.5">
            Configure room types, default nightly rates, codes, and maximum guest capacities.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditingRoomType(null);
            setShowRoomTypeModal(true);
          }}
          className="px-3.5 py-2 text-xs font-bold rounded-lg bg-[#6B2837] hover:bg-[#59222e] text-white flex items-center gap-1.5 cursor-pointer shadow-xs self-start sm:self-auto transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>Add Room Type</span>
        </button>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {roomTypes.map((rt) => {
          const assignedCount = rooms.filter((r) => r.roomTypeId === rt.id).length;
          return (
            <div
              key={rt.id}
              className="rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] p-4 space-y-3 shadow-2xs hover:border-[#6B2837] transition-all flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BedDouble className="h-4 w-4 text-[#6B2837]" />
                    <h3 className="text-base font-extrabold text-[#292320]">{rt.name}</h3>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#F7F3EC] text-[#6B2837] border border-[#D8CEC1]">
                    {rt.code}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs text-[#71675E]">
                  <span>Base Nightly Rate:</span>
                  <span className="font-mono tabular-nums font-bold text-base text-[#6B2837]">
                    {formatNPR(rt.baseRate)}
                  </span>
                </div>

                <div className="text-xs text-[#71675E]">
                  Max Occupancy: <span className="font-bold text-[#292320]">{rt.maxOccupancy} Guests</span>
                </div>

                {rt.description && (
                  <p className="text-[11px] text-[#71675E] line-clamp-2">{rt.description}</p>
                )}
              </div>

              <div className="pt-2 border-t border-[#D8CEC1]/60 flex items-center justify-between text-xs">
                <span className="text-[#71675E]">
                  Assigned to <strong className="text-[#292320]">{assignedCount}</strong> rooms
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingRoomType(rt);
                      setShowRoomTypeModal(true);
                    }}
                    className="px-2.5 py-1 rounded-md border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-[#292320] text-xs font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Edit3 className="h-3 w-3" />
                    <span>Edit</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => deleteRoomType(rt)}
                    className="px-2.5 py-1 rounded-md border border-red-200 bg-red-50 hover:bg-red-100 text-[#DC2626] text-xs font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="h-3 w-3" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

