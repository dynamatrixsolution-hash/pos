import { db } from "@/lib/db";
import { Prisma } from "@dynapos/db";
import { money, addMoney, subMoney, mulMoney, divMoney, toDecimal } from "@/lib/services/decimal-math";
import { createAuditEvent } from "@/lib/audit-event";

export class RestaurantOrderError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "RestaurantOrderError";
    this.statusCode = statusCode;
  }
}

export interface AppliedModifierInput {
  modifierGroupId: string;
  groupName: string;
  optionId: string;
  optionName: string;
  priceDelta: number | string | Prisma.Decimal;
}

export interface OrderItemInput {
  menuItemId?: string;
  itemName: string;
  basePrice: number | string | Prisma.Decimal;
  quantity: number;
  appliedModifiers?: AppliedModifierInput[];
  notes?: string;
}

export interface CreateOrAppendOrderInput {
  businessId: string;
  branchId: string;
  orderId?: string | null;
  tableSessionId?: string | null;
  tableId?: string | null;
  orderType?: string; // DINE_IN, TAKEAWAY, BAR_WALK_IN, DELIVERY
  items: OrderItemInput[];
  notes?: string;
  actorId?: string;
}

export interface UpdateLineStatusInput {
  businessId: string;
  orderId?: string;
  lineId: string;
  quantity?: number;
  acceptanceStatus?: "PENDING" | "ACCEPTED" | "REJECTED";
  fulfillmentStatus?: "QUEUED" | "PREPARING" | "READY" | "SERVED" | "CANCELLED";
  settlementStatus?: "UNPAID" | "PARTIAL" | "PAID" | "REFUNDED";
  rejectionReason?: string;
  voidReason?: string;
  notes?: string;
  actorId?: string;
  expectedVersion?: number;
}

export interface ConvertOrderTypeInput {
  businessId: string;
  orderId: string;
  targetOrderType: "TAKEAWAY" | "DELIVERY";
  deliveryInfo?: {
    customerName?: string;
    phone?: string;
    address?: string;
    riderName?: string;
    deliveryFee?: number | string;
    notes?: string;
  };
  notes?: string;
  actorId?: string;
}

export interface CancelOrderInput {
  businessId: string;
  orderId: string;
  reason?: string;
  actorId?: string;
}

export interface SettlementTotalsResult {
  subtotal: number;
  discountTotal: number;
  afterDiscount: number;
  taxTotal: number;
  extraFees: number;
  totalAmount: number;
}

/**
 * Pure server-authoritative settlement calculation across active pre-tax order lines.
 * Prevents double-VAT and clamps discounts and extra fees safely via Decimal arithmetic.
 */
export function computeSettlementTotals(params: {
  lines: Array<{ unitPrice: number | string | Prisma.Decimal; quantity: number }>;
  discountType?: "FLAT" | "PERCENT";
  discountValue?: number;
  discountTotal?: number;
  applyVat?: boolean;
  vatRatePercent?: number;
  deliveryFee?: number;
  packagingFee?: number;
  expressFee?: number;
}): SettlementTotalsResult {
  let subtotalDec = new Prisma.Decimal(0);
  for (const line of params.lines) {
    const qty = Math.max(0, Math.floor(Number(line.quantity) || 0));
    if (qty === 0) continue;
    subtotalDec = addMoney(subtotalDec, mulMoney(money(line.unitPrice || 0), qty));
  }

  let discountDec = new Prisma.Decimal(0);
  if (params.discountType === "PERCENT" && params.discountValue !== undefined) {
    const clampedPct = Math.min(100, Math.max(0, Number(params.discountValue) || 0));
    discountDec = divMoney(mulMoney(subtotalDec, clampedPct), 100);
  } else {
    const rawDiscount = Math.max(
      0,
      Number(params.discountTotal ?? params.discountValue ?? 0) || 0
    );
    discountDec = money(rawDiscount);
  }
  if (discountDec.greaterThan(subtotalDec)) {
    discountDec = subtotalDec;
  }

  const afterDiscountDec = subMoney(subtotalDec, discountDec);
  const vatRate = Math.max(0, Number(params.vatRatePercent ?? 13) || 0);
  const taxDec =
    params.applyVat !== false && vatRate > 0 && !afterDiscountDec.isZero()
      ? divMoney(mulMoney(afterDiscountDec, vatRate), 100)
      : new Prisma.Decimal(0);

  const feeSum =
    Math.max(0, Number(params.deliveryFee) || 0) +
    Math.max(0, Number(params.packagingFee) || 0) +
    Math.max(0, Number(params.expressFee) || 0);
  const extraFeesDec = money(feeSum);

  const totalDec = addMoney(addMoney(afterDiscountDec, taxDec), extraFeesDec);

  return {
    subtotal: Number(subtotalDec.toFixed(2)),
    discountTotal: Number(discountDec.toFixed(2)),
    afterDiscount: Number(afterDiscountDec.toFixed(2)),
    taxTotal: Number(taxDec.toFixed(2)),
    extraFees: Number(extraFeesDec.toFixed(2)),
    totalAmount: Number(totalDec.toFixed(2)),
  };
}

function generateOrderNumber(): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
  const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, "");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `RO-${dateStr}-${timeStr}-${rand}`;
}

function replaceServingTag(
  notes: string | null | undefined,
  targetTag: "[DINE-IN]" | "[TAKEAWAY]" | "[DELIVERY]"
): string {
  const cleaned = (notes || "")
    .replace(/\[(DINE-IN|TAKEAWAY|DELIVERY|PARCEL)\]/gi, "")
    .trim();
  return cleaned ? `${targetTag} ${cleaned}` : targetTag;
}

async function releaseTableIfIdle(
  tx: Prisma.TransactionClient,
  businessId: string,
  tableId: string | null | undefined,
  tableSessionId: string | null | undefined,
  excludeOrderId: string
) {
  if (!tableId) return;
  const otherActiveOrders = await tx.restaurantOrder.count({
    where: {
      tableId,
      businessId,
      id: { not: excludeOrderId },
      settlementStatus: { not: "PAID" },
      fulfillmentStatus: { not: "CANCELLED" },
    },
  });
  if (otherActiveOrders > 0) return;

  if (tableSessionId) {
    await tx.tableSession.update({
      where: { id: tableSessionId },
      data: { status: "CLOSED", closedAt: new Date() },
    });
  }
  await tx.restaurantTable.update({
    where: { id: tableId },
    data: { status: "AVAILABLE", currentSessionId: null },
  });
}

/**
 * Creates a new Restaurant Order or appends a new OrderRound to an existing active table order.
 * Strictly preserves all earlier rounds and order lines.
 */
export async function createOrAppendOrder(
  input: CreateOrAppendOrderInput,
  externalTx?: Prisma.TransactionClient
) {
  if (!input.items || input.items.length === 0) {
    throw new RestaurantOrderError("At least one item is required to place an order", 400);
  }

  const runner = async (tx: Prisma.TransactionClient) => {
    let order: any = null;
    let nextRoundNumber = 1;

    // 1. If orderId is provided (e.g. appending a round to an existing order), look it up directly
    if (input.orderId) {
      order = await tx.restaurantOrder.findFirst({
        where: { id: input.orderId, businessId: input.businessId },
        include: {
          rounds: { orderBy: { roundNumber: "desc" } },
        },
      });

      if (!order) {
        throw new RestaurantOrderError("Order not found", 404);
      }

      if (order.settlementStatus === "PAID") {
        throw new RestaurantOrderError("Cannot add rounds to a fully settled and paid order", 400);
      }

      if (order.rounds.length > 0) {
        nextRoundNumber = order.rounds[0].roundNumber + 1;
      }
    } else if (input.tableSessionId) {
      // 1b. If tableSessionId is provided, check session state and find existing open order
      const session = await tx.tableSession.findFirst({
        where: { id: input.tableSessionId, businessId: input.businessId },
      });

      if (!session) {
        throw new RestaurantOrderError("Table session not found", 404);
      }

      if (session.status !== "ACTIVE" && session.status !== "BILLED") {
        throw new RestaurantOrderError(`Cannot add order to session with status: ${session.status}`, 400);
      }

      // Check if session already has an active, non-cancelled order
      order = await tx.restaurantOrder.findFirst({
        where: {
          tableSessionId: input.tableSessionId,
          businessId: input.businessId,
          settlementStatus: { not: "PAID" },
          fulfillmentStatus: { not: "CANCELLED" },
        },
        include: {
          rounds: { orderBy: { roundNumber: "desc" } },
        },
      });

      if (order && order.rounds.length > 0) {
        nextRoundNumber = order.rounds[0].roundNumber + 1;
      }
    }

    // 2. If no existing order, create a new RestaurantOrder
    if (!order) {
      const orderNumber = generateOrderNumber();
      order = await tx.restaurantOrder.create({
        data: {
          businessId: input.businessId,
          branchId: input.branchId,
          tableSessionId: input.tableSessionId || null,
          tableId: input.tableId || null,
          orderNumber,
          orderType: input.orderType || "DINE_IN",
          acceptanceStatus: "PENDING",
          fulfillmentStatus: "QUEUED",
          settlementStatus: "UNPAID",
          subtotal: new Prisma.Decimal(0),
          taxTotal: new Prisma.Decimal(0),
          totalAmount: new Prisma.Decimal(0),
          paidAmount: new Prisma.Decimal(0),
          createdById: input.actorId || null,
          notes: input.notes || null,
          version: 1,
        },
      });
      nextRoundNumber = 1;
    }

    // 2.5 Automated Inventory Lockout: Verify raw ingredient stock for every item with an active recipe
    for (const item of input.items) {
      if (!item.menuItemId) continue;
      const recipe = await tx.recipeVersion.findFirst({
        where: {
          businessId: input.businessId,
          menuItemId: item.menuItemId,
          isActive: true,
        },
        include: {
          ingredients: {
            include: { product: true },
          },
        },
      });

      if (recipe && recipe.ingredients.length > 0) {
        const orderQty = new Prisma.Decimal(Math.max(1, Math.floor(item.quantity)));
        for (const ing of recipe.ingredients) {
          const needed = ing.quantity
            .mul(orderQty)
            .div(recipe.yieldQuantity)
            .mul(new Prisma.Decimal(1).add(ing.wastagePercent.div(100)));

          const stock = await tx.productStock.findFirst({
            where: {
              productId: ing.productId,
              branchId: input.branchId,
            },
          });

          const available = stock ? new Prisma.Decimal(stock.quantity.toString()) : new Prisma.Decimal(0);
          if (available.lessThan(needed)) {
            const prodName = ing.product?.name || "Raw ingredient";
            throw new RestaurantOrderError(
              `Cannot place order: '${prodName}' is out of stock (required: ${needed.toFixed(2)} ${ing.unit}, available: ${available.toFixed(2)} ${ing.unit}) for item '${item.itemName}'.`,
              409
            );
          }
        }
      }
    }

    // 3. Create the new OrderRound
    const orderRound = await tx.orderRound.create({
      data: {
        businessId: input.businessId,
        orderId: order.id,
        roundNumber: nextRoundNumber,
        status: "SUBMITTED",
        submittedAt: new Date(),
        submittedById: input.actorId || null,
        notes: input.notes || null,
      },
    });

    // 4. Create OrderLines for this round with immutable financial snapshots
    let roundSubtotal = new Prisma.Decimal(0);
    let roundTaxTotal = new Prisma.Decimal(0);
    const createdLines = [];

    for (const item of input.items) {
      try {
        const basePriceDec = money(item.basePrice);
        const qty = Math.max(1, Math.floor(item.quantity));

        // Calculate modifiers delta
        let modifiersDeltaTotal = new Prisma.Decimal(0);
        const sanitizedModifiers = (item.appliedModifiers || []).map((m) => {
          const delta = money(m.priceDelta);
          modifiersDeltaTotal = addMoney(modifiersDeltaTotal, delta);
          return {
            modifierGroupId: m.modifierGroupId,
            groupName: m.groupName,
            optionId: m.optionId,
            optionName: m.optionName,
            priceDelta: delta.toString(),
          };
        });

        const unitPrice = addMoney(basePriceDec, modifiersDeltaTotal);
        const lineSubtotal = mulMoney(unitPrice, qty);

        // Tax lookup if menuItemId present
        let taxRate = new Prisma.Decimal(0);
        if (item.menuItemId) {
          const menuItem = await tx.menuItem.findFirst({
            where: { id: item.menuItemId, businessId: input.businessId },
          });
          if (menuItem?.taxRate) {
            taxRate = toDecimal(menuItem.taxRate);
          }
        }

        const lineTax = taxRate.isZero()
          ? new Prisma.Decimal(0)
          : money(divMoney(mulMoney(lineSubtotal, taxRate), 100));
        const lineTotal = addMoney(lineSubtotal, lineTax);

        roundSubtotal = addMoney(roundSubtotal, lineSubtotal);
        roundTaxTotal = addMoney(roundTaxTotal, lineTax);

        const line = await tx.orderLine.create({
          data: {
            businessId: input.businessId,
            orderId: order.id,
            roundId: orderRound.id,
            menuItemId: item.menuItemId || null,
            itemName: item.itemName,
            basePrice: basePriceDec,
            quantity: qty,
            appliedModifiers: sanitizedModifiers,
            unitPrice,
            taxRate,
            taxAmount: lineTax,
            subtotal: lineSubtotal,
            total: lineTotal,
            notes: item.notes || null,
            acceptanceStatus: "PENDING",
            fulfillmentStatus: "QUEUED",
            settlementStatus: "UNPAID",
            version: 1,
          },
        });

        createdLines.push(line);
      } catch (lineErr) {
        console.error("Failed to process item or create OrderLine:", lineErr);
        throw lineErr;
      }
    }

    // 5. Update Order totals & OCC version
    const updatedOrder = await tx.restaurantOrder.update({
      where: { id: order.id },
      data: {
        subtotal: addMoney(order.subtotal, roundSubtotal),
        taxTotal: addMoney(order.taxTotal, roundTaxTotal),
        totalAmount: addMoney(order.totalAmount, addMoney(roundSubtotal, roundTaxTotal)),
        version: { increment: 1 },
      },
      include: {
        rounds: {
          include: { lines: true },
          orderBy: { roundNumber: "asc" },
        },
      },
    });

    // 6. Audit Event
    await createAuditEvent(
      {
        businessId: input.businessId,
        branchId: input.branchId,
        userId: input.actorId,
        action: nextRoundNumber === 1 ? "RESTAURANT_ORDER_CREATED" : "RESTAURANT_ROUND_SUBMITTED",
        entity: "RestaurantOrder",
        entityId: order.id,
        newValue: {
          orderNumber: order.orderNumber,
          roundNumber: nextRoundNumber,
          itemsCount: input.items.length,
          roundTotal: addMoney(roundSubtotal, roundTaxTotal).toString(),
          orderTotal: updatedOrder.totalAmount.toString(),
        },
      },
      tx
    );

    return {
      order: updatedOrder,
      round: orderRound,
      lines: createdLines,
    };
  };

  if (externalTx) {
    return await runner(externalTx);
  }
  return await db.$transaction(runner, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  });
}

/**
 * Update independent 3D status of an OrderLine.
 * Strict invariants:
 * - Rejection requires mandatory reason.
 * - Changing settlementStatus does NOT alter fulfillmentStatus.
 * - OCC check fails closed if expectedVersion provided and mismatch.
 */
export async function updateLineStatus(
  input: UpdateLineStatusInput,
  externalTx?: Prisma.TransactionClient
) {
  const runner = async (tx: Prisma.TransactionClient) => {
    const line = await tx.orderLine.findFirst({
      where: {
        id: input.lineId,
        businessId: input.businessId,
        ...(input.orderId ? { orderId: input.orderId } : {}),
      },
      include: { order: true },
    });

    if (!line) {
      throw new RestaurantOrderError("Order line not found", 404);
    }

    if (line.order.settlementStatus === "PAID" || line.settlementStatus === "PAID") {
      throw new RestaurantOrderError("Cannot modify items on a paid order", 400);
    }

    if (input.expectedVersion !== undefined && line.version !== input.expectedVersion) {
      throw new RestaurantOrderError(
        `Optimistic lock failure: line was modified concurrently (current version: ${line.version}, expected: ${input.expectedVersion})`,
        409
      );
    }

    // Invariant: Rejection strictly requires non-empty reason
    if (input.acceptanceStatus === "REJECTED" && (!input.rejectionReason || !input.rejectionReason.trim())) {
      throw new RestaurantOrderError("A mandatory rejection reason is required to reject or void an order item", 400);
    }

    const dataToUpdate: any = {
      version: { increment: 1 },
    };

    // If quantity update is requested
    if (input.quantity !== undefined) {
      const newQty = Math.max(0, input.quantity);
      if (newQty === 0) {
        dataToUpdate.acceptanceStatus = "REJECTED";
        dataToUpdate.fulfillmentStatus = "CANCELLED";
        dataToUpdate.rejectionReason = input.rejectionReason || input.voidReason || "Quantity reduced to 0 (Item cancelled)";
        dataToUpdate.voidReason = input.voidReason || input.rejectionReason || "Quantity reduced to 0 (Item cancelled)";
      } else {
        const unitPrice = line.unitPrice;
        const lineSubtotal = mulMoney(unitPrice, newQty);
        const lineTax = line.taxRate.isZero()
          ? new Prisma.Decimal(0)
          : money(divMoney(mulMoney(lineSubtotal, line.taxRate), 100));
        const lineTotal = addMoney(lineSubtotal, lineTax);
        dataToUpdate.quantity = newQty;
        dataToUpdate.subtotal = lineSubtotal;
        dataToUpdate.taxAmount = lineTax;
        dataToUpdate.total = lineTotal;

        // Also update ticket lines
        await tx.kitchenTicketLine.updateMany({
          where: { orderLineId: line.id },
          data: { quantity: newQty },
        });
      }
    }

    if (input.acceptanceStatus) {
      dataToUpdate.acceptanceStatus = input.acceptanceStatus;
      if (input.rejectionReason) {
        dataToUpdate.rejectionReason = input.rejectionReason;
      }
      if (input.acceptanceStatus === "REJECTED") {
        dataToUpdate.fulfillmentStatus = "CANCELLED";
      }
    }

    if (input.fulfillmentStatus) {
      dataToUpdate.fulfillmentStatus = input.fulfillmentStatus;
    }

    if (input.settlementStatus) {
      dataToUpdate.settlementStatus = input.settlementStatus;
      // Invariant: settlement changes NEVER modify fulfillmentStatus
    }

    if (input.voidReason) {
      dataToUpdate.voidReason = input.voidReason;
    }

    if (input.notes !== undefined) {
      const normalizedNotes = input.notes.trim() || null;
      dataToUpdate.notes = normalizedNotes;
      await tx.kitchenTicketLine.updateMany({
        where: { orderLineId: line.id, status: { not: "CANCELLED" } },
        data: { notes: normalizedNotes },
      });
    }

    const updatedLine = await tx.orderLine.update({
      where: { id: line.id },
      data: dataToUpdate,
    });

    // If line is now CANCELLED or REJECTED, cancel any corresponding KitchenTicketLine
    if (
      updatedLine.acceptanceStatus === "REJECTED" ||
      updatedLine.fulfillmentStatus === "CANCELLED"
    ) {
      await tx.kitchenTicketLine.updateMany({
        where: { orderLineId: line.id },
        data: { status: "CANCELLED" },
      });

      const affectedTickets = await tx.kitchenTicketLine.findMany({
        where: { orderLineId: line.id },
        select: { ticketId: true },
      });

      for (const tRef of affectedTickets) {
        const remainingActive = await tx.kitchenTicketLine.count({
          where: { ticketId: tRef.ticketId, status: { not: "CANCELLED" } },
        });
        if (remainingActive === 0) {
          await tx.kitchenTicket.update({
            where: { id: tRef.ticketId },
            data: { status: "CANCELLED" },
          });
        }
      }
    }

    // Recalculate Order totals (excluding cancelled and rejected items)
    const activeLines = await tx.orderLine.findMany({
      where: {
        orderId: line.orderId,
        acceptanceStatus: { not: "REJECTED" },
        fulfillmentStatus: { not: "CANCELLED" },
      },
    });

    const newSubtotal = activeLines.reduce(
      (acc, l) => addMoney(acc, l.subtotal),
      new Prisma.Decimal(0)
    );
    const newTaxTotal = activeLines.reduce(
      (acc, l) => addMoney(acc, l.taxAmount),
      new Prisma.Decimal(0)
    );
    const newTotal = activeLines.reduce(
      (acc, l) => addMoney(acc, l.total),
      new Prisma.Decimal(0)
    );

    const isEntireOrderCancelled = activeLines.length === 0;

    await tx.restaurantOrder.update({
      where: { id: line.orderId },
      data: {
        subtotal: newSubtotal,
        taxTotal: newTaxTotal,
        totalAmount: newTotal,
        ...(isEntireOrderCancelled
          ? { fulfillmentStatus: "CANCELLED", acceptanceStatus: "REJECTED" }
          : {}),
        version: { increment: 1 },
      },
    });

    // Audit Event
    await createAuditEvent(
      {
        businessId: input.businessId,
        branchId: line.order.branchId,
        userId: input.actorId,
        action: "ORDER_LINE_STATUS_UPDATED",
        entity: "OrderLine",
        entityId: line.id,
        reason: input.rejectionReason || input.voidReason,
        oldValue: {
          quantity: line.quantity,
          acceptanceStatus: line.acceptanceStatus,
          fulfillmentStatus: line.fulfillmentStatus,
          settlementStatus: line.settlementStatus,
          ...(input.notes !== undefined ? { notes: line.notes } : {}),
          version: line.version,
        },
        newValue: {
          quantity: updatedLine.quantity,
          acceptanceStatus: updatedLine.acceptanceStatus,
          fulfillmentStatus: updatedLine.fulfillmentStatus,
          settlementStatus: updatedLine.settlementStatus,
          ...(input.notes !== undefined ? { notes: updatedLine.notes } : {}),
          version: updatedLine.version,
        },
      },
      tx
    );

    return updatedLine;
  };

  if (externalTx) {
    return await runner(externalTx);
  }
  return await db.$transaction(runner, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  });
}

/**
 * Cancels an entire Restaurant Order (e.g. table walked out, order entered by mistake).
 * Voids all active lines, cancels kitchen tickets, recalculates order status,
 * and releases the table session if no other active orders remain.
 */
export async function cancelRestaurantOrder(input: CancelOrderInput) {
  return await db.$transaction(async (tx) => {
    const order = await tx.restaurantOrder.findFirst({
      where: { id: input.orderId, businessId: input.businessId },
      include: { rounds: true, orderLines: true },
    });

    if (!order) {
      throw new RestaurantOrderError("Order not found", 404);
    }

    if (order.settlementStatus === "PAID") {
      throw new RestaurantOrderError("Cannot cancel an order that has already been paid and settled", 400);
    }

    const cancelReason = input.reason?.trim() || "Order cancelled by staff";

    // 1. Mark all order lines as CANCELLED & REJECTED
    await tx.orderLine.updateMany({
      where: { orderId: order.id },
      data: {
        acceptanceStatus: "REJECTED",
        fulfillmentStatus: "CANCELLED",
        rejectionReason: cancelReason,
        voidReason: cancelReason,
      },
    });

    // 2. Mark all rounds as CANCELLED
    await tx.orderRound.updateMany({
      where: { orderId: order.id },
      data: { status: "CANCELLED" },
    });

    // 3. Mark all KitchenTickets & KitchenTicketLines as CANCELLED
    await tx.kitchenTicket.updateMany({
      where: { orderId: order.id },
      data: { status: "CANCELLED" },
    });
    await tx.kitchenTicketLine.updateMany({
      where: { ticket: { orderId: order.id } },
      data: { status: "CANCELLED" },
    });

    // 4. Update order itself to CANCELLED with 0 running balance
    const updatedOrder = await tx.restaurantOrder.update({
      where: { id: order.id },
      data: {
        acceptanceStatus: "REJECTED",
        fulfillmentStatus: "CANCELLED",
        subtotal: new Prisma.Decimal(0),
        taxTotal: new Prisma.Decimal(0),
        totalAmount: new Prisma.Decimal(0),
        notes: order.notes ? `${order.notes} [CANCELLED: ${cancelReason}]` : `[CANCELLED: ${cancelReason}]`,
        version: { increment: 1 },
      },
    });

    // 5. If this was a dine-in table order, release table session if no other active orders exist
    await releaseTableIfIdle(tx, input.businessId, order.tableId, order.tableSessionId, order.id);

    // 6. Audit Event
    await createAuditEvent(
      {
        businessId: input.businessId,
        branchId: order.branchId,
        userId: input.actorId,
        action: "RESTAURANT_ORDER_CANCELLED",
        entity: "RestaurantOrder",
        entityId: order.id,
        reason: cancelReason,
        oldValue: {
          fulfillmentStatus: order.fulfillmentStatus,
          settlementStatus: order.settlementStatus,
          totalAmount: order.totalAmount.toString(),
        },
        newValue: {
          fulfillmentStatus: "CANCELLED",
          settlementStatus: order.settlementStatus,
          totalAmount: "0.00",
        },
      },
      tx
    );

    return updatedOrder;
  });
}

/**
 * Converts an active order (e.g. mid-meal Dine-In) to TAKEAWAY or DELIVERY.
 * Detaches and frees the table/session if idle and updates active KDS/order line tags.
 */
export async function convertRestaurantOrderType(
  input: ConvertOrderTypeInput,
  externalTx?: Prisma.TransactionClient
) {
  const runner = async (tx: Prisma.TransactionClient) => {
    const order = await tx.restaurantOrder.findFirst({
      where: { id: input.orderId, businessId: input.businessId },
      include: { table: true, orderLines: true },
    });

    if (!order) {
      throw new RestaurantOrderError("Order not found", 404);
    }
    if (order.settlementStatus === "PAID") {
      throw new RestaurantOrderError("Cannot convert a paid and settled order", 400);
    }
    if (order.fulfillmentStatus === "CANCELLED") {
      throw new RestaurantOrderError("Cannot convert a cancelled order", 400);
    }

    const oldOrderType = order.orderType;
    const oldTableId = order.tableId;
    const oldTableSessionId = order.tableSessionId;

    // Strip prior delivery/origin markers before rebuilding clean operational notes
    const strippedExistingNotes = (order.notes || "")
      .replace(/\[DELIVERY[^\]]*\]/gi, "")
      .replace(/\[From Table [^\]]*\]/gi, "")
      .trim();

    const headerParts: string[] = [];
    if (input.targetOrderType === "DELIVERY" && input.deliveryInfo) {
      const d = input.deliveryInfo;
      const cust = d.customerName?.trim() || "Customer";
      const phone = d.phone?.trim() || "N/A";
      const addr = d.address?.trim() || "No address";
      const rider = d.riderName?.trim() || "In-House Rider";
      const dNotes = d.notes?.trim();
      headerParts.push(
        `[DELIVERY to ${cust} (${phone}) - ${addr} via ${rider}${dNotes ? ` | ${dNotes}` : ""}]`
      );
    }
    if (order.table?.tableNumber) {
      headerParts.push(`[From Table ${order.table.tableNumber}]`);
    }

    const finalNotes =
      [...headerParts, input.notes?.trim(), strippedExistingNotes].filter(Boolean).join(" ") ||
      null;

    // Sync serving tag on active, unserved lines and kitchen ticket lines
    const targetTag = input.targetOrderType === "DELIVERY" ? "[DELIVERY]" : "[TAKEAWAY]";
    const activeLines = order.orderLines.filter(
      (l) =>
        l.acceptanceStatus !== "REJECTED" &&
        l.fulfillmentStatus !== "CANCELLED" &&
        l.fulfillmentStatus !== "SERVED"
    );

    for (const line of activeLines) {
      const nextLineNotes = replaceServingTag(line.notes, targetTag);
      if (nextLineNotes !== (line.notes || "")) {
        await tx.orderLine.update({
          where: { id: line.id },
          data: { notes: nextLineNotes, version: { increment: 1 } },
        });
        await tx.kitchenTicketLine.updateMany({
          where: {
            orderLineId: line.id,
            status: { notIn: ["CANCELLED", "SERVED"] },
          },
          data: { notes: nextLineNotes },
        });
      }
    }

    const updatedOrder = await tx.restaurantOrder.update({
      where: { id: order.id },
      data: {
        orderType: input.targetOrderType,
        tableId: null,
        tableSessionId: null,
        notes: finalNotes,
        version: { increment: 1 },
      },
      include: {
        tableSession: true,
        table: true,
        rounds: {
          include: { lines: true },
          orderBy: { roundNumber: "asc" },
        },
      },
    });

    await releaseTableIfIdle(tx, input.businessId, oldTableId, oldTableSessionId, order.id);

    await createAuditEvent(
      {
        businessId: input.businessId,
        branchId: order.branchId,
        userId: input.actorId,
        action: "RESTAURANT_ORDER_TYPE_CONVERTED",
        entity: "RestaurantOrder",
        entityId: order.id,
        oldValue: {
          orderType: oldOrderType,
          tableId: oldTableId,
          tableSessionId: oldTableSessionId,
        },
        newValue: {
          orderType: input.targetOrderType,
          tableId: null,
          tableSessionId: null,
        },
      },
      tx
    );

    return updatedOrder;
  };

  if (externalTx) {
    return await runner(externalTx);
  }
  return await db.$transaction(runner, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  });
}

