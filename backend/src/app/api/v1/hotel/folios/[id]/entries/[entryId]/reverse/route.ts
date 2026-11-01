import { NextResponse } from "next/server";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";
import { reverseOrAdjustFolioEntry } from "@/lib/services/folio-service";
import { HotelError } from "@/lib/services/room-availability-service";
import { z } from "zod";

const reverseEntrySchema = z.object({
  adjustmentAmount: z.union([z.number(), z.string()]).optional(),
  reason: z.string().trim().min(1, "Reason is required").max(500),
  branchId: z.string().uuid().optional().nullable(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; entryId: string }> }
) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();

    const { entryId } = await params;
    const body = await req.json();
    const parsed = reverseEntrySchema.parse(body);

    const branchId = parsed.branchId || session.branchId;

    const result = await reverseOrAdjustFolioEntry({
      businessId: session.businessId,
      branchId: branchId!,
      folioEntryId: entryId,
      adjustmentAmount: parsed.adjustmentAmount,
      reason: parsed.reason,
      actorId: session.userId,
    });

    return NextResponse.json({
      creditEntry: result.creditEntry,
      originalEntry: result.originalEntry,
      folio: result.folio,
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
      { error: error.message || "Failed to reverse or adjust folio entry" },
      { status: 500 }
    );
  }
}
