import { NextResponse } from "next/server";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";
import {
  getFolioById,
  postRoomNightCharge,
  postManualFolioCharge,
} from "@/lib/services/folio-service";
import { HotelError } from "@/lib/services/room-availability-service";
import { z } from "zod";

const roomNightChargeSchema = z.object({
  type: z.literal("ROOM_NIGHT"),
  stayId: z.string().uuid("Invalid stay ID").optional(),
  chargeDate: z.union([z.string(), z.date()]),
  baseRate: z.union([z.number(), z.string()]).optional(),
  taxRatePercent: z.union([z.number(), z.string()]).optional(),
  ratePlan: z.string().max(100).optional().nullable(),
  branchId: z.string().uuid().optional().nullable(),
});

const manualChargeSchema = z.object({
  type: z.literal("MANUAL").optional(),
  stayId: z.string().uuid("Invalid stay ID").optional(),
  category: z.enum(["ROOM", "DINING", "MINIBAR", "LAUNDRY", "SPA", "OTHER"]),
  description: z.string().trim().min(1, "Description is required").max(500),
  amount: z.union([z.number(), z.string()]),
  taxAmount: z.union([z.number(), z.string()]).optional(),
  sourceId: z.string().optional(),
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

    if (body?.type === "ROOM_NIGHT") {
      const parsed = roomNightChargeSchema.parse(body);

      let stayId = parsed.stayId;
      let branchId = parsed.branchId || session.branchId;

      if (!stayId || !branchId) {
        const rawFolio = await getFolioById(session.businessId, id);
        const existingFolio = (rawFolio as any)?.folio ?? rawFolio;
        stayId = stayId || existingFolio.stayId;
        branchId = branchId || existingFolio.branchId;
      }

      if (!branchId) {
        return NextResponse.json(
          { error: "Branch ID is required" },
          { status: 400 }
        );
      }

      const result = await postRoomNightCharge({
        businessId: session.businessId,
        branchId,
        stayId: stayId!,
        folioId: id,
        chargeDate: parsed.chargeDate,
        baseRate: parsed.baseRate,
        taxRatePercent: parsed.taxRatePercent,
        ratePlan: parsed.ratePlan,
        actorId: session.userId,
      });

      return NextResponse.json(
        { entry: result.entry, folio: result.folio },
        { status: 201 }
      );
    }

    const parsed = manualChargeSchema.parse(body);

    let stayId = parsed.stayId;
    let branchId = parsed.branchId || session.branchId;

    if (!stayId || !branchId) {
      const rawFolio = await getFolioById(session.businessId, id);
      const existingFolio = (rawFolio as any)?.folio ?? rawFolio;
      stayId = stayId || existingFolio.stayId;
      branchId = branchId || existingFolio.branchId;
    }

    if (!branchId) {
      return NextResponse.json(
        { error: "Branch ID is required" },
        { status: 400 }
      );
    }

    const result = await postManualFolioCharge({
      businessId: session.businessId,
      branchId,
      stayId: stayId!,
      folioId: id,
      category: parsed.category,
      description: parsed.description,
      amount: parsed.amount,
      taxAmount: parsed.taxAmount,
      sourceId: parsed.sourceId,
      actorId: session.userId,
    });

    return NextResponse.json(
      { entry: result.entry, folio: result.folio },
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
      { error: error.message || "Failed to post charge to folio" },
      { status: 500 }
    );
  }
}
