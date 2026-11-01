import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { Prisma } from "@dynapos/db";
import {
  addMoney,
  divMoney,
  money,
  mulMoney,
  subMoney,
} from "@/lib/services/decimal-math";
import { createAuditEvent } from "@/lib/audit-event";
import {
  HotelError,
  parseDate,
  PrismaClientLike,
  withHotelTransaction,
} from "@/lib/services/room-availability-service";

// -----------------------------------------------------------------------------
// Input Interfaces
// -----------------------------------------------------------------------------

export interface EnsureGuestFolioInput {
  businessId: string;
  branchId: string;
  stayId: string;
  windowName?: string;
  notes?: string | null;
  actorId?: string;
}

export interface GetAllFoliosInput {
  businessId: string;
  branchId?: string | null;
  stayId?: string | null;
  status?: string | null;
}

export interface LockFolioInput {
  businessId: string;
  folioId: string;
  actorId?: string;
}

export interface PostRoomNightChargeInput {
  businessId: string;
  branchId: string;
  stayId: string;
  folioId?: string | null;
  chargeDate: Date | string;
  baseRate?: number | string | Prisma.Decimal;
  taxRatePercent?: number | string | Prisma.Decimal;
  ratePlan?: string | null;
  actorId?: string;
}

export interface RunNightAuditInput {
  businessId: string;
  branchId: string;
  auditDate: Date | string;
  taxRatePercent?: number | string | Prisma.Decimal;
  actorId?: string;
}

export type FolioChargeCategory =
  | "ROOM"
  | "DINING"
  | "MINIBAR"
  | "LAUNDRY"
  | "SPA"
  | "OTHER";

export interface PostManualFolioChargeInput {
  businessId: string;
  branchId: string;
  stayId: string;
  folioId?: string | null;
  category: FolioChargeCategory;
  description: string;
  amount: number | string | Prisma.Decimal;
  taxAmount?: number | string | Prisma.Decimal;
  sourceId?: string;
  actorId?: string;
}

export interface PostRestaurantOrderToFolioInput {
  businessId: string;
  branchId: string;
  orderId: string;
  stayId: string;
  folioId?: string | null;
  actorId?: string;
}

export interface ReverseOrAdjustFolioEntryInput {
  businessId: string;
  branchId: string;
  folioEntryId: string;
  adjustmentAmount?: number | string | Prisma.Decimal;
  reason: string;
  actorId?: string;
}

export interface TransferFolioEntryInput {
  businessId: string;
  entryId: string;
  targetFolioId: string;
  actorId?: string;
}

export type FolioPaymentMethod =
  | "CASH"
  | "CARD"
  | "QR"
  | "BANK_TRANSFER"
  | "DEPOSIT";

export interface FolioSettlementTenderInput {
  paymentMethod: FolioPaymentMethod;
  amount: number | string | Prisma.Decimal;
  reference?: string | null;
  notes?: string | null;
  paymentId?: string | null;
}

export interface SettleGuestFolioInput {
  businessId: string;
  branchId: string;
  folioId: string;
  tenders: FolioSettlementTenderInput[];
  actorId?: string;
}

export interface GetFolioAccountingReconciliationInput {
  businessId: string;
  stayId: string;
}

// -----------------------------------------------------------------------------
// Number Generators & Helpers
// -----------------------------------------------------------------------------

function generateFolioNumber(now = new Date()): string {
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, "");
  const timePart = now.toTimeString().slice(0, 8).replace(/:/g, "");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `FOLIO-${datePart}-${timePart}-${rand}`;
}

function generateEntryNumber(now = new Date()): string {
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, "");
  const timePart = now.toTimeString().slice(0, 8).replace(/:/g, "");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `FENT-${datePart}-${timePart}-${rand}`;
}

function normalizeToUtcMidnight(val: Date | string, fieldName: string): Date {
  const d = parseDate(val, fieldName);
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  );
}

const FOLIO_DETAIL_INCLUDE = {
  stay: {
    include: {
      room: true,
    },
  },
  entries: {
    orderBy: { postedAt: "asc" as const },
  },
  roomNightCharges: {
    orderBy: { chargeDate: "asc" as const },
  },
  settlements: {
    orderBy: { allocatedAt: "asc" as const },
  },
} as const;

// -----------------------------------------------------------------------------
// Core Folio Domain Functions
// -----------------------------------------------------------------------------

/**
 * Recalculates `chargesTotal`, `creditsTotal`, `paymentsTotal`, and `balance`
 * for a `GuestFolio` from its immutable `FolioEntry` and `FolioSettlementAllocation`
 * rows, and synchronizes the parent `Stay` totals across all folios of that stay.
 */
export async function recalculateFolioTotals(
  tx: PrismaClientLike,
  businessId: string,
  folioId: string
) {
  const folio = await tx.guestFolio.findFirst({
    where: { id: folioId, businessId },
  });
  if (!folio) {
    throw new HotelError("Folio not found", 404, "FOLIO_NOT_FOUND");
  }

  const entries = await tx.folioEntry.findMany({
    where: { businessId, folioId },
  });

  const allocations = await tx.folioSettlementAllocation.findMany({
    where: { businessId, folioId, status: "APPLIED" },
  });

  let chargesTotal = money(0);
  let creditsTotal = money(0);

  for (const entry of entries) {
    if (entry.direction === "DEBIT") {
      chargesTotal = addMoney(chargesTotal, money(entry.totalAmount));
    } else if (entry.direction === "CREDIT") {
      creditsTotal = addMoney(creditsTotal, money(entry.totalAmount));
    }
  }

  let paymentsTotal = money(0);
  for (const alloc of allocations) {
    paymentsTotal = addMoney(paymentsTotal, money(alloc.amount));
  }

  const balance = subMoney(subMoney(chargesTotal, creditsTotal), paymentsTotal);

  const updatedFolio = await tx.guestFolio.update({
    where: { id: folioId },
    data: {
      chargesTotal,
      creditsTotal,
      paymentsTotal,
      balance,
      version: { increment: 1 },
    },
    include: FOLIO_DETAIL_INCLUDE,
  });

  // Synchronize Stay totals across all folios of this stayId
  const allStayFolios = await tx.guestFolio.findMany({
    where: { businessId, stayId: folio.stayId },
  });

  let stayCharges = money(0);
  let stayCredits = money(0);
  let stayPayments = money(0);

  for (const f of allStayFolios) {
    stayCharges = addMoney(stayCharges, money(f.chargesTotal));
    stayCredits = addMoney(stayCredits, money(f.creditsTotal));
    stayPayments = addMoney(stayPayments, money(f.paymentsTotal));
  }

  const hasFolioActivity =
    Number(stayCharges) > 0 ||
    Number(stayCredits) > 0 ||
    Number(stayPayments) > 0;

  if (hasFolioActivity) {
    const netStayTotal = subMoney(stayCharges, stayCredits);
    await tx.stay.update({
      where: { id: folio.stayId },
      data: {
        ...(Number(stayCharges) > 0 || Number(stayCredits) > 0
          ? { totalAmount: netStayTotal }
          : {}),
        ...(Number(stayPayments) > 0 || Number(stayCharges) > 0
          ? { paidAmount: stayPayments }
          : {}),
        version: { increment: 1 },
      },
    });
  }

  return updatedFolio;
}

/**
 * Finds or creates a `GuestFolio` for `(businessId, stayId, windowName)`.
 */
export async function ensureGuestFolio(
  input: EnsureGuestFolioInput,
  prismaClient: PrismaClientLike = db
) {
  const windowName = (input.windowName || "PRIMARY").trim().toUpperCase();

  return await withHotelTransaction(prismaClient, async (tx) => {
    const existing = await tx.guestFolio.findFirst({
      where: {
        businessId: input.businessId,
        stayId: input.stayId,
        windowName,
      },
      include: FOLIO_DETAIL_INCLUDE,
    });
    if (existing) {
      return existing;
    }

    const stay = await tx.stay.findFirst({
      where: { id: input.stayId, businessId: input.businessId },
    });
    if (!stay) {
      throw new HotelError("Stay not found", 404, "STAY_NOT_FOUND");
    }

    try {
      const created = await tx.guestFolio.create({
        data: {
          businessId: input.businessId,
          branchId: input.branchId || stay.branchId,
          stayId: stay.id,
          folioNumber: generateFolioNumber(),
          windowName,
          guestName: stay.guestName,
          status: "OPEN",
          chargesTotal: money(0),
          creditsTotal: money(0),
          paymentsTotal: money(0),
          balance: money(0),
          notes: input.notes ?? null,
        },
        include: FOLIO_DETAIL_INCLUDE,
      });

      await createAuditEvent(
        {
          businessId: input.businessId,
          branchId: created.branchId,
          userId: input.actorId ?? null,
          action: "FOLIO_CREATED",
          entity: "GuestFolio",
          entityId: created.id,
          entityVersion: created.version,
          newValue: created,
        },
        tx
      );

      return created;
    } catch (err) {
      if ((err as { code?: string })?.code === "P2002") {
        const concurrent = await tx.guestFolio.findFirst({
          where: {
            businessId: input.businessId,
            stayId: input.stayId,
            windowName,
          },
          include: FOLIO_DETAIL_INCLUDE,
        });
        if (concurrent) return concurrent;
      }
      throw err;
    }
  });
}

export async function getFoliosForStay(
  businessId: string,
  stayId: string,
  prismaClient: PrismaClientLike = db
) {
  return await prismaClient.guestFolio.findMany({
    where: { businessId, stayId },
    include: FOLIO_DETAIL_INCLUDE,
    orderBy: [{ createdAt: "asc" }],
  });
}

export async function getAllFolios(
  input: GetAllFoliosInput,
  prismaClient: PrismaClientLike = db
) {
  return await prismaClient.guestFolio.findMany({
    where: {
      businessId: input.businessId,
      ...(input.branchId ? { branchId: input.branchId } : {}),
      ...(input.stayId ? { stayId: input.stayId } : {}),
      ...(input.status ? { status: input.status } : {}),
    },
    include: FOLIO_DETAIL_INCLUDE,
    orderBy: [{ createdAt: "desc" }],
  });
}

export async function getFolioById(
  businessId: string,
  folioId: string,
  prismaClient: PrismaClientLike = db
) {
  const folio = await prismaClient.guestFolio.findFirst({
    where: { id: folioId, businessId },
    include: FOLIO_DETAIL_INCLUDE,
  });
  if (!folio) {
    throw new HotelError("Folio not found", 404, "FOLIO_NOT_FOUND");
  }
  return folio;
}

export async function lockFolioForCheckout(
  input: LockFolioInput,
  prismaClient: PrismaClientLike = db
) {
  return await withHotelTransaction(prismaClient, async (tx) => {
    const folio = await tx.guestFolio.findFirst({
      where: { id: input.folioId, businessId: input.businessId },
    });
    if (!folio) {
      throw new HotelError("Folio not found", 404, "FOLIO_NOT_FOUND");
    }
    if (folio.status === "CLOSED") {
      throw new HotelError(
        "Cannot lock a closed folio",
        409,
        "FOLIO_CLOSED"
      );
    }

    const updated = await tx.guestFolio.update({
      where: { id: folio.id },
      data: {
        status: "SETTLING",
        lockedAt: new Date(),
        version: { increment: 1 },
      },
      include: FOLIO_DETAIL_INCLUDE,
    });

    await createAuditEvent(
      {
        businessId: input.businessId,
        branchId: folio.branchId,
        userId: input.actorId ?? null,
        action: "FOLIO_LOCKED_FOR_CHECKOUT",
        entity: "GuestFolio",
        entityId: updated.id,
        entityVersion: updated.version,
        oldValue: folio,
        newValue: updated,
      },
      tx
    );

    return updated;
  });
}

export async function unlockFolio(
  input: LockFolioInput,
  prismaClient: PrismaClientLike = db
) {
  return await withHotelTransaction(prismaClient, async (tx) => {
    const folio = await tx.guestFolio.findFirst({
      where: { id: input.folioId, businessId: input.businessId },
    });
    if (!folio) {
      throw new HotelError("Folio not found", 404, "FOLIO_NOT_FOUND");
    }
    if (folio.status === "CLOSED") {
      throw new HotelError(
        "Cannot unlock a closed folio",
        409,
        "FOLIO_CLOSED"
      );
    }

    const updated = await tx.guestFolio.update({
      where: { id: folio.id },
      data: {
        status: "OPEN",
        lockedAt: null,
        version: { increment: 1 },
      },
      include: FOLIO_DETAIL_INCLUDE,
    });

    await createAuditEvent(
      {
        businessId: input.businessId,
        branchId: folio.branchId,
        userId: input.actorId ?? null,
        action: "FOLIO_UNLOCKED",
        entity: "GuestFolio",
        entityId: updated.id,
        entityVersion: updated.version,
        oldValue: folio,
        newValue: updated,
      },
      tx
    );

    return updated;
  });
}

/**
 * Posts a nightly room charge for a specific date and stay.
 * Enforces idempotency via `(businessId, stayId, chargeDate)` uniqueness.
 */
export async function postRoomNightCharge(
  input: PostRoomNightChargeInput,
  prismaClient: PrismaClientLike = db
) {
  const normalizedChargeDate = normalizeToUtcMidnight(
    input.chargeDate,
    "chargeDate"
  );
  const chargeDateStr = normalizedChargeDate.toISOString().slice(0, 10);

  return await withHotelTransaction(prismaClient, async (tx) => {
    const stay = await tx.stay.findFirst({
      where: { id: input.stayId, businessId: input.businessId },
      include: { reservation: true },
    });
    if (!stay) {
      throw new HotelError("Stay not found", 404, "STAY_NOT_FOUND");
    }
    if (stay.status === "COMPLETED") {
      throw new HotelError(
        "Cannot post room night charge to a checked-out stay",
        409,
        "STAY_COMPLETED"
      );
    }

    const folio = input.folioId
      ? await getFolioById(input.businessId, input.folioId, tx)
      : await ensureGuestFolio(
          {
            businessId: input.businessId,
            branchId: input.branchId || stay.branchId,
            stayId: stay.id,
            actorId: input.actorId,
          },
          tx
        );

    if (folio.status === "SETTLING" || folio.status === "CLOSED") {
      throw new HotelError(
        "Cannot post charge: Folio is locked for settlement or closed",
        409,
        "FOLIO_LOCKED"
      );
    }

    const baseRate =
      input.baseRate !== undefined
        ? money(input.baseRate)
        : money(stay.ratePerNight);

    const taxRate =
      input.taxRatePercent !== undefined ? money(input.taxRatePercent) : money(0);
    const taxAmount =
      Number(taxRate) > 0
        ? divMoney(mulMoney(baseRate, taxRate), 100)
        : money(0);
    const totalAmount = addMoney(baseRate, taxAmount);
    const ratePlan =
      input.ratePlan ?? stay.reservation?.ratePlan ?? "STANDARD";

    let nightCharge;
    try {
      nightCharge = await tx.roomNightCharge.create({
        data: {
          businessId: input.businessId,
          branchId: input.branchId || stay.branchId,
          stayId: stay.id,
          folioId: folio.id,
          roomId: stay.roomId,
          chargeDate: normalizedChargeDate,
          ratePlan,
          baseRate,
          taxAmount,
          totalAmount,
          status: "POSTED",
          postedById: input.actorId ?? null,
        },
      });
    } catch (err) {
      if ((err as { code?: string })?.code === "P2002") {
        throw new HotelError(
          "Room night charge already posted for this stay and date",
          409,
          "NIGHT_CHARGE_ALREADY_POSTED"
        );
      }
      throw err;
    }

    const entry = await tx.folioEntry.create({
      data: {
        businessId: input.businessId,
        branchId: input.branchId || stay.branchId,
        folioId: folio.id,
        stayId: stay.id,
        entryNumber: generateEntryNumber(),
        sourceType: "ROOM_NIGHT",
        sourceId: nightCharge.id,
        postingKind: "CHARGE",
        category: "ROOM",
        description: `Room Night Charge (${chargeDateStr})`,
        amount: baseRate,
        taxAmount,
        totalAmount,
        direction: "DEBIT",
        isRevenueRecognizedHere: true,
        metadata: {
          chargeDate: chargeDateStr,
          roomId: stay.roomId,
          ratePlan,
        },
        postedById: input.actorId ?? null,
      },
    });

    const updatedFolio = await recalculateFolioTotals(
      tx,
      input.businessId,
      folio.id
    );

    await createAuditEvent(
      {
        businessId: input.businessId,
        branchId: stay.branchId,
        userId: input.actorId ?? null,
        action: "ROOM_NIGHT_CHARGE_POSTED",
        entity: "RoomNightCharge",
        entityId: nightCharge.id,
        newValue: { nightCharge, entryId: entry.id, folioId: folio.id },
      },
      tx
    );

    return {
      nightCharge,
      entry,
      folio: updatedFolio,
    };
  });
}

/**
 * Runs Night Audit across all active stays in a branch for `auditDate`.
 * Skips stays that already have a `RoomNightCharge` for `auditDate` or whose folio is locked.
 */
export async function runNightAuditForBranch(
  input: RunNightAuditInput,
  prismaClient: PrismaClientLike = db
) {
  const normalizedAuditDate = normalizeToUtcMidnight(
    input.auditDate,
    "auditDate"
  );
  const auditDateStr = normalizedAuditDate.toISOString().slice(0, 10);

  const activeStays = await prismaClient.stay.findMany({
    where: {
      businessId: input.businessId,
      branchId: input.branchId,
      status: { in: ["ACTIVE", "EXTENDED", "TRANSFERRED"] },
    },
    orderBy: [{ checkInTime: "asc" }],
  });

  const postedCharges: Array<{
    stayId: string;
    folioId: string;
    nightChargeId: string;
    entryId: string;
    totalAmount: Prisma.Decimal;
  }> = [];

  const skippedStays: Array<{
    stayId: string;
    reason: string;
  }> = [];

  for (const stay of activeStays) {
    const existingCharge = await prismaClient.roomNightCharge.findFirst({
      where: {
        businessId: input.businessId,
        stayId: stay.id,
        chargeDate: normalizedAuditDate,
      },
    });
    if (existingCharge) {
      skippedStays.push({
        stayId: stay.id,
        reason: "NIGHT_CHARGE_ALREADY_POSTED",
      });
      continue;
    }

    try {
      const result = await postRoomNightCharge(
        {
          businessId: input.businessId,
          branchId: input.branchId,
          stayId: stay.id,
          chargeDate: normalizedAuditDate,
          taxRatePercent: input.taxRatePercent,
          actorId: input.actorId,
        },
        prismaClient
      );
      postedCharges.push({
        stayId: stay.id,
        folioId: result.folio.id,
        nightChargeId: result.nightCharge.id,
        entryId: result.entry.id,
        totalAmount: result.nightCharge.totalAmount,
      });
    } catch (err) {
      if (
        err instanceof HotelError &&
        (err.code === "NIGHT_CHARGE_ALREADY_POSTED" ||
          err.code === "FOLIO_LOCKED")
      ) {
        skippedStays.push({
          stayId: stay.id,
          reason: err.code,
        });
        continue;
      }
      throw err;
    }
  }

  return {
    auditDate: auditDateStr,
    processedCount: activeStays.length,
    postedCharges,
    skippedStays,
  };
}

/**
 * Posts a manual incidental or room charge to a guest folio.
 */
export async function postManualFolioCharge(
  input: PostManualFolioChargeInput,
  prismaClient: PrismaClientLike = db
) {
  const description = input.description?.trim();
  if (!description) {
    throw new HotelError(
      "Charge description is required",
      400,
      "VALIDATION_ERROR"
    );
  }

  const amountDec = money(input.amount);
  if (Number(amountDec) <= 0) {
    throw new HotelError(
      "Charge amount must be greater than zero",
      400,
      "VALIDATION_ERROR"
    );
  }
  const taxDec = money(input.taxAmount ?? 0);
  if (Number(taxDec) < 0) {
    throw new HotelError(
      "Tax amount cannot be negative",
      400,
      "VALIDATION_ERROR"
    );
  }
  const totalDec = addMoney(amountDec, taxDec);

  return await withHotelTransaction(prismaClient, async (tx) => {
    const stay = await tx.stay.findFirst({
      where: { id: input.stayId, businessId: input.businessId },
    });
    if (!stay) {
      throw new HotelError("Stay not found", 404, "STAY_NOT_FOUND");
    }
    if (stay.status === "COMPLETED") {
      throw new HotelError(
        "Cannot post charge to a checked-out stay",
        409,
        "STAY_COMPLETED"
      );
    }

    const folio = input.folioId
      ? await getFolioById(input.businessId, input.folioId, tx)
      : await ensureGuestFolio(
          {
            businessId: input.businessId,
            branchId: input.branchId || stay.branchId,
            stayId: stay.id,
            actorId: input.actorId,
          },
          tx
        );

    if (folio.status === "SETTLING" || folio.status === "CLOSED") {
      throw new HotelError(
        "Cannot post charge: Folio is locked for settlement or closed",
        409,
        "FOLIO_LOCKED"
      );
    }

    const entry = await tx.folioEntry.create({
      data: {
        businessId: input.businessId,
        branchId: input.branchId || stay.branchId,
        folioId: folio.id,
        stayId: stay.id,
        entryNumber: generateEntryNumber(),
        sourceType: input.category,
        sourceId: input.sourceId || randomUUID(),
        postingKind: "CHARGE",
        category: input.category,
        description,
        amount: amountDec,
        taxAmount: taxDec,
        totalAmount: totalDec,
        direction: "DEBIT",
        isRevenueRecognizedHere: true,
        postedById: input.actorId ?? null,
      },
    });

    const updatedFolio = await recalculateFolioTotals(
      tx,
      input.businessId,
      folio.id
    );

    await createAuditEvent(
      {
        businessId: input.businessId,
        branchId: stay.branchId,
        userId: input.actorId ?? null,
        action: "MANUAL_FOLIO_CHARGE_POSTED",
        entity: "FolioEntry",
        entityId: entry.id,
        newValue: { entry, folioId: folio.id },
      },
      tx
    );

    return {
      entry,
      folio: updatedFolio,
    };
  });
}

/**
 * Cross-Module "Charge to Room" Bridge:
 * Transfers the receivable of a `RestaurantOrder` onto an active `Stay`'s `GuestFolio`.
 * Sets `isRevenueRecognizedHere: false` on the `FolioEntry` so food revenue is recognized
 * once in the restaurant module and never double-counted as hotel revenue.
 */
export async function postRestaurantOrderToFolio(
  input: PostRestaurantOrderToFolioInput,
  prismaClient: PrismaClientLike = db
) {
  return await withHotelTransaction(prismaClient, async (tx) => {
    const order = await tx.restaurantOrder.findFirst({
      where: { id: input.orderId, businessId: input.businessId },
    });
    if (!order) {
      throw new HotelError(
        "Restaurant order not found",
        404,
        "ORDER_NOT_FOUND"
      );
    }

    const stay = await tx.stay.findFirst({
      where: { id: input.stayId, businessId: input.businessId },
    });
    if (!stay) {
      throw new HotelError("Stay not found", 404, "STAY_NOT_FOUND");
    }

    // Check idempotency before state checks in case of retry
    const existingTransfer = await tx.folioEntry.findFirst({
      where: {
        businessId: input.businessId,
        sourceType: "RESTAURANT_ORDER",
        sourceId: order.id,
        postingKind: "RECEIVABLE_TRANSFER",
      },
    });

    if (existingTransfer) {
      if (existingTransfer.stayId === stay.id) {
        const existingFolio = await getFolioById(
          input.businessId,
          existingTransfer.folioId,
          tx
        );
        return {
          entry: existingTransfer,
          folio: existingFolio,
          order,
          idempotentReplay: true,
        };
      }
      throw new HotelError(
        "Restaurant order is already charged to another stay folio",
        409,
        "ORDER_ALREADY_CHARGED"
      );
    }

    if (stay.status === "COMPLETED") {
      throw new HotelError(
        "Cannot attach restaurant charge to a checked-out stay",
        409,
        "STAY_ALREADY_CLOSED"
      );
    }

    const folio = input.folioId
      ? await getFolioById(input.businessId, input.folioId, tx)
      : await ensureGuestFolio(
          {
            businessId: input.businessId,
            branchId: input.branchId || stay.branchId,
            stayId: stay.id,
            actorId: input.actorId,
          },
          tx
        );

    if (folio.status === "SETTLING" || folio.status === "CLOSED") {
      throw new HotelError(
        "Cannot attach restaurant charge: Folio is locked for checkout settlement",
        409,
        "FOLIO_SETTLING_LOCKED"
      );
    }

    let entry;
    try {
      entry = await tx.folioEntry.create({
        data: {
          businessId: input.businessId,
          branchId: input.branchId || stay.branchId,
          folioId: folio.id,
          stayId: stay.id,
          entryNumber: generateEntryNumber(),
          sourceType: "RESTAURANT_ORDER",
          sourceId: order.id,
          postingKind: "RECEIVABLE_TRANSFER",
          category: "DINING",
          description: `Restaurant Order ${order.orderNumber} (Charge to Room)`,
          amount: order.subtotal,
          taxAmount: order.taxTotal,
          totalAmount: order.totalAmount,
          direction: "DEBIT",
          isRevenueRecognizedHere: false,
          metadata: {
            orderId: order.id,
            orderNumber: order.orderNumber,
            tableId: order.tableId,
            tableSessionId: order.tableSessionId,
          },
          postedById: input.actorId ?? null,
        },
      });
    } catch (err) {
      if ((err as { code?: string })?.code === "P2002") {
        const concurrent = await tx.folioEntry.findFirst({
          where: {
            businessId: input.businessId,
            sourceType: "RESTAURANT_ORDER",
            sourceId: order.id,
            postingKind: "RECEIVABLE_TRANSFER",
          },
        });
        if (concurrent && concurrent.stayId === stay.id) {
          const existingFolio = await getFolioById(
            input.businessId,
            concurrent.folioId,
            tx
          );
          return {
            entry: concurrent,
            folio: existingFolio,
            order,
            idempotentReplay: true,
          };
        }
        throw new HotelError(
          "Restaurant order is already charged to another stay folio",
          409,
          "ORDER_ALREADY_CHARGED"
        );
      }
      throw err;
    }

    const updatedOrder = await tx.restaurantOrder.update({
      where: { id: order.id },
      data: {
        settlementStatus: "PAID",
        paidAmount: order.totalAmount,
        version: { increment: 1 },
      },
    });

    await tx.orderLine.updateMany({
      where: {
        businessId: input.businessId,
        orderId: order.id,
        fulfillmentStatus: { not: "CANCELLED" },
        acceptanceStatus: { not: "REJECTED" },
      },
      data: {
        settlementStatus: "PAID",
      },
    });

    const updatedFolio = await recalculateFolioTotals(
      tx,
      input.businessId,
      folio.id
    );

    await createAuditEvent(
      {
        businessId: input.businessId,
        branchId: stay.branchId,
        userId: input.actorId ?? null,
        action: "RESTAURANT_ORDER_CHARGED_TO_ROOM",
        entity: "FolioEntry",
        entityId: entry.id,
        newValue: {
          entry,
          orderId: order.id,
          stayId: stay.id,
          folioId: folio.id,
        },
      },
      tx
    );

    return {
      entry,
      folio: updatedFolio,
      order: updatedOrder,
      idempotentReplay: false,
    };
  });
}

/**
 * Reverses or partially adjusts a `DEBIT` `FolioEntry` by creating an immutable
 * offsetting `CREDIT` `FolioEntry` linked via `reversedEntryId`.
 */
export async function reverseOrAdjustFolioEntry(
  input: ReverseOrAdjustFolioEntryInput,
  prismaClient: PrismaClientLike = db
) {
  const reason = input.reason?.trim();
  if (!reason) {
    throw new HotelError(
      "Reversal or adjustment reason is required",
      400,
      "VALIDATION_ERROR"
    );
  }

  return await withHotelTransaction(prismaClient, async (tx) => {
    const original = await tx.folioEntry.findFirst({
      where: { id: input.folioEntryId, businessId: input.businessId },
    });
    if (!original) {
      throw new HotelError(
        "Folio entry not found",
        404,
        "FOLIO_ENTRY_NOT_FOUND"
      );
    }

    if (original.direction !== "DEBIT") {
      throw new HotelError(
        "Only DEBIT folio entries can be reversed or adjusted",
        400,
        "INVALID_ENTRY_DIRECTION"
      );
    }

    const folio = await tx.guestFolio.findFirst({
      where: { id: original.folioId, businessId: input.businessId },
    });
    if (!folio) {
      throw new HotelError("Folio not found", 404, "FOLIO_NOT_FOUND");
    }
    if (folio.status === "CLOSED") {
      throw new HotelError(
        "Cannot reverse or adjust an entry on a closed folio",
        409,
        "FOLIO_CLOSED"
      );
    }

    const adjTotal =
      input.adjustmentAmount !== undefined
        ? money(input.adjustmentAmount)
        : money(original.totalAmount);

    if (
      Number(adjTotal) <= 0 ||
      Number(adjTotal) > Number(original.totalAmount)
    ) {
      throw new HotelError(
        "Adjustment amount must be positive and cannot exceed original entry total",
        400,
        "INVALID_ADJUSTMENT_AMOUNT"
      );
    }

    const priorCredits = await tx.folioEntry.findMany({
      where: {
        businessId: input.businessId,
        reversedEntryId: original.id,
        direction: "CREDIT",
      },
    });
    let alreadyReversed = money(0);
    for (const c of priorCredits) {
      alreadyReversed = addMoney(alreadyReversed, money(c.totalAmount));
    }

    if (
      Number(addMoney(alreadyReversed, adjTotal)) >
      Number(original.totalAmount)
    ) {
      throw new HotelError(
        "Total adjustments/reversals cannot exceed original entry total",
        409,
        "ENTRY_ALREADY_REVERSED"
      );
    }

    const isFullReversal =
      Number(adjTotal) === Number(original.totalAmount);
    const postingKind = isFullReversal ? "REVERSAL" : "CREDIT_ADJUSTMENT";

    const creditEntry = await tx.folioEntry.create({
      data: {
        businessId: input.businessId,
        branchId: input.branchId || original.branchId,
        folioId: original.folioId,
        stayId: original.stayId,
        entryNumber: generateEntryNumber(),
        sourceType: original.sourceType,
        sourceId:
          priorCredits.length === 0
            ? original.sourceId
            : `${original.sourceId}#adj-${priorCredits.length + 1}`,
        postingKind,
        category: original.category,
        description: `Adjustment/Reversal for ${original.entryNumber}: ${reason}`,
        amount: adjTotal,
        taxAmount: money(0),
        totalAmount: adjTotal,
        direction: "CREDIT",
        isRevenueRecognizedHere: original.isRevenueRecognizedHere,
        reversedEntryId: original.id,
        metadata: {
          reason,
          originalEntryId: original.id,
          originalEntryNumber: original.entryNumber,
        },
        postedById: input.actorId ?? null,
      },
    });

    if (original.sourceType === "RESTAURANT_ORDER" && isFullReversal) {
      await tx.restaurantOrder.updateMany({
        where: { id: original.sourceId, businessId: input.businessId },
        data: {
          settlementStatus: "REFUNDED",
        },
      });
    }

    if (original.sourceType === "ROOM_NIGHT" && isFullReversal) {
      await tx.roomNightCharge.updateMany({
        where: { id: original.sourceId, businessId: input.businessId },
        data: {
          status: "REVERSED",
        },
      });
    }

    const updatedFolio = await recalculateFolioTotals(
      tx,
      input.businessId,
      original.folioId
    );

    await createAuditEvent(
      {
        businessId: input.businessId,
        branchId: original.branchId,
        userId: input.actorId ?? null,
        action: isFullReversal
          ? "FOLIO_ENTRY_REVERSED"
          : "FOLIO_ENTRY_ADJUSTED",
        entity: "FolioEntry",
        entityId: creditEntry.id,
        reason,
        oldValue: original,
        newValue: creditEntry,
      },
      tx
    );

    return {
      creditEntry,
      originalEntry: original,
      folio: updatedFolio,
    };
  });
}

/**
 * Moves a `FolioEntry` between two open folio windows (e.g. `PRIMARY` -> `COMPANY`).
 */
export async function transferFolioEntryBetweenWindows(
  input: TransferFolioEntryInput,
  prismaClient: PrismaClientLike = db
) {
  return await withHotelTransaction(prismaClient, async (tx) => {
    const entry = await tx.folioEntry.findFirst({
      where: { id: input.entryId, businessId: input.businessId },
    });
    if (!entry) {
      throw new HotelError(
        "Folio entry not found",
        404,
        "FOLIO_ENTRY_NOT_FOUND"
      );
    }

    const sourceFolio = await tx.guestFolio.findFirst({
      where: { id: entry.folioId, businessId: input.businessId },
    });
    const targetFolio = await tx.guestFolio.findFirst({
      where: { id: input.targetFolioId, businessId: input.businessId },
    });

    if (!sourceFolio || !targetFolio) {
      throw new HotelError("Folio not found", 404, "FOLIO_NOT_FOUND");
    }

    if (sourceFolio.status !== "OPEN" || targetFolio.status !== "OPEN") {
      throw new HotelError(
        "Both source and target folios must be OPEN to transfer entries",
        409,
        "FOLIO_NOT_OPEN"
      );
    }

    const updatedEntry = await tx.folioEntry.update({
      where: { id: entry.id },
      data: {
        folioId: targetFolio.id,
        stayId: targetFolio.stayId,
      },
    });

    if (entry.sourceType === "ROOM_NIGHT") {
      await tx.roomNightCharge.updateMany({
        where: { id: entry.sourceId, businessId: input.businessId },
        data: {
          folioId: targetFolio.id,
          stayId: targetFolio.stayId,
        },
      });
    }

    // Also move any credit reversals/adjustments attached to this entry
    await tx.folioEntry.updateMany({
      where: {
        businessId: input.businessId,
        reversedEntryId: entry.id,
      },
      data: {
        folioId: targetFolio.id,
        stayId: targetFolio.stayId,
      },
    });

    const updatedSource = await recalculateFolioTotals(
      tx,
      input.businessId,
      sourceFolio.id
    );
    const updatedTarget = await recalculateFolioTotals(
      tx,
      input.businessId,
      targetFolio.id
    );

    await createAuditEvent(
      {
        businessId: input.businessId,
        branchId: targetFolio.branchId,
        userId: input.actorId ?? null,
        action: "FOLIO_ENTRY_TRANSFERRED",
        entity: "FolioEntry",
        entityId: updatedEntry.id,
        oldValue: { folioId: sourceFolio.id },
        newValue: { folioId: targetFolio.id },
      },
      tx
    );

    return {
      entry: updatedEntry,
      sourceFolio: updatedSource,
      targetFolio: updatedTarget,
    };
  });
}

/**
 * Settles a `GuestFolio` with one or more payment tenders (`CASH`, `CARD`, `QR`, `BANK_TRANSFER`, `DEPOSIT`).
 * Automatically closes the folio when its balance reaches `0.00`.
 */
export async function settleGuestFolio(
  input: SettleGuestFolioInput,
  prismaClient: PrismaClientLike = db
) {
  if (!Array.isArray(input.tenders) || input.tenders.length === 0) {
    throw new HotelError(
      "At least one settlement tender is required",
      400,
      "VALIDATION_ERROR"
    );
  }

  let tenderSum = money(0);
  for (const t of input.tenders) {
    const amt = money(t.amount);
    if (Number(amt) <= 0) {
      throw new HotelError(
        "Each tender amount must be greater than zero",
        400,
        "INVALID_TENDER_AMOUNT"
      );
    }
    tenderSum = addMoney(tenderSum, amt);
  }

  return await withHotelTransaction(prismaClient, async (tx) => {
    const existing = await tx.guestFolio.findFirst({
      where: { id: input.folioId, businessId: input.businessId },
    });
    if (!existing) {
      throw new HotelError("Folio not found", 404, "FOLIO_NOT_FOUND");
    }
    if (existing.status === "CLOSED") {
      throw new HotelError(
        "Folio is already settled and closed",
        409,
        "FOLIO_ALREADY_CLOSED"
      );
    }

    const currentFolio = await recalculateFolioTotals(
      tx,
      input.businessId,
      existing.id
    );

    if (Number(tenderSum) > Number(currentFolio.balance)) {
      throw new HotelError(
        "Total tender amount exceeds remaining folio balance",
        400,
        "TENDER_EXCEEDS_BALANCE"
      );
    }

    const allocations = [];
    for (const tender of input.tenders) {
      const alloc = await tx.folioSettlementAllocation.create({
        data: {
          businessId: input.businessId,
          branchId: input.branchId || existing.branchId,
          folioId: existing.id,
          stayId: existing.stayId,
          paymentId: tender.paymentId ?? null,
          paymentMethod: tender.paymentMethod,
          amount: money(tender.amount),
          reference: tender.reference ?? null,
          status: "APPLIED",
          notes: tender.notes ?? null,
          allocatedById: input.actorId ?? null,
        },
      });
      allocations.push(alloc);
    }

    let updatedFolio = await recalculateFolioTotals(
      tx,
      input.businessId,
      existing.id
    );

    if (Number(updatedFolio.balance) === 0) {
      updatedFolio = await tx.guestFolio.update({
        where: { id: existing.id },
        data: {
          status: "CLOSED",
          closedAt: new Date(),
          lockedAt: null,
          version: { increment: 1 },
        },
        include: FOLIO_DETAIL_INCLUDE,
      });
    }

    await createAuditEvent(
      {
        businessId: input.businessId,
        branchId: existing.branchId,
        userId: input.actorId ?? null,
        action: "FOLIO_SETTLED",
        entity: "GuestFolio",
        entityId: updatedFolio.id,
        entityVersion: updatedFolio.version,
        newValue: {
          folioId: updatedFolio.id,
          status: updatedFolio.status,
          balance: updatedFolio.balance,
          allocations,
        },
      },
      tx
    );

    return {
      folio: updatedFolio,
      allocations,
    };
  });
}

/**
 * Computes a complete cross-module accounting reconciliation summary for a `Stay`,
 * proving zero double-counted revenue between Restaurant orders and Guest Folios.
 */
export async function getFolioAccountingReconciliation(
  input: GetFolioAccountingReconciliationInput,
  prismaClient: PrismaClientLike = db
) {
  const entries = await prismaClient.folioEntry.findMany({
    where: {
      businessId: input.businessId,
      stayId: input.stayId,
    },
  });

  const settlements = await prismaClient.folioSettlementAllocation.findMany({
    where: {
      businessId: input.businessId,
      stayId: input.stayId,
      status: "APPLIED",
    },
  });

  let roomRevenue = money(0);
  let diningReceivableTransferred = money(0);
  let incidentalRevenue = money(0);
  let creditsAndAdjustments = money(0);
  let totalFolioCharges = money(0);
  let doubleCountedRevenue = money(0);

  for (const entry of entries) {
    const amt = money(entry.totalAmount);
    if (entry.direction === "DEBIT") {
      totalFolioCharges = addMoney(totalFolioCharges, amt);

      if (
        entry.sourceType === "RESTAURANT_ORDER" ||
        entry.postingKind === "RECEIVABLE_TRANSFER"
      ) {
        diningReceivableTransferred = addMoney(
          diningReceivableTransferred,
          amt
        );
        if (entry.isRevenueRecognizedHere) {
          doubleCountedRevenue = addMoney(doubleCountedRevenue, amt);
        }
      } else if (
        entry.sourceType === "ROOM_NIGHT" ||
        entry.category === "ROOM"
      ) {
        roomRevenue = addMoney(roomRevenue, amt);
      } else {
        incidentalRevenue = addMoney(incidentalRevenue, amt);
      }
    } else if (entry.direction === "CREDIT") {
      creditsAndAdjustments = addMoney(creditsAndAdjustments, amt);
    }
  }

  let totalFolioPayments = money(0);
  for (const s of settlements) {
    totalFolioPayments = addMoney(totalFolioPayments, money(s.amount));
  }

  const outstandingBalance = subMoney(
    subMoney(totalFolioCharges, creditsAndAdjustments),
    totalFolioPayments
  );

  return {
    stayId: input.stayId,
    roomRevenue: roomRevenue.toFixed(2),
    diningReceivableTransferred: diningReceivableTransferred.toFixed(2),
    incidentalRevenue: incidentalRevenue.toFixed(2),
    creditsAndAdjustments: creditsAndAdjustments.toFixed(2),
    totalFolioCharges: totalFolioCharges.toFixed(2),
    totalFolioPayments: totalFolioPayments.toFixed(2),
    outstandingBalance: outstandingBalance.toFixed(2),
    doubleCountedRevenue: doubleCountedRevenue.toFixed(2),
  };
}
