import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse, roleErrorResponse } from "@/lib/api-helper";
import { z } from "zod";

const categorySchema = z.object({
  name: z.string().min(1, "Name is required"),
});

export async function GET() {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  try {
    const categories = await db.category.findMany({
      where: {
        businessId: context.businessId,
        deletedAt: null,
      },
      include: {
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

    return NextResponse.json(categories);
  } catch (error: any) {
    console.error("GET categories error:", error);
    return NextResponse.json({ error: "Failed to fetch categories" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  // Block Cashiers from creating categories
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

    // Check category limit from subscription settings
    const subscription = await db.subscription.findUnique({
      where: { businessId: context.businessId },
    });
    if (subscription) {
      const planName = subscription.plan || "STARTER";
      const platform = await db.business.findUnique({
        where: { slug: "platform-admin" },
        select: { settings: true },
      });
      const settings = (platform?.settings as any) || {};
      const limits = settings.limits || {
        Starter: { categories: 10 },
        Professional: { categories: 999999 },
        Enterprise: { categories: 999999 },
      };

      const limitKey = Object.keys(limits).find(k => k.toUpperCase() === planName.toUpperCase()) || "Starter";
      const maxCategories = limits[limitKey]?.categories || 10;

      const categoryCount = await db.category.count({
        where: { businessId: context.businessId, deletedAt: null },
      });

      if (categoryCount >= maxCategories) {
        return NextResponse.json(
          { error: `Category limit reached. Your subscription plan "${planName}" allows a maximum of ${maxCategories} categories. Please upgrade your plan.` },
          { status: 400 }
        );
      }
    }

      const name = result.data.name.trim();
      const existing = await db.category.findFirst({
        where: {
          businessId: context.businessId,
          name: { equals: name, mode: "insensitive" },
          deletedAt: null,
        },
      });

      if (existing) {
        return NextResponse.json({ error: "Category with this name already exists" }, { status: 400 });
      }

      const category = await db.category.create({
        data: {
          name,
          businessId: context.businessId,
        },
      });

    return NextResponse.json(category, { status: 201 });
  } catch (error: any) {
    console.error("POST category error:", error);
    return NextResponse.json({ error: "Failed to create category" }, { status: 500 });
  }
}
