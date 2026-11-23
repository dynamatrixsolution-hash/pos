import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse, roleErrorResponse } from "@/lib/api-helper";
import { dispatchNotification } from "@/lib/notifications";

const sendPushSchema = z.object({
  audience: z.enum([
    "ALL_CUSTOMERS",
    "INACTIVE_CUSTOMERS",
    "ALL_STAFF",
    "STAFF_ROLE",
    "INDIVIDUAL_STAFF",
  ]),
  title: z.string().trim().min(3, "Title must be at least 3 characters").max(120),
  message: z.string().trim().min(5, "Message must be at least 5 characters").max(500),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional().default("HIGH"),
  targetRoles: z.array(z.string()).optional().default([]),
  userIds: z.array(z.string()).optional().default([]),
  inactiveDays: z.number().int().min(1).max(90).optional().default(3),
  actionUrl: z.string().trim().max(200).optional(),
  imageUrl: z.string().trim().max(500000).optional().nullable(),
});

// GET /api/v1/notifications/send — Audience counts, staff roster & sent history for Business Push Hub
export async function GET() {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();
  if (!["OWNER", "MANAGER", "SUPER_ADMIN"].includes(context.role.toUpperCase())) {
    return roleErrorResponse();
  }

  try {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const [totalCustomers, inactive3DaysCount, guestPushDevices, staffMembers, recentSent] =
      await Promise.all([
        db.customer.count({
          where: { businessId: context.businessId, deletedAt: null },
        }),
        db.customer.count({
          where: {
            businessId: context.businessId,
            deletedAt: null,
            updatedAt: { lte: threeDaysAgo },
          },
        }),
        db.devicePushToken.count({
          where: {
            businessId: context.businessId,
            guestSessionId: { not: null },
            isActive: true,
          },
        }),
        db.user.findMany({
          where: {
            businessId: context.businessId,
            deletedAt: null,
            role: { not: "SUPER_ADMIN" },
          },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
          orderBy: [{ role: "asc" }, { name: "asc" }],
        }),
        db.notification.findMany({
          where: {
            businessId: context.businessId,
            category: { in: ["OFFER", "BROADCAST"] },
          },
          orderBy: { createdAt: "desc" },
          take: 25,
          select: {
            id: true,
            title: true,
            message: true,
            category: true,
            priority: true,
            targetRoles: true,
            userId: true,
            metadata: true,
            createdAt: true,
          },
        }),
      ]);

    return NextResponse.json({
      totalCustomers,
      inactive3DaysCount,
      guestPushDevices,
      staffMembers,
      recentSent,
    });
  } catch (error) {
    console.error("GET /api/v1/notifications/send error:", error);
    return NextResponse.json({ error: "Failed to load push notification hub data" }, { status: 500 });
  }
}

// POST /api/v1/notifications/send — Unified foreground + background push to Customers OR Staff (all/role/individual)
export async function POST(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();
  if (!["OWNER", "MANAGER", "SUPER_ADMIN"].includes(context.role.toUpperCase())) {
    return roleErrorResponse();
  }

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = sendPushSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid notification payload" },
        { status: 400 }
      );
    }

    const { audience, title, message, priority, targetRoles, userIds, inactiveDays, actionUrl, imageUrl } =
      parsed.data;
    const cleanImageUrl = imageUrl && imageUrl.trim() ? imageUrl.trim() : null;

    const hourBucket = new Date().toISOString().slice(0, 13);
    const dedupeBase = `biz-push:${context.businessId}:${audience}:${title.toLowerCase().slice(0, 40)}:${hourBucket}`;

    // 1. CUSTOMER AUDIENCES (Promotional offers & 3-4 day return reminders)
    if (audience === "ALL_CUSTOMERS" || audience === "INACTIVE_CUSTOMERS") {
      const cutoff = new Date(Date.now() - inactiveDays * 24 * 60 * 60 * 1000);
      const targetedCustomers = await db.customer.count({
        where: {
          businessId: context.businessId,
          deletedAt: null,
          ...(audience === "INACTIVE_CUSTOMERS" ? { updatedAt: { lte: cutoff } } : {}),
        },
      });

      const guestTokens = await db.devicePushToken.findMany({
        where: {
          businessId: context.businessId,
          guestSessionId: { not: null },
          isActive: true,
        },
        select: { guestSessionId: true },
        distinct: ["guestSessionId"],
        take: 250,
      });

      const campaign = await dispatchNotification({
        businessId: context.businessId,
        targetRoles: ["OWNER", "MANAGER"],
        category: "OFFER",
        priority,
        title,
        message,
        metadata: {
          audience,
          inactiveDays,
          targetedCustomers,
          pushRecipients: guestTokens.length,
          sentBy: context.userId,
          ...(cleanImageUrl ? { imageUrl: cleanImageUrl } : {}),
        },
        dedupeKey: `${dedupeBase}:campaign`,
      });

      let pushDispatched = 0;
      if (!campaign.skipped && guestTokens.length > 0) {
        const results = await Promise.all(
          guestTokens
            .filter((t) => Boolean(t.guestSessionId))
            .map((t) =>
              dispatchNotification({
                businessId: context.businessId,
                guestSessionId: t.guestSessionId!,
                category: "OFFER",
                priority,
                title,
                message,
                metadata: cleanImageUrl ? { imageUrl: cleanImageUrl } : undefined,
                dedupeKey: `${dedupeBase}:${t.guestSessionId}`,
              })
            )
        );
        pushDispatched = results.filter((r) => !r.skipped).length;
      }

      return NextResponse.json(
        {
          success: true,
          skipped: campaign.skipped,
          recipientCount: targetedCustomers,
          pushDispatched,
        },
        { status: 201 }
      );
    }

    // 2. INDIVIDUAL STAFF MEMBERS
    if (audience === "INDIVIDUAL_STAFF") {
      if (userIds.length === 0) {
        return NextResponse.json(
          { error: "Select at least one employee to notify." },
          { status: 400 }
        );
      }

      const validUsers = await db.user.findMany({
        where: {
          businessId: context.businessId,
          id: { in: userIds },
          deletedAt: null,
        },
        select: { id: true, name: true, role: true },
      });

      if (validUsers.length === 0) {
        return NextResponse.json({ error: "No matching employees found." }, { status: 404 });
      }

      const results = await Promise.all(
        validUsers.map((u) =>
          dispatchNotification({
            businessId: context.businessId,
            userId: u.id,
            category: "BROADCAST",
            priority,
            title,
            message,
            actionUrl: actionUrl || "/dashboard",
            metadata: {
              audience: "INDIVIDUAL_STAFF",
              recipientName: u.name,
              recipientRole: u.role,
              sentBy: context.userId,
            },
            dedupeKey: `${dedupeBase}:u:${u.id}`,
          })
        )
      );

      const sent = results.filter((r) => !r.skipped).length;
      return NextResponse.json(
        {
          success: true,
          skipped: sent === 0,
          recipientCount: validUsers.length,
          pushDispatched: sent,
        },
        { status: 201 }
      );
    }

    // 3. ALL STAFF OR SPECIFIC ROLES
    const resolvedRoles =
      audience === "STAFF_ROLE"
        ? targetRoles.map((r) => r.toUpperCase()).filter(Boolean)
        : ["OWNER", "MANAGER", "CASHIER", "WAITER", "KITCHEN", "ACCOUNTANT", "FRONT_DESK", "HOUSEKEEPING"];

    if (audience === "STAFF_ROLE" && resolvedRoles.length === 0) {
      return NextResponse.json(
        { error: "Select at least one staff role." },
        { status: 400 }
      );
    }

    const staffCount = await db.user.count({
      where: {
        businessId: context.businessId,
        deletedAt: null,
        role: { in: resolvedRoles as any },
      },
    });

    const result = await dispatchNotification({
      businessId: context.businessId,
      targetRoles: resolvedRoles,
      category: "BROADCAST",
      priority,
      title,
      message,
      actionUrl: actionUrl || "/dashboard",
      metadata: {
        audience,
        roles: resolvedRoles,
        recipientCount: staffCount,
        sentBy: context.userId,
      },
      dedupeKey: `${dedupeBase}:roles:${resolvedRoles.sort().join(",")}`,
    });

    return NextResponse.json(
      {
        success: true,
        skipped: result.skipped,
        recipientCount: staffCount,
        pushDispatched: result.skipped ? 0 : 1,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/v1/notifications/send error:", error);
    return NextResponse.json({ error: "Failed to dispatch notification" }, { status: 500 });
  }
}
