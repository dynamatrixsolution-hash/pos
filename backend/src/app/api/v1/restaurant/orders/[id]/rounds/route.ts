import { NextResponse } from "next/server";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";
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

const appendRoundSchema = z.object({
  items: z.array(orderItemSchema).min(1, "At least one item is required in the round"),
  notes: z.string().optional(),
  autoRouteToKitchen: z.boolean().optional().default(true),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();

    const { id: orderId } = await params;
    const body = await req.json().catch(() => ({}));
    const parsed = appendRoundSchema.parse(body);

    const existingOrder = await db.restaurantOrder.findFirst({
      where: { id: orderId, businessId: session.businessId },
    });

    if (!existingOrder) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Normalize items
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

    const result = await createOrAppendOrder({
      businessId: session.businessId,
      branchId: existingOrder.branchId,
      orderId,
      orderType: existingOrder.orderType,
      items: normalizedItems,
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
        console.warn("Auto-route round to kitchen warning:", routeErr);
      }
    }

    const updatedOrder = await db.restaurantOrder.findUnique({
      where: { id: orderId },
      include: {
        tableSession: true,
        table: true,
        rounds: {
          include: { lines: true },
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
    return NextResponse.json({ error: error.message || "Failed to append order round" }, { status: 500 });
  }
}

