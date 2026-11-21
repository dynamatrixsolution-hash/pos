import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse, roleErrorResponse, safeErrorMessage } from "@/lib/api-helper";
import { DEFAULT_SUBSCRIPTION_PLANS } from "@/lib/subscription-plans";

export async function GET(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();
  if (context.role !== "SUPER_ADMIN") return roleErrorResponse();

  try {
    // Platform SaaS subscription invoices & payments (Strictly separate from tenant restaurant sales)
    const invoices = await db.subscriptionInvoice.findMany({
      include: {
        business: {
          select: { id: true, name: true, slug: true, currency: true },
        },
        payments: {
          include: {
            recordedBy: {
              select: { name: true, email: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const payments = await db.subscriptionPayment.findMany({
      include: {
        business: {
          select: { id: true, name: true, slug: true, currency: true },
        },
        invoice: {
          select: { invoiceNumber: true, billingPeriodStart: true, billingPeriodEnd: true },
        },
        recordedBy: {
          select: { name: true, email: true },
        },
      },
      orderBy: { recordedAt: "desc" },
      take: 100,
    });

    // Summary calculations
    const totalCollected = payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const totalOutstanding = invoices
      .filter((inv) => inv.status === "PENDING" || inv.status === "OVERDUE")
      .reduce((sum, inv) => {
        const paid = inv.payments.reduce((s, p) => s + Number(p.amount), 0);
        return sum + Math.max(0, Number(inv.amount) - paid);
      }, 0);

    const overdueAmount = invoices
      .filter((inv) => inv.status === "OVERDUE")
      .reduce((sum, inv) => {
        const paid = inv.payments.reduce((s, p) => s + Number(p.amount), 0);
        return sum + Math.max(0, Number(inv.amount) - paid);
      }, 0);

    const transactionLogs = payments.map((p) => ({
      id: p.id,
      businessName: p.business?.name || "Unknown Tenant",
      invoiceNumber: p.invoice?.invoiceNumber || "N/A",
      amount: Number(p.amount),
      currency: p.currency || "NPR",
      method: p.paymentMethod,
      reference: p.reference || "N/A",
      recordedBy: p.recordedBy?.name || "System",
      date: p.recordedAt.toISOString(),
      status: "Settled",
    }));

    return NextResponse.json({
      revenueMetrics: {
        totalCollected,
        totalOutstanding,
        overdueAmount,
        currency: "NPR",
        totalInvoicesCount: invoices.length,
        totalPaymentsCount: payments.length,
      },
      invoices,
      transactionLogs,
      payments: transactionLogs,
    });
  } catch (error: any) {
    console.error("Super Admin Revenue API Error:", error);
    return NextResponse.json({ error: "Failed to fetch platform subscription revenue" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();
  if (context.role !== "SUPER_ADMIN") return roleErrorResponse();

  try {
    const body = await request.json();
    const { invoiceId, amount, paymentMethod = "BANK_TRANSFER", reference, notes } = body;

    if (!invoiceId) {
      return NextResponse.json({ error: "Invoice ID is required" }, { status: 400 });
    }

    const invoice = await db.subscriptionInvoice.findUnique({
      where: { id: invoiceId },
      include: { business: true },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }
    if (invoice.status === "PAID" || invoice.status === "VOID") {
      return NextResponse.json(
        { error: `Invoice #${invoice.invoiceNumber} is already ${invoice.status}` },
        { status: 400 }
      );
    }

    const settlementAmount = amount !== undefined && amount !== null ? Number(amount) : Number(invoice.amount);
    if (!Number.isFinite(settlementAmount) || settlementAmount <= 0) {
      return NextResponse.json({ error: "Settlement amount must be a positive number" }, { status: 400 });
    }

    const { payment, nextStatus } = await db.$transaction(async (tx) => {
      const existingPayments = await tx.subscriptionPayment.aggregate({
        where: { invoiceId: invoice.id },
        _sum: { amount: true },
      });
      const totalPaid = Number(existingPayments._sum.amount || 0) + settlementAmount;
      const isFullyPaid = totalPaid >= Number(invoice.amount);
      const computedStatus = isFullyPaid ? "PAID" : "PARTIAL";

      const createdPayment = await tx.subscriptionPayment.create({
        data: {
          businessId: invoice.businessId,
          invoiceId: invoice.id,
          amount: settlementAmount,
          currency: invoice.currency || "NPR",
          paymentMethod,
          reference: reference || `SETTLE-${Date.now().toString().slice(-6)}`,
          notes: notes || "Settled by Super Admin",
          recordedById: context.userId,
        },
      });

      await tx.subscriptionInvoice.update({
        where: { id: invoice.id },
        data: {
          status: computedStatus,
          ...(isFullyPaid ? { paidAt: new Date() } : {}),
        },
      });

      if (isFullyPaid) {
        const upgradeMatch = invoice.notes?.match(/^UPGRADE_REQUEST:([A-Z0-9_ -]+):(MONTHLY|ANNUAL)/i);
        if (upgradeMatch) {
          const requestedPlan = upgradeMatch[1].trim().toUpperCase();
          const requestedCycle = upgradeMatch[2].toUpperCase();
          const cfg = await tx.platformSetting.findUnique({ where: { key: "SUBSCRIPTION_CONFIG" } });
          const plans = Array.isArray((cfg?.value as any)?.plans)
            ? (cfg?.value as any).plans
            : DEFAULT_SUBSCRIPTION_PLANS;
          const matchedPlan = plans.find(
            (p: any) => p.name?.toUpperCase() === requestedPlan || p.id?.toUpperCase() === requestedPlan
          );

          await tx.subscription.updateMany({
            where: { businessId: invoice.businessId },
            data: {
              plan: requestedPlan,
              billingCycle: requestedCycle,
              status: "ACTIVE",
              endDate: invoice.billingPeriodEnd,
              ...(matchedPlan?.limits?.staff ? { userLimit: Number(matchedPlan.limits.staff) } : {}),
              ...(matchedPlan?.limits?.branches ? { branchLimit: Number(matchedPlan.limits.branches) } : {}),
            },
          });
        } else {
          await tx.subscription.updateMany({
            where: { businessId: invoice.businessId, status: "OVERDUE" },
            data: { status: "ACTIVE" },
          });
        }
      }

      await tx.platformAuditLog.create({
        data: {
          action: "PAYMENT_SETTLED",
          businessId: invoice.businessId,
          actorId: context.userId,
          actorRole: "SUPER_ADMIN",
          targetType: "SUBSCRIPTION_INVOICE",
          targetId: invoice.id,
          reason: `Recorded NPR ${settlementAmount} payment on invoice #${invoice.invoiceNumber} (${computedStatus})`,
          afterState: { status: computedStatus, amount: settlementAmount, totalPaid, paymentMethod },
        },
      });

      return { payment: createdPayment, nextStatus: computedStatus };
    });

    return NextResponse.json({
      success: true,
      paymentId: payment.id,
      status: nextStatus,
      message:
        nextStatus === "PAID"
          ? `Invoice #${invoice.invoiceNumber} settled in full.`
          : `Partial payment recorded for invoice #${invoice.invoiceNumber}.`,
    });
  } catch (error: any) {
    console.error("Super Admin Record Settlement API Error:", error);
    return NextResponse.json({ error: safeErrorMessage(error, "Failed to record payment settlement") }, { status: 500 });
  }
}

