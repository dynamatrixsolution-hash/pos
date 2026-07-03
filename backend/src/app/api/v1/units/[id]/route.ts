import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";
import { z } from "zod";

const unitSchema = z.object({
  name: z.string().min(1, "Name is required"),
});

export async function PUT(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  try {
    const body = await request.json();
    const result = unitSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.format() },
        { status: 400 }
      );
    }

    // Verify ownership
    const existing = await db.unit.findFirst({
      where: {
        id: params.id,
        businessId: context.businessId,
        deletedAt: null,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }

    const unit = await db.unit.update({
      where: { id: params.id },
      data: { name: result.data.name },
    });

    return NextResponse.json(unit);
  } catch (error: any) {
    console.error("PUT unit error:", error);
    return NextResponse.json({ error: "Failed to update unit" }, { status: 500 });
  }
}

export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  try {
    // Verify ownership
    const existing = await db.unit.findFirst({
      where: {
        id: params.id,
        businessId: context.businessId,
        deletedAt: null,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }

    // Soft delete
    await db.unit.update({
      where: { id: params.id },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE unit error:", error);
    return NextResponse.json({ error: "Failed to delete unit" }, { status: 500 });
  }
}
