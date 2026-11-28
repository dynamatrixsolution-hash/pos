import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse, safeErrorMessage, requireRoles, ROLE_GROUPS } from "@/lib/api-helper";
import { dispatchNotification } from "@/lib/notifications";
import {
  updateLineStatus,
  RestaurantOrderError,
} from "@/lib/services/restaurant-order-service";
import { z } from "zod";

const updateLineStatusSchema = z.object({
  quantity: z.number().int().min(0).optional(),
  acceptanceStatus: z.enum(["PENDING", "ACCEPTED", "REJECTED"]).optional(),
  fulfillmentStatus: z.enum(["QUEUED", "PREPARING", "READY", "SERVED", "CANCELLED"]).optional(),
  settlementStatus: z.enum(["UNPAID", "PARTIAL", "PAID", "REFUNDED"]).optional(),
  rejectionReason: z.string().optional(),
  voidReason: z.string().optional(),
  notes: z.string().max(500).optional(),
  expectedVersion: z.number().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; lineId: string }> }
) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();
    const denied = requireRoles(session, ROLE_GROUPS.RESTAURANT_SERVICE);
    if (denied) return denied;

    const { id: orderId, lineId } = await params;
    const body = await req.json();
    const parsed = updateLineStatusSchema.parse(body);

    const prevLine = await db.orderLine.findFirst({
      where: { id: lineId, orderId, businessId: session.businessId },
      select: { fulfillmentStatus: true, quantity: true },
    });

    const updatedLine = await updateLineStatus({
      businessId: session.businessId,
      orderId,
      lineId,
      quantity: parsed.quantity,
      acceptanceStatus: parsed.acceptanceStatus,
      fulfillmentStatus: parsed.fulfillmentStatus,
      settlementStatus: parsed.settlementStatus,
      rejectionReason: parsed.rejectionReason,
      voidReason: parsed.voidReason,
      notes: parsed.notes,
      actorId: session.userId,
      expectedVersion: parsed.expectedVersion,
    });

    const isCancelled =
      updatedLine.acceptanceStatus === "REJECTED" ||
      updatedLine.fulfillmentStatus === "CANCELLED";
    const isQtyReduced =
      !isCancelled &&
      prevLine != null &&
      parsed.quantity !== undefined &&
      updatedLine.quantity < prevLine.quantity;

    if (isCancelled || isQtyReduced) {
      const wasPreparing = prevLine?.fulfillmentStatus === "PREPARING";
      const reasonText = (parsed.rejectionReason || parsed.voidReason || "").trim();

      void (async () => {
        try {
          const order = await db.restaurantOrder.findUnique({
            where: { id: updatedLine.orderId },
            select: {
              orderNumber: true,
              tableSessionId: true,
              table: { select: { tableNumber: true } },
            },
          });
          if (!order) return;

          const locLabel = order.table?.tableNumber
            ? `Table ${order.table.tableNumber}`
            : `Order #${order.orderNumber}`;
          const itemLabel = `${prevLine?.quantity ?? updatedLine.quantity}x ${updatedLine.itemName}`;
          const tasks: Promise<unknown>[] = [];

          // 1. Immediately alert Kitchen staff (URGENT if already PREPARING)
          tasks.push(
            dispatchNotification({
              businessId: session.businessId,
              targetRoles: ["CHEF", "KITCHEN_STAFF", "MANAGER", "OWNER"],
              category: "KITCHEN",
              priority: wasPreparing ? "URGENT" : "HIGH",
              title: isCancelled
                ? wasPreparing
                  ? `STOP PREP: ${itemLabel} (${locLabel})`
                  : `Item Cancelled: ${itemLabel} (${locLabel})`
                : `Qty Reduced: ${updatedLine.itemName} (${locLabel})`,
              message: isCancelled
                ? `${wasPreparing ? "Item was already preparing. Stop cooking immediately. " : ""}${itemLabel} cancelled by waiter${reasonText ? `: ${reasonText}` : ""}.`
                : `Waiter reduced ${updatedLine.itemName} from ${prevLine!.quantity}x to ${updatedLine.quantity}x${reasonText ? ` (${reasonText})` : ""}.`,
              actionUrl: "/dashboard/restaurant/kds",
              dedupeKey: `pos-line-kds:${updatedLine.id}:${isCancelled ? "CANCEL" : `QTY_${updatedLine.quantity}`}`,
            })
          );

          // 2. Notify active QR guest session if present
          if (order.tableSessionId) {
            const guestSession = await db.guestSession.findFirst({
              where: { tableSessionId: order.tableSessionId, status: "ACTIVE" },
              orderBy: { lastActiveAt: "desc" },
              select: { id: true },
            });
            if (guestSession) {
              tasks.push(
                dispatchNotification({
                  businessId: session.businessId,
                  guestSessionId: guestSession.id,
                  category: "ORDER",
                  priority: "NORMAL",
                  title: isCancelled
                    ? `Item Cancelled: ${updatedLine.itemName}`
                    : `Quantity Updated: ${updatedLine.itemName}`,
                  message: isCancelled
                    ? `${itemLabel} was removed from your ${locLabel} order${reasonText ? ` (${reasonText})` : ""}.`
                    : `${updatedLine.itemName} updated to ${updatedLine.quantity}x for ${locLabel}.`,
                  dedupeKey: `pos-line-guest:${updatedLine.id}:${isCancelled ? "CANCEL" : `QTY_${updatedLine.quantity}`}`,
                })
              );
            }
          }

          await Promise.all(tasks);
        } catch (err) {
          console.error("[Notifications] POS line cancellation notification error:", err);
        }
      })();
    }

    return NextResponse.json({
      success: true,
      line: updatedLine,
      wasPreparing: prevLine?.fulfillmentStatus === "PREPARING",
    });
  } catch (error: any) {
    if (error instanceof RestaurantOrderError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Validation failed" }, { status: 400 });
    }
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to update order line status") },
      { status: 500 }
    );
  }
}

