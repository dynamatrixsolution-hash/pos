import { NextResponse } from "next/server";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";
import { settleGuestFolio } from "@/lib/services/folio-service";
import { HotelError } from "@/lib/services/room-availability-service";
import { z } from "zod";

const settleFolioSchema = z.object({
  tenders: z
    .array(
      z.object({
        paymentMethod: z.enum([
          "CASH",
          "CARD",
          "QR",
          "BANK_TRANSFER",
          "DEPOSIT",
        ]),
        amount: z.union([z.number(), z.string()]),
        reference: z.string().optional().nullable(),
        notes: z.string().optional().nullable(),
      })
    )
    .min(1, "At least one payment tender is required"),
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
    const parsed = settleFolioSchema.parse(body);

    const branchId = parsed.branchId || session.branchId;

    const result = await settleGuestFolio({
      businessId: session.businessId,
      branchId: branchId!,
      folioId: id,
      tenders: parsed.tenders,
      actorId: session.userId,
    });

    return NextResponse.json({
      folio: result.folio,
      allocations: result.allocations,
    });
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
      { error: error.message || "Failed to settle guest folio" },
      { status: 500 }
    );
  }
}
