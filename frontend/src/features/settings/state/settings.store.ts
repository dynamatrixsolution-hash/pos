import { create } from "zustand";
import { BusinessSettings, BranchRecord, CbmsConfig } from "../models/settings.types";
import { settingsRepository } from "../repositories/settings.repository";
import { Notify } from "@/lib/notify";

interface SettingsState {
  settings: BusinessSettings | null;
  branches: BranchRecord[];
  cbmsConfig: CbmsConfig | null;
  loading: boolean;
  saving: boolean;
  error: string | null;

  loadSettings: () => Promise<void>;
  updateSettings: (payload: Partial<BusinessSettings>) => Promise<boolean>;
  loadBranches: () => Promise<void>;
  createBranch: (payload: Partial<BranchRecord>) => Promise<boolean>;
  updateBranch: (id: string, payload: Partial<BranchRecord>) => Promise<boolean>;
  deleteBranch: (id: string) => Promise<boolean>;
  loadCbmsConfig: () => Promise<void>;
  updateCbmsConfig: (payload: Partial<CbmsConfig>) => Promise<boolean>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: null,
  branches: [],
  cbmsConfig: null,
  loading: false,
  saving: false,
  error: null,

  loadSettings: async () => {
    try {
      set({ loading: true, error: null });
      const data = await settingsRepository.fetchSettings();
      set({ settings: data, loading: false });
    } catch (err: any) {
      console.error("Failed to load settings:", err);
      set({ error: err.message, loading: false });
    }
  },

  updateSettings: async (payload) => {
    try {
      set({ saving: true });
      const updated = await settingsRepository.updateSettings(payload);
      set({ settings: updated, saving: false });
      Notify.success("Settings updated successfully");
      return true;
    } catch (err: any) {
      console.error("Update settings error:", err);
      Notify.error(err.message || "Failed to update settings");
      set({ saving: false });
      return false;
    }
  },

  loadBranches: async () => {
    try {
      set({ loading: true, error: null });
      const branches = await settingsRepository.fetchBranches();
      set({ branches, loading: false });
    } catch (err: any) {
      console.error("Failed to load branches:", err);
      set({ error: err.message, loading: false });
    }
  },

  createBranch: async (payload) => {
    try {
      set({ saving: true });
      await settingsRepository.createBranch(payload);
      Notify.success("Branch created successfully");
      await get().loadBranches();
      return true;
    } catch (err: any) {
      console.error("Failed to create branch:", err);
      Notify.error(err.message || "Failed to create branch");
      return false;
    } finally {
      set({ saving: false });
    }
  },

  updateBranch: async (id, payload) => {
    try {
      set({ saving: true });
      await settingsRepository.updateBranch(id, payload);
      Notify.success("Branch updated successfully");
      await get().loadBranches();
      return true;
    } catch (err: any) {
      console.error("Failed to update branch:", err);
      Notify.error(err.message || "Failed to update branch");
      return false;
    } finally {
      set({ saving: false });
    }
  },

  deleteBranch: async (id) => {
    try {
      set({ saving: true });
      await settingsRepository.deleteBranch(id);
      Notify.success("Branch deleted successfully");
      await get().loadBranches();
      return true;
    } catch (err: any) {
      console.error("Failed to delete branch:", err);
      Notify.error(err.message || "Failed to delete branch");
      return false;
    } finally {
      set({ saving: false });
    }
  },

  loadCbmsConfig: async () => {
    try {
      set({ loading: true, error: null });
      const config = await settingsRepository.fetchCbmsConfig();
      set({ cbmsConfig: config, loading: false });
    } catch (err: any) {
      console.error("Failed to load CBMS config:", err);
      set({ error: err.message, loading: false });
    }
  },

  updateCbmsConfig: async (payload) => {
    try {
      set({ saving: true });
      const updated = await settingsRepository.updateCbmsConfig(payload);
      set({ cbmsConfig: updated, saving: false });
      Notify.success("CBMS credentials saved successfully");
      return true;
    } catch (err: any) {
      console.error("Failed to update CBMS config:", err);
      Notify.error(err.message || "Failed to save CBMS credentials");
      set({ saving: false });
      return false;
    }
  },
}));

