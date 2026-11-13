import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse, safeErrorMessage } from "@/lib/api-helper";
import { canViewAllBranchShifts } from "@/lib/shift-service";

export async function GET(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  if (!canViewAllBranchShifts(context.role)) {
    return NextResponse.json(
      { error: "Forbidden: Insufficient permissions to view cash movement reports." },
      { status: 403 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get("branchId") || searchParams.get("branch_id") || context.branchId;
    const shiftId = searchParams.get("shiftId") || searchParams.get("shift_id");
    const type = searchParams.get("type");
    const startDate = searchParams.get("startDate") || searchParams.get("start_date");
    const endDate = searchParams.get("endDate") || searchParams.get("end_date");

    const where: any = {
      businessId: context.businessId,
      ...(branchId ? { branchId } : {}),
      ...(shiftId ? { shiftId } : {}),
      ...(type ? { type: type.toUpperCase() } : {}),
    };

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    const movements = await db.cashMovement.findMany({
      where,
      include: {
        branch: { select: { id: true, name: true } },
        shift: {
          select: {
            id: true,
            shiftNumber: true,
            register: { select: { id: true, name: true, code: true } },
          },
        },
        user: { select: { id: true, name: true, role: true } },
        approvedBy: { select: { id: true, name: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    const totalCashIn = movements
      .filter((m) => m.type === "CASH_IN" && m.status !== "VOIDED")
      .reduce((sum, m) => sum + Number(m.amount), 0);
    const totalCashOut = movements
      .filter((m) => m.type === "CASH_OUT" && m.status !== "VOIDED")
      .reduce((sum, m) => sum + Number(m.amount), 0);

    return NextResponse.json({
      movements,
      summary: {
        count: movements.length,
        totalCashIn: Number(totalCashIn.toFixed(2)),
        totalCashOut: Number(totalCashOut.toFixed(2)),
        netCashMovement: Number((totalCashIn - totalCashOut).toFixed(2)),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to fetch cash movement report") },
      { status: 500 }
    );
  }
}

