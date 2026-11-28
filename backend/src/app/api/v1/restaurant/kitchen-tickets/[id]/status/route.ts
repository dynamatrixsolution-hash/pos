import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse, safeErrorMessage, requireRoles, ROLE_GROUPS } from "@/lib/api-helper";
import { dispatchNotification } from "@/lib/notifications";
import {
  advanceTicketStatus,
  KitchenRoutingError,
} from "@/lib/services/kitchen-routing-service";
import { RecipeServiceError } from "@/lib/services/recipe-consumption-service";
import { StockLedgerError } from "@/lib/services/stock-ledger-service";
import { z } from "zod";

const updateTicketStatusSchema = z.object({
  status: z.enum(["QUEUED", "PREPARING", "READY", "SERVED", "CANCELLED"]),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();
    const denied = requireRoles(session, ROLE_GROUPS.KITCHEN_OPERATIONS);
    if (denied) return denied;

    const { id: ticketId } = await params;
    const body = await req.json();
    const parsed = updateTicketStatusSchema.parse(body);

    const ticket = await advanceTicketStatus({
      businessId: session.businessId,
      ticketId,
      newStatus: parsed.status,
      actorId: session.userId,
    });

    // Notify Guest & Floor Staff on PREPARING / READY / SERVED / CANCELLED transitions
    if (["PREPARING", "READY", "SERVED", "CANCELLED"].includes(parsed.status)) {
      void (async () => {
        try {
          const fullTicket = await db.kitchenTicket.findUnique({
            where: { id: ticketId },
            select: {
              id: true,
              ticketNumber: true,
              lines: { select: { quantity: true } },
              order: {
                select: {
                  orderNumber: true,
                  tableSessionId: true,
                  table: { select: { tableNumber: true } },
                },
              },
            },
          });
          if (!fullTicket) return;

          const locLabel = fullTicket.order?.table?.tableNumber
            ? `Table ${fullTicket.order.table.tableNumber}`
            : "your table";

          const guestSession = fullTicket.order?.tableSessionId
            ? await db.guestSession.findFirst({
                where: { tableSessionId: fullTicket.order.tableSessionId, status: "ACTIVE" },
                orderBy: { lastActiveAt: "desc" },
                select: { id: true },
              })
            : null;

          if (parsed.status === "PREPARING" && guestSession) {
            const totalQty = fullTicket.lines.reduce((s, l) => s + l.quantity, 0);
            const estMinutes = Math.min(35, Math.max(10, 8 + totalQty * 3));
            await dispatchNotification({
              businessId: session.businessId,
              guestSessionId: guestSession.id,
              category: "KITCHEN",
              title: "Your Food is Being Prepared",
              message: `Our kitchen has started cooking Order #${fullTicket.order?.orderNumber || fullTicket.ticketNumber}. Estimated preparation time: ~${estMinutes} mins.`,
              metadata: { etaMinutes: estMinutes, ticketId: fullTicket.id },
              dedupeKey: `kds-prep:${fullTicket.id}`,
            });
          }

          if (parsed.status === "READY") {
            await Promise.all([
              ...(guestSession
                ? [
                    dispatchNotification({
                      businessId: session.businessId,
                      guestSessionId: guestSession.id,
                      category: "KITCHEN",
                      priority: "HIGH",
                      title: "Your Food is Ready!",
                      message: `Your order is freshly cooked and on its way to ${locLabel}.`,
                      dedupeKey: `kds-ready-guest:${fullTicket.id}`,
                    }),
                  ]
                : []),
              dispatchNotification({
                businessId: session.businessId,
                targetRoles: ["WAITER", "CASHIER"],
                category: "KITCHEN",
                priority: "HIGH",
                title: `Pickup Ready: ${locLabel}`,
                message: `KOT #${fullTicket.ticketNumber} is ready at the kitchen pass for ${locLabel}.`,
                actionUrl: "/dashboard/restaurant/pos?view=tables",
                dedupeKey: `kds-ready-staff:${fullTicket.id}`,
              }),
            ]);
          }

          if (parsed.status === "SERVED" && guestSession) {
            await dispatchNotification({
              businessId: session.businessId,
              guestSessionId: guestSession.id,
              category: "KITCHEN",
              title: "Order Served — Enjoy Your Meal!",
              message: `Order #${fullTicket.order?.orderNumber || fullTicket.ticketNumber} has been served to ${locLabel}. Tap Services anytime to call a waiter or request your bill.`,
              dedupeKey: `kds-served-guest:${fullTicket.id}`,
            });
          }

          if (parsed.status === "CANCELLED") {
            await Promise.all([
              ...(guestSession
                ? [
                    dispatchNotification({
                      businessId: session.businessId,
                      guestSessionId: guestSession.id,
                      category: "KITCHEN",
                      priority: "HIGH",
                      title: "Order Update — Item Cancelled",
                      message: `KOT #${fullTicket.ticketNumber} for ${locLabel} was cancelled by the kitchen. Please check with our staff if you have questions.`,
                      dedupeKey: `kds-cancelled-guest:${fullTicket.id}`,
                    }),
                  ]
                : []),
              dispatchNotification({
                businessId: session.businessId,
                targetRoles: ["WAITER", "CASHIER", "MANAGER"],
                category: "KITCHEN",
                priority: "HIGH",
                title: `KOT Cancelled: ${locLabel}`,
                message: `KOT #${fullTicket.ticketNumber} for ${locLabel} was cancelled by the kitchen.`,
                actionUrl: "/dashboard/restaurant/pos?view=tables",
                dedupeKey: `kds-cancelled-staff:${fullTicket.id}`,
              }),
            ]);
          }
        } catch (err) {
          console.error("[Notifications] KDS status notification error:", err);
        }
      })();
    }

    return NextResponse.json({ success: true, ticket });
  } catch (error: any) {
    console.error("STATUS PATCH ERROR:", error);
    if (
      error instanceof KitchenRoutingError ||
      error instanceof RecipeServiceError ||
      error instanceof StockLedgerError
    ) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode || 400 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Validation failed" }, { status: 400 });
    }
    return NextResponse.json({ error: safeErrorMessage(error, "Failed to update ticket status") }, { status: 500 });
  }
}

