import { NextResponse } from "next/server";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";
import {
  advanceTicketStatus,
  KitchenRoutingError,
} from "@/lib/services/kitchen-routing-service";
import { RecipeServiceError } from "@/lib/services/recipe-consumption-service";
import { StockLedgerError } from "@/lib/services/stock-ledger-service";
import { z } from "zod";

const updateTicketStatusSchema = z.object({
  status: z.enum(["QUEUED", "PREPARING", "READY", "SERVED", "CANCELLED"]),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();

    const { id: ticketId } = await params;
    const body = await req.json();
    const parsed = updateTicketStatusSchema.parse(body);

    const ticket = await advanceTicketStatus({
      businessId: session.businessId,
      ticketId,
      newStatus: parsed.status,
      actorId: session.userId,
    });

    return NextResponse.json({ success: true, ticket });
  } catch (error: any) {
    console.error("STATUS PATCH ERROR:", error);
    if (
      error instanceof KitchenRoutingError ||
      error instanceof RecipeServiceError ||
      error instanceof StockLedgerError
    ) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode || 400 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Validation failed" }, { status: 400 });
    }
    return NextResponse.json({ error: error.message || "Failed to update ticket status" }, { status: 500 });
  }
}

