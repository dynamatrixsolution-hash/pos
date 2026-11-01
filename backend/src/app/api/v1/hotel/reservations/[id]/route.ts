import { NextResponse } from "next/server";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";
import {
  getReservationById,
  updateReservation,
  cancelReservation,
} from "@/lib/services/hotel-reservation-service";
import { HotelError } from "@/lib/services/room-availability-service";
import { z } from "zod";

const updateReservationSchema = z.object({
  action: z.string().optional(),
  status: z.string().optional(),
  reason: z.string().max(500).optional().nullable(),
  guestName: z.string().trim().min(1).max(150).optional(),
  guestEmail: z.string().email().optional().nullable().or(z.literal("")),
  guestPhone: z.string().max(50).optional().nullable(),
  roomTypeId: z.string().uuid().optional(),
  roomId: z.string().uuid().optional().nullable(),
  checkInDate: z.union([z.string(), z.date()]).optional(),
  checkOutDate: z.union([z.string(), z.date()]).optional(),
  adults: z.coerce.number().int().min(1).optional(),
  children: z.coerce.number().int().min(0).optional(),
  ratePlan: z.string().max(50).optional().nullable(),
  nightlyRate: z.coerce.number().min(0).optional(),
  depositAmount: z.coerce.number().min(0).optional(),
  specialRequests: z.string().max(1000).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  expectedVersion: z.coerce.number().int().optional(),
});

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();

    const { id } = await params;
    const reservation = await getReservationById(session.businessId, id);

    return NextResponse.json({ reservation });
  } catch (error: any) {
    if (error instanceof HotelError || error?.name === "HotelError" || typeof error?.statusCode === "number") {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode || 400 }
      );
    }
    return NextResponse.json(
      { error: error.message || "Failed to fetch reservation" },
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
    const parsed = updateReservationSchema.parse(body);

    if (
      parsed.action === "CANCEL" ||
      parsed.status === "CANCELLED" ||
      parsed.status === "NO_SHOW"
    ) {
      const targetStatus =
        parsed.status === "NO_SHOW" ? "NO_SHOW" : "CANCELLED";
      const reservation = await cancelReservation({
        businessId: session.businessId,
        id,
        reservationId: id,
        status: targetStatus,
        reason: parsed.reason ?? parsed.notes ?? undefined,
        actorId: session.userId,
      } as any);

      return NextResponse.json({ reservation });
    }

    const reservation = await updateReservation({
      businessId: session.businessId,
      id,
      reservationId: id,
      guestName: parsed.guestName,
      guestEmail: parsed.guestEmail,
      guestPhone: parsed.guestPhone,
      roomTypeId: parsed.roomTypeId,
      roomId: parsed.roomId,
      checkInDate: parsed.checkInDate ? new Date(parsed.checkInDate) : undefined,
      checkOutDate: parsed.checkOutDate ? new Date(parsed.checkOutDate) : undefined,
      adults: parsed.adults,
      children: parsed.children,
      ratePlan: parsed.ratePlan,
      nightlyRate: parsed.nightlyRate,
      depositAmount: parsed.depositAmount,
      specialRequests: parsed.specialRequests,
      notes: parsed.notes,
      expectedVersion: parsed.expectedVersion,
      actorId: session.userId,
    } as any);

    return NextResponse.json({ reservation });
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
      { error: error.message || "Failed to update reservation" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();

    const { id } = await params;
    const reservation = await cancelReservation({
      businessId: session.businessId,
      id,
      reservationId: id,
      status: "CANCELLED",
      actorId: session.userId,
    } as any);

    return NextResponse.json({ reservation });
  } catch (error: any) {
    if (error instanceof HotelError || error?.name === "HotelError" || typeof error?.statusCode === "number") {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode || 400 }
      );
    }
    return NextResponse.json(
      { error: error.message || "Failed to cancel reservation" },
      { status: 500 }
    );
  }
}
