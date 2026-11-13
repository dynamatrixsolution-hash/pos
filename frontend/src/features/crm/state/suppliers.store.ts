import { create } from "zustand";
import { SupplierRecord } from "../models/crm.types";
import { crmRepository } from "../repositories/crm.repository";

interface SuppliersState {
  suppliers: SupplierRecord[];
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;

  // Filters
  search: string;

  // Modal & Edit
  isModalOpen: boolean;
  editingSupplier: SupplierRecord | null;
  deletingSupplierId: string | null;

  // Actions
  setSearch: (q: string) => void;
  openCreateModal: () => void;
  closeModal: () => void;
  setEditingSupplier: (supplier: SupplierRecord | null) => void;
  setDeletingSupplierId: (id: string | null) => void;

  loadSuppliers: () => Promise<void>;
  saveSupplier: (payload: any) => Promise<boolean>;
  deleteSupplier: (id: string) => Promise<boolean>;
}

export const useSuppliersStore = create<SuppliersState>((set, get) => ({
  suppliers: [],
  isLoading: false,
  isSaving: false,
  error: null,

  search: "",

  isModalOpen: false,
  editingSupplier: null,
  deletingSupplierId: null,

  setSearch: (search) => set({ search }),

  openCreateModal: () => set({ isModalOpen: true, editingSupplier: null }),
  closeModal: () => set({ isModalOpen: false, editingSupplier: null }),
  setEditingSupplier: (editingSupplier) => set({ editingSupplier, isModalOpen: Boolean(editingSupplier) }),
  setDeletingSupplierId: (deletingSupplierId) => set({ deletingSupplierId }),

  loadSuppliers: async () => {
    set({ isLoading: true, error: null });
    try {
      const suppliers = await crmRepository.fetchSuppliers({
        search: get().search.trim() || undefined,
      });
      set({ suppliers, isLoading: false });
    } catch (err: any) {
      set({ isLoading: false, error: err.message || "Failed to load suppliers" });
    }
  },

  saveSupplier: async (payload) => {
    set({ isSaving: true, error: null });
    try {
      const editing = get().editingSupplier;
      if (editing) {
        await crmRepository.updateSupplier(editing.id, payload);
      } else {
        await crmRepository.createSupplier(payload);
      }
      await get().loadSuppliers();
      set({ isSaving: false, isModalOpen: false, editingSupplier: null });
      return true;
    } catch (err: any) {
      set({ isSaving: false, error: err.message || "Failed to save supplier" });
      return false;
    }
  },

  deleteSupplier: async (id) => {
    set({ isSaving: true, error: null });
    try {
      await crmRepository.deleteSupplier(id);
      await get().loadSuppliers();
      set({ isSaving: false, deletingSupplierId: null });
      return true;
    } catch (err: any) {
      set({ isSaving: false, error: err.message || "Failed to delete supplier" });
      return false;
    }
  },
}));

