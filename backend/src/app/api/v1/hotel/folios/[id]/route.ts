import { NextResponse } from "next/server";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";
import {
  getFolioById,
  getFolioAccountingReconciliation,
  lockFolioForCheckout,
  unlockFolio,
} from "@/lib/services/folio-service";
import { HotelError } from "@/lib/services/room-availability-service";
import { z } from "zod";

const patchFolioSchema = z.object({
  action: z.enum(["LOCK", "UNLOCK"]),
});

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();

    const { id } = await params;
    const rawFolio = await getFolioById(session.businessId, id);
    const folio = (rawFolio as any)?.folio ?? rawFolio;

    const reconciliation = await getFolioAccountingReconciliation({
      businessId: session.businessId,
      stayId: folio.stayId,
    });

    return NextResponse.json({ folio, reconciliation });
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
    return NextResponse.json(
      { error: error.message || "Failed to fetch folio" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();

    const { id } = await params;
    const body = await req.json();
    const parsed = patchFolioSchema.parse(body);

    const result =
      parsed.action === "LOCK"
        ? await lockFolioForCheckout({
            businessId: session.businessId,
            folioId: id,
            actorId: session.userId,
          })
        : await unlockFolio({
            businessId: session.businessId,
            folioId: id,
            actorId: session.userId,
          });

    const folio = (result as any)?.folio ?? result;
    return NextResponse.json({ folio });
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
      { error: error.message || "Failed to update folio lock state" },
      { status: 500 }
    );
  }
}
