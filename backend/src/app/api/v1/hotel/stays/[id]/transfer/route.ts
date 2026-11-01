import { NextResponse } from "next/server";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";
import { transferRoom } from "@/lib/services/hotel-room-transfer-service";
import { HotelError } from "@/lib/services/room-availability-service";
import { z } from "zod";

const transferRoomSchema = z.object({
  targetRoomId: z.string().uuid("Target room ID is required"),
  reason: z.string().trim().min(1, "Transfer reason is required").max(500).optional(),
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
    const parsed = transferRoomSchema.parse(body);

    const result = await transferRoom({
      businessId: session.businessId,
      stayId: id,
      targetRoomId: parsed.targetRoomId,
      reason: parsed.reason || "Guest room transfer",
      actorId: session.userId,
    });

    return NextResponse.json(result);
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
      { error: error.message || "Failed to transfer room" },
      { status: 500 }
    );
  }
}
