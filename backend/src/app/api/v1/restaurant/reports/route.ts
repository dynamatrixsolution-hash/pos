import { NextResponse } from "next/server";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();

    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get("branchId") || session.branchId;
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const dateFilter: any = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter.lte = end;
    }

    const where: any = {
      businessId: session.businessId,
      ...(branchId ? { branchId } : {}),
      ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}),
    };

    const [orders, sessions] = await Promise.all([
      db.restaurantOrder.findMany({
        where,
        include: {
          rounds: {
            include: {
              lines: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      db.tableSession.findMany({
        where,
        select: {
          id: true,
          guestCount: true,
          status: true,
          openedAt: true,
          closedAt: true,
        },
      }),
    ]);

    const totalOrders = orders.length;
    const paidOrders = orders.filter((o) => o.settlementStatus === "PAID");
    const totalRevenue = paidOrders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
    const totalGuests = sessions.reduce((sum, s) => sum + (s.guestCount || 0), 0);
    const averageSpendPerGuest = totalGuests > 0 ? totalRevenue / totalGuests : 0;

    // Item sales breakdown
    const itemSales: Record<string, { name: string; quantity: number; revenue: number }> = {};
    orders.forEach((o) => {
      o.rounds.forEach((r) => {
        r.lines.forEach((l) => {
          if (!itemSales[l.itemName]) {
            itemSales[l.itemName] = { name: l.itemName, quantity: 0, revenue: 0 };
          }
          itemSales[l.itemName].quantity += l.quantity;
          itemSales[l.itemName].revenue += Number(l.total || 0);
        });
      });
    });

    const topSellingItems = Object.values(itemSales)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);

    return NextResponse.json({
      summary: {
        totalOrders,
        paidOrders: paidOrders.length,
        totalRevenue,
        totalGuests,
        averageSpendPerGuest,
      },
      topSellingItems,
      recentOrders: orders.slice(0, 15),
    });
  } catch (error: any) {
    console.error("GET /restaurant/reports error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate restaurant report" },
      { status: 500 }
    );
  }
}
