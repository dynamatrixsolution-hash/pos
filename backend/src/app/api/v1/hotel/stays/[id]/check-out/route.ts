import { NextResponse } from "next/server";
import { getSessionContext, authErrorResponse, safeErrorMessage, requireRoles, ROLE_GROUPS } from "@/lib/api-helper";
import { checkOutStay } from "@/lib/services/hotel-checkout-service";
import { HotelError } from "@/lib/services/room-availability-service";
import { z } from "zod";

const checkOutSchema = z.object({
  settleAmount: z.coerce.number().min(0).optional(),
  enforceSettlement: z.boolean().optional(),
  notes: z.string().max(1000).optional().nullable(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();
    const denied = requireRoles(session, ROLE_GROUPS.HOTEL_FRONT_DESK);
    if (denied) return denied;

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const parsed = checkOutSchema.parse(body);

    const result = await checkOutStay({
      businessId: session.businessId,
      stayId: id,
      settleAmount: parsed.settleAmount,
      enforceSettlement: parsed.enforceSettlement,
      notes: parsed.notes || undefined,
      actorId: session.userId,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[CheckOut Error]:", error);
    if (error instanceof HotelError || error?.name === "HotelError" || typeof error?.statusCode === "number") {
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
      { error: safeErrorMessage(error, "Failed to check out stay") },
      { status: 500 }
    );
  }
}
