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
  
  if (!session || !session.user || !(session.user as any).businessId || !(session.user as any).id) {
    return null;
  }

  // Verify user exists in the database (handles stale session cookies after database resets)
  const userExists = await db.user.findUnique({
    where: { id: (session.user as any).id },
    select: { id: true, businessId: true },
  });

  if (!userExists || userExists.businessId !== (session.user as any).businessId) {
    return null;
  }

  return {
    userId: (session.user as any).id as string,
    businessId: (session.user as any).businessId as string,
    branchId: (session.user as any).branchId as string | null,
    role: (session.user as any).role as string,
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
