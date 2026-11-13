import { create } from "zustand";
import { ExpenseRecord } from "../models/financials.types";
import { financialsRepository } from "../repositories/financials.repository";
import { apiClient } from "@/core/api/api-client";

interface ExpensesState {
  activeTab: "EXPENSE" | "INCOME";
  records: ExpenseRecord[];
  categories: Array<{ id: string; name: string }>;
  branches: Array<{ id: string; name: string }>;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;

  // Filters
  search: string;
  categoryFilter: string;
  branchFilter: string;

  // Modal
  isCreateModalOpen: boolean;

  // Actions
  setActiveTab: (tab: "EXPENSE" | "INCOME") => void;
  setSearch: (q: string) => void;
  setCategoryFilter: (cId: string) => void;
  setBranchFilter: (bId: string) => void;

  openCreateModal: () => void;
  closeCreateModal: () => void;

  loadInitialData: () => Promise<void>;
  loadRecords: () => Promise<void>;
  createRecord: (payload: any) => Promise<boolean>;
}

export const useExpensesStore = create<ExpensesState>((set, get) => ({
  activeTab: "EXPENSE",
  records: [],
  categories: [],
  branches: [],
  isLoading: false,
  isSaving: false,
  error: null,

  search: "",
  categoryFilter: "ALL",
  branchFilter: "ALL",

  isCreateModalOpen: false,

  setActiveTab: (activeTab) => {
    set({ activeTab });
    get().loadRecords();
  },
  setSearch: (search) => set({ search }),
  setCategoryFilter: (categoryFilter) => {
    set({ categoryFilter });
    get().loadRecords();
  },
  setBranchFilter: (branchFilter) => {
    set({ branchFilter });
    get().loadRecords();
  },

  openCreateModal: () => set({ isCreateModalOpen: true }),
  closeCreateModal: () => set({ isCreateModalOpen: false }),

  loadInitialData: async () => {
    try {
      const [branchesRes, catRes] = await Promise.all([
        apiClient.product.getBranches(),
        apiClient.product.getCategories().catch(() => ({ categories: [] })),
      ]);

      const branches = branchesRes?.branches || branchesRes || [];
      const categories = catRes?.categories || (Array.isArray(catRes) ? catRes : []);

      set({ branches, categories });
      await get().loadRecords();
    } catch (err: any) {
      set({ error: err.message || "Failed to load master metadata" });
    }
  },

  loadRecords: async () => {
    set({ isLoading: true, error: null });
    try {
      const { search, categoryFilter, branchFilter } = get();
      const res = await financialsRepository.fetchExpenses({
        search: search.trim() || undefined,
        categoryId: categoryFilter !== "ALL" ? categoryFilter : undefined,
        branchId: branchFilter !== "ALL" ? branchFilter : undefined,
      });
      set({ records: res.expenses, isLoading: false });
    } catch (err: any) {
      set({ isLoading: false, error: err.message || "Failed to load expenses" });
    }
  },

  createRecord: async (payload) => {
    set({ isSaving: true, error: null });
    try {
      await financialsRepository.recordExpense(payload);
      await get().loadRecords();
      set({ isSaving: false, isCreateModalOpen: false });
      return true;
    } catch (err: any) {
      set({ isSaving: false, error: err.message || "Failed to record expense" });
      return false;
    }
  },
}));

