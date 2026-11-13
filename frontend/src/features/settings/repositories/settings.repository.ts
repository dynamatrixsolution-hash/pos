/**
 * Settings Feature Repository
 * Interacts exclusively with apiClient singleton
 */

import { apiClient } from "@/core/api/api-client";
import { BusinessSettings, BranchRecord, CbmsConfig } from "../models/settings.types";

export class SettingsRepository {
  async fetchSettings(): Promise<BusinessSettings> {
    const data = await apiClient.settings.getSettings();
    return data.settings || data;
  }

  async updateSettings(payload: Partial<BusinessSettings>): Promise<BusinessSettings> {
    const data = await apiClient.settings.updateSettings(payload);
    return data.settings || data;
  }

  async fetchBranches(): Promise<BranchRecord[]> {
    const data = await apiClient.settings.getBranches();
    return data.branches || [];
  }

  async createBranch(payload: Partial<BranchRecord>): Promise<BranchRecord> {
    const data = await apiClient.settings.createBranch(payload);
    return data.branch || data;
  }

  async updateBranch(id: string, payload: Partial<BranchRecord>): Promise<BranchRecord> {
    const data = await apiClient.settings.updateBranch(id, payload);
    return data.branch || data;
  }

  async deleteBranch(id: string): Promise<boolean> {
    const data = await apiClient.settings.deleteBranch(id);
    return data.success !== false;
  }

  async fetchCbmsConfig(): Promise<CbmsConfig> {
    const data = await apiClient.settings.getCbmsConfig();
    return data.config || data;
  }

  async updateCbmsConfig(payload: Partial<CbmsConfig>): Promise<CbmsConfig> {
    const data = await apiClient.settings.updateCbmsConfig(payload);
    return data.config || data;
  }

  async testIrdConnection(): Promise<{ success: boolean; message: string }> {
    return await apiClient.settings.testIrdConnection();
  }

  async fetchFiscalYear(): Promise<any> {
    return await apiClient.settings.getFiscalYear();
  }

  async updateFiscalYear(payload: any): Promise<any> {
    return await apiClient.settings.updateFiscalYear(payload);
  }

  async fetchAuditLogs(params?: { limit?: number; page?: number; search?: string }) {
    return await apiClient.settings.getAuditLogs(params);
  }
}

export const settingsRepository = new SettingsRepository();

