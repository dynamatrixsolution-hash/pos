import { NextResponse } from "next/server";
import {
  getGuestOrdersAndTracking,
  submitGuestOrder,
} from "@/lib/services/guest-portal-service";
import { HotelError } from "@/lib/services/room-availability-service";
import { z } from "zod";

function extractGuestToken(req: Request): string | null {
  const headerToken =
    req.headers.get("x-guest-session-token") ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (headerToken) return headerToken.trim();
  const { searchParams } = new URL(req.url);
  return searchParams.get("sessionToken");
}

const submitOrderSchema = z.object({
  sessionToken: z.string().optional(),
  items: z
    .array(
      z.object({
        menuItemId: z.string().min(1, "Menu item ID is required"),
        quantity: z.coerce.number().int().min(1).default(1),
        selectedOptionIds: z.array(z.string()).optional().default([]),
        notes: z.string().optional(),
      })
    )
    .min(1, "At least one item is required"),
  notes: z.string().optional(),
});

export async function GET(req: Request) {
  try {
    const sessionToken = extractGuestToken(req);
    if (!sessionToken) {
      return NextResponse.json(
        { error: "Guest session token required", code: "GUEST_UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const result = await getGuestOrdersAndTracking(sessionToken);
    return NextResponse.json(result);
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
      { error: error.message || "Failed to fetch guest orders" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = submitOrderSchema.parse(body);

    const sessionToken = extractGuestToken(req) || parsed.sessionToken;
    if (!sessionToken) {
      return NextResponse.json(
        { error: "Guest session token required", code: "GUEST_UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const result = await submitGuestOrder({
      sessionToken,
      items: parsed.items,
      notes: parsed.notes,
    });

    return NextResponse.json(result, { status: 201 });
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
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Validation failed" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: error.message || "Failed to submit guest order" },
      { status: 500 }
    );
  }
}
