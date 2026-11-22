import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/v1/guest/notifications?sessionId=<guestSessionId>
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId")?.trim();
    if (!sessionId) {
      return NextResponse.json({ notifications: [] });
    }

    const session = await db.guestSession.findUnique({
      where: { id: sessionId },
      select: { id: true, status: true },
    });
    if (!session || session.status !== "ACTIVE") {
      return NextResponse.json({ notifications: [] });
    }

    const notifications = await db.notification.findMany({
      where: {
        guestSessionId: sessionId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return NextResponse.json({ notifications });
  } catch (error) {
    console.error("GET /api/v1/guest/notifications error:", error);
    return NextResponse.json({ error: "Failed to load guest notifications" }, { status: 500 });
  }
}
