import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashGuestSecret } from "@/lib/services/guest-portal-service";

function extractGuestToken(req: Request): string | null {
  const headerToken =
    req.headers.get("x-guest-session-token") ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (headerToken) return headerToken.trim();
  const { searchParams } = new URL(req.url);
  return searchParams.get("sessionToken")?.trim() || null;
}

// GET /api/v1/guest/notifications?publicCode=...
// Returns:
// 1. Personal kitchen/order updates for the active guest session (+ table companions) when x-guest-session-token is provided
// 2. Business-wide promotional customer offers (category = "OFFER") for that restaurant
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limitRaw = parseInt(searchParams.get("limit") || "25", 10);
    const limit = Number.isInteger(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 50) : 25;
    const publicCode = searchParams.get("publicCode")?.trim() || null;

    const sessionToken = extractGuestToken(request);
    let businessId: string | null = null;
    let sessionIds: string[] = [];

    if (sessionToken) {
      const session = await db.guestSession.findUnique({
        where: { sessionTokenHash: hashGuestSecret(sessionToken) },
        select: { id: true, status: true, businessId: true, tableSessionId: true },
      });

      if (session && session.status === "ACTIVE") {
        businessId = session.businessId;
        sessionIds = [session.id];
        if (session.tableSessionId) {
          const siblings = await db.guestSession.findMany({
            where: { tableSessionId: session.tableSessionId, status: "ACTIVE" },
            select: { id: true },
          });
          if (siblings.length > 0) {
            sessionIds = siblings.map((s) => s.id);
          }
        }
      }
    }

    if (!businessId && publicCode) {
      const qr = await db.qrLocation.findUnique({
        where: { publicCode },
        select: { businessId: true, isActive: true },
      });
      if (qr?.isActive) {
        businessId = qr.businessId;
      }
    }

    if (!businessId && sessionIds.length === 0) {
      return NextResponse.json({ notifications: [] });
    }

    const now = new Date();
    const audienceFilters: any[] = [];

    if (sessionIds.length > 0) {
      audienceFilters.push({ guestSessionId: { in: sessionIds } });
    }
    if (businessId) {
      audienceFilters.push({
        businessId,
        category: "OFFER",
        guestSessionId: null,
      });
    }

    const notifications = await db.notification.findMany({
      where: {
        OR: audienceFilters,
        AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }],
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json({ notifications });
  } catch (error) {
    console.error("GET /api/v1/guest/notifications error:", error);
    return NextResponse.json({ error: "Failed to load guest notifications" }, { status: 500 });
  }
}
