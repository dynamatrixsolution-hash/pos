/**
 * Settings Feature Domain Models & Types
 * Clean Architecture Model Layer
 */

export interface BusinessSettings {
  id?: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  panNumber?: string | null;
  vatNumber?: string | null;
  currency?: string;
  currencySymbol?: string;
  taxRate?: number;
  serviceChargeRate?: number;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  qrCodeUrl?: string | null;
  receiptHeader?: string | null;
  receiptFooter?: string | null;
  invoicePrefix?: string;
  enableVat?: boolean;
  enableServiceCharge?: boolean;
  enableThermalPrint?: boolean;
  autoPrintReceipt?: boolean;
  paperWidth?: "58mm" | "80mm";
  fiscalYear?: string;
}

export interface BranchRecord {
  id: string;
  name: string;
  code?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  isMain: boolean;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CbmsConfig {
  enabled: boolean;
  sellerPan: string;
  username: string;
  password?: string;
  apiUrl: string;
  autoSync: boolean;
  lastSyncAt?: string | null;
}

