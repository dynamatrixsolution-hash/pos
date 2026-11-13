import { create } from "zustand";
import { ServiceRequestItem, HotelQrLocationRecord, HotelRoom } from "../models/hotel.types";
import { hotelRepository } from "../repositories/hotel.repository";
import { apiClient } from "@/core/api/api-client";
import { Notify } from "@/lib/notify";

interface HotelQrPortalState {
  consoleTab: "SERVICE_QUEUE" | "QR_PLAQUES";
  serviceCategory: string;
  serviceStatus: string;
  serviceRequests: ServiceRequestItem[];
  qrLocations: HotelQrLocationRecord[];
  rooms: HotelRoom[];
  tables: any[];
  loading: boolean;
  actionLoadingId: string | null;
  error: string | null;

  setConsoleTab: (tab: "SERVICE_QUEUE" | "QR_PLAQUES") => void;
  setServiceCategory: (category: string) => void;
  setServiceStatus: (status: string) => void;
  loadAll: () => Promise<void>;
  updateRequestStatus: (requestId: string, status: string, resolutionNotes?: string) => Promise<boolean>;
  createQrLocation: (payload: { locationType: "ROOM" | "TABLE"; roomId?: string; tableId?: string; label: string }) => Promise<boolean>;
  rotateQrLocation: (id: string) => Promise<boolean>;
}

export const useHotelQrPortalStore = create<HotelQrPortalState>((set, get) => ({
  consoleTab: "SERVICE_QUEUE",
  serviceCategory: "ALL",
  serviceStatus: "ALL",
  serviceRequests: [],
  qrLocations: [],
  rooms: [],
  tables: [],
  loading: false,
  actionLoadingId: null,
  error: null,

  setConsoleTab: (consoleTab) => set({ consoleTab }),
  setServiceCategory: (serviceCategory) => {
    set({ serviceCategory });
    get().loadAll();
  },
  setServiceStatus: (serviceStatus) => {
    set({ serviceStatus });
    get().loadAll();
  },

  loadAll: async () => {
    try {
      set({ loading: true, error: null });
      const { serviceStatus, serviceCategory } = get();
      const [reqs, locs, rms, tblsData] = await Promise.all([
        hotelRepository.fetchServiceRequests({
          status: serviceStatus !== "ALL" ? serviceStatus : undefined,
          category: serviceCategory !== "ALL" ? serviceCategory : undefined,
        }),
        hotelRepository.fetchQrLocations(),
        hotelRepository.fetchRooms(),
        apiClient.restaurant.getTables().catch(() => ({ tables: [] })),
      ]);
      set({
        serviceRequests: reqs,
        qrLocations: locs,
        rooms: rms,
        tables: tblsData.tables || [],
        loading: false,
      });
    } catch (err: any) {
      console.error("Failed to load QR portal data:", err);
      set({ error: err.message || "Failed to load QR portal data", loading: false });
    }
  },

  updateRequestStatus: async (requestId, status, resolutionNotes) => {
    try {
      set({ actionLoadingId: requestId });
      await hotelRepository.updateServiceRequest(requestId, { status, resolutionNotes });
      Notify.success(`Request marked as ${status}`);
      await get().loadAll();
      return true;
    } catch (err: any) {
      console.error("Failed to update request:", err);
      Notify.error(err.message || "Failed to update request status");
      return false;
    } finally {
      set({ actionLoadingId: null });
    }
  },

  createQrLocation: async (payload) => {
    try {
      set({ actionLoadingId: "new-qr" });
      await hotelRepository.createQrLocation(payload);
      Notify.success("QR Plaque created successfully");
      await get().loadAll();
      return true;
    } catch (err: any) {
      console.error("Failed to create QR location:", err);
      Notify.error(err.message || "Failed to create QR location");
      return false;
    } finally {
      set({ actionLoadingId: null });
    }
  },

  rotateQrLocation: async (id) => {
    try {
      set({ actionLoadingId: id });
      await hotelRepository.rotateQrLocation(id);
      Notify.success("QR Code rotated with new cryptographic token");
      await get().loadAll();
      return true;
    } catch (err: any) {
      console.error("Failed to rotate QR location:", err);
      Notify.error(err.message || "Failed to rotate QR code");
      return false;
    } finally {
      set({ actionLoadingId: null });
    }
  },
}));

