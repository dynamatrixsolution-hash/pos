/**
 * Financial & Commerce Domain Models
 * Clean Architecture Model Layer
 */

export type PaymentType = "RECEIVED" | "SENT";

export type PaymentMethod =
  | "CASH"
  | "CARD"
  | "FONE_PAY"
  | "ESEWA"
  | "KHALTI"
  | "NEPAL_PAY"
  | "CREDIT";

export interface PaymentRecord {
  id: string;
  paymentNumber?: string;
  receiptNumber?: string;
  type: PaymentType;
  amount: number;
  method: PaymentMethod;
  reference?: string | null;
  remarks?: string | null;
  status?: string;
  createdAt: string;
  customer?: { id: string; name: string; phone?: string | null } | null;
  supplier?: { id: string; name: string; phone?: string | null } | null;
  branch?: { id: string; name: string } | null;
  sale?: { id: string; invoiceNumber: string; total: number } | null;
  purchase?: { id: string; invoiceNumber: string; total: number } | null;
  recordedBy?: { id: string; name: string } | null;
}

export interface PurchaseBillItem {
  id?: string;
  productId: string;
  quantity: number;
  price: number;
  batchNumber?: string | null;
  expiryDate?: string | null;
  product?: { id: string; name: string; sku?: string | null };
}

export interface PurchaseBill {
  id: string;
  billNumber?: string;
  invoiceNumber?: string | null;
  supplierId: string;
  branchId?: string | null;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paidAmount: number;
  paymentMethod: PaymentMethod;
  paymentStatus: "PAID" | "PARTIAL" | "UNPAID";
  notes?: string | null;
  createdAt: string;
  supplier: { id: string; name: string; phone?: string | null; panVat?: string | null };
  branch?: { id: string; name: string } | null;
  items: PurchaseBillItem[];
}

export interface ExpenseRecord {
  id: string;
  amount: number;
  reference?: string | null;
  description?: string | null;
  createdAt: string;
  category: { id: string; name: string };
  branch: { id: string; name: string };
  user?: { id: string; name: string } | null;
}

