import { NextResponse } from "next/server";
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
      return NextResponse.json(
        { error: "Forbidden: You can only view your own shift summary." },
        { status: 403 }
      );
    }

    return NextResponse.json({
      shift_id: shift.id,
      shiftId: shift.id,
      shiftNumber: shift.shiftNumber,
      register_id: shift.registerId,
      registerId: shift.registerId,
      registerName: shift.register?.name,
      cashier_id: shift.cashierId,
      cashierId: shift.cashierId,
      cashierName: shift.cashier?.name,
      status: shift.status,
      opening_balance: metrics.openingBalance,
      openingBalance: metrics.openingBalance,
      cash_sales: metrics.cashSales,
      cashSales: metrics.cashSales,
      qr_sales: metrics.qrSales,
      qrSales: metrics.qrSales,
      card_sales: metrics.cardSales,
      cardSales: metrics.cardSales,
      bank_sales: metrics.bankSales,
      bankSales: metrics.bankSales,
      credit_sales: metrics.creditSales,
      creditSales: metrics.creditSales,
      non_cash_sales: metrics.nonCashSales,
      nonCashSales: metrics.nonCashSales,
      total_sales: metrics.totalSales,
      totalSales: metrics.totalSales,
      cash_refunds: metrics.cashRefunds,
      cashRefunds: metrics.cashRefunds,
      cash_in: metrics.cashIn,
      cashIn: metrics.cashIn,
      cash_out: metrics.cashOut,
      cashOut: metrics.cashOut,
      expected_cash: metrics.expectedCash,
      expectedCash: metrics.expectedCash,
      actual_cash: metrics.actualCash,
      actualCash: metrics.actualCash,
      cash_variance: metrics.cashVariance,
      cashVariance: metrics.cashVariance,
      varianceStatus: metrics.varianceStatus,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to fetch shift summary") },
      { status: 500 }
    );
  }
}

