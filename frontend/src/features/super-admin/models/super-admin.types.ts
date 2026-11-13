/**
 * Super Admin Multi-Tenant Domain Models
 * Clean Architecture Model Layer
 */

export type TenantStatus = "ACTIVE" | "TRIAL" | "SUSPENDED" | "EXPIRED" | "CANCELLED";

export interface TenantBusiness {
  id: string;
  name: string;
  slug?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  panVat?: string | null;
  status: TenantStatus;
  planName?: string | null;
  plan?: string | null;
  branchesCount?: number;
  usersCount?: number;
  ordersCount?: number;
  createdAt: string;
  updatedAt?: string;
  subscription?: {
    id: string;
    plan: string;
    status: string;
    currentPeriodEnd?: string | null;
  } | null;
}

export interface PlatformModule {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  category: string;
  isEnabled: boolean;
}

export interface PlatformActivityLog {
  id: string;
  action: string;
  module: string;
  details?: string | null;
  ipAddress?: string | null;
  userName?: string | null;
  businessName?: string | null;
  createdAt: string;
}

