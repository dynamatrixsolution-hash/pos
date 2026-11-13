import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse, safeErrorMessage } from "@/lib/api-helper";
import { canViewAllBranchShifts } from "@/lib/shift-service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  const { id } = await params;

  try {
    const shift = await db.cashierShift.findFirst({
      where: { id, businessId: context.businessId },
      select: {
        id: true,
        shiftNumber: true,
        cashierId: true,
        openingBalance: true,
        actualCash: true,
        openingDenominations: true,
        closingDenominations: true,
        shiftDenominations: {
          orderBy: { denominationValue: "desc" },
        },
      },
    });

    if (!shift) {
      return NextResponse.json({ error: "Shift not found" }, { status: 404 });
    }

    if (!canViewAllBranchShifts(context.role) && shift.cashierId !== context.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const opening = shift.shiftDenominations.filter((d) => d.stage === "OPENING");
    const closing = shift.shiftDenominations.filter((d) => d.stage === "CLOSING");

    return NextResponse.json({
      shiftId: shift.id,
      shiftNumber: shift.shiftNumber,
      openingBalance: Number(shift.openingBalance),
      actualCash: shift.actualCash !== null ? Number(shift.actualCash) : null,
      openingDenominations: opening.length > 0 ? opening : (shift.openingDenominations || []),
      closingDenominations: closing.length > 0 ? closing : (shift.closingDenominations || []),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to fetch shift denominations") },
      { status: 500 }
    );
  }
}

