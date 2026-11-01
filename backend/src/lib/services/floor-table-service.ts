import { db } from "@/lib/db";
import { Prisma } from "@dynapos/db";

export class FloorTableError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "FloorTableError";
    this.statusCode = statusCode;
  }
}

// -----------------------------------------------------------------------------
// DTO Interfaces
// -----------------------------------------------------------------------------

export interface CreateFloorInput {
  businessId: string;
  branchId: string;
  name: string;
  displayOrder?: number;
  metadata?: Prisma.InputJsonValue | null;
  isActive?: boolean;
}

export interface GetFloorsFilter {
  businessId: string;
  branchId?: string | null;
  isActive?: boolean;
  includeTables?: boolean;
}

export interface UpdateFloorInput {
  businessId: string;
  floorId: string;
  name?: string;
  displayOrder?: number;
  isActive?: boolean;
  metadata?: Prisma.InputJsonValue | null;
}

export interface CreateTableInput {
  businessId: string;
  branchId?: string | null;
  floorId: string;
  tableNumber: string;
  capacity?: number;
  shape?: "RECTANGLE" | "ROUND" | "SQUARE" | string;
  posX?: number;
  posY?: number;
  width?: number;
  height?: number;
  status?: "AVAILABLE" | "OCCUPIED" | "RESERVED" | "BILLED" | string;
  isActive?: boolean;
}

export interface GetTablesFilter {
  businessId: string;
  branchId?: string | null;
  floorId?: string | null;
  status?: string | null;
  isActive?: boolean;
  includeFloor?: boolean;
  includeCurrentSession?: boolean;
}

export interface UpdateTableInput {
  businessId: string;
  tableId: string;
  floorId?: string;
  tableNumber?: string;
  capacity?: number;
  shape?: "RECTANGLE" | "ROUND" | "SQUARE" | string;
  posX?: number;
  posY?: number;
  width?: number;
  height?: number;
  status?: string;
  isActive?: boolean;
}

export interface UpdateTablePositionsInput {
  businessId: string;
  floorId: string;
  positions: {
    tableId: string;
    posX: number;
    posY: number;
    shape?: "RECTANGLE" | "ROUND" | "SQUARE" | string;
    width?: number;
    height?: number;
  }[];
}

// -----------------------------------------------------------------------------
// Floor Service Methods
// -----------------------------------------------------------------------------

/**
 * Creates a new floor layout zone in a branch.
 * Enforces branch existence and composite uniqueness on [businessId, branchId, name].
 */
export async function createFloor(
  input: CreateFloorInput,
  externalTx?: Prisma.TransactionClient
) {
  const client = externalTx || db;
  const trimmedName = input.name.trim();
  if (!trimmedName) {
    throw new FloorTableError("Floor name is required", 400);
  }

  // 1. Verify branch exists and belongs to tenant
  const branch = await client.branch.findFirst({
    where: { id: input.branchId, businessId: input.businessId, deletedAt: null },
  });
  if (!branch) {
    throw new FloorTableError("Branch not found", 404);
  }

  // 2. Check unique constraint [businessId, branchId, name]
  const existing = await client.floor.findFirst({
    where: {
      businessId: input.businessId,
      branchId: input.branchId,
      name: { equals: trimmedName, mode: "insensitive" },
    },
  });
  if (existing) {
    throw new FloorTableError(`Floor "${trimmedName}" already exists in this branch`, 409);
  }

  // 3. Create Floor
  return await client.floor.create({
    data: {
      businessId: input.businessId,
      branchId: input.branchId,
      name: trimmedName,
      displayOrder: input.displayOrder ?? 0,
      metadata: input.metadata ?? undefined,
      isActive: input.isActive ?? true,
    },
  });
}

/**
 * Queries floors matching business, branch, and active status.
 */
export async function getFloors(
  filter: GetFloorsFilter,
  externalTx?: Prisma.TransactionClient
) {
  const client = externalTx || db;

  const where: Prisma.FloorWhereInput = {
    businessId: filter.businessId,
    ...(filter.branchId ? { branchId: filter.branchId } : {}),
    ...(filter.isActive !== undefined ? { isActive: filter.isActive } : { isActive: true }),
  };

  const include = filter.includeTables
    ? {
        tables: {
          where: { isActive: true },
          orderBy: [
            { posY: "asc" as const },
            { posX: "asc" as const },
            { tableNumber: "asc" as const },
          ],
        },
      }
    : undefined;

  return await client.floor.findMany({
    where,
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    include,
  });
}

/**
 * Retrieves a single floor by ID with multi-tenant verification.
 */
export async function getFloorById(
  businessId: string,
  floorId: string,
  options?: { includeTables?: boolean },
  externalTx?: Prisma.TransactionClient
) {
  const client = externalTx || db;

  const floor = await client.floor.findFirst({
    where: { id: floorId, businessId },
    include: options?.includeTables
      ? {
          tables: {
            where: { isActive: true },
            orderBy: [{ posY: "asc" }, { posX: "asc" }, { tableNumber: "asc" }],
          },
        }
      : undefined,
  });

  if (!floor) {
    throw new FloorTableError("Floor not found", 404);
  }

  return floor;
}

/**
 * Updates floor attributes (name, displayOrder, metadata, isActive).
 * Blocks deactivation if active occupied/billed tables exist on this floor.
 */
export async function updateFloor(
  input: UpdateFloorInput,
  externalTx?: Prisma.TransactionClient
) {
  const client = externalTx || db;

  const existing = await client.floor.findFirst({
    where: { id: input.floorId, businessId: input.businessId },
  });
  if (!existing) {
    throw new FloorTableError("Floor not found", 404);
  }

  // Check unique constraint if name is changing
  if (input.name && input.name.trim() !== existing.name) {
    const trimmedName = input.name.trim();
    const duplicate = await client.floor.findFirst({
      where: {
        businessId: input.businessId,
        branchId: existing.branchId,
        name: { equals: trimmedName, mode: "insensitive" },
        id: { not: input.floorId },
      },
    });
    if (duplicate) {
      throw new FloorTableError(`Floor "${trimmedName}" already exists in this branch`, 409);
    }
  }

  // Deactivation safety guard
  if (input.isActive === false && existing.isActive) {
    const activeOccupiedTable = await client.restaurantTable.findFirst({
      where: {
        floorId: input.floorId,
        businessId: input.businessId,
        isActive: true,
        OR: [
          { status: { in: ["OCCUPIED", "BILLED"] } },
          { currentSessionId: { not: null } },
        ],
      },
    });
    if (activeOccupiedTable) {
      throw new FloorTableError(
        "Cannot deactivate floor while it contains occupied or billed tables",
        409
      );
    }
  }

  return await client.floor.update({
    where: { id: input.floorId },
    data: {
      ...(input.name !== undefined && { name: input.name.trim() }),
      ...(input.displayOrder !== undefined && { displayOrder: input.displayOrder }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
      ...(input.metadata !== undefined && { metadata: input.metadata ?? Prisma.DbNull }),
    },
  });
}

/**
 * Deletes or soft-deletes a floor.
 * Invariant: Cannot delete a floor if active tables exist on it.
 */
export async function deleteFloor(
  businessId: string,
  floorId: string,
  externalTx?: Prisma.TransactionClient
) {
  const client = externalTx || db;

  const floor = await client.floor.findFirst({
    where: { id: floorId, businessId },
  });
  if (!floor) {
    throw new FloorTableError("Floor not found", 404);
  }

  // Count active tables on this floor
  const activeTableCount = await client.restaurantTable.count({
    where: { floorId, businessId, isActive: true },
  });
  if (activeTableCount > 0) {
    throw new FloorTableError(
      `Cannot delete floor "${floor.name}": it contains ${activeTableCount} active table(s). Reassign or delete tables first.`,
      409
    );
  }

  // Check if historical inactive tables exist
  const totalTables = await client.restaurantTable.count({
    where: { floorId, businessId },
  });

  if (totalTables > 0) {
    await client.floor.update({
      where: { id: floorId },
      data: { isActive: false },
    });
    return { success: true, floorId, deleted: false, deactivated: true };
  } else {
    await client.floor.delete({
      where: { id: floorId },
    });
    return { success: true, floorId, deleted: true, deactivated: false };
  }
}

// -----------------------------------------------------------------------------
// RestaurantTable Service Methods
// -----------------------------------------------------------------------------

/**
 * Creates a new restaurant table assigned to a floor.
 * Validates floor existence, branch consistency, and tableNumber uniqueness within branch.
 */
export async function createTable(
  input: CreateTableInput,
  externalTx?: Prisma.TransactionClient
) {
  const client = externalTx || db;
  const trimmedNumber = input.tableNumber.trim();
  if (!trimmedNumber) {
    throw new FloorTableError("Table number is required", 400);
  }

  // 1. Verify floor exists and is active
  const floor = await client.floor.findFirst({
    where: { id: input.floorId, businessId: input.businessId, isActive: true },
  });
  if (!floor) {
    throw new FloorTableError("Floor not found or is inactive", 404);
  }

  // 2. Resolve and verify branchId
  const branchId = input.branchId || floor.branchId;
  if (floor.branchId !== branchId) {
    throw new FloorTableError("Floor belongs to a different branch than the specified branchId", 400);
  }

  // 3. Validate unique tableNumber in branch
  const existing = await client.restaurantTable.findFirst({
    where: {
      businessId: input.businessId,
      branchId,
      tableNumber: { equals: trimmedNumber, mode: "insensitive" },
      isActive: true,
    },
  });
  if (existing) {
    throw new FloorTableError(`Table "${trimmedNumber}" already exists in this branch`, 409);
  }

  // 4. Create table
  return await client.restaurantTable.create({
    data: {
      businessId: input.businessId,
      branchId,
      floorId: input.floorId,
      tableNumber: trimmedNumber,
      capacity: input.capacity ?? 4,
      shape: input.shape ?? "RECTANGLE",
      posX: input.posX ?? 0,
      posY: input.posY ?? 0,
      width: input.width ?? 1,
      height: input.height ?? 1,
      status: input.status ?? "AVAILABLE",
      isActive: input.isActive ?? true,
    },
    include: {
      floor: { select: { id: true, name: true, displayOrder: true } },
    },
  });
}

/**
 * Lists tables with multi-tenant filtering by branch, floor, occupancy status, and active status.
 */
export async function getTables(
  filter: GetTablesFilter,
  externalTx?: Prisma.TransactionClient
) {
  const client = externalTx || db;

  const where: Prisma.RestaurantTableWhereInput = {
    businessId: filter.businessId,
    ...(filter.branchId ? { branchId: filter.branchId } : {}),
    ...(filter.floorId ? { floorId: filter.floorId } : {}),
    ...(filter.status ? { status: filter.status } : {}),
    ...(filter.isActive !== undefined ? { isActive: filter.isActive } : { isActive: true }),
  };

  const include: Prisma.RestaurantTableInclude = {
    ...(filter.includeFloor
      ? { floor: { select: { id: true, name: true, displayOrder: true } } }
      : {}),
    ...(filter.includeCurrentSession
      ? {
          tableSessions: {
            where: { status: { in: ["ACTIVE", "BILLED"] } },
            take: 1,
            select: {
              id: true,
              sessionNumber: true,
              guestCount: true,
              status: true,
              openedAt: true,
              openedById: true,
            },
          },
        }
      : {}),
  };

  return await client.restaurantTable.findMany({
    where,
    include: Object.keys(include).length > 0 ? include : undefined,
    orderBy: [
      { floor: { displayOrder: "asc" } },
      { posY: "asc" },
      { posX: "asc" },
      { tableNumber: "asc" },
    ],
  });
}

/**
 * Retrieves a single table with floor details and optional active session.
 */
export async function getTableById(
  businessId: string,
  tableId: string,
  options?: { includeSession?: boolean },
  externalTx?: Prisma.TransactionClient
) {
  const client = externalTx || db;

  const table = await client.restaurantTable.findFirst({
    where: { id: tableId, businessId },
    include: {
      floor: true,
      ...(options?.includeSession
        ? {
            tableSessions: {
              where: { status: { in: ["ACTIVE", "BILLED"] } },
              take: 1,
              include: {
                restaurantOrders: {
                  where: { settlementStatus: { not: "PAID" } },
                  include: { rounds: { include: { lines: true } } },
                },
              },
            },
          }
        : {}),
    },
  });

  if (!table) {
    throw new FloorTableError("Table not found", 404);
  }

  return table;
}

/**
 * Updates table attributes, capacity, grid coordinates, or floor reassignment.
 * Protects occupancy status invariants and prevents deactivation of occupied tables.
 */
export async function updateTable(
  input: UpdateTableInput,
  externalTx?: Prisma.TransactionClient
) {
  const client = externalTx || db;

  const existing = await client.restaurantTable.findFirst({
    where: { id: input.tableId, businessId: input.businessId },
  });
  if (!existing) {
    throw new FloorTableError("Table not found", 404);
  }

  // 1. Table number uniqueness check in branch
  if (input.tableNumber && input.tableNumber.trim() !== existing.tableNumber) {
    const trimmedNumber = input.tableNumber.trim();
    const duplicate = await client.restaurantTable.findFirst({
      where: {
        businessId: input.businessId,
        branchId: existing.branchId,
        tableNumber: { equals: trimmedNumber, mode: "insensitive" },
        id: { not: input.tableId },
        isActive: true,
      },
    });
    if (duplicate) {
      throw new FloorTableError(`Table "${trimmedNumber}" already exists in this branch`, 409);
    }
  }

  // 2. Floor reassignment check (must be same branch)
  if (input.floorId && input.floorId !== existing.floorId) {
    const targetFloor = await client.floor.findFirst({
      where: {
        id: input.floorId,
        businessId: input.businessId,
        branchId: existing.branchId,
        isActive: true,
      },
    });
    if (!targetFloor) {
      throw new FloorTableError("Target floor not found or belongs to a different branch", 400);
    }
  }

  // 3. Status mutation guards
  if (input.status) {
    if (
      input.status === "AVAILABLE" &&
      (existing.currentSessionId || existing.status === "OCCUPIED" || existing.status === "BILLED")
    ) {
      throw new FloorTableError(
        "Cannot set table to AVAILABLE while an active session exists. Close the session first.",
        409
      );
    }
    if (
      input.status === "OCCUPIED" &&
      !existing.currentSessionId &&
      existing.status !== "OCCUPIED"
    ) {
      throw new FloorTableError(
        "Cannot set table to OCCUPIED directly. Open a table session instead.",
        400
      );
    }
  }

  // 4. Deactivation guard
  if (input.isActive === false && existing.isActive) {
    if (
      existing.status === "OCCUPIED" ||
      existing.status === "BILLED" ||
      existing.currentSessionId
    ) {
      throw new FloorTableError(
        `Cannot deactivate table "${existing.tableNumber}" while it is occupied or billed`,
        409
      );
    }
  }

  return await client.restaurantTable.update({
    where: { id: input.tableId },
    data: {
      ...(input.floorId !== undefined && { floorId: input.floorId }),
      ...(input.tableNumber !== undefined && { tableNumber: input.tableNumber.trim() }),
      ...(input.capacity !== undefined && { capacity: input.capacity }),
      ...(input.shape !== undefined && { shape: input.shape }),
      ...(input.posX !== undefined && { posX: input.posX }),
      ...(input.posY !== undefined && { posY: input.posY }),
      ...(input.width !== undefined && { width: input.width }),
      ...(input.height !== undefined && { height: input.height }),
      ...(input.status !== undefined && { status: input.status }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
    },
    include: {
      floor: { select: { id: true, name: true, displayOrder: true } },
    },
  });
}

/**
 * Deletes or soft-deletes a table.
 * Invariant: Cannot delete an occupied or billed table.
 * If historical sessions or orders exist, soft-deletes (`isActive = false`).
 */
export async function deleteTable(
  businessId: string,
  tableId: string,
  externalTx?: Prisma.TransactionClient
) {
  const client = externalTx || db;

  const table = await client.restaurantTable.findFirst({
    where: { id: tableId, businessId },
  });
  if (!table) {
    throw new FloorTableError("Table not found", 404);
  }

  if (table.currentSessionId || table.status === "OCCUPIED" || table.status === "BILLED") {
    throw new FloorTableError(
      `Cannot delete table "${table.tableNumber}" while it has an active session`,
      409
    );
  }

  const [sessionCount, orderCount] = await Promise.all([
    client.tableSession.count({ where: { tableId, businessId } }),
    client.restaurantOrder.count({ where: { tableId, businessId } }),
  ]);

  if (sessionCount > 0 || orderCount > 0) {
    await client.restaurantTable.update({
      where: { id: tableId },
      data: { isActive: false },
    });
    return { success: true, tableId, deleted: false, deactivated: true };
  } else {
    await client.restaurantTable.delete({
      where: { id: tableId },
    });
    return { success: true, tableId, deleted: true, deactivated: false };
  }
}

/**
 * Batch updates table positions and dimensions for floor plan layout editing.
 */
export async function updateTablePositions(
  input: UpdateTablePositionsInput,
  externalTx?: Prisma.TransactionClient
) {
  const runner = async (tx: Prisma.TransactionClient) => {
    const floor = await tx.floor.findFirst({
      where: { id: input.floorId, businessId: input.businessId, isActive: true },
    });
    if (!floor) {
      throw new FloorTableError("Floor not found", 404);
    }

    const updatedTables = [];
    for (const pos of input.positions) {
      const table = await tx.restaurantTable.findFirst({
        where: {
          id: pos.tableId,
          floorId: input.floorId,
          businessId: input.businessId,
          isActive: true,
        },
      });
      if (!table) continue;

      const updated = await tx.restaurantTable.update({
        where: { id: pos.tableId },
        data: {
          posX: pos.posX,
          posY: pos.posY,
          ...(pos.width !== undefined && { width: pos.width }),
          ...(pos.height !== undefined && { height: pos.height }),
          ...(pos.shape !== undefined && { shape: pos.shape }),
        },
      });
      updatedTables.push(updated);
    }
    return updatedTables;
  };

  if (externalTx) {
    return await runner(externalTx);
  }
  return await db.$transaction(runner);
}
