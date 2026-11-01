import { NextResponse } from "next/server";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";
import { extendStay } from "@/lib/services/hotel-checkin-service";
import { HotelError } from "@/lib/services/room-availability-service";
import { z } from "zod";

const extendStaySchema = z.object({
  newExpectedCheckOut: z.union([z.string(), z.date()]),
  additionalPaidAmount: z.coerce.number().min(0).optional(),
  notes: z.string().max(1000).optional().nullable(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();

    const { id } = await params;
    const body = await req.json();
    const parsed = extendStaySchema.parse(body);

    const result = await extendStay({
      businessId: session.businessId,
      stayId: id,
      newExpectedCheckOut: new Date(parsed.newExpectedCheckOut),
      additionalPaidAmount: parsed.additionalPaidAmount,
      notes: parsed.notes || undefined,
      actorId: session.userId,
    });

    const stay = (result as any)?.stay ? (result as any).stay : result;
    return NextResponse.json({ stay });
  } catch (error: any) {
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
      { error: error.message || "Failed to extend stay" },
      { status: 500 }
    );
  }
}
