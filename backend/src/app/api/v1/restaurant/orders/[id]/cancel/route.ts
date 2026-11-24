import { NextResponse } from "next/server";
import { getSessionContext, authErrorResponse, safeErrorMessage, requireRoles, ROLE_GROUPS } from "@/lib/api-helper";
import { db } from "@/lib/db";
import { dispatchNotification } from "@/lib/notifications";
import {
  cancelRestaurantOrder,
  RestaurantOrderError,
} from "@/lib/services/restaurant-order-service";
import { z } from "zod";

const cancelOrderSchema = z.object({
  reason: z.string().optional().default("Order cancelled by staff"),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();
    const denied = requireRoles(session, ROLE_GROUPS.RESTAURANT_BILLING);
    if (denied) return denied;

    const { id: orderId } = await params;
    const body = await req.json().catch(() => ({}));
    const parsed = cancelOrderSchema.parse(body);

    const cancelledOrder = await cancelRestaurantOrder({
      businessId: session.businessId,
      orderId,
      reason: parsed.reason,
      actorId: session.userId,
    });

    // Notify guest when staff cancels/rejects their order
    void (async () => {
      try {
        const gs = cancelledOrder.tableSessionId
          ? await db.guestSession.findFirst({
              where: { tableSessionId: cancelledOrder.tableSessionId, status: "ACTIVE" },
              orderBy: { lastActiveAt: "desc" },
              select: { id: true },
            })
          : null;

        await dispatchNotification({
          businessId: session.businessId,
          ...(gs ? { guestSessionId: gs.id } : { targetRoles: ["GUEST"] }),
          category: "ORDER",
          priority: "HIGH",
          title: `Order #${cancelledOrder.orderNumber} Cancelled`,
          message: parsed.reason
            ? `Your order was cancelled: ${parsed.reason}`
            : `Your order #${cancelledOrder.orderNumber} has been cancelled by staff.`,
          dedupeKey: `order-cancelled-guest:${cancelledOrder.id}`,
        });
      } catch (err) {
        console.error("[Notifications] Staff cancel guest notification error:", err);
      }
    })();

    return NextResponse.json({
      success: true,
      order: cancelledOrder,
      message: "Order cancelled successfully",
    });
  } catch (error: any) {
    if (error instanceof RestaurantOrderError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Validation failed" }, { status: 400 });
    }
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to cancel order") },
      { status: 500 }
    );
  }
}

