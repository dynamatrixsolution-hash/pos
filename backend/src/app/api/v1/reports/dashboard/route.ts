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
        const currentYear = start.getFullYear();
        const currentMonth = start.getMonth();
        const currentDate = start.getDate();

        if (currentMonth > 6 || (currentMonth === 6 && currentDate >= 16)) {
          start = new Date(currentYear, 6, 16, 0, 0, 0, 0);
          end = new Date(currentYear + 1, 6, 15, 23, 59, 59, 999);
        } else {
          start = new Date(currentYear - 1, 6, 16, 0, 0, 0, 0);
          end = new Date(currentYear, 6, 15, 23, 59, 59, 999);
        }
      } else {
        const currentYear = start.getFullYear();
        start = new Date(currentYear, 0, 1, 0, 0, 0, 0);
        end = new Date(currentYear, 11, 31, 23, 59, 59, 999);
      }
    } else {
      start.setHours(0, 0, 0, 0);
    }

    // Fetch completed Sales in period (to check which RestaurantOrders are already mirrored)
    const completedSalesInPeriod = await db.sale.findMany({
      where: {
        businessId: context.businessId,
        ...(branchId ? { branchId } : {}),
        status: "COMPLETED",
        deletedAt: null,
        createdAt: { gte: start, lte: end },
      },
      select: {
        id: true,
        invoiceNumber: true,
        total: true,
        discount: true,
        tax: true,
        notes: true,
        createdAt: true,
      },
    });

    const mirroredOrderIds = new Set<string>();
    const mirroredOrderNums = new Set<string>();
    for (const s of completedSalesInPeriod) {
      mirroredOrderNums.add(s.invoiceNumber);
      const match = s.notes?.match(/\[ORDER_ID:([^\]]+)\]/);
      if (match?.[1]) mirroredOrderIds.add(match[1]);
    }

    // Fetch settled RestaurantOrders in period (matched by updatedAt or createdAt)
    const settledRestaurantOrders = await db.restaurantOrder.findMany({
      where: {
        businessId: context.businessId,
        ...(branchId ? { branchId } : {}),
        settlementStatus: "PAID",
        fulfillmentStatus: { not: "CANCELLED" },
        OR: [
          { updatedAt: { gte: start, lte: end } },
          { createdAt: { gte: start, lte: end } },
        ],
      },
      include: {
        table: true,
        orderLines: {
          where: {
            fulfillmentStatus: { not: "CANCELLED" },
            acceptanceStatus: { not: "REJECTED" },
          },
          include: {
            menuItem: {
              include: {
                section: true,
                product: true,
              },
            },
          },
        },
      },
    });

    const unmirroredSettledOrders = settledRestaurantOrders.filter(
      (ro) => !mirroredOrderIds.has(ro.id) && !mirroredOrderNums.has(ro.orderNumber)
    );

    const getOrderRevenue = (ro: any) => {
      const paid = Number(ro.paidAmount || 0);
      const tot = Number(ro.totalAmount || 0);
      if (paid > 0) return paid;
      if (tot > 0) return tot;
      if (Array.isArray(ro.orderLines)) {
        return ro.orderLines.reduce(
          (acc: number, l: any) => acc + Number(l.total || Number(l.unitPrice || l.basePrice || 0) * l.quantity),
          0
        );
      }
      return 0;
    };

    const salesTableTotal = completedSalesInPeriod.reduce(
      (sum, s) => sum + Number(s.total || 0),
      0
    );
    const restaurantUnmirroredTotal = unmirroredSettledOrders.reduce(
      (sum, ro) => sum + getOrderRevenue(ro),
      0
    );

    const totalSales = salesTableTotal + restaurantUnmirroredTotal;

    // 2. Total Purchases
    const purchasesAggregate = await db.purchase.aggregate({
      where: {
        businessId: context.businessId,
        ...(branchId ? { branchId } : {}),
        status: "RECEIVED",
        createdAt: { gte: start, lte: end },
      },
      _sum: { total: true },
    });
    const totalPurchases = purchasesAggregate._sum.total
      ? Number(purchasesAggregate._sum.total)
      : 0;

    // 3. Total Expenses
    const expensesAggregate = await db.expense.aggregate({
      where: {
        businessId: context.businessId,
        ...(branchId ? { branchId } : {}),
        createdAt: { gte: start, lte: end },
      },
      _sum: { amount: true },
    });
    const totalExpenses = expensesAggregate._sum.amount
      ? Number(expensesAggregate._sum.amount)
      : 0;

    // 3b. Total Income
    const incomeAggregate = await db.income.aggregate({
      where: {
        businessId: context.businessId,
        ...(branchId ? { branchId } : {}),
        createdAt: { gte: start, lte: end },
      },
      _sum: { amount: true },
    });
    const totalIncome = incomeAggregate._sum.amount
      ? Number(incomeAggregate._sum.amount)
      : 0;

    // 4. Calculate COGS & Profit from both SaleItems and unmirrored RestaurantOrder lines
    const saleItems = await db.saleItem.findMany({
      where: {
        sale: {
          businessId: context.businessId,
          ...(branchId ? { branchId } : {}),
          status: "COMPLETED",
          deletedAt: null,
          createdAt: { gte: start, lte: end },
        },
      },
      select: {
        productId: true,
        quantity: true,
        costPrice: true,
        total: true,
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            category: { select: { name: true } },
          },
        },
      },
    });

    const saleItemsCogs = saleItems.reduce(
      (sum: number, item: any) => sum + Number(item.quantity) * Number(item.costPrice || 0),
      0
    );
    const restaurantLinesCogs = unmirroredSettledOrders.reduce((sum, ro) => {
      return (
        sum +
        ro.orderLines.reduce((lSum, l) => {
          const unitCost = Number(l.menuItem?.product?.costPrice || 0);
          return lSum + l.quantity * unitCost;
        }, 0)
      );
    }, 0);

    const costOfGoodsSold = saleItemsCogs + restaurantLinesCogs;
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
        const branchStock = prod.productStocks.reduce(
          (sum: number, s: { quantity: number }) => sum + s.quantity,
          0
        );
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

    // 6. Top Selling Products / Dishes (Combine SaleItems + RestaurantOrder Lines)
    const dishStatsMap: Record<
      string,
      { id: string; name: string; sku: string; quantitySold: number; revenue: number }
    > = {};

    for (const item of saleItems) {
      const key = item.product?.name || item.productId;
      if (!dishStatsMap[key]) {
        dishStatsMap[key] = {
          id: item.productId,
          name: item.product?.name || "Menu Item",
          sku: item.product?.sku || "",
          quantitySold: 0,
          revenue: 0,
        };
      }
      dishStatsMap[key].quantitySold += Number(item.quantity || 0);
      dishStatsMap[key].revenue += Number(item.total || 0);
    }

    for (const ro of unmirroredSettledOrders) {
      for (const line of ro.orderLines) {
        const key = line.itemName || line.menuItemId || line.id;
        if (!dishStatsMap[key]) {
          dishStatsMap[key] = {
            id: line.menuItemId || line.id,
            name: line.itemName,
            sku: line.menuItem?.product?.sku || "",
            quantitySold: 0,
            revenue: 0,
          };
        }
        const lineRev =
          Number(line.total || 0) > 0
            ? Number(line.total)
            : Number(line.unitPrice || line.basePrice || 0) * line.quantity;
        dishStatsMap[key].quantitySold += Number(line.quantity || 0);
        dishStatsMap[key].revenue += lineRev;
      }
    }

    const topSellingProducts = Object.values(dishStatsMap)
      .sort((a, b) => b.quantitySold - a.quantitySold || b.revenue - a.revenue)
      .slice(0, 5);

    // 7. Recent Transactions (Combine Sales + Live/Settled Restaurant POS Orders)
    const [recentSales, recentRestaurantOrders] = await Promise.all([
      db.sale.findMany({
        where: {
          businessId: context.businessId,
          ...(branchId ? { branchId } : {}),
          deletedAt: null,
        },
        select: {
          id: true,
          invoiceNumber: true,
          total: true,
          status: true,
          paymentStatus: true,
          notes: true,
          createdAt: true,
          customer: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 8,
      }),
      db.restaurantOrder.findMany({
        where: {
          businessId: context.businessId,
          ...(branchId ? { branchId } : {}),
          fulfillmentStatus: { not: "CANCELLED" },
        },
        include: {
          table: true,
          orderLines: {
            where: {
              fulfillmentStatus: { not: "CANCELLED" },
              acceptanceStatus: { not: "REJECTED" },
            },
          },
        },
        orderBy: { updatedAt: "desc" },
        take: 8,
      }),
    ]);

    const recentMirroredIds = new Set<string>();
    const recentMirroredNums = new Set<string>();
    for (const s of recentSales) {
      recentMirroredNums.add(s.invoiceNumber);
      const m = s.notes?.match(/\[ORDER_ID:([^\]]+)\]/);
      if (m?.[1]) recentMirroredIds.add(m[1]);
    }

    const combinedTransactions = [
      ...recentSales.map((s: any) => {
        const originMatch = s.notes?.match(/\[(Table [^\]]+|DINE_IN|TAKEAWAY|DELIVERY)\]/i);
        const originLabel = originMatch?.[1] ? ` (${originMatch[1]})` : "";
        return {
          id: s.id,
          invoiceNumber: s.invoiceNumber,
          customerName: `${s.customer?.name || "Walk-in Guest"}${originLabel}`,
          total: Number(s.total || 0),
          status: s.status,
          paymentStatus: s.paymentStatus,
          createdAt: s.createdAt,
        };
      }),
      ...recentRestaurantOrders
        .filter((ro) => !recentMirroredIds.has(ro.id) && !recentMirroredNums.has(ro.orderNumber))
        .map((ro) => {
          const tableLabel = ro.table?.tableNumber
            ? `Table ${ro.table.tableNumber}`
            : ro.orderType === "TAKEAWAY"
            ? "Takeaway Order"
            : ro.orderType === "DELIVERY"
            ? "Delivery Order"
            : "Restaurant POS";
          return {
            id: ro.id,
            invoiceNumber: ro.orderNumber,
            customerName: tableLabel,
            total: getOrderRevenue(ro),
            status: ro.fulfillmentStatus,
            paymentStatus: ro.settlementStatus,
            createdAt: ro.updatedAt || ro.createdAt,
          };
        }),
    ]
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      .slice(0, 6);

    // 8. Sales Chart Data for the Last 7 Days (Sales + Unmirrored Settled RestaurantOrders)
    const chartData = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayStart = new Date(d.setHours(0, 0, 0, 0));
      const dayEnd = new Date(d.setHours(23, 59, 59, 999));

      const [daySalesList, dayRestOrders] = await Promise.all([
        db.sale.findMany({
          where: {
            businessId: context.businessId,
            ...(branchId ? { branchId } : {}),
            status: "COMPLETED",
            deletedAt: null,
            createdAt: { gte: dayStart, lte: dayEnd },
          },
          select: { invoiceNumber: true, total: true, notes: true },
        }),
        db.restaurantOrder.findMany({
          where: {
            businessId: context.businessId,
            ...(branchId ? { branchId } : {}),
            settlementStatus: "PAID",
            fulfillmentStatus: { not: "CANCELLED" },
            updatedAt: { gte: dayStart, lte: dayEnd },
          },
          include: {
            orderLines: {
              where: {
                fulfillmentStatus: { not: "CANCELLED" },
                acceptanceStatus: { not: "REJECTED" },
              },
            },
          },
        }),
      ]);

      const dayMirroredIds = new Set<string>();
      const dayMirroredNums = new Set<string>();
      let daySalesSum = 0;
      for (const s of daySalesList) {
        daySalesSum += Number(s.total || 0);
        dayMirroredNums.add(s.invoiceNumber);
        const m = s.notes?.match(/\[ORDER_ID:([^\]]+)\]/);
        if (m?.[1]) dayMirroredIds.add(m[1]);
      }

      for (const ro of dayRestOrders) {
        if (!dayMirroredIds.has(ro.id) && !dayMirroredNums.has(ro.orderNumber)) {
          daySalesSum += getOrderRevenue(ro);
        }
      }

      const dayName = dayStart.toLocaleDateString("en-US", { weekday: "short" });
      chartData.push({
        name: dayName,
        date: dayStart.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        sales: daySalesSum,
      });
    }

    // Count total settled bills in period
    const ordersCount = completedSalesInPeriod.length + unmirroredSettledOrders.length;

    // Count active customers
    const customersCount = await db.customer.count({
      where: {
        businessId: context.businessId,
        deletedAt: null,
      },
    });

    // Count all low stock alert items
    const alertsCount = products
      .map((prod: any) => {
        const branchStock = prod.productStocks.reduce(
          (sum: number, s: { quantity: number }) => sum + s.quantity,
          0
        );
        return branchStock <= prod.alertQuantity;
      })
      .filter(Boolean).length;

    // 9. Sales by Category (SaleItems + RestaurantOrder Lines)
    const categoryMap: Record<string, number> = {};
    for (const item of saleItems) {
      const catName = item.product?.category?.name || "Restaurant Menu";
      categoryMap[catName] = (categoryMap[catName] || 0) + Number(item.total || 0);
    }
    for (const ro of unmirroredSettledOrders) {
      for (const line of ro.orderLines) {
        const catName = line.menuItem?.section?.name || "Restaurant Menu";
        const lineRev =
          Number(line.total || 0) > 0
            ? Number(line.total)
            : Number(line.unitPrice || line.basePrice || 0) * line.quantity;
        categoryMap[catName] = (categoryMap[catName] || 0) + lineRev;
      }
    }

    const totalCatSales = Object.values(categoryMap).reduce(
      (a: number, b: number) => a + b,
      0
    );
    const salesByCategory = Object.keys(categoryMap)
      .map((name: string) => ({
        name,
        value:
          totalCatSales > 0
            ? Math.round((categoryMap[name] / totalCatSales) * 100)
            : 0,
        totalAmount: categoryMap[name],
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    const outOfStockProducts = products
      .map((prod: any) => {
        const branchStock = prod.productStocks.reduce(
          (sum: number, s: { quantity: number }) => sum + s.quantity,
          0
        );
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

    const todayPoint = chartData[chartData.length - 1];
    const todayStats = {
      sales: todayPoint?.sales || 0,
      orders: ordersCount,
    };

    // 10. Hospitality and Floor snapshot
    let rooms: any[] = [];
    let tables: any[] = [];
    let activeStaysCount = 0;
    try {
      [rooms, tables, activeStaysCount] = await Promise.all([
        db.room.findMany({
          where: { businessId: context.businessId, isActive: true },
          select: { status: true },
        }),
        db.restaurantTable.findMany({
          where: { businessId: context.businessId },
          select: { status: true },
        }),
        (db as any).stay
          ? (db as any).stay.count({
              where: { businessId: context.businessId, status: "CHECKED_IN" },
            })
          : 0,
      ]);
    } catch {
      // safe fallback
    }

    const hospitalityStats = {
      rooms: {
        total: rooms.length,
        occupied: rooms.filter(
          (r: any) => r.status && r.status.includes("OCCUPIED")
        ).length,
        vacant: rooms.filter(
          (r: any) => r.status && r.status.startsWith("VACANT")
        ).length,
        maintenance: rooms.filter(
          (r: any) =>
            r.status &&
            (r.status.includes("DIRTY") ||
              r.status.includes("MAINTENANCE") ||
              r.status.includes("SERVICE"))
        ).length,
      },
      tables: {
        total: tables.length,
        occupied: tables.filter(
          (t: any) => t.status === "OCCUPIED" || t.status === "BILLED"
        ).length,
        available: tables.filter((t: any) => t.status === "AVAILABLE").length,
      },
      activeStays: activeStaysCount,
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
      recentTransactions: combinedTransactions,
      salesChart: chartData,
      salesByCategory,
      outOfStockProducts,
      todayStats,
      hospitalityStats,
    });
  } catch (error: unknown) {
    console.error("GET dashboard reports error:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard reports" },
      { status: 500 }
    );
  }
}
