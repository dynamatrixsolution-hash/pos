/**
 * POS UI State Store
 * Manages view switching, drawer state, and modal open/close flags.
 * Atomic subscribers prevent full page re-renders.
 */

import { create } from "zustand";
import { OrderType, DineInView } from "../models/pos.types";

interface PosUiState {
  dineInView: DineInView;
  orderType: OrderType;
  selectedTableId: string;
  selectedSessionId: string;
  isTicketDrawerOpen: boolean;

  // Modals
  showOccupiedTicketsModal: boolean;
  showTableRequiredModal: boolean;
  showSeatingModal: boolean;
  showTransferModal: boolean;
  showMergeModal: boolean;
  showDeliveryModal: boolean;
  deliveryModalMode: "NEW" | "CONVERT_ACTIVE";
  showModifierModal: boolean;
  showSettlementModal: boolean;

  // Actions
  setDineInView: (view: DineInView) => void;
  setOrderType: (type: OrderType) => void;
  setSelectedTable: (tableId: string, sessionId?: string) => void;
  setIsTicketDrawerOpen: (open: boolean) => void;
  toggleTicketDrawer: () => void;

  setShowOccupiedTicketsModal: (open: boolean) => void;
  setShowTableRequiredModal: (open: boolean) => void;
  setShowSeatingModal: (open: boolean) => void;
  setShowTransferModal: (open: boolean) => void;
  setShowMergeModal: (open: boolean) => void;
  setShowDeliveryModal: (open: boolean) => void;
  setDeliveryModalMode: (mode: "NEW" | "CONVERT_ACTIVE") => void;
  setShowModifierModal: (open: boolean) => void;
  setShowSettlementModal: (open: boolean) => void;

  syncUrlView: (view: DineInView, tableId?: string) => void;
}

export const usePosUiStore = create<PosUiState>((set, get) => ({
  dineInView: "SELECT_SPACE",
  orderType: "DINE_IN",
  selectedTableId: "",
  selectedSessionId: "",
  isTicketDrawerOpen: false,

  showOccupiedTicketsModal: false,
  showTableRequiredModal: false,
  showSeatingModal: false,
  showTransferModal: false,
  showMergeModal: false,
  showDeliveryModal: false,
  deliveryModalMode: "NEW",
  showModifierModal: false,
  showSettlementModal: false,

  setDineInView: (view) => set({ dineInView: view }),
  setOrderType: (orderType) => set({ orderType }),
  setSelectedTable: (selectedTableId, selectedSessionId = "") =>
    set({ selectedTableId, selectedSessionId }),
  setIsTicketDrawerOpen: (isTicketDrawerOpen) => set({ isTicketDrawerOpen }),
  toggleTicketDrawer: () => set((s) => ({ isTicketDrawerOpen: !s.isTicketDrawerOpen })),

  setShowOccupiedTicketsModal: (showOccupiedTicketsModal) => set({ showOccupiedTicketsModal }),
  setShowTableRequiredModal: (showTableRequiredModal) => set({ showTableRequiredModal }),
  setShowSeatingModal: (showSeatingModal) => set({ showSeatingModal }),
  setShowTransferModal: (showTransferModal) => set({ showTransferModal }),
  setShowMergeModal: (showMergeModal) => set({ showMergeModal }),
  setShowDeliveryModal: (showDeliveryModal) => set({ showDeliveryModal }),
  setDeliveryModalMode: (deliveryModalMode) => set({ deliveryModalMode }),
  setShowModifierModal: (showModifierModal) => set({ showModifierModal }),
  setShowSettlementModal: (showSettlementModal) => set({ showSettlementModal }),

  syncUrlView: (view, tableId) => {
    set({
      dineInView: view,
      isTicketDrawerOpen: view === "MENU_POS",
      ...(view === "SELECT_SPACE" ? { selectedTableId: "" } : {}),
    });
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.pathname = "/dashboard/restaurant/pos";
      url.searchParams.set("view", view === "MENU_POS" ? "menu" : "tables");
      if (tableId) {
        url.searchParams.set("tableId", tableId);
      } else {
        url.searchParams.delete("tableId");
      }
      window.history.pushState(null, "", url.toString());
      window.dispatchEvent(new Event("urlchange"));
      window.dispatchEvent(new Event("popstate"));
    }
  },
}));

