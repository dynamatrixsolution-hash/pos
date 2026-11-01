import { NextResponse } from "next/server";
import {
  validateGuestSessionToken,
  getGuestPortalFolioSummary,
  getGuestOrdersAndTracking,
} from "@/lib/services/guest-portal-service";
import { HotelError } from "@/lib/services/room-availability-service";

function extractGuestToken(req: Request): string | null {
  const headerToken =
    req.headers.get("x-guest-session-token") ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (headerToken) return headerToken.trim();
  const { searchParams } = new URL(req.url);
  return searchParams.get("sessionToken");
}

export async function GET(req: Request) {
  try {
    const sessionToken = extractGuestToken(req);
    if (!sessionToken) {
      return NextResponse.json(
        { error: "Guest session token required", code: "GUEST_UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const validation = await validateGuestSessionToken(sessionToken);
    const scopes: string[] = Array.isArray(validation.grant?.scopes)
      ? (validation.grant.scopes as string[])
      : [];

    let folioSummary: any = null;
    if (scopes.includes("BILL_VIEW")) {
      folioSummary = await getGuestPortalFolioSummary(sessionToken);
    }

    const ordersResult = await getGuestOrdersAndTracking(sessionToken);

    return NextResponse.json({
      session: validation.session,
      grant: validation.grant,
      qrLocation: validation.qrLocation,
      folioSummary,
      orders: ordersResult.orders,
    });
  } catch (error: any) {
    if (
      error instanceof HotelError ||
      error?.name === "HotelError" ||
      typeof error?.statusCode === "number"
    ) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode || 400 }
      );
    }
    return NextResponse.json(
      { error: error.message || "Failed to load guest session" },
      { status: 500 }
    );
  }
}
