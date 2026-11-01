import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";

export async function GET(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  const { searchParams } = new URL(request.url);
  const branchId = searchParams.get("branchId") || context.branchId || undefined;

  try {
    const range = searchParams.get("range") || "today";

    // Load business settings for Nepal Fiscal Year preference
    const business = await db.business.findUnique({
      where: { id: context.businessId },
      select: { settings: true },
    });
    const settings = (business?.settings as any) || {};
    const useNepali = settings.nepaliFiscalYear ?? false;

    let start = new Date();
    let end = new Date();
    end.setHours(23, 59, 59, 999);

    if (range === "today") {
      start.setHours(0, 0, 0, 0);
    } else if (range === "week") {
      const day = start.getDay();
      const diff = start.getDate() - day + (day === 0 ? -6 : 1); // Monday
      start.setDate(diff);
      start.setHours(0, 0, 0, 0);
    } else if (range === "month") {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
    } else if (range === "fiscalYear") {
      if (useNepali) {
        // Nepal Fiscal Year starts on Shrawan 1 (approx July 16) and ends on Ashadh 31 (approx July 15 next year)
        const currentYear = start.getFullYear();
        const currentMonth = start.getMonth(); // 0-indexed: July is 6
        const currentDate = start.getDate();

        if (currentMonth > 6 || (currentMonth === 6 && currentDate >= 16)) {
          start = new Date(currentYear, 6, 16, 0, 0, 0, 0);
          end = new Date(currentYear + 1, 6, 15, 23, 59, 59, 999);
        } else {
          start = new Date(currentYear - 1, 6, 16, 0, 0, 0, 0);
          end = new Date(currentYear, 6, 15, 23, 59, 59, 999);
        }
      } else {
        // Calendar Year
        const currentYear = start.getFullYear();
        start = new Date(currentYear, 0, 1, 0, 0, 0, 0);
        end = new Date(currentYear, 11, 31, 23, 59, 59, 999);
      }
    } else {
      // Default to today
      start.setHours(0, 0, 0, 0);
    }

    // 1. Total Sales (current month)
    const salesAggregate = await db.sale.aggregate({
      where: {
        businessId: context.businessId,
        branchId,
        status: "COMPLETED",
        createdAt: { gte: start, lte: end },
      },
      _sum: {
        total: true,
        discount: true,
        tax: true,
      },
    });

    const totalSales = salesAggregate._sum.total ? Number(salesAggregate._sum.total) : 0;

    // 2. Total Purchases (current month)
    const purchasesAggregate = await db.purchase.aggregate({
      where: {
        businessId: context.businessId,
        branchId,
        status: "RECEIVED",
        createdAt: { gte: start, lte: end },
      },
      _sum: {
        total: true,
      },
    });

    const totalPurchases = purchasesAggregate._sum.total ? Number(purchasesAggregate._sum.total) : 0;

    // 3. Total Expenses (current month)
    const expensesAggregate = await db.expense.aggregate({
      where: {
        businessId: context.businessId,
        branchId,
        createdAt: { gte: start, lte: end },
      },
      _sum: {
        amount: true,
      },
    });

    const totalExpenses = expensesAggregate._sum.amount ? Number(expensesAggregate._sum.amount) : 0;

    // 3b. Total Income (current month)
    const incomeAggregate = await db.income.aggregate({
      where: {
        businessId: context.businessId,
        branchId,
        createdAt: { gte: start, lte: end },
      },
      _sum: {
        amount: true,
      },
    });

    const totalIncome = incomeAggregate._sum.amount ? Number(incomeAggregate._sum.amount) : 0;

    // 4. Calculate Net Profit: Sales Revenue - Cost of Goods Sold (COGS) - Expenses + Income
    // Fetch all completed sales items for this month to calculate COGS
    const saleItems = await db.saleItem.findMany({
      where: {
        sale: {
          businessId: context.businessId,
          branchId,
          status: "COMPLETED",
          createdAt: { gte: start, lte: end },
        },
      },
      select: {
        productId: true,
        quantity: true,
        costPrice: true,
        total: true,
      },
    });

    const costOfGoodsSold = saleItems.reduce((sum: number, item: any) => sum + item.quantity * Number(item.costPrice), 0);
    const grossProfit = totalSales - costOfGoodsSold;
    const netProfit = grossProfit + totalIncome - totalExpenses;

    // 5. Low Stock alerts (active branch)
    const products = await db.product.findMany({
      where: {
        businessId: context.businessId,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        sku: true,
        alertQuantity: true,
        productStocks: {
          where: branchId ? { branchId } : undefined,
          select: { quantity: true },
        },
        unit: { select: { name: true } },
      },
    });

    const lowStockAlerts = products
      .map((prod: any) => {
        const branchStock = prod.productStocks.reduce((sum: number, s: { quantity: number }) => sum + s.quantity, 0);
        return {
          id: prod.id,
          name: prod.name,
          sku: prod.sku || "",
          alertQuantity: prod.alertQuantity,
          currentQuantity: branchStock,
          unit: prod.unit?.name || "Pcs",
        };
      })
      .filter((prod: any) => prod.currentQuantity <= prod.alertQuantity)
      .slice(0, 5);

    // 6. Top Selling Products (business-wide or branch-wide)
    const productQuantityMap: Record<string, { quantity: number; total: number }> = {};
    saleItems.forEach((item: any) => {
      if (!productQuantityMap[item.productId]) {
        productQuantityMap[item.productId] = { quantity: 0, total: 0 };
      }
      productQuantityMap[item.productId].quantity += item.quantity;
      productQuantityMap[item.productId].total += item.total;
    });

    const topSalesItems = Object.entries(productQuantityMap)
      .map(([productId, metrics]) => ({
        productId,
        _sum: metrics,
      }))
      .sort((a, b) => b._sum.quantity - a._sum.quantity)
      .slice(0, 5);

    const topProductIds = topSalesItems.map((item: any) => item.productId);
    const topProductsMetadata = await db.product.findMany({
      where: { id: { in: topProductIds } },
      select: { id: true, name: true, sku: true },
    });

    const topSellingProducts = topSalesItems.map((item: any) => {
      const meta = topProductsMetadata.find((p: any) => p.id === item.productId);
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
      select: {
        id: true,
        invoiceNumber: true,
        total: true,
        status: true,
        paymentStatus: true,
        createdAt: true,
        customer: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    const recentTransactions = recentSales.map((s: any) => ({
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

    // Count orders (completed sales this month)
    const ordersCount = await db.sale.count({
      where: {
        businessId: context.businessId,
        branchId,
        status: "COMPLETED",
        createdAt: { gte: start, lte: end },
      },
    });

    // Count active customers
    const customersCount = await db.customer.count({
      where: {
        businessId: context.businessId,
        deletedAt: null,
      },
    });

    // Count all low stock alert items (total alert count)
    const alertsCount = products
      .map((prod: any) => {
        const branchStock = prod.productStocks.reduce((sum: number, s: { quantity: number }) => sum + s.quantity, 0);
        return branchStock <= prod.alertQuantity;
      })
      .filter(Boolean).length;

    // 9. Sales by Category (current month)
    // Computed from the already fetched saleItems in memory
    const categoryProductIds = [...new Set(saleItems.map((item: any) => item.productId))];
    const productsWithCats = await db.product.findMany({
      where: { id: { in: categoryProductIds } },
      select: { id: true, category: { select: { name: true } } },
    });

    const categoryMap: Record<string, number> = {};
    saleItems.forEach((item: any) => {
      const prod = productsWithCats.find((p: any) => p.id === item.productId);
      const catName = prod?.category?.name || "Others";
      categoryMap[catName] = (categoryMap[catName] || 0) + item.total;
    });

    const totalCatSales = Object.values(categoryMap).reduce((a: number, b: number) => a + b, 0);
    const salesByCategory = Object.keys(categoryMap).map((name: string) => ({
      name,
      value: totalCatSales > 0 ? Math.round((categoryMap[name] / totalCatSales) * 100) : 0,
      totalAmount: categoryMap[name],
    })).sort((a, b) => b.value - a.value).slice(0, 5); // top 5 categories

    const outOfStockProducts = products
      .map((prod: any) => {
        const branchStock = prod.productStocks.reduce((sum: number, s: { quantity: number }) => sum + s.quantity, 0);
        return {
          id: prod.id,
          name: prod.name,
          sku: prod.sku || "",
          currentQuantity: branchStock,
          unit: prod.unit?.name || "Pcs",
        };
      })
      .filter((prod: any) => prod.currentQuantity <= 0)
      .slice(0, 10);

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const todaySalesRes = await db.sale.aggregate({
      where: {
        businessId: context.businessId,
        branchId,
        status: "COMPLETED",
        createdAt: { gte: startOfToday, lte: endOfToday },
      },
      _sum: {
        total: true,
      },
      _count: {
        id: true,
      },
    });

    const todayStats = {
      sales: todaySalesRes._sum.total || 0,
      orders: todaySalesRes._count.id || 0,
    };

    return NextResponse.json({
      metrics: {
        totalSales,
        totalPurchases,
        totalExpenses,
        totalIncome,
        grossProfit,
        netProfit,
        costOfGoodsSold,
        ordersCount,
        customersCount,
        alertsCount,
      },
      lowStockAlerts,
      topSellingProducts,
      recentTransactions,
      salesChart: chartData,
      salesByCategory,
      outOfStockProducts,
      todayStats,
    });
  } catch (error: unknown) {
    console.error("GET dashboard reports error:", error);
    return NextResponse.json({ error: "Failed to fetch dashboard reports" }, { status: 500 });
  }
}
