import { NextResponse } from "next/server";
import { getSessionContext, authErrorResponse, safeErrorMessage, requireRoles, ROLE_GROUPS } from "@/lib/api-helper";
import { updateHousekeepingTaskStatus } from "@/lib/services/hotel-housekeeping-service";
import { HotelError } from "@/lib/services/room-availability-service";
import { z } from "zod";

const updateHousekeepingTaskSchema = z.object({
  status: z.string().min(1, "Status is required"),
  assignedToId: z.string().uuid().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();
    const denied = requireRoles(session, ROLE_GROUPS.HOTEL_HOUSEKEEPING);
    if (denied) return denied;

    const { id } = await params;
    const body = await req.json();
    const parsed = updateHousekeepingTaskSchema.parse(body);

    const result = await updateHousekeepingTaskStatus({
      businessId: session.businessId,
      taskId: id,
      id,
      status: parsed.status,
      assignedToId: parsed.assignedToId,
      notes: parsed.notes || undefined,
      actorId: session.userId,
    } as any);

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
      { error: safeErrorMessage(error, "Failed to update housekeeping task") },
      { status: 500 }
    );
  }
}
