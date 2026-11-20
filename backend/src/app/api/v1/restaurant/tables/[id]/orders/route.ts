import { NextResponse } from "next/server";
import { getSessionContext, authErrorResponse, safeErrorMessage } from "@/lib/api-helper";
import { db } from "@/lib/db";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();

    const { id: tableId } = await params;

    const table = await db.restaurantTable.findFirst({
      where: {
        id: tableId,
        businessId: session.businessId,
      },
    });

    if (!table) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 });
    }

    // Only return unpaid orders belonging to the table's CURRENT active session.
    // Prevents stale/unclosed orders from previous sessions from leaking onto newly seated guests.
    if (!table.currentSessionId) {
      return NextResponse.json({
        activeOrder: null,
        order: null,
        orders: [],
      });
    }

    const orders = await db.restaurantOrder.findMany({
      where: {
        businessId: session.businessId,
        tableId,
        tableSessionId: table.currentSessionId,
        settlementStatus: { in: ["UNPAID", "PARTIAL"] },
        fulfillmentStatus: { not: "CANCELLED" },
        tableSession: {
          status: { in: ["ACTIVE", "BILLED"] },
        },
      },
      include: {
        tableSession: true,
        rounds: {
          include: {
            lines: true,
          },
          orderBy: { roundNumber: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const activeOrder = orders[0] || null;

    return NextResponse.json({
      activeOrder,
      order: activeOrder,
      orders,
    });
  } catch (error: any) {
    console.error("GET /restaurant/tables/[id]/orders error:", error);
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to fetch table orders") },
      { status: 500 }
    );
  }
}
