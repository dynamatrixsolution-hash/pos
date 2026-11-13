import { create } from "zustand";
import { reportsRepository } from "../repositories/reports.repository";

interface ReportsState {
  branches: any[];
  selectedBranchId: string;
  loading: boolean;
  error: string | null;

  // Actions
  setSelectedBranchId: (id: string) => void;
  loadBranches: () => Promise<void>;
}

export const useReportsStore = create<ReportsState>((set, get) => ({
  branches: [],
  selectedBranchId: "ALL",
  loading: false,
  error: null,

  setSelectedBranchId: (selectedBranchId) => set({ selectedBranchId }),

  loadBranches: async () => {
    try {
      const branches = await reportsRepository.fetchBranches();
      set({ branches });
    } catch (err: any) {
      console.error("Failed to load branches for reports:", err);
    }
  },
}));

