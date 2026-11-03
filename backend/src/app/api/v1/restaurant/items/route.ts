import { NextResponse } from "next/server";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";
import {
  createMenuItem,
  MenuCatalogError,
} from "@/lib/services/menu-catalog-service";
import { db } from "@/lib/db";
import { z } from "zod";

const createItemSchema = z.object({
  sectionId: z.string().min(1, "Section ID is required"),
  productId: z.string().optional().nullable(),
  name: z.string().trim().min(1, "Item name is required"),
  description: z.string().optional(),
  basePrice: z.union([z.number(), z.string()]),
  taxRate: z.union([z.number(), z.string()]).optional().default(13),
  imageUrl: z.string().optional().nullable(),
  isAvailable: z.boolean().optional().default(true),
  isKitchenItem: z.boolean().optional().default(true),
  prepTimeMinutes: z.coerce.number().optional().nullable(),
  modifierGroupIds: z.array(z.string()).optional().default([]),
});

export async function GET(req: Request) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();

    const items = await db.menuItem.findMany({
      where: { businessId: session.businessId },
      include: {
        section: { select: { id: true, name: true } },
        modifierGroups: {
          include: {
            modifierGroup: {
              include: { options: true },
            },
          },
          orderBy: { displayOrder: "asc" },
        },
        recipeVersions: {
          where: { isActive: true },
          include: {
            ingredients: {
              include: {
                product: {
                  select: { id: true, name: true, sku: true, unit: true },
                },
              },
            },
          },
        },
      },
      orderBy: [{ section: { displayOrder: "asc" } }, { displayOrder: "asc" }, { name: "asc" }],
    });

    return NextResponse.json({ items });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch menu items" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();

    const body = await req.json();
    const parsed = createItemSchema.parse(body);

    const item = await createMenuItem({
      businessId: session.businessId,
      sectionId: parsed.sectionId,
      productId: parsed.productId || undefined,
      name: parsed.name,
      description: parsed.description,
      basePrice: parsed.basePrice,
      taxRate: parsed.taxRate,
      imageUrl: parsed.imageUrl || undefined,
      isAvailable: parsed.isAvailable,
      isKitchenItem: parsed.isKitchenItem,
      prepTimeMinutes: parsed.prepTimeMinutes || undefined,
      modifierGroupIds: parsed.modifierGroupIds,
    });

    return NextResponse.json({ success: true, item }, { status: 201 });
  } catch (error: any) {
    if (error instanceof MenuCatalogError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Validation failed" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: error.message || "Failed to create menu item" },
      { status: 500 }
    );
  }
}

