import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Ensure BigInt can be serialized to JSON across all API routes
if (typeof BigInt !== "undefined" && !(BigInt.prototype as any).toJSON) {
  (BigInt.prototype as any).toJSON = function () {
    return Number(this);
  };
}

export interface SessionContext {
  userId: string;
  businessId: string;
  branchId: string | null;
  role: string;
}

export const VALID_SYSTEM_ROLES = [
  "SUPER_ADMIN",
  "OWNER",
  "MANAGER",
  "FRONT_DESK",
  "CASHIER",
  "WAITER",
  "KITCHEN",
  "HOUSEKEEPING",
  "ACCOUNTANT",
  // Legacy role fallbacks for backwards compatibility
  "STOREKEEPER",
  "SALESPERSON",
  "DELIVERY",
];

export async function getSessionContext(): Promise<SessionContext | null> {
  const session = await auth();
  
  const sessionUser = session?.user as { id?: string; businessId?: string } | undefined;
  if (!sessionUser?.id || !sessionUser.businessId) {
    return null;
  }

  // Verify user exists in the database (handles stale session cookies after database resets)
  const userExists = await db.user.findUnique({
    where: { id: sessionUser.id },
    select: {
      id: true,
      businessId: true,
      branchId: true,
      role: true,
      isActive: true,
      deletedAt: true,
      business: {
        select: {
          deletedAt: true,
          subscription: { select: { status: true } },
        },
      },
    },
  });

  if (
    !userExists ||
    !userExists.isActive ||
    userExists.deletedAt ||
    userExists.business?.deletedAt ||
    !VALID_SYSTEM_ROLES.includes(userExists.role.toUpperCase()) ||
    userExists.businessId !== sessionUser.businessId
  ) {
    return null;
  }
  if (
    userExists.role !== "SUPER_ADMIN" &&
    userExists.business?.subscription?.status &&
    ["SUSPENDED", "CANCELLED"].includes(userExists.business.subscription.status.toUpperCase())
  ) {
    return null;
  }
  let resolvedBranchId = userExists.branchId;
  if (!resolvedBranchId) {
    const defaultBranch = await db.branch.findFirst({
      where: {
        businessId: userExists.businessId,
        isActive: true,
        deletedAt: null,
      },
      orderBy: [{ isMain: "desc" }, { createdAt: "asc" }],
      select: { id: true },
    });
    resolvedBranchId = defaultBranch?.id ?? null;
  }

  if (!["OWNER", "SUPER_ADMIN"].includes(userExists.role) && !resolvedBranchId) {
    return null;
  }

  return {
    userId: sessionUser.id as string,
    businessId: sessionUser.businessId as string,
    branchId: resolvedBranchId,
    role: userExists.role,
  };
}

export { isValidUUID, stripHtml, sanitizePayload, safeErrorMessage } from "./security";

/**
 * Standard pagination parameter extractor and guard against DOS table scans.
 * Caps maximum items per page to prevent unbounded queries.
 */
export function getPaginationParams(request: Request | URL, defaultLimit = 20, maxLimit = 100) {
  const url = request instanceof URL ? request : new URL(request.url);
  const pageRaw = parseInt(url.searchParams.get("page") || "1", 10);
  const limitRaw = parseInt(url.searchParams.get("limit") || String(defaultLimit), 10);

  const page = Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const limit = Number.isInteger(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, maxLimit) : defaultLimit;
  const skip = (page - 1) * limit;

  return {
    page,
    limit,
    skip,
    take: limit,
  };
}

export function paginationMeta(total: number, page: number, limit: number) {
  return {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    hasMore: page * limit < total,
  };
}

export function authErrorResponse() {
  return NextResponse.json(
    { error: "Unauthorized. Please log in first." },
    { status: 401 }
  );
}

export function roleErrorResponse() {
  return NextResponse.json(
    { error: "Forbidden. You do not have the required permissions for this action." },
    { status: 403 }
  );
}

export async function getBusinessLimits(businessId: string) {
  const business = await db.business.findUnique({
    where: { id: businessId },
    include: { subscription: true },
  });

  if (!business || !business.subscription) {
    return null;
  }

  const sub = business.subscription;
  const planName = sub.plan || "STARTER";
  
  // Load platform-admin configurations
  const platform = await db.business.findUnique({
    where: { slug: "platform-admin" },
    select: { settings: true },
  });

  const platformSettings = (platform?.settings as any) || {};
  const defaultLimits = platformSettings.limits || {
    Starter: { users: 1, branches: 1, products: 100, warehouses: 1, devices: 1, transactions: 100 },
    Professional: { users: 5, branches: 2, products: 1000, warehouses: 2, devices: 5, transactions: 1000 },
    Enterprise: { users: 50, branches: 10, products: 999999, warehouses: 5, devices: 50, transactions: 999999 },
  };

  // Find limitKey matching the plan case-insensitively
  const limitKey = Object.keys(defaultLimits).find(k => k.toUpperCase() === planName.toUpperCase()) || "Starter";
  const planLimits = defaultLimits[limitKey] || { users: 1, branches: 1, products: 100, warehouses: 1, devices: 1, transactions: 100 };

  const subCustom = (sub.customLimits as any) || {};
  const bizCustom = (business.settings as any)?.customLimits || {};
  const customLimits = { ...bizCustom, ...subCustom };

  const effectiveUserLimit = sub.userLimit || customLimits.users || planLimits.users || planLimits.userLimit || 1;
  const effectiveBranchLimit = sub.branchLimit || customLimits.branches || planLimits.branches || planLimits.branchLimit || 1;
  const defaultDevices = customLimits.devices !== undefined && customLimits.devices !== null
    ? Number(customLimits.devices)
    : Number(planLimits.devices || effectiveUserLimit || 1);

  return {
    users: Number(effectiveUserLimit),
    branches: Number(effectiveBranchLimit),
    warehouses: customLimits.warehouses !== undefined && customLimits.warehouses !== null ? Number(customLimits.warehouses) : Number(planLimits.warehouses || 5),
    products: customLimits.products !== undefined && customLimits.products !== null ? Number(customLimits.products) : Number(planLimits.products || 100),
    transactions: customLimits.transactions !== undefined && customLimits.transactions !== null ? Number(customLimits.transactions) : Number(planLimits.transactions || 999999),
    devices: Number(defaultDevices),
  };
}

