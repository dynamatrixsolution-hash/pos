import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse, safeErrorMessage } from "@/lib/api-helper";
import { canViewAllBranchShifts, computeShiftFinancialSummary } from "@/lib/shift-service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  const { id } = await params;

  try {
    const result = await computeShiftFinancialSummary(id, context.businessId);
    if (!result) {
      return NextResponse.json({ error: "Shift not found" }, { status: 404 });
    }

    const { shift, metrics } = result;

    if (!canViewAllBranchShifts(context.role) && shift.cashierId !== context.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const business = await db.business.findUnique({
      where: { id: context.businessId },
      select: { name: true, address: true, phone: true, settings: true },
    });

    const openingDenominations = (shift.shiftDenominations || []).filter(
      (d: any) => d.stage === "OPENING"
    );
    const closingDenominations = (shift.shiftDenominations || []).filter(
      (d: any) => d.stage === "CLOSING"
    );

    const bizSettings = (business?.settings as any) || {};

    return NextResponse.json({
      report: {
        business: business
          ? {
              name: business.name,
              address: business.address,
              phone: business.phone,
              panNumber: bizSettings.panNumber || bizSettings.taxNumber || null,
            }
          : null,
        branch: shift.branch,
        register: shift.register,
        shiftNumber: shift.shiftNumber,
        status: shift.status,
        cashier: shift.cashier,
        closedBy: shift.closedBy,
        startTime: shift.startTime,
        endTime: shift.endTime,
        openingNotes: shift.openingNotes,
        closingNotes: shift.closingNotes,
        varianceReason: shift.varianceReason,
        declarationConfirmed: shift.declarationConfirmed,
        metrics,
        openingDenominations:
          openingDenominations.length > 0
            ? openingDenominations
            : shift.openingDenominations || [],
        closingDenominations:
          closingDenominations.length > 0
            ? closingDenominations
            : shift.closingDenominations || [],
        cashMovements: shift.cashMovements,
        adjustments: shift.shiftAdjustments,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to generate shift report") },
      { status: 500 }
    );
  }
}

