import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse, roleErrorResponse } from "@/lib/api-helper";
import { z } from "zod";

const actionSchema = z.object({
  action: z.enum(["send_reminder", "send_bulk_reminders", "extend_subscription"]),
  businessId: z.string().optional(),
  days: z.number().int().min(1).max(365).optional(),
  reason: z.string().min(5, "Rationale must be at least 5 characters long").optional(),
});

export async function GET(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();
  if (context.role !== "SUPER_ADMIN") return roleErrorResponse();

  try {
    const { searchParams } = new URL(request.url);
    const timeframe = searchParams.get("timeframe") || "all";
    const search = searchParams.get("search") || "";

    const businesses = await db.business.findMany({
      where: {
        slug: { not: "platform-admin" },
        deletedAt: null,
      },
      include: {
        subscription: {
          select: {
            id: true,
            plan: true,
            status: true,
            startDate: true,
            endDate: true,
            billingCycle: true,
            trialEndsAt: true,
            userLimit: true,
            branchLimit: true,
            packageType: true,
          },
        },
        users: {
          where: { role: "OWNER" },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            isActive: true,
          },
        },
        _count: {
          select: {
            branches: true,
            users: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const now = new Date();
    const nowTime = now.getTime();

    // Map and compute urgency and daysLeft
    const mapped = businesses
      .filter((b) => b.subscription)
      .map((b) => {
        const sub = b.subscription!;
        const end = new Date(sub.endDate);
        const diffMs = end.getTime() - nowTime;
        const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        let urgency: "CRITICAL" | "AT_RISK" | "EXPIRING_SOON" | "EXPIRED" | "HEALTHY" = "HEALTHY";
        if (daysLeft < 0 || sub.status === "EXPIRED") {
          urgency = "EXPIRED";
        } else if (daysLeft <= 7) {
          urgency = "CRITICAL";
        } else if (daysLeft <= 14) {
          urgency = "AT_RISK";
        } else if (daysLeft <= 30) {
          urgency = "EXPIRING_SOON";
        }

        const owner = b.users?.[0] || null;

        return {
          id: b.id,
          name: b.name,
          slug: b.slug,
          email: b.email,
          phone: b.phone,
          address: b.address,
          currency: b.currency,
          createdAt: b.createdAt,
          subscription: {
            ...sub,
            daysLeft,
            urgency,
          },
          owner,
          branchesCount: b._count.branches,
          usersCount: b._count.users,
        };
      });

    // Counts across full set
    const counts = {
      critical: mapped.filter((b) => b.subscription.daysLeft >= 0 && b.subscription.daysLeft <= 7).length,
      atRisk: mapped.filter((b) => b.subscription.daysLeft >= 8 && b.subscription.daysLeft <= 14).length,
      expiringSoon: mapped.filter((b) => b.subscription.daysLeft >= 0 && b.subscription.daysLeft <= 30).length,
      expired: mapped.filter((b) => b.subscription.daysLeft < 0 || b.subscription.status === "EXPIRED").length,
      total: mapped.length,
    };

    // Filter by timeframe
    let filtered = mapped;
    if (timeframe === "critical") {
      filtered = mapped.filter((b) => b.subscription.daysLeft >= 0 && b.subscription.daysLeft <= 7);
    } else if (timeframe === "risk") {
      filtered = mapped.filter((b) => b.subscription.daysLeft >= 8 && b.subscription.daysLeft <= 14);
    } else if (timeframe === "soon") {
      filtered = mapped.filter((b) => b.subscription.daysLeft >= 15 && b.subscription.daysLeft <= 30);
    } else if (timeframe === "expired") {
      filtered = mapped.filter((b) => b.subscription.daysLeft < 0 || b.subscription.status === "EXPIRED");
    } else {
      // Default "all": show expiring within 30 days or already expired
      filtered = mapped.filter((b) => b.subscription.daysLeft <= 30 || b.subscription.status === "EXPIRED");
    }

    // Filter by search query
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      filtered = filtered.filter(
        (b) =>
          b.name.toLowerCase().includes(q) ||
          b.slug.toLowerCase().includes(q) ||
          (b.email && b.email.toLowerCase().includes(q)) ||
          (b.owner?.name && b.owner.name.toLowerCase().includes(q)) ||
          (b.owner?.email && b.owner.email.toLowerCase().includes(q))
      );
    }

    // Sort by daysLeft ascending (most urgent first)
    filtered.sort((a, b) => a.subscription.daysLeft - b.subscription.daysLeft);

    return NextResponse.json({
      counts,
      businesses: filtered,
    });
  } catch (error: any) {
    console.error("GET expiring businesses error:", error);
    return NextResponse.json({ error: "Failed to fetch expiring businesses" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();
  if (context.role !== "SUPER_ADMIN") return roleErrorResponse();

  try {
    const body = await request.json();
    const result = actionSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.format() },
        { status: 400 }
      );
    }

    const { action, businessId, days, reason } = result.data;

    if (action === "extend_subscription") {
      if (!businessId) {
        return NextResponse.json({ error: "businessId is required" }, { status: 400 });
      }
      if (!days || days <= 0) {
        return NextResponse.json({ error: "Valid extension days required" }, { status: 400 });
      }
      if (!reason || reason.trim().length < 5) {
        return NextResponse.json({ error: "Audit rationale of at least 5 characters is required" }, { status: 400 });
      }

      const business = await db.business.findUnique({
        where: { id: businessId },
        include: { subscription: true },
      });

      if (!business || !business.subscription) {
        return NextResponse.json({ error: "Business or subscription not found" }, { status: 404 });
      }

      const currentEnd = new Date(business.subscription.endDate);
      const baseDate = currentEnd.getTime() < Date.now() ? new Date() : currentEnd;
      const newEndDate = new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000);

      const updated = await db.subscription.update({
        where: { businessId },
        data: {
          endDate: newEndDate,
          status: "ACTIVE",
        },
      });

      // Record audit log
      await db.platformAuditLog.create({
        data: {
          actorId: context.userId,
          actorRole: "SUPER_ADMIN",
          action: "SUBSCRIPTION_EXTENDED",
          targetType: "SUBSCRIPTION",
          targetId: business.subscription.id,
          businessId: business.id,
          reason: `Extended subscription by ${days} days until ${newEndDate.toISOString().split("T")[0]}. Rationale: ${reason.trim()}`,
        },
      });

      return NextResponse.json({
        success: true,
        message: `Subscription extended successfully by ${days} days`,
        subscription: updated,
      });
    }

    if (action === "send_reminder") {
      if (!businessId) {
        return NextResponse.json({ error: "businessId is required" }, { status: 400 });
      }

      const business = await db.business.findUnique({
        where: { id: businessId },
        include: { subscription: true, users: { where: { role: "OWNER" } } },
      });

      if (!business) {
        return NextResponse.json({ error: "Business not found" }, { status: 404 });
      }

      const endDate = business.subscription?.endDate
        ? new Date(business.subscription.endDate).toLocaleDateString()
        : "soon";

      // Create a notice specifically for this business
      await db.platformNotice.create({
        data: {
          title: `Subscription Renewal Notice: ${business.name}`,
          subheading: `Plan expiration on ${endDate}`,
          body: `Your subscription plan (${business.subscription?.plan || "Standard"}) is scheduled to expire on ${endDate}. Please renew promptly to ensure uninterrupted access to POS, Hotel, and Dining services.`,
          priority: "WARNING",
          audience: "ALL",
          targetRoles: ["OWNER"],
          channels: ["IN_APP"],
          expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          isActive: true,
          createdById: context.userId,
        },
      });

      // Audit log
      await db.platformAuditLog.create({
        data: {
          actorId: context.userId,
          actorRole: "SUPER_ADMIN",
          action: "RENEWAL_REMINDER_SENT",
          targetType: "BUSINESS",
          targetId: business.id,
          businessId: business.id,
          reason: `Dispatched subscription renewal reminder to ${business.name} (expires ${endDate})`,
        },
      });

      return NextResponse.json({
        success: true,
        message: `Renewal reminder dispatched to ${business.name}`,
      });
    }

    if (action === "send_bulk_reminders") {
      // Find all businesses expiring in <= 30 days
      const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const expiringBusinesses = await db.business.findMany({
        where: {
          slug: { not: "platform-admin" },
          subscription: {
            endDate: { lte: thirtyDaysFromNow },
          },
        },
        include: { subscription: true },
      });

      if (expiringBusinesses.length === 0) {
        return NextResponse.json({
          success: true,
          message: "No businesses require renewal reminders at this time",
          dispatchedCount: 0,
        });
      }

      // Create platform notice
      await db.platformNotice.create({
        data: {
          title: "Platform Notice: Subscription Renewal Reminder",
          subheading: "Subscriptions nearing renewal date",
          body: "Some business subscriptions are nearing their expiry dates within the next 30 days. Please verify your billing details and renew ahead of schedule to avoid service disruptions.",
          priority: "WARNING",
          audience: "ALL",
          targetRoles: ["OWNER", "MANAGER"],
          channels: ["IN_APP"],
          expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          isActive: true,
          createdById: context.userId,
        },
      });

      // Audit log
      await db.platformAuditLog.create({
        data: {
          actorId: context.userId,
          actorRole: "SUPER_ADMIN",
          action: "BULK_RENEWAL_REMINDERS_SENT",
          targetType: "SUBSCRIPTION",
          reason: `Dispatched bulk renewal reminders to ${expiringBusinesses.length} tenants expiring within 30 days`,
        },
      });

      return NextResponse.json({
        success: true,
        message: `Dispatched bulk renewal reminders to ${expiringBusinesses.length} tenants`,
        dispatchedCount: expiringBusinesses.length,
      });
    }

    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  } catch (error: any) {
    console.error("POST expiring businesses action error:", error);
    return NextResponse.json({ error: "Failed to process renewal action" }, { status: 500 });
  }
}
