/**
 * Inventory Stock Store
 * Clean Architecture MVVM ViewModel for Stock Items & Valuation Metrics
 */

import { create } from "zustand";
import { InventoryItem, InventoryMetrics, BranchOption } from "../models/inventory.types";
import { inventoryRepository } from "../repositories/inventory.repository";
import { useInventoryUiStore } from "./inventory-ui.store";
import { Notify } from "@/lib/notify";

interface InventoryStockState {
  inventory: InventoryItem[];
  metrics: InventoryMetrics;
  branches: BranchOption[];
  isOwner: boolean;
  loading: boolean;
  submittingAdjustment: boolean;

  loadInventory: () => Promise<void>;
  submitAdjustment: (payload: {
    productId: string;
    branchId?: string;
    type: "STOCK_IN" | "STOCK_OUT" | "DAMAGE" | "CORRECTION";
    quantity: number;
    notes?: string;
  }) => Promise<boolean>;
}

export const useInventoryStockStore = create<InventoryStockState>((set, get) => ({
  inventory: [],
  metrics: {
    totalValuation: 0,
    lowStockCount: 0,
    totalItems: 0,
  },
  branches: [],
  isOwner: false,
  loading: true,
  submittingAdjustment: false,

  loadInventory: async () => {
    set({ loading: true });
    try {
      const ui = useInventoryUiStore.getState();
      const res = await inventoryRepository.fetchInventory({
        search: ui.search,
        lowStock: ui.lowStockOnly,
        branchId: ui.selectedBranchId || undefined,
      });

      set({
        inventory: res.inventory,
        metrics: res.metrics,
        branches: res.branches,
        isOwner: res.isOwner,
        loading: false,
      });
    } catch (err: any) {
      Notify.failure(err.message || "Failed to load inventory stock");
      set({ loading: false });
    }
  },

  submitAdjustment: async (payload) => {
    set({ submittingAdjustment: true });
    try {
      await inventoryRepository.submitStockAdjustment(payload);
      Notify.success("Stock adjustment registered successfully");
      useInventoryUiStore.getState().closeAdjustmentModal();
      await get().loadInventory();
      return true;
    } catch (err: any) {
      Notify.failure(err.message || "Failed to adjust stock");
      return false;
    } finally {
      set({ submittingAdjustment: false });
    }
  },
}));

