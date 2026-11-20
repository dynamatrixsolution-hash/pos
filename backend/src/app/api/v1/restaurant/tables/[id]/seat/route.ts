import { NextResponse } from "next/server";
import { getSessionContext, authErrorResponse, safeErrorMessage, requireRoles, ROLE_GROUPS } from "@/lib/api-helper";
import { openTableSession, TableSessionError } from "@/lib/services/table-session-service";
import { db } from "@/lib/db";
import { z } from "zod";

const seatSchema = z.object({
  guestCount: z.coerce.number().int().min(1).default(1),
  notes: z.string().optional().nullable(),
  serverStaffId: z.string().optional().nullable(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionContext = await getSessionContext();
    if (!sessionContext) return authErrorResponse();
    const denied = requireRoles(sessionContext, ROLE_GROUPS.RESTAURANT_SERVICE);
    if (denied) return denied;

    const { id: tableId } = await params;
    const body = await req.json().catch(() => ({}));
    const parsed = seatSchema.parse(body);

    // Look up table to determine branchId if not in context
    const table = await db.restaurantTable.findFirst({
      where: {
        id: tableId,
        businessId: sessionContext.businessId,
        isActive: true,
      },
    });

    if (!table) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 });
    }

    const branchId = sessionContext.branchId || table.branchId;

    // Check if table already has an active session with orders to avoid throwing 409
    const existingActiveSession = await db.tableSession.findFirst({
      where: {
        tableId,
        businessId: sessionContext.businessId,
        status: { in: ["ACTIVE", "BILLED"] },
      },
      include: {
        restaurantOrders: {
          where: {
            settlementStatus: { not: "PAID" },
            fulfillmentStatus: { not: "CANCELLED" },
          },
        },
      },
    });

    if (existingActiveSession && existingActiveSession.restaurantOrders && existingActiveSession.restaurantOrders.length > 0) {
      return NextResponse.json({
        success: true,
        session: existingActiveSession,
        message: `Table ${table.tableNumber} already has an active session.`,
        alreadyActive: true,
      }, { status: 200 });
    }

    const session = await openTableSession({
      businessId: sessionContext.businessId,
      branchId,
      tableId,
      guestCount: parsed.guestCount,
      openedById: sessionContext.userId,
      serverStaffId: parsed.serverStaffId || sessionContext.userId,
      notes: parsed.notes || null,
    });

    return NextResponse.json({
      success: true,
      session,
      message: `Table ${table.tableNumber} seated with ${parsed.guestCount} guests.`,
    }, { status: 201 });
  } catch (error: any) {
    if (error instanceof TableSessionError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Validation failed" },
        { status: 400 }
      );
    }
    console.error("POST /restaurant/tables/[id]/seat error:", error);
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to seat table") },
      { status: 500 }
    );
  }
}

