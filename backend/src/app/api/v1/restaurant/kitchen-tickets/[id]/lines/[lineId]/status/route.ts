import { NextResponse } from "next/server";
import { getSessionContext, authErrorResponse, safeErrorMessage, requireRoles, ROLE_GROUPS } from "@/lib/api-helper";
import { updateLineStatus, RestaurantOrderError } from "@/lib/services/restaurant-order-service";
import { z } from "zod";

const updateLineStatusSchema = z.object({
  status: z.string(),
  reason: z.string().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; lineId: string }> }
) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();
    const denied = requireRoles(session, ROLE_GROUPS.KITCHEN_OPERATIONS);
    if (denied) return denied;

    const { lineId } = await params;
    const body = await req.json();
    const parsed = updateLineStatusSchema.parse(body);

    const statusUpper = parsed.status.toUpperCase();
    const fulfillmentStatuses = ["QUEUED", "PREPARING", "READY", "SERVED", "CANCELLED"];
    const acceptanceStatuses = ["PENDING", "ACCEPTED", "REJECTED"];

    const isFulfillment = fulfillmentStatuses.includes(statusUpper);
    const isAcceptance = acceptanceStatuses.includes(statusUpper);

    const updatedLine = await updateLineStatus({
      businessId: session.businessId,
      lineId,
      fulfillmentStatus: isFulfillment ? (statusUpper as any) : undefined,
      acceptanceStatus: isAcceptance ? (statusUpper as any) : undefined,
      rejectionReason: parsed.reason,
      actorId: session.userId,
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
    console.error("PATCH /kitchen-tickets/[id]/lines/[lineId]/status error:", error);
    return NextResponse.json({ error: safeErrorMessage(error, "Failed to update ticket line status") }, { status: 500 });
  }
}

