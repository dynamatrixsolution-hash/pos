import { create } from "zustand";
import { restaurantPosRepository } from "../repositories/restaurant-pos.repository";
import { toast } from "@/components/toast";

export interface TicketLineItem {
  id: string;
  itemName: string;
  quantity: number;
  status: "QUEUED" | "PREPARING" | "READY" | "SERVED" | "CANCELLED";
  notes?: string | null;
  modifiersSnapshot?: any[];
  dietaryAlerts?: string[];
  orderLine?: {
    id?: string;
    menuItem?: {
      id: string;
      prepTimeMinutes?: number | null;
    } | null;
  } | null;
}

export interface KitchenTicketItem {
  id: string;
  ticketNumber: string;
  stationId: string;
  station: { name: string; code: string };
  order: {
    id?: string;
    orderNumber: string;
    table?: {
      tableNumber: string;
      floor?: { id: string; name: string } | null;
    } | null;
    orderType: string;
    notes?: string | null;
  };
  round: { roundNumber: number };
  status: "QUEUED" | "PREPARING" | "READY" | "SERVED" | "CANCELLED";
  notes?: string | null;
  createdAt: string;
  lines: TicketLineItem[];
}

interface RestaurantKdsState {
  tickets: KitchenTicketItem[];
  servedTickets: KitchenTicketItem[];
  stations: Array<{ id: string; name: string; code: string }>;
  floors: Array<{ id: string; name: string }>;
  isLoading: boolean;
  error: string | null;

  // Filters
  selectedStationId: string;
  selectedFloorId: string;
  selectedOrderType: string;
  soundEnabled: boolean;
  activeTab: "ACTIVE" | "SERVED";

  // Modal
  cancellingOrder: { ticketId: string; orderId: string; tableNumber: string } | null;

  // Setters
  setSelectedStationId: (id: string) => void;
  setSelectedFloorId: (id: string) => void;
  setSelectedOrderType: (type: string) => void;
  setSoundEnabled: (enabled: boolean) => void;
  setActiveTab: (tab: "ACTIVE" | "SERVED") => void;
  setCancellingOrder: (target: { ticketId: string; orderId: string; tableNumber: string } | null) => void;

  // Actions
  loadKitchenData: (includeMeta?: boolean) => Promise<void>;
  updateTicketStatus: (ticketId: string, status: "PREPARING" | "READY" | "SERVED") => Promise<boolean>;
  updateLineStatus: (ticketId: string, lineId: string, status: "PREPARING" | "READY" | "CANCELLED", reason?: string) => Promise<boolean>;
  submitCancelOrder: (reason: string) => Promise<boolean>;
}

export const useRestaurantKdsStore = create<RestaurantKdsState>((set, get) => ({
  tickets: [],
  servedTickets: [],
  stations: [],
  floors: [],
  isLoading: false,
  error: null,

  selectedStationId: "ALL",
  selectedFloorId: "ALL",
  selectedOrderType: "ALL",
  soundEnabled: true,
  activeTab: "ACTIVE",

  cancellingOrder: null,

  setSelectedStationId: (selectedStationId) => set({ selectedStationId }),
  setSelectedFloorId: (selectedFloorId) => set({ selectedFloorId }),
  setSelectedOrderType: (selectedOrderType) => set({ selectedOrderType }),
  setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
  setActiveTab: (activeTab) => set({ activeTab }),
  setCancellingOrder: (cancellingOrder) => set({ cancellingOrder }),

  loadKitchenData: async (includeMeta = false) => {
    try {
      const stationId = get().selectedStationId !== "ALL" ? get().selectedStationId : undefined;
      if (includeMeta || get().stations.length === 0) {
        const data = await restaurantPosRepository.fetchKitchenData(stationId);
        set({
          tickets: data.tickets || [],
          servedTickets: data.served || [],
          stations: data.stations || [],
          floors: data.floors || [],
          error: null,
        });
      } else {
        const data = await restaurantPosRepository.fetchKitchenTickets(stationId);
        set({
          tickets: data.tickets || [],
          servedTickets: data.served || [],
          error: null,
        });
      }
    } catch (err: any) {
      set({ error: err.message || "Failed to poll kitchen tickets" });
    }
  },

  updateTicketStatus: async (ticketId, status) => {
    try {
      await restaurantPosRepository.updateKitchenTicketStatus(ticketId, status);
      await get().loadKitchenData(false);
      return true;
    } catch (err: any) {
      toast.error(err?.message || "Failed to update ticket status");
      return false;
    }
  },

  updateLineStatus: async (ticketId, lineId, status, reason) => {
    try {
      await restaurantPosRepository.updateKitchenTicketLineStatus(ticketId, lineId, status, reason);
      await get().loadKitchenData(false);
      return true;
    } catch (err: any) {
      toast.error(err?.message || "Failed to update dish status");
      return false;
    }
  },

  submitCancelOrder: async (reason) => {
    const target = get().cancellingOrder;
    if (!target) return false;
    try {
      await restaurantPosRepository.cancelOrder(target.orderId, reason);
      await get().loadKitchenData(false);
      set({ cancellingOrder: null });
      toast.success("Kitchen order cancelled");
      return true;
    } catch (err: any) {
      toast.error(err?.message || "Failed to cancel kitchen order");
      return false;
    }
  },
}));

