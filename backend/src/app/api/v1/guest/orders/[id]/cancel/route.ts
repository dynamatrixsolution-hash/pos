import { NextResponse } from "next/server";
import { safeErrorMessage } from "@/lib/api-helper";
import { dispatchNotification } from "@/lib/notifications";
import { cancelOrRequestGuestOrder } from "@/lib/services/guest-portal-service";
import { HotelError } from "@/lib/services/room-availability-service";
import { z } from "zod";

const cancelSchema = z.object({
  sessionToken: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  reason: z.string().trim().min(3, "Please provide a reason for cancellation"),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;
    const body = await req.json().catch(() => ({}));
    const parsed = cancelSchema.parse(body);

    const headerToken =
      req.headers.get("x-guest-session-token") ||
      req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
      null;
    const sessionToken = headerToken?.trim() || parsed.sessionToken || null;

    const result = await cancelOrRequestGuestOrder({
      sessionToken,
      orderId,
      phone: parsed.phone,
      reason: parsed.reason,
    });

    void (async () => {
      try {
        if (result.action === "REFUND_REQUESTED") {
          await dispatchNotification({
            businessId: result.businessId,
            targetRoles: ["CASHIER", "ACCOUNTANT", "FRONT_DESK", "MANAGER", "OWNER"],
            category: "ORDER",
            priority: "URGENT",
            title: `Refund Requested — ${result.locLabel}`,
            message: `Guest requested refund for paid Order #${result.orderNumber}. Reason: ${parsed.reason}`,
            actionUrl: "/dashboard/restaurant/pos",
            dedupeKey: `guest-refund:${orderId}:${Date.now()}`,
          });
        } else if (result.action === "CANCEL_REQUESTED") {
          await dispatchNotification({
            businessId: result.businessId,
            targetRoles: ["WAITER", "CASHIER", "KITCHEN", "MANAGER", "OWNER"],
            category: "ORDER",
            priority: "URGENT",
            title: `Cancel Requested — ${result.locLabel}`,
            message: `Guest asked to cancel Order #${result.orderNumber} (in prep / past grace window). Reason: ${parsed.reason}`,
            actionUrl: "/dashboard/restaurant/pos",
            dedupeKey: `guest-cancel-req:${orderId}:${Date.now()}`,
          });
        } else {
          await Promise.all([
            dispatchNotification({
              businessId: result.businessId,
              targetRoles: ["WAITER", "CASHIER", "ACCOUNTANT", "MANAGER", "OWNER"],
              category: "ORDER",
              priority: "HIGH",
              title: `Order Cancelled by Guest — ${result.locLabel}`,
              message: `Order #${result.orderNumber} was self-cancelled before preparation. Reason: ${parsed.reason}`,
              actionUrl: "/dashboard/restaurant/pos",
              dedupeKey: `guest-cancel-staff:${orderId}`,
            }),
            dispatchNotification({
              businessId: result.businessId,
              targetRoles: ["KITCHEN"],
              category: "KITCHEN",
              priority: "URGENT",
              title: `VOID KOT — ${result.locLabel}`,
              message: `Order #${result.orderNumber} was cancelled by guest before cooking.`,
              actionUrl: "/dashboard/restaurant/kds",
              dedupeKey: `guest-cancel-kds:${orderId}`,
            }),
          ]);
        }
      } catch (err) {
        console.error("[Notifications] Guest cancel dispatch error:", err);
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
      { error: safeErrorMessage(error, "Failed to process cancellation") },
      { status: 500 }
    );
  }
}
