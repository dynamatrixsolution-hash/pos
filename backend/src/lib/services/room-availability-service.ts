import { db } from "@/lib/db";
import { Prisma } from "@dynapos/db";
import { money } from "@/lib/services/decimal-math";
import { createAuditEvent } from "@/lib/audit-event";

export type PrismaClientLike = typeof db | Prisma.TransactionClient;

export class HotelError extends Error {
  statusCode: number;
  code?: string;
  constructor(message: string, statusCode = 400, code?: string) {
    super(message);
    this.name = "HotelError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

/**
 * Checks whether a database or Prisma error was triggered by a PostgreSQL exclusion constraint
 * (e.g., 23P01 or RoomAllocation_room_period_overlap_excl).
 */
export function isExclusionViolation(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as Record<string, unknown>;
  const message = typeof e.message === "string" ? e.message : "";
  const code = typeof e.code === "string" ? e.code : "";
  const metaStr = e.meta ? JSON.stringify(e.meta) : "";
  const combined = `${message} ${code} ${metaStr}`;
  return (
    combined.includes("23P01") ||
    combined.includes("RoomAllocation_room_period_overlap_excl") ||
    /exclusion/i.test(combined)
  );
}

/**
 * Executes a callback inside a Prisma transaction if `prismaClient` is a top-level PrismaClient,
 * or directly if `prismaClient` is already a `Prisma.TransactionClient`.
 */
export async function withHotelTransaction<T>(
  prismaClient: PrismaClientLike,
  fn: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  if ("$transaction" in prismaClient && typeof prismaClient.$transaction === "function") {
    return await (prismaClient as typeof db).$transaction(fn);
  }
  return await fn(prismaClient as Prisma.TransactionClient);
}

export function parseDate(val: Date | string, fieldName: string): Date {
  const d = val instanceof Date ? new Date(val.getTime()) : new Date(val);
  if (Number.isNaN(d.getTime())) {
    throw new HotelError(`Invalid date for ${fieldName}`, 400, "INVALID_DATE");
  }
  return d;
}

// -----------------------------------------------------------------------------
// Input Interfaces
// -----------------------------------------------------------------------------

export interface CreateRoomTypeInput {
  businessId: string;
  branchId: string;
  name: string;
  code: string;
  description?: string | null;
  baseRate?: number | string | Prisma.Decimal;
  maxOccupancy?: number;
  amenities?: string[];
  images?: string[];
  displayOrder?: number;
  isActive?: boolean;
  actorId?: string;
}

export interface GetRoomTypesInput {
  businessId: string;
  branchId?: string | null;
  isActive?: boolean;
}

export interface UpdateRoomTypeInput {
  businessId: string;
  id: string;
  name?: string;
  code?: string;
  description?: string | null;
  baseRate?: number | string | Prisma.Decimal;
  maxOccupancy?: number;
  amenities?: string[];
  images?: string[];
  isActive?: boolean;
  displayOrder?: number;
  actorId?: string;
}

export interface CreateRoomInput {
  businessId: string;
  branchId: string;
  roomTypeId: string;
  floorId?: string | null;
  roomNumber: string;
  capacity?: number;
  status?: string;
  keyCardAlias?: string | null;
  features?: string[];
  notes?: string | null;
  isActive?: boolean;
  actorId?: string;
}

export interface GetRoomsInput {
  businessId: string;
  branchId?: string | null;
  roomTypeId?: string | null;
  floorId?: string | null;
  status?: string | null;
  isActive?: boolean;
}

export interface UpdateRoomInput {
  businessId: string;
  id: string;
  roomNumber?: string;
  roomTypeId?: string;
  floorId?: string | null;
  capacity?: number;
  status?: string;
  keyCardAlias?: string | null;
  features?: string[];
  notes?: string | null;
  isActive?: boolean;
  actorId?: string;
}

export interface GetRoomAvailabilityInput {
  businessId: string;
  branchId?: string | null;
  startDate: Date | string;
  endDate: Date | string;
  roomTypeId?: string | null;
}

export interface GetTapeChartMatrixInput {
  businessId: string;
  branchId?: string | null;
  startDate: Date | string;
  endDate: Date | string;
  floorId?: string | null;
  roomTypeId?: string | null;
}

// -----------------------------------------------------------------------------
// RoomType Operations
// -----------------------------------------------------------------------------

export async function createRoomType(
  input: CreateRoomTypeInput,
  prismaClient: PrismaClientLike = db
) {
  const name = input.name?.trim();
  const code = input.code?.trim().toUpperCase();
  if (!name) {
    throw new HotelError("Room type name is required", 400, "VALIDATION_ERROR");
  }
  if (!code) {
    throw new HotelError("Room type code is required", 400, "VALIDATION_ERROR");
  }

  return await withHotelTransaction(prismaClient, async (tx) => {
    const existing = await tx.roomType.findFirst({
      where: {
        businessId: input.businessId,
        branchId: input.branchId,
        code: { equals: code, mode: "insensitive" },
      },
    });
    if (existing) {
      throw new HotelError(
        `Room type code "${code}" already exists in this branch`,
        409,
        "DUPLICATE_ROOM_TYPE_CODE"
      );
    }

    const baseRateDec = money(input.baseRate ?? 0);

    try {
      const roomType = await tx.roomType.create({
        data: {
          businessId: input.businessId,
          branchId: input.branchId,
          name,
          code,
          description: input.description ?? null,
          baseRate: baseRateDec,
          maxOccupancy: input.maxOccupancy ?? 2,
          amenities: input.amenities ?? [],
          images: input.images ?? [],
          displayOrder: input.displayOrder ?? 0,
          isActive: input.isActive ?? true,
        },
      });

      await createAuditEvent(
        {
          businessId: input.businessId,
          branchId: input.branchId,
          userId: input.actorId ?? null,
          action: "ROOM_TYPE_CREATED",
          entity: "RoomType",
          entityId: roomType.id,
          newValue: roomType,
        },
        tx
      );

      return roomType;
    } catch (err) {
      if ((err as { code?: string })?.code === "P2002") {
        throw new HotelError(
          `Room type code "${code}" already exists in this branch`,
          409,
          "DUPLICATE_ROOM_TYPE_CODE"
        );
      }
      throw err;
    }
  });
}

export async function getRoomTypes(
  input: GetRoomTypesInput,
  prismaClient: PrismaClientLike = db
) {
  return await prismaClient.roomType.findMany({
    where: {
      businessId: input.businessId,
      ...(input.branchId ? { branchId: input.branchId } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
    include: {
      rooms: {
        where: { isActive: true },
        orderBy: { roomNumber: "asc" },
      },
      _count: {
        select: { rooms: true, reservations: true },
      },
    },
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
  });
}

export async function updateRoomType(
  input: UpdateRoomTypeInput,
  prismaClient: PrismaClientLike = db
) {
  return await withHotelTransaction(prismaClient, async (tx) => {
    const existing = await tx.roomType.findFirst({
      where: { id: input.id, businessId: input.businessId },
    });
    if (!existing) {
      throw new HotelError("Room type not found", 404, "ROOM_TYPE_NOT_FOUND");
    }

    const nextCode = input.code !== undefined ? input.code.trim().toUpperCase() : undefined;
    if (nextCode !== undefined && nextCode !== existing.code) {
      if (!nextCode) {
        throw new HotelError("Room type code cannot be empty", 400, "VALIDATION_ERROR");
      }
      const duplicate = await tx.roomType.findFirst({
        where: {
          businessId: input.businessId,
          branchId: existing.branchId,
          code: { equals: nextCode, mode: "insensitive" },
          id: { not: input.id },
        },
      });
      if (duplicate) {
        throw new HotelError(
          `Room type code "${nextCode}" already exists in this branch`,
          409,
          "DUPLICATE_ROOM_TYPE_CODE"
        );
      }
    }

    const updated = await tx.roomType.update({
      where: { id: input.id },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(nextCode !== undefined ? { code: nextCode } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.baseRate !== undefined ? { baseRate: money(input.baseRate) } : {}),
        ...(input.maxOccupancy !== undefined ? { maxOccupancy: input.maxOccupancy } : {}),
        ...(input.amenities !== undefined ? { amenities: input.amenities } : {}),
        ...(input.images !== undefined ? { images: input.images } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(input.displayOrder !== undefined ? { displayOrder: input.displayOrder } : {}),
      },
    });

    await createAuditEvent(
      {
        businessId: input.businessId,
        branchId: existing.branchId,
        userId: input.actorId ?? null,
        action: "ROOM_TYPE_UPDATED",
        entity: "RoomType",
        entityId: updated.id,
        oldValue: existing,
        newValue: updated,
      },
      tx
    );

    return updated;
  });
}

export async function deleteRoomType(
  businessId: string,
  id: string,
  actorId?: string,
  prismaClient: PrismaClientLike = db
) {
  return await withHotelTransaction(prismaClient, async (tx) => {
    const existing = await tx.roomType.findFirst({
      where: { id, businessId },
    });
    if (!existing) {
      throw new HotelError("Room type not found", 404, "ROOM_TYPE_NOT_FOUND");
    }

    const activeRooms = await tx.room.count({
      where: {
        businessId,
        roomTypeId: id,
        isActive: true,
        OR: [
          { currentStayId: { not: null } },
          { status: { in: ["OCCUPIED_CLEAN", "OCCUPIED_DIRTY"] } },
        ],
      },
    });
    if (activeRooms > 0) {
      throw new HotelError(
        "Cannot delete room type with currently occupied rooms",
        409,
        "ROOM_TYPE_IN_USE"
      );
    }

    const totalDeps =
      (await tx.room.count({ where: { businessId, roomTypeId: id } })) +
      (await tx.reservation.count({ where: { businessId, roomTypeId: id } }));

    if (totalDeps > 0) {
      const deactivated = await tx.roomType.update({
        where: { id },
        data: { isActive: false },
      });

      await createAuditEvent(
        {
          businessId,
          branchId: existing.branchId,
          userId: actorId ?? null,
          action: "ROOM_TYPE_DEACTIVATED",
          entity: "RoomType",
          entityId: id,
          oldValue: existing,
          newValue: deactivated,
        },
        tx
      );

      return deactivated;
    }

    const deleted = await tx.roomType.delete({
      where: { id },
    });

    await createAuditEvent(
      {
        businessId,
        branchId: existing.branchId,
        userId: actorId ?? null,
        action: "ROOM_TYPE_DELETED",
        entity: "RoomType",
        entityId: id,
        oldValue: existing,
      },
      tx
    );

    return deleted;
  });
}

// -----------------------------------------------------------------------------
// Room Operations
// -----------------------------------------------------------------------------

export async function createRoom(
  input: CreateRoomInput,
  prismaClient: PrismaClientLike = db
) {
  const roomNumber = input.roomNumber?.trim();
  if (!roomNumber) {
    throw new HotelError("Room number is required", 400, "VALIDATION_ERROR");
  }

  return await withHotelTransaction(prismaClient, async (tx) => {
    const roomType = await tx.roomType.findFirst({
      where: { id: input.roomTypeId, businessId: input.businessId },
    });
    if (!roomType) {
      throw new HotelError("Room type not found", 404, "ROOM_TYPE_NOT_FOUND");
    }

    if (input.floorId) {
      const floor = await tx.floor.findFirst({
        where: { id: input.floorId, businessId: input.businessId },
      });
      if (!floor) {
        throw new HotelError("Floor not found", 404, "FLOOR_NOT_FOUND");
      }
    }

    const duplicate = await tx.room.findFirst({
      where: {
        businessId: input.businessId,
        branchId: input.branchId,
        roomNumber: { equals: roomNumber, mode: "insensitive" },
      },
    });
    if (duplicate) {
      throw new HotelError(
        `Room "${roomNumber}" already exists in this branch`,
        409,
        "DUPLICATE_ROOM_NUMBER"
      );
    }

    try {
      const room = await tx.room.create({
        data: {
          businessId: input.businessId,
          branchId: input.branchId,
          roomTypeId: input.roomTypeId,
          floorId: input.floorId ?? null,
          roomNumber,
          capacity: input.capacity ?? roomType.maxOccupancy,
          status: input.status ?? "VACANT_CLEAN",
          keyCardAlias: input.keyCardAlias ?? null,
          features: input.features ?? [],
          notes: input.notes ?? null,
          isActive: input.isActive ?? true,
        },
        include: {
          roomType: true,
          floor: true,
        },
      });

      await createAuditEvent(
        {
          businessId: input.businessId,
          branchId: input.branchId,
          userId: input.actorId ?? null,
          action: "ROOM_CREATED",
          entity: "Room",
          entityId: room.id,
          newValue: room,
        },
        tx
      );

      return room;
    } catch (err) {
      if ((err as { code?: string })?.code === "P2002") {
        throw new HotelError(
          `Room "${roomNumber}" already exists in this branch`,
          409,
          "DUPLICATE_ROOM_NUMBER"
        );
      }
      throw err;
    }
  });
}

export async function getRooms(
  input: GetRoomsInput,
  prismaClient: PrismaClientLike = db
) {
  return await prismaClient.room.findMany({
    where: {
      businessId: input.businessId,
      ...(input.branchId ? { branchId: input.branchId } : {}),
      ...(input.roomTypeId ? { roomTypeId: input.roomTypeId } : {}),
      ...(input.floorId ? { floorId: input.floorId } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
    include: {
      roomType: true,
      floor: true,
      allocations: {
        where: { isBlocking: true },
        orderBy: { startDate: "asc" },
      },
      stays: {
        where: { status: { in: ["ACTIVE", "EXTENDED", "TRANSFERRED"] } },
        orderBy: { checkInTime: "desc" },
      },
    },
    orderBy: [{ roomNumber: "asc" }],
  });
}

export async function updateRoom(
  input: UpdateRoomInput,
  prismaClient: PrismaClientLike = db
) {
  return await withHotelTransaction(prismaClient, async (tx) => {
    const existing = await tx.room.findFirst({
      where: { id: input.id, businessId: input.businessId },
    });
    if (!existing) {
      throw new HotelError("Room not found", 404, "ROOM_NOT_FOUND");
    }

    const nextRoomNumber = input.roomNumber !== undefined ? input.roomNumber.trim() : undefined;
    if (nextRoomNumber !== undefined && nextRoomNumber !== existing.roomNumber) {
      if (!nextRoomNumber) {
        throw new HotelError("Room number cannot be empty", 400, "VALIDATION_ERROR");
      }
      const duplicate = await tx.room.findFirst({
        where: {
          businessId: input.businessId,
          branchId: existing.branchId,
          roomNumber: { equals: nextRoomNumber, mode: "insensitive" },
          id: { not: input.id },
        },
      });
      if (duplicate) {
        throw new HotelError(
          `Room "${nextRoomNumber}" already exists in this branch`,
          409,
          "DUPLICATE_ROOM_NUMBER"
        );
      }
    }

    const updated = await tx.room.update({
      where: { id: input.id },
      data: {
        ...(nextRoomNumber !== undefined ? { roomNumber: nextRoomNumber } : {}),
        ...(input.roomTypeId !== undefined ? { roomTypeId: input.roomTypeId } : {}),
        ...(input.floorId !== undefined ? { floorId: input.floorId } : {}),
        ...(input.capacity !== undefined ? { capacity: input.capacity } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.keyCardAlias !== undefined ? { keyCardAlias: input.keyCardAlias } : {}),
        ...(input.features !== undefined ? { features: input.features } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
      include: {
        roomType: true,
        floor: true,
      },
    });

    await createAuditEvent(
      {
        businessId: input.businessId,
        branchId: existing.branchId,
        userId: input.actorId ?? null,
        action: "ROOM_UPDATED",
        entity: "Room",
        entityId: updated.id,
        oldValue: existing,
        newValue: updated,
      },
      tx
    );

    return updated;
  });
}

// -----------------------------------------------------------------------------
// Availability & Tape Chart Matrix
// -----------------------------------------------------------------------------

export async function getRoomAvailability(
  input: GetRoomAvailabilityInput,
  prismaClient: PrismaClientLike = db
) {
  const reqStartDate = parseDate(input.startDate, "startDate");
  const reqEndDate = parseDate(input.endDate, "endDate");

  if (reqStartDate.getTime() >= reqEndDate.getTime()) {
    throw new HotelError("startDate must be before endDate", 400, "INVALID_DATE_RANGE");
  }

  const rooms = await prismaClient.room.findMany({
    where: {
      businessId: input.businessId,
      isActive: true,
      ...(input.branchId ? { branchId: input.branchId } : {}),
      ...(input.roomTypeId ? { roomTypeId: input.roomTypeId } : {}),
    },
    include: {
      roomType: true,
      floor: true,
      allocations: {
        where: {
          isBlocking: true,
          startDate: { lt: reqEndDate },
          endDate: { gt: reqStartDate },
        },
        include: {
          reservation: true,
          stay: true,
          maintenanceTicket: true,
        },
        orderBy: { startDate: "asc" },
      },
    },
    orderBy: [{ roomNumber: "asc" }],
  });

  const enrichedRooms = rooms.map((room) => {
    const hasBlockingAllocation = room.allocations.length > 0;
    const isOutOfService = room.status === "OUT_OF_SERVICE" || room.status === "MAINTENANCE";
    const isAvailable = !hasBlockingAllocation && !isOutOfService;
    return {
      ...room,
      isAvailable,
      overlappingAllocations: room.allocations,
    };
  });

  const availableRooms = enrichedRooms.filter((r) => r.isAvailable);
  const unavailableRooms = enrichedRooms.filter((r) => !r.isAvailable);

  const summaryMap = new Map<
    string,
    {
      roomTypeId: string;
      roomTypeName: string;
      roomTypeCode: string;
      baseRate: Prisma.Decimal;
      totalRooms: number;
      availableCount: number;
      unavailableCount: number;
    }
  >();

  for (const room of enrichedRooms) {
    const rt = room.roomType;
    const existing = summaryMap.get(rt.id) ?? {
      roomTypeId: rt.id,
      roomTypeName: rt.name,
      roomTypeCode: rt.code,
      baseRate: rt.baseRate,
      totalRooms: 0,
      availableCount: 0,
      unavailableCount: 0,
    };
    existing.totalRooms += 1;
    if (room.isAvailable) {
      existing.availableCount += 1;
    } else {
      existing.unavailableCount += 1;
    }
    summaryMap.set(rt.id, existing);
  }

  return {
    rooms: enrichedRooms,
    availableRooms,
    unavailableRooms,
    summaryByRoomType: Array.from(summaryMap.values()),
  };
}

export async function getTapeChartMatrix(
  input: GetTapeChartMatrixInput,
  prismaClient: PrismaClientLike = db
) {
  const reqStartDate = parseDate(input.startDate, "startDate");
  const reqEndDate = parseDate(input.endDate, "endDate");

  if (reqStartDate.getTime() >= reqEndDate.getTime()) {
    throw new HotelError("startDate must be before endDate", 400, "INVALID_DATE_RANGE");
  }

  // Generate YYYY-MM-DD date columns for [startDate, endDate)
  const dates: string[] = [];
  const cursor = new Date(
    Date.UTC(reqStartDate.getUTCFullYear(), reqStartDate.getUTCMonth(), reqStartDate.getUTCDate())
  );
  const endDay = new Date(
    Date.UTC(reqEndDate.getUTCFullYear(), reqEndDate.getUTCMonth(), reqEndDate.getUTCDate())
  );
  while (cursor.getTime() < endDay.getTime() && dates.length < 366) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  if (dates.length === 0) {
    dates.push(reqStartDate.toISOString().slice(0, 10));
  }

  const rawRooms = await prismaClient.room.findMany({
    where: {
      businessId: input.businessId,
      isActive: true,
      ...(input.branchId ? { branchId: input.branchId } : {}),
      ...(input.floorId ? { floorId: input.floorId } : {}),
      ...(input.roomTypeId ? { roomTypeId: input.roomTypeId } : {}),
    },
    include: {
      roomType: true,
      floor: true,
      allocations: {
        where: {
          startDate: { lt: reqEndDate },
          endDate: { gt: reqStartDate },
        },
        include: {
          reservation: {
            include: { guests: true },
          },
          stay: true,
          maintenanceTicket: true,
        },
        orderBy: { startDate: "asc" },
      },
      stays: {
        where: {
          status: { in: ["ACTIVE", "EXTENDED", "TRANSFERRED"] },
        },
        orderBy: { checkInTime: "desc" },
      },
      housekeepingTasks: {
        where: {
          status: { in: ["DIRTY", "IN_PROGRESS"] },
        },
        orderBy: { createdAt: "desc" },
      },
      maintenanceTickets: {
        where: {
          status: { in: ["OPEN", "IN_PROGRESS"] },
        },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: [{ roomNumber: "asc" }],
  });

  const stats = {
    total: rawRooms.length,
    vacantClean: 0,
    vacantDirty: 0,
    occupied: 0,
    maintenance: 0,
  };

  const rooms = rawRooms.map((room) => {
    if (room.status === "VACANT_CLEAN") stats.vacantClean += 1;
    else if (room.status === "VACANT_DIRTY") stats.vacantDirty += 1;
    else if (room.status === "OCCUPIED_CLEAN" || room.status === "OCCUPIED_DIRTY") {
      stats.occupied += 1;
    } else if (room.status === "MAINTENANCE" || room.status === "OUT_OF_SERVICE") {
      stats.maintenance += 1;
    }

    const activeStay =
      (room.currentStayId
        ? room.stays.find((s) => s.id === room.currentStayId)
        : undefined) ??
      room.stays[0] ??
      null;

    return {
      ...room,
      activeStay,
    };
  });

  return {
    startDate: reqStartDate.toISOString(),
    endDate: reqEndDate.toISOString(),
    dates,
    rooms,
    stats,
  };
}
