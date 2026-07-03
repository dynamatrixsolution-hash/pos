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
        from: p.supplier?.name || "Purchase",
        to: p.branch.name,
        items: p.purchaseItems.map((i: any) => ({ name: i.product.name, sku: i.product.sku, qty: i.quantity })),
        user: p.user.name,
        total: p.total,
      })),
      ...stockOut.map((s) => ({
        id: s.id,
        type: "STOCK_OUT",
        date: s.createdAt,
        reference: s.invoiceNumber,
        from: s.branch.name,
        to: s.customer?.name || "Sale",
        items: s.saleItems.map((i: any) => ({ name: i.product.name, sku: i.product.sku, qty: i.quantity })),
        user: s.user.name,
        total: s.total,
      })),
      ...transfers.map((t) => ({
        id: t.id,
        type: "TRANSFER",
        date: t.createdAt,
        reference: `Transfer-${t.id.slice(0, 8)}`,
        from: t.sourceBranch.name,
        to: t.targetBranch.name,
        items: t.items.map((i: any) => ({ name: i.product.name, sku: i.product.sku, qty: i.quantity })),
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
