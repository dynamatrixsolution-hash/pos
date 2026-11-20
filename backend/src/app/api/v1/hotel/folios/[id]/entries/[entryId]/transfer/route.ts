import { NextResponse } from "next/server";
import { getSessionContext, authErrorResponse, safeErrorMessage, requireRoles, ROLE_GROUPS } from "@/lib/api-helper";
import { transferFolioEntryBetweenWindows } from "@/lib/services/folio-service";
import { HotelError } from "@/lib/services/room-availability-service";
import { z } from "zod";

const transferEntrySchema = z.object({
  targetFolioId: z.string().uuid("Target folio ID is required"),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; entryId: string }> }
) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();
    const denied = requireRoles(session, ROLE_GROUPS.HOTEL_FRONT_DESK);
    if (denied) return denied;

    const { entryId } = await params;
    const body = await req.json();
    const parsed = transferEntrySchema.parse(body);

    const result = await transferFolioEntryBetweenWindows({
      businessId: session.businessId,
      entryId,
      targetFolioId: parsed.targetFolioId,
      actorId: session.userId,
    });

    return NextResponse.json({
      entry: result.entry,
      sourceFolio: result.sourceFolio,
      targetFolio: result.targetFolio,
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
      { error: safeErrorMessage(error, "Failed to transfer folio entry") },
      { status: 500 }
    );
  }
}
