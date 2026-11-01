import { NextResponse } from "next/server";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";
import { checkInGuest } from "@/lib/services/hotel-checkin-service";
import { HotelError } from "@/lib/services/room-availability-service";
import { z } from "zod";

const checkInSchema = z.object({
  reservationId: z.string().uuid().optional().nullable(),
  roomId: z.string().uuid("Room ID is required"),
  guestName: z.string().trim().min(1, "Guest name is required").max(150).optional(),
  guestEmail: z.string().email().optional().nullable().or(z.literal("")),
  guestPhone: z.string().max(50).optional().nullable(),
  guestIdType: z.string().max(50).optional().nullable(),
  guestIdNumber: z.string().max(100).optional().nullable(),
  checkInTime: z.union([z.string(), z.date()]).optional(),
  expectedCheckOut: z.union([z.string(), z.date()]).optional(),
  ratePerNight: z.coerce.number().min(0).optional(),
  paidAmount: z.coerce.number().min(0).optional(),
  notes: z.string().max(1000).optional().nullable(),
  branchId: z.string().uuid().optional().nullable(),
});

export async function POST(req: Request) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();

    const body = await req.json();
    const parsed = checkInSchema.parse(body);

    const branchId = parsed.branchId || session.branchId;
    if (!branchId) {
      return NextResponse.json(
        { error: "Branch ID is required" },
        { status: 400 }
      );
    }

    const result = await checkInGuest({
      businessId: session.businessId,
      branchId,
      reservationId: parsed.reservationId || undefined,
      roomId: parsed.roomId,
      guestName: parsed.guestName,
      guestEmail: parsed.guestEmail || undefined,
      guestPhone: parsed.guestPhone || undefined,
      guestIdType: parsed.guestIdType || undefined,
      guestIdNumber: parsed.guestIdNumber || undefined,
      checkInTime: parsed.checkInTime ? new Date(parsed.checkInTime) : undefined,
      expectedCheckOut: parsed.expectedCheckOut
        ? new Date(parsed.expectedCheckOut)
        : undefined,
      ratePerNight: parsed.ratePerNight,
      paidAmount: parsed.paidAmount,
      notes: parsed.notes || undefined,
      checkedInById: session.userId,
      actorId: session.userId,
    } as any);

    return NextResponse.json(result, { status: 201 });
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
      { error: error.message || "Failed to check in guest" },
      { status: 500 }
    );
  }
}
