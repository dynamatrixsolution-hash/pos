import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse, safeErrorMessage } from "@/lib/api-helper";
import { canViewAllBranchShifts } from "@/lib/shift-service";

export async function GET(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  if (!canViewAllBranchShifts(context.role)) {
    return NextResponse.json(
      { error: "Forbidden: Insufficient permissions to view cash register reports." },
      { status: 403 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get("branchId") || searchParams.get("branch_id") || context.branchId;

    const registers = await db.cashRegister.findMany({
      where: {
        businessId: context.businessId,
        deletedAt: null,
        ...(branchId ? { branchId } : {}),
      },
      include: {
        branch: { select: { id: true, name: true } },
        shifts: {
          select: {
            id: true,
            shiftNumber: true,
            status: true,
            openingBalance: true,
            cashSales: true,
            nonCashSales: true,
            totalSales: true,
            expectedCash: true,
            actualCash: true,
            cashDifference: true,
            startTime: true,
            endTime: true,
            cashier: { select: { id: true, name: true } },
          },
          orderBy: { startTime: "desc" },
          take: 10,
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const report = registers.map((reg) => {
      const activeShift = reg.shifts.find((s) => s.status === "OPEN") || null;
      const totalCashSales = reg.shifts.reduce((sum, s) => sum + Number(s.cashSales || 0), 0);
      const totalSales = reg.shifts.reduce((sum, s) => sum + Number(s.totalSales || 0), 0);
      const totalVariance = reg.shifts.reduce((sum, s) => sum + Number(s.cashDifference || 0), 0);

      return {
        id: reg.id,
        name: reg.name,
        code: reg.code,
        branch: reg.branch,
        status: reg.status,
        isActive: reg.isActive,
        activeShift,
        recentShiftsCount: reg.shifts.length,
        totalCashSales: Number(totalCashSales.toFixed(2)),
        totalSales: Number(totalSales.toFixed(2)),
        totalVariance: Number(totalVariance.toFixed(2)),
      };
    });

    return NextResponse.json({ registers: report });
  } catch (error: any) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to fetch cash register report") },
      { status: 500 }
    );
  }
}

