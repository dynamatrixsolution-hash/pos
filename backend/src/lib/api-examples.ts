/**
 * Example Protected API Routes
 * Shows best practices for authorizing API endpoints
 * 
 * Copy these patterns to your other API routes
 */

// Example 1: Simple protected route with role check
export const exampleSimpleRoute = `
import { NextRequest, NextResponse } from "next/server";
import { withAuth, getAuthContext } from "@/lib/api-auth";
import { db } from "@/lib/db";

export const POST = withAuth(async (req, authContext) => {
  // User is authenticated at this point
  // authContext contains: userId, businessId, branchId, role

  try {
    const body = await req.json();

    // Your business logic here
    const result = await db.sale.create({
      data: {
        businessId: authContext.businessId,
        branchId: authContext.branchId || undefined,
        userId: authContext.userId,
        // ... other fields
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: "Failed to create" }, { status: 400 });
  }
});
`;

// Example 2: Route with specific permission requirement
export const examplePermissionRoute = `
import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, hasPermission } from "@/lib/api-auth";
import { db } from "@/lib/db";

export const DELETE = async (req: NextRequest) => {
  const authContext = await getAuthContext();

  if (!authContext) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check specific permission
  if (!hasPermission(authContext.role as any, "products", "delete")) {
    return NextResponse.json(
      { error: "You don't have permission to delete products" },
      { status: 403 }
    );
  }

  try {
    const { productId } = await req.json();

    const product = await db.product.delete({
      where: { id: productId },
    });

    return NextResponse.json(product);
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete" }, { status: 400 });
  }
};
`;

// Example 3: Route with branch access control
export const exampleBranchFilterRoute = `
import { NextRequest, NextResponse } from "next/server";
import { withAuth, applyBranchFilter, getAccessibleBranches } from "@/lib/api-auth";
import { db } from "@/lib/db";

export const GET = withAuth(async (req, authContext) => {
  try {
    // Filter data based on user's branch access
    const query: any = {
      where: {
        businessId: authContext.businessId,
      },
    };

    // Apply branch filter - MANAGER/CASHIER only see their branch
    applyBranchFilter(query.where, authContext);

    const sales = await db.sale.findMany(query);

    return NextResponse.json(sales);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch" }, { status: 400 });
  }
});
`;

// Example 4: Admin-only operations
export const exampleAdminRoute = `
import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/api-auth";

export const POST = async (req: NextRequest) => {
  const authContext = await getAuthContext();

  if (!authContext) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Restrict to OWNER only
  if (authContext.role !== "OWNER") {
    return NextResponse.json(
      { error: "Only business owners can perform this action" },
      { status: 403 }
    );
  }

  // Proceed with admin operation...
};
`;

// Example 5: Role-based response filtering
export const exampleRoleBasedResponse = `
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { db } from "@/lib/db";

export const GET = withAuth(async (req, authContext) => {
  try {
    const user = await db.user.findUnique({
      where: { id: authContext.userId },
      include: {
        business: true,
        branch: true,
      },
    });

    // Remove sensitive fields for non-admin users
    if (authContext.role !== "OWNER" && authContext.role !== "SUPER_ADMIN") {
      delete (user as any).passwordHash;
    }

    return NextResponse.json(user);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch user" }, { status: 400 });
  }
});
`;
