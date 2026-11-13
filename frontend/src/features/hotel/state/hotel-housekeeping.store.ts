import { create } from "zustand";
import { HousekeepingTask, MaintenanceTicket, HotelRoom } from "../models/hotel.types";
import { hotelRepository } from "../repositories/hotel.repository";
import { Notify } from "@/lib/notify";

interface HotelHousekeepingState {
  activeTab: "HOUSEKEEPING" | "MAINTENANCE";
  hkFilter: string;
  rooms: HotelRoom[];
  tasks: HousekeepingTask[];
  tickets: MaintenanceTicket[];
  loading: boolean;
  actionLoadingId: string | null;
  error: string | null;

  setActiveTab: (tab: "HOUSEKEEPING" | "MAINTENANCE") => void;
  setHkFilter: (filter: string) => void;
  loadAll: () => Promise<void>;
  createHousekeepingTask: (payload: any) => Promise<boolean>;
  updateTaskStatus: (id: string, status: string) => Promise<boolean>;
  createMaintenanceTicket: (payload: any) => Promise<boolean>;
  updateMaintenanceStatus: (id: string, status: string) => Promise<boolean>;
}

export const useHotelHousekeepingStore = create<HotelHousekeepingState>((set, get) => ({
  activeTab: "HOUSEKEEPING",
  hkFilter: "ALL",
  rooms: [],
  tasks: [],
  tickets: [],
  loading: false,
  actionLoadingId: null,
  error: null,

  setActiveTab: (activeTab) => set({ activeTab }),

  setHkFilter: (hkFilter) => {
    set({ hkFilter });
    get().loadAll();
  },

  loadAll: async () => {
    try {
      set({ loading: true, error: null });
      const { hkFilter } = get();
      const [rms, tsks, tkts] = await Promise.all([
        hotelRepository.fetchRooms(),
        hotelRepository.fetchHousekeepingTasks(hkFilter !== "ALL" ? { status: hkFilter } : undefined),
        hotelRepository.fetchMaintenanceTickets(),
      ]);
      set({ rooms: rms, tasks: tsks, tickets: tkts, loading: false });
    } catch (err: any) {
      console.error("Failed to load housekeeping/maintenance data:", err);
      set({ error: err.message || "Failed to load data", loading: false });
    }
  },

  createHousekeepingTask: async (payload: any) => {
    try {
      set({ actionLoadingId: "new-task" });
      await hotelRepository.createHousekeepingTask(payload);
      Notify.success("Housekeeping task dispatched successfully");
      await get().loadAll();
      return true;
    } catch (err: any) {
      console.error("Failed to dispatch task:", err);
      Notify.error(err.message || "Failed to create housekeeping task");
      return false;
    } finally {
      set({ actionLoadingId: null });
    }
  },

  updateTaskStatus: async (id: string, status: string) => {
    try {
      set({ actionLoadingId: id });
      await hotelRepository.updateHousekeepingTask(id, { status });
      Notify.success(`Housekeeping status updated to ${status}`);
      await get().loadAll();
      return true;
    } catch (err: any) {
      console.error("Failed to update task status:", err);
      Notify.error(err.message || "Failed to update task");
      return false;
    } finally {
      set({ actionLoadingId: null });
    }
  },

  createMaintenanceTicket: async (payload: any) => {
    try {
      set({ actionLoadingId: "new-maint" });
      await hotelRepository.createMaintenanceTicket(payload);
      Notify.success("Room blocked and maintenance ticket logged");
      await get().loadAll();
      return true;
    } catch (err: any) {
      console.error("Failed to create maintenance ticket:", err);
      Notify.error(err.message || "Failed to create maintenance ticket");
      return false;
    } finally {
      set({ actionLoadingId: null });
    }
  },

  updateMaintenanceStatus: async (id: string, status: string) => {
    try {
      set({ actionLoadingId: id });
      await hotelRepository.updateMaintenanceTicket(id, { status });
      Notify.success(`Maintenance ticket updated to ${status}`);
      await get().loadAll();
      return true;
    } catch (err: any) {
      console.error("Failed to update maintenance ticket:", err);
      Notify.error(err.message || "Failed to update maintenance ticket");
      return false;
    } finally {
      set({ actionLoadingId: null });
    }
  },
}));

