import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";

export async function GET(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  const { searchParams } = new URL(request.url);
  const branchId = searchParams.get("branchId") || context.branchId || undefined;

  try {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    // 1. Total Sales (current month)
    const salesAggregate = await db.sale.aggregate({
      where: {
        businessId: context.businessId,
        branchId,
        status: "COMPLETED",
        createdAt: { gte: startOfMonth, lte: endOfDay },
      },
      _sum: {
        total: true,
        discount: true,
        tax: true,
      },
    });

    const totalSales = salesAggregate._sum.total || 0;

    // 2. Total Purchases (current month)
    const purchasesAggregate = await db.purchase.aggregate({
      where: {
        businessId: context.businessId,
        branchId,
        status: "RECEIVED",
        createdAt: { gte: startOfMonth, lte: endOfDay },
      },
      _sum: {
        total: true,
      },
    });

    const totalPurchases = purchasesAggregate._sum.total || 0;

    // 3. Total Expenses (current month)
    const expensesAggregate = await db.expense.aggregate({
      where: {
        businessId: context.businessId,
        branchId,
        createdAt: { gte: startOfMonth, lte: endOfDay },
      },
      _sum: {
        amount: true,
      },
    });

    const totalExpenses = expensesAggregate._sum.amount || 0;

    // 3b. Total Income (current month)
    const incomeAggregate = await db.income.aggregate({
      where: {
        businessId: context.businessId,
        branchId,
        createdAt: { gte: startOfMonth, lte: endOfDay },
      },
      _sum: {
        amount: true,
      },
    });

    const totalIncome = incomeAggregate._sum.amount || 0;

    // 4. Calculate Net Profit: Sales Revenue - Cost of Goods Sold (COGS) - Expenses + Income
    // Fetch all completed sales items for this month to calculate COGS
    const saleItems = await db.saleItem.findMany({
      where: {
        sale: {
          businessId: context.businessId,
          branchId,
          status: "COMPLETED",
          createdAt: { gte: startOfMonth, lte: endOfDay },
        },
      },
      select: {
        quantity: true,
        costPrice: true,
        total: true,
      },
    });

    const costOfGoodsSold = saleItems.reduce((sum, item) => sum + item.quantity * item.costPrice, 0);
    const grossProfit = totalSales - costOfGoodsSold;
    const netProfit = grossProfit + totalIncome - totalExpenses;

    // 5. Low Stock alerts (active branch)
    // Products where stock level is below or equal to alertQuantity
    const products = await db.product.findMany({
      where: {
        businessId: context.businessId,
        deletedAt: null,
      },
      include: {
        productStocks: {
          where: branchId ? { branchId } : undefined,
        },
        unit: { select: { name: true } },
      },
    });

    const lowStockAlerts = products
      .map((prod) => {
        const branchStock = prod.productStocks.reduce((sum: number, s: any) => sum + s.quantity, 0);
        return {
          id: prod.id,
          name: prod.name,
          sku: prod.sku || "",
          alertQuantity: prod.alertQuantity,
          currentQuantity: branchStock,
          unit: prod.unit?.name || "Pcs",
        };
      })
      .filter((prod) => prod.currentQuantity <= prod.alertQuantity)
      .slice(0, 5);

    // 6. Top Selling Products (business-wide or branch-wide)
    const topSalesItems = await db.saleItem.groupBy({
      by: ["productId"],
      _sum: {
        quantity: true,
        total: true,
      },
      where: {
        sale: {
          businessId: context.businessId,
          branchId,
          status: "COMPLETED",
        },
      },
      orderBy: {
        _sum: {
          quantity: "desc",
        },
      },
      take: 5,
    });

    const topProductIds = topSalesItems.map((item) => item.productId);
    const topProductsMetadata = await db.product.findMany({
      where: { id: { in: topProductIds } },
      select: { id: true, name: true, sku: true },
    });

    const topSellingProducts = topSalesItems.map((item) => {
      const meta = topProductsMetadata.find((p) => p.id === item.productId);
      return {
        id: item.productId,
        name: meta?.name || "Unknown Item",
        sku: meta?.sku || "",
        quantitySold: item._sum.quantity || 0,
        revenue: item._sum.total || 0,
      };
    });

    // 7. Recent Transactions (last 5 sales)
    const recentSales = await db.sale.findMany({
      where: {
        businessId: context.businessId,
        branchId,
        deletedAt: null,
      },
      include: {
        customer: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    const recentTransactions = recentSales.map((s) => ({
      id: s.id,
      invoiceNumber: s.invoiceNumber,
      customerName: s.customer?.name || "Walk-in Customer",
      total: s.total,
      status: s.status,
      paymentStatus: s.paymentStatus,
      createdAt: s.createdAt,
    }));

    // 8. Sales Chart Data for the Last 7 Days
    const chartData = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const start = new Date(d.setHours(0, 0, 0, 0));
      const end = new Date(d.setHours(23, 59, 59, 999));

      const dailySales = await db.sale.aggregate({
        where: {
          businessId: context.businessId,
          branchId,
          status: "COMPLETED",
          createdAt: { gte: start, lte: end },
        },
        _sum: {
          total: true,
        },
      });

      const dayName = start.toLocaleDateString("en-US", { weekday: "short" });
      chartData.push({
        name: dayName,
        date: start.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        sales: dailySales._sum.total || 0,
      });
    }

    return NextResponse.json({
      metrics: {
        totalSales,
        totalPurchases,
        totalExpenses,
        totalIncome,
        grossProfit,
        netProfit,
        costOfGoodsSold,
      },
      lowStockAlerts,
      topSellingProducts,
      recentTransactions,
      salesChart: chartData,
    });
  } catch (error: any) {
    console.error("GET dashboard reports error:", error);
    return NextResponse.json({ error: "Failed to generate dashboard reports" }, { status: 500 });
  }
}
