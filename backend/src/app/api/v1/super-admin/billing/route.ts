import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse, roleErrorResponse } from "@/lib/api-helper";
import { logPlatformAudit } from "@/lib/platform-audit";

export async function GET(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();
  if (context.role !== "SUPER_ADMIN") return roleErrorResponse();

  try {
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get("status");

    const whereClause: any = {};
    if (statusFilter && statusFilter !== "ALL") {
      whereClause.status = statusFilter;
    }

    const invoices = await db.subscriptionInvoice.findMany({
      where: whereClause,
      include: {
        business: {
          select: { id: true, name: true, slug: true, currency: true },
        },
        payments: {
          include: {
            recordedBy: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const payments = await db.subscriptionPayment.findMany({
      include: {
        business: {
          select: { id: true, name: true, slug: true },
        },
        invoice: {
          select: { invoiceNumber: true },
        },
        recordedBy: {
          select: { name: true, email: true },
        },
      },
      orderBy: { recordedAt: "desc" },
      take: 50,
    });

    // Compute SaaS ARR & MRR strictly from active subscriptions
    const activeSubs = await db.subscription.findMany({
      where: { status: "ACTIVE" },
      include: { business: true },
    });

    let mrr = 0;
    for (const sub of activeSubs) {
      if (sub.plan === "STARTER") mrr += 2500;
      else if (sub.plan === "PROFESSIONAL") mrr += 5500;
      else if (sub.plan === "ENTERPRISE") mrr += 12000;
    }
    const arr = mrr * 12;

    const totalCollected = payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const totalOutstanding = invoices
      .filter((inv) => inv.status === "PENDING" || inv.status === "OVERDUE")
      .reduce((sum, inv) => {
        const paid = inv.payments.reduce((s, p) => s + Number(p.amount), 0);
        return sum + Math.max(0, Number(inv.amount) - paid);
      }, 0);

    return NextResponse.json({
      metrics: {
        mrr,
        arr,
        totalCollected,
        totalOutstanding,
        activeSubscriptionsCount: activeSubs.length,
        invoicesCount: invoices.length,
        currency: "NPR",
      },
      invoices,
      payments,
    });
  } catch (error: any) {
    console.error("GET SaaS billing error:", error);
    return NextResponse.json({ error: "Failed to fetch platform billing data" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();
  if (context.role !== "SUPER_ADMIN") return roleErrorResponse();

  try {
    const body = await request.json();
    const { action, payload = {} } = body;

    if (action === "CREATE_INVOICE") {
      const {
        businessId,
        amount,
        currency = "NPR",
        dueDate,
        billingPeriodStart,
        billingPeriodEnd,
        notes,
        reason = "Platform subscription invoice issuance",
      } = payload;

      if (!businessId || !amount || Number(amount) <= 0 || !dueDate) {
        return NextResponse.json(
          { error: "Business ID, amount, and due date are required to issue a SaaS invoice." },
          { status: 400 }
        );
      }

      const business = await db.business.findUnique({
        where: { id: businessId },
        include: { subscription: true },
      });

      if (!business) {
        return NextResponse.json({ error: "Target business not found" }, { status: 404 });
      }

      const invCount = await db.subscriptionInvoice.count();
      const invoiceNumber = `INV-SAAS-${new Date().getFullYear()}-${String(invCount + 1).padStart(4, "0")}`;

      const invoice = await db.subscriptionInvoice.create({
        data: {
          businessId,
          subscriptionId: business.subscription?.id || null,
          invoiceNumber,
          amount: Number(amount),
          currency,
          status: "PENDING",
          billingPeriodStart: billingPeriodStart ? new Date(billingPeriodStart) : new Date(),
          billingPeriodEnd: billingPeriodEnd
            ? new Date(billingPeriodEnd)
            : new Date(Date.now() + 30 * 24 * 3600 * 1000),
          dueDate: new Date(dueDate),
          notes: notes?.trim() || null,
        },
      });

      await logPlatformAudit({
        actorId: context.userId,
        actorRole: context.role,
        action: "SAAS_INVOICE_ISSUED",
        targetType: "INVOICE",
        targetId: invoice.id,
        businessId,
        reason: reason.trim(),
        afterState: { invoiceNumber, amount, dueDate },
      });

      return NextResponse.json({
        message: "Platform subscription invoice issued successfully",
        invoice,
      });
    }

    if (action === "RECORD_PAYMENT") {
      const {
        businessId,
        invoiceId,
        amount,
        currency = "NPR",
        paymentMethod = "BANK_TRANSFER",
        reference,
        notes,
        reason = "Recorded manual SaaS subscription payment receipt",
      } = payload;

      if (!invoiceId || !amount || Number(amount) <= 0) {
        return NextResponse.json({ error: "Invoice ID and payment amount are required." }, { status: 400 });
      }

      const invoice = await db.subscriptionInvoice.findUnique({
        where: { id: invoiceId },
        include: { payments: true },
      });

      if (!invoice) {
        return NextResponse.json({ error: "Subscription invoice not found." }, { status: 404 });
      }

      const payment = await db.subscriptionPayment.create({
        data: {
          businessId: invoice.businessId,
          invoiceId,
          amount: Number(amount),
          currency,
          paymentMethod,
          reference: reference?.trim() || null,
          notes: notes?.trim() || null,
          recordedById: context.userId,
        },
      });

      const previousPaid = invoice.payments.reduce((s, p) => s + Number(p.amount), 0);
      const totalPaid = previousPaid + Number(amount);

      let invoiceStatus = invoice.status;
      if (totalPaid >= Number(invoice.amount)) {
        invoiceStatus = "PAID";
        await db.subscriptionInvoice.update({
          where: { id: invoiceId },
          data: { status: "PAID", paidAt: new Date() },
        });
      }

      await logPlatformAudit({
        actorId: context.userId,
        actorRole: context.role,
        action: "SAAS_PAYMENT_RECORDED",
        targetType: "INVOICE",
        targetId: invoiceId,
        businessId: invoice.businessId,
        reason: reason.trim(),
        afterState: { paymentId: payment.id, amount, paymentMethod, reference, invoiceStatus },
      });

      return NextResponse.json({
        message: "Payment receipt recorded successfully",
        payment,
      });
    }

    return NextResponse.json({ error: "Action not recognized" }, { status: 400 });
  } catch (error: any) {
    console.error("POST SaaS billing error:", error);
    return NextResponse.json({ error: error.message || "Failed to process billing request" }, { status: 500 });
  }
}

