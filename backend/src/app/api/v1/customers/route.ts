import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";
import { z } from "zod";
import { logActivity } from "@/lib/activity-logger";

const customerSchema = z.object({
  name: z.string().min(2, "Customer name must be at least 2 characters"),
  email: z.string().email("Invalid email").optional().nullable().or(z.literal("")),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  customerType: z.enum(["RETAIL", "WHOLESALE"]).default("RETAIL"),
  creditLimit: z.number().nonnegative().default(0),
  branchId: z.string().optional().nullable(),
});

export async function GET(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";
  const type = searchParams.get("type");
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "20", 10);
  const skip = (page - 1) * limit;

  try {
    const where: any = {
      businessId: context.businessId,
      deletedAt: null,
    };

    const conditions: any[] = [];

    if (search) {
      conditions.push({
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { phone: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
        ],
      });
    }

    if (type && type !== "all") {
      where.customerType = type;
    }

    // Cashier role data isolation - view only assigned branch or global customers
    if (context.role === "CASHIER" && context.branchId) {
      conditions.push({
        OR: [
          { branchId: context.branchId },
          { branchId: null },
        ],
      });
    }

    if (conditions.length > 0) {
      where.AND = conditions;
    }

    const [customers, totalCount] = await Promise.all([
      db.customer.findMany({
        where,
        orderBy: { name: "asc" },
        skip,
        take: limit,
      }),
      db.customer.count({ where }),
    ]);

    return NextResponse.json({
      customers,
      pagination: {
        totalItems: totalCount,
        totalPages: Math.ceil(totalCount / limit),
        currentPage: page,
        limit,
      },
    });
  } catch (error: any) {
    console.error("GET customers error:", error);
    return NextResponse.json({ error: "Failed to fetch customers" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  try {
    const body = await request.json();
    const result = customerSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.format() },
        { status: 400 }
      );
    }

    const data = result.data;
    const customer = await db.customer.create({
      data: {
        name: data.name,
        email: data.email || null,
        phone: data.phone || null,
        address: data.address || null,
        customerType: data.customerType,
        creditLimit: data.creditLimit,
        balance: 0, // Starts with zero balance
        businessId: context.businessId,
        branchId: data.branchId || context.branchId || null,
      },
    });

    await logActivity({
      userId: context.userId,
      businessId: context.businessId,
      role: context.role,
      moduleName: "CUSTOMER",
      actionType: "CREATE",
      details: `Added new customer "${customer.name}" (${customer.customerType})`,
      newValue: customer,
      request,
    });

    return NextResponse.json(customer, { status: 201 });
  } catch (error: any) {
    console.error("POST customer error:", error);
    return NextResponse.json({ error: "Failed to create customer" }, { status: 500 });
  }
}
