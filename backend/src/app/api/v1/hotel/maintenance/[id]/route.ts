import { NextResponse } from "next/server";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";
import { resolveMaintenanceTicket } from "@/lib/services/hotel-housekeeping-service";
import { HotelError } from "@/lib/services/room-availability-service";
import { z } from "zod";

const resolveMaintenanceTicketSchema = z.object({
  status: z.string().optional(),
  resolutionNotes: z.string().max(1000).optional().nullable(),
  assignedToId: z.string().uuid().optional().nullable(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const parsed = resolveMaintenanceTicketSchema.parse(body);

    const result = await resolveMaintenanceTicket({
      businessId: session.businessId,
      ticketId: id,
      id,
      status: parsed.status || "RESOLVED",
      resolutionNotes: parsed.resolutionNotes || undefined,
      assignedToId: parsed.assignedToId,
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
      { error: error.message || "Failed to update maintenance ticket" },
      { status: 500 }
    );
  }
}
