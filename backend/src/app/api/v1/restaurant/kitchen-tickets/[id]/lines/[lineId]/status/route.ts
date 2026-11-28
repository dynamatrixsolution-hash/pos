import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse, safeErrorMessage, requireRoles, ROLE_GROUPS } from "@/lib/api-helper";
import { dispatchNotification } from "@/lib/notifications";
import { advanceTicketLineStatus, KitchenRoutingError } from "@/lib/services/kitchen-routing-service";
import { RestaurantOrderError } from "@/lib/services/restaurant-order-service";
import { z } from "zod";

const updateLineStatusSchema = z.object({
  status: z.string(),
  reason: z.string().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; lineId: string }> }
) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();
    const denied = requireRoles(session, ROLE_GROUPS.KITCHEN_OPERATIONS);
    if (denied) return denied;

    const { lineId } = await params;
    const body = await req.json();
    const parsed = updateLineStatusSchema.parse(body);

    const statusUpper = parsed.status.toUpperCase();
    const normalizedStatus = statusUpper === "REJECTED" ? "CANCELLED" : statusUpper;
    const allowedStatuses = ["QUEUED", "PREPARING", "READY", "SERVED", "CANCELLED"] as const;
    if (!allowedStatuses.includes(normalizedStatus as any)) {
      return NextResponse.json({ error: `Invalid line status: ${parsed.status}` }, { status: 400 });
    }

    const updatedLine = await advanceTicketLineStatus({
      businessId: session.businessId,
      ticketLineId: lineId,
      newStatus: normalizedStatus as (typeof allowedStatuses)[number],
      actorId: session.userId,
      wasteReason: parsed.reason,
    });

    if (["PREPARING", "READY", "SERVED", "CANCELLED"].includes(normalizedStatus)) {
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
          const guestSession = order.tableSessionId
            ? await db.guestSession.findFirst({
                where: { tableSessionId: order.tableSessionId, status: "ACTIVE" },
                orderBy: { lastActiveAt: "desc" },
                select: { id: true },
              })
            : null;

          const itemLabel = `${updatedLine.quantity}x ${updatedLine.itemName}`;
          const reasonSuffix = parsed.reason ? `: ${parsed.reason}` : "";
          const tasks: Promise<unknown>[] = [];

          if (guestSession) {
            const titleMap: Record<string, string> = {
              PREPARING: `Preparing: ${updatedLine.itemName}`,
              READY: `Ready to Serve: ${updatedLine.itemName}`,
              SERVED: `Served: ${updatedLine.itemName}`,
              CANCELLED: `Item Cancelled by Kitchen: ${updatedLine.itemName}`,
            };
            const msgMap: Record<string, string> = {
              PREPARING: `Kitchen is now cooking ${itemLabel} for ${locLabel}.`,
              READY: `${itemLabel} is freshly ready and on its way to ${locLabel}.`,
              SERVED: `${itemLabel} has been served to ${locLabel}. Enjoy!`,
              CANCELLED: `${itemLabel} was cancelled by the kitchen${reasonSuffix}. Our staff will assist you shortly.`,
            };
            tasks.push(
              dispatchNotification({
                businessId: session.businessId,
                guestSessionId: guestSession.id,
                category: "KITCHEN",
                priority: normalizedStatus === "READY" || normalizedStatus === "CANCELLED" ? "HIGH" : "NORMAL",
                title: titleMap[normalizedStatus],
                message: msgMap[normalizedStatus],
                dedupeKey: `kds-line-guest:${updatedLine.id}:${normalizedStatus}`,
              })
            );
          }

          if (normalizedStatus === "READY") {
            tasks.push(
              dispatchNotification({
                businessId: session.businessId,
                targetRoles: ["WAITER", "CASHIER"],
                category: "KITCHEN",
                priority: "HIGH",
                title: `Dish Ready: ${locLabel}`,
                message: `${itemLabel} is ready for pickup at kitchen pass (${locLabel}).`,
                actionUrl: "/dashboard/restaurant/pos?view=tables",
                dedupeKey: `kds-line-staff:${updatedLine.id}:READY`,
              })
            );
          } else if (normalizedStatus === "CANCELLED") {
            tasks.push(
              dispatchNotification({
                businessId: session.businessId,
                targetRoles: ["WAITER", "CASHIER", "MANAGER"],
                category: "KITCHEN",
                priority: "URGENT",
                title: `Kitchen Cancelled: ${itemLabel} (${locLabel})`,
                message: `Kitchen cancelled ${itemLabel} for ${locLabel}${reasonSuffix}. Please inform the guest.`,
                actionUrl: "/dashboard/restaurant/pos?view=tables",
                dedupeKey: `kds-line-staff:${updatedLine.id}:CANCELLED`,
              })
            );
          }

          await Promise.all(tasks);
        } catch (err) {
          console.error("[Notifications] KDS line status notification error:", err);
        }
      })();
    }

    return NextResponse.json({
      success: true,
      line: updatedLine,
    });
  } catch (error: any) {
    if (error instanceof KitchenRoutingError || error instanceof RestaurantOrderError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Validation failed" }, { status: 400 });
    }
    console.error("PATCH /kitchen-tickets/[id]/lines/[lineId]/status error:", error);
    return NextResponse.json({ error: safeErrorMessage(error, "Failed to update ticket line status") }, { status: 500 });
  }
}

