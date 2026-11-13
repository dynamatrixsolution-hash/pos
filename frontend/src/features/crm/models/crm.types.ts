/**
 * CRM Domain Models (Customers & Suppliers)
 * Clean Architecture Model Layer
 */

export interface CustomerRecord {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  panVat?: string | null;
  address?: string | null;
  loyaltyPoints?: number;
  outstandingBalance?: number;
  createdAt: string;
  totalOrders?: number;
}

export interface SupplierRecord {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  panVat?: string | null;
  address?: string | null;
  contactPerson?: string | null;
  balance?: number;
  createdAt: string;
}

