import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";

const OWNER_ROLES = ["SUPER_ADMIN", "OWNER"];

export async function GET(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  const { searchParams } = new URL(request.url);
  const branchId = searchParams.get("branchId");
  const userId = searchParams.get("userId");
  const type = searchParams.get("type"); // "ADJUSTMENT", "SALE", "PURCHASE", "TRANSFER"
  const days = parseInt(searchParams.get("days") || "90");
  const search = searchParams.get("search") || "";

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
    const dateFrom = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    let movements: any[] = [];

    // Get adjustment logs
    if (!type || type === "ADJUSTMENT") {
      const adjustments = await db.auditLog.findMany({
        where: {
          businessId: context.businessId,
          module: "INVENTORY",
          createdAt: { gte: dateFrom },
          ...(userId && { userId }),
          details: { contains: "adjustment" },
        },
        include: {
          user: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      adjustments.forEach((log) => {
        movements.push({
          id: log.id,
          type: "ADJUSTMENT",
          date: log.createdAt,
          action: log.action,
          details: log.details || "",
          user: log.user?.name || "System",
          userId: log.userId,
        });
      });
    }

    // Get sales
    if (!type || type === "SALE") {
      const sales = await db.sale.findMany({
        where: {
          businessId: context.businessId,
          branchId: { in: branchIds },
          createdAt: { gte: dateFrom },
        },
        include: {
          saleItems: {
            include: {
              product: { select: { name: true, sku: true } },
            },
          },
          user: { select: { name: true } },
          branch: { select: { name: true } },
          customer: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      sales.forEach((sale) => {
        const totalQty = sale.saleItems.reduce((sum, item) => sum + item.quantity, 0);
        movements.push({
          id: sale.id,
          type: "SALE",
          date: sale.createdAt,
          reference: sale.invoiceNumber,
          branch: sale.branch.name,
          customer: sale.customer?.name || "Walk-in",
          user: sale.user.name,
          items: sale.saleItems.map((i) => ({
            product: i.product.name,
            sku: i.product.sku,
            quantity: i.quantity,
            price: i.price,
          })),
          totalQuantity: totalQty,
          totalAmount: sale.total,
        });
      });
    }

    // Get purchases
    if (!type || type === "PURCHASE") {
      const purchases = await db.purchase.findMany({
        where: {
          businessId: context.businessId,
          branchId: { in: branchIds },
          createdAt: { gte: dateFrom },
        },
        include: {
          purchaseItems: {
            include: {
              product: { select: { name: true, sku: true } },
            },
          },
          user: { select: { name: true } },
          branch: { select: { name: true } },
          supplier: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      purchases.forEach((purchase) => {
        const totalQty = purchase.purchaseItems.reduce((sum, item) => sum + item.quantity, 0);
        movements.push({
          id: purchase.id,
          type: "PURCHASE",
          date: purchase.createdAt,
          reference: purchase.purchaseNumber,
          branch: purchase.branch.name,
          supplier: purchase.supplier.name,
          user: purchase.user.name,
          items: purchase.purchaseItems.map((i) => ({
            product: i.product.name,
            sku: i.product.sku,
            quantity: i.quantity,
            price: i.price,
          })),
          totalQuantity: totalQty,
          totalAmount: purchase.total,
        });
      });
    }

    // Get transfers
    if (!type || type === "TRANSFER") {
      const transfers = await db.stockTransfer.findMany({
        where: {
          businessId: context.businessId,
          OR: [
            { sourceBranchId: { in: branchIds } },
            { targetBranchId: { in: branchIds } },
          ],
          createdAt: { gte: dateFrom },
        },
        include: {
          sourceBranch: { select: { name: true } },
          targetBranch: { select: { name: true } },
          items: {
            include: {
              product: { select: { name: true, sku: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      transfers.forEach((transfer) => {
        const totalQty = transfer.items.reduce((sum, item) => sum + item.quantity, 0);
        movements.push({
          id: transfer.id,
          type: "TRANSFER",
          date: transfer.createdAt,
          reference: `TRN-${transfer.id.slice(0, 8)}`,
          fromBranch: transfer.sourceBranch.name,
          toBranch: transfer.targetBranch.name,
          items: transfer.items.map((i) => ({
            product: i.product.name,
            sku: i.product.sku,
            quantity: i.quantity,
          })),
          totalQuantity: totalQty,
          status: transfer.status,
        });
      });
    }

    // Filter by search
    if (search) {
      movements = movements.filter((m) => {
        const searchLower = search.toLowerCase();
        return (
          m.reference?.toLowerCase().includes(searchLower) ||
          m.user?.toLowerCase().includes(searchLower) ||
          m.customer?.toLowerCase().includes(searchLower) ||
          m.supplier?.toLowerCase().includes(searchLower) ||
          m.details?.toLowerCase().includes(searchLower) ||
          m.items?.some((i: any) => i.product.toLowerCase().includes(searchLower))
        );
      });
    }

    // Sort by date
    movements.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const summary = {
      totalMovements: movements.length,
      byType: {
        SALE: movements.filter((m) => m.type === "SALE").length,
        PURCHASE: movements.filter((m) => m.type === "PURCHASE").length,
        ADJUSTMENT: movements.filter((m) => m.type === "ADJUSTMENT").length,
        TRANSFER: movements.filter((m) => m.type === "TRANSFER").length,
      },
    };

    return NextResponse.json({
      movements,
      summary,
      dateRange: { from: dateFrom, to: new Date() },
    });
  } catch (error: any) {
    console.error("GET movement history error:", error);
    return NextResponse.json({ error: "Failed to fetch movement history" }, { status: 500 });
  }
}
