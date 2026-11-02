import { db } from "@/lib/db";

export interface LogPlatformAuditParams {
  actorId: string;
  actorRole: string;
  action: string;
  targetType: "BUSINESS" | "SUBSCRIPTION" | "INVOICE" | "USER" | "SYSTEM" | "BACKUP";
  targetId?: string;
  businessId?: string | null;
  reason: string;
  beforeState?: any;
  afterState?: any;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export async function logPlatformAudit(params: LogPlatformAuditParams) {
  if (!params.reason || !params.reason.trim()) {
    throw new Error("Audit log reason is mandatory for platform administrative actions.");
  }

  return await db.platformAuditLog.create({
    data: {
      actorId: params.actorId,
      actorRole: params.actorRole,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId,
      businessId: params.businessId || undefined,
      reason: params.reason.trim(),
      beforeState: params.beforeState ?? undefined,
      afterState: params.afterState ?? undefined,
      ipAddress: params.ipAddress ?? undefined,
      userAgent: params.userAgent ?? undefined,
    },
  });
}

