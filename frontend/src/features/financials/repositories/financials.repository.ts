import { apiClient } from "@/core/api/api-client";
import {
  PaymentRecord,
  PaymentType,
  PurchaseBill,
  ExpenseRecord,
} from "../models/financials.types";

export class FinancialsRepository {
  // Sales
  async fetchSales(params?: { search?: string; limit?: number; page?: number; startDate?: string; endDate?: string }): Promise<{ sales: any[]; totalCount: number }> {
    const res = await apiClient.financials.getSales(params);
    return {
      sales: res.sales || (Array.isArray(res) ? res : []),
      totalCount: res.totalCount || res.sales?.length || 0,
    };
  }

  // Payments (Received & Sent)
  async fetchPayments(params: {
    type: PaymentType;
    search?: string;
    customerId?: string;
    supplierId?: string;
    branchId?: string;
    method?: string;
    page?: number;
    limit?: number;
  }): Promise<{ payments: PaymentRecord[]; totalCount: number }> {
    const res = await apiClient.financials.getPayments(params);
    return {
      payments: res.payments || (Array.isArray(res) ? res : []),
      totalCount: res.totalCount || res.payments?.length || 0,
    };
  }

  async recordPayment(payload: any): Promise<any> {
    return apiClient.financials.createPayment(payload);
  }

  async reversePayment(id: string, reason?: string): Promise<any> {
    return apiClient.financials.reversePayment(id, reason);
  }

  // Purchases
  async fetchPurchases(params?: {
    search?: string;
    supplierId?: string;
    branchId?: string;
    page?: number;
    limit?: number;
  }): Promise<{ purchases: PurchaseBill[]; totalCount: number }> {
    const res = await apiClient.financials.getPurchases(params);
    return {
      purchases: res.purchases || (Array.isArray(res) ? res : []),
      totalCount: res.totalCount || res.purchases?.length || 0,
    };
  }

  async recordPurchase(payload: any): Promise<any> {
    return apiClient.financials.createPurchase(payload);
  }

  // Expenses
  async fetchExpenses(params?: {
    search?: string;
    categoryId?: string;
    branchId?: string;
    page?: number;
    limit?: number;
  }): Promise<{ expenses: ExpenseRecord[]; totalCount: number }> {
    const res = await apiClient.financials.getExpenses(params);
    return {
      expenses: res.expenses || (Array.isArray(res) ? res : []),
      totalCount: res.totalCount || res.expenses?.length || 0,
    };
  }

  async recordExpense(payload: any): Promise<any> {
    return apiClient.financials.createExpense(payload);
  }
}

export const financialsRepository = new FinancialsRepository();

