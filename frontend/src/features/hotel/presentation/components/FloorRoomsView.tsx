"use client";

import React, { useMemo } from "react";
import {
  BedDouble,
  UserCheck,
  QrCode,
  Edit3,
  Wrench,
  Trash2,
  Sparkles,
  Info,
  Layers,
} from "lucide-react";
import { useHotelUiStore } from "../../state/hotel-ui.store";
import { useHotelRoomsStore } from "../../state/hotel-rooms.store";
import { HotelRoom, RoomStatus, FloorRoomGroup } from "../../models/hotel.types";
import { formatNPR } from "@/lib/currency";

function getStatusBadge(status: RoomStatus) {
  switch (status) {
    case "VACANT_CLEAN":
      return {
        label: "Vacant Clean",
        bg: "bg-[#EDF5ED] border-[#C8DFCD] text-[#2D6A4F]",
        indicator: "bg-[#16A34A]",
      };
    case "VACANT_DIRTY":
      return {
        label: "Dirty (Needs Housekeeping)",
        bg: "bg-[#FFFBEB] border-[#FDE68A] text-[#B45309]",
        indicator: "bg-[#EAB308]",
      };
    case "OCCUPIED_CLEAN":
      return {
        label: "Occupied Clean",
        bg: "bg-[#F8EEF0] border-[#E9CDD3] text-[#6B2837]",
        indicator: "bg-[#DC2626]",
      };
    case "OCCUPIED_DIRTY":
      return {
        label: "Occupied Dirty",
        bg: "bg-[#F8EEF0] border-[#E9CDD3] text-[#6B2837]",
        indicator: "bg-[#DC2626]",
      };
    case "MAINTENANCE":
      return {
        label: "Maintenance",
        bg: "bg-[#F7F3EC] border-[#D8CEC1] text-[#71675E]",
        indicator: "bg-[#71675E]",
      };
    case "OUT_OF_SERVICE":
      return {
        label: "Out of Service",
        bg: "bg-[#F7F3EC] border-[#D8CEC1] text-[#71675E]",
        indicator: "bg-[#71675E]",
      };
    default:
      return {
        label: status,
        bg: "bg-[#F7F3EC] border-[#D8CEC1] text-[#71675E]",
        indicator: "bg-[#71675E]",
      };
  }
}

export const FloorRoomsView: React.FC = () => {
  const rooms = useHotelRoomsStore((s) => s.rooms);
  const floors = useHotelRoomsStore((s) => s.floors);
  const loading = useHotelRoomsStore((s) => s.loading);
  const deleteRoom = useHotelRoomsStore((s) => s.deleteRoom);

  const selectedFloorFilter = useHotelUiStore((s) => s.selectedFloorFilter);
  const selectedRoomTypeFilter = useHotelUiStore((s) => s.selectedRoomTypeFilter);
  const searchQuery = useHotelUiStore((s) => s.searchQuery);

  const setShowFastCheckInModal = useHotelUiStore((s) => s.setShowFastCheckInModal);
  const setShowHousekeepingModal = useHotelUiStore((s) => s.setShowHousekeepingModal);
  const setShowQrModal = useHotelUiStore((s) => s.setShowQrModal);
  const setEditingRoom = useHotelUiStore((s) => s.setEditingRoom);

  // Filter & Group rooms by floor
  const floorGroups = useMemo<FloorRoomGroup[]>(() => {
    let filtered = [...rooms];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        (r) =>
          r.roomNumber.toLowerCase().includes(q) ||
          r.roomType.name.toLowerCase().includes(q) ||
          r.roomType.code.toLowerCase().includes(q) ||
          (r.activeStay?.guestName && r.activeStay.guestName.toLowerCase().includes(q))
      );
    }

    if (selectedRoomTypeFilter !== "ALL") {
      filtered = filtered.filter((r) => r.roomTypeId === selectedRoomTypeFilter);
    }

    const map = new Map<string, { floorName: string; displayOrder: number; rooms: HotelRoom[] }>();
    const unassigned: HotelRoom[] = [];

    // Initialize floors from floor catalog
    floors.forEach((f) => {
      map.set(f.id, {
        floorName: f.name,
        displayOrder: f.displayOrder || 99,
        rooms: [],
      });
    });

    filtered.forEach((r) => {
      if (r.floorId && map.has(r.floorId)) {
        map.get(r.floorId)!.rooms.push(r);
      } else if (r.floor?.id && map.has(r.floor.id)) {
        map.get(r.floor.id)!.rooms.push(r);
      } else {
        unassigned.push(r);
      }
    });

    const groups: FloorRoomGroup[] = [];
    map.forEach((val, fId) => {
      if (selectedFloorFilter === "ALL" || selectedFloorFilter === fId) {
        if (val.rooms.length > 0 || selectedFloorFilter === fId) {
          groups.push({
            floorId: fId,
            floorName: val.floorName,
            displayOrder: val.displayOrder,
            rooms: val.rooms,
          });
        }
      }
    });

    groups.sort((a, b) => a.displayOrder - b.displayOrder);

    if (unassigned.length > 0 && (selectedFloorFilter === "ALL" || selectedFloorFilter === "UNASSIGNED")) {
      groups.push({
        floorId: null,
        floorName: "Main / Unassigned Floor",
        displayOrder: 999,
        rooms: unassigned,
      });
    }

    return groups;
  }, [rooms, floors, searchQuery, selectedRoomTypeFilter, selectedFloorFilter]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-12">
        <div className="text-center space-y-2">
          <div className="inline-block h-7 w-7 animate-spin rounded-full border-2 border-[#6B2837] border-t-transparent" />
          <p className="text-xs text-[#71675E] font-medium">Loading floor layouts and rooms...</p>
        </div>
      </div>
    );
  }

  if (floorGroups.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-12">
        <div className="text-center max-w-sm rounded-xl border border-dashed border-[#D8CEC1] bg-[#FFFCF7] p-8 space-y-3">
          <BedDouble className="h-8 w-8 text-[#71675E]/40 mx-auto" />
          <h3 className="text-sm font-bold text-[#292320]">No Rooms Found</h3>
          <p className="text-xs text-[#71675E]">
            {searchQuery
              ? `No rooms matched "${searchQuery}".`
              : "No rooms have been added to this floor yet."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-6">
      {floorGroups.map((group) => (
        <section key={group.floorId || "unassigned"} className="space-y-3">
          {/* Floor Header Banner */}
          <div className="flex items-center justify-between border-b border-[#D8CEC1] pb-2">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-[#6B2837]" />
              <h2 className="text-sm font-bold text-[#292320]">{group.floorName}</h2>
              <span className="text-[11px] font-medium text-[#71675E]">
                ({group.rooms.length} room{group.rooms.length === 1 ? "" : "s"})
              </span>
            </div>
          </div>

          {/* Room Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5">
            {group.rooms.map((room) => {
              const badge = getStatusBadge(room.status);
              const isOccupied =
                room.status === "OCCUPIED_CLEAN" || room.status === "OCCUPIED_DIRTY";
              const isVacantClean = room.status === "VACANT_CLEAN";

              return (
                <div
                  key={room.id}
                  className="rounded-xl border border-[#D8CEC1] bg-[#FFFCF7] p-3.5 space-y-2.5 shadow-2xs hover:border-[#6B2837] transition-all flex flex-col justify-between"
                >
                  {/* Top Bar: Room # & Status Badge */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-base font-extrabold text-[#292320] tracking-tight">
                          Room {room.roomNumber}
                        </span>
                      </div>

                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${badge.bg}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${badge.indicator}`} />
                        <span>{badge.label}</span>
                      </span>
                    </div>

                    {/* Room Type & Base Rate */}
                    <div className="flex items-center justify-between text-xs text-[#71675E]">
                      <span className="font-semibold text-[#292320]">
                        {room.roomType.name}
                      </span>
                      <span className="font-mono tabular-nums text-[#6B2837] font-bold">
                        {formatNPR(room.roomType.baseRate)}/nt
                      </span>
                    </div>

                    {/* Active Guest Info if Occupied */}
                    {isOccupied && room.activeStay && (
                      <div className="p-2 rounded-lg bg-[#F8EEF0] border border-[#E9CDD3] space-y-0.5 text-xs">
                        <div className="font-bold text-[#6B2837] truncate">
                          {room.activeStay.guestName}
                        </div>
                        <div className="text-[10px] text-[#71675E] flex justify-between">
                          <span>Out: {new Date(room.activeStay.expectedCheckOut).toLocaleDateString()}</span>
                          <span className="font-mono tabular-nums font-semibold text-[#292320]">
                            {formatNPR(room.activeStay.totalCharges)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Bottom Action Strip */}
                  <div className="pt-2 border-t border-[#D8CEC1]/60 flex items-center justify-between gap-1.5">
                    {/* Primary Button */}
                    {isVacantClean ? (
                      <button
                        type="button"
                        onClick={() => setShowFastCheckInModal(true, room)}
                        className="flex-1 py-1 px-2 rounded-md bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-bold flex items-center justify-center gap-1 cursor-pointer shadow-xs transition-colors"
                      >
                        <UserCheck className="h-3 w-3" />
                        <span>Check-In</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowHousekeepingModal(true, room)}
                        className="flex-1 py-1 px-2 rounded-md border border-[#D8CEC1] bg-[#F7F3EC] hover:bg-[#EEE7DD] text-[#292320] text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                      >
                        <Wrench className="h-3 w-3 text-[#71675E]" />
                        <span>Status</span>
                      </button>
                    )}

                    {/* Icon Actions */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setShowQrModal(true, room)}
                        title="Room QR Plaque for Guest Ordering"
                        className="p-1.5 rounded-md border border-[#D8CEC1] bg-[#FFFCF7] text-[#71675E] hover:text-[#6B2837] hover:bg-[#EEE7DD] cursor-pointer"
                      >
                        <QrCode className="h-3.5 w-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setEditingRoom(room)}
                        title="Edit Room Details"
                        className="p-1.5 rounded-md border border-[#D8CEC1] bg-[#FFFCF7] text-[#71675E] hover:text-[#292320] hover:bg-[#EEE7DD] cursor-pointer"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => deleteRoom(room)}
                        title="Delete Room"
                        className="p-1.5 rounded-md border border-red-200 bg-red-50 text-[#DC2626] hover:bg-red-100 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
};

