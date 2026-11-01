import { NextResponse } from "next/server";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";
import {
  openTableSession,
  getActiveTableSessions,
  TableSessionError,
} from "@/lib/services/table-session-service";
import { z } from "zod";

const openSessionSchema = z.object({
  tableId: z.string().uuid("Invalid table ID"),
  guestCount: z.coerce.number().int().min(1, "Guest count must be at least 1").default(1),
  notes: z.string().max(500).optional(),
  branchId: z.string().uuid().optional().nullable(),
});

export async function GET(req: Request) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();

    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get("branchId") || session.branchId;
    const status = searchParams.get("status") || "ACTIVE";
    const floorId = searchParams.get("floorId");

    const sessions = await getActiveTableSessions({
      businessId: session.businessId,
      branchId,
      floorId,
      status,
    });

    return NextResponse.json({ sessions });
  } catch (error: any) {
    if (error instanceof TableSessionError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { error: error.message || "Failed to fetch table sessions" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();

    const body = await req.json();
    const parsed = openSessionSchema.parse(body);

    const branchId = parsed.branchId || session.branchId;
    if (!branchId) {
      return NextResponse.json({ error: "Branch ID is required" }, { status: 400 });
    }

    const result = await openTableSession({
      businessId: session.businessId,
      branchId,
      tableId: parsed.tableId,
      guestCount: parsed.guestCount,
      openedById: session.userId,
      notes: parsed.notes,
    });

    return NextResponse.json(result, { status: 201 });
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
      { error: error.message || "Failed to open table session" },
      { status: 500 }
    );
  }
}
