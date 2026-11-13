import { create } from "zustand";
import { HotelReservation, RoomType, HotelRoom } from "../models/hotel.types";
import { hotelRepository } from "../repositories/hotel.repository";
import { Notify } from "@/lib/notify";

interface HotelReservationsState {
  reservations: HotelReservation[];
  roomTypes: RoomType[];
  rooms: HotelRoom[];
  statusFilter: string;
  loading: boolean;
  actionLoading: boolean;
  error: string | null;

  // Actions
  setStatusFilter: (status: string) => void;
  loadReservations: () => Promise<void>;
  createReservation: (payload: any) => Promise<boolean>;
  updateReservationStatus: (id: string, status: string) => Promise<boolean>;
  checkInReservation: (payload: {
    reservationId: string;
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
}

export const useHotelReservationsStore = create<HotelReservationsState>((set, get) => ({
  reservations: [],
  roomTypes: [],
  rooms: [],
  statusFilter: "ALL",
  loading: false,
  actionLoading: false,
  error: null,

  setStatusFilter: (statusFilter) => {
    set({ statusFilter });
    get().loadReservations();
  },

  loadReservations: async () => {
    try {
      set({ loading: true, error: null });
      const { statusFilter } = get();
      const [rsvs, types, rms] = await Promise.all([
        hotelRepository.fetchReservations(statusFilter !== "ALL" ? { status: statusFilter } : undefined),
        hotelRepository.fetchRoomTypes(),
        hotelRepository.fetchRooms(),
      ]);
      set({ reservations: rsvs, roomTypes: types, rooms: rms, loading: false });
    } catch (err: any) {
      console.error("Failed to load reservations:", err);
      set({ error: err.message || "Failed to load reservations", loading: false });
    }
  },

  createReservation: async (payload: any) => {
    try {
      set({ actionLoading: true });
      await hotelRepository.createReservation(payload);
      Notify.success("Reservation confirmed successfully");
      await get().loadReservations();
      return true;
    } catch (err: any) {
      console.error("Create reservation error:", err);
      Notify.error(err.message || "Failed to create reservation");
      return false;
    } finally {
      set({ actionLoading: false });
    }
  },

  updateReservationStatus: async (id: string, status: string) => {
    try {
      set({ actionLoading: true });
      await hotelRepository.updateReservation(id, { status });
      Notify.success(`Reservation marked as ${status}`);
      await get().loadReservations();
      return true;
    } catch (err: any) {
      console.error("Update reservation error:", err);
      Notify.error(err.message || "Failed to update reservation");
      return false;
    } finally {
      set({ actionLoading: false });
    }
  },

  checkInReservation: async (payload) => {
    try {
      set({ actionLoading: true });
      await hotelRepository.fastCheckIn(payload);
      await hotelRepository.updateReservation(payload.reservationId, { status: "CHECKED_IN" });
      Notify.success("Guest checked in successfully & folio initialized");
      await get().loadReservations();
      return true;
    } catch (err: any) {
      console.error("Reservation check-in error:", err);
      Notify.error(err.message || "Failed to check in reservation");
      return false;
    } finally {
      set({ actionLoading: false });
    }
  },
}));

