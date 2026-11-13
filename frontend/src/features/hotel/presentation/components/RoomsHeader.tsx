"use client";

import React from "react";
import {
  LayoutGrid,
  Table as TableIcon,
  Calendar,
  Layers,
  BedDouble,
  UserCheck,
  Plus,
  RefreshCw,
  Search,
} from "lucide-react";
import { useHotelUiStore } from "../../state/hotel-ui.store";
import { useHotelRoomsStore } from "../../state/hotel-rooms.store";
import { HotelViewMode } from "../../models/hotel.types";

export const RoomsHeader: React.FC = () => {
  const viewMode = useHotelUiStore((s) => s.viewMode);
  const setViewMode = useHotelUiStore((s) => s.setViewMode);
  const selectedFloorFilter = useHotelUiStore((s) => s.selectedFloorFilter);
  const setSelectedFloorFilter = useHotelUiStore((s) => s.setSelectedFloorFilter);
  const selectedRoomTypeFilter = useHotelUiStore((s) => s.selectedRoomTypeFilter);
  const setSelectedRoomTypeFilter = useHotelUiStore((s) => s.setSelectedRoomTypeFilter);
  const searchQuery = useHotelUiStore((s) => s.searchQuery);
  const setSearchQuery = useHotelUiStore((s) => s.setSearchQuery);

  const setShowFastCheckInModal = useHotelUiStore((s) => s.setShowFastCheckInModal);
  const setShowAddRoomModal = useHotelUiStore((s) => s.setShowAddRoomModal);
  const setShowRoomTypeModal = useHotelUiStore((s) => s.setShowRoomTypeModal);
  const setShowAddFloorModal = useHotelUiStore((s) => s.setShowAddFloorModal);

  const stats = useHotelRoomsStore((s) => s.stats);
  const floors = useHotelRoomsStore((s) => s.floors);
  const roomTypes = useHotelRoomsStore((s) => s.roomTypes);
  const refreshRooms = useHotelRoomsStore((s) => s.refreshRooms);
  const loading = useHotelRoomsStore((s) => s.loading);

  const navTabs: { id: HotelViewMode; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: "FLOOR_VIEW", label: "Floor Layout", icon: LayoutGrid },
    { id: "ROOM_RACK", label: "Room Rack", icon: TableIcon },
    { id: "TAPE_CHART", label: "Tape Chart", icon: Calendar },
    { id: "ROOM_TYPES", label: "Room Types", icon: BedDouble },
    { id: "FLOORS", label: "Floors", icon: Layers },
  ];

  return (
    <div className="border-b border-[#D8CEC1] bg-[#FFFCF7] p-4 space-y-3.5 select-none shrink-0 shadow-2xs">
      {/* Top Row: Title, Nav Tabs & Quick Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[#6B2837] text-white">
            <BedDouble className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-[#292320]">
              Rooms &amp; Floor Manager
            </h1>
            <p className="text-xs text-[#71675E]">
              Hotel room inventory, fast check-in, housekeeping, and tape chart
            </p>
          </div>
        </div>

        {/* View Mode Navigation Tabs */}
        <div className="flex items-center gap-1 rounded-lg border border-[#D8CEC1] bg-[#F7F3EC] p-1">
          {navTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = viewMode === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setViewMode(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  isActive
                    ? "bg-[#6B2837] text-white shadow-xs"
                    : "text-[#71675E] hover:text-[#292320] hover:bg-[#EEE7DD]"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => refreshRooms()}
            disabled={loading}
            title="Refresh rooms"
            className="p-2 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] text-[#71675E] hover:bg-[#EEE7DD] hover:text-[#292320] cursor-pointer transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin text-[#6B2837]" : ""}`} />
          </button>

          <button
            type="button"
            onClick={() => setShowFastCheckInModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-bold cursor-pointer shadow-xs transition-colors"
          >
            <UserCheck className="h-4 w-4" />
            <span>Fast Check-In</span>
          </button>

          <button
            type="button"
            onClick={() => setShowAddRoomModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#6B2837] hover:bg-[#59222e] text-white text-xs font-bold cursor-pointer shadow-xs transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Add Room</span>
          </button>
        </div>
      </div>

      {/* Bottom Row: Stats Counters & Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#D8CEC1]/60">
        {/* Status Pills */}
        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-[#C8DFCD] bg-[#EDF5ED] text-[#2D6A4F] font-bold">
            <span className="h-2 w-2 rounded-full bg-[#16A34A]" />
            <span>Vacant Clean:</span>
            <span className="tabular-nums font-mono">{stats.vacantClean}</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-[#FDE68A] bg-[#FFFBEB] text-[#B45309] font-bold">
            <span className="h-2 w-2 rounded-full bg-[#EAB308]" />
            <span>Dirty:</span>
            <span className="tabular-nums font-mono">{stats.vacantDirty}</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-[#E9CDD3] bg-[#F8EEF0] text-[#6B2837] font-bold">
            <span className="h-2 w-2 rounded-full bg-[#DC2626]" />
            <span>Occupied:</span>
            <span className="tabular-nums font-mono">{stats.occupied}</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-[#D8CEC1] bg-[#F7F3EC] text-[#71675E] font-bold">
            <span className="h-2 w-2 rounded-full bg-[#71675E]" />
            <span>Maintenance:</span>
            <span className="tabular-nums font-mono">{stats.maintenance}</span>
          </div>

          <div className="hidden lg:flex items-center gap-1 px-2.5 py-1 rounded-md border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] font-bold">
            <span>Total:</span>
            <span className="tabular-nums font-mono">{stats.total}</span>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="h-3.5 w-3.5 text-[#71675E] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search room # or guest..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-48 pl-8 pr-2.5 py-1 text-xs rounded-md border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] focus:border-[#6B2837] focus:outline-none"
            />
          </div>

          {/* Floor Filter */}
          <select
            value={selectedFloorFilter}
            onChange={(e) => setSelectedFloorFilter(e.target.value)}
            className="text-xs px-2.5 py-1 rounded-md border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] focus:border-[#6B2837] focus:outline-none cursor-pointer"
          >
            <option value="ALL">All Floors</option>
            {floors.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>

          {/* Room Type Filter */}
          <select
            value={selectedRoomTypeFilter}
            onChange={(e) => setSelectedRoomTypeFilter(e.target.value)}
            className="text-xs px-2.5 py-1 rounded-md border border-[#D8CEC1] bg-[#FFFCF7] text-[#292320] focus:border-[#6B2837] focus:outline-none cursor-pointer"
          >
            <option value="ALL">All Room Types</option>
            {roomTypes.map((rt) => (
              <option key={rt.id} value={rt.id}>
                {rt.name} ({rt.code})
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};

