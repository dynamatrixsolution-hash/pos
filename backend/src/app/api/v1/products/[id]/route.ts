import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse, roleErrorResponse } from "@/lib/api-helper";
import { z } from "zod";
import { logActivity } from "@/lib/activity-logger";

const productUpdateSchema = z.object({
  name: z.string().min(2, "Product name must be at least 2 characters").optional(),
  sku: z.string().optional().nullable(),
  barcode: z.string().optional().nullable(),
  description: z.string().optional(),
  costPrice: z.number().nonnegative().optional(),
  sellingPrice: z.number().nonnegative().optional(),
  wholesalePrice: z.number().nonnegative().optional(),
  alertQuantity: z.number().int().nonnegative().optional(),
  categoryId: z.string().uuid().optional().nullable(),
  subcategoryId: z.string().uuid().optional().nullable(),
  brandId: z.string().uuid().optional().nullable(),
  unitId: z.string().uuid().optional().nullable(),
  batchTracking: z.boolean().optional(),
  expiryTracking: z.boolean().optional(),
  image: z.string().optional().nullable(),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  const { id } = await params;

  try {
    const product = await db.product.findFirst({
      where: {
        id,
        businessId: context.businessId,
        deletedAt: null,
      },
      include: {
        category: true,
        subcategory: true,
        brand: true,
        unit: true,
        productStocks: {
          where: context.role === "CASHIER" && context.branchId ? { branchId: context.branchId } : undefined,
        },
        batches: {
          where: {
            deletedAt: null,
            branchId: context.role === "CASHIER" && context.branchId ? context.branchId : undefined,
          },
        },
      },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    return NextResponse.json(product);
  } catch (error: any) {
    console.error("GET product details error:", error);
    return NextResponse.json({ error: "Failed to fetch product details" }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  // Block Cashiers from modifying products
  if (context.role === "CASHIER") {
    return roleErrorResponse();
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const result = productUpdateSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.format() },
        { status: 400 }
      );
    }

    // Verify product belongs to user's business
    const existingProduct = await db.product.findFirst({
      where: {
        id,
        businessId: context.businessId,
        deletedAt: null,
      },
    });

    if (!existingProduct) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const updatedProduct = await db.product.update({
      where: { id },
      data: result.data,
    });

    await logActivity({
      userId: context.userId,
      businessId: context.businessId,
      role: context.role,
      moduleName: "PRODUCT",
      actionType: "UPDATE",
      details: `Updated product details for product: ${updatedProduct.name}`,
      oldValue: existingProduct,
      newValue: updatedProduct,
      request,
    });

    return NextResponse.json(updatedProduct);
  } catch (error: any) {
    console.error("PUT product details error:", error);
    return NextResponse.json({ error: "Failed to update product" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  // Block Cashiers from deleting products
  if (context.role === "CASHIER") {
    return roleErrorResponse();
  }

  const { id } = await params;

  try {
    // Verify product belongs to business
    const existingProduct = await db.product.findFirst({
      where: {
        id,
        businessId: context.businessId,
        deletedAt: null,
      },
    });

    if (!existingProduct) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Soft delete the product
    await db.product.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });

    await logActivity({
      userId: context.userId,
      businessId: context.businessId,
      role: context.role,
      moduleName: "PRODUCT",
      actionType: "DELETE",
      details: `Product "${existingProduct.name}" deleted (soft delete)`,
      oldValue: existingProduct,
      request,
    });

    return NextResponse.json({ message: "Product deleted successfully" });
  } catch (error: any) {
    console.error("DELETE product error:", error);
    return NextResponse.json({ error: "Failed to delete product" }, { status: 500 });
  }
}
