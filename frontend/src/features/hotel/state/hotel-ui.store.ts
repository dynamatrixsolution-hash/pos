/**
 * Hotel UI State Store
 * Manages view switching, filters, and modal open/close states
 */

import { create } from "zustand";
import { HotelViewMode, HotelRoom, RoomType, HotelFloor } from "../models/hotel.types";

interface HotelUiState {
  viewMode: HotelViewMode;
  horizonDays: 7 | 14;
  startDate: string;
  selectedRoomTypeFilter: string;
  selectedFloorFilter: string;
  searchQuery: string;

  // Dialog Controls
  showFastCheckInModal: boolean;
  showAddRoomModal: boolean;
  showAddFloorModal: boolean;
  showRoomTypeModal: boolean;
  showHousekeepingModal: boolean;
  showQrModal: boolean;

  // Entities being edited or acted on
  selectedRoomForAction: HotelRoom | null;
  editingRoom: HotelRoom | null;
  editingRoomType: RoomType | null;
  editingFloor: HotelFloor | null;

  // Actions
  setViewMode: (mode: HotelViewMode) => void;
  setHorizonDays: (days: 7 | 14) => void;
  setStartDate: (date: string) => void;
  setSelectedRoomTypeFilter: (filter: string) => void;
  setSelectedFloorFilter: (filter: string) => void;
  setSearchQuery: (query: string) => void;

  setShowFastCheckInModal: (open: boolean, room?: HotelRoom | null) => void;
  setShowAddRoomModal: (open: boolean) => void;
  setShowAddFloorModal: (open: boolean) => void;
  setShowRoomTypeModal: (open: boolean) => void;
  setShowHousekeepingModal: (open: boolean, room?: HotelRoom | null) => void;
  setShowQrModal: (open: boolean, room?: HotelRoom | null) => void;

  setEditingRoom: (room: HotelRoom | null) => void;
  setEditingRoomType: (rt: RoomType | null) => void;
  setEditingFloor: (floor: HotelFloor | null) => void;
}

export const useHotelUiStore = create<HotelUiState>((set) => ({
  viewMode: "FLOOR_VIEW",
  horizonDays: 14,
  startDate: new Date().toISOString().slice(0, 10),
  selectedRoomTypeFilter: "ALL",
  selectedFloorFilter: "ALL",
  searchQuery: "",

  showFastCheckInModal: false,
  showAddRoomModal: false,
  showAddFloorModal: false,
  showRoomTypeModal: false,
  showHousekeepingModal: false,
  showQrModal: false,

  selectedRoomForAction: null,
  editingRoom: null,
  editingRoomType: null,
  editingFloor: null,

  setViewMode: (viewMode) => set({ viewMode }),
  setHorizonDays: (horizonDays) => set({ horizonDays }),
  setStartDate: (startDate) => set({ startDate }),
  setSelectedRoomTypeFilter: (selectedRoomTypeFilter) => set({ selectedRoomTypeFilter }),
  setSelectedFloorFilter: (selectedFloorFilter) => set({ selectedFloorFilter }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),

  setShowFastCheckInModal: (open, room = null) =>
    set({ showFastCheckInModal: open, selectedRoomForAction: room }),
  setShowAddRoomModal: (open) => set({ showAddRoomModal: open }),
  setShowAddFloorModal: (open) => set({ showAddFloorModal: open }),
  setShowRoomTypeModal: (open) => set({ showRoomTypeModal: open }),
  setShowHousekeepingModal: (open, room = null) =>
    set({ showHousekeepingModal: open, selectedRoomForAction: room }),
  setShowQrModal: (open, room = null) =>
    set({ showQrModal: open, selectedRoomForAction: room }),

  setEditingRoom: (editingRoom) => set({ editingRoom }),
  setEditingRoomType: (editingRoomType) => set({ editingRoomType }),
  setEditingFloor: (editingFloor) => set({ editingFloor }),
}));

