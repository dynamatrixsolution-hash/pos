import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse, safeErrorMessage } from "@/lib/api-helper";
import { canViewAllBranchShifts } from "@/lib/shift-service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  const { id } = await params; 

  try {
    const shift = await db.cashierShift.findFirst({
      where: { id, businessId: context.businessId },
      select: { id: true, shiftNumber: true, cashierId: true },
    });

    if (!shift) {
      return NextResponse.json({ error: "Shift not found" }, { status: 404 });
    }

    if (!canViewAllBranchShifts(context.role) && shift.cashierId !== context.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [shiftTransactions, sales, payments, cashMovements] = await Promise.all([
      db.shiftTransaction.findMany({
        where: { shiftId: id, businessId: context.businessId },
        include: {
          sale: { select: { id: true, invoiceNumber: true, total: true, status: true } },
          payment: { select: { id: true, method: true, type: true, reference: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
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
          customer: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      db.payment.findMany({
        where: { shiftId: id, businessId: context.businessId },
        orderBy: { createdAt: "desc" },
      }),
      db.cashMovement.findMany({
        where: { shiftId: id, businessId: context.businessId },
        include: {
          user: { select: { id: true, name: true, role: true } },
          approvedBy: { select: { id: true, name: true, role: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return NextResponse.json({
      shiftId: shift.id,
      shiftNumber: shift.shiftNumber,
      shiftTransactions,
      sales,
      payments,
      cashMovements,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to fetch shift transactions") },
      { status: 500 }
    );
  }
}

