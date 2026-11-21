import { create } from "zustand";
import { TenantBusiness, TenantStatus } from "../models/super-admin.types";
import { superAdminRepository } from "../repositories/super-admin.repository";

interface SuperAdminBusinessesState {
  businesses: TenantBusiness[];
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;

  // Filters
  search: string;
  statusFilter: string;
  planFilter: string;

  // Modals & Active Edit Target
  isModalOpen: boolean;
  editingBusiness: TenantBusiness | null;
  selectedBusinessForInspection: TenantBusiness | null;

  // Actions
  setSearch: (q: string) => void;
  setStatusFilter: (st: string) => void;
  setPlanFilter: (pl: string) => void;

  openCreateModal: () => void;
  closeModal: () => void;
  setEditingBusiness: (b: TenantBusiness | null) => void;
  setSelectedBusinessForInspection: (b: TenantBusiness | null) => void;

  loadBusinesses: () => Promise<void>;
  saveBusiness: (payload: any) => Promise<boolean>;
  updateStatus: (id: string, status: TenantStatus) => Promise<boolean>;
}

export const useSuperAdminBusinessesStore = create<SuperAdminBusinessesState>((set, get) => ({
  businesses: [],
  isLoading: false,
  isSaving: false,
  error: null,

  search: "",
  statusFilter: "ALL",
  planFilter: "ALL",

  isModalOpen: false,
  editingBusiness: null,
  selectedBusinessForInspection: null,

  setSearch: (search) => set({ search }),
  setStatusFilter: (statusFilter) => {
    set({ statusFilter });
    get().loadBusinesses();
  },
  setPlanFilter: (planFilter) => {
    set({ planFilter });
    get().loadBusinesses();
  },

  openCreateModal: () => set({ isModalOpen: true, editingBusiness: null }),
  closeModal: () => set({ isModalOpen: false, editingBusiness: null }),
  setEditingBusiness: (editingBusiness) => set({ editingBusiness, isModalOpen: Boolean(editingBusiness) }),
  setSelectedBusinessForInspection: (selectedBusinessForInspection) =>
    set({ selectedBusinessForInspection }),

  loadBusinesses: async () => {
    set({ isLoading: true, error: null });
    try {
      const { search, statusFilter, planFilter } = get();
      const res = await superAdminRepository.fetchBusinesses({
        search: search.trim() || undefined,
        status: statusFilter !== "ALL" ? statusFilter : undefined,
        plan: planFilter !== "ALL" ? planFilter : undefined,
      });
      set({ businesses: res.businesses, isLoading: false });
    } catch (err: any) {
      set({ isLoading: false, error: err.message || "Failed to load tenant businesses" });
    }
  },

  saveBusiness: async (payload) => {
    set({ isSaving: true, error: null });
    try {
      const editing = get().editingBusiness;
      if (editing) {
        await superAdminRepository.updateBusiness(editing.id, {
          action: "UPDATE_PROFILE",
          payload,
        });
      } else {
        await superAdminRepository.createBusiness(payload);
      }
      await get().loadBusinesses();
      set({ isSaving: false, isModalOpen: false, editingBusiness: null });
      return true;
    } catch (err: any) {
      set({ isSaving: false, error: err.message || "Failed to save business" });
      return false;
    }
  },

  updateStatus: async (id, status) => {
    set({ isSaving: true, error: null });
    try {
      const action = status === "SUSPENDED" ? "SUSPEND" : "ACTIVATE";
      const reason =
        status === "SUSPENDED"
          ? "Suspended by Super Admin from tenant directory"
          : "Reactivated by Super Admin from tenant directory";
      await superAdminRepository.updateBusiness(id, { action, payload: { reason } });
      await get().loadBusinesses();
      set({ isSaving: false });
      return true;
    } catch (err: any) {
      set({ isSaving: false, error: err.message || "Failed to update tenant status" });
      return false;
    }
  },
}));

