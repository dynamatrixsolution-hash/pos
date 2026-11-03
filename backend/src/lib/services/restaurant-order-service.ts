import { db } from "@/lib/db";
import { Prisma } from "@dynapos/db";
import { money, addMoney, mulMoney, divMoney, toDecimal } from "@/lib/services/decimal-math";
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
  tableSessionId?: string | null;
  tableId?: string | null;
  orderType?: string; // DINE_IN, TAKEAWAY, BAR_WALK_IN
  items: OrderItemInput[];
  notes?: string;
  actorId?: string;
}

export interface UpdateLineStatusInput {
  businessId: string;
  lineId: string;
  acceptanceStatus?: "PENDING" | "ACCEPTED" | "REJECTED";
  fulfillmentStatus?: "QUEUED" | "PREPARING" | "READY" | "SERVED" | "CANCELLED";
  settlementStatus?: "UNPAID" | "PARTIAL" | "PAID" | "REFUNDED";
  rejectionReason?: string;
  voidReason?: string;
  actorId?: string;
  expectedVersion?: number;
}

function generateOrderNumber(): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
  const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, "");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `RO-${dateStr}-${timeStr}-${rand}`;
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

    // 1. If tableSessionId is provided, check session state and find existing open order
    if (input.tableSessionId) {
      const session = await tx.tableSession.findFirst({
        where: { id: input.tableSessionId, businessId: input.businessId },
      });

      if (!session) {
        throw new RestaurantOrderError("Table session not found", 404);
      }

      if (session.status !== "ACTIVE" && session.status !== "BILLED") {
        throw new RestaurantOrderError(`Cannot add order to session with status: ${session.status}`, 400);
      }

      // Check if session already has an order
      order = await tx.restaurantOrder.findFirst({
        where: {
          tableSessionId: input.tableSessionId,
          businessId: input.businessId,
          settlementStatus: { not: "PAID" },
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
      where: { id: input.lineId, businessId: input.businessId },
      include: { order: true },
    });

    if (!line) {
      throw new RestaurantOrderError("Order line not found", 404);
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

    const updatedLine = await tx.orderLine.update({
      where: { id: line.id },
      data: dataToUpdate,
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
          acceptanceStatus: line.acceptanceStatus,
          fulfillmentStatus: line.fulfillmentStatus,
          settlementStatus: line.settlementStatus,
          version: line.version,
        },
        newValue: {
          acceptanceStatus: updatedLine.acceptanceStatus,
          fulfillmentStatus: updatedLine.fulfillmentStatus,
          settlementStatus: updatedLine.settlementStatus,
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

