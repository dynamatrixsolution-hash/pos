import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse, roleErrorResponse } from "@/lib/api-helper";
import { z } from "zod";
import { logActivity } from "@/lib/activity-logger";
import { broadcastSync } from "@/lib/websocket-client";

const adjustSchema = z.object({
  branchId: z.string().uuid("Invalid Branch ID"),
  type: z.enum(["INCREASE", "DECREASE"]),
  quantity: z.number().positive("Quantity must be positive"),
  reason: z.string().optional().nullable(),
});

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  // Block Cashiers from making manual stock adjustments
  if (context.role === "CASHIER") {
    return roleErrorResponse();
  }

  const { id: productId } = params;

  try {
    const body = await request.json();
    const result = adjustSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.format() },
        { status: 400 }
      );
    }

    const { branchId, type, quantity, reason } = result.data;

    // Verify product belongs to user's business
    const product = await db.product.findFirst({
      where: {
        id: productId,
        businessId: context.businessId,
        deletedAt: null,
      },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Get active/existing stock
    const stock = await db.productStock.findFirst({
      where: {
        productId,
        branchId,
      },
    });

    let oldQty = 0;
    let newQty = 0;

    if (stock) {
      oldQty = stock.quantity;
      newQty = type === "INCREASE" ? oldQty + quantity : Math.max(0, oldQty - quantity);
      await db.productStock.update({
        where: { id: stock.id },
        data: { quantity: newQty },
      });
    } else {
      newQty = type === "INCREASE" ? quantity : 0;
      await db.productStock.create({
        data: {
          productId,
          branchId,
          quantity: newQty,
        },
      });
    }

    // Log the stock adjustment
    await logActivity({
      userId: context.userId,
      businessId: context.businessId,
      role: context.role,
      moduleName: "INVENTORY",
      actionType: "STOCK_ADJUSTMENT",
      details: `Stock level adjusted for product "${product.name}" at branch: ${type} by ${quantity} units. (Reason: ${reason || "None"}). Old level: ${oldQty}, New level: ${newQty}`,
      oldValue: { quantity: oldQty },
      newValue: { quantity: newQty, type, reason },
      request,
    });

    broadcastSync("inventory", "adjust", { productId, newQty });

    return NextResponse.json({
      message: "Stock level adjusted successfully",
      productId,
      branchId,
      oldQuantity: oldQty,
      newQuantity: newQty,
    });
  } catch (error: any) {
    console.error("POST product adjust error:", error);
    return NextResponse.json({ error: "Failed to adjust product stock levels" }, { status: 500 });
  }
}
