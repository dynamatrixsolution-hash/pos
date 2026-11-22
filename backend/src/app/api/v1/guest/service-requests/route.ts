import { NextResponse } from "next/server";
import { safeErrorMessage } from "@/lib/api-helper";
import { dispatchNotification } from "@/lib/notifications";
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

    // Notify appropriate staff roles (skip if request was deduplicated)
    const reqObj = (result as any)?.serviceRequest || result;
    if (!(result as any)?.deduplicated && reqObj?.id && reqObj?.businessId) {
      const typeLabels: Record<string, string> = {
        WAITER_CALL: "Waiter Requested",
        WATER_REFILL: "Water Refill Requested",
        BILL_REQUEST: "Bill Requested",
        EXTRA_TOWELS: "Extra Towels Requested",
        HOUSEKEEPING: "Housekeeping Requested",
        ROOM_AMENITIES: "Room Amenities Requested",
        CHECKOUT_REQUEST: "Checkout Requested",
        OTHER: "Guest Service Request",
      };

      const targetRoles =
        parsed.requestType === "BILL_REQUEST" || parsed.requestType === "CHECKOUT_REQUEST"
          ? ["CASHIER", "ACCOUNTANT", "WAITER", "FRONT_DESK", "MANAGER", "OWNER"]
          : parsed.requestType === "HOUSEKEEPING" ||
            parsed.requestType === "EXTRA_TOWELS" ||
            parsed.requestType === "ROOM_AMENITIES"
          ? ["HOUSEKEEPING", "FRONT_DESK", "MANAGER", "OWNER"]
          : ["WAITER", "CASHIER", "MANAGER", "OWNER"];

      const locationText = reqObj.room?.roomNumber
        ? `Room ${reqObj.room.roomNumber}`
        : reqObj.table?.tableNumber
        ? `Table ${reqObj.table.tableNumber}`
        : "Guest Location";

      const actionUrl = reqObj.room?.roomNumber
        ? "/dashboard/hotel/housekeeping"
        : parsed.requestType === "BILL_REQUEST"
        ? "/dashboard/restaurant/pos"
        : "/dashboard/restaurant/tables";

      void dispatchNotification({
        businessId: reqObj.businessId,
        targetRoles,
        category: "SERVICE_REQUEST",
        priority: parsed.priority === "URGENT" || parsed.requestType === "BILL_REQUEST" ? "URGENT" : "HIGH",
        title: `${typeLabels[parsed.requestType] || "Guest Request"} — ${locationText}`,
        message: parsed.notes?.trim()
          ? `${locationText}: ${parsed.notes.trim()}`
          : `${locationText} sent a ${typeLabels[parsed.requestType]?.toLowerCase() || "service request"}.`,
        actionUrl,
        dedupeKey: `srv-req:${reqObj.id}`,
      }).catch(() => {});
    }

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
      { error: safeErrorMessage(error, "Failed to create service request") },
      { status: 500 }
    );
  }
}
