import { create } from "zustand";
import { PurchaseBill, PurchaseBillItem } from "../models/financials.types";
import { financialsRepository } from "../repositories/financials.repository";
import { apiClient } from "@/core/api/api-client";

interface PurchasesState {
  purchases: PurchaseBill[];
  suppliers: any[];
  branches: any[];
  products: any[];
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;

  // Filters
  search: string;
  supplierFilter: string;
  branchFilter: string;

  // Modals
  isCreateModalOpen: boolean;
  selectedPurchaseForView: PurchaseBill | null;

  // Setters
  setSearch: (q: string) => void;
  setSupplierFilter: (sId: string) => void;
  setBranchFilter: (bId: string) => void;

  openCreateModal: () => void;
  closeCreateModal: () => void;
  setSelectedPurchaseForView: (p: PurchaseBill | null) => void;

  // Actions
  loadInitialData: () => Promise<void>;
  loadPurchases: () => Promise<void>;
  createPurchase: (payload: any) => Promise<boolean>;
}

export const usePurchasesStore = create<PurchasesState>((set, get) => ({
  purchases: [],
  suppliers: [],
  branches: [],
  products: [],
  isLoading: false,
  isSaving: false,
  error: null,

  search: "",
  supplierFilter: "ALL",
  branchFilter: "ALL",

  isCreateModalOpen: false,
  selectedPurchaseForView: null,

  setSearch: (search) => set({ search }),
  setSupplierFilter: (supplierFilter) => {
    set({ supplierFilter });
    get().loadPurchases();
  },
  setBranchFilter: (branchFilter) => {
    set({ branchFilter });
    get().loadPurchases();
  },

  openCreateModal: () => set({ isCreateModalOpen: true }),
  closeCreateModal: () => set({ isCreateModalOpen: false }),
  setSelectedPurchaseForView: (selectedPurchaseForView) => set({ selectedPurchaseForView }),

  loadInitialData: async () => {
    try {
      const [branchesRes, suppRes, prodRes] = await Promise.all([
        apiClient.product.getBranches(),
        apiClient.customer.getSuppliers({ limit: 500 }).catch(() => ({ suppliers: [] })),
        apiClient.product.getProducts({ limit: 500 }),
      ]);

      const branches = branchesRes?.branches || branchesRes || [];
      const suppliers = suppRes?.suppliers || [];
      const products = prodRes?.products || [];

      set({ branches, suppliers, products });
      await get().loadPurchases();
    } catch (err: any) {
      set({ error: err.message || "Failed to load master purchase metadata" });
    }
  },

  loadPurchases: async () => {
    set({ isLoading: true, error: null });
    try {
      const { search, supplierFilter, branchFilter } = get();
      const res = await financialsRepository.fetchPurchases({
        search: search.trim() || undefined,
        supplierId: supplierFilter !== "ALL" ? supplierFilter : undefined,
        branchId: branchFilter !== "ALL" ? branchFilter : undefined,
      });
      set({ purchases: res.purchases, isLoading: false });
    } catch (err: any) {
      set({ isLoading: false, error: err.message || "Failed to load purchases" });
    }
  },

  createPurchase: async (payload) => {
    set({ isSaving: true, error: null });
    try {
      await financialsRepository.recordPurchase(payload);
      await get().loadPurchases();
      set({ isSaving: false, isCreateModalOpen: false });
      return true;
    } catch (err: any) {
      set({ isSaving: false, error: err.message || "Failed to create purchase order" });
      return false;
    }
  },
}));

