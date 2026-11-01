import { NextResponse } from "next/server";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";
import {
  createReservation,
  getReservations,
} from "@/lib/services/hotel-reservation-service";
import { HotelError } from "@/lib/services/room-availability-service";
import { z } from "zod";

const guestSchema = z.object({
  name: z.string().trim().min(1, "Guest name is required").max(150),
  email: z.string().email().optional().nullable().or(z.literal("")),
  phone: z.string().max(50).optional().nullable(),
  idType: z.string().max(50).optional().nullable(),
  idNumber: z.string().max(100).optional().nullable(),
  isPrimary: z.boolean().optional(),
});

const createReservationSchema = z.object({
  guestName: z.string().trim().min(1, "Guest name is required").max(150),
  guestEmail: z.string().email().optional().nullable().or(z.literal("")),
  guestPhone: z.string().max(50).optional().nullable(),
  roomTypeId: z.string().uuid("Invalid room type ID"),
  roomId: z.string().uuid().optional().nullable(),
  checkInDate: z.union([z.string(), z.date()]),
  checkOutDate: z.union([z.string(), z.date()]),
  adults: z.coerce.number().int().min(1).default(1),
  children: z.coerce.number().int().min(0).default(0),
  ratePlan: z.string().max(50).optional().nullable(),
  nightlyRate: z.coerce.number().min(0).optional(),
  depositAmount: z.coerce.number().min(0).optional(),
  specialRequests: z.string().max(1000).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  guests: z.array(guestSchema).optional(),
  branchId: z.string().uuid().optional().nullable(),
});

export async function GET(req: Request) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();

    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get("branchId") || session.branchId;
    const status = searchParams.get("status") || undefined;
    const roomId = searchParams.get("roomId") || undefined;
    const fromDateParam = searchParams.get("fromDate");
    const toDateParam = searchParams.get("toDate");

    const fromDate = fromDateParam ? new Date(fromDateParam) : undefined;
    const toDate = toDateParam ? new Date(toDateParam) : undefined;

    const reservations = await getReservations({
      businessId: session.businessId,
      branchId,
      status,
      roomId,
      fromDate,
      toDate,
    });

    return NextResponse.json({ reservations });
  } catch (error: any) {
    if (error instanceof HotelError || error?.name === "HotelError" || typeof error?.statusCode === "number") {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode || 400 }
      );
    }
    return NextResponse.json(
      { error: error.message || "Failed to fetch reservations" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();

    const body = await req.json();
    const parsed = createReservationSchema.parse(body);

    const branchId = parsed.branchId || session.branchId;
    if (!branchId) {
      return NextResponse.json(
        { error: "Branch ID is required" },
        { status: 400 }
      );
    }

    const reservation = await createReservation({
      businessId: session.businessId,
      branchId,
      guestName: parsed.guestName,
      guestEmail: parsed.guestEmail || undefined,
      guestPhone: parsed.guestPhone || undefined,
      roomTypeId: parsed.roomTypeId,
      roomId: parsed.roomId || undefined,
      checkInDate: new Date(parsed.checkInDate),
      checkOutDate: new Date(parsed.checkOutDate),
      adults: parsed.adults,
      children: parsed.children,
      ratePlan: parsed.ratePlan || undefined,
      nightlyRate: parsed.nightlyRate,
      depositAmount: parsed.depositAmount,
      specialRequests: parsed.specialRequests || undefined,
      notes: parsed.notes || undefined,
      guests: parsed.guests?.map((g) => ({
        name: g.name,
        email: g.email || undefined,
        phone: g.phone || undefined,
        idType: g.idType || undefined,
        idNumber: g.idNumber || undefined,
        isPrimary: g.isPrimary,
      })),
      createdById: session.userId,
      actorId: session.userId,
    } as any);

    return NextResponse.json({ reservation }, { status: 201 });
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
      { error: error.message || "Failed to create reservation" },
      { status: 500 }
    );
  }
}
