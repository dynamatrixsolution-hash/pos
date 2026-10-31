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
