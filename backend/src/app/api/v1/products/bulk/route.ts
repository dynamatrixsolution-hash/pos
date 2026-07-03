import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse, roleErrorResponse } from "@/lib/api-helper";
import { z } from "zod";
import { logActivity } from "@/lib/activity-logger";
import crypto from "crypto";

const bulkProductItemSchema = z.object({
  name: z.string().min(1, "Product name is required"),
  sku: z.string().optional().nullable(),
  costPrice: z.number().nonnegative().default(0),
  sellingPrice: z.number().nonnegative().default(0),
  wholesalePrice: z.number().nonnegative().default(0),
  alertQuantity: z.number().int().nonnegative().default(5),
  initialStock: z.number().nonnegative().default(0),
  isVatItem: z.boolean().default(true),
  unitName: z.string().optional().nullable(),
  categoryName: z.string().optional().nullable(),
  subcategoryName: z.string().optional().nullable(),
});

const bulkImportSchema = z.object({
  products: z.array(bulkProductItemSchema).min(1, "At least one product is required"),
});

export async function POST(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  if (context.role === "CASHIER") {
    return roleErrorResponse();
  }

  try {
    const body = await request.json();
    const result = bulkImportSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.format() },
        { status: 400 }
      );
    }

    const { products } = result.data;
    const businessId = context.businessId;

    // Load existing lookup caches for instant in-memory resolution
    const [existingCategories, existingSubcategories, existingUnits] = await Promise.all([
      db.category.findMany({ where: { businessId, deletedAt: null } }),
      db.subcategory.findMany({ where: { businessId, deletedAt: null } }),
      db.unit.findMany({ where: { businessId, deletedAt: null } }),
    ]);

    const categoryMap = new Map<string, string>();
    existingCategories.forEach((c) => categoryMap.set(c.name.toLowerCase(), c.id));

    const subcategoryMap = new Map<string, string>();
    existingSubcategories.forEach((sc) =>
      subcategoryMap.set(`${sc.categoryId}:${sc.name.toLowerCase()}`, sc.id)
    );

    const unitMap = new Map<string, string>();
    existingUnits.forEach((u) => unitMap.set(u.name.toLowerCase(), u.id));

    // Batch prepare missing Units, Categories, and Subcategories
    const unitsToCreate: any[] = [];
    for (const item of products) {
      if (item.unitName && item.unitName.trim()) {
        const uName = item.unitName.trim();
        const uKey = uName.toLowerCase();
        if (!unitMap.has(uKey) && !unitsToCreate.some((u) => u.name.toLowerCase() === uKey)) {
          const uId = crypto.randomUUID();
          unitMap.set(uKey, uId);
          unitsToCreate.push({ id: uId, name: uName, businessId });
        }
      }
    }
    if (unitsToCreate.length > 0) {
      await db.unit.createMany({ data: unitsToCreate });
    }

    const categoriesToCreate: any[] = [];
    for (const item of products) {
      if (item.categoryName && item.categoryName.trim()) {
        const cName = item.categoryName.trim();
        const cKey = cName.toLowerCase();
        if (!categoryMap.has(cKey) && !categoriesToCreate.some((c) => c.name.toLowerCase() === cKey)) {
          const cId = crypto.randomUUID();
          categoryMap.set(cKey, cId);
          categoriesToCreate.push({ id: cId, name: cName, businessId });
        }
      }
    }
    if (categoriesToCreate.length > 0) {
      await db.category.createMany({ data: categoriesToCreate });
    }

    const subcategoriesToCreate: any[] = [];
    for (const item of products) {
      if (item.categoryName && item.categoryName.trim() && item.subcategoryName && item.subcategoryName.trim()) {
        const catId = categoryMap.get(item.categoryName.trim().toLowerCase());
        if (catId) {
          const subName = item.subcategoryName.trim();
          const subKey = `${catId}:${subName.toLowerCase()}`;
          if (!subcategoryMap.has(subKey) && !subcategoriesToCreate.some((s) => s.categoryId === catId && s.name.toLowerCase() === subName.toLowerCase())) {
            const subId = crypto.randomUUID();
            subcategoryMap.set(subKey, subId);
            subcategoriesToCreate.push({ id: subId, name: subName, categoryId: catId, businessId });
          }
        }
      }
    }
    if (subcategoriesToCreate.length > 0) {
      await db.subcategory.createMany({ data: subcategoriesToCreate });
    }

    // Batch prepare Products, Stock Entries, and Batches
    const productsToInsert: any[] = [];
    const stocksToInsert: any[] = [];
    const batchesToInsert: any[] = [];
    const now = new Date();

    for (const item of products) {
      const productId = crypto.randomUUID();
      const unitId = item.unitName ? unitMap.get(item.unitName.trim().toLowerCase()) || null : null;
      const categoryId = item.categoryName ? categoryMap.get(item.categoryName.trim().toLowerCase()) || null : null;
      const subcategoryId = categoryId && item.subcategoryName ? subcategoryMap.get(`${categoryId}:${item.subcategoryName.trim().toLowerCase()}`) || null : null;

      productsToInsert.push({
        id: productId,
        businessId,
        name: item.name,
        sku: item.sku || null,
        costPrice: item.costPrice,
        sellingPrice: item.sellingPrice,
        wholesalePrice: item.wholesalePrice,
        alertQuantity: item.alertQuantity,
        isVatItem: item.isVatItem,
        categoryId,
        subcategoryId,
        unitId,
        createdAt: now,
        updatedAt: now,
      });

      if (item.initialStock > 0 && context.branchId) {
        stocksToInsert.push({
          id: crypto.randomUUID(),
          productId,
          branchId: context.branchId,
          quantity: item.initialStock,
          createdAt: now,
          updatedAt: now,
        });

        const batchNum = `BAT-${now.toISOString().slice(0, 10)}-${Math.floor(Math.random() * 100000)}`;
        batchesToInsert.push({
          id: crypto.randomUUID(),
          productId,
          branchId: context.branchId,
          batchNumber: batchNum,
          quantity: item.initialStock,
          costPrice: item.costPrice,
          sellingPrice: item.sellingPrice,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    // Execute ultra-fast bulk insertions in parallel/batch queries
    await db.product.createMany({ data: productsToInsert });
    if (stocksToInsert.length > 0) {
      await db.productStock.createMany({ data: stocksToInsert });
    }
    if (batchesToInsert.length > 0) {
      await db.batch.createMany({ data: batchesToInsert });
    }

    await logActivity({
      userId: context.userId,
      businessId: context.businessId,
      role: context.role,
      moduleName: "PRODUCT",
      actionType: "CREATE",
      details: `Bulk imported ${productsToInsert.length} products via Excel (High-speed batch)`,
      request,
    });

    return NextResponse.json(
      { success: true, count: productsToInsert.length, message: `Successfully imported ${productsToInsert.length} products.` },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Bulk import products error:", error);
    return NextResponse.json({ error: error.message || "Failed to bulk import products" }, { status: 500 });
  }
}
