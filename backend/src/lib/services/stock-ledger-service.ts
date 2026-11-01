import { Prisma } from "@dynapos/db";
import { stockQty } from "./decimal-math";

export class StockLedgerError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "StockLedgerError";
    this.statusCode = statusCode;
  }
}

export type MovementSourceType =
  | "SALE"
  | "PURCHASE"
  | "ADJUSTMENT"
  | "TRANSFER_IN"
  | "TRANSFER_OUT"
  | "OPENING"
  | "SALE_RETURN"
  | "PURCHASE_RETURN"
  | "CANCELLATION";

export interface RecordMovementParams {
  businessId: string;
  branchId: string;
  productId: string;
  batchNumber?: string | null;
  quantity: Prisma.Decimal | number | string; // Signed: positive for in, negative for out
  unit?: string | null;
  sourceType: MovementSourceType;
  sourceId: string;
  eventKey?: string | null;
  actorId?: string | null;
  notes?: string | null;
  allowNegativeStock?: boolean;
}

/**
 * Asserts whether sufficient stock is available under serializable concurrency.
 * If negative stock is not allowed, rejects when available < requested.
 */
export async function assertStockAvailable(
  tx: Prisma.TransactionClient,
  businessId: string,
  branchId: string,
  productId: string,
  batchNumber: string | null | undefined,
  requestedQty: Prisma.Decimal,
  allowNegativeStock: boolean
): Promise<void> {
  if (allowNegativeStock) return;

  const currentStock = await tx.productStock.findFirst({
    where: {
      productId,
      branchId,
    },
  });

  const available = currentStock ? new Prisma.Decimal(currentStock.quantity.toString()) : new Prisma.Decimal(0);
  if (available.lessThan(requestedQty)) {
    throw new StockLedgerError(
      `Insufficient stock available: requested ${requestedQty.toString()}, current stock is ${available.toString()}`,
      409
    );
  }

  // Also verify Batch quantity if batchNumber is specified
  if (batchNumber) {
    const batch = await tx.batch.findFirst({
      where: {
        batchNumber,
        productId,
        branchId,
      },
    });

    const batchAvailable = batch ? new Prisma.Decimal(batch.quantity.toString()) : new Prisma.Decimal(0);
    if (batchAvailable.lessThan(requestedQty)) {
      throw new StockLedgerError(
        `Insufficient batch stock for ${batchNumber}: requested ${requestedQty.toString()}, available is ${batchAvailable.toString()}`,
        409
      );
    }
  }
}

/**
 * Records an append-only StockMovement event and atomically updates the projected ProductStock.
 * Strict Invariant: sum(StockMovement.quantity) === ProductStock.quantity.
 */
export async function recordStockMovement(
  tx: Prisma.TransactionClient,
  params: RecordMovementParams
) {
  const qty = stockQty(params.quantity);
  if (qty.isZero()) {
    throw new StockLedgerError("Stock movement quantity cannot be zero", 400);
  }

  // 1. If stock is moving out (negative qty), verify stock limits
  if (qty.isNegative()) {
    const deductQty = qty.abs();
    await assertStockAvailable(
      tx,
      params.businessId,
      params.branchId,
      params.productId,
      params.batchNumber,
      deductQty,
      params.allowNegativeStock ?? false
    );
  }

  // 2. Fetch or create ProductStock projection
  const existingStock = await tx.productStock.findFirst({
    where: {
      productId: params.productId,
      branchId: params.branchId,
    },
  });

  const currentProjection = existingStock ? new Prisma.Decimal(existingStock.quantity.toString()) : new Prisma.Decimal(0);
  const newProjection = currentProjection.add(qty);

  if (existingStock) {
    await tx.productStock.update({
      where: { id: existingStock.id },
      data: { quantity: newProjection.toNumber() },
    });
  } else {
    await tx.productStock.create({
      data: {
        productId: params.productId,
        branchId: params.branchId,
        quantity: newProjection.toNumber(),
      },
    });
  }

  // 3. Update Batch projection if applicable
  if (params.batchNumber) {
    const batch = await tx.batch.findFirst({
      where: {
        batchNumber: params.batchNumber,
        productId: params.productId,
        branchId: params.branchId,
      },
    });

    if (batch) {
      const currentBatchQty = new Prisma.Decimal(batch.quantity.toString());
      const newBatchQty = currentBatchQty.add(qty);
      await tx.batch.update({
        where: { id: batch.id },
        data: { quantity: newBatchQty.toNumber() },
      });
    }
  }

  // 4. Record append-only StockMovement ledger entry
  return await tx.stockMovement.create({
    data: {
      businessId: params.businessId,
      branchId: params.branchId,
      productId: params.productId,
      batchNumber: params.batchNumber || undefined,
      quantity: qty,
      unit: params.unit || undefined,
      sourceType: params.sourceType,
      sourceId: params.sourceId,
      eventKey: params.eventKey || undefined,
      actorId: params.actorId || undefined,
      notes: params.notes || undefined,
    },
  });
}
