import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse, roleErrorResponse } from "@/lib/api-helper";
import { DEFAULT_SUBSCRIPTION_PLANS } from "@/lib/subscription-plans";

export async function GET(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();
  if (context.role !== "SUPER_ADMIN") return roleErrorResponse();

  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const tenantBusinessWhere = { deletedAt: null, slug: { not: "platform-admin" } };

    // 1. Attention Queues (scoped strictly to active non-platform-admin tenants)
    const [
      pendingApprovalsCount,
      overdueInvoicesCount,
      overdueSubscriptionsCount,
      trialsEndingCount,
      expiringWithin30DaysCount,
      suspendedAccountsCount,
      latestBackup,
    ] = await Promise.all([
      db.businessRegistrationRequest.count({ where: { status: "PENDING" } }),
      db.subscriptionInvoice.count({
        where: {
          business: tenantBusinessWhere,
          OR: [
            { status: "OVERDUE" },
            { status: { in: ["PENDING", "PARTIAL"] }, dueDate: { lt: now } },
          ],
        },
      }),
      db.subscription.count({
        where: { business: tenantBusinessWhere, status: "OVERDUE" },
      }),
      db.subscription.count({
        where: {
          business: tenantBusinessWhere,
          OR: [
            { status: "TRIAL", trialEndsAt: { gte: now, lte: sevenDaysFromNow } },
            { status: "TRIAL", endDate: { gte: now, lte: sevenDaysFromNow } },
          ],
        },
      }),
      db.subscription.count({
        where: {
          business: tenantBusinessWhere,
          endDate: { gte: now, lte: thirtyDaysFromNow },
        },
      }),
      db.business.count({
        where: { ...tenantBusinessWhere, status: "SUSPENDED" },
      }),
      db.platformBackupRecord.findFirst({ orderBy: { createdAt: "desc" } }),
    ]);

    let backupHealth: "HEALTHY" | "WARNING" | "CRITICAL" = "HEALTHY";
    let backupAgeHours = 0;
    if (!latestBackup) {
      backupHealth = "CRITICAL";
    } else {
      backupAgeHours = Math.round((now.getTime() - new Date(latestBackup.createdAt).getTime()) / (1000 * 3600));
      if (backupAgeHours > 24 || !latestBackup.verifiedRestore) {
        backupHealth = "WARNING";
      }
      if (backupAgeHours > 48 || latestBackup.status === "FAILED") {
        backupHealth = "CRITICAL";
      }
    }

    // 2. Core Metrics (100% live database aggregates)
    const [
      totalBusinesses,
      activeBusinesses,
      totalUsers,
      totalBranches,
      allPaymentsSum,
      monthlyPaymentsSum,
      invoicesOutstanding,
      planConfigRecord,
      allTenantBusinesses,
      sixMonthPayments,
    ] = await Promise.all([
      db.business.count({ where: tenantBusinessWhere }),
      db.business.count({ where: { ...tenantBusinessWhere, status: "ACTIVE" } }),
      db.user.count({ where: { deletedAt: null, business: tenantBusinessWhere } }),
      db.branch.count({ where: { deletedAt: null, business: tenantBusinessWhere } }),
      db.subscriptionPayment.aggregate({
        _sum: { amount: true },
        where: { business: tenantBusinessWhere },
      }),
      db.subscriptionPayment.aggregate({
        _sum: { amount: true },
        where: { business: tenantBusinessWhere, recordedAt: { gte: startOfMonth } },
      }),
      db.subscriptionInvoice.aggregate({
        _sum: { amount: true },
        where: {
          business: tenantBusinessWhere,
          status: { in: ["PENDING", "OVERDUE", "PARTIAL"] },
        },
      }),
      db.platformSetting.findUnique({ where: { key: "SUBSCRIPTION_CONFIG" } }),
      db.business.findMany({
        where: tenantBusinessWhere,
        select: {
          createdAt: true,
          status: true,
          subscription: {
            select: { plan: true, status: true, billingCycle: true, endDate: true },
          },
        },
      }),
      db.subscriptionPayment.findMany({
        where: { business: tenantBusinessWhere, recordedAt: { gte: sixMonthsAgo } },
        select: { amount: true, recordedAt: true },
      }),
    ]);

    const totalPlatformRevenue = allPaymentsSum._sum.amount ? Number(allPaymentsSum._sum.amount) : 0;
    const monthlyRevenue = monthlyPaymentsSum._sum.amount ? Number(monthlyPaymentsSum._sum.amount) : 0;
    const totalOutstandingRevenue = invoicesOutstanding._sum.amount ? Number(invoicesOutstanding._sum.amount) : 0;

    // 3. Plan Distribution & Estimated MRR (strictly from real tenant subscriptions)
    const configuredPlans = ((planConfigRecord?.value as any)?.plans as any[]) || DEFAULT_SUBSCRIPTION_PLANS;
    const planCounts: Record<string, number> = {
      STARTER: 0,
      STANDARD: 0,
      PROFESSIONAL: 0,
      ENTERPRISE: 0,
    };

    let estimatedMrr = 0;
    for (const biz of allTenantBusinesses) {
      const sub = biz.subscription;
      if (!sub) continue;

      const rawPlan = (sub.plan || "STARTER").toUpperCase();
      if (["FREE", "FREE_TRIAL", "BASIC", "STARTER"].includes(rawPlan)) planCounts.STARTER++;
      else if (rawPlan === "STANDARD") planCounts.STANDARD++;
      else if (["PRO", "PROFESSIONAL", "PREMIUM"].includes(rawPlan)) planCounts.PROFESSIONAL++;
      else if (rawPlan === "ENTERPRISE") planCounts.ENTERPRISE++;
      else planCounts.STARTER++;

      const isActiveSub =
        biz.status === "ACTIVE" &&
        !["EXPIRED", "CANCELLED", "SUSPENDED"].includes((sub.status || "").toUpperCase()) &&
        new Date(sub.endDate) >= now;

      if (isActiveSub) {
        const matched = configuredPlans.find(
          (p: any) =>
            p.name?.toUpperCase() === rawPlan ||
            p.id?.toUpperCase() === rawPlan ||
            p.tier?.toUpperCase() === rawPlan
        );
        if (matched) {
          estimatedMrr +=
            (sub.billingCycle || "MONTHLY").toUpperCase() === "ANNUAL"
              ? Math.round(Number(matched.priceAnnual || 0) / 12)
              : Number(matched.priceMonthly || 0);
        }
      }
    }

    const totalSubsCount =
      planCounts.STARTER + planCounts.STANDARD + planCounts.PROFESSIONAL + planCounts.ENTERPRISE;
    const denom = totalSubsCount || 1;
    const planDistribution = [
      { name: "Starter", value: totalSubsCount ? Math.round((planCounts.STARTER / denom) * 100) : 0, count: planCounts.STARTER, color: "#71675E" },
      { name: "Standard", value: totalSubsCount ? Math.round((planCounts.STANDARD / denom) * 100) : 0, count: planCounts.STANDARD, color: "#28634B" },
      { name: "Professional", value: totalSubsCount ? Math.round((planCounts.PROFESSIONAL / denom) * 100) : 0, count: planCounts.PROFESSIONAL, color: "#6B2837" },
      { name: "Enterprise", value: totalSubsCount ? Math.round((planCounts.ENTERPRISE / denom) * 100) : 0, count: planCounts.ENTERPRISE, color: "#315F85" },
    ];

    // 4. Real 6-Month Growth Data (actual cumulative tenants & actual collected revenue)
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthlyGrowth = [];
    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
      const mName = monthNames[monthStart.getMonth()];
      const year = monthStart.getFullYear();

      const cumulativeBusinesses = allTenantBusinesses.filter(
        (b) => new Date(b.createdAt) <= monthEnd
      ).length;

      const monthRevenue = sixMonthPayments
        .filter((p) => {
          const pd = new Date(p.recordedAt);
          return pd >= monthStart && pd <= monthEnd;
        })
        .reduce((sum, p) => sum + Number(p.amount || 0), 0);

      monthlyGrowth.push({
        month: `${mName} ${String(year).slice(-2)}`,
        businesses: cumulativeBusinesses,
        revenue: Math.round(monthRevenue),
      });
    }

    // 5. Support Desk Status Widget
    const [openTickets, inProgressTickets, waitingTickets, resolvedTickets] = await Promise.all([
      db.platformSupportTicket.count({ where: { status: "OPEN" } }),
      db.platformSupportTicket.count({ where: { status: "IN_PROGRESS" } }),
      db.platformSupportTicket.count({ where: { status: "WAITING" } }),
      db.platformSupportTicket.count({ where: { status: { in: ["RESOLVED", "CLOSED"] } } }),
    ]);

    // 6. Action Queues Data
    const [urgentRegistrationRequests, overdueInvoicesList, recentAuditActivity, recentBusinesses] = await Promise.all([
      db.businessRegistrationRequest.findMany({
        where: { status: "PENDING" },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      db.subscriptionInvoice.findMany({
        where: {
          business: tenantBusinessWhere,
          OR: [
            { status: "OVERDUE" },
            { status: { in: ["PENDING", "PARTIAL"] }, dueDate: { lt: now } },
          ],
        },
        include: { business: { select: { id: true, name: true, slug: true, email: true } } },
        orderBy: { dueDate: "asc" },
        take: 5,
      }),
      db.platformAuditLog.findMany({
        include: {
          actor: { select: { id: true, name: true, email: true } },
          business: { select: { id: true, name: true, slug: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 6,
      }),
      db.business.findMany({
        where: tenantBusinessWhere,
        orderBy: { createdAt: "desc" },
        take: 8,
        include: {
          subscription: { select: { plan: true, status: true, packageType: true } },
          users: { where: { role: "OWNER", deletedAt: null }, select: { name: true, email: true } },
          _count: {
            select: {
              branches: { where: { deletedAt: null } },
              users: { where: { deletedAt: null } },
            },
          },
        },
      }),
    ]);

    return NextResponse.json({
      attentionQueues: {
        pendingApprovals: {
          count: pendingApprovalsCount,
          link: "/dashboard/super-admin/businesses/pending",
          badgeColor: pendingApprovalsCount > 0 ? "amber" : "neutral",
        },
        overdueSubscriptions: {
          count: overdueInvoicesCount || overdueSubscriptionsCount,
          link: "/dashboard/super-admin/revenue",
          badgeColor: (overdueInvoicesCount || overdueSubscriptionsCount) > 0 ? "rose" : "neutral",
        },
        trialsEnding: {
          count: trialsEndingCount,
          link: "/dashboard/super-admin/businesses/expiring",
          badgeColor: trialsEndingCount > 0 ? "amber" : "neutral",
        },
        expiringWithin30Days: {
          count: expiringWithin30DaysCount,
          link: "/dashboard/super-admin/businesses/expiring",
          badgeColor: expiringWithin30DaysCount > 0 ? "amber" : "neutral",
        },
        suspendedAccounts: {
          count: suspendedAccountsCount,
          link: "/dashboard/super-admin/businesses",
          badgeColor: suspendedAccountsCount > 0 ? "rose" : "neutral",
        },
        backupFreshness: {
          status: backupHealth,
          lastBackupHoursAgo: backupAgeHours,
          verifiedRestore: latestBackup?.verifiedRestore || false,
          restoreTestResult: latestBackup?.restoreTestResult || "NONE",
          link: "/dashboard/super-admin/monitoring",
          badgeColor: backupHealth === "HEALTHY" ? "emerald" : "rose",
        },
      },
      overviewMetrics: {
        totalBusinesses,
        activeBusinesses,
        suspendedBusinesses: suspendedAccountsCount,
        totalUsers,
        totalBranches,
        monthlyRevenue,
        estimatedMrr,
        totalPlatformRevenue,
        totalOutstandingRevenue,
        currency: "NPR",
      },
      analytics: {
        planDistribution,
        monthlyGrowth,
        support: {
          open: openTickets,
          inProgress: inProgressTickets,
          waiting: waitingTickets,
          resolved: resolvedTickets,
        },
      },
      actionLists: {
        urgentRegistrationRequests,
        overdueInvoicesList,
        recentAuditActivity,
        recentBusinesses: recentBusinesses.map((b) => ({
          id: b.id,
          name: b.name,
          slug: b.slug,
          logo: b.logo || null,
          status: b.status || b.subscription?.status || "ACTIVE",
          plan: b.subscription?.plan || "STARTER",
          packageType: b.subscription?.packageType || "RESTAURANT",
          ownerName: b.users[0]?.name || "Unassigned",
          branchesCount: b._count.branches,
          usersCount: b._count.users,
          createdAt: b.createdAt,
        })),
      },
      latestBackup: latestBackup
        ? {
            ...latestBackup,
            sizeBytes: Number(latestBackup.sizeBytes),
          }
        : null,
    });
  } catch (error: any) {
    console.error("Super Admin Dashboard API Error:", error);
    return NextResponse.json({ error: "Failed to load super admin command center" }, { status: 500 });
  }
}
