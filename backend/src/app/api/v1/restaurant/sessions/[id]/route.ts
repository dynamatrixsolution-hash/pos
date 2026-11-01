import { NextResponse } from "next/server";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";
import {
  getTableSessionById,
  updateTableSession,
  TableSessionError,
} from "@/lib/services/table-session-service";
import { z } from "zod";

const updateSessionSchema = z.object({
  guestCount: z.coerce.number().int().min(1).optional(),
  notes: z.string().max(500).optional().nullable(),
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
    const tableSession = await getTableSessionById(session.businessId, id);

    return NextResponse.json({ session: tableSession });
  } catch (error: any) {
    if (error instanceof TableSessionError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { error: error.message || "Failed to fetch table session" },
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
    const parsed = updateSessionSchema.parse(body);

    const updated = await updateTableSession({
      businessId: session.businessId,
      sessionId: id,
      guestCount: parsed.guestCount,
      notes: parsed.notes,
      expectedVersion: parsed.expectedVersion,
      actorId: session.userId,
    });

    return NextResponse.json({ session: updated });
  } catch (error: any) {
    if (error instanceof TableSessionError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Validation failed" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: error.message || "Failed to update table session" },
      { status: 500 }
    );
  }
}
