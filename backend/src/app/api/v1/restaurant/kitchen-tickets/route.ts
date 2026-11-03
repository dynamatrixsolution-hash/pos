import { NextResponse } from "next/server";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";
import {
  routeOrderRoundToStations,
  getLiveKDSTickets,
  getRecentServedTickets,
  KitchenRoutingError,
} from "@/lib/services/kitchen-routing-service";
import { z } from "zod";

const routeRoundSchema = z.object({
  roundId: z.string().min(1, "Round ID is required"),
});

export async function GET(req: Request) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();

    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get("branchId") || session.branchId;
    const stationId = searchParams.get("stationId") || undefined;
    if (!branchId) return NextResponse.json({ error: "Branch ID required" }, { status: 400 });

    const [tickets, served] = await Promise.all([
      getLiveKDSTickets(session.businessId, branchId, stationId),
      getRecentServedTickets(session.businessId, branchId, stationId),
    ]);
    return NextResponse.json({ tickets, served });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch kitchen tickets" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();

    const body = await req.json();
    const parsed = routeRoundSchema.parse(body);

    const tickets = await routeOrderRoundToStations({
      businessId: session.businessId,
      roundId: parsed.roundId,
      actorId: session.userId,
    });

    return NextResponse.json({ success: true, tickets }, { status: 201 });
  } catch (error: any) {
    if (error instanceof KitchenRoutingError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Validation failed" }, { status: 400 });
    }
    return NextResponse.json({ error: error.message || "Failed to route order round" }, { status: 500 });
  }
}

