/**
 * Reports Feature Domain Models & Types
 * Clean Architecture Model Layer
 */

export interface DailyReportSummary {
  date: string;
  totalSales: number;
  totalPurchases: number;
  totalExpenses: number;
  netProfit: number;
  salesCount: number;
  paymentsReceived: number;
  cashCollected: number;
  onlineCollected: number;
  creditSales: number;
}

export interface TransactionReportItem {
  id: string;
  type: "SALE" | "PURCHASE" | "EXPENSE" | "PAYMENT";
  referenceNumber: string;
  partyName: string;
  date: string;
  amount: number;
  status: string;
  paymentMethod?: string;
  branchName?: string;
}

export interface OutstandingReportItem {
  id: string;
  name: string;
  phone?: string | null;
  type: "CUSTOMER" | "SUPPLIER";
  totalOutstanding: number;
  currentBalance: number;
  overdueDays?: number;
  lastPaymentDate?: string;
}

export interface AccountingSummary {
  revenue: number;
  costOfGoodsSold: number;
  grossProfit: number;
  operatingExpenses: number;
  netIncome: number;
  totalReceivables: number;
  totalPayables: number;
}

export interface ComplianceAuditItem {
  id: string;
  invoiceNumber: string;
  fiscalYear: string;
  customerPan?: string | null;
  taxableAmount: number;
  vatAmount: number;
  totalAmount: number;
  irdSyncStatus: "SYNCED" | "PENDING" | "FAILED";
  syncedAt?: string | null;
}

