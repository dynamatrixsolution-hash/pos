import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse, roleErrorResponse } from "@/lib/api-helper";
import { z } from "zod";

const branchSchema = z.object({
  name: z.string().min(2, "Branch name must be at least 2 characters"),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
});

export async function GET(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  try {
    const OWNER_ROLES = ["SUPER_ADMIN", "OWNER"];
    const isOwner = OWNER_ROLES.includes(context.role);

    const { searchParams } = new URL(request.url);
    const all = searchParams.get("all") === "true";

    const where: any = {
      businessId: context.businessId,
      deletedAt: null,
    };

    // Non-owners can only see their assigned branch unless requesting all
    if (!isOwner && !all && context.branchId) {
      where.id = context.branchId;
    }

    const branches = await db.branch.findMany({
      where,
      orderBy: { name: "asc" },
    });

    return NextResponse.json(branches);
  } catch (error: any) {
    console.error("GET branches error:", error);
    return NextResponse.json({ error: "Failed to fetch branches" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  // Block Cashiers from creating branches
  if (context.role === "CASHIER") {
    return roleErrorResponse();
  }

  try {
    const body = await request.json();
    const result = branchSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.format() },
        { status: 400 }
      );
    }

    const { name, phone, address } = result.data;

    // Check branch limits in subscription
    const business = await db.business.findUnique({
      where: { id: context.businessId },
      include: { subscription: true },
    });

    if (!business || !business.subscription) {
      return NextResponse.json({ error: "Active subscription not found" }, { status: 400 });
    }

    const branchCount = await db.branch.count({
      where: { businessId: context.businessId, deletedAt: null },
    });

    if (branchCount >= business.subscription.branchLimit) {
      return NextResponse.json(
        { error: `Branch limit reached. Your subscription plan "${business.subscription.plan}" allows a maximum of ${business.subscription.branchLimit} branches. Please upgrade your plan.` },
        { status: 403 }
      );
    }

    const branch = await db.branch.create({
      data: {
        name,
        phone: phone || null,
        address: address || null,
        businessId: context.businessId,
      },
    });

    // Write audit log
    await db.auditLog.create({
      data: {
        businessId: context.businessId,
        userId: context.userId,
        action: "CREATE",
        module: "BRANCH",
        details: `Created new branch "${name}".`,
      },
    });

    return NextResponse.json(branch, { status: 201 });
  } catch (error: any) {
    console.error("POST branch error:", error);
    return NextResponse.json({ error: "Failed to create branch" }, { status: 500 });
  }
}
