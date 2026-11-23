import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";
import { hashGuestSecret } from "@/lib/services/guest-portal-service";

const registerSchema = z.object({
  token: z.string().trim().min(20, "Valid FCM token is required").max(512),
  platform: z.enum(["WEB", "ANDROID", "IOS"]).default("WEB"),
  deviceLabel: z.string().trim().max(120).optional(),
  guestSessionId: z.string().trim().optional(),
  guestSessionToken: z.string().trim().optional(),
  publicCode: z.string().trim().optional(),
});

// POST /api/v1/notifications/register-token
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid push token payload" },
        { status: 400 }
      );
    }

    const { token, platform, deviceLabel, guestSessionId, guestSessionToken, publicCode } = parsed.data;
    const headerGuestToken = request.headers.get("x-guest-session-token")?.trim() || null;
    const effectiveGuestToken = guestSessionToken || headerGuestToken;
    const context = await getSessionContext();

    if (!context && !guestSessionId && !effectiveGuestToken && !publicCode) {
      return authErrorResponse();
    }

    if (context) {
      await db.devicePushToken.upsert({
        where: { token },
        update: {
          platform,
          userId: context.userId,
          businessId: context.businessId,
          role: context.role.toUpperCase(),
          guestSessionId: null,
          deviceLabel: deviceLabel || null,
          isActive: true,
          lastUsedAt: new Date(),
        },
        create: {
          token,
          platform,
          userId: context.userId,
          businessId: context.businessId,
          role: context.role.toUpperCase(),
          deviceLabel: deviceLabel || null,
          isActive: true,
        },
      });
      return NextResponse.json({ success: true });
    }

    // Guest QR registration (supports active session token OR publicCode before ordering)
    const guestSession = effectiveGuestToken
      ? await db.guestSession.findUnique({
          where: { sessionTokenHash: hashGuestSecret(effectiveGuestToken) },
          select: { id: true, businessId: true, status: true },
        })
      : guestSessionId
      ? await db.guestSession.findUnique({
          where: { id: guestSessionId },
          select: { id: true, businessId: true, status: true },
        })
      : null;

    let businessId = guestSession?.status === "ACTIVE" ? guestSession.businessId : null;
    const activeGuestSessionId = guestSession?.status === "ACTIVE" ? guestSession.id : null;

    if (!businessId && publicCode) {
      const qr = await db.qrLocation.findUnique({
        where: { publicCode },
        select: { businessId: true, isActive: true },
      });
      if (qr?.isActive) {
        businessId = qr.businessId;
      }
    }

    if (!businessId) {
      return NextResponse.json({ error: "Active guest session or valid QR code required" }, { status: 404 });
    }

    await db.devicePushToken.upsert({
      where: { token },
      update: {
        platform,
        userId: null,
        businessId,
        role: "GUEST",
        guestSessionId: activeGuestSessionId,
        deviceLabel: deviceLabel || "Guest QR",
        isActive: true,
        lastUsedAt: new Date(),
      },
      create: {
        token,
        platform,
        businessId,
        role: "GUEST",
        guestSessionId: activeGuestSessionId,
        deviceLabel: deviceLabel || "Guest QR",
        isActive: true,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/v1/notifications/register-token error:", error);
    return NextResponse.json({ error: "Failed to register push token" }, { status: 500 });
  }
}

// DELETE /api/v1/notifications/register-token
export async function DELETE(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const token = typeof body?.token === "string" ? body.token.trim() : "";
    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    await db.devicePushToken.updateMany({
      where: { token },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/v1/notifications/register-token error:", error);
    return NextResponse.json({ error: "Failed to unregister push token" }, { status: 500 });
  }
}
