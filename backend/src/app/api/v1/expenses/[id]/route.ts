import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse, roleErrorResponse } from "@/lib/api-helper";
import { z } from "zod";

const expenseSchema = z.object({
  amount: z.number().positive("Amount must be greater than zero"),
  categoryId: z.string().uuid("Invalid category ID"),
  branchId: z.string().uuid("Invalid branch ID"),
  reference: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
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
    const result = expenseSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.format() },
        { status: 400 }
      );
    }

    const { amount, categoryId, branchId, reference, description } = result.data;

    // Verify expense belongs to business
    const existing = await db.expense.findFirst({
      where: { id: params.id, businessId: context.businessId, deletedAt: null },
    });
    if (!existing) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    // Verify category belongs to business
    const category = await db.expenseCategory.findFirst({
      where: { id: categoryId, businessId: context.businessId, deletedAt: null },
    });
    if (!category) {
      return NextResponse.json({ error: "Expense category not found" }, { status: 404 });
    }

    // Verify branch belongs to business
    const branch = await db.branch.findFirst({
      where: { id: branchId, businessId: context.businessId, deletedAt: null },
    });
    if (!branch) {
      return NextResponse.json({ error: "Branch not found" }, { status: 404 });
    }

    const updatedExpense = await db.expense.update({
      where: { id: params.id },
      data: {
        amount,
        categoryId,
        branchId,
        reference,
        description,
      },
    });

    await db.auditLog.create({
      data: {
        businessId: context.businessId,
        userId: context.userId,
        action: "UPDATE",
        module: "EXPENSE",
        details: `Updated expense voucher for ${category.name}. Amount: ${amount}`,
      },
    });

    return NextResponse.json(updatedExpense);
  } catch (error: any) {
    console.error("PUT expense error:", error);
    return NextResponse.json({ error: "Failed to update expense" }, { status: 500 });
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
    const existing = await db.expense.findFirst({
      where: { id: params.id, businessId: context.businessId, deletedAt: null },
    });
    if (!existing) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    const deletedExpense = await db.expense.update({
      where: { id: params.id },
      data: { deletedAt: new Date() },
    });

    await db.auditLog.create({
      data: {
        businessId: context.businessId,
        userId: context.userId,
        action: "DELETE",
        module: "EXPENSE",
        details: `Deleted expense voucher of amount ${deletedExpense.amount}`,
      },
    });

    return NextResponse.json({ message: "Expense deleted successfully" });
  } catch (error: any) {
    console.error("DELETE expense error:", error);
    return NextResponse.json({ error: "Failed to delete expense" }, { status: 500 });
  }
}
