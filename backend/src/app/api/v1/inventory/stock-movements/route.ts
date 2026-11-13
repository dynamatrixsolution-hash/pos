import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";

const OWNER_ROLES = ["SUPER_ADMIN", "OWNER"];

export async function GET(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  const { searchParams } = new URL(request.url);
  const branchId = searchParams.get("branchId");
  const type = searchParams.get("type");
  const days = parseInt(searchParams.get("days") || "30");

  try {
    const isOwner = OWNER_ROLES.includes(context.role);
    const userBranchId = context.branchId;

    // Get accessible branches
    const branchWhere: any = { businessId: context.businessId, deletedAt: null };
    if (!isOwner && userBranchId) {
      branchWhere.id = userBranchId;
    }
    const branches = await db.branch.findMany({ where: branchWhere, select: { id: true } });
    const branchIds = branches.map((b) => b.id);

    // 1. Authoritative append-only StockMovement table query
    const authoritativeMovements = await db.stockMovement.findMany({
      where: {
        businessId: context.businessId,
        branchId: { in: branchIds },
        createdAt: { gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) },
        ...(type === "STOCK_OUT" ? { quantity: { lt: 0 } } : type === "STOCK_IN" ? { quantity: { gt: 0 } } : {}),
      },
      include: {
        product: { select: { name: true, sku: true } },
        branch: { select: { name: true } },
        actor: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    if (authoritativeMovements.length > 0) {
      const movements = authoritativeMovements.map((m) => {
        const isOut = Number(m.quantity) < 0;
        return {
          id: m.id,
          type: isOut ? "STOCK_OUT" : "STOCK_IN",
          date: m.createdAt,
          reference: m.sourceId,
          from: isOut ? (m.branch?.name || "Main Branch") : (m.notes || m.sourceType),
          to: isOut ? (m.notes || m.sourceType) : (m.branch?.name || "Main Branch"),
          items: [{ name: m.product?.name || "Unknown Product", sku: m.product?.sku || "N/A", qty: Math.abs(Number(m.quantity || 0)) }],
          user: m.actor?.name || "System",
          batchNumber: m.batchNumber,
          signedQuantity: (m.quantity || 0).toString(),
          sourceType: m.sourceType,
          total: 0,
        };
      });

      return NextResponse.json({
        movements,
        summary: {
          totalIn: authoritativeMovements.filter((m) => Number(m.quantity) > 0).length,
          totalOut: authoritativeMovements.filter((m) => Number(m.quantity) < 0).length,
          totalTransfers: authoritativeMovements.filter((m) => m.sourceType.includes("TRANSFER")).length,
        },
      });
    }

    // Fallback for historical data prior to StockMovement ledger
    // Get sales (Stock Out)
    let stockOut: any[] = [];
    if (!type || type === "STOCK_OUT") {
      stockOut = await db.sale.findMany({
        where: {
          businessId: context.businessId,
          branchId: { in: branchIds },
          createdAt: { gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) },
        },
        include: {
          saleItems: { include: { product: { select: { name: true, sku: true } } } },
          user: { select: { name: true } },
          branch: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      });
    }

    // Get purchases (Stock In)
    let stockIn: any[] = [];
    if (!type || type === "STOCK_IN") {
      stockIn = await db.purchase.findMany({
        where: {
          businessId: context.businessId,
          branchId: { in: branchIds },
          createdAt: { gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) },
        },
        include: {
          purchaseItems: { include: { product: { select: { name: true, sku: true } } } },
          user: { select: { name: true } },
          branch: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      });
    }

    // Get transfers
    let transfers: any[] = [];
    if (!type || type === "TRANSFER") {
      transfers = await db.stockTransfer.findMany({
        where: {
          businessId: context.businessId,
          OR: [
            { sourceBranchId: { in: branchIds } },
            { targetBranchId: { in: branchIds } },
          ],
          createdAt: { gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) },
        },
        include: {
          sourceBranch: { select: { name: true } },
          targetBranch: { select: { name: true } },
          items: { include: { product: { select: { name: true, sku: true } } } },
        },
        orderBy: { createdAt: "desc" },
      });
    }

    const movements = [
      ...stockIn.map((p) => ({
        id: p.id,
        type: "STOCK_IN",
        date: p.createdAt,
        reference: p.purchaseNumber,
        from: (p as any).supplier?.name || "Purchase",
        to: p.branch?.name || "Main Branch",
        items: p.purchaseItems.map((i: any) => ({ name: i.product?.name || "Product", sku: i.product?.sku || "N/A", qty: Number(i.quantity || 0) })),
        user: p.user?.name || "System",
        total: Number(p.total || 0),
      })),
      ...stockOut.map((s) => ({
        id: s.id,
        type: "STOCK_OUT",
        date: s.createdAt,
        reference: s.invoiceNumber,
        from: s.branch?.name || "Main Branch",
        to: (s as any).customer?.name || "Sale",
        items: s.saleItems.map((i: any) => ({ name: i.product?.name || "Product", sku: i.product?.sku || "N/A", qty: Number(i.quantity || 0) })),
        user: s.user?.name || "System",
        total: Number(s.total || 0),
      })),
      ...transfers.map((t) => ({
        id: t.id,
        type: "TRANSFER",
        date: t.createdAt,
        reference: `Transfer-${t.id.slice(0, 8)}`,
        from: t.sourceBranch?.name || "Source Branch",
        to: t.targetBranch?.name || "Target Branch",
        items: t.items.map((i: any) => ({ name: i.product?.name || "Product", sku: i.product?.sku || "N/A", qty: Number(i.quantity || 0) })),
        user: "System",
        total: 0,
        status: t.status,
      })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return NextResponse.json({
      movements,
      summary: {
        totalIn: stockIn.length,
        totalOut: stockOut.length,
        totalTransfers: transfers.length,
      },
    });
  } catch (error: any) {
    console.error("GET stock movements error:", error);
    return NextResponse.json({ error: "Failed to fetch stock movements" }, { status: 500 });
  }
}
