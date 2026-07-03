import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";
import { z } from "zod";

const adjustmentSchema = z.object({
  productId: z.string().uuid(),
  branchId: z.string().uuid(),
  type: z.enum(["STOCK_IN", "STOCK_OUT", "DAMAGE", "ADJUSTMENT"]),
  quantity: z.number().positive("Quantity must be a positive number"),
  notes: z.string().optional().nullable(),
});

export async function POST(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  try {
    const body = await request.json();
    const result = adjustmentSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.format() },
        { status: 400 }
      );
    }

    const { productId, branchId, type, quantity, notes } = result.data;

    // Verify product exists and belongs to business
    const product = await db.product.findFirst({
      where: { id: productId, businessId: context.businessId, deletedAt: null },
    });
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Run transaction
    const adjustmentResult = await db.$transaction(async (tx) => {
      // Find current stock
      const stock = await tx.productStock.findUnique({
        where: { productId_branchId: { productId, branchId } },
      });

      let currentQty = stock ? stock.quantity : 0;
      let newQty = currentQty;

      if (type === "STOCK_IN") {
        newQty = currentQty + quantity;
      } else if (type === "STOCK_OUT" || type === "DAMAGE") {
        if (currentQty < quantity) {
          throw new Error(`Insufficient stock for adjustment. Available: ${currentQty}, Requested reduction: ${quantity}`);
        }
        newQty = currentQty - quantity;
      } else if (type === "ADJUSTMENT") {
        newQty = quantity;
      }

      // Upsert product stock
      let updatedStock;
      if (stock) {
        updatedStock = await tx.productStock.update({
          where: { id: stock.id },
          data: { quantity: newQty },
        });
      } else {
        updatedStock = await tx.productStock.create({
          data: {
            productId,
            branchId,
            quantity: newQty,
          },
        });
      }

      // Trigger stock alert if under limit
      if (newQty <= product.alertQuantity) {
        await tx.notification.create({
          data: {
            title: "Manual Stock Adjustment Alert",
            message: `Product "${product.name}" is low in stock after adjustment (${newQty} remaining in branch).`,
            type: "STOCK",
            businessId: context.businessId,
          },
        });
      }

      // Log adjustment audit details
      await tx.auditLog.create({
        data: {
          businessId: context.businessId,
          userId: context.userId,
          action: "UPDATE",
          module: "INVENTORY",
          details: `Manual inventory adjustment (${type}) for product "${product.name}". Qty adjusted: ${quantity}, Notes: ${notes || "None"}`,
        },
      });

      return updatedStock;
    });

    return NextResponse.json({
      message: "Inventory adjusted successfully",
      stock: adjustmentResult,
    });
  } catch (error: any) {
    console.error("POST inventory adjust error:", error.message);
    return NextResponse.json({ error: error.message || "Failed to adjust inventory" }, { status: 500 });
  }
}
