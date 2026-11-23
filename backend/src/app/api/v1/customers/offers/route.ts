import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse, roleErrorResponse } from "@/lib/api-helper";
import { dispatchNotification } from "@/lib/notifications";

const sendOfferSchema = z.object({
  title: z.string().trim().min(3, "Offer title must be at least 3 characters").max(120),
  message: z.string().trim().min(5, "Offer details must be at least 5 characters").max(500),
  targetMode: z.enum(["ALL", "INACTIVE_3_DAYS"]).default("ALL"),
  inactiveDays: z.number().int().min(1).max(90).optional().default(3),
});

// GET /api/v1/customers/offers — Customer reach metrics & recent promotional campaigns
export async function GET() {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();
  if (!["OWNER", "MANAGER", "SUPER_ADMIN"].includes(context.role.toUpperCase())) {
    return roleErrorResponse();
  }

  try {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const [totalCustomers, inactive3DaysCount, guestPushDevices, recentOffers] = await Promise.all([
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
      db.notification.findMany({
        where: {
          businessId: context.businessId,
          category: "OFFER",
        },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          title: true,
          message: true,
          metadata: true,
          createdAt: true,
        },
      }),
    ]);

    return NextResponse.json({
      totalCustomers,
      inactive3DaysCount,
      guestPushDevices,
      recentOffers,
    });
  } catch (error) {
    console.error("GET /api/v1/customers/offers error:", error);
    return NextResponse.json({ error: "Failed to load offer stats" }, { status: 500 });
  }
}

// POST /api/v1/customers/offers — Broadcast promotional offer or 3-4 day re-engagement reminder
export async function POST(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();
  if (!["OWNER", "MANAGER", "SUPER_ADMIN"].includes(context.role.toUpperCase())) {
    return roleErrorResponse();
  }

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = sendOfferSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid offer payload" },
        { status: 400 }
      );
    }

    const { title, message, targetMode, inactiveDays } = parsed.data;
    const cutoff = new Date(Date.now() - inactiveDays * 24 * 60 * 60 * 1000);

    const targetedCustomers = await db.customer.count({
      where: {
        businessId: context.businessId,
        deletedAt: null,
        ...(targetMode === "INACTIVE_3_DAYS" ? { updatedAt: { lte: cutoff } } : {}),
      },
    });

    // Find recent guest sessions (active or expired within 30 days) with registered push tokens
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

    const dateBucket = new Date().toISOString().slice(0, 13); // hourly dedupe bucket per offer title
    const dedupeBase = `offer:${context.businessId}:${targetMode}:${title.toLowerCase().slice(0, 40)}:${dateBucket}`;

    // Store campaign record for owner history + dispatch to registered guest push sessions
    const summaryResult = await dispatchNotification({
      businessId: context.businessId,
      targetRoles: ["OWNER", "MANAGER"],
      category: "OFFER",
      title,
      message,
      metadata: {
        targetMode,
        inactiveDays,
        targetedCustomers,
        pushRecipients: guestTokens.length,
        sentBy: context.userId,
      },
      dedupeKey: `${dedupeBase}:campaign`,
    });

    let pushDispatched = 0;
    if (!summaryResult.skipped && guestTokens.length > 0) {
      const results = await Promise.all(
        guestTokens
          .filter((t) => Boolean(t.guestSessionId))
          .map((t) =>
            dispatchNotification({
              businessId: context.businessId,
              guestSessionId: t.guestSessionId!,
              category: "OFFER",
              priority: "HIGH",
              title,
              message,
              dedupeKey: `${dedupeBase}:${t.guestSessionId}`,
            })
          )
      );
      pushDispatched = results.filter((r) => !r.skipped).length;
    }

    return NextResponse.json(
      {
        success: true,
        skipped: summaryResult.skipped,
        targetedCustomers,
        pushDispatched,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/v1/customers/offers error:", error);
    return NextResponse.json({ error: "Failed to send customer offer" }, { status: 500 });
  }
}
