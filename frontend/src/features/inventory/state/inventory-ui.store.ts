/**
 * Inventory UI State Store
 * Controls active filters, search, and adjustment modal
 */

import { create } from "zustand";
import { InventoryItem } from "../models/inventory.types";

interface InventoryUiState {
  search: string;
  lowStockOnly: boolean;
  selectedBranchId: string;
  isAdjustmentModalOpen: boolean;
  selectedProductForAdjustment: InventoryItem | null;

  setSearch: (search: string) => void;
  setLowStockOnly: (lowStockOnly: boolean) => void;
  setSelectedBranchId: (branchId: string) => void;
  openAdjustmentModal: (product: InventoryItem) => void;
  closeAdjustmentModal: () => void;
}

export const useInventoryUiStore = create<InventoryUiState>((set) => ({
  search: "",
  lowStockOnly: false,
  selectedBranchId: "",
  isAdjustmentModalOpen: false,
  selectedProductForAdjustment: null,

  setSearch: (search) => set({ search }),
  setLowStockOnly: (lowStockOnly) => set({ lowStockOnly }),
  setSelectedBranchId: (selectedBranchId) => set({ selectedBranchId }),
  openAdjustmentModal: (product) =>
    set({ isAdjustmentModalOpen: true, selectedProductForAdjustment: product }),
  closeAdjustmentModal: () =>
    set({ isAdjustmentModalOpen: false, selectedProductForAdjustment: null }),
}));

