/**
 * Restaurant Tables & Floor Plans State Store
 * Clean MVVM ViewModel for Floors, Tables, Cabins, VIP rooms, and layout positioning
 */

import { create } from "zustand";
import { Floor, SpaceTable, SpaceCategory } from "../models/pos.types";
import { restaurantPosRepository } from "../repositories/restaurant-pos.repository";

interface RestaurantTablesState {
  floors: Floor[];
  tables: SpaceTable[];
  selectedFloorId: string;
  selectedCategory: SpaceCategory;
  search: string;

  isLoading: boolean;
  isSaving: boolean;
  error: string | null;

  // Modals & Selected entities
  editingFloor: Floor | null;
  editingTable: SpaceTable | null;
  qrTable: SpaceTable | null;

  isFloorModalOpen: boolean;
  isTableModalOpen: boolean;
  isQrModalOpen: boolean;

  // Actions
  setSelectedFloorId: (floorId: string) => void;
  setSelectedCategory: (category: SpaceCategory) => void;
  setSearch: (search: string) => void;
  loadTablesData: () => Promise<void>;

  openCreateFloorModal: () => void;
  openEditFloorModal: (floor: Floor) => void;
  closeFloorModal: () => void;
  saveFloor: (payload: { name: string; displayOrder?: number }) => Promise<boolean>;
  deleteFloor: (id: string) => Promise<boolean>;

  openCreateTableModal: (category?: SpaceCategory) => void;
  openEditTableModal: (table: SpaceTable) => void;
  closeTableModal: () => void;
  saveTable: (payload: any) => Promise<boolean>;
  deleteTable: (id: string) => Promise<boolean>;

  openQrModal: (table: SpaceTable) => void;
  closeQrModal: () => void;
}

export const useRestaurantTablesStore = create<RestaurantTablesState>((set, get) => ({
  floors: [],
  tables: [],
  selectedFloorId: "ALL",
  selectedCategory: "ALL",
  search: "",

  isLoading: false,
  isSaving: false,
  error: null,

  editingFloor: null,
  editingTable: null,
  qrTable: null,

  isFloorModalOpen: false,
  isTableModalOpen: false,
  isQrModalOpen: false,

  setSelectedFloorId: (selectedFloorId) => set({ selectedFloorId }),
  setSelectedCategory: (selectedCategory) => set({ selectedCategory }),
  setSearch: (search) => set({ search }),

  loadTablesData: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await restaurantPosRepository.fetchInitialData();
      set({
        floors: data.floors,
        tables: data.tables,
        isLoading: false,
      });
    } catch (err: any) {
      set({ error: err.message || "Failed to load tables and floors", isLoading: false });
    }
  },

  openCreateFloorModal: () => set({ editingFloor: null, isFloorModalOpen: true }),
  openEditFloorModal: (floor) => set({ editingFloor: floor, isFloorModalOpen: true }),
  closeFloorModal: () => set({ editingFloor: null, isFloorModalOpen: false }),

  saveFloor: async (payload) => {
    const { editingFloor } = get();
    set({ isSaving: true, error: null });
    try {
      if (editingFloor) {
        await restaurantPosRepository.updateFloor(editingFloor.id, payload);
      } else {
        await restaurantPosRepository.createFloor(payload);
      }
      await get().loadTablesData();
      set({ isSaving: false, isFloorModalOpen: false, editingFloor: null });
      return true;
    } catch (err: any) {
      set({ isSaving: false, error: err.message || "Failed to save floor" });
      return false;
    }
  },

  deleteFloor: async (id) => {
    set({ error: null });
    try {
      await restaurantPosRepository.deleteFloor(id);
      await get().loadTablesData();
      return true;
    } catch (err: any) {
      set({ error: err.message || "Failed to delete floor" });
      return false;
    }
  },

  openCreateTableModal: () => set({ editingTable: null, isTableModalOpen: true }),
  openEditTableModal: (table) => set({ editingTable: table, isTableModalOpen: true }),
  closeTableModal: () => set({ editingTable: null, isTableModalOpen: false }),

  saveTable: async (payload) => {
    const { editingTable } = get();
    set({ isSaving: true, error: null });
    try {
      if (editingTable) {
        await restaurantPosRepository.updateTable(editingTable.id, payload);
      } else {
        await restaurantPosRepository.createTable(payload);
      }
      await get().loadTablesData();
      set({ isSaving: false, isTableModalOpen: false, editingTable: null });
      return true;
    } catch (err: any) {
      set({ isSaving: false, error: err.message || "Failed to save table" });
      return false;
    }
  },

  deleteTable: async (id) => {
    set({ error: null });
    try {
      await restaurantPosRepository.deleteTable(id);
      set((state) => ({ tables: state.tables.filter((t) => t.id !== id) }));
      return true;
    } catch (err: any) {
      set({ error: err.message || "Failed to delete table" });
      return false;
    }
  },

  openQrModal: (table) => set({ qrTable: table, isQrModalOpen: true }),
  closeQrModal: () => set({ qrTable: null, isQrModalOpen: false }),
}));

