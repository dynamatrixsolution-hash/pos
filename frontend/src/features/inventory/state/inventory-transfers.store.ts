import { create } from "zustand";
import { StockTransfer, TransferStatus } from "../models/inventory.types";
import { inventoryRepository } from "../repositories/inventory.repository";
import { apiClient } from "@/core/api/api-client";

interface InventoryTransfersState {
  transfers: StockTransfer[];
  branches: Array<{ id: string; name: string }>;
  products: any[];
  stockOverview: any[];
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;

  // Filters
  search: string;
  selectedStatus: string;
  sourceBranchFilter: string;
  destinationBranchFilter: string;

  // Modals & Active View/Action Targets
  isCreateModalOpen: boolean;
  selectedTransferForView: StockTransfer | null;
  selectedTransferForAction: {
    transfer: StockTransfer;
    action: "APPROVE" | "REJECT" | "DISPATCH" | "RECEIVE" | "CANCEL";
  } | null;

  // Setters
  setSearch: (q: string) => void;
  setSelectedStatus: (st: string) => void;
  setSourceBranchFilter: (id: string) => void;
  setDestinationBranchFilter: (id: string) => void;

  openCreateModal: () => void;
  closeCreateModal: () => void;
  setSelectedTransferForView: (t: StockTransfer | null) => void;
  setSelectedTransferForAction: (
    target: {
      transfer: StockTransfer;
      action: "APPROVE" | "REJECT" | "DISPATCH" | "RECEIVE" | "CANCEL";
    } | null
  ) => void;

  // Actions
  loadInitialData: () => Promise<void>;
  loadTransfers: () => Promise<void>;
  createTransfer: (payload: any) => Promise<boolean>;
  executeTransferAction: (
    id: string,
    action: "APPROVE" | "REJECT" | "DISPATCH" | "RECEIVE" | "CANCEL",
    notes?: string,
    receivedItems?: any[]
  ) => Promise<boolean>;
}

export const useInventoryTransfersStore = create<InventoryTransfersState>((set, get) => ({
  transfers: [],
  branches: [],
  products: [],
  stockOverview: [],
  isLoading: false,
  isSaving: false,
  error: null,

  search: "",
  selectedStatus: "ALL",
  sourceBranchFilter: "ALL",
  destinationBranchFilter: "ALL",

  isCreateModalOpen: false,
  selectedTransferForView: null,
  selectedTransferForAction: null,

  setSearch: (search) => set({ search }),
  setSelectedStatus: (selectedStatus) => {
    set({ selectedStatus });
    get().loadTransfers();
  },
  setSourceBranchFilter: (sourceBranchFilter) => set({ sourceBranchFilter }),
  setDestinationBranchFilter: (destinationBranchFilter) => set({ destinationBranchFilter }),

  openCreateModal: () => set({ isCreateModalOpen: true }),
  closeCreateModal: () => set({ isCreateModalOpen: false }),
  setSelectedTransferForView: (selectedTransferForView) => set({ selectedTransferForView }),
  setSelectedTransferForAction: (selectedTransferForAction) => set({ selectedTransferForAction }),

  loadInitialData: async () => {
    try {
      const [branchesRes, productsRes, stockRes] = await Promise.all([
        apiClient.product.getBranches(),
        apiClient.product.getProducts({ limit: 500 }),
        apiClient.inventory.getCurrentStock(),
      ]);

      const branches = branchesRes?.branches || branchesRes || [];
      const products = productsRes?.products || [];
      const stockOverview = stockRes?.stock || [];

      set({ branches, products, stockOverview });
      await get().loadTransfers();
    } catch (err: any) {
      set({ error: err.message || "Failed to load master metadata" });
    }
  },

  loadTransfers: async () => {
    set({ isLoading: true, error: null });
    try {
      const { selectedStatus } = get();
      const transfers = await inventoryRepository.fetchTransfers({
        status: selectedStatus !== "ALL" ? selectedStatus : undefined,
      });
      set({ transfers: Array.isArray(transfers) ? transfers : [], isLoading: false });
    } catch (err: any) {
      set({ isLoading: false, error: err.message || "Failed to load transfers" });
    }
  },

  createTransfer: async (payload) => {
    set({ isSaving: true, error: null });
    try {
      await inventoryRepository.createTransfer(payload);
      await get().loadTransfers();
      set({ isSaving: false, isCreateModalOpen: false });
      return true;
    } catch (err: any) {
      set({ isSaving: false, error: err.message || "Failed to create transfer" });
      return false;
    }
  },

  executeTransferAction: async (id, action, notes, receivedItems) => {
    set({ isSaving: true, error: null });
    try {
      await inventoryRepository.updateTransferStatus(id, { action, notes, receivedItems });
      await get().loadTransfers();
      set({ isSaving: false, selectedTransferForAction: null, selectedTransferForView: null });
      return true;
    } catch (err: any) {
      set({ isSaving: false, error: err.message || "Failed to update transfer status" });
      return false;
    }
  },
}));

