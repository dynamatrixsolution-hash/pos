import { NextResponse } from "next/server";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";
import {
  createRecipeVersion,
  getActiveRecipe,
  RecipeServiceError,
} from "@/lib/services/recipe-consumption-service";
import { z } from "zod";

const recipeIngredientSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  quantity: z.union([z.number(), z.string()]),
  unit: z.string().min(1, "Unit is required"),
  wastagePercent: z.union([z.number(), z.string()]).optional().default(0),
});

const createRecipeSchema = z.object({
  menuItemId: z.string().min(1, "MenuItem ID is required"),
  versionNumber: z.number().int().positive().optional(),
  yieldQuantity: z.union([z.number(), z.string()]).optional().default(1),
  yieldUnit: z.string().optional().default("PORTION"),
  notes: z.string().optional(),
  isActive: z.boolean().optional().default(true),
  ingredients: z.array(recipeIngredientSchema).min(1, "At least one ingredient is required"),
});

export async function GET(req: Request) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();

    const { searchParams } = new URL(req.url);
    const menuItemId = searchParams.get("menuItemId");
    if (!menuItemId) return NextResponse.json({ error: "MenuItem ID is required" }, { status: 400 });

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

    const recipe = await createRecipeVersion({
      businessId: session.businessId,
      menuItemId: parsed.menuItemId,
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

