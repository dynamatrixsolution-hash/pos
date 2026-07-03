import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";

export async function GET(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  try {
    const OWNER_ROLES = ["SUPER_ADMIN", "OWNER"];
    const isOwner = OWNER_ROLES.includes(context.role);

    if (!isOwner) {
      return NextResponse.json({ error: "Unauthorized. Only owners and admins can view activity logs." }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const userId = searchParams.get("userId");
    const branchId = searchParams.get("branchId");
    const warehouseId = searchParams.get("warehouseId");
    const moduleName = searchParams.get("module");
    const actionType = searchParams.get("action");

    const where: any = {
      businessId: context.businessId,
    };

    // User Filter
    if (userId) {
      where.userId = userId;
    }

    // Branch Filter
    if (branchId) {
      where.branchId = branchId;
    }

    // Warehouse Filter
    if (warehouseId) {
      where.warehouseId = warehouseId;
    }

    // Module Filter
    if (moduleName) {
      where.module = moduleName;
    }

    // Action Filter
    if (actionType) {
      where.action = actionType;
    }

    // Date Range Filter
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    // Search Query (Action, Module, Details, User name/email)
    if (search) {
      where.AND = [
        {
          OR: [
            { action: { contains: search } },
            { module: { contains: search } },
            { details: { contains: search } },
            { user: { name: { contains: search } } },
            { user: { email: { contains: search } } },
          ],
        },
      ];
    }

    const logs = await db.auditLog.findMany({
      where,
      include: {
        user: { select: { name: true, email: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ logs });
  } catch (error: any) {
    console.error("GET activity logs error:", error);
    return NextResponse.json({ error: "Failed to fetch activity logs" }, { status: 500 });
  }
}

