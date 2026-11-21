import { NextResponse } from "next/server";
import crypto from "crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse, requireRoles, ROLE_GROUPS } from "@/lib/api-helper";
import { DEFAULT_SUBSCRIPTION_PLANS } from "@/lib/subscription-plans";

const upgradeRequestSchema = z.object({
  plan: z.string().trim().min(1, "Plan is required"),
  billingCycle: z.enum(["MONTHLY", "ANNUAL"]).default("MONTHLY"),
  paymentMethod: z.enum(["BANK_TRANSFER", "FONEPAY", "ESEWA", "KHALTI"]).default("BANK_TRANSFER"),
  paymentReference: z.string().trim().min(3, "Payment transaction reference / voucher ID is required"),
  notes: z.string().trim().max(300).optional(),
});

async function loadConfiguredPlans() {
  const configRecord = await db.platformSetting.findUnique({
    where: { key: "SUBSCRIPTION_CONFIG" },
  });
  const settings = (configRecord?.value as any) || {};
  return Array.isArray(settings.plans) && settings.plans.length > 0
    ? settings.plans
    : DEFAULT_SUBSCRIPTION_PLANS;
}

export async function GET() {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  try {
    const [subscription, branchCount, userCount, plans, pendingUpgradeInvoice, invoices] = await Promise.all([
      db.subscription.findUnique({
        where: { businessId: context.businessId },
      }),
      db.branch.count({
        where: { businessId: context.businessId, deletedAt: null },
      }),
      db.user.count({
        where: { businessId: context.businessId, deletedAt: null },
      }),
      loadConfiguredPlans(),
      db.subscriptionInvoice.findFirst({
        where: {
          businessId: context.businessId,
          status: "PENDING",
          notes: { startsWith: "UPGRADE_REQUEST:" },
        },
        orderBy: { createdAt: "desc" },
      }),
      db.subscriptionInvoice.findMany({
        where: { businessId: context.businessId },
        include: {
          payments: {
            select: { id: true, amount: true, paymentMethod: true, reference: true, recordedAt: true },
            orderBy: { recordedAt: "desc" },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ]);

    if (!subscription) {
      return NextResponse.json({ error: "No active subscription found" }, { status: 404 });
    }

    return NextResponse.json({
      subscription,
      metrics: {
        branchCount,
        userCount,
      },
      plans,
      pendingUpgradeInvoice: pendingUpgradeInvoice
        ? {
            id: pendingUpgradeInvoice.id,
            invoiceNumber: pendingUpgradeInvoice.invoiceNumber,
            amount: Number(pendingUpgradeInvoice.amount),
            currency: pendingUpgradeInvoice.currency,
            status: pendingUpgradeInvoice.status,
            notes: pendingUpgradeInvoice.notes,
            createdAt: pendingUpgradeInvoice.createdAt,
          }
        : null,
      invoices: invoices.map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        amount: Number(inv.amount),
        currency: inv.currency,
        status: inv.status,
        billingPeriodStart: inv.billingPeriodStart,
        billingPeriodEnd: inv.billingPeriodEnd,
        dueDate: inv.dueDate,
        paidAt: inv.paidAt,
        notes: inv.notes,
        payments: inv.payments.map((p) => ({
          id: p.id,
          amount: Number(p.amount),
          paymentMethod: p.paymentMethod,
          reference: p.reference,
          recordedAt: p.recordedAt,
        })),
      })),
    });
  } catch (error: any) {
    console.error("GET subscription error:", error);
    return NextResponse.json({ error: "Failed to fetch subscription details" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();
  const denied = requireRoles(context, ROLE_GROUPS.OWNER_ONLY);
  if (denied) return denied;

  try {
    const body = await request.json();
    const parsed = upgradeRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Payment reference and valid plan selection are required." },
        { status: 400 }
      );
    }

    const { plan, billingCycle, paymentMethod, paymentReference, notes } = parsed.data;

    const [business, subscription, configuredPlans, existingPending] = await Promise.all([
      db.business.findUnique({ where: { id: context.businessId }, select: { id: true, name: true } }),
      db.subscription.findUnique({ where: { businessId: context.businessId } }),
      loadConfiguredPlans(),
      db.subscriptionInvoice.findFirst({
        where: {
          businessId: context.businessId,
          status: "PENDING",
          notes: { startsWith: "UPGRADE_REQUEST:" },
        },
      }),
    ]);

    if (!business || !subscription) {
      return NextResponse.json({ error: "Active business subscription not found" }, { status: 404 });
    }

    if (existingPending) {
      return NextResponse.json(
        { error: `Upgrade invoice ${existingPending.invoiceNumber} is already pending payment verification.` },
        { status: 409 }
      );
    }

    const targetPlan = configuredPlans.find(
      (p: any) =>
        p.id?.toUpperCase() === plan.toUpperCase() ||
        p.name?.toUpperCase() === plan.toUpperCase()
    );
    if (!targetPlan) {
      return NextResponse.json({ error: "Selected subscription plan does not exist." }, { status: 400 });
    }

    if (subscription.plan.toUpperCase() === targetPlan.name.toUpperCase()) {
      return NextResponse.json({ error: "You are already on this subscription plan." }, { status: 400 });
    }

    const amount =
      billingCycle === "ANNUAL"
        ? Number(targetPlan.priceAnnual || Number(targetPlan.priceMonthly || 0) * 10)
        : Number(targetPlan.priceMonthly || 0);

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + (billingCycle === "ANNUAL" ? 12 : 1));
    const dueDate = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const suffix = crypto.randomInt(1000, 9999);
    const invoiceNumber = `INV-UPG-${now.getFullYear()}-${suffix}`;
    const ticketNumber = `TICK-UPG-${now.getFullYear()}-${suffix}`;

    const invoice = await db.$transaction(async (tx) => {
      const createdInvoice = await tx.subscriptionInvoice.create({
        data: {
          businessId: business.id,
          subscriptionId: subscription.id,
          invoiceNumber,
          amount,
          currency: targetPlan.currency || "NPR",
          status: "PENDING",
          billingPeriodStart: now,
          billingPeriodEnd: periodEnd,
          dueDate,
          notes: `UPGRADE_REQUEST:${targetPlan.name.toUpperCase()}:${billingCycle} | Method: ${paymentMethod} | Ref: ${paymentReference}${notes ? ` | ${notes}` : ""}`,
        },
      });

      await tx.platformSupportTicket.create({
        data: {
          ticketNumber,
          businessId: business.id,
          userId: context.userId,
          subject: `Plan Upgrade Request: ${business.name} -> ${targetPlan.name} (${billingCycle})`,
          category: "BILLING",
          priority: "HIGH",
          status: "OPEN",
          description: `Owner requested upgrade from ${subscription.plan} to ${targetPlan.name} (${billingCycle}). Amount: ${targetPlan.currency || "NPR"} ${amount.toLocaleString()}. Payment Method: ${paymentMethod}, Reference: ${paymentReference}. Invoice: ${invoiceNumber}.${notes ? ` Notes: ${notes}` : ""}`,
        },
      });

      await tx.auditLog.create({
        data: {
          businessId: business.id,
          userId: context.userId,
          role: context.role,
          action: "PLAN_UPGRADE_REQUESTED",
          module: "SUBSCRIPTION",
          details: `Submitted upgrade request to ${targetPlan.name} (${billingCycle}) with payment ref ${paymentReference} (${invoiceNumber}).`,
        },
      });

      return createdInvoice;
    });

    return NextResponse.json(
      {
        pendingApproval: true,
        invoice: {
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          amount: Number(invoice.amount),
          currency: invoice.currency,
          status: invoice.status,
        },
        message: `Upgrade request (${invoice.invoiceNumber}) submitted. Your plan will activate once payment is verified by RestroInn Billing.`,
      },
      { status: 202 }
    );
  } catch (error: any) {
    console.error("PUT subscription upgrade request error:", error);
    return NextResponse.json({ error: "Failed to submit subscription upgrade request" }, { status: 500 });
  }
}
