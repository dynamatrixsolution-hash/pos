import { NextResponse } from "next/server";
import {
  getSessionContext,
  authErrorResponse,
  getPaginationParams,
  paginationMeta,
  safeErrorMessage,
  requireRoles,
  ROLE_GROUPS,
} from "@/lib/api-helper";
import { runWithOptionalIdempotency } from "@/lib/commerce-transaction";
import { CommerceError } from "@/lib/commerce-policy";
import {
  createOrAppendOrder,
  RestaurantOrderError,
} from "@/lib/services/restaurant-order-service";
import { db } from "@/lib/db";
import { z } from "zod";

const appliedModifierSchema = z.object({
  modifierGroupId: z.string().optional().default("default-group"),
  groupName: z.string().optional().default("Modifier"),
  optionId: z.string().optional().default("default-option"),
  optionName: z.string().min(1),
  priceDelta: z.union([z.number(), z.string()]).default(0),
});

const orderItemSchema = z.object({
  menuItemId: z.string().optional(),
  itemName: z.string().optional(),
  basePrice: z.union([z.number(), z.string()]).optional(),
  quantity: z.coerce.number().min(1).default(1),
  appliedModifiers: z.array(appliedModifierSchema).optional().default([]),
  selectedModifiers: z.array(z.any()).optional().default([]),
  notes: z.string().optional(),
});

const createOrderSchema = z.object({
  branchId: z.string().optional().nullable(),
  tableSessionId: z.string().optional().nullable(),
  tableId: z.string().optional().nullable(),
  orderType: z.enum(["DINE_IN", "TAKEAWAY", "BAR_WALK_IN", "DELIVERY", "ROOM_SERVICE"]).default("DINE_IN"),
  roomServiceInfo: z
    .object({
      stayId: z.string().optional(),
      roomId: z.string().optional(),
      roomNumber: z.string().optional(),
      floorName: z.string().optional(),
      guestName: z.string().optional(),
      chargeToFolio: z.boolean().optional(),
    })
    .optional(),
  deliveryInfo: z
    .object({
      customerName: z.string().optional(),
      phone: z.string().optional(),
      address: z.string().optional(),
      riderName: z.string().optional(),
      deliveryFee: z.union([z.number(), z.string()]).optional(),
      packagingFee: z.union([z.number(), z.string()]).optional(),
      expressFee: z.union([z.number(), z.string()]).optional(),
    })
    .optional(),
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
    const status = searchParams.get("status")?.toUpperCase();
    const settlementStatus = searchParams.get("settlementStatus")?.toUpperCase();
    const fulfillmentStatus = searchParams.get("fulfillmentStatus")?.toUpperCase();
    const { page, limit, skip, take } = getPaginationParams(req, 100, 200);

    const where: any = {
      businessId: session.businessId,
      ...(branchId ? { branchId } : {}),
      ...(tableSessionId ? { tableSessionId } : {}),
      ...(tableId ? { tableId } : {}),
    };

    if (status === "ACTIVE") {
      where.settlementStatus = { not: "PAID" };
      where.fulfillmentStatus = { not: "CANCELLED" };
    } else {
      if (settlementStatus) where.settlementStatus = settlementStatus;
      if (fulfillmentStatus) where.fulfillmentStatus = fulfillmentStatus;
    }

    const [orders, total] = await Promise.all([
      db.restaurantOrder.findMany({
        where,
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
        skip,
        take,
      }),
      db.restaurantOrder.count({ where }),
    ]);

    return NextResponse.json({
      orders,
      pagination: paginationMeta(total, page, limit),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to fetch orders") },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();
    const denied = requireRoles(session, ROLE_GROUPS.RESTAURANT_SERVICE);
    if (denied) return denied;

    const body = await req.json();
    const parsed = createOrderSchema.parse(body);

    let branchId: string | undefined = (parsed.branchId || session.branchId) ?? undefined;
    if (!branchId) {
      const defaultBranch = await db.branch.findFirst({
        where: { businessId: session.businessId, deletedAt: null },
        orderBy: { createdAt: "asc" },
      });
      branchId = defaultBranch?.id;
    }
    if (!branchId) {
      return NextResponse.json({ error: "Branch ID is required" }, { status: 400 });
    }

    let finalNotes = parsed.notes || "";
    if (parsed.orderType === "DELIVERY" && parsed.deliveryInfo) {
      const d = parsed.deliveryInfo;
      const dParts = [
        d.customerName ? `Customer: ${d.customerName}` : "",
        d.phone ? `Phone: ${d.phone}` : "",
        d.address ? `Address: ${d.address}` : "",
        d.riderName ? `Rider: ${d.riderName}` : "",
        d.deliveryFee ? `Delivery Fee: ${d.deliveryFee}` : "",
        d.packagingFee ? `Packaging: ${d.packagingFee}` : "",
        d.expressFee ? `Express: ${d.expressFee}` : "",
      ].filter(Boolean);
      if (dParts.length > 0) {
        const deliveryNote = `[DELIVERY] ${dParts.join(" | ")}`;
        finalNotes = finalNotes ? `${deliveryNote}\n${finalNotes}` : deliveryNote;
      }
    } else if (parsed.orderType === "ROOM_SERVICE" && parsed.roomServiceInfo) {
      const r = parsed.roomServiceInfo;
      const rParts = [
        r.roomNumber ? `Room ${r.roomNumber}` : "",
        r.floorName ? `Floor: ${r.floorName}` : "",
        r.guestName ? `Guest: ${r.guestName}` : "",
      ].filter(Boolean);
      if (rParts.length > 0) {
        const roomNote = `[Room Service • ${rParts.join(" • ")}]`;
        finalNotes = finalNotes ? `${roomNote}\n${finalNotes}` : roomNote;
      }
    }

    // Isolate DINE_IN from TAKEAWAY and DELIVERY so delivery never associates with a table
    const effectiveTableId = parsed.orderType === "DINE_IN" ? (parsed.tableId || null) : null;
    let effectiveTableSessionId = parsed.orderType === "DINE_IN" ? (parsed.tableSessionId || null) : null;

    // Auto-resolve or auto-create table session if waiter directly took order on a table without pre-seating
    if (parsed.orderType === "DINE_IN" && effectiveTableId && !effectiveTableSessionId) {
      const activeSession = await db.tableSession.findFirst({
        where: {
          tableId: effectiveTableId,
          businessId: session.businessId,
          status: { in: ["ACTIVE", "BILLED"] },
        },
        select: { id: true },
      });
      if (activeSession) {
        effectiveTableSessionId = activeSession.id;
      } else {
        try {
          const { openTableSession } = await import("@/lib/services/table-session-service");
          const newSession = await openTableSession({
            businessId: session.businessId,
            branchId,
            tableId: effectiveTableId,
            guestCount: 0,
            openedById: session.userId,
            notes: "Direct POS Order",
          });
          effectiveTableSessionId = newSession.session.id;
        } catch (openErr) {
          console.warn("Auto-open session note:", openErr);
        }
      }
    }

    let effectiveOrderType = parsed.orderType;
    if (parsed.orderType === "DINE_IN" && !effectiveTableId) {
      // Waiter took direct dine-in order at counter without selecting a table
      effectiveOrderType = "BAR_WALK_IN";
      finalNotes = finalNotes ? `[Counter / Walk-in Dine-In] ${finalNotes}` : "[Counter / Walk-in Dine-In]";
    }

    // Normalize item lines: lookup missing itemName / basePrice by menuItemId if needed
    const normalizedItems = await Promise.all(
      parsed.items.map(async (item) => {
        let name = item.itemName;
        let price = item.basePrice;
        if ((!name || price === undefined) && item.menuItemId) {
          const mi = await db.menuItem.findUnique({
            where: { id: item.menuItemId },
            select: { name: true, basePrice: true },
          });
          if (mi) {
            name = name || mi.name;
            price = price !== undefined ? price : mi.basePrice.toString();
          }
        }
        let mods = item.appliedModifiers || [];
        if (mods.length === 0 && item.selectedModifiers && item.selectedModifiers.length > 0) {
          mods = item.selectedModifiers.map((sm: any) => ({
            modifierGroupId: sm.modifierGroupId || "default-group",
            groupName: sm.groupName || "Modifier",
            optionId: sm.optionId || "default-option",
            optionName: sm.optionName || sm.name || "Option",
            priceDelta: sm.priceAdjustment || sm.priceDelta || 0,
          }));
        }
        return {
          menuItemId: item.menuItemId,
          itemName: name || "Menu Item",
          basePrice: price !== undefined ? price : 0,
          quantity: item.quantity,
          appliedModifiers: mods,
          notes: item.notes,
        };
      })
    );

    const { result, replayed } = await runWithOptionalIdempotency(
      req,
      session,
      "RESTAURANT_ORDER_CREATE",
      parsed,
      async (tx) =>
        createOrAppendOrder(
          {
            businessId: session.businessId,
            branchId,
            tableSessionId: effectiveTableSessionId,
            tableId: effectiveTableId,
            orderType: effectiveOrderType,
            acceptanceStatus: "ACCEPTED",
            items: normalizedItems,
            notes: finalNotes || undefined,
            actorId: session.userId,
          },
          tx
        )
    );

    if (replayed) {
      return NextResponse.json(result, {
        status: 201,
        headers: { "X-Idempotent-Replay": "true" },
      });
    }

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

    // Auto-post to Hotel Room Folio if requested
    if (
      parsed.orderType === "ROOM_SERVICE" &&
      parsed.roomServiceInfo?.stayId &&
      parsed.roomServiceInfo?.chargeToFolio
    ) {
      try {
        const { postRestaurantOrderToFolio } = await import("@/lib/services/folio-service");
        await postRestaurantOrderToFolio({
          businessId: session.businessId,
          branchId,
          orderId: result.order.id,
          stayId: parsed.roomServiceInfo.stayId,
          actorId: session.userId,
        });
      } catch (folioErr) {
        console.warn("Auto-post room order to folio warning:", folioErr);
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
    console.error("Order creation POST error:", error);
    if (error instanceof CommerceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof RestaurantOrderError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Validation failed" }, { status: 400 });
    }
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to place order") },
      { status: 500 }
    );
  }
}

