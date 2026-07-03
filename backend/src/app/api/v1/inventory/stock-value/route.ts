import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";

const OWNER_ROLES = ["SUPER_ADMIN", "OWNER"];

export async function GET(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  const { searchParams } = new URL(request.url);
  const branchId = searchParams.get("branchId");
  const sortBy = searchParams.get("sortBy") || "value"; // "value", "quantity", "category"

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

    const branches = await db.branch.findMany({ where: branchWhere, select: { id: true, name: true } });
    const branchIds = branches.map((b) => b.id);

    // Get all products with their stock
    const products = await db.product.findMany({
      where: {
        businessId: context.businessId,
        deletedAt: null,
      },
      include: {
        category: { select: { name: true } },
        unit: { select: { name: true } },
        productStocks: {
          where: { branchId: { in: branchIds } },
          include: { branch: { select: { name: true } } },
        },
      },
      orderBy: { name: "asc" },
    });

    const valueByCategory: Record<string, any> = {};
    const valueByBranch: Record<string, any> = {};
    const productValues: any[] = [];
    let totalStockValue = 0;
    let totalCostValue = 0;
    let totalSellingValue = 0;

    products.forEach((p) => {
      const quantity = p.productStocks.reduce((sum, s) => sum + s.quantity, 0);
      const costValue = quantity * p.costPrice;
      const sellingValue = quantity * p.sellingPrice;
      const margin = p.sellingPrice - p.costPrice;
      const marginValue = quantity * margin;

      totalStockValue += quantity;
      totalCostValue += costValue;
      totalSellingValue += sellingValue;

      // Product level
      productValues.push({
        id: p.id,
        name: p.name,
        sku: p.sku || "N/A",
        category: p.category?.name || "Uncategorized",
        unit: p.unit?.name || "Units",
        quantity,
        costPrice: p.costPrice,
        sellingPrice: p.sellingPrice,
        costValue,
        sellingValue,
        margin,
        marginValue,
        marginPercent: p.costPrice > 0 ? ((margin / p.costPrice) * 100).toFixed(2) : "0",
        stocks: p.productStocks.map((s) => ({
          branch: s.branch.name,
          quantity: s.quantity,
          value: s.quantity * p.costPrice,
        })),
      });

      // Category aggregation
      const cat = p.category?.name || "Uncategorized";
      if (!valueByCategory[cat]) {
        valueByCategory[cat] = {
          category: cat,
          quantity: 0,
          costValue: 0,
          sellingValue: 0,
          marginValue: 0,
        };
      }
      valueByCategory[cat].quantity += quantity;
      valueByCategory[cat].costValue += costValue;
      valueByCategory[cat].sellingValue += sellingValue;
      valueByCategory[cat].marginValue += marginValue;

      // Branch aggregation
      p.productStocks.forEach((s) => {
        if (!valueByBranch[s.branchId]) {
          valueByBranch[s.branchId] = {
            branchId: s.branchId,
            branchName: s.branch.name,
            quantity: 0,
            costValue: 0,
            sellingValue: 0,
            marginValue: 0,
          };
        }
        valueByBranch[s.branchId].quantity += s.quantity;
        valueByBranch[s.branchId].costValue += s.quantity * p.costPrice;
        valueByBranch[s.branchId].sellingValue += s.quantity * p.sellingPrice;
        valueByBranch[s.branchId].marginValue += s.quantity * margin;
      });
    });

    const categoryReport = Object.values(valueByCategory)
      .sort((a: any, b: any) => b.costValue - a.costValue);
    const branchReport = Object.values(valueByBranch)
      .sort((a: any, b: any) => b.costValue - a.costValue);

    // Sort products
    let sorted = productValues;
    if (sortBy === "value") {
      sorted = sorted.sort((a, b) => b.costValue - a.costValue);
    } else if (sortBy === "quantity") {
      sorted = sorted.sort((a, b) => b.quantity - a.quantity);
    } else if (sortBy === "category") {
      sorted = sorted.sort((a, b) => a.category.localeCompare(b.category));
    }

    const profitMargin = totalCostValue > 0 ? (((totalSellingValue - totalCostValue) / totalCostValue) * 100).toFixed(2) : "0";

    return NextResponse.json({
      products: sorted,
      categories: categoryReport,
      branches: branchReport,
      summary: {
        totalProducts: products.length,
        totalQuantity: totalStockValue,
        totalCostValue: parseFloat(totalCostValue.toFixed(2)),
        totalSellingValue: parseFloat(totalSellingValue.toFixed(2)),
        totalMarginValue: parseFloat((totalSellingValue - totalCostValue).toFixed(2)),
        profitMargin: parseFloat(profitMargin),
      },
    });
  } catch (error: any) {
    console.error("GET stock value report error:", error);
    return NextResponse.json({ error: "Failed to fetch stock value report" }, { status: 500 });
  }
}
