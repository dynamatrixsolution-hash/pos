import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse, roleErrorResponse } from "@/lib/api-helper";
import { z } from "zod";
import { logActivity } from "@/lib/activity-logger";

const supplierSchema = z.object({
  name: z.string().min(2, "Supplier name must be at least 2 characters"),
  contactName: z.string().optional().nullable(),
  email: z.string().email("Invalid email").optional().nullable().or(z.literal("")),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
});

export async function GET(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "20", 10);
  const skip = (page - 1) * limit;

  try {
    const where: any = {
      businessId: context.businessId,
      deletedAt: null,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { contactName: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
      ];
    }

    const [suppliers, totalCount] = await Promise.all([
      db.supplier.findMany({
        where,
        orderBy: { name: "asc" },
        skip,
        take: limit,
      }),
      db.supplier.count({ where }),
    ]);

    return NextResponse.json({
      suppliers,
      pagination: {
        totalItems: totalCount,
        totalPages: Math.ceil(totalCount / limit),
        currentPage: page,
        limit,
      },
    });
  } catch (error: any) {
    console.error("GET suppliers error:", error);
    return NextResponse.json({ error: "Failed to fetch suppliers" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  // Block Cashiers from creating suppliers
  if (context.role === "CASHIER") {
    return roleErrorResponse();
  }

  try {
    const body = await request.json();
    const result = supplierSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.format() },
        { status: 400 }
      );
    }

    const data = result.data;
    const supplier = await db.supplier.create({
      data: {
        name: data.name,
        contactName: data.contactName || null,
        email: data.email || null,
        phone: data.phone || null,
        address: data.address || null,
        balance: 0,
        businessId: context.businessId,
      },
    });

    await logActivity({
      userId: context.userId,
      businessId: context.businessId,
      role: context.role,
      moduleName: "SUPPLIER",
      actionType: "CREATE",
      details: `Added new supplier "${supplier.name}"`,
      newValue: supplier,
      request,
    });

    return NextResponse.json(supplier, { status: 201 });
  } catch (error: any) {
    console.error("POST supplier error:", error);
    return NextResponse.json({ error: "Failed to create supplier" }, { status: 500 });
  }
}
