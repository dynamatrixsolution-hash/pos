import { db } from "@/lib/db";
import { Prisma } from "@dynapos/db";
import { stockQty, toDecimal } from "@/lib/services/decimal-math";
import { recordStockMovement } from "@/lib/services/stock-ledger-service";
import { createAuditEvent } from "@/lib/audit-event";

export class RecipeServiceError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "RecipeServiceError";
    this.statusCode = statusCode;
  }
}

export interface RecipeIngredientInput {
  productId: string;
  quantity: number | string | Prisma.Decimal;
  unit: string;
  wastagePercent?: number | string | Prisma.Decimal;
}

export interface CreateRecipeVersionInput {
  businessId: string;
  menuItemId: string;
  versionNumber?: number;
  yieldQuantity?: number | string | Prisma.Decimal;
  yieldUnit?: string;
  notes?: string;
  isActive?: boolean;
  ingredients: RecipeIngredientInput[];
}

export interface DeductIngredientsInput {
  businessId: string;
  branchId: string;
  ticketLineId: string;
  actorId?: string;
  isWaste?: boolean;
  wasteReason?: string;
}

/**
 * Create a new version of a recipe Bill-of-Materials (BOM) for a MenuItem.
 */
export async function createRecipeVersion(
  input: CreateRecipeVersionInput,
  externalTx?: Prisma.TransactionClient
) {
  const runner = async (tx: Prisma.TransactionClient) => {
    // 1. Verify MenuItem
    const menuItem = await tx.menuItem.findFirst({
      where: { id: input.menuItemId, businessId: input.businessId },
    });

    if (!menuItem) {
      throw new RecipeServiceError("MenuItem not found", 404);
    }

    // 2. Determine version number
    let vNumber = input.versionNumber;
    if (!vNumber) {
      const latest = await tx.recipeVersion.findFirst({
        where: { businessId: input.businessId, menuItemId: input.menuItemId },
        orderBy: { versionNumber: "desc" },
      });
      vNumber = (latest?.versionNumber || 0) + 1;
    }

    // 3. If new recipe is active, deactivate previous versions
    const makeActive = input.isActive ?? true;
    if (makeActive) {
      await tx.recipeVersion.updateMany({
        where: { businessId: input.businessId, menuItemId: input.menuItemId },
        data: { isActive: false },
      });
    }

    // 4. Create RecipeVersion
    const recipe = await tx.recipeVersion.create({
      data: {
        businessId: input.businessId,
        menuItemId: input.menuItemId,
        versionNumber: vNumber,
        yieldQuantity: input.yieldQuantity !== undefined ? stockQty(input.yieldQuantity) : new Prisma.Decimal(1),
        yieldUnit: input.yieldUnit || "PORTION",
        isActive: makeActive,
        notes: input.notes || null,
      },
    });

    // 5. Create RecipeIngredients
    for (const ing of input.ingredients) {
      const product = await tx.product.findFirst({
        where: { id: ing.productId, businessId: input.businessId },
      });
      if (!product) {
        throw new RecipeServiceError(`Product ${ing.productId} not found in inventory`, 404);
      }

      await tx.recipeIngredient.create({
        data: {
          businessId: input.businessId,
          recipeVersionId: recipe.id,
          productId: ing.productId,
          quantity: stockQty(ing.quantity),
          unit: ing.unit,
          wastagePercent: ing.wastagePercent !== undefined ? toDecimal(ing.wastagePercent) : new Prisma.Decimal(0),
        },
      });
    }

    return await tx.recipeVersion.findUnique({
      where: { id: recipe.id },
      include: {
        ingredients: {
          include: { product: true },
        },
      },
    });
  };

  if (externalTx) return await runner(externalTx);
  return await db.$transaction(runner);
}

/**
 * Fetch the current active recipe for a MenuItem
 */
export async function getActiveRecipe(businessId: string, menuItemId: string) {
  return await db.recipeVersion.findFirst({
    where: {
      businessId,
      menuItemId,
      isActive: true,
    },
    include: {
      ingredients: {
        include: { product: true },
      },
    },
  });
}

/**
 * Deduct raw inventory ingredients when an item is marked READY or cooked.
 * Invariant: Exactly once per ticketLineId!
 */
export async function deductRecipeIngredientsForTicketLine(
  input: DeductIngredientsInput,
  externalTx?: Prisma.TransactionClient
) {
  const runner = async (tx: Prisma.TransactionClient) => {
    // 1. Check idempotency: if already deducted, return existing postings
    const existingPostings = await tx.consumptionPosting.findMany({
      where: { businessId: input.businessId, ticketLineId: input.ticketLineId },
    });

    if (existingPostings.length > 0) {
      return existingPostings;
    }

    // 2. Fetch ticket line with order line
    const ticketLine = await tx.kitchenTicketLine.findFirst({
      where: { id: input.ticketLineId, businessId: input.businessId },
      include: { orderLine: true },
    });

    if (!ticketLine) {
      throw new RecipeServiceError("Kitchen ticket line not found", 404);
    }

    if (!ticketLine.orderLine.menuItemId) {
      return []; // Manual custom item without recipe
    }

    // 3. Find active recipe version
    const recipe = await tx.recipeVersion.findFirst({
      where: {
        businessId: input.businessId,
        menuItemId: ticketLine.orderLine.menuItemId,
        isActive: true,
      },
      include: { ingredients: true },
    });

    if (!recipe || recipe.ingredients.length === 0) {
      return []; // No recipe defined for this dish
    }

    const createdPostings = [];
    const lineQty = new Prisma.Decimal(ticketLine.quantity);

    // 4. For each ingredient, calculate required stock and deduct
    for (const ing of recipe.ingredients) {
      // qty = (ing.quantity * lineQty) / recipe.yieldQuantity * (1 + wastage / 100)
      const baseDeduction = ing.quantity.mul(lineQty).div(recipe.yieldQuantity);
      const wastageMultiplier = new Prisma.Decimal(1).add(ing.wastagePercent.div(100));
      const totalIngredientDeduction = stockQty(baseDeduction.mul(wastageMultiplier));

      // Record negative stock movement in authoritative ledger
      const eventKey = input.isWaste
        ? `WASTE-${ticketLine.id}-${ing.productId}`
        : `CONSUMPTION-${ticketLine.id}-${ing.productId}`;

      const movement = await recordStockMovement(
        tx,
        {
          businessId: input.businessId,
          branchId: input.branchId,
          productId: ing.productId,
          quantity: totalIngredientDeduction.negated(),
          unit: ing.unit,
          sourceType: "SALE",
          sourceId: ticketLine.id,
          eventKey,
          actorId: input.actorId,
          allowNegativeStock: true,
          notes: input.isWaste
            ? `Kitchen Waste: ${input.wasteReason || "Item cancelled after cooking started"}`
            : `Dish preparation: ${ticketLine.itemName} (${ticketLine.quantity}x)`,
        }
      );

      // Record consumption posting
      const posting = await tx.consumptionPosting.create({
        data: {
          businessId: input.businessId,
          branchId: input.branchId,
          ticketLineId: ticketLine.id,
          recipeVersionId: recipe.id,
          productId: ing.productId,
          quantity: totalIngredientDeduction,
          unit: ing.unit,
          stockMovementId: movement.id,
          isWaste: input.isWaste ?? false,
          reason: input.wasteReason || null,
          postedById: input.actorId || null,
        },
      });

      createdPostings.push(posting);
    }

    // 5. Audit event
    await createAuditEvent(
      {
        businessId: input.businessId,
        branchId: input.branchId,
        userId: input.actorId,
        action: input.isWaste ? "KITCHEN_WASTE_RECORDED" : "RECIPE_INGREDIENTS_CONSUMED",
        entity: "ConsumptionPosting",
        entityId: ticketLine.id,
        reason: input.wasteReason,
        metadata: {
          itemName: ticketLine.itemName,
          quantity: ticketLine.quantity,
          ingredientsCount: createdPostings.length,
        },
      },
      tx
    );

    return createdPostings;
  };

  if (externalTx) return await runner(externalTx);
  return await db.$transaction(runner, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  });
}
