import { NextResponse } from "next/server";
import { getSessionContext, authErrorResponse, safeErrorMessage, requireRoles, ROLE_GROUPS } from "@/lib/api-helper";
import { db } from "@/lib/db";
import { createAuditEvent } from "@/lib/audit-event";
import { dispatchNotification } from "@/lib/notifications";
import { routeOrderRoundToStations } from "@/lib/services/kitchen-routing-service";
import {
  convertRestaurantOrderType,
  RestaurantOrderError,
} from "@/lib/services/restaurant-order-service";
import { z } from "zod";

const patchOrderSchema = z.union([
  z.object({
    action: z.enum(["APPROVE_AND_ROUTE", "DISPATCH_DELIVERY"]),
    riderName: z.string().trim().max(100).optional().nullable(),
    notes: z.string().trim().max(500).optional().nullable(),
  }),
  z.object({
    orderType: z.enum(["TAKEAWAY", "DELIVERY"]),
    deliveryInfo: z
      .object({
        customerName: z.string().max(120).optional(),
        phone: z.string().max(40).optional(),
        address: z.string().max(300).optional(),
        riderName: z.string().max(100).optional(),
        deliveryFee: z.union([z.number(), z.string()]).optional(),
        notes: z.string().max(500).optional(),
      })
      .optional(),
    notes: z.string().max(500).optional(),
  }),
]);

async function resolveGuestSessionForOrder(tableSessionId: string | null | undefined) {
  if (!tableSessionId) return null;
  const gs = await db.guestSession.findFirst({
    where: { tableSessionId, status: "ACTIVE" },
    orderBy: { lastActiveAt: "desc" },
    select: { id: true },
  });
  return gs?.id ?? null;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();
    const denied = requireRoles(session, ROLE_GROUPS.RESTAURANT_SERVICE);
    if (denied) return denied;

    const { id: orderId } = await params;
    const body = await req.json().catch(() => ({}));
    const parsed = patchOrderSchema.parse(body);

    if ("action" in parsed) {
      const existing = await db.restaurantOrder.findFirst({
        where: { id: orderId, businessId: session.businessId },
        include: {
          rounds: { orderBy: { roundNumber: "asc" } },
          orderLines: true,
          kitchenTickets: { include: { lines: true } },
        },
      });
      if (!existing) {
        return NextResponse.json({ error: "Order not found" }, { status: 404 });
      }
      if (existing.fulfillmentStatus === "CANCELLED") {
        return NextResponse.json({ error: "Order is already cancelled" }, { status: 400 });
      }

      if (parsed.action === "APPROVE_AND_ROUTE") {
        const updatedOrder = await db.$transaction(async (tx) => {
          const cleanedNotes = (existing.notes || "")
            .replace(/\[STAFF APPROVAL REQUIRED[^\]]*\]/gi, "")
            .trim();
          const nextNotes = cleanedNotes ? `${cleanedNotes} [CONFIRMED]` : "[CONFIRMED]";

          await tx.orderLine.updateMany({
            where: {
              orderId: existing.id,
              acceptanceStatus: "PENDING",
              fulfillmentStatus: { not: "CANCELLED" },
            },
            data: { acceptanceStatus: "ACCEPTED", version: { increment: 1 } },
          });

          const routedRoundIds = new Set(existing.kitchenTickets.map((t) => t.roundId));
          for (const round of existing.rounds) {
            if (!routedRoundIds.has(round.id) && round.status !== "CANCELLED") {
              await routeOrderRoundToStations(
                {
                  businessId: session.businessId,
                  roundId: round.id,
                  actorId: session.userId,
                },
                tx
              );
            }
          }

          const updated = await tx.restaurantOrder.update({
            where: { id: existing.id },
            data: {
              acceptanceStatus: "ACCEPTED",
              notes: nextNotes,
              version: { increment: 1 },
            },
            include: {
              rounds: { include: { lines: true }, orderBy: { roundNumber: "asc" } },
            },
          });

          await createAuditEvent(
            {
              businessId: session.businessId,
              branchId: existing.branchId,
              userId: session.userId,
              action: "RESTAURANT_ORDER_APPROVED",
              entity: "RestaurantOrder",
              entityId: existing.id,
              newValue: { acceptanceStatus: "ACCEPTED" },
            },
            tx
          );

          return updated;
        });

        // Notify Kitchen + active table guest session (never broadcast personal order updates to all GUEST tokens)
        void (async () => {
          const guestSessionId = await resolveGuestSessionForOrder(existing.tableSessionId);
          const tasks: Promise<unknown>[] = [
            dispatchNotification({
              businessId: session.businessId,
              targetRoles: ["KITCHEN", "CHEF", "KITCHEN_STAFF"],
              category: "KITCHEN",
              priority: "URGENT",
              title: `Confirmed ${existing.orderType} KOT — #${existing.orderNumber}`,
              message: `Order #${existing.orderNumber} was confirmed by staff and sent to kitchen.`,
              actionUrl: "/dashboard/restaurant/kds",
              dedupeKey: `order-approved-kds:${existing.id}`,
            }),
          ];
          if (guestSessionId) {
            tasks.push(
              dispatchNotification({
                businessId: session.businessId,
                guestSessionId,
                category: "ORDER",
                priority: "HIGH",
                title: `Order #${existing.orderNumber} Accepted`,
                message: `Your ${existing.orderType.toLowerCase()} order has been confirmed and our kitchen is preparing your food now.`,
                actionUrl: "/guest",
                dedupeKey: `order-approved-guest:${existing.id}`,
              })
            );
          }
          await Promise.all(tasks);
        })();

        return NextResponse.json({ success: true, order: updatedOrder });
      }

      // DISPATCH_DELIVERY — strict guards: must be DELIVERY, ACCEPTED, KITCHEN READY, and not already SERVED/DISPATCHED
      if (existing.orderType !== "DELIVERY") {
        return NextResponse.json(
          { error: "Only DELIVERY orders can be dispatched to a rider." },
          { status: 400 }
        );
      }
      if (
        existing.acceptanceStatus !== "ACCEPTED" ||
        /\[STAFF APPROVAL REQUIRED/i.test(existing.notes || "")
      ) {
        return NextResponse.json(
          { error: "Please accept and send this order to the kitchen before dispatching a rider.", code: "ORDER_NOT_ACCEPTED" },
          { status: 409 }
        );
      }
      if (existing.fulfillmentStatus === "SERVED") {
        return NextResponse.json(
          { error: "This order has already been delivered / served.", code: "ALREADY_SERVED" },
          { status: 409 }
        );
      }
      if (/\[OUT FOR DELIVERY/i.test(existing.notes || "")) {
        return NextResponse.json(
          { error: "This order is already out for delivery.", code: "ALREADY_DISPATCHED" },
          { status: 409 }
        );
      }

      const activeTickets = existing.kitchenTickets.filter((t) => t.status !== "CANCELLED");
      const activeLines = existing.orderLines.filter(
        (l) => l.fulfillmentStatus !== "CANCELLED" && l.acceptanceStatus !== "REJECTED"
      );
      const kitchenReady =
        existing.fulfillmentStatus === "READY" ||
        (activeTickets.length > 0 && activeTickets.every((t) => t.status === "READY" || t.status === "SERVED")) ||
        (activeLines.length > 0 && activeLines.every((l) => l.fulfillmentStatus === "READY" || l.fulfillmentStatus === "SERVED"));

      if (!kitchenReady) {
        return NextResponse.json(
          {
            error: "Cannot dispatch to rider yet — kitchen has not finished preparing this order. Mark the order Ready in Kitchen Display (KDS) first.",
            code: "KITCHEN_NOT_READY",
          },
          { status: 409 }
        );
      }

      const rider = parsed.riderName?.trim() || "In-House Rider";
      const cleanedNotes = (existing.notes || "")
        .replace(/\[OUT FOR DELIVERY[^\]]*\]/gi, "")
        .trim();
      const nextNotes = `${cleanedNotes} [OUT FOR DELIVERY | Rider: ${rider}]`.trim();

      const updatedOrder = await db.restaurantOrder.update({
        where: { id: existing.id },
        data: {
          fulfillmentStatus: "READY",
          notes: nextNotes,
          version: { increment: 1 },
        },
        include: {
          rounds: { include: { lines: true }, orderBy: { roundNumber: "asc" } },
        },
      });

      await createAuditEvent({
        businessId: session.businessId,
        branchId: existing.branchId,
        userId: session.userId,
        action: "DELIVERY_DISPATCHED",
        entity: "RestaurantOrder",
        entityId: existing.id,
        newValue: { rider, fulfillmentStatus: "READY" },
      });

      // Notify active guest session if linked (delivery tracker polls order status securely by orderNumber + phone)
      void (async () => {
        const guestSessionId = await resolveGuestSessionForOrder(existing.tableSessionId);
        if (!guestSessionId) return;
        await dispatchNotification({
          businessId: session.businessId,
          guestSessionId,
          category: "ORDER",
          priority: "HIGH",
          title: `Order #${existing.orderNumber} Out for Delivery`,
          message: `Your food is ready and ${rider} is on the way to your delivery address.`,
          actionUrl: "/guest",
          dedupeKey: `order-dispatched-guest:${existing.id}`,
        });
      })();

      return NextResponse.json({ success: true, order: updatedOrder });
    }

    const order = await convertRestaurantOrderType({
      businessId: session.businessId,
      orderId,
      targetOrderType: parsed.orderType,
      deliveryInfo: parsed.deliveryInfo,
      notes: parsed.notes,
      actorId: session.userId,
    });

    return NextResponse.json({
      success: true,
      order,
    });
  } catch (error: any) {
    if (error instanceof RestaurantOrderError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Validation failed" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to update order") },
      { status: 500 }
    );
  }
}
