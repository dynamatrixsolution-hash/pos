import { create } from "zustand";
import { CustomerRecord } from "../models/crm.types";
import { crmRepository } from "../repositories/crm.repository";

interface CustomersState {
  customers: CustomerRecord[];
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;

  // Filters
  search: string;

  // Modal & Edit
  isModalOpen: boolean;
  editingCustomer: CustomerRecord | null;
  deletingCustomerId: string | null;

  // Actions
  setSearch: (q: string) => void;
  openCreateModal: () => void;
  closeModal: () => void;
  setEditingCustomer: (customer: CustomerRecord | null) => void;
  setDeletingCustomerId: (id: string | null) => void;

  loadCustomers: () => Promise<void>;
  saveCustomer: (payload: any) => Promise<boolean>;
  deleteCustomer: (id: string) => Promise<boolean>;
}

export const useCustomersStore = create<CustomersState>((set, get) => ({
  customers: [],
  isLoading: false,
  isSaving: false,
  error: null,

  search: "",

  isModalOpen: false,
  editingCustomer: null,
  deletingCustomerId: null,

  setSearch: (search) => set({ search }),

  openCreateModal: () => set({ isModalOpen: true, editingCustomer: null }),
  closeModal: () => set({ isModalOpen: false, editingCustomer: null }),
  setEditingCustomer: (editingCustomer) => set({ editingCustomer, isModalOpen: Boolean(editingCustomer) }),
  setDeletingCustomerId: (deletingCustomerId) => set({ deletingCustomerId }),

  loadCustomers: async () => {
    set({ isLoading: true, error: null });
    try {
      const customers = await crmRepository.fetchCustomers(get().search.trim() || undefined);
      set({ customers, isLoading: false });
    } catch (err: any) {
      set({ isLoading: false, error: err.message || "Failed to load customers" });
    }
  },

  saveCustomer: async (payload) => {
    set({ isSaving: true, error: null });
    try {
      const editing = get().editingCustomer;
      if (editing) {
        await crmRepository.updateCustomer(editing.id, payload);
      } else {
        await crmRepository.createCustomer(payload);
      }
      await get().loadCustomers();
      set({ isSaving: false, isModalOpen: false, editingCustomer: null });
      return true;
    } catch (err: any) {
      set({ isSaving: false, error: err.message || "Failed to save customer" });
      return false;
    }
  },

  deleteCustomer: async (id) => {
    set({ isSaving: true, error: null });
    try {
      await crmRepository.deleteCustomer(id);
      await get().loadCustomers();
      set({ isSaving: false, deletingCustomerId: null });
      return true;
    } catch (err: any) {
      set({ isSaving: false, error: err.message || "Failed to delete customer" });
      return false;
    }
  },
}));

