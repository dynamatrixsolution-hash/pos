import { NextResponse } from "next/server";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";
import {
  createRecipeVersion,
  getActiveRecipe,
  RecipeServiceError,
} from "@/lib/services/recipe-consumption-service";
import { getOrCreateDefaultSection } from "@/lib/services/menu-catalog-service";
import { db } from "@/lib/db";
import { z } from "zod";

const recipeIngredientSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  quantity: z.union([z.number(), z.string()]),
  unit: z.string().min(1, "Unit is required"),
  wastagePercent: z.union([z.number(), z.string()]).optional().default(0),
});

const createRecipeSchema = z.object({
  menuItemId: z.string().optional(),
  productId: z.string().optional(),
  versionNumber: z.number().int().positive().optional(),
  yieldQuantity: z.union([z.number(), z.string()]).optional().default(1),
  yieldUnit: z.string().optional().default("PORTION"),
  notes: z.string().optional(),
  isActive: z.boolean().optional().default(true),
  ingredients: z.array(recipeIngredientSchema).min(1, "At least one ingredient is required"),
}).refine((data) => data.menuItemId || data.productId, {
  message: "Either menuItemId or productId must be provided",
});

export async function GET(req: Request) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();

    const { searchParams } = new URL(req.url);
    let menuItemId = searchParams.get("menuItemId");
    const productId = searchParams.get("productId");

    if (!menuItemId && productId) {
      const item = await db.menuItem.findFirst({
        where: { businessId: session.businessId, productId },
      });
      if (item) menuItemId = item.id;
    }

    if (!menuItemId) {
      return NextResponse.json({ recipe: null });
    }

    const recipe = await getActiveRecipe(session.businessId, menuItemId);
    return NextResponse.json({ recipe });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch recipe" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();

    const body = await req.json();
    const parsed = createRecipeSchema.parse(body);

    let targetMenuItemId = parsed.menuItemId;

    if (!targetMenuItemId && parsed.productId) {
      let item = await db.menuItem.findFirst({
        where: { businessId: session.businessId, productId: parsed.productId },
      });

      if (!item) {
        const product = await db.product.findFirst({
          where: { businessId: session.businessId, id: parsed.productId },
          include: { category: true },
        });
        if (!product) {
          return NextResponse.json({ error: "Product not found" }, { status: 404 });
        }

        const section = await getOrCreateDefaultSection(
          session.businessId,
          product.category?.name || "Main Course"
        );

        item = await db.menuItem.create({
          data: {
            businessId: session.businessId,
            sectionId: section.id,
            productId: product.id,
            name: product.name,
            description: product.description || null,
            basePrice: product.sellingPrice,
            taxRate: product.isVatItem ? 13 : 0,
            imageUrl: product.image || null,
            isAvailable: true,
            isKitchenItem: true,
          },
        });
      }

      targetMenuItemId = item.id;
    }

    if (!targetMenuItemId) {
      return NextResponse.json({ error: "MenuItem could not be identified or created" }, { status: 400 });
    }

    const recipe = await createRecipeVersion({
      businessId: session.businessId,
      menuItemId: targetMenuItemId,
      versionNumber: parsed.versionNumber,
      yieldQuantity: parsed.yieldQuantity,
      yieldUnit: parsed.yieldUnit,
      notes: parsed.notes,
      isActive: parsed.isActive,
      ingredients: parsed.ingredients,
    });

    return NextResponse.json({ success: true, recipe }, { status: 201 });
  } catch (error: any) {
    if (error instanceof RecipeServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Validation failed" }, { status: 400 });
    }
    return NextResponse.json({ error: error.message || "Failed to create recipe" }, { status: 500 });
  }
}

