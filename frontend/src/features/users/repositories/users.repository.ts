/**
 * Users Feature Repository
 * Interacts exclusively with apiClient singleton
 */

import { apiClient } from "@/core/api/api-client";
import { UserRoleRecord, UserDeviceRecord, UserActivityLog } from "../models/users.types";

export class UsersRepository {
  async fetchUsers(params?: { role?: string; search?: string }) {
    const data = await apiClient.users.getUsers(params);
    return data.users || [];
  }

  async createUser(payload: any) {
    return await apiClient.users.createUser(payload);
  }

  async updateUser(id: string, payload: any) {
    return await apiClient.users.updateUser(id, payload);
  }

  async deleteUser(id: string) {
    return await apiClient.users.deleteUser(id);
  }

  async fetchRoles(): Promise<UserRoleRecord[]> {
    const data = await apiClient.users.getRoles();
    return data.roles || data || [];
  }

  async createRole(payload: any): Promise<UserRoleRecord> {
    const data = await apiClient.users.createRole(payload);
    return data.role || data;
  }

  async updateRole(id: string, payload: any): Promise<UserRoleRecord> {
    const data = await apiClient.users.updateRole(id, payload);
    return data.role || data;
  }

  async deleteRole(id: string): Promise<boolean> {
    const data = await apiClient.users.deleteRole(id);
    return data.success !== false;
  }

  async fetchDevices(): Promise<UserDeviceRecord[]> {
    const data = await apiClient.users.getDevices();
    return data.devices || data || [];
  }

  async revokeDevice(id: string): Promise<boolean> {
    const data = await apiClient.users.revokeDevice(id);
    return data.success !== false;
  }

  async fetchUserActivity(params?: any): Promise<UserActivityLog[]> {
    const data = await apiClient.users.getUserActivity(params);
    return data.activities || data.logs || data || [];
  }
}

export const usersRepository = new UsersRepository();

