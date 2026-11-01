import { NextResponse } from "next/server";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";
import {
  updateRoomType,
  deleteRoomType,
  HotelError,
} from "@/lib/services/room-availability-service";
import { z } from "zod";

const updateRoomTypeSchema = z.object({
  name: z.string().trim().min(1, "Room type name cannot be empty").max(100).optional(),
  code: z.string().trim().min(1, "Room type code cannot be empty").max(50).optional(),
  description: z.string().max(500).optional().nullable(),
  baseRate: z.coerce.number().min(0, "Base rate must be non-negative").optional(),
  maxOccupancy: z.coerce.number().int().min(1, "Max occupancy must be at least 1").optional(),
  amenities: z.array(z.string()).optional().nullable(),
  images: z.array(z.string()).optional().nullable(),
  displayOrder: z.coerce.number().int().optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();

    const { id } = await params;
    const body = await req.json();
    const parsed = updateRoomTypeSchema.parse(body);

    const roomType = await updateRoomType({
      businessId: session.businessId,
      id,
      roomTypeId: id,
      ...parsed,
      actorId: session.userId,
    } as any);

    return NextResponse.json({ roomType });
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
      { error: error.message || "Failed to update room type" },
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
    await deleteRoomType(session.businessId, id, session.userId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error instanceof HotelError || error?.name === "HotelError" || typeof error?.statusCode === "number") {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode || 400 }
      );
    }
    return NextResponse.json(
      { error: error.message || "Failed to delete room type" },
      { status: 500 }
    );
  }
}
