import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse, roleErrorResponse, getBusinessLimits } from "@/lib/api-helper";
import { z } from "zod";
import { logActivity } from "@/lib/activity-logger";

const productCreateSchema = z.object({
  name: z.string().min(2, "Product name must be at least 2 characters"),
  sku: z.string().optional().nullable(),
  barcode: z.string().optional().nullable(),
  description: z.string().optional(),
  costPrice: z.number().min(1, "Cost price must be at least 1"),
  sellingPrice: z.number().min(1, "Selling price must be at least 1"),
  wholesalePrice: z.number().nonnegative().default(0),
  alertQuantity: z.number().int().nonnegative().default(5),
  categoryId: z.string().uuid().optional().nullable(),
  subcategoryId: z.string().uuid().optional().nullable(),
  brandId: z.string().uuid().optional().nullable(),
  unitId: z.string().uuid().optional().nullable(),
  batchTracking: z.boolean().default(false),
  expiryTracking: z.boolean().default(false),
  isVatItem: z.boolean().default(true),
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
      // Find products where the active branch stock is less than alertQuantity using raw SQL query to get product IDs
      const lowStockProducts = await db.$queryRaw<Array<{ productId: string }>>`
        SELECT ps."productId"
        FROM "ProductStock" ps
        JOIN "Product" p ON ps."productId" = p.id
        WHERE ps."branchId" = ${branchId}
          AND ps.quantity < p."alertQuantity"
      `;
      const lowStockIds = lowStockProducts.map(p => p.productId);
      where.id = { in: lowStockIds };
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
    return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 });
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

    // Check product limit from subscription settings
    const limits = await getBusinessLimits(context.businessId);
    if (limits) {
      const maxProducts = limits.products;
      const productCount = await db.product.count({
        where: { businessId: context.businessId, deletedAt: null },
      });

      if (productCount >= maxProducts) {
        return NextResponse.json(
          { error: `Product limit reached. Your subscription allows a maximum of ${maxProducts} products. Please upgrade your plan.` },
          { status: 400 }
        );
      }
    }

    // Check if a product with the same name, SKU, or barcode already exists for this business
    const existingProduct = await db.product.findFirst({
      where: {
        businessId: context.businessId,
        deletedAt: null,
        OR: [
          { name: { equals: productData.name, mode: "insensitive" } },
          ...(productData.sku ? [{ sku: productData.sku }] : []),
          ...(productData.barcode ? [{ barcode: productData.barcode }] : []),
        ],
      },
    });

    if (existingProduct) {
      const addedQty = (initialStock !== undefined && initialStock > 0) ? initialStock : 1;
      const updated = await db.$transaction(async (tx) => {
        // Update product prices if provided
        const prod = await tx.product.update({
          where: { id: existingProduct.id },
          data: {
            costPrice: productData.costPrice || existingProduct.costPrice,
            sellingPrice: productData.sellingPrice || existingProduct.sellingPrice,
            wholesalePrice: productData.wholesalePrice || existingProduct.wholesalePrice,
            description: productData.description || existingProduct.description,
          },
        });

        if (context.branchId) {
          const currentStock = await tx.productStock.findUnique({
            where: {
              productId_branchId: {
                productId: existingProduct.id,
                branchId: context.branchId,
              },
            },
          });

          if (currentStock) {
            await tx.productStock.update({
              where: { id: currentStock.id },
              data: { quantity: { increment: addedQty } },
            });
          } else {
            await tx.productStock.create({
              data: {
                productId: existingProduct.id,
                branchId: context.branchId,
                quantity: addedQty,
              },
            });
          }

          // Create/update batch
          const batchNum = `BAT-${new Date().toISOString().slice(0, 10)}-${Math.floor(Math.random() * 1000)}`;
          await tx.batch.create({
            data: {
              productId: existingProduct.id,
              branchId: context.branchId,
              batchNumber: batchNum,
              quantity: addedQty,
              costPrice: prod.costPrice,
              sellingPrice: prod.sellingPrice,
              expiryDate: expiryDate ? new Date(expiryDate) : null,
              manufacturingDate: manufacturingDate ? new Date(manufacturingDate) : null,
            },
          });
        }
        return prod;
      });

      await logActivity({
        userId: context.userId,
        businessId: context.businessId,
        role: context.role,
        moduleName: "PRODUCT",
        actionType: "STOCK_ADJUSTMENT",
        details: `Existing product "${existingProduct.name}" quantity increased by ${addedQty}`,
        newValue: updated,
        request,
      });

      return NextResponse.json(updated, { status: 200 });
    }

    // Create new product if it doesn't exist
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
