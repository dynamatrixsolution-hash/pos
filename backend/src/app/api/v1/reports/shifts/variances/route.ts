import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse, safeErrorMessage } from "@/lib/api-helper";
import { canViewAllBranchShifts } from "@/lib/shift-service";

export async function GET(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  if (!canViewAllBranchShifts(context.role)) {
    return NextResponse.json(
      { error: "Forbidden: Insufficient permissions to view shift variance reports." },
      { status: 403 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get("branchId") || searchParams.get("branch_id") || context.branchId;
    const registerId = searchParams.get("registerId") || searchParams.get("register_id");
    const cashierId = searchParams.get("cashierId") || searchParams.get("cashier_id");
    const type = (searchParams.get("type") || "ALL").toUpperCase(); // SHORTAGE, EXCESS, ALL
    const startDate = searchParams.get("startDate") || searchParams.get("start_date");
    const endDate = searchParams.get("endDate") || searchParams.get("end_date");

    const where: any = {
      businessId: context.businessId,
      status: { in: ["CLOSED", "FORCE_CLOSED"] },
      ...(branchId ? { branchId } : {}),
      ...(registerId ? { registerId } : {}),
      ...(cashierId ? { cashierId } : {}),
    };

    if (type === "SHORTAGE") {
      where.cashDifference = { lt: 0 };
    } else if (type === "EXCESS") {
      where.cashDifference = { gt: 0 };
    } else {
      where.AND = [
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

    const variances = await db.cashierShift.findMany({
      where,
      include: {
        branch: { select: { id: true, name: true } },
        register: { select: { id: true, name: true, code: true } },
        cashier: { select: { id: true, name: true, email: true, role: true } },
        closedBy: { select: { id: true, name: true, role: true } },
        shiftAdjustments: true,
      },
      orderBy: { endTime: "desc" },
    });

    return NextResponse.json({
      variances: variances.map((s) => ({
        shiftId: s.id,
        shiftNumber: s.shiftNumber,
        branch: s.branch,
        register: s.register,
        cashier: s.cashier,
        closedBy: s.closedBy,
        startTime: s.startTime,
        endTime: s.endTime,
        expectedCash: Number(s.expectedCash),
        actualCash: Number(s.actualCash || 0),
        cashVariance: Number(s.cashDifference || 0),
        varianceType: Number(s.cashDifference || 0) < 0 ? "SHORTAGE" : "EXCESS",
        varianceReason: s.varianceReason || s.closingNotes,
        adjustments: s.shiftAdjustments,
      })),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to fetch shift variances report") },
      { status: 500 }
    );
  }
}

