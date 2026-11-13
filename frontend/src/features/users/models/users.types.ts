/**
 * Users Feature Domain Models & Types
 * Clean Architecture Model Layer
 */

export interface UserRoleRecord {
  id: string;
  name: string;
  description?: string;
  permissions: string[];
  isSystem: boolean;
}

export interface UserDeviceRecord {
  id: string;
  userId: string;
  deviceName: string;
  deviceType?: string;
  ipAddress?: string;
  lastActive: string;
  user?: {
    name: string;
    email: string;
    role: string;
  };
}

export interface UserActivityLog {
  id: string;
  userId?: string | null;
  action: string;
  entityType?: string | null;
  details?: any;
  ipAddress?: string | null;
  createdAt: string;
  user?: {
    name: string;
    email: string;
    role: string;
  } | null;
}

