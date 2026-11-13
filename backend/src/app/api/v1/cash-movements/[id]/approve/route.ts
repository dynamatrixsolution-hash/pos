import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse, safeErrorMessage } from "@/lib/api-helper";
import { isManagerOrOwnerRole, logShiftAudit } from "@/lib/shift-service";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  if (!isManagerOrOwnerRole(context.role)) {
    return NextResponse.json(
      { error: "Forbidden: Only managers or business owners can approve cash movements." },
      { status: 403 }
    );
  }

  const { id } = await params;

  try {
    const movement = await db.cashMovement.findFirst({
      where: { id, businessId: context.businessId },
    });

    if (!movement) {
      return NextResponse.json({ error: "Cash movement not found" }, { status: 404 });
    }

    if (movement.status === "VOIDED") {
      return NextResponse.json(
        { error: "Cannot approve a voided cash movement." },
        { status: 400 }
      );
    }

    const updated = await db.$transaction(async (tx) => {
      const m = await tx.cashMovement.update({
        where: { id: movement.id },
        data: {
          approvedById: context.userId,
          status: "POSTED",
        },
        include: {
          user: { select: { id: true, name: true, role: true } },
          approvedBy: { select: { id: true, name: true, role: true } },
        },
      });

      await logShiftAudit({
        tx,
        businessId: context.businessId,
        branchId: movement.branchId,
        shiftId: movement.shiftId,
        action: "CASH_MOVEMENT_APPROVED",
        entityType: "CashMovement",
        entityId: movement.id,
        oldValues: { status: movement.status, approvedById: movement.approvedById },
        newValues: { status: "POSTED", approvedById: context.userId },
        performedById: context.userId,
      });

      return m;
    });

    return NextResponse.json({
      message: "Cash movement approved successfully.",
      movement: updated,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to approve cash movement") },
      { status: 500 }
    );
  }
}

