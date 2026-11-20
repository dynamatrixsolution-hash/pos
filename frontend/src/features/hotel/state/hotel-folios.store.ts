/**
 * Hotel Folios & Master Billing State Store
 * Clean MVVM ViewModel for Folios, Incidental charges, Split Payments, and Settlement
 */

import { create } from "zustand";
import { HotelFolio, FolioPaymentSplit } from "../models/hotel.types";
import { hotelRepository } from "../repositories/hotel.repository";

interface HotelFoliosState {
  folios: HotelFolio[];
  selectedFolio: HotelFolio | null;
  statusFilter: "ALL" | "OPEN" | "SETTLED";
  search: string;

  isLoading: boolean;
  isLoadingDetails: boolean;
  isActionLoading: boolean;
  error: string | null;

  // Modals
  isPostChargeModalOpen: boolean;
  isSettleModalOpen: boolean;

  // Actions
  setStatusFilter: (statusFilter: "ALL" | "OPEN" | "SETTLED") => void;
  setSearch: (search: string) => void;
  loadFolios: () => Promise<void>;
  selectFolio: (id: string) => Promise<void>;

  setIsPostChargeModalOpen: (open: boolean) => void;
  setIsSettleModalOpen: (open: boolean) => void;

  postCharge: (payload: { description: string; amount: number; category?: string; notes?: string }) => Promise<boolean>;
  settleFolio: (tenderLines: FolioPaymentSplit[], idempotencyKey?: string) => Promise<boolean>;
  reverseEntry: (entryId: string, reason: string) => Promise<boolean>;
}

export const useHotelFoliosStore = create<HotelFoliosState>((set, get) => ({
  folios: [],
  selectedFolio: null,
  statusFilter: "ALL",
  search: "",

  isLoading: false,
  isLoadingDetails: false,
  isActionLoading: false,
  error: null,

  isPostChargeModalOpen: false,
  isSettleModalOpen: false,

  setStatusFilter: (statusFilter) => set({ statusFilter }),
  setSearch: (search) => set({ search }),

  loadFolios: async () => {
    const { statusFilter, search } = get();
    set({ isLoading: true, error: null });
    try {
      const folios = await hotelRepository.fetchFolios({
        status: statusFilter !== "ALL" ? statusFilter : undefined,
        search: search.trim() || undefined,
      });
      set({ folios, isLoading: false });

      // Auto-select first folio if none selected
      if (!get().selectedFolio && folios.length > 0) {
        get().selectFolio(folios[0].id);
      }
    } catch (err: any) {
      set({ error: err.message || "Failed to load folios", isLoading: false });
    }
  },

  selectFolio: async (id: string) => {
    set({ isLoadingDetails: true });
    try {
      const folio = await hotelRepository.fetchFolioById(id);
      set({ selectedFolio: folio, isLoadingDetails: false });
    } catch {
      const local = get().folios.find((f) => f.id === id) || null;
      set({ selectedFolio: local, isLoadingDetails: false });
    }
  },

  setIsPostChargeModalOpen: (isPostChargeModalOpen) => set({ isPostChargeModalOpen }),
  setIsSettleModalOpen: (isSettleModalOpen) => set({ isSettleModalOpen }),

  postCharge: async (payload) => {
    const { selectedFolio } = get();
    if (!selectedFolio) return false;

    set({ isActionLoading: true });
    try {
      await hotelRepository.postFolioCharge(selectedFolio.id, payload);
      await get().selectFolio(selectedFolio.id);
      await get().loadFolios();
      set({ isActionLoading: false, isPostChargeModalOpen: false });
      return true;
    } catch (err: any) {
      set({ isActionLoading: false, error: err.message || "Failed to post charge" });
      return false;
    }
  },

  settleFolio: async (tenderLines, idempotencyKey) => {
    const { selectedFolio } = get();
    if (!selectedFolio) return false;

    set({ isActionLoading: true });
    try {
      await hotelRepository.settleFolio(
        selectedFolio.id,
        {
          tenders: tenderLines.map((t) => {
            const isQrAlias = ["FONEPAY", "KHALTI"].includes(t.method);
            return {
              paymentMethod: isQrAlias ? "QR" : (t.method as "CASH" | "CARD" | "QR" | "BANK_TRANSFER" | "DEPOSIT"),
              amount: t.amount,
              reference: isQrAlias ? t.method : null,
              notes: t.notes || null,
            };
          }),
        },
        idempotencyKey
      );
      await get().selectFolio(selectedFolio.id);
      await get().loadFolios();
      set({ isActionLoading: false, isSettleModalOpen: false });
      return true;
    } catch (err: any) {
      set({ isActionLoading: false, error: err.message || "Failed to settle folio" });
      return false;
    }
  },

  reverseEntry: async (entryId, reason) => {
    const { selectedFolio } = get();
    if (!selectedFolio) return false;

    set({ isActionLoading: true });
    try {
      await hotelRepository.reverseFolioEntry(selectedFolio.id, entryId, reason);
      await get().selectFolio(selectedFolio.id);
      await get().loadFolios();
      set({ isActionLoading: false });
      return true;
    } catch (err: any) {
      set({ isActionLoading: false, error: err.message || "Failed to reverse charge" });
      return false;
    }
  },
}));

