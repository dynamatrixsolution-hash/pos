import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";

// GET /api/v1/notifications/broadcasts
export async function GET() {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  try {
    const now = new Date();

    // Determine tenant package type if businessId exists
    let packageType = "RESTAURANT";
    if (context.businessId) {
      const business = await db.business.findUnique({
        where: { id: context.businessId },
        select: {
          subscription: {
            select: { packageType: true },
          },
        },
      });
      if (business?.subscription?.packageType) {
        packageType = business.subscription.packageType;
      }
    }

    // Query active notices where startsAt <= now and (expiresAt is null or > now)
    const notices = await db.platformNotice.findMany({
      where: {
        isActive: true,
        startsAt: { lte: now },
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: now } },
        ],
      },
      orderBy: [
        { priority: "desc" },
        { createdAt: "desc" },
      ],
      select: {
        id: true,
        title: true,
        subheading: true,
        body: true,
        priority: true,
        audience: true,
        targetRoles: true,
        channels: true,
        createdAt: true,
      },
    });

    // Filter by audience matching tenant package and role
    const filtered = notices.filter((notice) => {
      // Check audience
      if (notice.audience !== "ALL") {
        if (notice.audience === "RESTAURANT_ONLY" && packageType !== "RESTAURANT") return false;
        if (notice.audience === "HOTEL_ONLY" && packageType !== "HOTEL") return false;
        if (notice.audience === "BOTH_ONLY" && packageType !== "BOTH") return false;
      }

      // Check role targeting
      if (notice.targetRoles && notice.targetRoles.length > 0) {
        const roleAllowed = notice.targetRoles.includes("ALL") || notice.targetRoles.includes(context.role);
        if (!roleAllowed) return false;
      }

      return true;
    });

    return NextResponse.json({ broadcasts: filtered });
  } catch (error: any) {
    console.error("GET broadcasts error:", error);
    return NextResponse.json({ error: error.message || "Failed to load broadcast notices" }, { status: 500 });
  }
}
