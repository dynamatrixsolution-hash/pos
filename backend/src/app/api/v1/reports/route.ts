import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";

export async function GET(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  const { searchParams } = new URL(request.url);
  const branchId = searchParams.get("branchId") || undefined;
  const startDateStr = searchParams.get("startDate");
  const endDateStr = searchParams.get("endDate");

  try {
    let startDate = new Date();
    startDate.setDate(1);
    startDate.setHours(0, 0, 0, 0);

    let endDate = new Date();
    endDate.setHours(23, 59, 59, 999);

    if (startDateStr) {
      const parsedStart = new Date(startDateStr);
      if (!isNaN(parsedStart.getTime())) {
        startDate = parsedStart;
        startDate.setHours(0, 0, 0, 0);
      }
    }

    if (endDateStr) {
      const parsedEnd = new Date(endDateStr);
      if (!isNaN(parsedEnd.getTime())) {
        endDate = parsedEnd;
        endDate.setHours(23, 59, 59, 999);
      }
    }

    const whereClauseCommon: any = {
      businessId: context.businessId,
      createdAt: { gte: startDate, lte: endDate },
    };

    if (branchId) {
      whereClauseCommon.branchId = branchId;
    }

    // 1. Sales Aggregates
    const salesAggregate = await db.sale.aggregate({
      where: {
        ...whereClauseCommon,
        status: "COMPLETED",
      },
      _sum: {
        total: true,
        discount: true,
        tax: true,
      },
      _count: {
        id: true,
      },
    });

    const totalSales = salesAggregate._sum.total || 0;
    const totalSalesCount = salesAggregate._count.id || 0;
    const totalSalesTax = salesAggregate._sum.tax || 0;
    const totalSalesDiscount = salesAggregate._sum.discount || 0;

    // Sales by Payment Method
    const salesPayments = await db.payment.groupBy({
      by: ["method"],
      where: {
        businessId: context.businessId,
        createdAt: { gte: startDate, lte: endDate },
        saleId: { not: null },
        sale: branchId ? { branchId } : undefined,
      },
      _sum: {
        amount: true,
      },
    });

    const salesByPaymentMethod = salesPayments.map((p) => ({
      method: p.method,
      amount: p._sum.amount || 0,
    }));

    // 2. Purchases Aggregates
    const purchasesAggregate = await db.purchase.aggregate({
      where: {
        ...whereClauseCommon,
        status: "RECEIVED",
      },
      _sum: {
        total: true,
      },
      _count: {
        id: true,
      },
    });

    const totalPurchases = purchasesAggregate._sum.total || 0;
    const totalPurchasesCount = purchasesAggregate._count.id || 0;

    // 3. Expenses Aggregates
    const expensesAggregate = await db.expense.aggregate({
      where: whereClauseCommon,
      _sum: {
        amount: true,
      },
      _count: {
        id: true,
      },
    });

    const totalExpenses = expensesAggregate._sum.amount || 0;
    const totalExpensesCount = expensesAggregate._count.id || 0;

    // 3b. Income Aggregates
    const incomeAggregate = await db.income.aggregate({
      where: whereClauseCommon,
      _sum: {
        amount: true,
      },
      _count: {
        id: true,
      },
    });

    const totalIncome = incomeAggregate._sum.amount || 0;
    const totalIncomeCount = incomeAggregate._count.id || 0;

    // Expenses by Category
    const expensesByCategoryGroup = await db.expense.groupBy({
      by: ["categoryId"],
      where: whereClauseCommon,
      _sum: {
        amount: true,
      },
    });

    const expenseCategories = await db.expenseCategory.findMany({
      where: {
        businessId: context.businessId,
      },
      select: {
        id: true,
        name: true,
      },
    });

    const expensesByCategory = expensesByCategoryGroup.map((ecg) => {
      const cat = expenseCategories.find((c) => c.id === ecg.categoryId);
      return {
        categoryId: ecg.categoryId,
        categoryName: cat?.name || "Other/General",
        amount: ecg._sum.amount || 0,
      };
    });

    // 4. Profit & Cost of Goods Sold (COGS)
    const saleItems = await db.saleItem.findMany({
      where: {
        sale: {
          ...whereClauseCommon,
          status: "COMPLETED",
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

    // 5. Product-wise sales summary
    const topSalesItems = await db.saleItem.groupBy({
      by: ["productId"],
      _sum: {
        quantity: true,
        total: true,
      },
      where: {
        sale: {
          ...whereClauseCommon,
          status: "COMPLETED",
        },
      },
      orderBy: {
        _sum: {
          quantity: "desc",
        },
      },
      take: 10,
    });

    const topProductIds = topSalesItems.map((item) => item.productId);
    const topProductsMetadata = await db.product.findMany({
      where: { id: { in: topProductIds } },
      select: { id: true, name: true, sku: true },
    });

    const topProducts = topSalesItems.map((item) => {
      const meta = topProductsMetadata.find((p) => p.id === item.productId);
      return {
        id: item.productId,
        name: meta?.name || "Unknown Item",
        sku: meta?.sku || "",
        quantitySold: item._sum.quantity || 0,
        revenue: item._sum.total || 0,
      };
    });

    return NextResponse.json({
      startDate,
      endDate,
      sales: {
        total: totalSales,
        count: totalSalesCount,
        tax: totalSalesTax,
        discount: totalSalesDiscount,
        byPaymentMethod: salesByPaymentMethod,
      },
      purchases: {
        total: totalPurchases,
        count: totalPurchasesCount,
      },
      expenses: {
        total: totalExpenses,
        count: totalExpensesCount,
        byCategory: expensesByCategory,
      },
      income: {
        total: totalIncome,
        count: totalIncomeCount,
      },
      margins: {
        costOfGoodsSold,
        grossProfit,
        netProfit,
      },
      topProducts,
    });
  } catch (error: any) {
    console.error("GET reports error:", error);
    return NextResponse.json({ error: "Failed to generate reports" }, { status: 500 });
  }
}
