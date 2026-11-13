import { apiClient } from "@/core/api/api-client";
import { TenantBusiness, PlatformModule, PlatformActivityLog } from "../models/super-admin.types";

export class SuperAdminRepository {
  async fetchBusinesses(params?: {
    search?: string;
    status?: string;
    plan?: string;
    page?: number;
    limit?: number;
  }): Promise<{ businesses: TenantBusiness[]; totalCount: number }> {
    const res = await apiClient.superAdmin.getBusinesses(params);
    return {
      businesses: res.businesses || (Array.isArray(res) ? res : []),
      totalCount: res.totalCount || res.businesses?.length || 0,
    };
  }

  async createBusiness(payload: any): Promise<any> {
    return apiClient.superAdmin.createBusiness(payload);
  }

  async updateBusiness(id: string, payload: any): Promise<any> {
    return apiClient.superAdmin.updateBusiness(id, payload);
  }

  async fetchModules(): Promise<PlatformModule[]> {
    const res = await apiClient.superAdmin.getModules();
    return res.modules || (Array.isArray(res) ? res : []);
  }

  async toggleModule(businessId: string, moduleKey: string, enabled: boolean): Promise<any> {
    return apiClient.superAdmin.toggleBusinessModule({ businessId, moduleKey, enabled });
  }

  async fetchActivityLogs(params?: { search?: string; page?: number }): Promise<PlatformActivityLog[]> {
    const res = await apiClient.superAdmin.getActivityLogs(params);
    return res.logs || (Array.isArray(res) ? res : []);
  }
}

export const superAdminRepository = new SuperAdminRepository();

