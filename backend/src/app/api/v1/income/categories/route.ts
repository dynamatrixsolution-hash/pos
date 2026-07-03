import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse, roleErrorResponse } from "@/lib/api-helper";
import { z } from "zod";

const categorySchema = z.object({
  name: z.string().min(1, "Category name is required"),
});

const DEFAULT_CATEGORIES = [
  "Service Income",
  "Rental Income",
  "Commission",
  "Interest Income",
  "Miscellaneous Income",
];

export async function GET() {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  try {
    let categories = await db.incomeCategory.findMany({
      where: {
        businessId: context.businessId,
        deletedAt: null,
      },
      orderBy: { name: "asc" },
    });

    // Auto-seed default categories if none exist for this business
    if (categories.length === 0) {
      const dataToInsert = DEFAULT_CATEGORIES.map((name) => ({
        name,
        businessId: context.businessId,
      }));

      await db.incomeCategory.createMany({
        data: dataToInsert,
      });

      categories = await db.incomeCategory.findMany({
        where: {
          businessId: context.businessId,
          deletedAt: null,
        },
        orderBy: { name: "asc" },
      });
    }

    return NextResponse.json(categories);
  } catch (error: any) {
    console.error("GET income categories error:", error);
    return NextResponse.json({ error: "Failed to fetch categories" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  // Block Cashiers from creating income categories
  if (context.role === "CASHIER") {
    return roleErrorResponse();
  }

  try {
    const body = await request.json();
    const result = categorySchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.format() },
        { status: 400 }
      );
    }

    const category = await db.incomeCategory.create({
      data: {
        name: result.data.name,
        businessId: context.businessId,
      },
    });

    return NextResponse.json(category, { status: 201 });
  } catch (error: any) {
    console.error("POST income category error:", error);
    return NextResponse.json({ error: "Failed to create category" }, { status: 500 });
  }
}
