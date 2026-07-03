import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse, roleErrorResponse } from "@/lib/api-helper";
import { z } from "zod";

const subcategoryUpdateSchema = z.object({
  name: z.string().min(1, "Name is required").optional(),
  categoryId: z.string().uuid("Invalid category ID").optional(),
});

export async function PUT(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  if (context.role === "CASHIER") {
    return roleErrorResponse();
  }

  try {
    const body = await request.json();
    const result = subcategoryUpdateSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.format() },
        { status: 400 }
      );
    }

    const existing = await db.subcategory.findFirst({
      where: {
        id: params.id,
        businessId: context.businessId,
        deletedAt: null,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Subcategory not found" }, { status: 404 });
    }

    const dataToUpdate: any = {};
    if (result.data.name !== undefined) dataToUpdate.name = result.data.name;
    if (result.data.categoryId !== undefined) dataToUpdate.categoryId = result.data.categoryId;

    const subcategory = await db.subcategory.update({
      where: { id: params.id },
      data: dataToUpdate,
      include: {
        category: {
          select: { id: true, name: true }
        }
      }
    });

    return NextResponse.json(subcategory);
  } catch (error: any) {
    console.error("PUT subcategory error:", error);
    return NextResponse.json({ error: "Failed to update subcategory" }, { status: 500 });
  }
}

export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  if (context.role === "CASHIER") {
    return roleErrorResponse();
  }

  try {
    const existing = await db.subcategory.findFirst({
      where: {
        id: params.id,
        businessId: context.businessId,
        deletedAt: null,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Subcategory not found" }, { status: 404 });
    }

    await db.subcategory.update({
      where: { id: params.id },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE subcategory error:", error);
    return NextResponse.json({ error: "Failed to delete subcategory" }, { status: 500 });
  }
}
