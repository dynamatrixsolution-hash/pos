import { db } from "@/lib/db";
import { DenominationRow, calculateExpectedCash, calculateCashDifference } from "./denomination";

export const DEFAULT_NPR_DENOMINATIONS = [
  { value: 1000, type: "NOTE", label: "NPR 1,000", displayOrder: 1 },
  { value: 500, type: "NOTE", label: "NPR 500", displayOrder: 2 },
  { value: 100, type: "NOTE", label: "NPR 100", displayOrder: 3 },
  { value: 50, type: "NOTE", label: "NPR 50", displayOrder: 4 },
  { value: 20, type: "NOTE", label: "NPR 20", displayOrder: 5 },
  { value: 10, type: "NOTE", label: "NPR 10", displayOrder: 6 },
  { value: 5, type: "COIN", label: "NPR 5", displayOrder: 7 },
  { value: 2, type: "COIN", label: "NPR 2", displayOrder: 8 },
  { value: 1, type: "COIN", label: "NPR 1", displayOrder: 9 },
] as const;

/**
 * Ensures the business has default NPR denominations seeded in the Denomination table.
 */
export async function ensureBusinessDenominations(businessId: string, tx: any = db) {
  const existing = await tx.denomination.findMany({
    where: { businessId },
    orderBy: [{ displayOrder: "asc" }, { value: "desc" }],
  });

  if (existing.length > 0) {
    return existing;
  }

  for (const item of DEFAULT_NPR_DENOMINATIONS) {
    await tx.denomination.upsert({
      where: {
        businessId_currencyCode_value: {
          businessId,
          currencyCode: "NPR",
          value: item.value,
        },
      },
      update: {},
      create: {
        businessId,
        currencyCode: "NPR",
        value: item.value,
        type: item.type,
        displayOrder: item.displayOrder,
        isActive: true,
      },
    });
  }

  return tx.denomination.findMany({
    where: { businessId },
    orderBy: [{ displayOrder: "asc" }, { value: "desc" }],
  });
}

/**
 * Records normalized ShiftDenomination rows for OPENING or CLOSING stage.
 */
export async function saveShiftDenominationRows(params: {
  tx: any;
  businessId: string;
  shiftId: string;
  stage: "OPENING" | "CLOSING";
  rows: DenominationRow[];
}) {
  const { tx, businessId, shiftId, stage, rows } = params;
  const denominations = await ensureBusinessDenominations(businessId, tx);
  const denomByValue = new Map<number, string>();
  for (const d of denominations) {
    denomByValue.set(Number(d.value), d.id);
  }

  await tx.shiftDenomination.deleteMany({
    where: { shiftId, stage },
  });

  const records = [];
  for (const row of rows) {
    const qty = Math.max(0, Math.floor(Number(row.count) || 0));
    const val = Number(row.note);
    const subtotal = Number((val * qty).toFixed(2));
    const created = await tx.shiftDenomination.create({
      data: {
        businessId,
        shiftId,
        denominationId: denomByValue.get(val) ?? null,
        stage,
        denominationValue: val,
        quantity: qty,
        subtotal,
      },
    });
    records.push(created);
  }
  return records;
}

/**
 * Records an immutable audit log entry on a shift.
 */
export async function logShiftAudit(params: {
  tx?: any;
  businessId: string;
  branchId?: string | null;
  shiftId: string;
  action: string;
  entityType?: string;
  entityId?: string;
  oldValues?: unknown;
  newValues?: unknown;
  performedById: string;
  ipAddress?: string | null;
}) {
  const client = params.tx ?? db;
  return client.shiftAuditLog.create({
    data: {
      businessId: params.businessId,
      branchId: params.branchId ?? null,
      shiftId: params.shiftId,
      userId: params.performedById,
      action: params.action,
      entityType: params.entityType ?? "CashierShift",
      entityId: params.entityId ?? params.shiftId,
      oldValues: params.oldValues ? (params.oldValues as any) : undefined,
      newValues: params.newValues ? (params.newValues as any) : undefined,
      ipAddress: params.ipAddress ?? null,
    },
  });
}

/**
 * Role helpers according to Specification §8.1
 */
export function isManagerOrOwnerRole(role?: string | null): boolean {
  const r = String(role || "").toUpperCase();
  return r === "OWNER" || r === "ADMIN" || r === "SUPER_ADMIN" || r === "MANAGER";
}

export function isOwnerOrAdminRole(role?: string | null): boolean {
  const r = String(role || "").toUpperCase();
  return r === "OWNER" || r === "ADMIN" || r === "SUPER_ADMIN";
}

export function canViewAllBranchShifts(role?: string | null): boolean {
  const r = String(role || "").toUpperCase();
  return (
    r === "OWNER" ||
    r === "ADMIN" ||
    r === "SUPER_ADMIN" ||
    r === "MANAGER" ||
    r === "ACCOUNTANT" ||
    r === "VIEWER"
  );
}

/**
 * Computes real-time financial summary for a shift from committed sales, payments, and cash movements.
 * Follows Specification §3.1:
 * ExpectedCash = OpeningBalance + CashSales + CashIn - CashRefunds - CashOut
 * QR, Card, Bank, Credit, Room Charge are strictly excluded from physical cash drawer balance.
 */
export async function computeShiftFinancialSummary(shiftId: string, businessId: string, tx: any = db) {
  const shift = await tx.cashierShift.findFirst({
    where: { id: shiftId, businessId },
    include: {
      register: true,
      cashier: { select: { id: true, name: true, email: true, role: true } },
      closedBy: { select: { id: true, name: true, email: true, role: true } },
      branch: { select: { id: true, name: true } },
      cashMovements: {
        include: {
          user: { select: { id: true, name: true, role: true } },
          approvedBy: { select: { id: true, name: true, role: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      shiftDenominations: {
        orderBy: { denominationValue: "desc" },
      },
      shiftTransactions: {
        orderBy: { createdAt: "desc" },
      },
      shiftAdjustments: {
        include: {
          approvedBy: { select: { id: true, name: true, role: true } },
          createdBy: { select: { id: true, name: true, role: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!shift) return null;

  // 1. Aggregate completed sales linked to this shift
  const sales = await tx.sale.findMany({
    where: {
      shiftId: shift.id,
      businessId,
      status: { notIn: ["CANCELLED", "VOIDED", "DRAFT"] },
      isActive: true,
    },
    select: {
      id: true,
      invoiceNumber: true,
      total: true,
      paidAmount: true,
      paymentStatus: true,
      status: true,
      createdAt: true,
    },
  });

  // 2. Aggregate payments linked to this shift
  const payments = await tx.payment.findMany({
    where: {
      shiftId: shift.id,
      businessId,
    },
    select: {
      id: true,
      type: true,
      method: true,
      amount: true,
      cashTendered: true,
      changeReturned: true,
      reference: true,
      remarks: true,
      createdAt: true,
      saleId: true,
    },
  });

  let cashSales = 0;
  let qrSales = 0;
  let cardSales = 0;
  let bankSales = 0;
  let creditSales = 0;
  let otherNonCashSales = 0;
  let cashRefunds = 0;
  let nonCashRefunds = 0;

  for (const p of payments) {
    const amt = Number(p.amount) || 0;
    const method = String(p.method || "").toUpperCase();
    const type = String(p.type || "").toUpperCase();

    if (type === "RECEIVED") {
      if (method === "CASH") {
        cashSales += amt;
      } else if (
        method === "QR" ||
        method === "FONEPAY" ||
        method === "FONE_PAY" ||
        method === "ESEWA" ||
        method === "KHALTI" ||
        method === "NEPAL_PAY" ||
        method === "NEPALPAY" ||
        method === "MOBILE_MONEY"
      ) {
        qrSales += amt;
      } else if (method === "CARD" || method === "POS_CARD") {
        cardSales += amt;
      } else if (method === "BANK" || method === "BANK_TRANSFER" || method === "CHEQUE") {
        bankSales += amt;
      } else if (method === "CREDIT" || method === "ROOM_CHARGE") {
        creditSales += amt;
      } else {
        otherNonCashSales += amt;
      }
    } else if (type === "SENT" || type === "REFUND") {
      // CRITICAL SPEC RULE §3.1: Only physical CASH refunds reduce Expected Cash!
      if (method === "CASH") {
        cashRefunds += amt;
      } else {
        nonCashRefunds += amt;
      }
    }
  }

  // Also check if shift.cashRefunds was incremented directly (e.g. from credit notes or reversals)
  const recordedShiftCashRefunds = Number(shift.cashRefunds) || 0;
  if (recordedShiftCashRefunds > cashRefunds) {
    cashRefunds = recordedShiftCashRefunds;
  }

  // Fallback to shift.cashSales if no payment rows exist
  const recordedShiftCashSales = Number(shift.cashSales) || 0;
  if (payments.length === 0 && recordedShiftCashSales > 0) {
    cashSales = recordedShiftCashSales;
  }

  // Calculate credit/unpaid portion from sales on this shift
  const totalSalesAmount = sales.reduce((acc: number, s: any) => acc + (Number(s.total) || 0), 0);
  const totalPaidOnSales = sales.reduce((acc: number, s: any) => acc + (Number(s.paidAmount) || 0), 0);
  const unpaidCreditFromSales = Math.max(0, Number((totalSalesAmount - totalPaidOnSales).toFixed(2)));
  if (unpaidCreditFromSales > creditSales) {
    creditSales = unpaidCreditFromSales;
  }

  // 3. Aggregate active (non-voided) cash movements
  let cashIn = 0;
  let cashOut = 0;
  for (const m of shift.cashMovements) {
    if (m.status === "VOIDED" || m.status === "REJECTED") continue;
    const amt = Number(m.amount) || 0;
    if (m.type === "CASH_IN") {
      cashIn += amt;
    } else if (m.type === "CASH_OUT") {
      cashOut += amt;
    }
  }

  // 4. Include post-close manager adjustments if any
  const adjustmentsTotal = (shift.shiftAdjustments || []).reduce(
    (acc: number, adj: any) => acc + (Number(adj.amount) || 0),
    0
  );

  const openingBalance = Number(shift.openingBalance) || 0;
  const expectedCash = calculateExpectedCash({
    openingBalance,
    cashSales,
    cashRefunds,
    cashIn,
    cashOut,
  });

  const nonCashSales = Number((qrSales + cardSales + bankSales + creditSales + otherNonCashSales).toFixed(2));
  const totalSales = Number((totalSalesAmount > 0 ? totalSalesAmount : cashSales + nonCashSales).toFixed(2));

  const actualCash = shift.actualCash !== null && shift.actualCash !== undefined ? Number(shift.actualCash) : null;
  const varianceInfo =
    actualCash !== null
      ? calculateCashDifference(actualCash, expectedCash)
      : null;

  return {
    shift,
    metrics: {
      openingBalance: Number(openingBalance.toFixed(2)),
      cashSales: Number(cashSales.toFixed(2)),
      qrSales: Number(qrSales.toFixed(2)),
      cardSales: Number(cardSales.toFixed(2)),
      bankSales: Number(bankSales.toFixed(2)),
      creditSales: Number(creditSales.toFixed(2)),
      otherNonCashSales: Number(otherNonCashSales.toFixed(2)),
      nonCashSales,
      totalSales,
      cashRefunds: Number(cashRefunds.toFixed(2)),
      nonCashRefunds: Number(nonCashRefunds.toFixed(2)),
      cashIn: Number(cashIn.toFixed(2)),
      cashOut: Number(cashOut.toFixed(2)),
      expectedCash,
      actualCash,
      cashVariance: varianceInfo ? varianceInfo.difference : null,
      varianceStatus: varianceInfo ? varianceInfo.status : "BALANCED",
      varianceLabel: varianceInfo ? varianceInfo.label : "Balanced",
      adjustmentsTotal: Number(adjustmentsTotal.toFixed(2)),
      salesCount: sales.length,
    },
  };
}
