import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse, roleErrorResponse } from "@/lib/api-helper";
import { z } from "zod";

const paymentUpdateSchema = z.object({
  remarks: z.string().optional().nullable(),
  reference: z.string().optional().nullable(),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();
  const { id } = await params;

  try {
    const payment = await db.payment.findFirst({
      where: {
        id: id,
        businessId: context.businessId,
      },
      include: {
        customer: true,
        supplier: true,
        branch: true,
        user: { select: { name: true, email: true } },
        sale: true,
        purchase: true,
      },
    });

    if (!payment) {
      // Check if it's an Income record
      const inc = await db.income.findFirst({
        where: { id: id, businessId: context.businessId },
        include: {
          category: true,
          branch: true,
          user: true,
        }
      });
      if (inc) {
        return NextResponse.json({
          id: inc.id,
          businessId: inc.businessId,
          saleId: null,
          purchaseId: null,
          customerId: null,
          supplierId: null,
          branchId: inc.branchId,
          userId: inc.userId,
          amount: inc.amount,
          method: "CASH",
          reference: inc.reference,
          receiptNumber: inc.reference || `INC-${inc.id.slice(0, 8).toUpperCase()}`,
          remarks: inc.description || `Income: ${inc.category.name}`,
          type: "RECEIVED",
          createdAt: inc.createdAt,
          customer: { id: "", name: `Other Income: ${inc.category.name}`, phone: null },
          branch: inc.branch,
          user: inc.user,
          sale: null,
          isIncomeRecord: true,
        });
      }

      // Check if it's an Expense record
      const exp = await db.expense.findFirst({
        where: { id: id, businessId: context.businessId },
        include: {
          category: true,
          branch: true,
          user: true,
        }
      });
      if (exp) {
        return NextResponse.json({
          id: exp.id,
          businessId: exp.businessId,
          saleId: null,
          purchaseId: null,
          customerId: null,
          supplierId: null,
          branchId: exp.branchId,
          userId: exp.userId,
          amount: exp.amount,
          method: "CASH",
          reference: exp.reference,
          receiptNumber: exp.reference || `EXP-${exp.id.slice(0, 8).toUpperCase()}`,
          remarks: exp.description || `Expense: ${exp.category.name}`,
          type: "SENT",
          createdAt: exp.createdAt,
          supplier: { id: "", name: `Expense: ${exp.category.name}`, phone: null },
          branch: exp.branch,
          user: exp.user,
          purchase: null,
          isExpenseRecord: true,
        });
      }

      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    return NextResponse.json(payment);
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to fetch payment details" }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  if (context.role === "CASHIER") {
    return roleErrorResponse();
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const result = paymentUpdateSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.format() },
        { status: 400 }
      );
    }

    const payment = await db.payment.findFirst({
      where: {
        id: id,
        businessId: context.businessId,
      },
    });

    if (!payment) {
      // Check if it's an Income record
      const inc = await db.income.findFirst({
        where: { id: id, businessId: context.businessId },
      });
      if (inc) {
        const updatedInc = await db.income.update({
          where: { id: inc.id },
          data: {
            description: result.data.remarks !== undefined ? result.data.remarks : inc.description,
            reference: result.data.reference !== undefined ? result.data.reference : inc.reference,
          },
        });
        return NextResponse.json(updatedInc);
      }

      // Check if it's an Expense record
      const exp = await db.expense.findFirst({
        where: { id: id, businessId: context.businessId },
      });
      if (exp) {
        const updatedExp = await db.expense.update({
          where: { id: exp.id },
          data: {
            description: result.data.remarks !== undefined ? result.data.remarks : exp.description,
            reference: result.data.reference !== undefined ? result.data.reference : exp.reference,
          },
        });
        return NextResponse.json(updatedExp);
      }

      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    const updatedPayment = await db.payment.update({
      where: { id: payment.id },
      data: {
        remarks: result.data.remarks !== undefined ? result.data.remarks : payment.remarks,
        reference: result.data.reference !== undefined ? result.data.reference : payment.reference,
      },
    });

    return NextResponse.json(updatedPayment);
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to update payment details" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  if (context.role === "CASHIER") {
    return roleErrorResponse();
  }

  const headers = request.headers;
  const xForwardedFor = headers.get("x-forwarded-for");
  const ipAddress = xForwardedFor ? xForwardedFor.split(",")[0].trim() : (headers.get("x-real-ip") || "127.0.0.1");
  const deviceInfo = headers.get("user-agent") || "Unknown Device";

  const { id } = await params;

  try {
    const payment = await db.payment.findFirst({
      where: {
        id: id,
        businessId: context.businessId,
      },
    });

    if (!payment) {
      // Check if it's an Income record
      const inc = await db.income.findFirst({
        where: { id: id, businessId: context.businessId },
      });
      if (inc) {
        await db.income.update({
          where: { id: inc.id },
          data: { deletedAt: new Date() },
        });

        // Record Audit Log for Reversal
        await db.auditLog.create({
          data: {
            businessId: context.businessId,
            userId: context.userId,
            role: context.role,
            branchId: inc.branchId || context.branchId,
            action: "DELETE",
            module: "PAYMENT",
            details: `REVERSED and soft-deleted income of $${inc.amount}`,
            oldValue: JSON.parse(JSON.stringify(inc)),
            ipAddress,
            deviceInfo,
          },
        });
        return NextResponse.json({ success: true });
      }

      // Check if it's an Expense record
      const exp = await db.expense.findFirst({
        where: { id: id, businessId: context.businessId },
      });
      if (exp) {
        await db.expense.update({
          where: { id: exp.id },
          data: { deletedAt: new Date() },
        });

        // Record Audit Log for Reversal
        await db.auditLog.create({
          data: {
            businessId: context.businessId,
            userId: context.userId,
            role: context.role,
            branchId: exp.branchId || context.branchId,
            action: "DELETE",
            module: "PAYMENT",
            details: `REVERSED and soft-deleted expense of $${exp.amount}`,
            oldValue: JSON.parse(JSON.stringify(exp)),
            ipAddress,
            deviceInfo,
          },
        });
        return NextResponse.json({ success: true });
      }

      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    const reversalResult = await db.$transaction(async (tx) => {
      // 1. If customer payment, reverse customer outstanding balance and append reversal log
      if (payment.type === "RECEIVED" && payment.customerId) {
        const customer = await tx.customer.findFirst({
          where: { id: payment.customerId, businessId: context.businessId },
        });

        if (customer) {
          const reversedBalance = customer.balance + payment.amount;
          await tx.customer.update({
            where: { id: customer.id },
            data: { balance: reversedBalance },
          });

          await tx.customerLedger.create({
            data: {
              customerId: customer.id,
              type: "ADJUSTMENT",
              reference: payment.receiptNumber,
              debit: payment.amount, // Debit restores what they owe us
              credit: 0,
              balance: reversedBalance,
              description: `REVERSAL of Payment receipt ${payment.receiptNumber} (${payment.amount})`,
            },
          });
        }
      }

      // 2. If supplier payment, reverse supplier balance and append reversal log
      if (payment.type === "SENT" && payment.supplierId) {
        const supplier = await tx.supplier.findFirst({
          where: { id: payment.supplierId, businessId: context.businessId },
        });

        if (supplier) {
          const reversedBalance = supplier.balance + payment.amount;
          await tx.supplier.update({
            where: { id: supplier.id },
            data: { balance: reversedBalance },
          });

          await tx.supplierLedger.create({
            data: {
              supplierId: supplier.id,
              type: "ADJUSTMENT",
              reference: payment.receiptNumber,
              debit: 0,
              credit: payment.amount, // Credit restores what we owe supplier
              balance: reversedBalance,
              description: `REVERSAL of Payment voucher ${payment.receiptNumber} (${payment.amount})`,
            },
          });
        }
      }

      // 3. Delete the Payment record
      await tx.payment.delete({
        where: { id: payment.id },
      });

      // 4. Record Audit Log for Reversal
      await tx.auditLog.create({
        data: {
          businessId: context.businessId,
          userId: context.userId,
          role: context.role,
          branchId: payment.branchId || context.branchId,
          action: "DELETE",
          module: "PAYMENT",
          details: `REVERSED and deleted payment ${payment.receiptNumber} of $${payment.amount} (${payment.type})`,
          oldValue: JSON.parse(JSON.stringify(payment)),
          ipAddress,
          deviceInfo,
        },
      });

      return { success: true };
    });

    return NextResponse.json(reversalResult);
  } catch (error: any) {
    console.error("DELETE payment error:", error);
    return NextResponse.json({ error: error.message || "Failed to reverse payment" }, { status: 500 });
  }
}
