import { NextResponse } from "next/server";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";
import { updateServiceRequestStatus } from "@/lib/services/guest-portal-service";
import { HotelError } from "@/lib/services/room-availability-service";
import { z } from "zod";

const updateServiceRequestSchema = z.object({
  status: z.enum(["ACKNOWLEDGED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]),
  resolutionNotes: z.string().max(500).optional().nullable(),
});

async function handleStatusUpdate(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();

    const { id } = await params;
    const body = await req.json();
    const parsed = updateServiceRequestSchema.parse(body);

    const serviceRequest = await updateServiceRequestStatus({
      businessId: session.businessId,
      requestId: id,
      status: parsed.status,
      resolutionNotes: parsed.resolutionNotes,
      actorId: session.userId,
    });

    return NextResponse.json({ serviceRequest });
  } catch (error: any) {
    if (
      error instanceof HotelError ||
      error?.name === "HotelError" ||
      typeof error?.statusCode === "number"
    ) {
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
      { error: error.message || "Failed to update service request status" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  return handleStatusUpdate(req, context);
}

export async function PUT(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  return handleStatusUpdate(req, context);
}
