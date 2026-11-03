import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse, roleErrorResponse } from "@/lib/api-helper";

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

    const settlementAmount = amount ? Number(amount) : Number(invoice.amount);

    const payment = await db.subscriptionPayment.create({
      data: {
        businessId: invoice.businessId,
        invoiceId: invoice.id,
        amount: settlementAmount,
        currency: invoice.currency || "NPR",
        paymentMethod: paymentMethod,
        reference: reference || `SETTLE-${Date.now().toString().slice(-6)}`,
        notes: notes || "Settled by Super Admin",
        recordedById: context.userId,
      },
    });

    await db.subscriptionInvoice.update({
      where: { id: invoice.id },
      data: {
        status: "PAID",
        paidAt: new Date(),
      },
    });

    // Update active business subscription if overdue
    await db.subscription.updateMany({
      where: { businessId: invoice.businessId, status: "OVERDUE" },
      data: { status: "ACTIVE" },
    });

    // Audit log
    await db.platformAuditLog.create({
      data: {
        action: "PAYMENT_SETTLED",
        businessId: invoice.businessId,
        actorId: context.userId,
        actorRole: "SUPER_ADMIN",
        targetType: "SUBSCRIPTION_INVOICE",
        targetId: invoice.id,
        reason: `Settled invoice #${invoice.invoiceNumber} for NPR ${settlementAmount}`,
        afterState: { status: "PAID", amount: settlementAmount, paymentMethod },
      },
    });

    return NextResponse.json({
      success: true,
      paymentId: payment.id,
      message: `Invoice #${invoice.invoiceNumber} settled successfully.`,
    });
  } catch (error: any) {
    console.error("Super Admin Record Settlement API Error:", error);
    return NextResponse.json({ error: error.message || "Failed to record payment settlement" }, { status: 500 });
  }
}

