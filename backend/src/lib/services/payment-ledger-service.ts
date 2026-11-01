import { db } from "@/lib/db";
import { Prisma } from "@dynapos/db";
import { money, toDecimal } from "./decimal-math";
import { createAuditEvent } from "@/lib/audit-event";

export class PaymentLedgerError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "PaymentLedgerError";
    this.statusCode = statusCode;
  }
}

export interface CreateAllocationParams {
  businessId: string;
  paymentId: string;
  saleId?: string | null;
  purchaseId?: string | null;
  amount: Prisma.Decimal | number | string;
  allocatedById?: string | null;
}

export interface ReversePaymentParams {
  businessId: string;
  paymentId: string;
  reason: string;
  reversedById?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface CreateRefundParams {
  businessId: string;
  branchId: string;
  paymentId?: string | null;
  saleId?: string | null;
  customerId?: string | null;
  amount: Prisma.Decimal | number | string;
  method?: string;
  reason: string;
  createdById?: string | null;
}

/**
 * Explicitly allocates a payment receipt to an invoice or purchase order.
 */
export async function allocatePayment(
  tx: Prisma.TransactionClient,
  params: CreateAllocationParams
) {
  const amount = money(params.amount);
  if (amount.isNegative() || amount.isZero()) {
    throw new PaymentLedgerError("Allocation amount must be strictly positive", 400);
  }

  // 1. Verify Payment existence within tenant
  const payment = await tx.payment.findFirst({
    where: { id: params.paymentId, businessId: params.businessId },
  });
  if (!payment) {
    throw new PaymentLedgerError("Payment record not found", 404);
  }

  // Check sum of existing allocations + new amount does not exceed payment amount
  const existingAllocations = await tx.paymentAllocation.findMany({
    where: { paymentId: params.paymentId, businessId: params.businessId },
  });
  const totalAllocated = existingAllocations.reduce(
    (sum, a) => sum.add(a.amount),
    new Prisma.Decimal(0)
  );
  if (totalAllocated.add(amount).greaterThan(payment.amount)) {
    throw new PaymentLedgerError(
      `Total allocated amount cannot exceed payment receipt amount (${payment.amount})`,
      409
    );
  }

  // 2. If saleId provided, verify and update paidAmount
  if (params.saleId) {
    const sale = await tx.sale.findFirst({
      where: { id: params.saleId, businessId: params.businessId },
    });
    if (!sale) throw new PaymentLedgerError("Target sale invoice not found", 404);
    const updatedPaid = sale.paidAmount.add(amount);
    const updatedDue = Prisma.Decimal.max(new Prisma.Decimal(0), sale.total.sub(updatedPaid));
    const newStatus = updatedDue.isZero() ? "PAID" : updatedPaid.isZero() ? "PENDING" : "PARTIAL";

    await tx.sale.update({
      where: { id: sale.id },
      data: {
        paidAmount: updatedPaid,
        paymentStatus: newStatus,
      },
    });
  }

  // 3. Create explicit PaymentAllocation ledger row
  return await tx.paymentAllocation.create({
    data: {
      businessId: params.businessId,
      paymentId: params.paymentId,
      saleId: params.saleId || null,
      purchaseId: params.purchaseId || null,
      amount,
      allocatedById: params.allocatedById || undefined,
    },
  });
}

/**
 * Reverses an erroneous payment with an immutable audit record and offset entries.
 * Strict invariant: Never hard-deletes the Payment record.
 */
export async function reversePayment(
  tx: Prisma.TransactionClient,
  params: ReversePaymentParams
) {
  if (!params.reason || params.reason.trim().length < 5) {
    throw new PaymentLedgerError("Reversal reason must be at least 5 characters", 400);
  }

  const payment = await tx.payment.findFirst({
    where: { id: params.paymentId, businessId: params.businessId },
    include: { allocations: true },
  });
  if (!payment) {
    throw new PaymentLedgerError("Payment record not found", 404);
  }

  // Check if already reversed
  const existingReversal = await tx.paymentReversal.findFirst({
    where: { paymentId: payment.id, businessId: params.businessId },
  });
  if (existingReversal) {
    throw new PaymentLedgerError("Payment has already been reversed", 409);
  }

  // 1. Revert any linked invoice allocations
  for (const alloc of payment.allocations) {
    if (alloc.saleId) {
      const sale = await tx.sale.findFirst({
        where: { id: alloc.saleId, businessId: params.businessId },
      });
      if (sale) {
        const updatedPaid = Prisma.Decimal.max(new Prisma.Decimal(0), sale.paidAmount.sub(alloc.amount));
        const updatedDue = sale.total.sub(updatedPaid);
        const newStatus = updatedDue.isZero() ? "PAID" : updatedPaid.isZero() ? "PENDING" : "PARTIAL";
        await tx.sale.update({
          where: { id: sale.id },
          data: {
            paidAmount: updatedPaid,
            paymentStatus: newStatus,
          },
        });
      }
    }
  }

  // 2. Offset Customer or Supplier Ledger if applicable
  if (payment.type === "RECEIVED" && payment.customerId) {
    const customer = await tx.customer.findFirst({
      where: { id: payment.customerId, businessId: params.businessId },
    });
    if (customer) {
      const reversedBalance = customer.balance.add(payment.amount);
      await tx.customer.update({
        where: { id: customer.id },
        data: { balance: reversedBalance },
      });
      await tx.customerLedger.create({
        data: {
          customerId: customer.id,
          type: "ADJUSTMENT",
          reference: `REV-${payment.receiptNumber || payment.id.slice(0, 8)}`,
          debit: payment.amount,
          credit: new Prisma.Decimal(0),
          balance: reversedBalance,
          description: `REVERSAL of Payment receipt ${payment.receiptNumber || payment.id}: ${params.reason}`,
        },
      });
    }
  } else if (payment.type === "SENT" && payment.supplierId) {
    const supplier = await tx.supplier.findFirst({
      where: { id: payment.supplierId, businessId: params.businessId },
    });
    if (supplier) {
      const reversedBalance = supplier.balance.add(payment.amount);
      await tx.supplier.update({
        where: { id: supplier.id },
        data: { balance: reversedBalance },
      });
      await tx.supplierLedger.create({
        data: {
          supplierId: supplier.id,
          type: "ADJUSTMENT",
          reference: `REV-${payment.receiptNumber || payment.id.slice(0, 8)}`,
          debit: new Prisma.Decimal(0),
          credit: payment.amount,
          balance: reversedBalance,
          description: `REVERSAL of Payment voucher ${payment.receiptNumber || payment.id}: ${params.reason}`,
        },
      });
    }
  }

  // 3. Create immutable PaymentReversal record
  const reversal = await tx.paymentReversal.create({
    data: {
      businessId: params.businessId,
      paymentId: payment.id,
      reason: params.reason,
      reversedById: params.reversedById || undefined,
    },
  });

  // 4. Record AuditEvent
  await createAuditEvent(
    {
      businessId: params.businessId,
      branchId: payment.branchId,
      userId: params.reversedById,
      action: "PAYMENT_REVERSAL",
      entity: "Payment",
      entityId: payment.id,
      oldValue: { status: "ACTIVE", amount: payment.amount.toString() },
      newValue: { status: "REVERSED", reversalId: reversal.id, reason: params.reason },
      reason: params.reason,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    },
    tx
  );

  return { ...reversal, amount: payment.amount };
}

/**
 * Creates an audited Refund record.
 */
export async function createRefund(
  tx: Prisma.TransactionClient,
  params: CreateRefundParams
) {
  const amount = money(params.amount);
  if (amount.isNegative() || amount.isZero()) {
    throw new PaymentLedgerError("Refund amount must be strictly positive", 400);
  }

  return await tx.refund.create({
    data: {
      businessId: params.businessId,
      branchId: params.branchId,
      paymentId: params.paymentId || undefined,
      saleId: params.saleId || undefined,
      customerId: params.customerId || undefined,
      amount,
      method: params.method || "CASH",
      reason: params.reason,
      createdById: params.createdById || undefined,
    },
  });
}
