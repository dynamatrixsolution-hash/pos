import { db } from "@/lib/db";
import { Prisma } from "@dynapos/db";
import { enqueueOutboxEvent } from "@/lib/services/outbox-service";
import { deductRecipeIngredientsForTicketLine } from "@/lib/services/recipe-consumption-service";
import { createAuditEvent } from "@/lib/audit-event";

export class KitchenRoutingError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "KitchenRoutingError";
    this.statusCode = statusCode;
  }
}

export interface CreateStationInput {
  businessId: string;
  branchId: string;
  name: string;
  code: string;
  printerIp?: string;
  printerPort?: number;
  displayOrder?: number;
}

export interface CreateRouteRuleInput {
  businessId: string;
  stationId: string;
  menuItemId?: string;
  categoryId?: string;
  priority?: number;
}

export interface RouteRoundInput {
  businessId: string;
  roundId: string;
  actorId?: string;
}

export interface AdvanceTicketStatusInput {
  businessId: string;
  ticketId: string;
  newStatus: "QUEUED" | "PREPARING" | "READY" | "SERVED" | "CANCELLED";
  actorId?: string;
}

export interface AdvanceLineStatusInput {
  businessId: string;
  ticketLineId: string;
  newStatus: "QUEUED" | "PREPARING" | "READY" | "CANCELLED";
  actorId?: string;
  wasteReason?: string;
}

function generateTicketNumber(prefix = "KT"): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
  const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, "");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${dateStr}-${timeStr}-${rand}`;
}

/**
 * Create a new kitchen preparation station
 */
export async function createKitchenStation(input: CreateStationInput) {
  return await db.kitchenStation.create({
    data: {
      businessId: input.businessId,
      branchId: input.branchId,
      name: input.name,
      code: input.code.toUpperCase().trim(),
      printerIp: input.printerIp || null,
      printerPort: input.printerPort ?? 9100,
      displayOrder: input.displayOrder ?? 0,
    },
  });
}

/**
 * Get all active kitchen stations for a branch
 */
export async function getKitchenStations(businessId: string, branchId: string) {
  return await db.kitchenStation.findMany({
    where: { businessId, branchId, isActive: true },
    orderBy: { displayOrder: "asc" },
  });
}

/**
 * Configure item or category routing rule to a station
 */
export async function createStationRoute(input: CreateRouteRuleInput) {
  return await db.stationRoute.create({
    data: {
      businessId: input.businessId,
      stationId: input.stationId,
      menuItemId: input.menuItemId || null,
      categoryId: input.categoryId || null,
      priority: input.priority ?? 0,
    },
  });
}

/**
 * Route an OrderRound to target kitchen stations.
 * Invariants:
 * - Multi-station orders produce separate station tickets.
 * - Each order round routes exactly once per target station (idempotent).
 * - Enqueues OutboxEvent for print/KDS fanout.
 */
export async function routeOrderRoundToStations(
  input: RouteRoundInput,
  externalTx?: Prisma.TransactionClient
) {
  const runner = async (tx: Prisma.TransactionClient) => {
    // 1. Fetch OrderRound with Order and Lines
    const round = await tx.orderRound.findFirst({
      where: { id: input.roundId, businessId: input.businessId },
      include: {
        order: {
          include: { table: true },
        },
        lines: {
          include: { menuItem: true },
        },
      },
    });

    if (!round) {
      throw new KitchenRoutingError("Order round not found", 404);
    }

    if (round.lines.length === 0) {
      throw new KitchenRoutingError("Cannot route empty order round", 400);
    }

    const branchId = round.order.branchId;

    // 2. Fetch all stations and routing rules for this branch
    const stations = await tx.kitchenStation.findMany({
      where: { businessId: input.businessId, branchId, isActive: true },
      orderBy: { displayOrder: "asc" },
    });

    // If no stations exist, create default Main Kitchen station
    let defaultStation = stations[0];
    if (!defaultStation) {
      defaultStation = await tx.kitchenStation.create({
        data: {
          businessId: input.businessId,
          branchId,
          name: "Main Kitchen",
          code: "MAIN",
        },
      });
    }

    const routes = await tx.stationRoute.findMany({
      where: { businessId: input.businessId },
      orderBy: { priority: "desc" },
    });

    // 3. Partition order lines by target station
    const linesByStation: Record<string, typeof round.lines> = {};

    for (const line of round.lines) {
      let targetStationId = defaultStation.id;

      if (line.menuItemId) {
        // Direct item route
        const itemRoute = routes.find((r) => r.menuItemId === line.menuItemId);
        if (itemRoute) {
          targetStationId = itemRoute.stationId;
        }
      }

      if (!linesByStation[targetStationId]) {
        linesByStation[targetStationId] = [];
      }
      linesByStation[targetStationId].push(line);
    }

    const createdTickets = [];

    // 4. For each target station, create or update KitchenTicket idempotently
    for (const [stationId, lines] of Object.entries(linesByStation)) {
      // Invariant: @@unique([businessId, roundId, stationId])
      let ticket = await tx.kitchenTicket.findUnique({
        where: {
          businessId_roundId_stationId: {
            businessId: input.businessId,
            roundId: round.id,
            stationId,
          },
        },
      });

      if (!ticket) {
        const ticketNumber = generateTicketNumber("KT");
        ticket = await tx.kitchenTicket.create({
          data: {
            businessId: input.businessId,
            branchId,
            stationId,
            orderId: round.orderId,
            roundId: round.id,
            ticketNumber,
            status: "QUEUED",
            revisionNumber: 1,
            notes: round.notes || null,
          },
        });
      } else {
        // Increment revision if re-routing
        ticket = await tx.kitchenTicket.update({
          where: { id: ticket.id },
          data: { revisionNumber: { increment: 1 } },
        });
      }

      // Create ticket lines
      for (const line of lines) {
        const existingLine = await tx.kitchenTicketLine.findUnique({
          where: {
            businessId_ticketId_orderLineId: {
              businessId: input.businessId,
              ticketId: ticket.id,
              orderLineId: line.id,
            },
          },
        });

        if (!existingLine) {
          // Detect dietary keywords in notes
          const dietaryAlerts: string[] = [];
          const text = `${line.itemName} ${line.notes || ""}`.toUpperCase();
          if (text.includes("GLUTEN") || text.includes("CELIAC")) dietaryAlerts.push("GLUTEN_FREE");
          if (text.includes("NUT") || text.includes("PEANUT")) dietaryAlerts.push("NO_NUTS");
          if (text.includes("VEGAN")) dietaryAlerts.push("VEGAN");
          if (text.includes("VEGETARIAN") || text.includes("VEG")) dietaryAlerts.push("VEGETARIAN");
          if (text.includes("SPICY") || text.includes("CHILLI")) dietaryAlerts.push("SPICY");

          await tx.kitchenTicketLine.create({
            data: {
              businessId: input.businessId,
              ticketId: ticket.id,
              orderLineId: line.id,
              itemName: line.itemName,
              quantity: line.quantity,
              modifiersSnapshot: line.appliedModifiers as any,
              dietaryAlerts: dietaryAlerts.length > 0 ? dietaryAlerts : Prisma.DbNull,
              notes: line.notes || null,
              status: "QUEUED",
            },
          });
        }
      }

      // Enqueue Outbox event for printer service
      await enqueueOutboxEvent(
        tx,
        {
          businessId: input.businessId,
          aggregateType: "KitchenTicket",
          aggregateId: ticket.id,
          eventType: "kitchen.ticket.created",
          payload: {
            ticketId: ticket.id,
            ticketNumber: ticket.ticketNumber,
            stationId,
            roundNumber: round.roundNumber,
            tableNumber: round.order.table?.tableNumber || "Takeaway",
            linesCount: lines.length,
          },
        }
      );

      const fullTicket = await tx.kitchenTicket.findUnique({
        where: { id: ticket.id },
        include: {
          station: true,
          lines: true,
        },
      });

      createdTickets.push(fullTicket);
    }

    // 5. Update round status
    await tx.orderRound.update({
      where: { id: round.id },
      data: { status: "PREPARING" },
    });

    // 6. Audit event
    await createAuditEvent(
      {
        businessId: input.businessId,
        branchId,
        userId: input.actorId,
        action: "ORDER_ROUND_ROUTED_TO_KITCHEN",
        entity: "OrderRound",
        entityId: round.id,
        metadata: {
          orderNumber: round.order.orderNumber,
          roundNumber: round.roundNumber,
          ticketsCreated: createdTickets.length,
        },
      },
      tx
    );

    return createdTickets;
  };

  if (externalTx) return await runner(externalTx);
  return await db.$transaction(runner, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  });
}

/**
 * Advance status of a KitchenTicket (e.g. QUEUED -> PREPARING -> READY -> SERVED).
 * Invariants:
 * - If newStatus is READY, triggers automatic recipe ingredient deduction!
 * - Settlement status is strictly untouched.
 */
export async function advanceTicketStatus(
  input: AdvanceTicketStatusInput,
  externalTx?: Prisma.TransactionClient
) {
  const runner = async (tx: Prisma.TransactionClient) => {
    const ticket = await tx.kitchenTicket.findFirst({
      where: { id: input.ticketId, businessId: input.businessId },
      include: {
        lines: true,
        order: true,
      },
    });

    if (!ticket) {
      throw new KitchenRoutingError("Kitchen ticket not found", 404);
    }

    // Update ticket status
    const updatedTicket = await tx.kitchenTicket.update({
      where: { id: ticket.id },
      data: { status: input.newStatus },
    });

    // Update all lines
    for (const line of ticket.lines) {
      await tx.kitchenTicketLine.update({
        where: { id: line.id },
        data: { status: input.newStatus === "SERVED" ? "READY" : input.newStatus },
      });

      // Update corresponding OrderLine fulfillment status
      await tx.orderLine.update({
        where: { id: line.orderLineId },
        data: { fulfillmentStatus: input.newStatus },
      });

      // Invariant: Trigger recipe ingredient consumption when marked READY
      if (input.newStatus === "READY") {
        await deductRecipeIngredientsForTicketLine(
          {
            businessId: input.businessId,
            branchId: ticket.branchId,
            ticketLineId: line.id,
            actorId: input.actorId,
          },
          tx
        );
      }
    }

    // Audit event
    await createAuditEvent(
      {
        businessId: input.businessId,
        branchId: ticket.branchId,
        userId: input.actorId,
        action: "KITCHEN_TICKET_STATUS_ADVANCED",
        entity: "KitchenTicket",
        entityId: ticket.id,
        oldValue: { status: ticket.status },
        newValue: { status: input.newStatus },
      },
      tx
    );

    return updatedTicket;
  };

  if (externalTx) return await runner(externalTx);
  return await db.$transaction(runner, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  });
}

/**
 * Advance status of an individual KitchenTicketLine.
 * If cancelled after starting prep, marks as waste and records consumption.
 */
export async function advanceTicketLineStatus(
  input: AdvanceLineStatusInput,
  externalTx?: Prisma.TransactionClient
) {
  const runner = async (tx: Prisma.TransactionClient) => {
    const line = await tx.kitchenTicketLine.findFirst({
      where: { id: input.ticketLineId, businessId: input.businessId },
      include: { ticket: true },
    });

    if (!line) {
      throw new KitchenRoutingError("Ticket line not found", 404);
    }

    const wasPreparing = line.status === "PREPARING" || line.status === "READY";
    const isCancellation = input.newStatus === "CANCELLED";
    const isWaste = wasPreparing && isCancellation;

    const updatedLine = await tx.kitchenTicketLine.update({
      where: { id: line.id },
      data: {
        status: input.newStatus,
        isWaste,
        wasteReason: isWaste ? input.wasteReason || "Cancelled after preparation commenced" : null,
      },
    });

    // Update order line fulfillment
    await tx.orderLine.update({
      where: { id: line.orderLineId },
      data: { fulfillmentStatus: input.newStatus },
    });

    // Trigger ingredient deduction on READY or on Waste
    if (input.newStatus === "READY" || isWaste) {
      await deductRecipeIngredientsForTicketLine(
        {
          businessId: input.businessId,
          branchId: line.ticket.branchId,
          ticketLineId: line.id,
          actorId: input.actorId,
          isWaste,
          wasteReason: isWaste ? input.wasteReason || "Cancelled during prep" : undefined,
        },
        tx
      );
    }

    return updatedLine;
  };

  if (externalTx) return await runner(externalTx);
  return await db.$transaction(runner, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  });
}

/**
 * Fetch live KDS tickets for a station or branch
 */
export async function getLiveKDSTickets(
  businessId: string,
  branchId: string,
  stationId?: string
) {
  return await db.kitchenTicket.findMany({
    where: {
      businessId,
      branchId,
      status: { in: ["QUEUED", "PREPARING", "READY"] },
      ...(stationId ? { stationId } : {}),
    },
    include: {
      station: true,
      order: {
        include: { table: true },
      },
      round: true,
      lines: {
        include: { orderLine: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}
