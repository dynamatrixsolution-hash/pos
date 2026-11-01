import { NextResponse } from "next/server";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";
import {
  createMaintenanceTicket,
  getMaintenanceTickets,
} from "@/lib/services/hotel-housekeeping-service";
import { HotelError } from "@/lib/services/room-availability-service";
import { z } from "zod";

const createMaintenanceTicketSchema = z.object({
  roomId: z.string().uuid("Room ID is required"),
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().max(1000).optional().nullable(),
  priority: z.string().max(50).optional(),
  startDate: z.union([z.string(), z.date()]).optional(),
  endDate: z.union([z.string(), z.date()]).optional().nullable(),
  assignedToId: z.string().uuid().optional().nullable(),
  isBlocking: z.boolean().optional(),
  roomStatus: z.string().optional(),
  branchId: z.string().uuid().optional().nullable(),
});

export async function GET(req: Request) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();

    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get("branchId") || session.branchId;
    const roomId = searchParams.get("roomId") || undefined;
    const status = searchParams.get("status") || undefined;

    const tickets = await getMaintenanceTickets({
      businessId: session.businessId,
      branchId,
      roomId,
      status,
    });

    return NextResponse.json({ tickets });
  } catch (error: any) {
    if (error instanceof HotelError || error?.name === "HotelError" || typeof error?.statusCode === "number") {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode || 400 }
      );
    }
    return NextResponse.json(
      { error: error.message || "Failed to fetch maintenance tickets" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();

    const body = await req.json();
    const parsed = createMaintenanceTicketSchema.parse(body);

    const branchId = parsed.branchId || session.branchId;
    if (!branchId) {
      return NextResponse.json(
        { error: "Branch ID is required" },
        { status: 400 }
      );
    }

    const startDate = parsed.startDate ? new Date(parsed.startDate) : new Date();
    const endDate = parsed.endDate
      ? new Date(parsed.endDate)
      : new Date(startDate.getTime() + 24 * 60 * 60 * 1000);

    const result = await createMaintenanceTicket({
      businessId: session.businessId,
      branchId,
      roomId: parsed.roomId,
      title: parsed.title,
      description: parsed.description ?? null,
      priority: parsed.priority,
      startDate,
      endDate,
      assignedToId: parsed.assignedToId ?? null,
      actorId: session.userId,
    });

    return NextResponse.json(result, { status: 201 });
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
      { error: error.message || "Failed to create maintenance ticket" },
      { status: 500 }
    );
  }
}
