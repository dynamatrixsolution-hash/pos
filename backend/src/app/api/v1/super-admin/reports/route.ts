import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse, roleErrorResponse } from "@/lib/api-helper";

// Helper to calculate date range based on period
function getDateRange(period: string, customStart?: string | null, customEnd?: string | null) {
  const now = new Date();
  let start: Date;
  let end: Date = new Date();

  switch (period) {
    case "day": {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      break;
    }
    case "week": {
      // Last 7 days
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    }
    case "month": {
      // Last 30 days
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    }
    case "year": {
      // Last 365 days
      start = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      break;
    }
    case "custom": {
      start = customStart ? new Date(customStart) : new Date(0);
      end = customEnd ? new Date(customEnd) : new Date();
      break;
    }
    case "all":
    default: {
      start = new Date(0);
      break;
    }
  }

  return { start, end };
}

// GET /api/v1/super-admin/reports
export async function GET(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();
  if (context.role !== "SUPER_ADMIN") return roleErrorResponse();

  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "month";
    const customStart = searchParams.get("startDate");
    const customEnd = searchParams.get("endDate");
    const dataset = searchParams.get("dataset") || "all";

    const { start, end } = getDateRange(period, customStart, customEnd);

    // Date filters for queries
    const dateFilterCreatedAt = {
      createdAt: {
        gte: start,
        lte: end,
      },
    };

    // 1. Fetch Invoices & Revenue
    const invoices = await db.subscriptionInvoice.findMany({
      where: period === "all" ? {} : dateFilterCreatedAt,
      orderBy: { createdAt: "desc" },
      include: {
        business: { select: { id: true, name: true, slug: true } },
        subscription: { select: { plan: true, packageType: true } },
        payments: { select: { paymentMethod: true, reference: true, amount: true, recordedAt: true } },
      },
    });

    // 2. Fetch Businesses
    const businesses = await db.business.findMany({
      where: period === "all" ? {} : dateFilterCreatedAt,
      orderBy: { createdAt: "desc" },
      include: {
        branches: { select: { id: true, name: true } },
        users: { where: { role: "OWNER" }, select: { name: true, email: true, phone: true } },
        subscription: { select: { plan: true, status: true, packageType: true, endDate: true } },
      },
    });

    // All-time counts for context
    const [totalAllTimeBusinesses, restroAllCount, hotelAllCount, bothAllCount] = await Promise.all([
      db.business.count(),
      db.subscription.count({ where: { packageType: "RESTAURANT" } }),
      db.subscription.count({ where: { packageType: "HOTEL" } }),
      db.subscription.count({ where: { packageType: "BOTH" } }),
    ]);

    // 3. Fetch Support Tickets in period
    const tickets = await db.platformSupportTicket.findMany({
      where: period === "all" ? {} : dateFilterCreatedAt,
      orderBy: { createdAt: "desc" },
      include: {
        business: { select: { name: true, slug: true } },
      },
    });

    // 4. Fetch Platform Audit Logs in period
    const auditLogs = await db.platformAuditLog.findMany({
      where: period === "all" ? {} : dateFilterCreatedAt,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        actor: { select: { name: true, email: true } },
        business: { select: { name: true } },
      },
    });

    // Metrics calculations for the selected period
    const collectedRevenueNpr = invoices
      .filter((i) => i.status === "PAID")
      .reduce((sum, i) => sum + Number(i.amount), 0);

    const pendingRevenueNpr = invoices
      .filter((i) => i.status !== "PAID")
      .reduce((sum, i) => sum + Number(i.amount), 0);

    const totalInvoicedNpr = invoices.reduce((sum, i) => sum + Number(i.amount), 0);

    const metrics = {
      period,
      periodLabel:
        period === "day"
          ? "Today"
          : period === "week"
          ? "This Week (Last 7 Days)"
          : period === "month"
          ? "This Month (Last 30 Days)"
          : period === "year"
          ? "This Year (Last 365 Days)"
          : "All Time",
      revenue: {
        collectedNpr: collectedRevenueNpr,
        pendingNpr: pendingRevenueNpr,
        totalInvoicedNpr,
        paidCount: invoices.filter((i) => i.status === "PAID").length,
        pendingCount: invoices.filter((i) => i.status === "PENDING" || i.status === "OVERDUE").length,
      },
      businesses: {
        newInPeriod: businesses.length,
        totalAllTime: totalAllTimeBusinesses,
        restaurant: restroAllCount,
        hotel: hotelAllCount,
        hybrid: bothAllCount,
      },
      support: {
        ticketsInPeriod: tickets.length,
        resolvedInPeriod: tickets.filter((t) => t.status === "RESOLVED" || t.status === "CLOSED").length,
        openInPeriod: tickets.filter((t) => t.status === "OPEN" || t.status === "IN_PROGRESS").length,
      },
      auditCount: auditLogs.length,
    };

    return NextResponse.json({
      metrics,
      invoices: invoices.map((i) => ({
        id: i.id,
        invoiceNumber: i.invoiceNumber,
        businessName: i.business?.name || "Unknown",
        slug: i.business?.slug || "",
        plan: i.subscription?.plan || "STANDARD",
        packageType: i.subscription?.packageType || "RESTAURANT",
        amount: Number(i.amount),
        status: i.status,
        dueDate: i.dueDate,
        paidAt: i.paidAt,
        paymentMethod: i.payments[0]?.paymentMethod || "MANUAL_TRANSFER",
        reference: i.payments[0]?.reference || "",
        createdAt: i.createdAt,
      })),
      businesses: businesses.map((b) => ({
        id: b.id,
        name: b.name,
        slug: b.slug,
        packageType: b.subscription?.packageType || "RESTAURANT",
        status: b.subscription?.status || "ACTIVE",
        ownerName: b.users[0]?.name || "Unassigned",
        ownerEmail: b.users[0]?.email || b.email || "",
        ownerPhone: b.users[0]?.phone || b.phone || "",
        plan: b.subscription?.plan || "STANDARD",
        branchCount: b.branches.length,
        createdAt: b.createdAt,
      })),
      tickets: tickets.map((t) => ({
        id: t.id,
        ticketNumber: t.ticketNumber,
        businessName: t.business?.name || "Unknown",
        subject: t.subject,
        category: t.category,
        priority: t.priority,
        status: t.status,
        createdAt: t.createdAt,
      })),
      auditLogs: auditLogs.map((l) => ({
        id: l.id,
        actor: l.actor?.name || l.actor?.email || "Admin",
        role: l.actorRole,
        action: l.action,
        targetType: l.targetType,
        businessName: l.business?.name || "Global",
        reason: l.reason,
        createdAt: l.createdAt,
      })),
    });
  } catch (error: any) {
    console.error("GET reports error:", error);
    return NextResponse.json({ error: error.message || "Failed to compile reports" }, { status: 500 });
  }
}
