import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  getSessionContext,
  authErrorResponse,
  safeErrorMessage,
  getPaginationParams,
  paginationMeta,
} from "@/lib/api-helper";
import { canViewAllBranchShifts } from "@/lib/shift-service";

export async function GET(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const cashierId = searchParams.get("cashierId") || searchParams.get("cashier_id");
    const registerId = searchParams.get("registerId") || searchParams.get("register_id");
    const branchIdParam = searchParams.get("branchId") || searchParams.get("branch_id");
    const varianceStatus = (
      searchParams.get("varianceStatus") ||
      searchParams.get("variance_status") ||
      ""
    ).toUpperCase();
    const startDate = searchParams.get("startDate") || searchParams.get("start_date");
    const endDate = searchParams.get("endDate") || searchParams.get("end_date");
    const search = searchParams.get("search") || "";

    const { page, limit, skip, take } = getPaginationParams(request, 20, 100);

    const where: any = {
      businessId: context.businessId,
    };

    const effectiveBranchId = branchIdParam || context.branchId;
    if (effectiveBranchId) {
      where.branchId = effectiveBranchId;
    }

    // Specification §8.1 Permission Matrix: Cashiers can only view their own shift history
    if (!canViewAllBranchShifts(context.role)) {
      where.cashierId = context.userId;
    } else if (cashierId) {
      where.cashierId = cashierId;
    }

    if (status && ["OPEN", "CLOSED", "FORCE_CLOSED"].includes(status)) {
      where.status = status;
    }

    if (registerId) {
      where.registerId = registerId;
    }

    if (varianceStatus === "BALANCED") {
      where.cashDifference = 0;
    } else if (varianceStatus === "SHORTAGE") {
      where.cashDifference = { lt: 0 };
    } else if (varianceStatus === "EXCESS") {
      where.cashDifference = { gt: 0 };
    } else if (varianceStatus === "NON_ZERO" || varianceStatus === "VARIANCE") {
      where.AND = [
        ...(where.AND || []),
        { cashDifference: { not: null } },
        { NOT: { cashDifference: 0 } },
      ];
    }

    if (startDate || endDate) {
      where.startTime = {};
      if (startDate) where.startTime.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.startTime.lte = end;
      }
    }

    if (search) {
      where.OR = [
        { shiftNumber: { contains: search, mode: "insensitive" } },
        { register: { name: { contains: search, mode: "insensitive" } } },
        { register: { code: { contains: search, mode: "insensitive" } } },
        { cashier: { name: { contains: search, mode: "insensitive" } } },
      ];
    }

    const summaryScopeWhere: any = {
      businessId: context.businessId,
      ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
      ...(!canViewAllBranchShifts(context.role) ? { cashierId: context.userId } : {}),
    };

    const [total, shifts, summaryAgg, activeShiftsCount] = await Promise.all([
      db.cashierShift.count({ where }),
      db.cashierShift.findMany({
        where,
        skip,
        take,
        include: {
          branch: { select: { id: true, name: true } },
          register: { select: { id: true, name: true, code: true } },
          cashier: { select: { id: true, name: true, email: true, role: true } },
          closedBy: { select: { id: true, name: true, role: true } },
          _count: {
            select: {
              sales: true,
              payments: true,
              cashMovements: true,
              shiftAdjustments: true,
            },
          },
        },
        orderBy: { startTime: "desc" },
      }),
      db.cashierShift.aggregate({
        where: summaryScopeWhere,
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
      db.cashierShift.count({
        where: {
          ...summaryScopeWhere,
          status: "OPEN",
        },
      }),
    ]);

    return NextResponse.json({
      shifts,
      meta: paginationMeta(total, page, limit),
      summary: {
        totalShifts: summaryAgg._count.id || 0,
        activeShiftsCount,
        totalOpeningBalance: Number(summaryAgg._sum.openingBalance || 0),
        totalCashSales: Number(summaryAgg._sum.cashSales || 0),
        totalNonCashSales: Number(summaryAgg._sum.nonCashSales || 0),
        totalSales: Number(summaryAgg._sum.totalSales || 0),
        totalCashRefunds: Number(summaryAgg._sum.cashRefunds || 0),
        totalCashIn: Number(summaryAgg._sum.cashIn || 0),
        totalCashOut: Number(summaryAgg._sum.cashOut || 0),
        totalExpectedCash: Number(summaryAgg._sum.expectedCash || 0),
        totalActualCash: Number(summaryAgg._sum.actualCash || 0),
        netDifference: Number(summaryAgg._sum.cashDifference || 0),
      },
    });
  } catch (error: any) {
    console.error("GET shifts error:", error);
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to fetch shifts") },
      { status: 500 }
    );
  }
}
