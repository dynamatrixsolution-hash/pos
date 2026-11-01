import { NextResponse } from "next/server";
import { createGuestServiceRequest } from "@/lib/services/guest-portal-service";
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

const createServiceRequestSchema = z.object({
  sessionToken: z.string().optional().nullable(),
  publicCode: z.string().optional().nullable(),
  requestType: z.enum([
    "WAITER_CALL",
    "WATER_REFILL",
    "BILL_REQUEST",
    "EXTRA_TOWELS",
    "HOUSEKEEPING",
    "ROOM_AMENITIES",
    "CHECKOUT_REQUEST",
    "OTHER",
  ]),
  notes: z.string().max(500).optional().nullable(),
  priority: z.enum(["NORMAL", "HIGH", "URGENT"]).optional(),
  idempotencyKey: z.string().optional().nullable(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = createServiceRequestSchema.parse(body);

    const sessionToken = extractGuestToken(req) || parsed.sessionToken || null;
    const idempotencyKey =
      req.headers.get("idempotency-key")?.trim() ||
      parsed.idempotencyKey ||
      null;

    const result = await createGuestServiceRequest({
      sessionToken,
      publicCode: parsed.publicCode,
      requestType: parsed.requestType,
      notes: parsed.notes,
      priority: parsed.priority,
      idempotencyKey,
    });

    return NextResponse.json(result, {
      status: (result as any)?.deduplicated ? 200 : 201,
    });
  } catch (error: any) {
    if (error?.code === "RATE_LIMIT_EXCEEDED" || error?.statusCode === 429) {
      return NextResponse.json(
        { error: error.message, code: error.code || "RATE_LIMIT_EXCEEDED" },
        { status: 429 }
      );
    }
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
      { error: error.message || "Failed to create service request" },
      { status: 500 }
    );
  }
}
