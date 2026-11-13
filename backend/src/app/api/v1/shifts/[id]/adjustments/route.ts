import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse, safeErrorMessage } from "@/lib/api-helper";
import { isManagerOrOwnerRole, logShiftAudit } from "@/lib/shift-service";
import { z } from "zod";

const adjustmentSchema = z.object({
  adjustmentType: z.enum(["SHORTAGE", "EXCESS", "CORRECTION"]).optional(),
  adjustment_type: z.enum(["SHORTAGE", "EXCESS", "CORRECTION"]).optional(),
  amount: z.coerce.number().optional(),
  adjustmentAmount: z.coerce.number().optional(),
  adjustment_amount: z.coerce.number().optional(),
  reason: z.string().min(3, "Reason is required for post-close shift adjustment"),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  const { id } = await params;

  try {
    const adjustments = await db.shiftAdjustment.findMany({
      where: { shiftId: id, businessId: context.businessId },
      include: {
        createdBy: { select: { id: true, name: true, role: true } },
        approvedBy: { select: { id: true, name: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ adjustments });
  } catch (error: any) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to fetch shift adjustments") },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  // Specification §3.5 & §8.1: Only authorized managers/owners can perform post-close adjustments
  if (!isManagerOrOwnerRole(context.role)) {
    return NextResponse.json(
      { error: "Forbidden: Only managers or business owners can record post-close shift adjustments." },
      { status: 403 }
    );
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const parsed = adjustmentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const rawAmount =
      parsed.data.amount ??
      parsed.data.adjustmentAmount ??
      parsed.data.adjustment_amount;

    if (rawAmount === undefined || rawAmount === 0 || isNaN(Number(rawAmount))) {
      return NextResponse.json(
        { error: "A non-zero adjustment amount is required." },
        { status: 400 }
      );
    }

    const resolvedType =
      parsed.data.adjustmentType ||
      parsed.data.adjustment_type ||
      "CORRECTION";

    const shift = await db.cashierShift.findFirst({
      where: { id, businessId: context.businessId },
    });

    if (!shift) {
      return NextResponse.json({ error: "Shift not found" }, { status: 404 });
    }

    const adjustment = await db.$transaction(async (tx) => {
      const created = await tx.shiftAdjustment.create({
        data: {
          businessId: context.businessId,
          branchId: shift.branchId,
          shiftId: shift.id,
          adjustmentType: resolvedType,
          amount: Number(rawAmount),
          reason: parsed.data.reason.trim(),
          createdById: context.userId,
          approvedById: context.userId,
        },
        include: {
          createdBy: { select: { id: true, name: true, role: true } },
          approvedBy: { select: { id: true, name: true, role: true } },
        },
      });

      await logShiftAudit({
        tx,
        businessId: context.businessId,
        branchId: shift.branchId,
        shiftId: shift.id,
        action: "SHIFT_ADJUSTED",
        entityType: "ShiftAdjustment",
        entityId: created.id,
        newValues: {
          adjustmentType: resolvedType,
          amount: Number(rawAmount),
          reason: created.reason,
        },
        performedById: context.userId,
      });

      return created;
    });

    return NextResponse.json(
      {
        message: "Shift adjustment recorded with audit trail.",
        adjustment,
      },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to create shift adjustment") },
      { status: 500 }
    );
  }
}

