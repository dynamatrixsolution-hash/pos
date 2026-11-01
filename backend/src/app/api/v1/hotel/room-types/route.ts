import { NextResponse } from "next/server";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";
import {
  createRoomType,
  getRoomTypes,
  HotelError,
} from "@/lib/services/room-availability-service";
import { z } from "zod";

const createRoomTypeSchema = z.object({
  name: z.string().trim().min(1, "Room type name is required").max(100),
  code: z.string().trim().min(1, "Room type code is required").max(50),
  description: z.string().max(500).optional().nullable(),
  baseRate: z.coerce.number().min(0, "Base rate must be non-negative").default(0),
  maxOccupancy: z.coerce.number().int().min(1, "Max occupancy must be at least 1").default(2),
  amenities: z.array(z.string()).optional().nullable(),
  images: z.array(z.string()).optional().nullable(),
  displayOrder: z.coerce.number().int().default(0),
  isActive: z.boolean().optional(),
  branchId: z.string().uuid().optional().nullable(),
});

export async function GET(req: Request) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();

    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get("branchId") || session.branchId;
    const isActiveParam = searchParams.get("isActive");
    const isActive =
      isActiveParam !== null ? isActiveParam === "true" : undefined;

    const roomTypes = await getRoomTypes({
      businessId: session.businessId,
      branchId,
      isActive,
    });

    return NextResponse.json({ roomTypes });
  } catch (error: any) {
    if (error instanceof HotelError || error?.name === "HotelError" || typeof error?.statusCode === "number") {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode || 400 }
      );
    }
    return NextResponse.json(
      { error: error.message || "Failed to fetch room types" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();

    const body = await req.json();
    const parsed = createRoomTypeSchema.parse(body);

    const branchId = parsed.branchId || session.branchId;
    if (!branchId) {
      return NextResponse.json(
        { error: "Branch ID is required" },
        { status: 400 }
      );
    }

    const roomType = await createRoomType({
      businessId: session.businessId,
      branchId,
      name: parsed.name,
      code: parsed.code,
      description: parsed.description ?? undefined,
      baseRate: parsed.baseRate,
      maxOccupancy: parsed.maxOccupancy,
      amenities: parsed.amenities ?? undefined,
      images: parsed.images ?? undefined,
      displayOrder: parsed.displayOrder,
      isActive: parsed.isActive,
      actorId: session.userId,
    });

    return NextResponse.json({ roomType }, { status: 201 });
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
      { error: error.message || "Failed to create room type" },
      { status: 500 }
    );
  }
}
