import { apiClient } from "@/core/api/api-client";
import { CustomerRecord, SupplierRecord } from "../models/crm.types";

export class CrmRepository {
  // Customers
  async fetchCustomers(search?: string): Promise<CustomerRecord[]> {
    const res = await apiClient.customer.searchCustomers(search);
    return res.customers || (Array.isArray(res) ? res : []);
  }

  async createCustomer(payload: any): Promise<any> {
    return apiClient.customer.createCustomer(payload);
  }

  async updateCustomer(id: string, payload: any): Promise<any> {
    return apiClient.customer.updateCustomer(id, payload);
  }

  async deleteCustomer(id: string): Promise<any> {
    return apiClient.customer.deleteCustomer(id);
  }

  // Suppliers
  async fetchSuppliers(params?: { search?: string; limit?: number }): Promise<SupplierRecord[]> {
    const res = await apiClient.customer.getSuppliers(params);
    return res.suppliers || (Array.isArray(res) ? res : []);
  }

  async createSupplier(payload: any): Promise<any> {
    return apiClient.customer.createSupplier(payload);
  }

  async updateSupplier(id: string, payload: any): Promise<any> {
    return apiClient.customer.updateSupplier(id, payload);
  }

  async deleteSupplier(id: string): Promise<any> {
    return apiClient.customer.deleteSupplier(id);
  }
}

export const crmRepository = new CrmRepository();

