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
    const summaryResult = await computeShiftFinancialSummary(id, context.businessId);
    if (!summaryResult) {
      return NextResponse.json({ error: "Shift not found." }, { status: 404 });
    }

    const { shift: baseShift, metrics } = summaryResult;

    // Specification §8.1: Cashiers can only inspect their own shifts
    if (!canViewAllBranchShifts(context.role) && baseShift.cashierId !== context.userId) {
      return NextResponse.json(
        { error: "Forbidden: You do not have permission to view another cashier's shift." },
        { status: 403 }
      );
    }

    const [sales, payments, auditLogs] = await Promise.all([
      db.sale.findMany({
        where: { shiftId: id, businessId: context.businessId },
        select: {
          id: true,
          invoiceNumber: true,
          total: true,
          paidAmount: true,
          paymentStatus: true,
          status: true,
          createdAt: true,
          customer: { select: { id: true, name: true, phone: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      db.payment.findMany({
        where: { shiftId: id, businessId: context.businessId },
        select: {
          id: true,
          amount: true,
          cashTendered: true,
          changeReturned: true,
          method: true,
          type: true,
          reference: true,
          receiptNumber: true,
          createdAt: true,
          saleId: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      db.shiftAuditLog.findMany({
        where: { shiftId: id, businessId: context.businessId },
        include: {
          user: { select: { id: true, name: true, email: true, role: true } },
        },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    const paymentMethodsSummary: Record<string, number> = {};
    for (const payment of payments) {
      if (payment.type === "RECEIVED") {
        const method = payment.method || "CASH";
        paymentMethodsSummary[method] =
          (paymentMethodsSummary[method] || 0) + Number(payment.amount);
      }
    }

    const openingDenominationsList = (baseShift.shiftDenominations || []).filter(
      (d: any) => d.stage === "OPENING"
    );
    const closingDenominationsList = (baseShift.shiftDenominations || []).filter(
      (d: any) => d.stage === "CLOSING"
    );

    return NextResponse.json({
      shift: {
        ...baseShift,
        sales,
        payments,
        shiftAuditLogs: auditLogs,
        openingDenominationsList,
        closingDenominationsList,
      },
      metrics,
      paymentMethodsSummary,
    });
  } catch (error: any) {
    console.error("GET shift by id error:", error);
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to fetch shift details") },
      { status: 500 }
    );
  }
}
