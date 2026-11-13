import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse, safeErrorMessage } from "@/lib/api-helper";
import { isManagerOrOwnerRole, logShiftAudit } from "@/lib/shift-service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  if (!isManagerOrOwnerRole(context.role)) {
    return NextResponse.json(
      { error: "Forbidden: Only managers or business owners can void cash movements." },
      { status: 403 }
    );
  }

  const { id } = await params;

  try {
    const body = await request.json().catch(() => ({}));
    const voidReason = body.reason || "Voided by manager";

    const movement = await db.cashMovement.findFirst({
      where: { id, businessId: context.businessId },
      include: { shift: true },
    });

    if (!movement) {
      return NextResponse.json({ error: "Cash movement not found" }, { status: 404 });
    }

    if (movement.status === "VOIDED") {
      return NextResponse.json(
        { error: "Cash movement is already voided." },
        { status: 409 }
      );
    }

    if (movement.shift.status !== "OPEN") {
      return NextResponse.json(
        { error: "Cannot void cash movement on a closed shift. Use shift adjustment instead." },
        { status: 400 }
      );
    }

    const amt = Number(movement.amount);

    const updated = await db.$transaction(async (tx) => {
      // Mark movement VOIDED (never delete per Specification §2.5: Cash movements cannot be silently deleted)
      const m = await tx.cashMovement.update({
        where: { id: movement.id },
        data: {
          status: "VOIDED",
          description: movement.description
            ? `${movement.description} [VOIDED: ${voidReason}]`
            : `[VOIDED: ${voidReason}]`,
        },
        include: {
          user: { select: { id: true, name: true, role: true } },
          approvedBy: { select: { id: true, name: true, role: true } },
        },
      });

      // Reverse the financial effect on the shift
      if (movement.type === "CASH_IN") {
        await tx.cashierShift.update({
          where: { id: movement.shiftId },
          data: {
            cashIn: { decrement: amt },
            expectedCash: { decrement: amt },
          },
        });
      } else {
        await tx.cashierShift.update({
          where: { id: movement.shiftId },
          data: {
            cashOut: { decrement: amt },
            expectedCash: { increment: amt },
          },
        });
      }

      await logShiftAudit({
        tx,
        businessId: context.businessId,
        branchId: movement.branchId,
        shiftId: movement.shiftId,
        action: "CASH_MOVEMENT_VOIDED",
        entityType: "CashMovement",
        entityId: movement.id,
        oldValues: { status: movement.status, amount: amt, type: movement.type },
        newValues: { status: "VOIDED", voidReason },
        performedById: context.userId,
      });

      return m;
    });

    return NextResponse.json({
      message: "Cash movement voided successfully.",
      movement: updated,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to void cash movement") },
      { status: 500 }
    );
  }
}

