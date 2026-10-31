import { resolveBranch, serializable } from "@/lib/commerce-transaction";
import { CommerceError } from "@/lib/commerce-policy";
import { NextResponse } from "next/server";
import { getSessionContext, authErrorResponse, roleErrorResponse } from "@/lib/api-helper";
import { CbmsService } from "@/lib/cbms-service";
import { z } from "zod";

const cancelSchema = z.object({
  reason: z.string().min(5, "Cancellation reason must be at least 5 characters"),
});

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  // Cancellations are typically restricted to Owner or Manager
  if (context.role !== "OWNER" && context.role !== "SUPER_ADMIN" && context.role !== "MANAGER") {
    return roleErrorResponse();
  }

  const headers = request.headers;
  const xForwardedFor = headers.get("x-forwarded-for");
  const ipAddress = xForwardedFor ? xForwardedFor.split(",")[0].trim() : (headers.get("x-real-ip") || "127.0.0.1");
  const deviceInfo = headers.get("user-agent") || "Unknown Device";

  try {
    const body = await request.json();
    const result = cancelSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.format() },
        { status: 400 }
      );
    }

    const { reason } = result.data;
    const saleId = params.id;

    const updatedSale = await serializable(async (tx) => {
      // 1. Fetch sale
      const sale = await tx.sale.findUnique({
        where: { id: saleId },
        include: {
          saleItems: true,
        },
      });

      if (!sale) throw new Error("Sale invoice not found");
      if (sale.businessId !== context.businessId) throw new CommerceError("Unauthorized tenant access", 403);
      await resolveBranch(tx, context, sale.branchId);
      if (!sale.isActive) throw new Error("Invoice is already cancelled");

      if (sale.paidAmount > 0 || await tx.payment.count({ where: { saleId } })) throw new CommerceError("Paid invoices require a reconciled refund workflow", 409);
      const credits = await tx.creditNote.count({ where: { saleId } });
      if (credits) throw new CommerceError("Invoices with credit notes require reconciled reversal", 409);
      // 2. Adjust Stock back (Revert deductions)
      for (const item of sale.saleItems) {
        // Increment branch stock
        const stock = await tx.productStock.findUnique({
          where: { productId_branchId: { productId: item.productId, branchId: sale.branchId } },
        });

        if (stock) {
          await tx.productStock.update({
            where: { id: stock.id },
            data: { quantity: stock.quantity + item.quantity },
          });
        }

        // Revert Batch quantity
        if (item.batchNumber) {
          const batch = await tx.batch.findFirst({
            where: {
              productId: item.productId,
              branchId: sale.branchId,
              batchNumber: item.batchNumber,
              deletedAt: null,
            },
          });

          if (batch) {
            await tx.batch.update({
              where: { id: batch.id },
              data: { quantity: batch.quantity + item.quantity },
            });
          }
        }
      }

      // 3. Adjust Customer balance if paid using credit
      if (sale.customerId) {
        const customer = await tx.customer.findFirst({
          where: { id: sale.customerId, businessId: context.businessId },
        });

        if (customer) {
          const unpaidAmt = sale.total - sale.paidAmount;

          if (unpaidAmt > 0) {
            const newCustomerBalance = Math.max(0, customer.balance - unpaidAmt);

            await tx.customer.update({
              where: { id: customer.id },
              data: { balance: newCustomerBalance },
            });

            await tx.customerLedger.create({
              data: {
                customerId: customer.id,
                type: "RETURN",
                reference: sale.invoiceNumber,
                debit: 0.0,
                credit: unpaidAmt,
                balance: newCustomerBalance,
                description: `Cancelled billing invoice credit adjustment. Reason: ${reason}`,
              },
            });
          }
        }
      }

      // 4. Update invoice status
      const updated = await tx.sale.update({
        where: { id: saleId },
        data: {
          isActive: false,
          cancellationReason: reason,
          cancelledById: context.userId,
          cancelledAt: new Date(),
        },
      });

      // 5. Write Audit Log
      await tx.auditLog.create({
        data: {
          businessId: context.businessId,
          userId: context.userId,
          role: context.role,
          branchId: sale.branchId,
          action: "CANCEL_INVOICE",
          module: "SALE",
          details: `Cancelled invoice ${sale.invoiceNumber}. Reason: "${reason}". Reverted stock levels and adjusted customer receivables.`,
          oldValue: JSON.parse(JSON.stringify(sale)),
          newValue: JSON.parse(JSON.stringify(updated)),
          ipAddress,
          deviceInfo,
        },
      });

      return updated;
    });

    // 6. Async submit cancellation request to CBMS
    (process.env.ENABLE_MOCK_CBMS === "true" ? CbmsService.submitCancellation(saleId, reason) : Promise.resolve(false)).catch((e) => {
      console.error("Async CBMS cancellation submit failed:", e);
    });

    return NextResponse.json({
      message: "Invoice cancelled successfully",
      invoiceNumber: updatedSale.invoiceNumber,
      isActive: updatedSale.isActive,
      cancelledAt: updatedSale.cancelledAt,
    });
  } catch (error: any) {
    console.error("POST cancel error:", error.message || error);
    return NextResponse.json({ error: error.message || "Failed to cancel invoice" }, { status: error instanceof CommerceError ? error.status : 400 });
  }
}
