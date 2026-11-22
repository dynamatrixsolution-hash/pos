import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";

// GET /api/v1/notifications - Role & user scoped live notification inbox
export async function GET(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  try {
    const { searchParams } = new URL(request.url);
    const limitRaw = parseInt(searchParams.get("limit") || "25", 10);
    const limit = Number.isInteger(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 50) : 25;
    const roleUpper = context.role.toUpperCase();
    const now = new Date();

    const baseWhere: any = {
      businessId: context.businessId,
      guestSessionId: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      AND: [
        {
          OR: [
            { userId: context.userId },
            { userId: null, targetRoles: { isEmpty: true } },
            { userId: null, targetRoles: { has: roleUpper } },
          ],
        },
      ],
    };

    const [notifications, unreadCount] = await Promise.all([
      db.notification.findMany({
        where: baseWhere,
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      db.notification.count({
        where: { ...baseWhere, isRead: false },
      }),
    ]);

    return NextResponse.json({ notifications, unreadCount });
  } catch (error) {
    console.error("GET /api/v1/notifications error:", error);
    return NextResponse.json({ error: "Failed to load notifications" }, { status: 500 });
  }
}

// PATCH /api/v1/notifications - Mark single notification or all as read
export async function PATCH(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  try {
    const body = await request.json().catch(() => ({}));
    const { id, markAll } = body as { id?: string; markAll?: boolean };
    const roleUpper = context.role.toUpperCase();

    if (markAll) {
      await db.notification.updateMany({
        where: {
          businessId: context.businessId,
          guestSessionId: null,
          isRead: false,
          OR: [
            { userId: context.userId },
            { userId: null, targetRoles: { isEmpty: true } },
            { userId: null, targetRoles: { has: roleUpper } },
          ],
        },
        data: { isRead: true },
      });
      return NextResponse.json({ success: true });
    }

    if (!id) {
      return NextResponse.json({ error: "Notification id or markAll is required" }, { status: 400 });
    }

    await db.notification.updateMany({
      where: { id, businessId: context.businessId },
      data: { isRead: true },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PATCH /api/v1/notifications error:", error);
    return NextResponse.json({ error: "Failed to update notification state" }, { status: 500 });
  }
}
