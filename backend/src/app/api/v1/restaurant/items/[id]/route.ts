import { NextResponse } from "next/server";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";
import {
  updateMenuItem,
  deleteMenuItem,
  MenuCatalogError,
} from "@/lib/services/menu-catalog-service";
import { db } from "@/lib/db";
import { z } from "zod";

const updateItemSchema = z.object({
  sectionId: z.string().optional(),
  name: z.string().trim().min(1).optional(),
  description: z.string().optional().nullable(),
  basePrice: z.union([z.number(), z.string()]).optional(),
  taxRate: z.union([z.number(), z.string()]).optional(),
  imageUrl: z.string().optional().nullable(),
  isAvailable: z.boolean().optional(),
  prepTimeMinutes: z.coerce.number().optional().nullable(),
  modifierGroupIds: z.array(z.string()).optional(),
});

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();

    const { id } = await params;
    const item = await db.menuItem.findFirst({
      where: { id, businessId: session.businessId },
      include: {
        section: true,
        modifierGroups: {
          include: {
            modifierGroup: {
              include: { options: true },
            },
          },
        },
        recipeVersions: {
          where: { isActive: true },
          include: {
            ingredients: {
              include: { product: true },
            },
          },
        },
      },
    });

    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    return NextResponse.json({ item });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch item" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();

    const { id } = await params;
    const body = await req.json();
    const parsed = updateItemSchema.parse(body);

    const item = await updateMenuItem(session.businessId, id, parsed);
    return NextResponse.json({ success: true, item });
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
      { error: error.message || "Failed to update menu item" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();

    const { id } = await params;
    await deleteMenuItem(session.businessId, id);
    return NextResponse.json({ success: true, message: "Item deleted successfully" });
  } catch (error: any) {
    if (error instanceof MenuCatalogError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { error: error.message || "Failed to delete item" },
      { status: 500 }
    );
  }
}

