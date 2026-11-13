import { create } from "zustand";
import { financialsRepository } from "../repositories/financials.repository";

interface SalesState {
  sales: any[];
  isLoading: boolean;
  error: string | null;
  search: string;
  selectedSaleForInspection: any | null;

  setSearch: (q: string) => void;
  setSelectedSaleForInspection: (s: any | null) => void;
  loadSales: () => Promise<void>;
}

export const useSalesStore = create<SalesState>((set, get) => ({
  sales: [],
  isLoading: false,
  error: null,
  search: "",
  selectedSaleForInspection: null,

  setSearch: (search) => set({ search }),
  setSelectedSaleForInspection: (selectedSaleForInspection) =>
    set({ selectedSaleForInspection }),

  loadSales: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await financialsRepository.fetchSales({
        search: get().search.trim() || undefined,
        limit: 50,
      });
      set({ sales: res.sales, isLoading: false });
    } catch (err: any) {
      set({ isLoading: false, error: err.message || "Failed to load sales invoices" });
    }
  },
}));

