import { NextResponse } from "next/server";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";
import {
  createOrAppendOrder,
  RestaurantOrderError,
} from "@/lib/services/restaurant-order-service";
import { db } from "@/lib/db";
import { z } from "zod";

const appliedModifierSchema = z.object({
  modifierGroupId: z.string().min(1),
  groupName: z.string().min(1),
  optionId: z.string().min(1),
  optionName: z.string().min(1),
  priceDelta: z.union([z.number(), z.string()]),
});

const orderItemSchema = z.object({
  menuItemId: z.string().optional(),
  itemName: z.string().min(1, "Item name is required"),
  basePrice: z.union([z.number(), z.string()]),
  quantity: z.coerce.number().min(1).default(1),
  appliedModifiers: z.array(appliedModifierSchema).optional().default([]),
  notes: z.string().optional(),
});

const createOrderSchema = z.object({
  branchId: z.string().optional().nullable(),
  tableSessionId: z.string().optional().nullable(),
  tableId: z.string().optional().nullable(),
  orderType: z.enum(["DINE_IN", "TAKEAWAY", "BAR_WALK_IN"]).default("DINE_IN"),
  items: z.array(orderItemSchema).min(1, "At least one item is required"),
  notes: z.string().optional(),
  autoRouteToKitchen: z.boolean().optional().default(true),
});

export async function GET(req: Request) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();

    const { searchParams } = new URL(req.url);
    const tableSessionId = searchParams.get("tableSessionId");
    const tableId = searchParams.get("tableId");
    const branchId = searchParams.get("branchId") || session.branchId;

    const orders = await db.restaurantOrder.findMany({
      where: {
        businessId: session.businessId,
        ...(branchId ? { branchId } : {}),
        ...(tableSessionId ? { tableSessionId } : {}),
        ...(tableId ? { tableId } : {}),
      },
      include: {
        tableSession: true,
        table: true,
        rounds: {
          include: {
            lines: true,
          },
          orderBy: { roundNumber: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ orders });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch orders" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();

    const body = await req.json();
    const parsed = createOrderSchema.parse(body);

    const branchId = parsed.branchId || session.branchId;
    if (!branchId) {
      return NextResponse.json({ error: "Branch ID is required" }, { status: 400 });
    }

    const result = await createOrAppendOrder({
      businessId: session.businessId,
      branchId,
      tableSessionId: parsed.tableSessionId,
      tableId: parsed.tableId,
      orderType: parsed.orderType,
      items: parsed.items,
      notes: parsed.notes,
      actorId: session.userId,
    });

    let routedTickets: any[] = [];
    if (parsed.autoRouteToKitchen && result.round?.id) {
      try {
        const { routeOrderRoundToStations } = await import("@/lib/services/kitchen-routing-service");
        routedTickets = await routeOrderRoundToStations({
          businessId: session.businessId,
          roundId: result.round.id,
          actorId: session.userId,
        });
      } catch (routeErr) {
        console.warn("Auto-route to kitchen warning:", routeErr);
      }
    }

    const updatedOrder = await db.restaurantOrder.findUnique({
      where: { id: result.order.id },
      include: {
        tableSession: true,
        table: true,
        rounds: {
          include: {
            lines: true,
          },
          orderBy: { roundNumber: "asc" },
        },
      },
    });

    return NextResponse.json(
      { ...result, order: updatedOrder ?? result.order, tickets: routedTickets },
      { status: 201 }
    );
  } catch (error: any) {
    if (error instanceof RestaurantOrderError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Validation failed" }, { status: 400 });
    }
    return NextResponse.json({ error: error.message || "Failed to place order" }, { status: 500 });
  }
}

