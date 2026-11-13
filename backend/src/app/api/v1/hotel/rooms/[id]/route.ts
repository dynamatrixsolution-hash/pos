import { NextResponse } from "next/server";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";
import {
  updateRoom,
  deleteRoom,
  HotelError,
} from "@/lib/services/room-availability-service";
import { z } from "zod";

const updateRoomSchema = z.object({
  roomTypeId: z.string().uuid().optional(),
  floorId: z.string().uuid().optional().nullable(),
  roomNumber: z.string().trim().min(1).max(50).optional(),
  capacity: z.coerce.number().int().min(1).optional(),
  status: z.string().optional(),
  keyCardAlias: z.string().max(100).optional().nullable(),
  features: z.array(z.string()).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
  isActive: z.boolean().optional(),
});

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();

    const { id } = await params;
    const room = await (await import("@/lib/db")).db.room.findFirst({
      where: {
        id,
        businessId: session.businessId,
        isActive: true,
      },
      include: {
        roomType: true,
        floor: true,
      },
    });

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    return NextResponse.json({ room });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch room" },
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
    const parsed = updateRoomSchema.parse(body);

    const room = await updateRoom({
      businessId: session.businessId,
      id,
      roomId: id,
      ...parsed,
      actorId: session.userId,
    } as any);

    return NextResponse.json({ room });
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
      { error: error.message || "Failed to update room" },
      { status: 500 }
    );
  }
}

export const PUT = PATCH;

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();

    const { id } = await params;
    const result = await deleteRoom(session.businessId, id, session.userId);

    return NextResponse.json(result);
  } catch (error: any) {
    if (error instanceof HotelError || error?.name === "HotelError" || typeof error?.statusCode === "number") {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode || 400 }
      );
    }
    return NextResponse.json(
      { error: error.message || "Failed to delete room" },
      { status: 500 }
    );
  }
}
