import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse, safeErrorMessage } from "@/lib/api-helper";
import { isManagerOrOwnerRole } from "@/lib/shift-service";
import { z } from "zod";

const statusSchema = z.object({
  isActive: z.boolean().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  if (!isManagerOrOwnerRole(context.role)) {
    return NextResponse.json(
      { error: "Forbidden: Only managers or business owners can change register status." },
      { status: 403 }
    );
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const parsed = statusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const register = await db.cashRegister.findFirst({
      where: { id, businessId: context.businessId, deletedAt: null },
    });

    if (!register) {
      return NextResponse.json({ error: "Register not found" }, { status: 404 });
    }

    const nextActive =
      parsed.data.isActive !== undefined
        ? parsed.data.isActive
        : parsed.data.status === "ACTIVE"
          ? true
          : parsed.data.status === "INACTIVE"
            ? false
            : !register.isActive;

    if (!nextActive && register.status === "OPEN") {
      return NextResponse.json(
        { error: "Cannot deactivate a register while an active shift is open on it." },
        { status: 409 }
      );
    }

    const updated = await db.cashRegister.update({
      where: { id: register.id },
      data: { isActive: nextActive },
    });

    return NextResponse.json({
      message: `Register ${nextActive ? "activated" : "deactivated"} successfully.`,
      register: updated,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to update register status") },
      { status: 500 }
    );
  }
}

