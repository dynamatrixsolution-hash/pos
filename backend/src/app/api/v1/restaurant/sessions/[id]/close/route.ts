import { NextResponse } from "next/server";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";
import { closeTableSession, TableSessionError } from "@/lib/services/table-session-service";
import { z } from "zod";

const closeSessionSchema = z.object({
  notes: z.string().max(500).optional(),
  force: z.boolean().default(false),
  expectedVersion: z.coerce.number().int().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();

    const { id: sessionId } = await params;
    const body = await req.json().catch(() => ({}));
    const parsed = closeSessionSchema.parse(body);

    const closedSession = await closeTableSession({
      businessId: session.businessId,
      sessionId,
      closedById: session.userId,
      notes: parsed.notes,
      force: parsed.force,
      expectedVersion: parsed.expectedVersion,
    });

    return NextResponse.json({
      success: true,
      message: "Table session successfully closed",
      session: closedSession,
    });
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
      { error: error.message || "Failed to close table session" },
      { status: 500 }
    );
  }
}
