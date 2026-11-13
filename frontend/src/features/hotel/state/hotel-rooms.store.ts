/**
 * Hotel Rooms & Operations Store
 * Clean Architecture MVVM ViewModel for Rooms, Stays & Allocations
 */

import { create } from "zustand";
import {
  HotelRoom,
  RoomType,
  HotelFloor,
  TapeChartStats,
  RoomStatus,
} from "../models/hotel.types";
import { hotelRepository } from "../repositories/hotel.repository";
import { useHotelUiStore } from "./hotel-ui.store";
import { Notify } from "@/lib/notify";

interface HotelRoomsState {
  rooms: HotelRoom[];
  roomTypes: RoomType[];
  floors: HotelFloor[];
  dates: string[];
  stats: TapeChartStats;
  loading: boolean;
  actionLoading: boolean;

  // Actions
  loadInitialData: () => Promise<void>;
  refreshRooms: () => Promise<void>;
  quickUpdateRoomStatus: (roomId: string, newStatus: RoomStatus) => Promise<boolean>;
  createRoom: (payload: {
    roomNumber: string;
    roomTypeId: string;
    floorId?: string;
    capacity?: number;
    notes?: string;
  }) => Promise<boolean>;
  updateRoom: (
    id: string,
    payload: {
      roomNumber?: string;
      roomTypeId?: string;
      floorId?: string | null;
      capacity?: number;
      status?: RoomStatus;
      notes?: string | null;
    }
  ) => Promise<boolean>;
  deleteRoom: (room: HotelRoom) => Promise<boolean>;

  fastCheckIn: (payload: {
    roomId: string;
    guestName: string;
    guestPhone?: string;
    guestEmail?: string;
    guestIdType?: string;
    guestIdNumber?: string;
    expectedCheckOut: string;
    ratePerNight: number;
    paidAmount?: number;
    notes?: string;
  }) => Promise<boolean>;

  createRoomType: (payload: {
    name: string;
    code: string;
    baseRate: number;
    maxOccupancy: number;
    description?: string;
  }) => Promise<boolean>;
  updateRoomType: (
    id: string,
    payload: {
      name?: string;
      code?: string;
      baseRate?: number;
      maxOccupancy?: number;
      description?: string;
    }
  ) => Promise<boolean>;
  deleteRoomType: (rt: RoomType) => Promise<boolean>;

  createFloor: (payload: { name: string; displayOrder?: number }) => Promise<boolean>;
  updateFloor: (id: string, payload: { name: string; displayOrder?: number }) => Promise<boolean>;
  deleteFloor: (floor: HotelFloor) => Promise<boolean>;
}

export const useHotelRoomsStore = create<HotelRoomsState>((set, get) => ({
  rooms: [],
  roomTypes: [],
  floors: [],
  dates: [],
  stats: {
    total: 0,
    vacantClean: 0,
    vacantDirty: 0,
    occupied: 0,
    maintenance: 0,
  },
  loading: true,
  actionLoading: false,

  loadInitialData: async () => {
    set({ loading: true });
    try {
      const ui = useHotelUiStore.getState();
      const startObj = new Date(`${ui.startDate}T00:00:00.000Z`);
      const endObj = new Date(startObj.getTime() + ui.horizonDays * 24 * 60 * 60 * 1000);
      const endStr = endObj.toISOString().slice(0, 10);

      const [roomTypes, tcData, floors] = await Promise.all([
        hotelRepository.fetchRoomTypes(),
        hotelRepository.fetchTapeChart(ui.startDate, endStr, ui.selectedRoomTypeFilter),
        hotelRepository.fetchFloors(),
      ]);

      set({
        roomTypes,
        rooms: tcData.rooms,
        dates: tcData.dates,
        stats: tcData.stats,
        floors,
        loading: false,
      });
    } catch (err: any) {
      Notify.failure(err.message || "Failed to load hotel rooms data");
      set({ loading: false });
    }
  },

  refreshRooms: async () => {
    try {
      const ui = useHotelUiStore.getState();
      const startObj = new Date(`${ui.startDate}T00:00:00.000Z`);
      const endObj = new Date(startObj.getTime() + ui.horizonDays * 24 * 60 * 60 * 1000);
      const endStr = endObj.toISOString().slice(0, 10);

      const tcData = await hotelRepository.fetchTapeChart(
        ui.startDate,
        endStr,
        ui.selectedRoomTypeFilter
      );
      set({
        rooms: tcData.rooms,
        dates: tcData.dates,
        stats: tcData.stats,
      });
    } catch {
      // Background poll dropouts handled silently
    }
  },

  quickUpdateRoomStatus: async (roomId, newStatus) => {
    // Optimistic UI update
    const previousRooms = get().rooms;
    set((state) => ({
      rooms: state.rooms.map((r) => (r.id === roomId ? { ...r, status: newStatus } : r)),
    }));

    try {
      await hotelRepository.updateRoom(roomId, { status: newStatus });
      Notify.success(`Room status updated to ${newStatus}`);
      get().refreshRooms();
      return true;
    } catch (err: any) {
      set({ rooms: previousRooms });
      Notify.failure(err.message || "Failed to update room status");
      return false;
    }
  },

  createRoom: async (payload) => {
    set({ actionLoading: true });
    try {
      await hotelRepository.createRoom(payload);
      Notify.success(`Room ${payload.roomNumber} created successfully`);
      useHotelUiStore.getState().setShowAddRoomModal(false);
      await get().loadInitialData();
      return true;
    } catch (err: any) {
      Notify.failure(err.message || "Failed to create room");
      return false;
    } finally {
      set({ actionLoading: false });
    }
  },

  updateRoom: async (id, payload) => {
    set({ actionLoading: true });
    try {
      await hotelRepository.updateRoom(id, payload);
      Notify.success(`Room updated successfully`);
      useHotelUiStore.getState().setEditingRoom(null);
      await get().loadInitialData();
      return true;
    } catch (err: any) {
      Notify.failure(err.message || "Failed to update room");
      return false;
    } finally {
      set({ actionLoading: false });
    }
  },

  deleteRoom: async (room) => {
    if (room.activeStay) {
      Notify.warning(
        `Cannot delete Room ${room.roomNumber} while a guest is currently staying in it. Please check out the guest first.`
      );
      return false;
    }
    const confirmed = window.confirm(
      `Are you sure you want to delete Room ${room.roomNumber}?`
    );
    if (!confirmed) return false;

    set({ actionLoading: true });
    try {
      await hotelRepository.deleteRoom(room.id);
      Notify.success(`Room ${room.roomNumber} deleted successfully`);
      await get().loadInitialData();
      return true;
    } catch (err: any) {
      Notify.failure(err.message || "Failed to delete room");
      return false;
    } finally {
      set({ actionLoading: false });
    }
  },

  fastCheckIn: async (payload) => {
    set({ actionLoading: true });
    try {
      await hotelRepository.fastCheckIn(payload);
      Notify.success("Guest checked in successfully");
      useHotelUiStore.getState().setShowFastCheckInModal(false);
      await get().loadInitialData();
      return true;
    } catch (err: any) {
      Notify.failure(err.message || "Failed to check in guest");
      return false;
    } finally {
      set({ actionLoading: false });
    }
  },

  createRoomType: async (payload) => {
    set({ actionLoading: true });
    try {
      await hotelRepository.createRoomType(payload);
      Notify.success("Room type created successfully");
      useHotelUiStore.getState().setShowRoomTypeModal(false);
      await get().loadInitialData();
      return true;
    } catch (err: any) {
      Notify.failure(err.message || "Failed to create room type");
      return false;
    } finally {
      set({ actionLoading: false });
    }
  },

  updateRoomType: async (id, payload) => {
    set({ actionLoading: true });
    try {
      await hotelRepository.updateRoomType(id, payload);
      Notify.success("Room type updated successfully");
      useHotelUiStore.getState().setEditingRoomType(null);
      await get().loadInitialData();
      return true;
    } catch (err: any) {
      Notify.failure(err.message || "Failed to update room type");
      return false;
    } finally {
      set({ actionLoading: false });
    }
  },

  deleteRoomType: async (rt) => {
    const assignedCount = get().rooms.filter((r) => r.roomTypeId === rt.id).length;
    if (assignedCount > 0) {
      Notify.warning(
        `Cannot delete Room Type "${rt.name}" (${rt.code}) because ${assignedCount} room(s) are currently assigned to it.`
      );
      return false;
    }
    const confirmed = window.confirm(
      `Are you sure you want to delete Room Type "${rt.name}" (${rt.code})?`
    );
    if (!confirmed) return false;

    set({ actionLoading: true });
    try {
      await hotelRepository.deleteRoomType(rt.id);
      Notify.success("Room type deleted successfully");
      await get().loadInitialData();
      return true;
    } catch (err: any) {
      Notify.failure(err.message || "Failed to delete room type");
      return false;
    } finally {
      set({ actionLoading: false });
    }
  },

  createFloor: async (payload) => {
    set({ actionLoading: true });
    try {
      await hotelRepository.createFloor(payload);
      Notify.success("Floor added successfully");
      useHotelUiStore.getState().setShowAddFloorModal(false);
      await get().loadInitialData();
      return true;
    } catch (err: any) {
      Notify.failure(err.message || "Failed to create floor");
      return false;
    } finally {
      set({ actionLoading: false });
    }
  },

  updateFloor: async (id, payload) => {
    set({ actionLoading: true });
    try {
      await hotelRepository.updateFloor(id, payload);
      Notify.success("Floor updated successfully");
      useHotelUiStore.getState().setEditingFloor(null);
      await get().loadInitialData();
      return true;
    } catch (err: any) {
      Notify.failure(err.message || "Failed to update floor");
      return false;
    } finally {
      set({ actionLoading: false });
    }
  },

  deleteFloor: async (floor) => {
    const assignedRooms = get().rooms.filter((r) => r.floorId === floor.id).length;
    if (assignedRooms > 0) {
      Notify.warning(
        `Cannot delete floor "${floor.name}" because ${assignedRooms} room(s) are assigned to it.`
      );
      return false;
    }
    const confirmed = window.confirm(
      `Are you sure you want to delete Floor "${floor.name}"?`
    );
    if (!confirmed) return false;

    set({ actionLoading: true });
    try {
      await hotelRepository.deleteFloor(floor.id);
      Notify.success("Floor deleted successfully");
      await get().loadInitialData();
      return true;
    } catch (err: any) {
      Notify.failure(err.message || "Failed to delete floor");
      return false;
    } finally {
      set({ actionLoading: false });
    }
  },
}));

