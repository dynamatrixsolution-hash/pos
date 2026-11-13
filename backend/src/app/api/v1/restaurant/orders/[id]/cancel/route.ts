import { NextResponse } from "next/server";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";
import {
  cancelRestaurantOrder,
  RestaurantOrderError,
} from "@/lib/services/restaurant-order-service";
import { z } from "zod";

const cancelOrderSchema = z.object({
  reason: z.string().optional().default("Order cancelled by staff"),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();

    const { id: orderId } = await params;
    const body = await req.json().catch(() => ({}));
    const parsed = cancelOrderSchema.parse(body);

    const cancelledOrder = await cancelRestaurantOrder({
      businessId: session.businessId,
      orderId,
      reason: parsed.reason,
      actorId: session.userId,
    });

    return NextResponse.json({
      success: true,
      order: cancelledOrder,
      message: "Order cancelled successfully",
    });
  } catch (error: any) {
    if (error instanceof RestaurantOrderError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Validation failed" }, { status: 400 });
    }
    return NextResponse.json(
      { error: error.message || "Failed to cancel order" },
      { status: 500 }
    );
  }
}

