/**
 * POS Catalog Store
 * Manages floors, tables, menu categories, and search filters.
 */

import { create } from "zustand";
import { Floor, SpaceTable, MenuItemWithModifiers, SpaceCategory } from "../models/pos.types";
import { restaurantPosRepository } from "../repositories/restaurant-pos.repository";

interface PosCatalogState {
  floors: Floor[];
  tables: SpaceTable[];
  catalog: MenuItemWithModifiers[];
  categories: any[];
  isLoading: boolean;
  error: string | null;

  // Space Filters
  selectedFloorId: string;
  selectedSpaceType: SpaceCategory;
  selectedStatusFilter: string;
  spaceSearchQuery: string;

  // Menu Filters
  selectedParentCategory: string;
  selectedSubcategoryId: string;
  menuSearchQuery: string;

  // Actions
  loadInitialCatalog: () => Promise<void>;
  refreshTables: () => Promise<void>;
  resetSpaceFilters: () => void;
  setSelectedFloorId: (id: string) => void;
  setSelectedSpaceType: (cat: SpaceCategory) => void;
  setSelectedStatusFilter: (status: string) => void;
  setSpaceSearchQuery: (q: string) => void;
  setSelectedParentCategory: (cat: string) => void;
  setSelectedSubcategoryId: (sub: string) => void;
  setMenuSearchQuery: (q: string) => void;
  updateTableStatusLocally: (tableId: string, status: SpaceTable["status"], sessionId?: string | null) => void;
}

export const usePosCatalogStore = create<PosCatalogState>((set, get) => ({
  floors: [],
  tables: [],
  catalog: [],
  categories: [],
  isLoading: true,
  error: null,

  selectedFloorId: "ALL",
  selectedSpaceType: "ALL",
  selectedStatusFilter: "ALL",
  spaceSearchQuery: "",

  selectedParentCategory: "ALL",
  selectedSubcategoryId: "ALL",
  menuSearchQuery: "",

  loadInitialCatalog: async () => {
    try {
      set({ isLoading: true, error: null });
      const data = await restaurantPosRepository.fetchInitialData();
      set({
        floors: data.floors,
        tables: data.tables,
        catalog: data.catalog,
        categories: data.rawCategories,
        isLoading: false,
      });
    } catch (err: any) {
      set({ isLoading: false, error: err.message || "Failed to load catalog" });
    }
  },

  refreshTables: async () => {
    try {
      const tables = await restaurantPosRepository.fetchTables();
      set({ tables });
    } catch {
      // transient poll dropouts handled silently
    }
  },

  resetSpaceFilters: () =>
    set({
      selectedFloorId: "ALL",
      selectedSpaceType: "ALL",
      selectedStatusFilter: "ALL",
      spaceSearchQuery: "",
    }),

  setSelectedFloorId: (selectedFloorId) => set({ selectedFloorId }),
  setSelectedSpaceType: (selectedSpaceType) => set({ selectedSpaceType }),
  setSelectedStatusFilter: (selectedStatusFilter) => set({ selectedStatusFilter }),
  setSpaceSearchQuery: (spaceSearchQuery) => set({ spaceSearchQuery }),

  setSelectedParentCategory: (selectedParentCategory) =>
    set({ selectedParentCategory, selectedSubcategoryId: "ALL" }),
  setSelectedSubcategoryId: (selectedSubcategoryId) => set({ selectedSubcategoryId }),
  setMenuSearchQuery: (menuSearchQuery) => set({ menuSearchQuery }),

  updateTableStatusLocally: (tableId, status, sessionId) => {
    set((state) => ({
      tables: state.tables.map((t) =>
        t.id === tableId
          ? {
              ...t,
              status,
              ...(sessionId !== undefined ? { currentSessionId: sessionId } : {}),
            }
          : t
      ),
    }));
  },
}));

