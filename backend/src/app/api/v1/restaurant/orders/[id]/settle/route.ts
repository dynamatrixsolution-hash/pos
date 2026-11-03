import { NextResponse } from "next/server";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";
import { db } from "@/lib/db";
import { Prisma } from "@dynapos/db";
import { createAuditEvent } from "@/lib/audit-event";
import { toDecimal } from "@/lib/services/decimal-math";
import { deductRecipeIngredientsForTicketLine } from "@/lib/services/recipe-consumption-service";
import { z } from "zod";

const settleOrderSchema = z.object({
  paymentMethod: z.enum([
    "CASH",
    "CARD",
    "FONE_PAY",
    "ESEWA",
    "KHALTI",
    "NEPAL_PAY",
    "CREDIT",
    "ROOM_CHARGE",
  ]).default("CASH"),
  paidAmount: z.coerce.number().min(0).optional(),
  discountTotal: z.coerce.number().min(0).optional().default(0),
  paymentReference: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  clearTable: z.boolean().default(true),
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
    const parsed = settleOrderSchema.parse(body);

    const order = await db.restaurantOrder.findFirst({
      where: { id: orderId, businessId: session.businessId },
      include: {
        table: true,
        tableSession: true,
        rounds: {
          include: { lines: true },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const effectivePaid =
      parsed.paidAmount !== undefined
        ? new Prisma.Decimal(parsed.paidAmount.toString())
        : order.totalAmount;

    const result = await db.$transaction(async (tx) => {
      // 1. Settle Order
      const updatedOrder = await tx.restaurantOrder.update({
        where: { id: order.id },
        data: {
          settlementStatus: "PAID",
          paidAmount: effectivePaid,
          acceptanceStatus: "ACCEPTED",
          fulfillmentStatus: order.fulfillmentStatus === "CANCELLED" ? "CANCELLED" : "SERVED",
          discountTotal: new Prisma.Decimal(parsed.discountTotal.toString()),
          version: { increment: 1 },
          notes: parsed.notes || order.notes,
        },
      });

      // 2. Mark all order lines as PAID & SERVED (unless voided/cancelled)
      await tx.orderLine.updateMany({
        where: {
          orderId: order.id,
          businessId: session.businessId,
          fulfillmentStatus: { not: "CANCELLED" },
        },
        data: {
          settlementStatus: "PAID",
          fulfillmentStatus: "SERVED",
          version: { increment: 1 },
        },
      });

      // 2b. Deduct recipe ingredients for any tickets/lines that haven't been deducted yet
      const orderTickets = await tx.kitchenTicket.findMany({
        where: { orderId: order.id, businessId: session.businessId },
        include: { lines: true },
      });
      for (const t of orderTickets) {
        for (const l of t.lines) {
          if (l.status !== "CANCELLED") {
            try {
              await deductRecipeIngredientsForTicketLine(
                {
                  businessId: session.businessId,
                  branchId: order.branchId,
                  ticketLineId: l.id,
                  actorId: session.userId,
                },
                tx
              );
            } catch (deductErr) {
              console.warn("Settle deduction warning:", deductErr);
            }
          }
        }
      }

      // 3. If clearTable requested: close session & release table
      let tableUpdated = null;
      if (parsed.clearTable) {
        if (order.tableSessionId) {
          await tx.tableSession.update({
            where: { id: order.tableSessionId },
            data: {
              status: "COMPLETED",
              closedAt: new Date(),
              closedById: session.userId,
              version: { increment: 1 },
            },
          });

          await tx.guestAccessGrant.updateMany({
            where: { tableSessionId: order.tableSessionId, businessId: session.businessId },
            data: { status: "REVOKED", revokedAt: new Date(), revokedReason: "SETTLED" },
          });

          await tx.guestSession.updateMany({
            where: { tableSessionId: order.tableSessionId, businessId: session.businessId },
            data: { status: "REVOKED", revokedAt: new Date() },
          });
        }

        const tableIdToRelease = order.tableId || order.tableSession?.tableId;
        if (tableIdToRelease) {
          tableUpdated = await tx.restaurantTable.update({
            where: { id: tableIdToRelease },
            data: {
              status: "AVAILABLE",
              currentSessionId: null,
            },
          });
        }
      }

      // 4. Record Audit Event
      await createAuditEvent(
        {
          businessId: session.businessId,
          branchId: order.branchId,
          userId: session.userId,
          action: "RESTAURANT_ORDER_SETTLED",
          entity: "RestaurantOrder",
          entityId: order.id,
          newValue: {
            orderNumber: order.orderNumber,
            totalAmount: order.totalAmount.toString(),
            paidAmount: effectivePaid.toString(),
            paymentMethod: parsed.paymentMethod,
            paymentReference: parsed.paymentReference,
            tableCleared: parsed.clearTable,
            tableId: order.tableId,
          },
        },
        tx
      );

      return { order: updatedOrder, table: tableUpdated };
    });

    return NextResponse.json({
      success: true,
      message: parsed.clearTable
        ? `Order #${order.orderNumber} settled successfully and table cleared for new guests.`
        : `Order #${order.orderNumber} settled successfully.`,
      ...result,
    });
  } catch (error: any) {
    console.error("Order settlement error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Validation failed" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: error.message || "Failed to settle order" },
      { status: 500 }
    );
  }
}

