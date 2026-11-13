import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse, safeErrorMessage } from "@/lib/api-helper";
import { canViewAllBranchShifts } from "@/lib/shift-service";

export async function GET(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  if (!canViewAllBranchShifts(context.role)) {
    return NextResponse.json(
      { error: "Forbidden: Insufficient permissions to view branch shift summary reports." },
      { status: 403 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get("branchId") || searchParams.get("branch_id") || context.branchId;
    const startDate = searchParams.get("startDate") || searchParams.get("start_date");
    const endDate = searchParams.get("endDate") || searchParams.get("end_date");

    const where: any = {
      businessId: context.businessId,
      ...(branchId ? { branchId } : {}),
    };

    if (startDate || endDate) {
      where.startTime = {};
      if (startDate) where.startTime.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.startTime.lte = end;
      }
    }

    const [agg, shortageAgg, excessAgg, openCount, closedCount] = await Promise.all([
      db.cashierShift.aggregate({
        where,
        _sum: {
          openingBalance: true,
          cashSales: true,
          nonCashSales: true,
          totalSales: true,
          cashRefunds: true,
          cashIn: true,
          cashOut: true,
          expectedCash: true,
          actualCash: true,
          cashDifference: true,
        },
        _count: { id: true },
      }),
      db.cashierShift.aggregate({
        where: { ...where, cashDifference: { lt: 0 } },
        _sum: { cashDifference: true },
        _count: { id: true },
      }),
      db.cashierShift.aggregate({
        where: { ...where, cashDifference: { gt: 0 } },
        _sum: { cashDifference: true },
        _count: { id: true },
      }),
      db.cashierShift.count({ where: { ...where, status: "OPEN" } }),
      db.cashierShift.count({ where: { ...where, status: { in: ["CLOSED", "FORCE_CLOSED"] } } }),
    ]);

    return NextResponse.json({
      summary: {
        totalShifts: agg._count.id || 0,
        openShifts: openCount,
        closedShifts: closedCount,
        totalOpeningBalance: Number(agg._sum.openingBalance || 0),
        totalCashSales: Number(agg._sum.cashSales || 0),
        totalNonCashSales: Number(agg._sum.nonCashSales || 0),
        totalSales: Number(agg._sum.totalSales || 0),
        totalCashRefunds: Number(agg._sum.cashRefunds || 0),
        totalCashIn: Number(agg._sum.cashIn || 0),
        totalCashOut: Number(agg._sum.cashOut || 0),
        totalExpectedCash: Number(agg._sum.expectedCash || 0),
        totalActualCash: Number(agg._sum.actualCash || 0),
        netVariance: Number(agg._sum.cashDifference || 0),
        shortageShiftsCount: shortageAgg._count.id || 0,
        totalShortageAmount: Math.abs(Number(shortageAgg._sum.cashDifference || 0)),
        excessShiftsCount: excessAgg._count.id || 0,
        totalExcessAmount: Number(excessAgg._sum.cashDifference || 0),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to fetch shift summary report") },
      { status: 500 }
    );
  }
}

