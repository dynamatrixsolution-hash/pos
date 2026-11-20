import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse, safeErrorMessage } from "@/lib/api-helper";
import { computeShiftFinancialSummary } from "@/lib/shift-service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  const { id } = await params;

  try {
    const register = await db.cashRegister.findFirst({
      where: { id, businessId: context.businessId, deletedAt: null },
      include: {
        branch: { select: { id: true, name: true } },
      },
    });

    if (!register) {
      return NextResponse.json({ error: "Register not found" }, { status: 404 });
    }

    const activeShift = await db.cashierShift.findFirst({
      where: {
        registerId: register.id,
        businessId: context.businessId,
        status: "OPEN",
      },
      orderBy: { startTime: "desc" },
    });

    if (!activeShift) {
      return NextResponse.json({
        register,
        activeShift: null,
        summary: null,
      });
    }

    const summary = await computeShiftFinancialSummary(activeShift.id, context.businessId);

    return NextResponse.json({
      register,
      activeShift: summary?.shift ?? activeShift,
      summary: summary?.metrics ?? null,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to fetch active shift for register") },
      { status: 500 }
    );
  }
}

