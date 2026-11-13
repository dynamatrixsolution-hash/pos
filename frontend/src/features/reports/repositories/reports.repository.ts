/**
 * Reports Feature Repository
 * Interacts exclusively with apiClient singleton
 */

import { apiClient } from "@/core/api/api-client";
import {
  DailyReportSummary,
  TransactionReportItem,
  OutstandingReportItem,
  AccountingSummary,
  ComplianceAuditItem,
} from "../models/reports.types";

export class ReportsRepository {
  async fetchDailyReport(dateStr: string, branchId?: string): Promise<any> {
    const data = await apiClient.reports.getReports({
      startDate: dateStr,
      endDate: dateStr,
      branchId: branchId && branchId !== "ALL" ? branchId : undefined,
    });
    return data;
  }

  async fetchDateRangeReport(startDate: string, endDate: string, branchId?: string): Promise<any> {
    const data = await apiClient.reports.getReports({
      startDate,
      endDate,
      branchId: branchId && branchId !== "ALL" ? branchId : undefined,
    });
    return data;
  }

  async fetchTransactions(type: "sales" | "purchase" | "expense" | "payment", params?: any) {
    if (type === "sales") return await apiClient.financials.getSales(params);
    if (type === "purchase") return await apiClient.financials.getPurchases(params);
    if (type === "expense") return await apiClient.financials.getExpenses(params);
    return await apiClient.financials.getPayments(params);
  }

  async fetchOutstanding(): Promise<{ customers: any[]; suppliers: any[]; reconciliation: any }> {
    const [cRes, sRes, rRes] = await Promise.all([
      apiClient.customer.searchCustomers(),
      apiClient.customer.getSuppliers(),
      apiClient.reports.getReconciliationReport().catch(() => null),
    ]);
    return {
      customers: cRes.customers || [],
      suppliers: sRes.suppliers || [],
      reconciliation: rRes,
    };
  }

  async fetchAccountingData(startDate: string, endDate: string, branchId?: string) {
    const [salesRes, purRes, expRes, cRes, sRes] = await Promise.all([
      apiClient.financials.getSales({ startDate, endDate, branchId, limit: 250 }),
      apiClient.financials.getPurchases({ startDate, endDate, branchId, limit: 250 }),
      apiClient.financials.getExpenses({ startDate, endDate, branchId, limit: 250 }),
      apiClient.customer.searchCustomers(),
      apiClient.customer.getSuppliers(),
    ]);
    return {
      sales: salesRes.sales || [],
      purchases: purRes.purchases || [],
      expenses: expRes.expenses || [],
      customers: cRes.customers || [],
      suppliers: sRes.suppliers || [],
    };
  }

  async fetchComplianceReport(params?: Record<string, string>) {
    return await apiClient.reports.getComplianceReport(params);
  }

  async fetchFiscalYear() {
    return await apiClient.reports.getFiscalYear();
  }

  async fetchBranches() {
    const data = await apiClient.settings.getBranches();
    return data.branches || [];
  }

  async fetchAuditLogs(params?: { limit?: number; search?: string }) {
    return await apiClient.settings.getAuditLogs(params);
  }
}

export const reportsRepository = new ReportsRepository();

