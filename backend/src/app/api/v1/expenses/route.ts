import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse, roleErrorResponse } from "@/lib/api-helper";
import { z } from "zod";

const expenseSchema = z.object({
  amount: z.number().positive("Amount must be greater than zero"),
  categoryId: z.string().uuid("Invalid category ID"),
  branchId: z.string().uuid("Invalid branch ID"),
  reference: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
});

export async function GET(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  const { searchParams } = new URL(request.url);
  const branchId = searchParams.get("branchId") || undefined;
  const categoryId = searchParams.get("categoryId") || undefined;
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "20", 10);
  const skip = (page - 1) * limit;

  try {
    const where: any = {
      businessId: context.businessId,
      deletedAt: null,
    };

    if (branchId) where.branchId = branchId;
    if (categoryId) where.categoryId = categoryId;

    const summaryWhere: any = {
      businessId: context.businessId,
      deletedAt: null,
    };
    if (branchId) summaryWhere.branchId = branchId;
    if (categoryId) summaryWhere.categoryId = categoryId;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [expenses, totalCount, totalSum, todaySum, monthSum] = await Promise.all([
      db.expense.findMany({
        where,
        include: {
          category: true,
          branch: { select: { name: true } },
          user: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      db.expense.count({ where }),
      db.expense.aggregate({
        where: summaryWhere,
        _sum: { amount: true },
      }),
      db.expense.aggregate({
        where: {
          ...summaryWhere,
          createdAt: { gte: todayStart, lte: todayEnd },
        },
        _sum: { amount: true },
      }),
      db.expense.aggregate({
        where: {
          ...summaryWhere,
          createdAt: { gte: monthStart },
        },
        _sum: { amount: true },
      }),
    ]);

    return NextResponse.json({
      expenses,
      pagination: {
        totalItems: totalCount,
        totalPages: Math.ceil(totalCount / limit),
        currentPage: page,
        limit,
      },
      summary: {
        total: totalSum._sum.amount ?? 0,
        today: todaySum._sum.amount ?? 0,
        thisMonth: monthSum._sum.amount ?? 0,
      },
    });
  } catch (error: any) {
    console.error("GET expenses error:", error);
    return NextResponse.json({ error: "Failed to fetch expenses" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  const headers = request.headers;
  const xForwardedFor = headers.get("x-forwarded-for");
  const ipAddress = xForwardedFor ? xForwardedFor.split(",")[0].trim() : (headers.get("x-real-ip") || "127.0.0.1");
  const deviceInfo = headers.get("user-agent") || "Unknown Device";

  // Block Cashiers from creating/modifying expenses
  if (context.role === "CASHIER") {
    return roleErrorResponse();
  }

  try {
    const body = await request.json();
    const result = expenseSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.format() },
        { status: 400 }
      );
    }

    const { amount, categoryId, branchId, reference, description } = result.data;

    // Verify category belongs to business
    const category = await db.expenseCategory.findFirst({
      where: { id: categoryId, businessId: context.businessId, deletedAt: null },
    });
    if (!category) {
      return NextResponse.json({ error: "Expense category not found" }, { status: 404 });
    }

    // Verify branch belongs to business
    const branch = await db.branch.findFirst({
      where: { id: branchId, businessId: context.businessId, deletedAt: null },
    });
    if (!branch) {
      return NextResponse.json({ error: "Branch not found" }, { status: 404 });
    }

    const expense = await db.expense.create({
      data: {
        businessId: context.businessId,
        branchId,
        categoryId,
        userId: context.userId,
        amount,
        reference: reference || null,
        description: description || null,
      },
      include: {
        category: true,
      },
    });

    // Write audit log
    await db.auditLog.create({
      data: {
        businessId: context.businessId,
        userId: context.userId,
        role: context.role,
        branchId,
        warehouseId: branchId,
        action: "CREATE",
        module: "EXPENSE",
        details: `Recorded expense of $${amount} under category "${category.name}".`,
        newValue: JSON.parse(JSON.stringify(expense)),
        ipAddress,
        deviceInfo,
      },
    });

    return NextResponse.json(expense, { status: 201 });
  } catch (error: any) {
    console.error("POST expense error:", error);
    return NextResponse.json({ error: "Failed to record expense" }, { status: 500 });
  }
}
