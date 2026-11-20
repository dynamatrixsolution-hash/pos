import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse, safeErrorMessage } from "@/lib/api-helper";

const OWNER_ROLES = ["SUPER_ADMIN", "OWNER"];

export async function GET(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  const { searchParams } = new URL(request.url);
  const branchId = searchParams.get("branchId");
  const type = searchParams.get("type"); // "DAMAGE", "EXPIRY", or null for both

  try {
    const isOwner = OWNER_ROLES.includes(context.role);
    const userBranchId = context.branchId;

    const branchWhere: any = { businessId: context.businessId, deletedAt: null };
    if (!isOwner && userBranchId) {
      branchWhere.id = userBranchId;
    }
    // Only owners can override branch filter via URL parameter
    if (branchId && isOwner) {
      branchWhere.id = branchId;
    }

    const branches = await db.branch.findMany({ where: branchWhere, select: { id: true } });
    const branchIds = branches.map((b) => b.id);

    // Track damaged items through adjustments and batches
    const damageAdjustments = await db.auditLog.findMany({
      where: {
        businessId: context.businessId,
        module: "INVENTORY",
        details: { contains: "DAMAGE" },
        createdAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
      },
      include: {
        user: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Get expired/expiring batches
    const now = new Date();
    const expiredBatches = await db.batch.findMany({
      where: {
        branchId: { in: branchIds },
        expiryDate: { lte: now },
        deletedAt: null,
      },
      include: {
        product: { select: { name: true, sku: true } },
        branch: { select: { name: true } },
      },
      orderBy: { expiryDate: "asc" },
    });

    const expiringSoonBatches = await db.batch.findMany({
      where: {
        branchId: { in: branchIds },
        expiryDate: {
          gt: now,
          lte: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
        },
        deletedAt: null,
      },
      include: {
        product: { select: { name: true, sku: true } },
        branch: { select: { name: true } },
      },
      orderBy: { expiryDate: "asc" },
    });

    const items: any[] = [];

    // Add expired items
    if (!type || type === "EXPIRY") {
      expiredBatches.forEach((b) => {
        const daysExpired = Math.floor((now.getTime() - b.expiryDate!.getTime()) / (24 * 60 * 60 * 1000));
        items.push({
          id: b.id,
          type: "EXPIRED",
          productName: b.product?.name || "Unknown Product",
          sku: b.product?.sku || "N/A",
          batchNumber: b.batchNumber,
          branch: b.branch?.name || "Main Branch",
          quantity: Number(b.quantity || 0),
          value: Number(b.quantity || 0) * (Number(b.costPrice) || 0),
          expiryDate: b.expiryDate,
          daysExpired,
          details: `Expired ${daysExpired} days ago`,
          status: "CRITICAL",
        });
      });

      expiringSoonBatches.forEach((b) => {
        const daysToExpiry = Math.ceil((b.expiryDate!.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
        items.push({
          id: b.id,
          type: "EXPIRING_SOON",
          productName: b.product?.name || "Unknown Product",
          sku: b.product?.sku || "N/A",
          batchNumber: b.batchNumber,
          branch: b.branch?.name || "Main Branch",
          quantity: Number(b.quantity || 0),
          value: Number(b.quantity || 0) * (Number(b.costPrice) || 0),
          expiryDate: b.expiryDate,
          daysToExpiry,
          details: `Expires in ${daysToExpiry} days`,
          status: "WARNING",
        });
      });
    }

    // Add damage records
    if (!type || type === "DAMAGE") {
      damageAdjustments.forEach((log) => {
        const parts = log.details?.match(/Qty adjusted: ([\d.]+)/);
        const qty = parts ? parseFloat(parts[1]) : 0;
        items.push({
          id: log.id,
          type: "DAMAGE",
          details: log.details || "Damage record",
          user: log.user?.name,
          quantity: qty,
          date: log.createdAt,
          status: "REPORTED",
        });
      });
    }

    items.sort((a, b) => {
      if (a.status === "CRITICAL" && b.status !== "CRITICAL") return -1;
      if (a.status !== "CRITICAL" && b.status === "CRITICAL") return 1;
      return new Date(b.date || b.expiryDate).getTime() - new Date(a.date || a.expiryDate).getTime();
    });

    const totalValue = items.reduce((sum, i) => sum + (i.value || 0), 0);

    return NextResponse.json({
      items,
      summary: {
        totalExpired: expiredBatches.length,
        totalExpiringSoon: expiringSoonBatches.length,
        totalDamaged: damageAdjustments.length,
        totalValue,
      },
    });
  } catch (error: any) {
    console.error("GET damage & expiry error:", error);
    return NextResponse.json({ error: "Failed to fetch damage & expiry data" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  try {
    const body = await request.json();
    const { productId, branchId: reqBranchId, batchId, quantity, type = "DAMAGE", reason, notes } = body;

    if (!productId || !quantity || Number(quantity) <= 0) {
      return NextResponse.json(
        { error: "Product ID and a positive quantity are required" },
        { status: 400 }
      );
    }

    const branchId = reqBranchId || context.branchId;
    if (!branchId) {
      return NextResponse.json({ error: "Branch ID is required" }, { status: 400 });
    }

    const qtyNumber = Number(quantity);

    // Verify product exists and belongs to business
    const product = await db.product.findFirst({
      where: { id: productId, businessId: context.businessId, deletedAt: null },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const result = await db.$transaction(async (tx) => {
      // Find current stock
      const stock = await tx.productStock.findUnique({
        where: { productId_branchId: { productId, branchId } },
      });

      const currentQty = stock ? Number(stock.quantity) : 0;
      if (currentQty < qtyNumber) {
        return { insufficient: currentQty };
      }

      const updatedStock = await tx.productStock.update({
        where: { productId_branchId: { productId, branchId } },
        data: { quantity: currentQty - qtyNumber },
      });

      // If batch specified, also reduce batch quantity
      if (batchId) {
        const batch = await tx.batch.findFirst({
          where: { id: batchId, productId, branchId, deletedAt: null },
        });
        if (batch) {
          await tx.batch.update({
            where: { id: batchId },
            data: { quantity: Math.max(0, Number(batch.quantity) - qtyNumber) },
          });
        }
      }

      // Record audit log
      const auditLog = await tx.auditLog.create({
        data: {
          businessId: context.businessId,
          userId: context.userId,
          action: "DAMAGE_EXPIRY_WRITEOFF",
          module: "INVENTORY",
          details: `Written off ${qtyNumber} units of "${product.name}" as ${type}. Reason: ${reason || notes || "Unusable/Expired stock"}. Qty adjusted: ${qtyNumber}`,
        },
      });

      return { updatedStock, auditLog };
    });

    if ("insufficient" in result) {
      return NextResponse.json(
        { error: `Insufficient stock to write off. Available: ${result.insufficient}, Requested: ${qtyNumber}` },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Successfully wrote off ${qtyNumber} units of ${product.name}`,
      result,
    }, { status: 201 });
  } catch (error: any) {
    console.error("POST damage & expiry error:", error);
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to record damage/expiry write-off") },
      { status: 500 }
    );
  }
}

