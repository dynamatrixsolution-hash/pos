import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse, roleErrorResponse } from "@/lib/api-helper";
import { z } from "zod";

const categorySchema = z.object({
  name: z.string().min(1, "Name is required"),
});

export async function PUT(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  // Block Cashiers from modifying categories
  if (context.role === "CASHIER") {
    return roleErrorResponse();
  }

  try {
    const body = await request.json();
    const result = categorySchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.format() },
        { status: 400 }
      );
    }

    // Verify ownership
    const existing = await db.category.findFirst({
      where: {
        id: params.id,
        businessId: context.businessId,
        deletedAt: null,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    const category = await db.category.update({
      where: { id: params.id },
      data: { name: result.data.name },
    });

    return NextResponse.json(category);
  } catch (error: any) {
    console.error("PUT category error:", error);
    return NextResponse.json({ error: "Failed to update category" }, { status: 500 });
  }
}

export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  // Block Cashiers from deleting categories
  if (context.role === "CASHIER") {
    return roleErrorResponse();
  }

  try {
    // Verify ownership
    const existing = await db.category.findFirst({
      where: {
        id: params.id,
        businessId: context.businessId,
        deletedAt: null,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    // Soft delete
    await db.category.update({
      where: { id: params.id },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE category error:", error);
    return NextResponse.json({ error: "Failed to delete category" }, { status: 500 });
  }
}
