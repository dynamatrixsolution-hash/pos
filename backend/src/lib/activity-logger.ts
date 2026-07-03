import { db } from "@/lib/db";
import { NextRequest } from "next/server";

interface LogActivityParams {
  userId?: string | null;
  businessId: string;
  role?: string | null;
  branchId?: string | null;
  warehouseId?: string | null;
  moduleName: string;
  actionType: string;
  details?: string | null;
  oldValue?: any;
  newValue?: any;
  request?: Request | NextRequest | null;
}

/**
 * Log activity to the database AuditLog table.
 */
export async function logActivity({
  userId,
  businessId,
  role,
  branchId,
  warehouseId,
  moduleName,
  actionType,
  details = null,
  oldValue = null,
  newValue = null,
  request,
}: LogActivityParams) {
  let ipAddress = "127.0.0.1";
  let deviceInfo = "Unknown Device";

  if (request) {
    const headers = request.headers;
    const xForwardedFor = headers.get("x-forwarded-for");
    ipAddress = xForwardedFor ? xForwardedFor.split(",")[0].trim() : (headers.get("x-real-ip") || "127.0.0.1");
    deviceInfo = headers.get("user-agent") || "Unknown Device";
  }

  try {
    return await db.auditLog.create({
      data: {
        businessId,
        userId: userId || null,
        role: role || null,
        branchId: branchId || null,
        warehouseId: warehouseId || branchId || null,
        module: moduleName,
        action: actionType,
        details,
        oldValue: oldValue ? JSON.parse(JSON.stringify(oldValue)) : null,
        newValue: newValue ? JSON.parse(JSON.stringify(newValue)) : null,
        deviceInfo,
        ipAddress,
      },
    });
  } catch (error) {
    console.error("Failed to log activity:", error);
  }
}
