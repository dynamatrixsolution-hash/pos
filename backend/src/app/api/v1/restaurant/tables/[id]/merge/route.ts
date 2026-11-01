import { NextResponse } from "next/server";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";
import { mergeTableSessions, TableSessionError } from "@/lib/services/table-session-service";
import { z } from "zod";

const mergeTableSchema = z.object({
  targetTableId: z.string().uuid("Invalid target table ID"),
  reason: z.string().max(255).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();

    const { id: sourceTableId } = await params;
    const body = await req.json();
    const parsed = mergeTableSchema.parse(body);

    const result = await mergeTableSessions({
      businessId: session.businessId,
      sourceTableIds: [sourceTableId],
      targetTableId: parsed.targetTableId,
      actorId: session.userId,
      reason: parsed.reason,
    });

    return NextResponse.json({
      success: true,
      message: `Table session successfully merged into table ${result.targetTable.tableNumber}`,
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
      { error: error.message || "Failed to merge table sessions" },
      { status: 500 }
    );
  }
}
