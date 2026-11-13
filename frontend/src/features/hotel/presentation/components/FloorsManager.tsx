"use client";

import React, { useState } from "react";
import { Layers, Plus, Edit3, Trash2, Copy, Check } from "lucide-react";
import { useHotelRoomsStore } from "../../state/hotel-rooms.store";
import { useHotelUiStore } from "../../state/hotel-ui.store";

export const FloorsManager: React.FC = () => {
  const floors = useHotelRoomsStore((s) => s.floors);
  const rooms = useHotelRoomsStore((s) => s.rooms);
  const deleteFloor = useHotelRoomsStore((s) => s.deleteFloor);

  const setShowAddFloorModal = useHotelUiStore((s) => s.setShowAddFloorModal);
  const setEditingFloor = useHotelUiStore((s) => s.setEditingFloor);

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {/* Banner */}
      <div className="p-4 rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
        <div>
          <h2 className="text-base font-bold text-[#292320]">Floors &amp; Building Levels</h2>
          <p className="text-xs text-[#71675E] mt-0.5">
            Manage hotel floors, sequence numbers, floor IDs, and room distribution.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditingFloor(null);
            setShowAddFloorModal(true);
          }}
          className="px-3.5 py-2 text-xs font-bold rounded-lg bg-[#6B2837] hover:bg-[#59222e] text-white flex items-center gap-1.5 cursor-pointer shadow-xs self-start sm:self-auto transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>Add Floor</span>
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {floors.map((floor) => {
          const floorRooms = rooms.filter((r) => r.floorId === floor.id);
          const cleanRooms = floorRooms.filter((r) => r.status === "VACANT_CLEAN").length;
          const isCopied = copiedId === floor.id;

          return (
            <div
              key={floor.id}
              className="rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] p-4 space-y-3 shadow-2xs hover:border-[#6B2837] transition-all flex flex-col justify-between"
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-[#6B2837]" />
                    <h3 className="text-base font-black text-[#292320]">{floor.name}</h3>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#F7F3EC] border border-[#D8CEC1] text-[#71675E]">
                    Order #{floor.displayOrder}
                  </span>
                </div>

                {/* Floor ID */}
                <div className="p-2 rounded-lg bg-[#F7F3EC] border border-[#D8CEC1] flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[9px] uppercase font-bold text-[#71675E]">Floor ID</div>
                    <div className="font-mono text-[11px] text-[#292320] truncate">{floor.id}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(floor.id)}
                    className="px-2 py-1 rounded border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-xs font-medium text-[#71675E] hover:text-[#292320] flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    {isCopied ? <Check className="h-3 w-3 text-[#16A34A]" /> : <Copy className="h-3 w-3" />}
                    <span>{isCopied ? "Copied" : "Copy"}</span>
                  </button>
                </div>

                {/* Counters */}
                <div className="grid grid-cols-2 gap-2 p-2 rounded-lg bg-[#F7F3EC]/50 border border-[#D8CEC1] text-center text-xs">
                  <div>
                    <div className="text-[10px] text-[#71675E] font-semibold">Total Rooms</div>
                    <div className="font-black text-sm text-[#292320] tabular-nums">{floorRooms.length}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[#2D6A4F] font-semibold">Vacant Clean</div>
                    <div className="font-black text-sm text-[#2D6A4F] tabular-nums">{cleanRooms}</div>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-[#D8CEC1]/60 flex items-center justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setEditingFloor(floor);
                    setShowAddFloorModal(true);
                  }}
                  className="px-2.5 py-1 rounded-md border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-[#292320] text-xs font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Edit3 className="h-3 w-3" />
                  <span>Edit</span>
                </button>

                <button
                  type="button"
                  onClick={() => deleteFloor(floor)}
                  className="px-2.5 py-1 rounded-md border border-red-200 bg-red-50 hover:bg-red-100 text-[#DC2626] text-xs font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="h-3 w-3" />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

