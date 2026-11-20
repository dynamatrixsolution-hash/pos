import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse, safeErrorMessage, requireRoles, ROLE_GROUPS } from "@/lib/api-helper";
import {
  validateAndCalculateDenominations,
  calculateCashDifference,
} from "@/lib/denomination";
import {
  ensureBusinessDenominations,
  saveShiftDenominationRows,
  computeShiftFinancialSummary,
  logShiftAudit,
  isManagerOrOwnerRole,
} from "@/lib/shift-service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();
  const denied = requireRoles(context, ROLE_GROUPS.SHIFT_OPERATORS);
  if (denied) return denied;

  const { id } = await params;

  try {
    const body = await request.json();

    const rawDenominations =
      body.closingDenominations ??
      body.closing_denominations ??
      body.denominations;
    const varianceReasonRaw =
      body.varianceReason ??
      body.variance_reason ??
      null;
    const closingNotesRaw =
      body.closingNotes ??
      body.closing_notes ??
      body.notes ??
      null;
    const declarationConfirmed = Boolean(
      body.declarationConfirmed ?? body.declaration_confirmed
    );
    const forceClose = Boolean(body.forceClose ?? body.force_close);

    // Retrieve shift and live financial summary
    const summary = await computeShiftFinancialSummary(id, context.businessId);

    if (!summary) {
      return NextResponse.json({ error: "Shift record not found." }, { status: 404 });
    }

    const { shift, metrics } = summary;

    if (shift.status !== "OPEN") {
      return NextResponse.json(
        { error: `Shift ${shift.shiftNumber} is already closed and cannot be modified.` },
        { status: 409 }
      );
    }

    // Cashier can close own shift; Managers/Owners/SuperAdmins can close any shift
    const isOwnerOrManager = isManagerOrOwnerRole(context.role);
    if (!isOwnerOrManager && shift.cashierId !== context.userId) {
      return NextResponse.json(
        { error: "Forbidden: You can only close your own active cashier shift." },
        { status: 403 }
      );
    }

    // Specification §4.4: Check pending/unresolved transactions on this shift
    if (!forceClose) {
      const [pendingSalesCount, pendingOrdersCount] = await Promise.all([
        db.sale.count({
          where: {
            businessId: context.businessId,
            shiftId: shift.id,
            status: { in: ["DRAFT", "ON_HOLD", "PENDING"] },
            deletedAt: null,
          },
        }),
        db.restaurantOrder.count({
          where: {
            businessId: context.businessId,
            shiftId: shift.id,
            settlementStatus: { not: "PAID" },
            fulfillmentStatus: { not: "CANCELLED" },
            acceptanceStatus: { not: "REJECTED" },
          },
        }),
      ]);

      if (pendingSalesCount > 0 || pendingOrdersCount > 0) {
        return NextResponse.json(
          {
            error: `Cannot close shift while there are ${pendingSalesCount + pendingOrdersCount} unresolved or pending transactions on this shift. Please settle or cancel pending transactions first.`,
            pendingSalesCount,
            pendingOrdersCount,
          },
          { status: 409 }
        );
      }
    }

    // Specification §3.4 & §12.1: Closing denomination is mandatory; actualCash is calculated strictly on the server
    const activeDenoms = await ensureBusinessDenominations(context.businessId);
    const supportedValues = activeDenoms
      .filter((d: any) => d.isActive)
      .map((d: any) => Number(d.value));

    const denomValidation = validateAndCalculateDenominations(rawDenominations, {
      requireNonZeroTotal: false,
      supportedValues: supportedValues.length > 0 ? supportedValues : undefined,
    });

    if (!denomValidation.valid) {
      return NextResponse.json(
        {
          error:
            denomValidation.error ||
            "Closing denomination count is mandatory to close a shift.",
        },
        { status: 400 }
      );
    }

    const actualCash = denomValidation.total;
    const denominationRows = denomValidation.rows;
    const expectedCash = metrics.expectedCash;

    const { difference: cashDifference, status: diffStatus, label: diffLabel } =
      calculateCashDifference(actualCash, expectedCash);

    // Specification §3.5: A reason is required if variance is non-zero
    const effectiveVarianceReason = (varianceReasonRaw || closingNotesRaw || "").trim();
    if (Math.abs(cashDifference) >= 0.01 && effectiveVarianceReason.length < 3) {
      return NextResponse.json(
        {
          error: `A variance reason is required because there is a ${diffLabel} (Expected: NPR ${expectedCash.toLocaleString()}, Actual: NPR ${actualCash.toLocaleString()}).`,
          expectedCash,
          actualCash,
          cashDifference,
          status: diffStatus,
        },
        { status: 400 }
      );
    }

    // Specification §3.5 & §7.4.5: Cashier must confirm the closing declaration
    if (!declarationConfirmed) {
      return NextResponse.json(
        {
          error:
            "You must confirm the closing cash declaration before closing the shift.",
        },
        { status: 400 }
      );
    }

    // Atomic update of shift, closing denominations, register closure, and audit log
    const closedShift = await db.$transaction(async (tx) => {
      const updated = await tx.cashierShift.update({
        where: { id: shift.id },
        data: {
          status: forceClose && shift.cashierId !== context.userId ? "FORCE_CLOSED" : "CLOSED",
          endTime: new Date(),
          cashSales: metrics.cashSales,
          nonCashSales: metrics.nonCashSales,
          totalSales: metrics.totalSales,
          cashRefunds: metrics.cashRefunds,
          cashIn: metrics.cashIn,
          cashOut: metrics.cashOut,
          expectedCash,
          actualCash,
          cashDifference,
          varianceReason: Math.abs(cashDifference) >= 0.01 ? effectiveVarianceReason : (varianceReasonRaw ? String(varianceReasonRaw).trim() : null),
          closingNotes: closingNotesRaw ? String(closingNotesRaw).trim() : null,
          declarationConfirmed: true,
          closingDenominations: denominationRows as any,
          closedById: context.userId,
        },
        include: {
          register: { select: { id: true, name: true, code: true } },
          cashier: { select: { id: true, name: true, email: true, role: true } },
          closedBy: { select: { id: true, name: true, email: true, role: true } },
          branch: { select: { id: true, name: true } },
        },
      });

      const savedClosingDenoms = await saveShiftDenominationRows({
        tx,
        businessId: context.businessId,
        shiftId: shift.id,
        stage: "CLOSING",
        rows: denominationRows,
      });

      await tx.cashRegister.update({
        where: { id: shift.registerId },
        data: {
          status: "CLOSED",
          currentShiftId: null,
        },
      });

      await logShiftAudit({
        tx,
        businessId: context.businessId,
        branchId: shift.branchId,
        shiftId: shift.id,
        action: "SHIFT_CLOSED",
        entityType: "CashierShift",
        entityId: shift.id,
        oldValues: {
          status: "OPEN",
          expectedCash,
        },
        newValues: {
          status: updated.status,
          expectedCash,
          actualCash,
          cashDifference,
          varianceStatus: diffStatus,
          varianceReason: updated.varianceReason,
          closingNotes: updated.closingNotes,
          declarationConfirmed: true,
          closingDenominations: denominationRows,
        },
        performedById: context.userId,
      });

      return {
        ...updated,
        shiftDenominations: savedClosingDenoms,
      };
    });

    return NextResponse.json({
      message: `Shift closed successfully. ${diffLabel}`,
      shift: closedShift,
      reconciliation: {
        openingBalance: metrics.openingBalance,
        cashSales: metrics.cashSales,
        qrSales: metrics.qrSales,
        cardSales: metrics.cardSales,
        bankSales: metrics.bankSales,
        creditSales: metrics.creditSales,
        nonCashSales: metrics.nonCashSales,
        totalSales: metrics.totalSales,
        cashRefunds: metrics.cashRefunds,
        cashIn: metrics.cashIn,
        cashOut: metrics.cashOut,
        expectedCash,
        actualCash,
        cashDifference,
        cashVariance: cashDifference,
        varianceReason: closedShift.varianceReason,
        declarationConfirmed: closedShift.declarationConfirmed,
        status: diffStatus,
        label: diffLabel,
      },
    });
  } catch (error: any) {
    console.error("POST close shift error:", error);
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to close shift") },
      { status: 500 }
    );
  }
}
