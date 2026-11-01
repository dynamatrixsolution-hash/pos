import { NextResponse } from "next/server";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";
import {
  updateLineStatus,
  RestaurantOrderError,
} from "@/lib/services/restaurant-order-service";
import { z } from "zod";

const updateLineStatusSchema = z.object({
  acceptanceStatus: z.enum(["PENDING", "ACCEPTED", "REJECTED"]).optional(),
  fulfillmentStatus: z.enum(["QUEUED", "PREPARING", "READY", "SERVED", "CANCELLED"]).optional(),
  settlementStatus: z.enum(["UNPAID", "PARTIAL", "PAID", "REFUNDED"]).optional(),
  rejectionReason: z.string().optional(),
  voidReason: z.string().optional(),
  expectedVersion: z.number().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; lineId: string }> }
) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();

    const { lineId } = await params;
    const body = await req.json();
    const parsed = updateLineStatusSchema.parse(body);

    const updatedLine = await updateLineStatus({
      businessId: session.businessId,
      lineId,
      acceptanceStatus: parsed.acceptanceStatus,
      fulfillmentStatus: parsed.fulfillmentStatus,
      settlementStatus: parsed.settlementStatus,
      rejectionReason: parsed.rejectionReason,
      voidReason: parsed.voidReason,
      actorId: session.userId,
      expectedVersion: parsed.expectedVersion,
    });

    return NextResponse.json({
      success: true,
      line: updatedLine,
    });
  } catch (error: any) {
    if (error instanceof RestaurantOrderError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Validation failed" }, { status: 400 });
    }
    return NextResponse.json({ error: error.message || "Failed to update order line status" }, { status: 500 });
  }
}

