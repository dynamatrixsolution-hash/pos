import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";

const OWNER_ROLES = ["SUPER_ADMIN", "OWNER"];

export async function GET(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";
  const lowStockOnly = searchParams.get("lowStock") === "true";
  const branchIdFilter = searchParams.get("branchId");

  try {
    const where: any = {
      businessId: context.businessId,
      deletedAt: null,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { sku: { contains: search, mode: "insensitive" } },
      ];
    }

    const products = await db.product.findMany({
      where,
      include: {
        category: { select: { name: true } },
        unit: { select: { name: true } },
        productStocks: {
          include: { branch: { select: { id: true, name: true } } },
        },
      },
      orderBy: { name: "asc" },
    });

    // Determine which branches user can see
    const isOwner = OWNER_ROLES.includes(context.role);
    const userBranchId = context.branchId;

    let inventory = products.map((p) => {
      // Filter stocks based on role and branch parameter
      let visibleStocks = p.productStocks;
      
      if (isOwner && branchIdFilter) {
        // Owners can filter by specific branch
        visibleStocks = p.productStocks.filter((s) => s.branchId === branchIdFilter);
      } else if (!isOwner && userBranchId) {
        // Non-owners can only see their assigned branch
        visibleStocks = p.productStocks.filter((s) => s.branchId === userBranchId);
      }

      const totalQuantity = visibleStocks.reduce((sum, stock) => sum + stock.quantity, 0);
      const isLowStock = totalQuantity <= p.alertQuantity;
      const valuation = totalQuantity * p.costPrice;

      return {
        id: p.id,
        name: p.name,
        sku: p.sku || "N/A",
        barcode: p.barcode || "N/A",
        categoryName: p.category?.name || "Uncategorized",
        unitName: p.unit?.name || "Units",
        costPrice: p.costPrice,
        sellingPrice: p.sellingPrice,
        alertQuantity: p.alertQuantity,
        totalQuantity,
        isLowStock,
        valuation,
        stocks: visibleStocks.map((s) => ({
          branchId: s.branchId,
          branchName: s.branch.name,
          quantity: s.quantity,
        })),
      };
    });

    if (lowStockOnly) {
      inventory = inventory.filter((item) => item.isLowStock);
    }

    // Summary metrics
    const totalValuation = inventory.reduce((sum, item) => sum + item.valuation, 0);
    const lowStockCount = inventory.filter((item) => item.isLowStock).length;
    const totalItems = inventory.length;

    // Get all accessible branches
    const branchWhere: any = { businessId: context.businessId, deletedAt: null };
    if (!isOwner && userBranchId) {
      branchWhere.id = userBranchId;
    }
    const branches = await db.branch.findMany({
      where: branchWhere,
      select: { id: true, name: true, isMain: true },
    });

    return NextResponse.json({
      inventory,
      metrics: {
        totalValuation,
        lowStockCount,
        totalItems,
      },
      branches,
      userRole: context.role,
      isOwner,
    });
  } catch (error: any) {
    console.error("GET inventory error:", error);
    return NextResponse.json({ error: "Failed to fetch inventory" }, { status: 500 });
  }
}
