import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse, safeErrorMessage } from "@/lib/api-helper";
import { isOwnerOrAdminRole } from "@/lib/shift-service";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  if (!isOwnerOrAdminRole(context.role)) {
    return NextResponse.json(
      { error: "Forbidden: Only business owners or admins can update denomination status." },
      { status: 403 }
    );
  }

  const { id } = await params;

  try {
    const body = await request.json().catch(() => ({}));
    const existing = await db.denomination.findFirst({
      where: { id, businessId: context.businessId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Denomination not found" }, { status: 404 });
    }

    const nextActive =
      body.isActive !== undefined
        ? Boolean(body.isActive)
        : body.is_active !== undefined
          ? Boolean(body.is_active)
          : !existing.isActive;

    const updated = await db.denomination.update({
      where: { id: existing.id },
      data: { isActive: nextActive },
    });

    return NextResponse.json({ denomination: updated });
  } catch (error: any) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to update denomination status") },
      { status: 500 }
    );
  }
}

