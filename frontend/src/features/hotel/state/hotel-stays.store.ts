/**
 * Hotel Stays State Store
 * Clean MVVM ViewModel for in-house active stays, room transfers, stay extensions, and checkout
 */

import { create } from "zustand";
import { HotelStay, HotelRoom } from "../models/hotel.types";
import { hotelRepository } from "../repositories/hotel.repository";

interface HotelStaysState {
  stays: HotelStay[];
  rooms: HotelRoom[];
  statusFilter: "IN_HOUSE" | "ALL" | "CHECKED_OUT";
  search: string;

  isLoading: boolean;
  isActionLoading: boolean;
  error: string | null;

  // Active Modals & Targets
  transferTarget: HotelStay | null;
  extendTarget: HotelStay | null;
  checkOutTarget: HotelStay | null;
  folioBalance: number | null;
  isLoadingFolio: boolean;

  // Actions
  setStatusFilter: (filter: "IN_HOUSE" | "ALL" | "CHECKED_OUT") => void;
  setSearch: (search: string) => void;
  loadStays: () => Promise<void>;

  openTransferModal: (stay: HotelStay) => void;
  closeTransferModal: () => void;
  submitTransfer: (targetRoomId: string, reason?: string) => Promise<boolean>;

  openExtendModal: (stay: HotelStay) => void;
  closeExtendModal: () => void;
  submitExtend: (newExpectedCheckOut: string, additionalPaidAmount?: number, notes?: string) => Promise<boolean>;

  openCheckOutModal: (stay: HotelStay) => Promise<void>;
  closeCheckOutModal: () => void;
  submitCheckOut: (paymentMethod?: string, paidAmount?: number) => Promise<boolean>;
}

export const useHotelStaysStore = create<HotelStaysState>((set, get) => ({
  stays: [],
  rooms: [],
  statusFilter: "IN_HOUSE",
  search: "",

  isLoading: false,
  isActionLoading: false,
  error: null,

  transferTarget: null,
  extendTarget: null,
  checkOutTarget: null,
  folioBalance: null,
  isLoadingFolio: false,

  setStatusFilter: (statusFilter) => set({ statusFilter }),
  setSearch: (search) => set({ search }),

  loadStays: async () => {
    set({ isLoading: true, error: null });
    try {
      const [stays, tapeChart] = await Promise.all([
        hotelRepository.fetchStays(),
        hotelRepository.fetchTapeChart(
          new Date().toISOString().split("T")[0],
          new Date(Date.now() + 86400000).toISOString().split("T")[0]
        ),
      ]);
      set({
        stays,
        rooms: tapeChart.rooms || [],
        isLoading: false,
      });
    } catch (err: any) {
      set({ error: err.message || "Failed to load stays", isLoading: false });
    }
  },

  openTransferModal: (stay) => set({ transferTarget: stay }),
  closeTransferModal: () => set({ transferTarget: null }),

  submitTransfer: async (targetRoomId, reason) => {
    const { transferTarget } = get();
    if (!transferTarget) return false;

    set({ isActionLoading: true });
    try {
      await hotelRepository.transferStay(transferTarget.id, {
        targetRoomId,
        reason: reason || "Room transfer requested by guest",
      });
      await get().loadStays();
      set({ isActionLoading: false, transferTarget: null });
      return true;
    } catch (err: any) {
      set({ isActionLoading: false, error: err.message || "Failed to transfer room" });
      return false;
    }
  },

  openExtendModal: (stay) => set({ extendTarget: stay }),
  closeExtendModal: () => set({ extendTarget: null }),

  submitExtend: async (newExpectedCheckOut, additionalPaidAmount, notes) => {
    const { extendTarget } = get();
    if (!extendTarget) return false;

    set({ isActionLoading: true });
    try {
      await hotelRepository.extendStay(extendTarget.id, {
        newExpectedCheckOut,
        additionalPaidAmount,
        notes,
      });
      await get().loadStays();
      set({ isActionLoading: false, extendTarget: null });
      return true;
    } catch (err: any) {
      set({ isActionLoading: false, error: err.message || "Failed to extend stay" });
      return false;
    }
  },

  openCheckOutModal: async (stay) => {
    set({ checkOutTarget: stay, isLoadingFolio: true, folioBalance: null });
    try {
      // Fetch stay folio to determine outstanding balance
      const folios = await hotelRepository.fetchFolios({ search: stay.stayNumber });
      const matched = folios.find((f) => f.stayId === stay.id) || folios[0];
      const bal = matched ? matched.balance : Math.max(0, Number(stay.totalCharges) - Number(stay.paidAmount));
      set({ folioBalance: bal, isLoadingFolio: false });
    } catch {
      const fallbackBal = Math.max(0, Number(stay.totalCharges) - Number(stay.paidAmount));
      set({ folioBalance: fallbackBal, isLoadingFolio: false });
    }
  },

  closeCheckOutModal: () => set({ checkOutTarget: null, folioBalance: null }),

  submitCheckOut: async (paymentMethod, paidAmount) => {
    const { checkOutTarget } = get();
    if (!checkOutTarget) return false;

    set({ isActionLoading: true });
    try {
      await hotelRepository.checkOutStay(checkOutTarget.id, {
        paymentMethod: paymentMethod || "CASH",
        paidAmount: paidAmount || 0,
      });
      await get().loadStays();
      set({ isActionLoading: false, checkOutTarget: null });
      return true;
    } catch (err: any) {
      set({ isActionLoading: false, error: err.message || "Failed to check out stay" });
      return false;
    }
  },
}));

