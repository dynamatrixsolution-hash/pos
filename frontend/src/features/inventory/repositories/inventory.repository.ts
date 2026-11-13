/**
 * Inventory Feature Repository
 * Interacts exclusively with apiClient
 */

import { apiClient } from "@/core/api/api-client";
import { InventoryItem, InventoryMetrics, BranchOption } from "../models/inventory.types";

export class InventoryRepository {
  async fetchInventory(params?: { search?: string; lowStock?: boolean; branchId?: string }): Promise<{
    inventory: InventoryItem[];
    metrics: InventoryMetrics;
    branches: BranchOption[];
    isOwner: boolean;
  }> {
    const data = await apiClient.inventory.getInventory(params);
    return {
      inventory: data.inventory || [],
      metrics: data.metrics || { totalValuation: 0, lowStockCount: 0, totalItems: 0 },
      branches: data.branches || [],
      isOwner: Boolean(data.isOwner),
    };
  }

  async submitStockAdjustment(payload: {
    productId: string;
    branchId?: string;
    type: "STOCK_IN" | "STOCK_OUT" | "DAMAGE" | "CORRECTION";
    quantity: number;
    notes?: string;
  }): Promise<boolean> {
    const res = await apiClient.inventory.adjustStock(payload);
    return res.success;
  }

  // Opening Stock
  async fetchOpeningStock(params?: { branchId?: string; status?: string; search?: string }) {
    const res = await apiClient.inventory.getOpeningStock(params);
    return res.entries || (Array.isArray(res) ? res : []);
  }

  async createOpeningStock(payload: any) {
    return apiClient.inventory.createOpeningStock(payload);
  }

  async updateOpeningStock(id: string, payload: any) {
    return apiClient.inventory.updateOpeningStock(id, payload);
  }

  async deleteOpeningStock(id: string) {
    return apiClient.inventory.deleteOpeningStock(id);
  }

  // Stock Transfers
  async fetchTransfers(params?: { status?: string }) {
    const res = await apiClient.inventory.getTransfers(params);
    return res.transfers || (Array.isArray(res) ? res : []);
  }

  async createTransfer(payload: any) {
    return apiClient.inventory.createTransfer(payload);
  }

  async updateTransferStatus(id: string, payload: any) {
    return apiClient.inventory.updateTransferStatus(id, payload);
  }
}

export const inventoryRepository = new InventoryRepository();

