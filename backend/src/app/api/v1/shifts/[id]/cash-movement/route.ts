import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse, safeErrorMessage } from "@/lib/api-helper";
import {
  computeShiftFinancialSummary,
  logShiftAudit,
  isManagerOrOwnerRole,
} from "@/lib/shift-service";
import { z } from "zod";

const cashMovementSchema = z.object({
  type: z.enum(["CASH_IN", "CASH_OUT"]).optional(),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  reason: z.string().min(2, "Reason is required"),
  description: z.string().optional().nullable(),
  reference: z.string().optional().nullable(),
  referenceId: z.string().optional().nullable(),
  reference_id: z.string().optional().nullable(),
  denominations: z
    .array(
      z.object({
        note: z.number(),
        count: z.number().int().min(0),
        amount: z.number().min(0),
      })
    )
    .optional()
    .nullable(),
});

export async function handleCreateCashMovement(
  request: Request,
  shiftId: string,
  forcedType?: "CASH_IN" | "CASH_OUT"
) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  try {
    const body = await request.json();
    const parsed = cashMovementSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const type = forcedType || parsed.data.type;
    if (!type || (type !== "CASH_IN" && type !== "CASH_OUT")) {
      return NextResponse.json(
        { error: "Movement type (CASH_IN or CASH_OUT) is required." },
        { status: 400 }
      );
    }

    const { amount, reason, description, reference, referenceId, reference_id, denominations } =
      parsed.data;
    const resolvedReference = referenceId || reference_id || reference || null;

    const summary = await computeShiftFinancialSummary(shiftId, context.businessId);
    if (!summary) {
      return NextResponse.json({ error: "Shift not found." }, { status: 404 });
    }

    const { shift, metrics } = summary;

    if (shift.status !== "OPEN") {
      return NextResponse.json(
        { error: `Cannot record cash movement. Shift ${shift.shiftNumber} is already closed.` },
        { status: 400 }
      );
    }

    // Specification §2.5 & §7.5.2: Cash out cannot exceed available expected cash!
    if (type === "CASH_OUT") {
      if (amount > metrics.expectedCash) {
        return NextResponse.json(
          {
            error: `Cash out amount (NPR ${amount.toLocaleString()}) cannot exceed available expected cash in drawer (NPR ${metrics.expectedCash.toLocaleString()}).`,
            expectedCash: metrics.expectedCash,
          },
          { status: 400 }
        );
      }
    }

    const branchId = shift.branchId || context.branchId;
    if (!branchId) {
      return NextResponse.json({ error: "Branch ID missing." }, { status: 400 });
    }

    // Atomic insert of cash movement and updating shift expected cash
    const result = await db.$transaction(async (tx) => {
      const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const moveCount = await tx.cashMovement.count({
        where: {
          businessId: context.businessId,
          movementNumber: { startsWith: `CM-${todayStr}` },
        },
      });
      const movementNumber = `CM-${todayStr}-${String(moveCount + 1).padStart(4, "0")}`;

      const created = await tx.cashMovement.create({
        data: {
          businessId: context.businessId,
          branchId,
          shiftId: shift.id,
          userId: context.userId,
          movementNumber,
          type,
          amount,
          reason: reason.trim(),
          description: description ? description.trim() : null,
          referenceId: resolvedReference ? String(resolvedReference).trim() : null,
          approvedById: isManagerOrOwnerRole(context.role) ? context.userId : null,
          status: "POSTED",
          denominations: denominations ? (denominations as any) : undefined,
        },
        include: {
          user: { select: { id: true, name: true, role: true } },
          approvedBy: { select: { id: true, name: true, role: true } },
        },
      });

      const newExpectedCash =
        type === "CASH_IN"
          ? Number((metrics.expectedCash + amount).toFixed(2))
          : Number((metrics.expectedCash - amount).toFixed(2));

      if (type === "CASH_IN") {
        await tx.cashierShift.update({
          where: { id: shift.id },
          data: {
            cashIn: { increment: amount },
            expectedCash: newExpectedCash,
          },
        });
      } else {
        await tx.cashierShift.update({
          where: { id: shift.id },
          data: {
            cashOut: { increment: amount },
            expectedCash: newExpectedCash,
          },
        });
      }

      await logShiftAudit({
        tx,
        businessId: context.businessId,
        branchId,
        shiftId: shift.id,
        action: type === "CASH_IN" ? "CASH_IN_CREATED" : "CASH_OUT_CREATED",
        entityType: "CashMovement",
        entityId: created.id,
        oldValues: { expectedCash: metrics.expectedCash },
        newValues: {
          movementNumber,
          type,
          amount,
          reason: created.reason,
          description: created.description,
          referenceId: created.referenceId,
          expectedCash: newExpectedCash,
        },
        performedById: context.userId,
      });

      return { movement: created, expectedCash: newExpectedCash };
    });

    return NextResponse.json(
      {
        message: `${type === "CASH_IN" ? "Cash In" : "Cash Out"} recorded successfully.`,
        movement: result.movement,
        expectedCash: result.expectedCash,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("POST cash movement error:", error);
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to record cash movement") },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return handleCreateCashMovement(request, id);
}
