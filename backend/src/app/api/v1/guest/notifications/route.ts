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

// GET /api/v1/guest/notifications - Fetch live order/kitchen alerts for the active guest session (and table companions)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limitRaw = parseInt(searchParams.get("limit") || "25", 10);
    const limit = Number.isInteger(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 50) : 25;

    const sessionToken = extractGuestToken(request);
    const legacySessionId = searchParams.get("sessionId")?.trim() || null;

    let session: { id: string; status: string; tableSessionId: string | null } | null = null;

    if (sessionToken) {
      const sessionTokenHash = hashGuestSecret(sessionToken);
      session = await db.guestSession.findUnique({
        where: { sessionTokenHash },
        select: { id: true, status: true, tableSessionId: true },
      });
    } else if (legacySessionId) {
      session = await db.guestSession.findUnique({
        where: { id: legacySessionId },
        select: { id: true, status: true, tableSessionId: true },
      });
    }

    if (!session || session.status !== "ACTIVE") {
      return NextResponse.json({ notifications: [] });
    }

    // Include notifications sent to any active companion on the same tableSessionId
    let sessionIds = [session.id];
    if (session.tableSessionId) {
      const siblings = await db.guestSession.findMany({
        where: { tableSessionId: session.tableSessionId, status: "ACTIVE" },
        select: { id: true },
      });
      if (siblings.length > 0) {
        sessionIds = siblings.map((s) => s.id);
      }
    }

    const notifications = await db.notification.findMany({
      where: {
        guestSessionId: { in: sessionIds },
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
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
