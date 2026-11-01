import { NextResponse } from "next/server";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";
import {
  ensureGuestFolio,
  getAllFolios,
  getFolioAccountingReconciliation,
} from "@/lib/services/folio-service";
import { HotelError } from "@/lib/services/room-availability-service";
import { z } from "zod";

const createFolioSchema = z.object({
  stayId: z.string().uuid("Stay ID is required"),
  windowName: z.string().trim().min(1).max(100).optional(),
  notes: z.string().max(1000).optional().nullable(),
  branchId: z.string().uuid().optional().nullable(),
});

export async function GET(req: Request) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();

    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get("branchId") || session.branchId;
    const stayId = searchParams.get("stayId") || undefined;
    const status = searchParams.get("status") || undefined;

    const folios = await getAllFolios({
      businessId: session.businessId,
      branchId,
      stayId,
      status,
    });

    if (stayId) {
      const reconciliation = await getFolioAccountingReconciliation({
        businessId: session.businessId,
        stayId,
      });
      return NextResponse.json({ folios, reconciliation });
    }

    return NextResponse.json({ folios });
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
      { error: error.message || "Failed to fetch folios" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();

    const body = await req.json();
    const parsed = createFolioSchema.parse(body);

    const branchId = parsed.branchId || session.branchId;
    if (!branchId) {
      return NextResponse.json(
        { error: "Branch ID is required" },
        { status: 400 }
      );
    }

    const result = await ensureGuestFolio({
      businessId: session.businessId,
      branchId,
      stayId: parsed.stayId,
      windowName: parsed.windowName,
      notes: parsed.notes,
      actorId: session.userId,
    });

    const folio = (result as any)?.folio ?? result;
    return NextResponse.json({ folio }, { status: 201 });
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
      { error: error.message || "Failed to create guest folio" },
      { status: 500 }
    );
  }
}
