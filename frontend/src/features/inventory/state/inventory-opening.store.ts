import { create } from "zustand";
import { OpeningStockEntry } from "../models/inventory.types";
import { inventoryRepository } from "../repositories/inventory.repository";
import { apiClient } from "@/core/api/api-client";

interface InventoryOpeningState {
  entries: OpeningStockEntry[];
  branches: Array<{ id: string; name: string }>;
  products: any[];
  suppliers: any[];
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;

  // Filters
  search: string;
  selectedBranch: string;
  selectedStatus: string;

  // Modals & Active Edit Target
  isCreateModalOpen: boolean;
  editingEntry: OpeningStockEntry | null;
  deletingEntryId: string | null;
  actionConfirmEntry: { entry: OpeningStockEntry; action: "APPROVE" | "REJECT" } | null;

  // Actions
  setSearch: (q: string) => void;
  setSelectedBranch: (branchId: string) => void;
  setSelectedStatus: (status: string) => void;

  openCreateModal: () => void;
  closeCreateModal: () => void;
  setEditingEntry: (entry: OpeningStockEntry | null) => void;
  setDeletingEntryId: (id: string | null) => void;
  setActionConfirmEntry: (target: { entry: OpeningStockEntry; action: "APPROVE" | "REJECT" } | null) => void;

  loadInitialData: () => Promise<void>;
  loadEntries: () => Promise<void>;
  saveEntry: (payload: any) => Promise<boolean>;
  deleteEntry: (id: string) => Promise<boolean>;
  updateApprovalStatus: (id: string, status: "APPROVED" | "REJECTED", reason?: string) => Promise<boolean>;
}

export const useInventoryOpeningStore = create<InventoryOpeningState>((set, get) => ({
  entries: [],
  branches: [],
  products: [],
  suppliers: [],
  isLoading: false,
  isSaving: false,
  error: null,

  search: "",
  selectedBranch: "",
  selectedStatus: "ALL",

  isCreateModalOpen: false,
  editingEntry: null,
  deletingEntryId: null,
  actionConfirmEntry: null,

  setSearch: (search) => set({ search }),
  setSelectedBranch: (selectedBranch) => {
    set({ selectedBranch });
    get().loadEntries();
  },
  setSelectedStatus: (selectedStatus) => {
    set({ selectedStatus });
    get().loadEntries();
  },

  openCreateModal: () => set({ isCreateModalOpen: true, editingEntry: null }),
  closeCreateModal: () => set({ isCreateModalOpen: false, editingEntry: null }),
  setEditingEntry: (editingEntry) => set({ editingEntry, isCreateModalOpen: Boolean(editingEntry) }),
  setDeletingEntryId: (deletingEntryId) => set({ deletingEntryId }),
  setActionConfirmEntry: (actionConfirmEntry) => set({ actionConfirmEntry }),

  loadInitialData: async () => {
    try {
      const [branchesRes, productsRes, suppliersRes] = await Promise.all([
        apiClient.product.getBranches(),
        apiClient.product.getProducts({ limit: 500 }),
        apiClient.customer.getSuppliers({ limit: 500 }).catch(() => ({ suppliers: [] })),
      ]);

      const branches = branchesRes?.branches || branchesRes || [];
      const products = productsRes?.products || [];
      const suppliers = suppliersRes?.suppliers || [];

      set({ branches, products, suppliers });
      await get().loadEntries();
    } catch (err: any) {
      set({ error: err.message || "Failed to load master metadata" });
    }
  },

  loadEntries: async () => {
    set({ isLoading: true, error: null });
    try {
      const { selectedBranch, selectedStatus, search } = get();
      const entries = await inventoryRepository.fetchOpeningStock({
        branchId: selectedBranch && selectedBranch !== "ALL" ? selectedBranch : undefined,
        status: selectedStatus && selectedStatus !== "ALL" ? selectedStatus : undefined,
        search: search.trim() || undefined,
      });
      set({ entries: Array.isArray(entries) ? entries : [], isLoading: false });
    } catch (err: any) {
      set({ isLoading: false, error: err.message || "Failed to load opening stock" });
    }
  },

  saveEntry: async (payload) => {
    set({ isSaving: true, error: null });
    try {
      const editing = get().editingEntry;
      if (editing) {
        await inventoryRepository.updateOpeningStock(editing.id, payload);
      } else {
        await inventoryRepository.createOpeningStock(payload);
      }
      await get().loadEntries();
      set({ isSaving: false, isCreateModalOpen: false, editingEntry: null });
      return true;
    } catch (err: any) {
      set({ isSaving: false, error: err.message || "Failed to save entry" });
      return false;
    }
  },

  deleteEntry: async (id) => {
    set({ isSaving: true, error: null });
    try {
      await inventoryRepository.deleteOpeningStock(id);
      await get().loadEntries();
      set({ isSaving: false, deletingEntryId: null });
      return true;
    } catch (err: any) {
      set({ isSaving: false, error: err.message || "Failed to delete entry" });
      return false;
    }
  },

  updateApprovalStatus: async (id, status, reason) => {
    set({ isSaving: true, error: null });
    try {
      await inventoryRepository.updateOpeningStock(id, { approvalStatus: status, reason });
      await get().loadEntries();
      set({ isSaving: false, actionConfirmEntry: null });
      return true;
    } catch (err: any) {
      set({ isSaving: false, error: err.message || "Failed to update status" });
      return false;
    }
  },
}));
