import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export interface SessionContext {
  userId: string;
  businessId: string;
  branchId: string | null;
  role: string;
}

export async function getSessionContext(): Promise<SessionContext | null> {
  const session = await auth();
  
  const sessionUser = session?.user as { id?: string; businessId?: string } | undefined;
  if (!sessionUser?.id || !sessionUser.businessId) {
    return null;
  }

  // Verify user exists in the database (handles stale session cookies after database resets)
  const userExists = await db.user.findUnique({
    where: { id: sessionUser.id },
    select: { id: true, businessId: true, branchId: true, role: true, isActive: true, deletedAt: true, business: { select: { deletedAt: true } } },
  });

  if (!userExists || !userExists.isActive || userExists.deletedAt || userExists.business.deletedAt || !["OWNER", "MANAGER", "CASHIER", "SUPER_ADMIN"].includes(userExists.role) || userExists.businessId !== sessionUser.businessId) {
    return null;
  }
  if (!["OWNER", "SUPER_ADMIN"].includes(userExists.role) && !userExists.branchId) return null;

  return {
    userId: sessionUser.id as string,
    businessId: sessionUser.businessId as string,
    branchId: userExists.branchId,
    role: userExists.role,
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

  const planName = business.subscription.plan || "STARTER";
  
  // Load platform-admin configurations
  const platform = await db.business.findUnique({
    where: { slug: "platform-admin" },
    select: { settings: true },
  });

  const platformSettings = (platform?.settings as any) || {};
  const defaultLimits = platformSettings.limits || {
    Starter: { users: 1, branches: 1, products: 100, warehouses: 1, devices: 1, transactions: 100 },
    Professional: { users: 5, branches: 2, products: 1000, warehouses: 2, devices: 2, transactions: 1000 },
    Enterprise: { users: 20, branches: 5, products: 999999, warehouses: 5, devices: 5, transactions: 999999 },
  };

  // Find limitKey matching the plan case-insensitively
  const limitKey = Object.keys(defaultLimits).find(k => k.toUpperCase() === planName.toUpperCase()) || "Starter";
  const planLimits = defaultLimits[limitKey] || { users: 1, branches: 1, products: 100, warehouses: 1, devices: 1, transactions: 100 };

  const customLimits = (business.settings as any)?.customLimits || {};

  return {
    users: customLimits.users !== undefined && customLimits.users !== null ? Number(customLimits.users) : Number(planLimits.users || planLimits.userLimit || 1),
    branches: customLimits.branches !== undefined && customLimits.branches !== null ? Number(customLimits.branches) : Number(planLimits.branches || planLimits.branchLimit || 1),
    warehouses: customLimits.warehouses !== undefined && customLimits.warehouses !== null ? Number(customLimits.warehouses) : Number(planLimits.warehouses || 1),
    products: customLimits.products !== undefined && customLimits.products !== null ? Number(customLimits.products) : Number(planLimits.products || 100),
    transactions: customLimits.transactions !== undefined && customLimits.transactions !== null ? Number(customLimits.transactions) : Number(planLimits.transactions || 100),
    devices: customLimits.devices !== undefined && customLimits.devices !== null ? Number(customLimits.devices) : Number(planLimits.devices || 1),
  };
}

