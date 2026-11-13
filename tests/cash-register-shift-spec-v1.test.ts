import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@dynapos/db";
import {
  validateAndCalculateDenominations,
  calculateExpectedCash,
  calculateCashDifference,
} from "../backend/src/lib/denomination";
import {
  ensureBusinessDenominations,
  saveShiftDenominationRows,
  computeShiftFinancialSummary,
  logShiftAudit,
  canViewAllBranchShifts,
  isManagerOrOwnerRole,
} from "../backend/src/lib/shift-service";

describe("Prayassh POS & ERP — Cash Register & Shift Management Spec v1.0 QA Suite", () => {
  let businessId: string;
  let branchId: string;
  let managerId: string;
  let cashierAId: string;
  let cashierBId: string;
  let register1Id: string;
  let register2Id: string;

  beforeAll(async () => {
    const suffix = Date.now().toString();
    const business = await db.business.create({
      data: {
        name: `Spec v1 QA Business ${suffix}`,
        slug: `spec-qa-${suffix}`,
        email: `spec-qa-${suffix}@prayassh.com`,
        currency: "NPR",
      },
    });
    businessId = business.id;

    const branch = await db.branch.create({
      data: {
        businessId,
        name: "Main Branch Kathmandu",
        isMain: true,
      },
    });
    branchId = branch.id;

    const manager = await db.user.create({
      data: {
        businessId,
        branchId,
        name: "Manager Ram",
        email: `manager-${suffix}@prayassh.com`,
        passwordHash: "hashed_password",
        role: "MANAGER",
      },
    });
    managerId = manager.id;

    const cashierA = await db.user.create({
      data: {
        businessId,
        branchId,
        name: "Cashier Sita",
        email: `cashier-a-${suffix}@prayassh.com`,
        passwordHash: "hashed_password",
        role: "CASHIER",
      },
    });
    cashierAId = cashierA.id;

    const cashierB = await db.user.create({
      data: {
        businessId,
        branchId,
        name: "Cashier Hari",
        email: `cashier-b-${suffix}@prayassh.com`,
        passwordHash: "hashed_password",
        role: "CASHIER",
      },
    });
    cashierBId = cashierB.id;
  });

  afterAll(async () => {
    if (businessId) {
      await db.business.delete({ where: { id: businessId } }).catch(() => {});
    }
  });

  it("1. Seeds default NPR denominations (1000, 500, 100, 50, 20, 10, 5, 2, 1) for a business", async () => {
    const denoms = await ensureBusinessDenominations(businessId);
    expect(denoms.length).toBe(9);
    const values = denoms.map((d: any) => Number(d.value));
    expect(values).toEqual([1000, 500, 100, 50, 20, 10, 5, 2, 1]);
  });

  it("2. Enforces register creation and branch-unique register codes (Spec §2.1)", async () => {
    const reg1 = await db.cashRegister.create({
      data: {
        businessId,
        branchId,
        name: "Main Counter",
        code: "REG-01",
        description: "Front checkout counter",
        status: "CLOSED",
        isActive: true,
        createdById: managerId,
      },
    });
    register1Id = reg1.id;

    const reg2 = await db.cashRegister.create({
      data: {
        businessId,
        branchId,
        name: "Pharmacy Counter",
        code: "REG-02",
        status: "CLOSED",
        isActive: false, // Inactive initially to test Spec §2.1 rule
        createdById: managerId,
      },
    });
    register2Id = reg2.id;

    // Attempting duplicate register code in the same branch must fail at DB level
    await expect(
      db.cashRegister.create({
        data: {
          businessId,
          branchId,
          name: "Duplicate Code Counter",
          code: "REG-01",
          status: "CLOSED",
        },
      })
    ).rejects.toThrow();
  });

  it("3. Validates opening denomination counts and rejects negative, unsupported, or zero-total counts (Spec §2.2)", () => {
    // Empty input rejected
    expect(validateAndCalculateDenominations(null).valid).toBe(false);
    expect(validateAndCalculateDenominations([]).valid).toBe(false);

    // Zero total rejected when opening a shift
    const allZero = validateAndCalculateDenominations(
      [{ note: 1000, count: 0 }, { note: 500, count: 0 }],
      { requireNonZeroTotal: true }
    );
    expect(allZero.valid).toBe(false);

    // Negative quantity rejected
    const neg = validateAndCalculateDenominations([
      { note: 1000, count: -1 },
      { note: 500, count: 4 },
    ]);
    expect(neg.valid).toBe(false);

    // Unsupported denomination (e.g. 250) rejected
    const unsupported = validateAndCalculateDenominations([
      { note: 250, count: 2 },
    ]);
    expect(unsupported.valid).toBe(false);

    // Spec §2.2 Worked Example: 1000x2 + 500x4 + 100x10 = 5,000
    const validOpening = validateAndCalculateDenominations([
      { note: 1000, count: 2 },
      { note: 500, count: 4 },
      { note: 100, count: 10 },
      { note: 50, count: 0 },
      { note: 20, count: 0 },
      { note: 10, count: 0 },
    ]);
    expect(validOpening.valid).toBe(true);
    expect(validOpening.total).toBe(5000);
  });

  it("4. Opens a shift with mandatory denomination records and blocks a second active shift on the same register via DB partial unique index (Spec §1.3 & §6.3)", async () => {
    const openingDenoms = validateAndCalculateDenominations([
      { note: 1000, count: 2 },
      { note: 500, count: 4 },
      { note: 100, count: 10 },
    ]);
    expect(openingDenoms.total).toBe(5000);

    const shift1 = await db.$transaction(async (tx) => {
      const s = await tx.cashierShift.create({
        data: {
          businessId,
          branchId,
          registerId: register1Id,
          cashierId: cashierAId,
          shiftNumber: "SH-20261112-001",
          status: "OPEN",
          openingBalance: openingDenoms.total,
          expectedCash: openingDenoms.total,
          openingDenominations: openingDenoms.rows as any,
        },
      });

      await saveShiftDenominationRows({
        tx,
        businessId,
        shiftId: s.id,
        stage: "OPENING",
        rows: openingDenoms.rows,
      });

      await tx.cashRegister.update({
        where: { id: register1Id },
        data: { status: "OPEN", currentShiftId: s.id },
      });

      await logShiftAudit({
        tx,
        businessId,
        branchId,
        shiftId: s.id,
        action: "SHIFT_OPENED",
        newValues: { openingBalance: 5000 },
        performedById: cashierAId,
      });

      return s;
    });

    expect(Number(shift1.openingBalance)).toBe(5000);

    // Attempting to open a second OPEN shift on register1Id must fail due to uq_active_shift_per_register
    await expect(
      db.cashierShift.create({
        data: {
          businessId,
          branchId,
          registerId: register1Id,
          cashierId: cashierBId,
          shiftNumber: "SH-20261112-002",
          status: "OPEN",
          openingBalance: 1000,
          expectedCash: 1000,
        },
      })
    ).rejects.toThrow();
  });

  it("5. Reproduces the full Specification §3.1, §3.2, §3.3 & §3.5 financial reconciliation workflow", async () => {
    const activeShift = await db.cashierShift.findFirst({
      where: { registerId: register1Id, status: "OPEN" },
    });
    expect(activeShift).not.toBeNull();
    const shiftId = activeShift!.id;

    // Step A: Cash sale with change returned (Spec §3.3: Bill = 850, Tendered = 1000, Change = 150 -> Net Cash = 850)
    const sale1 = await db.sale.create({
      data: {
        businessId,
        branchId,
        userId: cashierAId,
        invoiceNumber: `INV-SPEC-1-${Date.now()}`,
        status: "COMPLETED",
        subtotal: 850,
        total: 850,
        paidAmount: 850,
        paymentStatus: "PAID",
        shiftId,
      },
    });
    const pay1 = await db.payment.create({
      data: {
        businessId,
        branchId,
        userId: cashierAId,
        saleId: sale1.id,
        amount: 850, // Net cash retained
        cashTendered: 1000,
        changeReturned: 150,
        method: "CASH",
        type: "RECEIVED",
        shiftId,
      },
    });
    await db.shiftTransaction.create({
      data: {
        businessId,
        branchId,
        shiftId,
        saleId: sale1.id,
        paymentId: pay1.id,
        transactionType: "SALE",
        paymentMethod: "CASH",
        amount: 850,
        cashTendered: 1000,
        changeReturned: 150,
        cashEffect: 850,
      },
    });

    // Step B: Remaining Cash sales (+9,150) + Split Payment sale (Spec §3.2: 2,000 Cash + 2,000 Fonepay QR + 1,000 Credit = 5,000) + Additional QR sale (+6,000)
    // Total Cash Sales = 850 + 9,150 + 2,000 = 12,000
    // Total QR Sales = 2,000 + 6,000 = 8,000
    const sale2 = await db.sale.create({
      data: {
        businessId,
        branchId,
        userId: cashierAId,
        invoiceNumber: `INV-SPEC-2-${Date.now()}`,
        status: "COMPLETED",
        subtotal: 9150,
        total: 9150,
        paidAmount: 9150,
        paymentStatus: "PAID",
        shiftId,
      },
    });
    await db.payment.create({
      data: {
        businessId,
        branchId,
        userId: cashierAId,
        saleId: sale2.id,
        amount: 9150,
        method: "CASH",
        type: "RECEIVED",
        shiftId,
      },
    });

    // Split payment sale (5,000 total: 2,000 CASH + 2,000 FONE_PAY + 1,000 unpaid CREDIT)
    const saleSplit = await db.sale.create({
      data: {
        businessId,
        branchId,
        userId: cashierAId,
        invoiceNumber: `INV-SPEC-SPLIT-${Date.now()}`,
        status: "COMPLETED",
        subtotal: 5000,
        total: 5000,
        paidAmount: 4000,
        paymentStatus: "PARTIAL",
        shiftId,
      },
    });
    await db.payment.create({
      data: {
        businessId,
        branchId,
        userId: cashierAId,
        saleId: saleSplit.id,
        amount: 2000,
        method: "CASH",
        type: "RECEIVED",
        shiftId,
      },
    });
    await db.payment.create({
      data: {
        businessId,
        branchId,
        userId: cashierAId,
        saleId: saleSplit.id,
        amount: 2000,
        method: "FONE_PAY",
        type: "RECEIVED",
        shiftId,
      },
    });

    // Additional QR sale of 6,000
    const saleQr = await db.sale.create({
      data: {
        businessId,
        branchId,
        userId: cashierAId,
        invoiceNumber: `INV-SPEC-QR-${Date.now()}`,
        status: "COMPLETED",
        subtotal: 6000,
        total: 6000,
        paidAmount: 6000,
        paymentStatus: "PAID",
        shiftId,
      },
    });
    await db.payment.create({
      data: {
        businessId,
        branchId,
        userId: cashierAId,
        saleId: saleQr.id,
        amount: 6000,
        method: "ESEWA",
        type: "RECEIVED",
        shiftId,
      },
    });

    // Step C: Cash Refund (-500) AND Non-Cash Refund (-300 via QR, which MUST NOT reduce expected cash!)
    await db.payment.create({
      data: {
        businessId,
        branchId,
        userId: cashierAId,
        saleId: sale2.id,
        amount: 500,
        method: "CASH",
        type: "SENT",
        shiftId,
      },
    });
    await db.payment.create({
      data: {
        businessId,
        branchId,
        userId: cashierAId,
        saleId: saleQr.id,
        amount: 300,
        method: "ESEWA",
        type: "SENT",
        shiftId,
      },
    });

    // Step D: Cash In (+1,000) and Cash Out (-2,000)
    await db.cashMovement.create({
      data: {
        businessId,
        branchId,
        shiftId,
        userId: managerId,
        movementNumber: "CM-20261112-0001",
        type: "CASH_IN",
        amount: 1000,
        reason: "Additional float from manager",
        status: "POSTED",
      },
    });
    await db.cashMovement.create({
      data: {
        businessId,
        branchId,
        shiftId,
        userId: cashierAId,
        movementNumber: "CM-20261112-0002",
        type: "CASH_OUT",
        amount: 2000,
        reason: "Safe drop to main vault",
        status: "POSTED",
      },
    });

    // Verify computed financial summary matches Specification §3.1 Worked Example!
    // Opening (5,000) + CashSales (12,000) + CashIn (1,000) - CashRefunds (500) - CashOut (2,000) = 15,500
    const summary = await computeShiftFinancialSummary(shiftId, businessId);
    expect(summary).not.toBeNull();
    expect(summary!.metrics.openingBalance).toBe(5000);
    expect(summary!.metrics.cashSales).toBe(12000);
    expect(summary!.metrics.qrSales).toBe(8000);
    expect(summary!.metrics.creditSales).toBe(1000);
    expect(summary!.metrics.nonCashSales).toBe(9000);
    expect(summary!.metrics.cashRefunds).toBe(500);
    expect(summary!.metrics.nonCashRefunds).toBe(300);
    expect(summary!.metrics.cashIn).toBe(1000);
    expect(summary!.metrics.cashOut).toBe(2000);
    expect(summary!.metrics.expectedCash).toBe(15500);

    // Step E: Close Shift with Spec §3.4 & §3.5 Denominations:
    // 1000x10 (10,000) + 500x8 (4,000) + 100x10 (1,000) = 15,000 Actual Cash
    // Variance = 15,000 - 15,500 = -500 (Shortage of NPR 500)
    const closingDenoms = validateAndCalculateDenominations([
      { note: 1000, count: 10 },
      { note: 500, count: 8 },
      { note: 100, count: 10 },
    ]);
    expect(closingDenoms.valid).toBe(true);
    expect(closingDenoms.total).toBe(15000);

    const variance = calculateCashDifference(closingDenoms.total, summary!.metrics.expectedCash);
    expect(variance.difference).toBe(-500);
    expect(variance.status).toBe("SHORTAGE");

    await db.$transaction(async (tx) => {
      await tx.cashierShift.update({
        where: { id: shiftId },
        data: {
          status: "CLOSED",
          endTime: new Date(),
          cashSales: summary!.metrics.cashSales,
          nonCashSales: summary!.metrics.nonCashSales,
          totalSales: summary!.metrics.totalSales,
          cashRefunds: summary!.metrics.cashRefunds,
          cashIn: summary!.metrics.cashIn,
          cashOut: summary!.metrics.cashOut,
          expectedCash: summary!.metrics.expectedCash,
          actualCash: closingDenoms.total,
          cashDifference: variance.difference,
          varianceReason: "Shortage of NPR 500 noted during evening handover count",
          declarationConfirmed: true,
          closingDenominations: closingDenoms.rows as any,
          closedById: cashierAId,
        },
      });

      await saveShiftDenominationRows({
        tx,
        businessId,
        shiftId,
        stage: "CLOSING",
        rows: closingDenoms.rows,
      });

      await tx.cashRegister.update({
        where: { id: register1Id },
        data: { status: "CLOSED", currentShiftId: null },
      });

      await logShiftAudit({
        tx,
        businessId,
        branchId,
        shiftId,
        action: "SHIFT_CLOSED",
        newValues: {
          expectedCash: 15500,
          actualCash: 15000,
          cashVariance: -500,
        },
        performedById: cashierAId,
      });
    });

    // Verify subsequent cashier B can now open a new shift on Register 01 after Cashier A's shift is CLOSED (Spec §1.3)
    const shift2 = await db.cashierShift.create({
      data: {
        businessId,
        branchId,
        registerId: register1Id,
        cashierId: cashierBId,
        shiftNumber: "SH-20261112-002",
        status: "OPEN",
        openingBalance: 3000,
        expectedCash: 3000,
      },
    });
    expect(shift2.status).toBe("OPEN");
  });

  it("6. Supports post-close manager adjustments without overwriting closed shift actual/expected values, and enforces RBAC helpers (Spec §3.5 & §8.1)", async () => {
    expect(canViewAllBranchShifts("CASHIER")).toBe(false);
    expect(canViewAllBranchShifts("MANAGER")).toBe(true);
    expect(canViewAllBranchShifts("OWNER")).toBe(true);
    expect(isManagerOrOwnerRole("CASHIER")).toBe(false);
    expect(isManagerOrOwnerRole("MANAGER")).toBe(true);

    const closedShift = await db.cashierShift.findFirst({
      where: { registerId: register1Id, status: "CLOSED" },
    });
    expect(closedShift).not.toBeNull();

    const adj = await db.shiftAdjustment.create({
      data: {
        businessId,
        branchId,
        shiftId: closedShift!.id,
        adjustmentType: "CORRECTION",
        amount: 500,
        reason: "Misplaced NPR 500 note found under till tray by manager",
        createdById: managerId,
        approvedById: managerId,
      },
    });
    expect(Number(adj.amount)).toBe(500);

    // Original closed shift figures remain intact for audit integrity
    const reloaded = await computeShiftFinancialSummary(closedShift!.id, businessId);
    expect(reloaded!.metrics.expectedCash).toBe(15500);
    expect(reloaded!.metrics.actualCash).toBe(15000);
    expect(reloaded!.metrics.cashVariance).toBe(-500);
    expect(reloaded!.metrics.adjustmentsTotal).toBe(500);
  });
});
