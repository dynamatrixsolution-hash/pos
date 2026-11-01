import { NextResponse } from "next/server";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";
import { moveTableSession, TableSessionError } from "@/lib/services/table-session-service";
import { z } from "zod";

const moveTableSchema = z.object({
  sourceTableId: z.string().uuid("Invalid source table ID"),
  targetTableId: z.string().uuid("Invalid target table ID"),
  reason: z.string().max(255).optional(),
});

export async function POST(req: Request) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();

    const body = await req.json();
    const parsed = moveTableSchema.parse(body);

    const result = await moveTableSession({
      businessId: session.businessId,
      sourceTableId: parsed.sourceTableId,
      targetTableId: parsed.targetTableId,
      actorId: session.userId,
      reason: parsed.reason,
    });

    return NextResponse.json({
      success: true,
      message: `Session successfully moved to table ${result.targetTable.tableNumber}`,
      ...result,
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
      { error: error.message || "Failed to move table session" },
      { status: 500 }
    );
  }
}
