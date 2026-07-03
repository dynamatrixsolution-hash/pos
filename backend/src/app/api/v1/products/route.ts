import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse, roleErrorResponse } from "@/lib/api-helper";
import { z } from "zod";
import { logActivity } from "@/lib/activity-logger";

const productCreateSchema = z.object({
  name: z.string().min(2, "Product name must be at least 2 characters"),
  sku: z.string().optional().nullable(),
  barcode: z.string().optional().nullable(),
  description: z.string().optional(),
  costPrice: z.number().nonnegative().default(0),
  sellingPrice: z.number().nonnegative().default(0),
  wholesalePrice: z.number().nonnegative().default(0),
  alertQuantity: z.number().int().nonnegative().default(5),
  categoryId: z.string().uuid().optional().nullable(),
  subcategoryId: z.string().uuid().optional().nullable(),
  brandId: z.string().uuid().optional().nullable(),
  unitId: z.string().uuid().optional().nullable(),
  batchTracking: z.boolean().default(false),
  expiryTracking: z.boolean().default(false),
  image: z.string().optional().nullable(),
  initialStock: z.number().nonnegative().optional(), // optional initial stock for main branch
  manufacturingDate: z.string().optional().nullable(),
  expiryDate: z.string().optional().nullable(),
});

export async function GET(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";
  const categoryId = searchParams.get("categoryId");
  const subcategoryId = searchParams.get("subcategoryId");
  const brandId = searchParams.get("brandId");
  const lowStock = searchParams.get("lowStock") === "true";
  
  let branchId = searchParams.get("branchId") || context.branchId;
  if (context.role === "CASHIER") {
    branchId = context.branchId; // Cashiers can ONLY see their assigned branch stocks
  }

  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "20", 10);
  const skip = (page - 1) * limit;

  try {
    // Build filter conditions
    const where: any = {
      businessId: context.businessId,
      deletedAt: null,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { sku: { contains: search, mode: "insensitive" } },
        { barcode: { contains: search, mode: "insensitive" } },
      ];
    }

    if (categoryId && categoryId !== "all") {
      where.categoryId = categoryId;
    }

    if (subcategoryId && subcategoryId !== "all") {
      where.subcategoryId = subcategoryId;
    }

    if (brandId && brandId !== "all") {
      where.brandId = brandId;
    }

    if (lowStock && branchId) {
      // Find products where the active branch stock is less than alertQuantity
      where.productStocks = {
        some: {
          branchId: branchId,
          quantity: {
            lt: db.product.fields.alertQuantity,
          },
        },
      };
    }

    const [products, totalCount] = await Promise.all([
      db.product.findMany({
        where,
        include: {
          category: true,
          subcategory: true,
          brand: true,
          unit: true,
          productStocks: {
            where: branchId ? { branchId } : undefined,
          },
          batches: {
            where: {
              branchId: branchId ? branchId : undefined,
              deletedAt: null,
              quantity: { gt: 0 },
            },
            orderBy: { expiryDate: "asc" },
          },
        },
        orderBy: { name: "asc" },
        skip,
        take: limit,
      }),
      db.product.count({ where }),
    ]);

    return NextResponse.json({
      products,
      pagination: {
        totalItems: totalCount,
        totalPages: Math.ceil(totalCount / limit),
        currentPage: page,
        limit,
      },
    });
  } catch (error: any) {
    console.error("GET products error:", error);
    return NextResponse.json({ error: "Failed to retrieve products" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  try {
    const body = await request.json();
    const result = productCreateSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.format() },
        { status: 400 }
      );
    }

    const data = result.data;
    const { initialStock, manufacturingDate, expiryDate, ...productData } = data;

    // Create the product scoping to business
    const product = await db.$transaction(async (tx) => {
      const newProduct = await tx.product.create({
        data: {
          ...productData,
          businessId: context.businessId,
        },
      });

      // If initial stock and a branch context are available, set stock
      if (initialStock !== undefined && initialStock > 0 && context.branchId) {
        await tx.productStock.create({
          data: {
            productId: newProduct.id,
            branchId: context.branchId,
            quantity: initialStock,
          },
        });

        // Always create a default batch with mfg/expiry date if provided
        const batchNum = `BAT-${new Date().toISOString().slice(0, 10)}-${Math.floor(Math.random() * 1000)}`;
        await tx.batch.create({
          data: {
            productId: newProduct.id,
            branchId: context.branchId,
            batchNumber: batchNum,
            quantity: initialStock,
            costPrice: productData.costPrice,
            sellingPrice: productData.sellingPrice,
            expiryDate: expiryDate ? new Date(expiryDate) : null,
            manufacturingDate: manufacturingDate ? new Date(manufacturingDate) : null,
          },
        });
      }

      return newProduct;
    });

    await logActivity({
      userId: context.userId,
      businessId: context.businessId,
      role: context.role,
      moduleName: "PRODUCT",
      actionType: "CREATE",
      details: `Product "${product.name}" created with SKU ${product.sku || "N/A"}`,
      newValue: product,
      request,
    });

    return NextResponse.json(product, { status: 201 });
  } catch (error: any) {
    console.error("POST product error:", error);
    return NextResponse.json({ error: "Failed to create product" }, { status: 500 });
  }
}
