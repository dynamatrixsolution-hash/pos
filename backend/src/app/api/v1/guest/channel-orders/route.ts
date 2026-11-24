import { NextResponse } from "next/server";
import { safeErrorMessage } from "@/lib/api-helper";
import { db } from "@/lib/db";
import { dispatchNotification } from "@/lib/notifications";
import { submitGuestChannelOrder } from "@/lib/services/guest-portal-service";
import { HotelError } from "@/lib/services/room-availability-service";
import { enforceRateLimit } from "@/lib/rate-limiter";
import { z } from "zod";

const channelOrderSchema = z.object({
  publicCode: z.string().min(1, "Restaurant QR code is required"),
  orderType: z.enum(["TAKEAWAY", "DELIVERY"]),
  customerName: z.string().trim().min(2, "Customer name is required"),
  phone: z.string().trim().min(7, "Valid mobile number is required").max(25),
  email: z.string().trim().email("Invalid email address").optional().nullable().or(z.literal("")),
  deliveryAddress: z.string().trim().max(300).optional().nullable(),
  deliveryLandmark: z.string().trim().max(150).optional().nullable(),
  lat: z.coerce.number().min(-90).max(90).optional().nullable(),
  lng: z.coerce.number().min(-180).max(180).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
  items: z
    .array(
      z.object({
        menuItemId: z.string().min(1),
        quantity: z.coerce.number().int().min(1).default(1),
        selectedOptionIds: z.array(z.string()).optional().default([]),
        notes: z.string().max(250).optional(),
      })
    )
    .min(1, "At least one item is required"),
});

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const orderNumber = (searchParams.get("orderNumber") || "").trim();
    const phoneDigits = (searchParams.get("phone") || "").replace(/\D/g, "");

    if (!orderNumber || phoneDigits.length < 7) {
      return NextResponse.json(
        { error: "orderNumber and phone are required" },
        { status: 400 }
      );
    }

    const order = await db.restaurantOrder.findFirst({
      where: {
        orderNumber,
        orderType: { in: ["TAKEAWAY", "DELIVERY"] },
      },
      include: {
        rounds: {
          include: { lines: true },
          orderBy: { roundNumber: "asc" },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const noteDigits = (order.notes || "").replace(/\D/g, "");
    if (!noteDigits.includes(phoneDigits)) {
      return NextResponse.json({ error: "Phone does not match this order" }, { status: 403 });
    }

    return NextResponse.json({ order });
  } catch (error: any) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to load order") },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const rateLimitError = enforceRateLimit(req, "guest:channel-order", 30, 60);
  if (rateLimitError) return rateLimitError;

  try {
    const body = await req.json();
    const parsed = channelOrderSchema.parse(body);

    const result = await submitGuestChannelOrder(parsed);

    // Notify Accountant, Front Desk, Cashier, Waiter, Manager, Owner + Kitchen (if auto-approved)
    void (async () => {
      try {
        const order = (result as any)?.order;
        const roundId = (result as any)?.round?.id || "r1";
        if (!order?.id || !result.businessId) return;

        const itemCount = parsed.items.reduce((s, i) => s + i.quantity, 0);
        const typeLabel = parsed.orderType === "DELIVERY" ? "Delivery" : "Takeaway";
        const addrSnippet =
          parsed.orderType === "DELIVERY" && parsed.deliveryAddress
            ? ` • ${parsed.deliveryAddress}`
            : "";

        const tasks: Promise<unknown>[] = [
          dispatchNotification({
            businessId: result.businessId,
            targetRoles: ["ACCOUNTANT", "FRONT_DESK", "CASHIER", "WAITER", "MANAGER", "OWNER"],
            category: "ORDER",
            priority: result.requiresStaffApproval ? "URGENT" : "HIGH",
            title: result.requiresStaffApproval
              ? `Approval Needed: ${typeLabel} Order — ${parsed.customerName}`
              : `New ${typeLabel} Order — ${parsed.customerName}`,
            message: `Order #${order.orderNumber} (${itemCount} item${itemCount > 1 ? "s" : ""}) from ${parsed.customerName} (${parsed.phone})${addrSnippet}.${result.requiresStaffApproval ? " Review & accept before kitchen starts." : ""}`,
            actionUrl: "/dashboard/restaurant/pos",
            dedupeKey: `guest-channel-staff:${order.id}:${roundId}`,
          }),
        ];

        if (!result.requiresStaffApproval) {
          tasks.push(
            dispatchNotification({
              businessId: result.businessId,
              targetRoles: ["KITCHEN"],
              category: "KITCHEN",
              priority: "URGENT",
              title: `New ${typeLabel} KOT — ${parsed.customerName}`,
              message: `Order #${order.orderNumber} (${itemCount} item${itemCount > 1 ? "s" : ""}) queued for ${typeLabel.toLowerCase()}.`,
              actionUrl: "/dashboard/restaurant/kds",
              dedupeKey: `guest-channel-kds:${order.id}:${roundId}`,
            })
          );
        }

        await Promise.all(tasks);
      } catch (err) {
        console.error("[Notifications] Guest channel order dispatch error:", err);
      }
    })();

    return NextResponse.json(result, { status: 201 });
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
      { error: safeErrorMessage(error, "Failed to place order") },
      { status: 500 }
    );
  }
}
