import { db } from "@/lib/db";
import { createAuditEvent } from "@/lib/audit-event";
import {
  HotelError,
  isExclusionViolation,
  parseDate,
  PrismaClientLike,
  withHotelTransaction,
} from "@/lib/services/room-availability-service";

export type HousekeepingStatus = "DIRTY" | "IN_PROGRESS" | "CLEAN" | "INSPECTED";

export interface CreateHousekeepingTaskInput {
  businessId: string;
  branchId: string;
  roomId: string;
  stayId?: string | null;
  taskType?: string;
  status?: HousekeepingStatus;
  priority?: string;
  assignedToId?: string | null;
  scheduledDate?: Date | string;
  notes?: string | null;
  actorId?: string;
}

export interface GetHousekeepingTasksInput {
  businessId: string;
  branchId?: string | null;
  roomId?: string | null;
  status?: string | null;
  assignedToId?: string | null;
}

export interface UpdateHousekeepingTaskStatusInput {
  businessId: string;
  taskId: string;
  status: HousekeepingStatus;
  assignedToId?: string | null;
  notes?: string | null;
  actorId?: string;
}

export interface CreateMaintenanceTicketInput {
  businessId: string;
  branchId: string;
  roomId: string;
  title: string;
  description?: string | null;
  priority?: string;
  startDate: Date | string;
  endDate: Date | string;
  assignedToId?: string | null;
  actorId?: string;
}

export interface GetMaintenanceTicketsInput {
  businessId: string;
  branchId?: string | null;
  roomId?: string | null;
  status?: string | null;
}

export interface ResolveMaintenanceTicketInput {
  businessId: string;
  ticketId: string;
  status?: "RESOLVED" | "CANCELLED";
  resolutionNotes?: string | null;
  actorId?: string;
}

function generateMaintenanceTicketNumber(now = new Date()): string {
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, "");
  const timePart = now.toTimeString().slice(0, 8).replace(/:/g, "");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `MNT-${datePart}-${timePart}-${rand}`;
}

// -----------------------------------------------------------------------------
// Housekeeping Operations
// -----------------------------------------------------------------------------

export async function createHousekeepingTask(
  input: CreateHousekeepingTaskInput,
  prismaClient: PrismaClientLike = db
) {
  return await withHotelTransaction(prismaClient, async (tx) => {
    const room = await tx.room.findFirst({
      where: { id: input.roomId, businessId: input.businessId },
    });
    if (!room) {
      throw new HotelError("Room not found", 404, "ROOM_NOT_FOUND");
    }

    const scheduledDate = input.scheduledDate
      ? parseDate(input.scheduledDate, "scheduledDate")
      : new Date();

    const taskStatus = input.status ?? "DIRTY";

    const task = await tx.housekeepingTask.create({
      data: {
        businessId: input.businessId,
        branchId: input.branchId,
        roomId: input.roomId,
        stayId: input.stayId ?? null,
        taskType: input.taskType ?? "DAILY_CLEANING",
        status: taskStatus,
        priority: input.priority ?? "MEDIUM",
        assignedToId: input.assignedToId ?? null,
        scheduledDate,
        notes: input.notes ?? null,
      },
      include: {
        room: { include: { roomType: true, floor: true } },
        stay: true,
      },
    });

    if (
      taskStatus === "DIRTY" &&
      room.status !== "MAINTENANCE" &&
      room.status !== "OUT_OF_SERVICE"
    ) {
      const nextRoomStatus = room.currentStayId ? "OCCUPIED_DIRTY" : "VACANT_DIRTY";
      if (room.status !== nextRoomStatus) {
        await tx.room.update({
          where: { id: room.id },
          data: { status: nextRoomStatus },
        });
      }
    }

    await createAuditEvent(
      {
        businessId: input.businessId,
        branchId: input.branchId,
        userId: input.actorId ?? null,
        action: "HOUSEKEEPING_TASK_CREATED",
        entity: "HousekeepingTask",
        entityId: task.id,
        newValue: task,
      },
      tx
    );

    return task;
  });
}

export async function getHousekeepingTasks(
  input: GetHousekeepingTasksInput,
  prismaClient: PrismaClientLike = db
) {
  return await prismaClient.housekeepingTask.findMany({
    where: {
      businessId: input.businessId,
      ...(input.branchId ? { branchId: input.branchId } : {}),
      ...(input.roomId ? { roomId: input.roomId } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(input.assignedToId ? { assignedToId: input.assignedToId } : {}),
    },
    include: {
      room: {
        include: { roomType: true, floor: true },
      },
      stay: true,
      assignedTo: {
        select: { id: true, name: true, email: true },
      },
      completedBy: {
        select: { id: true, name: true, email: true },
      },
    },
    orderBy: [{ createdAt: "desc" }],
  });
}

export async function updateHousekeepingTaskStatus(
  input: UpdateHousekeepingTaskStatusInput,
  prismaClient: PrismaClientLike = db
) {
  return await withHotelTransaction(prismaClient, async (tx) => {
    const existing = await tx.housekeepingTask.findFirst({
      where: { id: input.taskId, businessId: input.businessId },
    });
    if (!existing) {
      throw new HotelError("Housekeeping task not found", 404, "HOUSEKEEPING_TASK_NOT_FOUND");
    }

    const room = await tx.room.findFirst({
      where: { id: existing.roomId, businessId: input.businessId },
    });
    if (!room) {
      throw new HotelError("Room not found", 404, "ROOM_NOT_FOUND");
    }

    const now = new Date();
    const isCompleted = input.status === "CLEAN" || input.status === "INSPECTED";

    const updatedTask = await tx.housekeepingTask.update({
      where: { id: existing.id },
      data: {
        status: input.status,
        ...(input.assignedToId !== undefined ? { assignedToId: input.assignedToId } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...(input.status === "IN_PROGRESS" && !existing.startedAt ? { startedAt: now } : {}),
        ...(isCompleted
          ? {
              completedAt: now,
              completedById: input.actorId ?? existing.completedById ?? null,
            }
          : {}),
      },
      include: {
        room: { include: { roomType: true, floor: true } },
        stay: true,
      },
    });

    let updatedRoom = room;
    if (room.status !== "MAINTENANCE" && room.status !== "OUT_OF_SERVICE") {
      let targetRoomStatus: string | undefined;
      if (input.status === "CLEAN" || input.status === "INSPECTED") {
        targetRoomStatus = room.currentStayId ? "OCCUPIED_CLEAN" : "VACANT_CLEAN";
      } else if (input.status === "DIRTY") {
        targetRoomStatus = room.currentStayId ? "OCCUPIED_DIRTY" : "VACANT_DIRTY";
      }

      if (targetRoomStatus && targetRoomStatus !== room.status) {
        updatedRoom = await tx.room.update({
          where: { id: room.id },
          data: { status: targetRoomStatus },
        });
      }
    }

    await createAuditEvent(
      {
        businessId: input.businessId,
        branchId: existing.branchId,
        userId: input.actorId ?? null,
        action: "HOUSEKEEPING_TASK_UPDATED",
        entity: "HousekeepingTask",
        entityId: updatedTask.id,
        oldValue: existing,
        newValue: { task: updatedTask, roomStatus: updatedRoom.status },
      },
      tx
    );

    return {
      task: updatedTask,
      room: updatedRoom,
    };
  });
}

// -----------------------------------------------------------------------------
// Maintenance Ticket & Blocking Operations
// -----------------------------------------------------------------------------

export async function createMaintenanceTicket(
  input: CreateMaintenanceTicketInput,
  prismaClient: PrismaClientLike = db
) {
  const title = input.title?.trim();
  if (!title) {
    throw new HotelError("Maintenance ticket title is required", 400, "VALIDATION_ERROR");
  }

  const startDate = parseDate(input.startDate, "startDate");
  const endDate = parseDate(input.endDate, "endDate");

  if (startDate.getTime() >= endDate.getTime()) {
    throw new HotelError("startDate must be before endDate", 400, "INVALID_DATE_RANGE");
  }

  try {
    return await withHotelTransaction(prismaClient, async (tx) => {
      const room = await tx.room.findFirst({
        where: { id: input.roomId, businessId: input.businessId },
      });
      if (!room) {
        throw new HotelError("Room not found", 404, "ROOM_NOT_FOUND");
      }

      const ticket = await tx.maintenanceTicket.create({
        data: {
          businessId: input.businessId,
          branchId: input.branchId,
          roomId: input.roomId,
          ticketNumber: generateMaintenanceTicketNumber(),
          title,
          description: input.description ?? null,
          status: "OPEN",
          priority: input.priority ?? "MEDIUM",
          startDate,
          endDate,
          reportedById: input.actorId ?? null,
          assignedToId: input.assignedToId ?? null,
        },
      });

      const allocation = await tx.roomAllocation.create({
        data: {
          businessId: input.businessId,
          branchId: input.branchId,
          roomId: input.roomId,
          maintenanceTicketId: ticket.id,
          startDate,
          endDate,
          isBlocking: true,
          status: "MAINTENANCE",
          notes: title,
        },
      });

      let updatedRoom = room;
      if (room.currentStayId === null) {
        updatedRoom = await tx.room.update({
          where: { id: room.id },
          data: { status: "MAINTENANCE" },
        });
      }

      await createAuditEvent(
        {
          businessId: input.businessId,
          branchId: input.branchId,
          userId: input.actorId ?? null,
          action: "MAINTENANCE_TICKET_CREATED",
          entity: "MaintenanceTicket",
          entityId: ticket.id,
          newValue: { ticket, allocation, roomStatus: updatedRoom.status },
        },
        tx
      );

      return {
        ticket,
        allocation,
        room: updatedRoom,
      };
    });
  } catch (err) {
    if (isExclusionViolation(err)) {
      throw new HotelError(
        "Room has an overlapping booking or block during the maintenance window",
        409,
        "ROOM_DOUBLE_BOOKED"
      );
    }
    throw err;
  }
}

export async function getMaintenanceTickets(
  input: GetMaintenanceTicketsInput,
  prismaClient: PrismaClientLike = db
) {
  return await prismaClient.maintenanceTicket.findMany({
    where: {
      businessId: input.businessId,
      ...(input.branchId ? { branchId: input.branchId } : {}),
      ...(input.roomId ? { roomId: input.roomId } : {}),
      ...(input.status ? { status: input.status } : {}),
    },
    include: {
      room: {
        include: { roomType: true, floor: true },
      },
      allocations: true,
      reportedBy: {
        select: { id: true, name: true, email: true },
      },
      assignedTo: {
        select: { id: true, name: true, email: true },
      },
      resolvedBy: {
        select: { id: true, name: true, email: true },
      },
    },
    orderBy: [{ createdAt: "desc" }],
  });
}

export async function resolveMaintenanceTicket(
  input: ResolveMaintenanceTicketInput,
  prismaClient: PrismaClientLike = db
) {
  return await withHotelTransaction(prismaClient, async (tx) => {
    const existing = await tx.maintenanceTicket.findFirst({
      where: { id: input.ticketId, businessId: input.businessId },
    });
    if (!existing) {
      throw new HotelError("Maintenance ticket not found", 404, "MAINTENANCE_TICKET_NOT_FOUND");
    }

    const now = new Date();
    const targetStatus = input.status ?? "RESOLVED";

    const ticket = await tx.maintenanceTicket.update({
      where: { id: existing.id },
      data: {
        status: targetStatus,
        resolvedAt: now,
        resolvedById: input.actorId ?? null,
        resolutionNotes: input.resolutionNotes ?? existing.resolutionNotes,
      },
      include: {
        room: { include: { roomType: true, floor: true } },
      },
    });

    await tx.roomAllocation.updateMany({
      where: {
        businessId: input.businessId,
        maintenanceTicketId: existing.id,
        isBlocking: true,
      },
      data: {
        isBlocking: false,
        status: "COMPLETED",
      },
    });

    const room = await tx.room.findFirstOrThrow({
      where: { id: existing.roomId, businessId: input.businessId },
    });

    let updatedRoom = room;
    if (room.status === "MAINTENANCE") {
      updatedRoom = await tx.room.update({
        where: { id: room.id },
        data: {
          status: room.currentStayId ? "OCCUPIED_DIRTY" : "VACANT_DIRTY",
        },
      });
    }

    await tx.housekeepingTask.create({
      data: {
        businessId: input.businessId,
        branchId: existing.branchId,
        roomId: existing.roomId,
        taskType: "DEEP_CLEANING",
        status: "DIRTY",
        priority: "MEDIUM",
        notes: "Post-maintenance cleaning",
      },
    });

    await createAuditEvent(
      {
        businessId: input.businessId,
        branchId: existing.branchId,
        userId: input.actorId ?? null,
        action:
          targetStatus === "CANCELLED"
            ? "MAINTENANCE_TICKET_CANCELLED"
            : "MAINTENANCE_TICKET_RESOLVED",
        entity: "MaintenanceTicket",
        entityId: ticket.id,
        oldValue: existing,
        newValue: { ticket, roomStatus: updatedRoom.status },
      },
      tx
    );

    return {
      ticket,
      room: updatedRoom,
    };
  });
}
