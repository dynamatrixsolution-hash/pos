import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse, safeErrorMessage } from "@/lib/api-helper";
import { computeShiftFinancialSummary } from "@/lib/shift-service";

export async function GET(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  try {
    const { searchParams } = new URL(request.url);
    const registerId = searchParams.get("registerId") || searchParams.get("register_id");

    const whereClause: any = {
      businessId: context.businessId,
      status: "OPEN",
    };

    if (context.branchId) {
      whereClause.branchId = context.branchId;
    }

    if (registerId) {
      whereClause.registerId = registerId;
    } else {
      whereClause.cashierId = context.userId;
    }

    let shiftRecord = await db.cashierShift.findFirst({
      where: whereClause,
      orderBy: { startTime: "desc" },
    });

    // If cashier didn't open the shift directly, check if there is an active shift on the branch's register
    if (!shiftRecord && !registerId && context.branchId) {
      shiftRecord = await db.cashierShift.findFirst({
        where: {
          businessId: context.businessId,
          branchId: context.branchId,
          status: "OPEN",
        },
        orderBy: { startTime: "desc" },
      });
    }

    if (!shiftRecord) {
      return NextResponse.json({
        hasActiveShift: false,
        shift: null,
      });
    }

    const summary = await computeShiftFinancialSummary(shiftRecord.id, context.businessId);
    if (!summary) {
      return NextResponse.json({
        hasActiveShift: false,
        shift: null,
      });
    }

    const { shift, metrics } = summary;

    // Recent 15 sales in this shift
    const recentSalesRaw = await db.sale.findMany({
      where: {
        businessId: context.businessId,
        shiftId: shift.id,
      },
      select: {
        id: true,
        invoiceNumber: true,
        total: true,
        paidAmount: true,
        paymentStatus: true,
        status: true,
        createdAt: true,
        customer: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 15,
    });

    const recentSales = recentSalesRaw.map((s) => ({
      ...s,
      total: Number(s.total),
    }));

    return NextResponse.json({
      hasActiveShift: true,
      shift: {
        ...shift,
        liveMetrics: {
          openingBalance: metrics.openingBalance,
          cashSales: metrics.cashSales,
          qrSales: metrics.qrSales,
          cardSales: metrics.cardSales,
          bankSales: metrics.bankSales,
          creditSales: metrics.creditSales,
          otherNonCashSales: metrics.otherNonCashSales,
          nonCashSales: metrics.nonCashSales,
          totalSales: metrics.totalSales,
          cashRefunds: metrics.cashRefunds,
          nonCashRefunds: metrics.nonCashRefunds,
          cashIn: metrics.cashIn,
          cashOut: metrics.cashOut,
          expectedCash: metrics.expectedCash,
          totalTransactions: metrics.salesCount,
        },
        recentSales,
      },
    });
  } catch (error: any) {
    console.error("GET current shift error:", error);
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to fetch current shift") },
      { status: 500 }
    );
  }
}
