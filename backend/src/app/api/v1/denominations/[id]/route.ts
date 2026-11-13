import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse, safeErrorMessage } from "@/lib/api-helper";
import { isOwnerOrAdminRole } from "@/lib/shift-service";
import { z } from "zod";

const updateDenominationSchema = z.object({
  type: z.enum(["NOTE", "COIN"]).optional(),
  displayOrder: z.number().int().optional(),
  display_order: z.number().int().optional(),
  isActive: z.boolean().optional(),
  is_active: z.boolean().optional(),
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  if (!isOwnerOrAdminRole(context.role)) {
    return NextResponse.json(
      { error: "Forbidden: Only business owners or admins can update denominations." },
      { status: 403 }
    );
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const parsed = updateDenominationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const existing = await db.denomination.findFirst({
      where: { id, businessId: context.businessId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Denomination not found" }, { status: 404 });
    }

    const { type, displayOrder, display_order, isActive, is_active } = parsed.data;
    const updated = await db.denomination.update({
      where: { id: existing.id },
      data: {
        ...(type !== undefined ? { type } : {}),
        ...(displayOrder !== undefined || display_order !== undefined
          ? { displayOrder: displayOrder ?? display_order }
          : {}),
        ...(isActive !== undefined || is_active !== undefined
          ? { isActive: isActive ?? is_active }
          : {}),
      },
    });

    return NextResponse.json({
      denomination: {
        ...updated,
        value: Number(updated.value),
        label: `${updated.currencyCode} ${Number(updated.value).toLocaleString()}`,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to update denomination") },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  return PUT(request, ctx);
}
