import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";

const OWNER_ROLES = ["SUPER_ADMIN", "OWNER"];

export async function GET(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  const { searchParams } = new URL(request.url);
  const branchId = searchParams.get("branchId");
  const search = searchParams.get("search") || "";
  const allBranches = searchParams.get("allBranches") === "true";

  try {
    const isOwner = OWNER_ROLES.includes(context.role);
    const userBranchId = context.branchId;

    // Determine branches
    let branches: any[] = [];
    if (isOwner || allBranches) {
      branches = await db.branch.findMany({
        where: { businessId: context.businessId, deletedAt: null },
        select: { id: true, name: true, isMain: true },
      });
    } else if (userBranchId) {
      branches = await db.branch.findMany({
        where: { id: userBranchId, businessId: context.businessId },
        select: { id: true, name: true, isMain: true },
      });
    }

    // Enforce branch access control
    let filterBranchIds: string[] = [];
    if ((isOwner || allBranches) && branchId) {
      filterBranchIds = [branchId];
    } else if (isOwner || allBranches) {
      filterBranchIds = branches.map((b) => b.id);
    } else {
      filterBranchIds = userBranchId ? [userBranchId] : [];
    }

    const products = await db.product.findMany({
      where: {
        businessId: context.businessId,
        deletedAt: null,
        ...(search && {
          OR: [
            { name: { contains: search } },
            { sku: { contains: search } },
            { barcode: { contains: search } },
          ],
        }),
      },
      include: {
        category: { select: { id: true, name: true } },
        unit: { select: { name: true } },
        brand: { select: { name: true } },
        productStocks: {
          where: { branchId: { in: filterBranchIds } },
          include: { branch: { select: { id: true, name: true } } },
        },
      },
      orderBy: { name: "asc" },
    });

    const stocks = (products as any[]).map((p) => {
      const totalQty = p.productStocks.reduce((sum: number, s: any) => sum + s.quantity, 0);
      return {
        id: p.id,
        name: p.name,
        sku: p.sku || "N/A",
        barcode: p.barcode || "N/A",
        category: p.category?.name || "N/A",
        brand: p.brand?.name || "N/A",
        unit: p.unit?.name || "Units",
        costPrice: p.costPrice,
        sellingPrice: p.sellingPrice,
        alertQuantity: p.alertQuantity,
        totalQuantity: totalQty,
        value: totalQty * p.costPrice,
        status: totalQty === 0 ? "OUT_OF_STOCK" : totalQty <= p.alertQuantity ? "LOW_STOCK" : "IN_STOCK",
        branchStocks: p.productStocks.map((s: any) => ({
          branchId: s.branchId,
          branchName: s.branch?.name,
          quantity: s.quantity,
        })),
      };
    });

    return NextResponse.json({
      stocks,
      branches,
      totalProducts: stocks.length,
      totalValue: stocks.reduce((sum, s) => sum + s.value, 0),
    });
  } catch (error: any) {
    console.error("GET current stock error:", error);
    return NextResponse.json({ error: "Failed to fetch current stock" }, { status: 500 });
  }
}
