import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse, safeErrorMessage } from "@/lib/api-helper";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  const { id } = await params;

  try {
    const movement = await db.cashMovement.findFirst({
      where: { id, businessId: context.businessId },
      include: {
        shift: {
          select: { id: true, shiftNumber: true, status: true, registerId: true },
        },
        user: { select: { id: true, name: true, email: true, role: true } },
        approvedBy: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    if (!movement) {
      return NextResponse.json({ error: "Cash movement not found" }, { status: 404 });
    }

    return NextResponse.json({ movement });
  } catch (error: any) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to fetch cash movement") },
      { status: 500 }
    );
  }
}

