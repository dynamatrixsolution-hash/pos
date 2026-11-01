import { checkBranch, serializable } from "@/lib/commerce-transaction";
import { CommerceError, requireStaff } from "@/lib/commerce-policy";
import { NextResponse } from "next/server";
import { getSessionContext, authErrorResponse, roleErrorResponse } from "@/lib/api-helper";
import { reversePayment, PaymentLedgerError } from "@/lib/services/payment-ledger-service";
import { enqueueOutboxEvent } from "@/lib/services/outbox-service";
import { z } from "zod";

const reversePaymentSchema = z.object({
  reason: z.string().min(5, "Reversal reason must be at least 5 characters"),
});

export async function POST(
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
    const allowedBranchId = await checkBranch(context, context.branchId);
    requireStaff(context, true);

    const body = await request.json();
    const parsed = reversePaymentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const headers = request.headers;
    const xForwardedFor = headers.get("x-forwarded-for");
    const ipAddress = xForwardedFor
      ? xForwardedFor.split(",")[0].trim()
      : headers.get("x-real-ip") || "127.0.0.1";
    const userAgent = headers.get("user-agent") || "Unknown Device";

    const reversal = await serializable(async (tx) => {
      const rev = await reversePayment(tx, {
        businessId: context.businessId,
        paymentId: id,
        reason: parsed.data.reason,
        reversedById: context.userId,
        ipAddress,
        userAgent,
      });

      // Transactional Outbox
      await enqueueOutboxEvent(tx, {
        businessId: context.businessId,
        aggregateType: "Payment",
        aggregateId: id,
        eventType: "PAYMENT_REVERSED",
        payload: {
          reversalId: rev.id,
          amount: rev.amount.toString(),
          reason: parsed.data.reason,
          reversedById: context.userId,
        },
      });

      return rev;
    });

    return NextResponse.json({
      success: true,
      reversal: {
        id: reversal.id,
        paymentId: reversal.paymentId,
        amount: reversal.amount.toString(),
        reason: reversal.reason,
        reversedAt: reversal.reversedAt,
      },
    });
  } catch (error: any) {
    if (error instanceof PaymentLedgerError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    if (error instanceof CommerceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Payment reversal error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to reverse payment" },
      { status: 500 }
    );
  }
}

