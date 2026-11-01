import { NextResponse } from "next/server";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";
import {
  createRoom,
  getRooms,
  HotelError,
} from "@/lib/services/room-availability-service";
import { z } from "zod";

const createRoomSchema = z.object({
  roomTypeId: z.string().uuid("Invalid room type ID"),
  floorId: z.string().uuid().optional().nullable(),
  roomNumber: z.string().trim().min(1, "Room number is required").max(50),
  capacity: z.coerce.number().int().min(1, "Capacity must be at least 1").optional(),
  status: z.string().optional(),
  keyCardAlias: z.string().max(100).optional().nullable(),
  features: z.array(z.string()).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
  isActive: z.boolean().optional(),
  branchId: z.string().uuid().optional().nullable(),
});

export async function GET(req: Request) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();

    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get("branchId") || session.branchId;
    const roomTypeId = searchParams.get("roomTypeId") || undefined;
    const floorId = searchParams.get("floorId") || undefined;
    const status = searchParams.get("status") || undefined;
    const isActiveParam = searchParams.get("isActive");
    const isActive =
      isActiveParam !== null ? isActiveParam === "true" : undefined;

    const rooms = await getRooms({
      businessId: session.businessId,
      branchId,
      roomTypeId,
      floorId,
      status,
      isActive,
    });

    return NextResponse.json({ rooms });
  } catch (error: any) {
    if (error instanceof HotelError || error?.name === "HotelError" || typeof error?.statusCode === "number") {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode || 400 }
      );
    }
    return NextResponse.json(
      { error: error.message || "Failed to fetch rooms" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();

    const body = await req.json();
    const parsed = createRoomSchema.parse(body);

    const branchId = parsed.branchId || session.branchId;
    if (!branchId) {
      return NextResponse.json(
        { error: "Branch ID is required" },
        { status: 400 }
      );
    }

    const room = await createRoom({
      businessId: session.businessId,
      branchId,
      roomTypeId: parsed.roomTypeId,
      floorId: parsed.floorId ?? undefined,
      roomNumber: parsed.roomNumber,
      capacity: parsed.capacity,
      status: parsed.status,
      keyCardAlias: parsed.keyCardAlias ?? undefined,
      features: parsed.features ?? undefined,
      notes: parsed.notes ?? undefined,
      isActive: parsed.isActive,
      actorId: session.userId,
    });

    return NextResponse.json({ room }, { status: 201 });
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
      { error: error.message || "Failed to create room" },
      { status: 500 }
    );
  }
}
