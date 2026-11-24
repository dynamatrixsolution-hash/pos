import { NextResponse } from "next/server";
import { safeErrorMessage } from "@/lib/api-helper";
import { dispatchNotification } from "@/lib/notifications";
import { requestGuestOrderFulfillmentChange } from "@/lib/services/guest-portal-service";
import { HotelError } from "@/lib/services/room-availability-service";
import { z } from "zod";

const fulfillmentSchema = z.object({
  sessionToken: z.string().optional().nullable(),
  mode: z.enum(["PACK_TAKEAWAY", "REQUEST_DELIVERY"]),
  itemIds: z.array(z.string()).optional().default([]),
  customerName: z.string().trim().max(120).optional().nullable(),
  phone: z.string().trim().max(30).optional().nullable(),
  deliveryAddress: z.string().trim().max(300).optional().nullable(),
  lat: z.coerce.number().min(-90).max(90).optional().nullable(),
  lng: z.coerce.number().min(-180).max(180).optional().nullable(),
  notes: z.string().trim().max(400).optional().nullable(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;
    const body = await req.json().catch(() => ({}));
    const parsed = fulfillmentSchema.parse(body);

    const headerToken =
      req.headers.get("x-guest-session-token") ||
      req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
      null;
    const sessionToken = headerToken?.trim() || parsed.sessionToken || "";

    const result = await requestGuestOrderFulfillmentChange({
      sessionToken,
      orderId,
      mode: parsed.mode,
      itemIds: parsed.itemIds,
      customerName: parsed.customerName,
      phone: parsed.phone,
      deliveryAddress: parsed.deliveryAddress,
      lat: parsed.lat,
      lng: parsed.lng,
      notes: parsed.notes,
    });

    void (async () => {
      try {
        if (result.mode === "REQUEST_DELIVERY") {
          await dispatchNotification({
            businessId: result.businessId,
            targetRoles: ["CASHIER", "ACCOUNTANT", "FRONT_DESK", "WAITER", "MANAGER", "OWNER"],
            category: "ORDER",
            priority: "URGENT",
            title: `Delivery Requested — ${result.locLabel}`,
            message: `${result.locLabel} (Order #${result.orderNumber}) asked to deliver ${result.itemSummary} to ${parsed.customerName} (${parsed.phone}) at ${parsed.deliveryAddress}.`,
            actionUrl: "/dashboard/restaurant/pos",
            dedupeKey: `guest-deliver-req:${orderId}:${Date.now()}`,
          });
        } else {
          await Promise.all([
            dispatchNotification({
              businessId: result.businessId,
              targetRoles: ["WAITER", "CASHIER", "MANAGER", "OWNER"],
              category: "ORDER",
              priority: "HIGH",
              title: `Pack Takeaway — ${result.locLabel}`,
              message: `${result.locLabel} (Order #${result.orderNumber}) requested takeaway packing for: ${result.itemSummary}.`,
              actionUrl: "/dashboard/restaurant/pos",
              dedupeKey: `guest-pack-staff:${orderId}:${Date.now()}`,
            }),
            dispatchNotification({
              businessId: result.businessId,
              targetRoles: ["KITCHEN"],
              category: "KITCHEN",
              priority: "HIGH",
              title: `Pack Takeaway — ${result.locLabel}`,
              message: `Order #${result.orderNumber}: pack ${result.itemSummary} for takeaway.`,
              actionUrl: "/dashboard/restaurant/kds",
              dedupeKey: `guest-pack-kds:${orderId}:${Date.now()}`,
            }),
          ]);
        }
      } catch (err) {
        console.error("[Notifications] Guest fulfillment dispatch error:", err);
      }
    })();

    return NextResponse.json(result);
  } catch (error: any) {
    if (error instanceof HotelError || typeof error?.statusCode === "number") {
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
      { error: safeErrorMessage(error, "Failed to update fulfillment") },
      { status: 500 }
    );
  }
}
