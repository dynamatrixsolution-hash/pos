import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";
import { logActivity } from "@/lib/activity-logger";
import { z } from "zod";

const openingStockItemSchema = z.object({
  productId: z.string().uuid(),
  branchId: z.string().uuid(),
  warehouseId: z.string().uuid().optional().nullable(),
  quantity: z.number().positive(),
  unitType: z.enum(["pcs", "box", "strip", "tablet", "bottle", "kg", "gram", "liter", "ml"]),
  purchaseRate: z.number().nonnegative(),
  sellingPrice: z.number().nonnegative(),
  mrp: z.number().nonnegative(),
  batchNumber: z.string().optional().nullable(),
  expiryDate: z.string().optional().nullable(),
  manufacturingDate: z.string().optional().nullable(),
  rackNumber: z.string().optional().nullable(),
  supplierId: z.string().uuid().optional().nullable(),
  remarks: z.string().optional().nullable(),
  approvalStatus: z.enum(["PENDING", "APPROVED", "REJECTED"]).default("PENDING"),
});

const bulkImportSchema = z.array(openingStockItemSchema);

export async function GET(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const branchId = searchParams.get("branchId");
    const supplierId = searchParams.get("supplierId");
    const approvalStatus = searchParams.get("approvalStatus");

    const isOwner = ["SUPER_ADMIN", "OWNER"].includes(context.role);
    const userBranchId = context.branchId;

    const where: any = {
      businessId: context.businessId,
    };

    if (!isOwner && userBranchId) {
      where.branchId = userBranchId;
    } else if (branchId) {
      where.branchId = branchId;
    }

    if (supplierId) {
      where.supplierId = supplierId;
    }

    if (approvalStatus) {
      where.approvalStatus = approvalStatus;
    }

    if (search) {
      where.OR = [
        { product: { name: { contains: search } } },
        { product: { sku: { contains: search } } },
        { product: { barcode: { contains: search } } },
        { batchNumber: { contains: search } },
      ];
    }

    const entries = await db.openingStock.findMany({
      where,
      include: {
        product: {
          select: {
            name: true,
            sku: true,
            barcode: true,
            category: { select: { name: true } },
            brand: { select: { name: true } },
          },
        },
        branch: { select: { name: true } },
        supplier: { select: { name: true } },
        enteredBy: { select: { name: true } },
        approvedBy: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ entries });
  } catch (error: any) {
    console.error("GET opening stock error:", error);
    return NextResponse.json({ error: "Failed to fetch opening stock entries" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  try {
    const body = await request.json();
    const isBulk = Array.isArray(body);

    if (isBulk) {
      const result = bulkImportSchema.safeParse(body);
      if (!result.success) {
        return NextResponse.json({ error: "Validation failed", details: result.error.format() }, { status: 400 });
      }

      const items = result.data;
      const createdEntries = [];

      for (const item of items) {
        const totalValue = item.quantity * item.purchaseRate;
        const entry = await db.openingStock.create({
          data: {
            businessId: context.businessId,
            branchId: item.branchId,
            warehouseId: item.warehouseId || item.branchId,
            productId: item.productId,
            quantity: item.quantity,
            unitType: item.unitType,
            purchaseRate: item.purchaseRate,
            sellingPrice: item.sellingPrice,
            mrp: item.mrp,
            totalValue,
            batchNumber: item.batchNumber,
            expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
            manufacturingDate: item.manufacturingDate ? new Date(item.manufacturingDate) : null,
            rackNumber: item.rackNumber,
            supplierId: item.supplierId,
            remarks: item.remarks,
            enteredById: context.userId,
            approvalStatus: item.approvalStatus,
            approvedById: item.approvalStatus === "APPROVED" ? context.userId : null,
          },
        });

        if (item.approvalStatus === "APPROVED") {
          await approveOpeningStockTransaction(entry.id, context.businessId, context.userId);
        }

        createdEntries.push(entry);
      }

      await logActivity({
        userId: context.userId,
        businessId: context.businessId,
        role: context.role,
        moduleName: "INVENTORY",
        actionType: "CREATE",
        details: `Imported ${items.length} opening stock entries.`,
        newValue: createdEntries,
        request,
      });

      return NextResponse.json({ message: "Bulk opening stock imported successfully", count: createdEntries.length }, { status: 201 });
    } else {
      const result = openingStockItemSchema.safeParse(body);
      if (!result.success) {
        return NextResponse.json({ error: "Validation failed", details: result.error.format() }, { status: 400 });
      }

      const item = result.data;
      const totalValue = item.quantity * item.purchaseRate;

      const entry = await db.openingStock.create({
        data: {
          businessId: context.businessId,
          branchId: item.branchId,
          warehouseId: item.warehouseId || item.branchId,
          productId: item.productId,
          quantity: item.quantity,
          unitType: item.unitType,
          purchaseRate: item.purchaseRate,
          sellingPrice: item.sellingPrice,
          mrp: item.mrp,
          totalValue,
          batchNumber: item.batchNumber,
          expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
          manufacturingDate: item.manufacturingDate ? new Date(item.manufacturingDate) : null,
          rackNumber: item.rackNumber,
          supplierId: item.supplierId,
          remarks: item.remarks,
          enteredById: context.userId,
          approvalStatus: item.approvalStatus,
          approvedById: item.approvalStatus === "APPROVED" ? context.userId : null,
        },
      });

      if (item.approvalStatus === "APPROVED") {
        await approveOpeningStockTransaction(entry.id, context.businessId, context.userId);
      }

      await logActivity({
        userId: context.userId,
        businessId: context.businessId,
        role: context.role,
        moduleName: "INVENTORY",
        actionType: "CREATE",
        details: `Added manual opening stock for product ID: ${item.productId}, qty: ${item.quantity}`,
        newValue: entry,
        request,
      });

      return NextResponse.json({ message: "Opening stock entry created successfully", entry }, { status: 201 });
    }
  } catch (error: any) {
    console.error("POST opening stock error:", error);
    return NextResponse.json({ error: error.message || "Failed to create opening stock" }, { status: 500 });
  }
}

export async function approveOpeningStockTransaction(entryId: string, businessId: string, userId: string) {
  await db.$transaction(async (tx) => {
    const entry = await tx.openingStock.findUnique({
      where: { id: entryId },
      include: { product: true },
    });

    if (!entry || entry.businessId !== businessId) {
      throw new Error("Opening stock entry not found");
    }

    const existingStock = await tx.productStock.findUnique({
      where: { productId_branchId: { productId: entry.productId, branchId: entry.branchId } },
    });

    if (existingStock) {
      await tx.productStock.update({
        where: { id: existingStock.id },
        data: { quantity: existingStock.quantity + entry.quantity },
      });
    } else {
      await tx.productStock.create({
        data: {
          productId: entry.productId,
          branchId: entry.branchId,
          quantity: entry.quantity,
        },
      });
    }

    if (entry.batchNumber || entry.product.batchTracking) {
      const batchNum = entry.batchNumber || `OS-${new Date().toISOString().slice(0, 10)}-${Math.floor(Math.random() * 1000)}`;
      
      const existingBatch = await tx.batch.findFirst({
        where: {
          productId: entry.productId,
          branchId: entry.branchId,
          batchNumber: batchNum,
          deletedAt: null,
        },
      });

      if (existingBatch) {
        await tx.batch.update({
          where: { id: existingBatch.id },
          data: {
            quantity: existingBatch.quantity + entry.quantity,
            costPrice: entry.purchaseRate || existingBatch.costPrice,
            sellingPrice: entry.sellingPrice || existingBatch.sellingPrice,
            expiryDate: entry.expiryDate || existingBatch.expiryDate,
            manufacturingDate: entry.manufacturingDate || existingBatch.manufacturingDate,
            rackNumber: entry.rackNumber || existingBatch.rackNumber,
            supplierId: entry.supplierId || existingBatch.supplierId,
          },
        });
      } else {
        await tx.batch.create({
          data: {
            productId: entry.productId,
            branchId: entry.branchId,
            batchNumber: batchNum,
            quantity: entry.quantity,
            costPrice: entry.purchaseRate,
            sellingPrice: entry.sellingPrice,
            expiryDate: entry.expiryDate,
            manufacturingDate: entry.manufacturingDate,
            rackNumber: entry.rackNumber,
            supplierId: entry.supplierId,
          },
        });
      }
    }
  });
}
