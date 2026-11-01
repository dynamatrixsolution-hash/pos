import { NextResponse } from "next/server";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";
import {
  getFolioById,
  postRestaurantOrderToFolio,
} from "@/lib/services/folio-service";
import { HotelError } from "@/lib/services/room-availability-service";
import { z } from "zod";

const chargeOrderSchema = z.object({
  orderId: z.string().uuid("Order ID is required"),
  stayId: z.string().uuid("Stay ID is required").optional(),
  branchId: z.string().uuid().optional().nullable(),
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
    const parsed = chargeOrderSchema.parse(body);

    let stayId = parsed.stayId;
    let branchId = parsed.branchId || session.branchId;

    if (!stayId || !branchId) {
      const rawFolio = await getFolioById(session.businessId, id);
      const existingFolio = (rawFolio as any)?.folio ?? rawFolio;
      stayId = stayId || existingFolio.stayId;
      branchId = branchId || existingFolio.branchId;
    }

    const result = await postRestaurantOrderToFolio({
      businessId: session.businessId,
      branchId: branchId!,
      orderId: parsed.orderId,
      stayId: stayId!,
      folioId: id,
      actorId: session.userId,
    });

    return NextResponse.json(
      {
        entry: result.entry,
        folio: result.folio,
        order: result.order,
        idempotentReplay: result.idempotentReplay ?? false,
      },
      { status: 201 }
    );
  } catch (error: any) {
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
      { error: error.message || "Failed to post restaurant order to folio" },
      { status: 500 }
    );
  }
}
