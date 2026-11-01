import { NextResponse } from "next/server";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";
import {
  createHousekeepingTask,
  getHousekeepingTasks,
} from "@/lib/services/hotel-housekeeping-service";
import { HotelError } from "@/lib/services/room-availability-service";
import { z } from "zod";

const createHousekeepingTaskSchema = z.object({
  roomId: z.string().uuid("Room ID is required"),
  stayId: z.string().uuid().optional().nullable(),
  taskType: z.string().max(50).optional(),
  status: z.string().max(50).optional(),
  priority: z.string().max(50).optional(),
  assignedToId: z.string().uuid().optional().nullable(),
  scheduledDate: z.union([z.string(), z.date()]).optional(),
  notes: z.string().max(1000).optional().nullable(),
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
    const assignedToId = searchParams.get("assignedToId") || undefined;

    const tasks = await getHousekeepingTasks({
      businessId: session.businessId,
      branchId,
      roomId,
      status,
      assignedToId,
    });

    return NextResponse.json({ tasks });
  } catch (error: any) {
    if (error instanceof HotelError || error?.name === "HotelError" || typeof error?.statusCode === "number") {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode || 400 }
      );
    }
    return NextResponse.json(
      { error: error.message || "Failed to fetch housekeeping tasks" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();

    const body = await req.json();
    const parsed = createHousekeepingTaskSchema.parse(body);

    const branchId = parsed.branchId || session.branchId;
    if (!branchId) {
      return NextResponse.json(
        { error: "Branch ID is required" },
        { status: 400 }
      );
    }

    const result = await createHousekeepingTask({
      businessId: session.businessId,
      branchId,
      roomId: parsed.roomId,
      stayId: parsed.stayId || undefined,
      taskType: parsed.taskType,
      status: parsed.status,
      priority: parsed.priority,
      assignedToId: parsed.assignedToId || undefined,
      scheduledDate: parsed.scheduledDate
        ? new Date(parsed.scheduledDate)
        : undefined,
      notes: parsed.notes || undefined,
      actorId: session.userId,
    } as any);

    const task = (result as any)?.task ? (result as any).task : result;
    return NextResponse.json({ task }, { status: 201 });
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
      { error: error.message || "Failed to create housekeeping task" },
      { status: 500 }
    );
  }
}
