import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse, roleErrorResponse } from "@/lib/api-helper";
import { z } from "zod";

const subcategorySchema = z.object({
  name: z.string().min(1, "Name is required"),
  categoryId: z.string().uuid("Category ID is required"),
});

export async function GET(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  const { searchParams } = new URL(request.url);
  const categoryId = searchParams.get("categoryId");

  try {
    const where: any = {
      businessId: context.businessId,
      deletedAt: null,
    };

    if (categoryId && categoryId !== "all") {
      where.categoryId = categoryId;
    }

    const subcategories = await db.subcategory.findMany({
      where,
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            products: {
              where: {
                deletedAt: null,
              },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(subcategories);
  } catch (error: any) {
    console.error("GET subcategories error:", error);
    return NextResponse.json({ error: "Failed to fetch subcategories" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  if (context.role === "CASHIER") {
    return roleErrorResponse();
  }

  try {
    const body = await request.json();
    const result = subcategorySchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.format() },
        { status: 400 }
      );
    }

    const subcategory = await db.subcategory.create({
      data: {
        name: result.data.name,
        categoryId: result.data.categoryId,
        businessId: context.businessId,
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json(subcategory, { status: 201 });
  } catch (error: any) {
    console.error("POST subcategory error:", error);
    return NextResponse.json({ error: "Failed to create subcategory" }, { status: 500 });
  }
}
