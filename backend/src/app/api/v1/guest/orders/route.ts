import { NextResponse } from "next/server";
import { safeErrorMessage } from "@/lib/api-helper";
import { db } from "@/lib/db";
import { dispatchNotification } from "@/lib/notifications";
import {
  getGuestOrdersAndTracking,
  submitGuestOrder,
} from "@/lib/services/guest-portal-service";
import { HotelError } from "@/lib/services/room-availability-service";
import { z } from "zod";

function extractGuestToken(req: Request): string | null {
  const headerToken =
    req.headers.get("x-guest-session-token") ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (headerToken) return headerToken.trim();
  const { searchParams } = new URL(req.url);
  return searchParams.get("sessionToken");
}

const submitOrderSchema = z.object({
  sessionToken: z.string().optional(),
  items: z
    .array(
      z.object({
        menuItemId: z.string().min(1, "Menu item ID is required"),
        quantity: z.coerce.number().int().min(1).default(1),
        selectedOptionIds: z.array(z.string()).optional().default([]),
        notes: z.string().optional(),
      })
    )
    .min(1, "At least one item is required"),
  notes: z.string().optional(),
});

export async function GET(req: Request) {
  try {
    const sessionToken = extractGuestToken(req);
    if (!sessionToken) {
      return NextResponse.json(
        { error: "Guest session token required", code: "GUEST_UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const result = await getGuestOrdersAndTracking(sessionToken);
    return NextResponse.json(result);
  } catch (error: any) {
    if (
      error instanceof HotelError ||
      error?.name === "HotelError" ||
      typeof error?.statusCode === "number"
    ) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode || 400 }
      );
    }
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to fetch guest orders") },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = submitOrderSchema.parse(body);

    const sessionToken = extractGuestToken(req) || parsed.sessionToken;
    if (!sessionToken) {
      return NextResponse.json(
        { error: "Guest session token required", code: "GUEST_UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const result = await submitGuestOrder({
      sessionToken,
      items: parsed.items,
      notes: parsed.notes,
    });

    // Fire-and-forget 3-way notification: Floor/Billing Staff + Kitchen + Guest confirmation
    void (async () => {
      try {
        const orderId = (result as any)?.order?.id || (result as any)?.orderId;
        const roundId = (result as any)?.round?.id || (result as any)?.roundId || "r1";
        if (!orderId) return;

        const order = await db.restaurantOrder.findUnique({
          where: { id: orderId },
          select: {
            id: true,
            businessId: true,
            orderNumber: true,
            tableSessionId: true,
            table: { select: { tableNumber: true } },
          },
        });
        if (!order) return;

        const locLabel = order.table?.tableNumber
          ? `Table ${order.table.tableNumber}`
          : "Guest Order";
        const itemCount = parsed.items.reduce((s, i) => s + i.quantity, 0);

        const guestSession = order.tableSessionId
          ? await db.guestSession.findFirst({
              where: { tableSessionId: order.tableSessionId, status: "ACTIVE" },
              orderBy: { lastActiveAt: "desc" },
              select: { id: true },
            })
          : null;

        // Dispatch all 3 audiences in parallel so rush-hour concurrent orders stay fast
        await Promise.all([
          // 1. Notify Cashier, Waiter, Accountant, Manager, Owner
          dispatchNotification({
            businessId: order.businessId,
            targetRoles: ["CASHIER", "WAITER", "ACCOUNTANT", "MANAGER", "OWNER"],
            category: "ORDER",
            priority: "HIGH",
            title: `New Guest Order — ${locLabel}`,
            message: `Order #${order.orderNumber} (${itemCount} item${itemCount > 1 ? "s" : ""}) received from ${locLabel} and routed to kitchen.`,
            actionUrl: "/dashboard/restaurant/pos",
            dedupeKey: `guest-order-staff:${order.id}:${roundId}`,
          }),
          // 2. Notify Kitchen Display staff
          dispatchNotification({
            businessId: order.businessId,
            targetRoles: ["KITCHEN"],
            category: "KITCHEN",
            priority: "URGENT",
            title: `New KOT — ${locLabel}`,
            message: `Order #${order.orderNumber} (${itemCount} item${itemCount > 1 ? "s" : ""}) queued for preparation.`,
            actionUrl: "/dashboard/restaurant/kds",
            dedupeKey: `guest-order-kds:${order.id}:${roundId}`,
          }),
          // 3. Notify Guest session that order is confirmed
          ...(guestSession
            ? [
                dispatchNotification({
                  businessId: order.businessId,
                  guestSessionId: guestSession.id,
                  category: "ORDER",
                  title: `Order #${order.orderNumber} Confirmed`,
                  message: `Your order for ${locLabel} has been accepted and sent to the kitchen.`,
                  dedupeKey: `guest-order-ack:${order.id}:${roundId}`,
                }),
              ]
            : []),
        ]);
      } catch (err) {
        console.error("[Notifications] Guest order dispatch error:", err);
      }
    })();

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    if (
      error instanceof HotelError ||
      error?.name === "HotelError" ||
      typeof error?.statusCode === "number"
    ) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode || 400 }
      );
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Validation failed" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to submit guest order") },
      { status: 500 }
    );
  }
}
