import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse, safeErrorMessage } from "@/lib/api-helper";
import { validateAndCalculateDenominations } from "@/lib/denomination";
import {
  ensureBusinessDenominations,
  saveShiftDenominationRows,
  logShiftAudit,
  isManagerOrOwnerRole,
} from "@/lib/shift-service";

export async function POST(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  try {
    const body = await request.json();

    const registerId = body.registerId || body.register_id;
    const rawDenominations =
      body.openingDenominations ??
      body.opening_denominations ??
      body.denominations;
    const openingNotes = body.openingNotes ?? body.opening_notes ?? body.notes ?? null;

    if (!registerId || typeof registerId !== "string") {
      return NextResponse.json(
        { error: "Valid register ID is required to open a shift." },
        { status: 400 }
      );
    }

    // Load active supported denominations for this business
    const activeDenoms = await ensureBusinessDenominations(context.businessId);
    const supportedValues = activeDenoms
      .filter((d: any) => d.isActive)
      .map((d: any) => Number(d.value));

    // Mandatory Denomination Validation (Specification §2.2)
    // - Denomination entries cannot contain negative quantities
    // - Only supported denominations can be selected
    // - At least one denomination quantity must be greater than zero
    // - Opening balance must be greater than zero
    // - Opening balance cannot be manually overridden (strictly server-calculated)
    const denomValidation = validateAndCalculateDenominations(rawDenominations, {
      requireNonZeroTotal: true,
      supportedValues: supportedValues.length > 0 ? supportedValues : undefined,
    });

    if (!denomValidation.valid) {
      return NextResponse.json(
        {
          error: denomValidation.error || "Valid opening denomination count is required.",
        },
        { status: 400 }
      );
    }

    const calculatedOpeningBalance = denomValidation.total;
    const denominationRows = denomValidation.rows;

    // Verify register exists and belongs to this business
    const register = await db.cashRegister.findFirst({
      where: {
        id: registerId,
        businessId: context.businessId,
        deletedAt: null,
      },
      include: {
        assignedUsers: true,
      },
    });

    if (!register) {
      return NextResponse.json(
        { error: "Cash register not found." },
        { status: 404 }
      );
    }

    // Specification §2.1 & §2.2: Inactive registers cannot open new shifts
    if (!register.isActive) {
      return NextResponse.json(
        { error: `Register "${register.name}" is currently inactive and cannot open a shift.` },
        { status: 400 }
      );
    }

    // Specification §2.1 & §2.2: Validate branch access
    if (
      context.branchId &&
      register.branchId !== context.branchId &&
      !isManagerOrOwnerRole(context.role)
    ) {
      return NextResponse.json(
        { error: "Forbidden: You do not have permission to open a register in another branch." },
        { status: 403 }
      );
    }

    // Specification §2.1: If register has explicit assignedUsers, verify cashier is assigned (managers/owners bypass)
    if (
      register.assignedUsers &&
      register.assignedUsers.length > 0 &&
      !isManagerOrOwnerRole(context.role)
    ) {
      const isAssigned = register.assignedUsers.some(
        (assignment) => assignment.userId === context.userId
      );
      if (!isAssigned) {
        return NextResponse.json(
          { error: `Forbidden: You are not assigned to operate register "${register.name}".` },
          { status: 403 }
        );
      }
    }

    // Check if register already has an active shift
    const existingRegisterShift = await db.cashierShift.findFirst({
      where: {
        registerId,
        businessId: context.businessId,
        status: "OPEN",
      },
      include: {
        cashier: { select: { id: true, name: true, role: true } },
      },
    });

    if (existingRegisterShift || (register.status === "OPEN" && register.currentShiftId)) {
      const holderName = existingRegisterShift?.cashier?.name || "another cashier";
      return NextResponse.json(
        {
          error: `Register "${register.name}" already has an active open shift operated by ${holderName}. A register can only have one active shift at a time.`,
        },
        { status: 409 }
      );
    }

    // Check if this cashier already has an open shift on any register
    const existingCashierShift = await db.cashierShift.findFirst({
      where: {
        businessId: context.businessId,
        cashierId: context.userId,
        status: "OPEN",
      },
      include: { register: { select: { name: true } } },
    });

    if (existingCashierShift) {
      return NextResponse.json(
        {
          error: `You already have an active open shift on register "${existingCashierShift.register.name}". Please close that shift before opening a new one.`,
        },
        { status: 409 }
      );
    }

    const branchId = register.branchId || context.branchId;
    if (!branchId) {
      return NextResponse.json(
        { error: "Branch ID could not be determined for register." },
        { status: 400 }
      );
    }

    // Execute atomic shift creation, denomination recording, and register locking
    const newShift = await db.$transaction(async (tx) => {
      // 1. Concurrency Check & Row Lock: Atomically claim the register ONLY if it is currently CLOSED and active
      const lockResult = await tx.cashRegister.updateMany({
        where: {
          id: registerId,
          businessId: context.businessId,
          deletedAt: null,
          isActive: true,
          status: "CLOSED",
        },
        data: {
          status: "OPEN",
        },
      });

      if (lockResult.count === 0) {
        const activeRegisterShift = await tx.cashierShift.findFirst({
          where: {
            registerId,
            status: "OPEN",
          },
          include: { cashier: { select: { name: true } } },
        });
        const activeCashierName = activeRegisterShift?.cashier?.name || "another cashier";
        throw new Error(
          `CONFLICT:Register "${register.name}" has already been opened by ${activeCashierName}. A register can only run one active shift at a time.`
        );
      }

      // 2. Generate Unique Sequential Shift Number for today: e.g. SH-20261112-001
      const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const shiftCountToday = await tx.cashierShift.count({
        where: {
          businessId: context.businessId,
          shiftNumber: { startsWith: `SH-${todayStr}` },
        },
      });
      const shiftNumber = `SH-${todayStr}-${String(shiftCountToday + 1).padStart(3, "0")}`;

      // 3. Create CashierShift record with server-calculated openingBalance
      const shift = await tx.cashierShift.create({
        data: {
          businessId: context.businessId,
          branchId,
          registerId,
          cashierId: context.userId,
          shiftNumber,
          status: "OPEN",
          openingBalance: calculatedOpeningBalance,
          expectedCash: calculatedOpeningBalance,
          openingNotes: openingNotes ? String(openingNotes).trim() : null,
          openingDenominations: denominationRows as any,
        },
        include: {
          register: { select: { id: true, name: true, code: true } },
          cashier: { select: { id: true, name: true, email: true, role: true } },
          branch: { select: { id: true, name: true } },
        },
      });

      // 4. Save normalized ShiftDenomination rows (stage: OPENING)
      const savedDenoms = await saveShiftDenominationRows({
        tx,
        businessId: context.businessId,
        shiftId: shift.id,
        stage: "OPENING",
        rows: denominationRows,
      });

      // 5. Link the newly created shift to the register
      await tx.cashRegister.update({
        where: { id: registerId },
        data: {
          currentShiftId: shift.id,
        },
      });

      // 6. Record ShiftAuditLog (SHIFT_OPENED)
      await logShiftAudit({
        tx,
        businessId: context.businessId,
        branchId,
        shiftId: shift.id,
        action: "SHIFT_OPENED",
        entityType: "CashierShift",
        entityId: shift.id,
        newValues: {
          shiftNumber,
          registerId,
          registerName: register.name,
          openingBalance: calculatedOpeningBalance,
          openingDenominations: denominationRows,
          openingNotes: shift.openingNotes,
        },
        performedById: context.userId,
      });

      return {
        ...shift,
        shiftDenominations: savedDenoms,
      };
    });

    return NextResponse.json(
      {
        message: "Shift opened successfully.",
        shift: newShift,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("POST open shift error:", error);
    const msg = String(error?.message || "");
    if (msg.startsWith("CONFLICT:") || error?.code === "P2002") {
      return NextResponse.json(
        { error: msg.replace(/^CONFLICT:/, "") || "This register already has an active open shift." },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to open shift") },
      { status: 500 }
    );
  }
}
