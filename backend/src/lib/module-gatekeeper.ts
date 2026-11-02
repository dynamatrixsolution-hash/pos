import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export type HospitalityModule =
  | "POS"
  | "TABLES"
  | "MENU"
  | "KDS"
  | "ROOMS"
  | "RESERVATIONS"
  | "HOUSEKEEPING"
  | "FOLIOS"
  | "ROOM_SERVICE";

export const PACKAGE_DEFAULT_MODULES: Record<string, HospitalityModule[]> = {
  RESTAURANT: ["POS", "TABLES", "MENU", "KDS"],
  HOTEL: ["ROOMS", "RESERVATIONS", "HOUSEKEEPING", "FOLIOS"],
  BOTH: ["POS", "TABLES", "MENU", "KDS", "ROOMS", "RESERVATIONS", "HOUSEKEEPING", "FOLIOS", "ROOM_SERVICE"],
};

export interface TenantAccessEvaluation {
  allowed: boolean;
  status: "ACTIVE" | "SUSPENDED" | "OVERDUE_GRACE" | "BLOCKED" | "NOT_FOUND";
  reason?: string;
  enabledModules: string[];
  packageType: string;
}

/**
 * Evaluates tenant subscription status and specific module entitlements.
 * Adheres to safety rule: Does not abruptly block active checkout/settlement during hotel stays,
 * but enforces strict grace periods and explicit package capabilities.
 */
export async function evaluateTenantModuleAccess(
  businessId: string,
  requiredModule?: HospitalityModule
): Promise<TenantAccessEvaluation> {
  const business = await db.business.findUnique({
    where: { id: businessId },
    include: { subscription: true },
  });

  if (!business) {
    return {
      allowed: false,
      status: "NOT_FOUND",
      reason: "Tenant business not found",
      enabledModules: [],
      packageType: "RESTAURANT",
    };
  }

  // 1. Check administrative account suspension
  if (business.status === "SUSPENDED") {
    return {
      allowed: false,
      status: "SUSPENDED",
      reason: business.suspendedReason || "Tenant account has been suspended by platform administration",
      enabledModules: [],
      packageType: business.subscription?.packageType || "RESTAURANT",
    };
  }

  const sub = business.subscription;
  if (!sub) {
    return {
      allowed: false,
      status: "BLOCKED",
      reason: "No active platform subscription provisioned for this tenant",
      enabledModules: [],
      packageType: "RESTAURANT",
    };
  }

  const packageType = sub.packageType || "RESTAURANT";
  const defaultModules = PACKAGE_DEFAULT_MODULES[packageType] || PACKAGE_DEFAULT_MODULES.RESTAURANT;
  const enabledModules = sub.enabledModules && sub.enabledModules.length > 0 ? sub.enabledModules : defaultModules;

  // 2. Check subscription status & grace period
  const now = new Date();
  const isPastEndDate = sub.endDate && new Date(sub.endDate) < now;
  const graceDays = sub.gracePeriodDays || 7;
  const graceEndDate = new Date(sub.endDate);
  graceEndDate.setDate(graceEndDate.getDate() + graceDays);

  if (sub.status === "CANCELLED" || (isPastEndDate && now > graceEndDate)) {
    return {
      allowed: false,
      status: "BLOCKED",
      reason: "Platform subscription has expired beyond the allowable grace period. Please contact administration.",
      enabledModules,
      packageType,
    };
  }

  const isGracePeriod = isPastEndDate && now <= graceEndDate;

  // 3. Module specific check
  if (requiredModule && !enabledModules.includes(requiredModule)) {
    return {
      allowed: false,
      status: isGracePeriod ? "OVERDUE_GRACE" : "ACTIVE",
      reason: `The module '${requiredModule}' is not enabled in your current '${packageType}' subscription package.`,
      enabledModules,
      packageType,
    };
  }

  return {
    allowed: true,
    status: isGracePeriod ? "OVERDUE_GRACE" : "ACTIVE",
    enabledModules,
    packageType,
  };
}

/**
 * Next.js Route Guard for module access
 */
export async function enforceModuleAccess(businessId: string, requiredModule: HospitalityModule) {
  const evalResult = await evaluateTenantModuleAccess(businessId, requiredModule);
  if (!evalResult.allowed) {
    return NextResponse.json(
      {
        error: "Forbidden: Module Access Denied",
        code: "MODULE_NOT_ENTITLED",
        details: evalResult.reason,
        status: evalResult.status,
      },
      { status: 403 }
    );
  }
  return null;
}

