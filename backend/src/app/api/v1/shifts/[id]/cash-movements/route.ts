import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse, safeErrorMessage } from "@/lib/api-helper";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  const { id } = await params;

  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");

    const shift = await db.cashierShift.findFirst({
      where: { id, businessId: context.businessId },
      select: { id: true, shiftNumber: true },
    });

    if (!shift) {
      return NextResponse.json({ error: "Shift not found" }, { status: 404 });
    }

    const movements = await db.cashMovement.findMany({
      where: {
        shiftId: shift.id,
        businessId: context.businessId,
        ...(type ? { type: type.toUpperCase() } : {}),
      },
      include: {
        user: { select: { id: true, name: true, role: true } },
        approvedBy: { select: { id: true, name: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ movements });
  } catch (error: any) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to fetch cash movements") },
      { status: 500 }
    );
  }
}

