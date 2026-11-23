import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/v1/guest/review-link?publicCode=... or ?businessId=...
// Simple public endpoint returning the owner's configured Google Business Profile review link.
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const publicCode = searchParams.get("publicCode")?.trim();
    const businessId = searchParams.get("businessId")?.trim();

    if (!publicCode && !businessId) {
      return NextResponse.json({ error: "publicCode or businessId is required" }, { status: 400 });
    }

    let business: { id: string; name: string; settings: unknown } | null = null;
    let locationGoogleUrl: string | null = null;

    if (publicCode) {
      const qr = await db.qrLocation.findUnique({
        where: { publicCode },
        select: {
          metadata: true,
          business: { select: { id: true, name: true, settings: true } },
        },
      });
      if (!qr) {
        return NextResponse.json({ error: "QR location not found" }, { status: 404 });
      }
      business = qr.business;
      const meta = qr.metadata && typeof qr.metadata === "object" ? (qr.metadata as Record<string, unknown>) : null;
      if (typeof meta?.googleReviewUrl === "string" && meta.googleReviewUrl.trim()) {
        locationGoogleUrl = meta.googleReviewUrl.trim();
      }
    } else if (businessId) {
      business = await db.business.findUnique({
        where: { id: businessId },
        select: { id: true, name: true, settings: true },
      });
    }

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const settings =
      business.settings && typeof business.settings === "object"
        ? (business.settings as Record<string, unknown>)
        : null;
    const settingsUrl =
      typeof settings?.googleReviewUrl === "string" && settings.googleReviewUrl.trim()
        ? settings.googleReviewUrl.trim()
        : null;

    return NextResponse.json({
      businessId: business.id,
      businessName: business.name,
      googleReviewUrl: settingsUrl || locationGoogleUrl || null,
    });
  } catch (error) {
    console.error("GET /api/v1/guest/review-link error:", error);
    return NextResponse.json({ error: "Failed to fetch review link" }, { status: 500 });
  }
}
