import { NextResponse } from "next/server";
import { getSessionContext, authErrorResponse, safeErrorMessage, requireRoles, ROLE_GROUPS } from "@/lib/api-helper";
import {
  convertRestaurantOrderType,
  RestaurantOrderError,
} from "@/lib/services/restaurant-order-service";
import { z } from "zod";

const convertOrderTypeSchema = z.object({
  orderType: z.enum(["TAKEAWAY", "DELIVERY"]),
  deliveryInfo: z
    .object({
      customerName: z.string().max(120).optional(),
      phone: z.string().max(40).optional(),
      address: z.string().max(300).optional(),
      riderName: z.string().max(100).optional(),
      deliveryFee: z.union([z.number(), z.string()]).optional(),
      notes: z.string().max(500).optional(),
    })
    .optional(),
  notes: z.string().max(500).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();
    const denied = requireRoles(session, ROLE_GROUPS.RESTAURANT_SERVICE);
    if (denied) return denied;

    const { id: orderId } = await params;
    const body = await req.json().catch(() => ({}));
    const parsed = convertOrderTypeSchema.parse(body);

    const order = await convertRestaurantOrderType({
      businessId: session.businessId,
      orderId,
      targetOrderType: parsed.orderType,
      deliveryInfo: parsed.deliveryInfo,
      notes: parsed.notes,
      actorId: session.userId,
    });

    return NextResponse.json({
      success: true,
      order,
    });
  } catch (error: any) {
    if (error instanceof RestaurantOrderError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Validation failed" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to update order type") },
      { status: 500 }
    );
  }
}
