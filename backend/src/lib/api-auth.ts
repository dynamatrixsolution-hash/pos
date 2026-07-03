/**
 * API Authorization Utilities
 * Provides functions to authorize API requests based on user role and branch access
 */

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { hasPermission, canAccessRoute } from "@/lib/rbac";
import { NextRequest, NextResponse } from "next/server";

export interface AuthContext {
  userId: string;
  businessId: string;
  branchId: string | null;
  role: string;
  user: any;
}

/**
 * Get auth context from session
 */
export async function getAuthContext(): Promise<AuthContext | null> {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const user = session.user as any;
  return {
    userId: user.id,
    businessId: user.businessId,
    branchId: user.branchId,
    role: user.role || "CASHIER",
    user,
  };
}

/**
 * Create a protected API route handler
 */
export function withAuth(
  handler: (req: NextRequest, context: AuthContext) => Promise<NextResponse>
) {
  return async (req: NextRequest, params?: any) => {
    const authContext = await getAuthContext();

    if (!authContext) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      return await handler(req, authContext);
    } catch (error) {
      console.error("API Error:", error);
      return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
  };
}

/**
 * Require specific permission for API route
 */
export function requirePermission(resource: string, action: string) {
  return async (
    handler: (req: NextRequest, context: AuthContext) => Promise<NextResponse>
  ) => {
    return async (req: NextRequest, params?: any) => {
      const authContext = await getAuthContext();

      if (!authContext) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      if (!hasPermission(authContext.role as any, resource, action)) {
        return NextResponse.json(
          { error: "Forbidden: Insufficient permissions" },
          { status: 403 }
        );
      }

      try {
        return await handler(req, authContext);
      } catch (error) {
        console.error("API Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
      }
    };
  };
}

/**
 * Verify user belongs to business
 */
export async function verifyBusinessAccess(
  userId: string,
  businessId: string
): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { id: userId },
  });

  return user?.businessId === businessId;
}

/**
 * Verify user can access branch
 */
export async function verifyBranchAccess(
  userId: string,
  branchId: string
): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: { branch: true },
  });

  if (!user) return false;

  // SUPER_ADMIN and OWNER can access any branch
  if (["SUPER_ADMIN", "OWNER"].includes(user.role)) {
    return true;
  }

  // MANAGER and CASHIER can only access their assigned branch
  return user.branchId === branchId;
}

/**
 * Query builder that respects branch access
 * Used to filter results based on user's branch assignment
 */
export function applyBranchFilter(query: any, authContext: AuthContext) {
  // SUPER_ADMIN and OWNER see all branches
  if (["SUPER_ADMIN", "OWNER"].includes(authContext.role)) {
    return query;
  }

  // MANAGER and CASHIER see only their branch
  if (authContext.branchId) {
    return {
      ...query,
      branchId: authContext.branchId,
    };
  }

  return query;
}

/**
 * Check if role can manage users
 */
export function canManageUsers(role: string): boolean {
  return ["OWNER", "SUPER_ADMIN"].includes(role);
}

/**
 * Check if role can manage branches
 */
export function canManageBranches(role: string): boolean {
  return role === "OWNER";
}

/**
 * Check if role can enable/disable branches
 */
export function canToggleBranch(role: string): boolean {
  return role === "OWNER";
}

/**
 * Get accessible branches for a user
 */
export async function getAccessibleBranches(
  authContext: AuthContext
): Promise<any[]> {
  if (authContext.role === "OWNER") {
    // Owner can see all branches of their business
    return await db.branch.findMany({
      where: {
        businessId: authContext.businessId,
        deletedAt: null,
      },
    });
  }

  if (authContext.role === "SUPER_ADMIN") {
    // Super admin can only see owner's branches through business
    // This would typically be limited by the Business they're viewing
    return [];
  }

  if (authContext.branchId) {
    // Manager and Cashier can see their branch only
    return await db.branch.findMany({
      where: {
        id: authContext.branchId,
        deletedAt: null,
      },
    });
  }

  return [];
}

/**
 * Get user count for a branch
 */
export async function getBranchEmployeeCount(branchId: string): Promise<number> {
  return await db.user.count({
    where: {
      branchId,
      deletedAt: null,
      isActive: true,
    },
  });
}
