# Floor & Table Management Service & REST API Specification Report

**Document**: Phase 3 Milestone M2 — Floor & Dining Table Management  
**Author**: M2 Explorer 1 (Floor & Table Service & Route Spec Miner)  
**Target Components**:
- Service Layer: `backend/src/lib/services/floor-table-service.ts`
- REST Routes:
  - `backend/src/app/api/v1/restaurant/floors/route.ts` (GET, POST)
  - `backend/src/app/api/v1/restaurant/floors/[id]/route.ts` (GET, PATCH, DELETE)
  - `backend/src/app/api/v1/restaurant/tables/route.ts` (GET, POST)
  - `backend/src/app/api/v1/restaurant/tables/[id]/route.ts` (GET, PATCH, DELETE)
**Date**: 2026-11-01  
**Status**: Authoritative Technical Specification

---

## 1. Executive Summary & Architecture Context

In Phase 3 (Restaurant Staff MVP), dining operations transition from simple counter retail sales to spatial, table-oriented dining workflows. The core layout foundation rests upon two entities in `packages/db/prisma/schema.prisma`:
1. `Floor`: Represents physical dining areas (e.g. "Main Dining Room", "Patio", "Rooftop Terrace", "Banquet Hall") within a branch.
2. `RestaurantTable`: Represents physical tables located on a floor, defined by seating capacity, occupancy status (`AVAILABLE`, `OCCUPIED`, `RESERVED`, `BILLED`), and visual 2D grid layout attributes (`posX`, `posY`, `width`, `height`, `shape`).

### Key Invariants & Architectural Guards:
1. **Multi-Tenant Isolation**: Every entity maintains composite isolation via `businessId` (`@@unique([businessId, id])`, `@@unique([businessId, branchId, name])`, and `@@unique([businessId, branchId, tableNumber])`). All queries and mutations MUST enforce `businessId` checks.
2. **Branch Integrity**: A table cannot belong to a floor in a different branch. Table numbers must be unique within a branch. Floor names must be unique within a branch.
3. **Decoupled Acyclic DAG**: `RestaurantTable.currentSessionId` is stored as a scalar string (`String?`) without a direct `@relation` to `TableSession` to preserve acyclic schema topological sorting required by `backend/src/lib/backup-format.ts`.
4. **Occupancy Deletion Safety**:
   - A floor cannot be deleted if active tables exist on it (HTTP 409 Conflict).
   - A table cannot be deleted or deactivated if it has an active session (`status: "OCCUPIED" | "BILLED"` or `currentSessionId !== null`) (HTTP 409 Conflict).
   - If a table has historical orders or sessions, it must be soft-deleted (`isActive = false`) rather than hard deleted to preserve foreign key integrity and audit reporting.
5. **Next.js 15/16 Async Params Compliance**: Dynamic route segments (e.g. `[id]`) MUST use `props: { params: Promise<{ id: string }> }` and `const { id } = await params;` per Next.js 16 requirements.

---

## 2. Authoritative Database Schema Reference

From `packages/db/prisma/schema.prisma` (lines 1113–1161):

```prisma
model Floor {
  id           String            @id @default(uuid())
  businessId   String
  business     Business          @relation(fields: [businessId], references: [id], onDelete: Cascade)
  branchId     String
  branch       Branch            @relation(fields: [branchId], references: [id], onDelete: Cascade)
  name         String
  displayOrder Int               @default(0)
  isActive     Boolean           @default(true)
  metadata     Json?             // e.g. { gridWidth: 12, gridHeight: 8, backgroundUrl: null }
  createdAt    DateTime          @default(now())
  updatedAt    DateTime          @updatedAt

  tables       RestaurantTable[]

  @@unique([businessId, id])
  @@unique([businessId, branchId, name])
  @@index([businessId, branchId, displayOrder])
}

model RestaurantTable {
  id               String            @id @default(uuid())
  businessId       String
  business         Business          @relation(fields: [businessId], references: [id], onDelete: Cascade)
  branchId         String
  branch           Branch            @relation(fields: [branchId], references: [id], onDelete: Cascade)
  floorId          String
  floor            Floor             @relation(fields: [floorId], references: [id], onDelete: Cascade)
  tableNumber      String
  capacity         Int               @default(4)
  status           String            @default("AVAILABLE") // AVAILABLE, OCCUPIED, RESERVED, BILLED
  currentSessionId String?           // Scalar logical ID without @relation to preserve DAG acyclicity
  shape            String            @default("RECTANGLE") // RECTANGLE, ROUND, SQUARE
  posX             Int               @default(0)
  posY             Int               @default(0)
  width            Int               @default(1)
  height           Int               @default(1)
  isActive         Boolean           @default(true)
  createdAt        DateTime          @default(now())
  updatedAt        DateTime          @updatedAt

  tableSessions    TableSession[]
  restaurantOrders RestaurantOrder[]

  @@unique([businessId, id])
  @@unique([businessId, branchId, tableNumber])
  @@index([businessId, branchId, floorId])
  @@index([businessId, status])
}
```

---

## 3. Service Layer Specification (`backend/src/lib/services/floor-table-service.ts`)

### 3.1 Custom Error Class
```ts
export class FloorTableError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "FloorTableError";
    this.statusCode = statusCode;
  }
}
```

### 3.2 TypeScript Interfaces

```ts
import { Prisma } from "@dynapos/db";

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
  shape?: "RECTANGLE" | "ROUND" | "SQUARE";
  posX?: number;
  posY?: number;
  width?: number;
  height?: number;
  status?: "AVAILABLE" | "RESERVED";
  isActive?: boolean;
}

export interface GetTablesFilter {
  businessId: string;
  branchId?: string | null;
  floorId?: string | null;
  status?: "AVAILABLE" | "OCCUPIED" | "RESERVED" | "BILLED" | string;
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
  shape?: "RECTANGLE" | "ROUND" | "SQUARE";
  posX?: number;
  posY?: number;
  width?: number;
  height?: number;
  status?: "AVAILABLE" | "OCCUPIED" | "RESERVED" | "BILLED";
  isActive?: boolean;
}

export interface UpdateTablePositionsInput {
  businessId: string;
  floorId: string;
  positions: {
    tableId: string;
    posX: number;
    posY: number;
    shape?: "RECTANGLE" | "ROUND" | "SQUARE";
    width?: number;
    height?: number;
  }[];
}
```

### 3.3 Function Implementation Specifications

#### 1. `createFloor(input: CreateFloorInput, externalTx?: Prisma.TransactionClient)`
- **Purpose**: Creates a new floor physical zone in a branch.
- **Algorithm**:
  1. Validate branch exists and belongs to tenant:
     ```ts
     const branch = await tx.branch.findFirst({
       where: { id: input.branchId, businessId: input.businessId, deletedAt: null }
     });
     if (!branch) throw new FloorTableError("Branch not found", 404);
     ```
  2. Check unique constraint `[businessId, branchId, name]`:
     ```ts
     const trimmedName = input.name.trim();
     const existing = await tx.floor.findFirst({
       where: {
         businessId: input.businessId,
         branchId: input.branchId,
         name: { equals: trimmedName, mode: "insensitive" }
       }
     });
     if (existing) {
       throw new FloorTableError(`Floor "${trimmedName}" already exists in this branch`, 409);
     }
     ```
  3. Create Floor record:
     ```ts
     return await tx.floor.create({
       data: {
         businessId: input.businessId,
         branchId: input.branchId,
         name: trimmedName,
         displayOrder: input.displayOrder ?? 0,
         metadata: input.metadata ?? undefined,
         isActive: input.isActive ?? true,
       }
     });
     ```

#### 2. `getFloors(filter: GetFloorsFilter, externalTx?: Prisma.TransactionClient)`
- **Purpose**: Queries floors matching business, branch, and active status.
- **Algorithm**:
  1. Build `where` clause:
     ```ts
     const where: Prisma.FloorWhereInput = {
       businessId: filter.businessId,
       ...(filter.branchId ? { branchId: filter.branchId } : {}),
       ...(filter.isActive !== undefined ? { isActive: filter.isActive } : { isActive: true }),
     };
     ```
  2. Build `include` clause:
     ```ts
     const include = filter.includeTables ? {
       tables: {
         where: { isActive: true },
         orderBy: [
           { posY: "asc" as const },
           { posX: "asc" as const },
           { tableNumber: "asc" as const }
         ],
       }
     } : undefined;
     ```
  3. Execute query:
     ```ts
     return await client.floor.findMany({
       where,
       orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
       include,
     });
     ```

#### 3. `getFloorById(businessId: string, floorId: string, options?: { includeTables?: boolean }, externalTx?: Prisma.TransactionClient)`
- **Purpose**: Retrieves a single floor by ID with multi-tenant verification.
- **Algorithm**:
  1. Query:
     ```ts
     const floor = await client.floor.findFirst({
       where: { id: floorId, businessId },
       include: options?.includeTables ? {
         tables: {
           where: { isActive: true },
           orderBy: [{ posY: "asc" }, { posX: "asc" }, { tableNumber: "asc" }]
         }
       } : undefined,
     });
     if (!floor) throw new FloorTableError("Floor not found", 404);
     return floor;
     ```

#### 4. `updateFloor(input: UpdateFloorInput, externalTx?: Prisma.TransactionClient)`
- **Purpose**: Updates floor attributes (name, displayOrder, metadata, isActive).
- **Algorithm**:
  1. Verify floor exists:
     ```ts
     const existing = await tx.floor.findFirst({
       where: { id: input.floorId, businessId: input.businessId },
     });
     if (!existing) throw new FloorTableError("Floor not found", 404);
     ```
  2. If `name` provided and changed, verify uniqueness within the branch:
     ```ts
     if (input.name && input.name.trim() !== existing.name) {
       const duplicate = await tx.floor.findFirst({
         where: {
           businessId: input.businessId,
           branchId: existing.branchId,
           name: { equals: input.name.trim(), mode: "insensitive" },
           id: { not: input.floorId },
         }
       });
       if (duplicate) throw new FloorTableError(`Floor "${input.name.trim()}" already exists in this branch`, 409);
     }
     ```
  3. If deactivating (`isActive === false`), verify no active tables exist:
     ```ts
     if (input.isActive === false && existing.isActive) {
       const activeTable = await tx.restaurantTable.findFirst({
         where: {
           floorId: input.floorId,
           businessId: input.businessId,
           isActive: true,
           OR: [
             { status: { in: ["OCCUPIED", "BILLED"] } },
             { currentSessionId: { not: null } }
           ]
         }
       });
       if (activeTable) {
         throw new FloorTableError("Cannot deactivate floor while it contains occupied or billed tables", 409);
       }
     }
     ```
  4. Perform update:
     ```ts
     return await tx.floor.update({
       where: { id: input.floorId },
       data: {
         ...(input.name !== undefined && { name: input.name.trim() }),
         ...(input.displayOrder !== undefined && { displayOrder: input.displayOrder }),
         ...(input.isActive !== undefined && { isActive: input.isActive }),
         ...(input.metadata !== undefined && { metadata: input.metadata ?? Prisma.DbNull }),
       }
     });
     ```

#### 5. `deleteFloor(businessId: string, floorId: string, externalTx?: Prisma.TransactionClient)`
- **Purpose**: Deletes or soft-deletes a floor.
- **Safety Invariant**: Cannot delete a floor if it has tables.
- **Algorithm**:
  1. Find floor:
     ```ts
     const floor = await tx.floor.findFirst({ where: { id: floorId, businessId } });
     if (!floor) throw new FloorTableError("Floor not found", 404);
     ```
  2. Check table count:
     ```ts
     const tableCount = await tx.restaurantTable.count({
       where: { floorId, businessId, isActive: true }
     });
     if (tableCount > 0) {
       throw new FloorTableError(`Cannot delete floor "${floor.name}": it contains ${tableCount} table(s). Reassign or delete tables first.`, 409);
     }
     ```
  3. If historical inactive tables exist, soft delete (`isActive: false`); if zero tables ever existed, hard delete:
     ```ts
     const totalTables = await tx.restaurantTable.count({ where: { floorId, businessId } });
     if (totalTables > 0) {
       await tx.floor.update({ where: { id: floorId }, data: { isActive: false } });
       return { success: true, floorId, deleted: false, deactivated: true };
     } else {
       await tx.floor.delete({ where: { id: floorId } });
       return { success: true, floorId, deleted: true, deactivated: false };
     }
     ```

#### 6. `createTable(input: CreateTableInput, externalTx?: Prisma.TransactionClient)`
- **Purpose**: Creates a dining table assigned to a floor.
- **Algorithm**:
  1. Fetch and verify floor:
     ```ts
     const floor = await tx.floor.findFirst({
       where: { id: input.floorId, businessId: input.businessId, isActive: true }
     });
     if (!floor) throw new FloorTableError("Floor not found or is inactive", 404);
     ```
  2. Resolve and verify `branchId`:
     ```ts
     const branchId = input.branchId || floor.branchId;
     if (floor.branchId !== branchId) {
       throw new FloorTableError("Floor belongs to a different branch than the specified branchId", 400);
     }
     ```
  3. Validate unique tableNumber in branch:
     ```ts
     const trimmedNumber = input.tableNumber.trim();
     const existing = await tx.restaurantTable.findFirst({
       where: {
         businessId: input.businessId,
         branchId,
         tableNumber: { equals: trimmedNumber, mode: "insensitive" },
         isActive: true,
       }
     });
     if (existing) {
       throw new FloorTableError(`Table "${trimmedNumber}" already exists in this branch`, 409);
     }
     ```
  4. Create table:
     ```ts
     return await tx.restaurantTable.create({
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
       }
     });
     ```

#### 7. `getTables(filter: GetTablesFilter, externalTx?: Prisma.TransactionClient)`
- **Purpose**: Lists tables with filtering by branch, floor, occupancy status, and active status.
- **Algorithm**:
  1. Build query where:
     ```ts
     const where: Prisma.RestaurantTableWhereInput = {
       businessId: filter.businessId,
       ...(filter.branchId ? { branchId: filter.branchId } : {}),
       ...(filter.floorId ? { floorId: filter.floorId } : {}),
       ...(filter.status ? { status: filter.status } : {}),
       ...(filter.isActive !== undefined ? { isActive: filter.isActive } : { isActive: true }),
     };
     ```
  2. Build include:
     ```ts
     const include = {
       ...(filter.includeFloor ? { floor: { select: { id: true, name: true, displayOrder: true } } } : {}),
       ...(filter.includeCurrentSession ? {
         tableSessions: {
           where: { status: { in: ["ACTIVE", "BILLED"] } },
           take: 1,
           select: { id: true, sessionNumber: true, guestCount: true, status: true, openedAt: true, openedById: true }
         }
       } : {})
     };
     ```
  3. Execute query:
     ```ts
     return await client.restaurantTable.findMany({
       where,
       include: Object.keys(include).length > 0 ? include : undefined,
       orderBy: [{ floor: { displayOrder: "asc" } }, { posY: "asc" }, { posX: "asc" }, { tableNumber: "asc" }],
     });
     ```

#### 8. `getTableById(businessId: string, tableId: string, options?: { includeSession?: boolean }, externalTx?: Prisma.TransactionClient)`
- **Purpose**: Retrieves a specific table with floor details and active session.
- **Algorithm**:
  ```ts
  const table = await client.restaurantTable.findFirst({
    where: { id: tableId, businessId },
    include: {
      floor: true,
      ...(options?.includeSession ? {
        tableSessions: {
          where: { status: { in: ["ACTIVE", "BILLED"] } },
          take: 1,
          include: {
            restaurantOrders: {
              where: { settlementStatus: { not: "PAID" } },
              include: { rounds: { include: { lines: true } } }
            }
          }
        }
      } : {})
    }
  });
  if (!table) throw new FloorTableError("Table not found", 404);
  return table;
  ```

#### 9. `updateTable(input: UpdateTableInput, externalTx?: Prisma.TransactionClient)`
- **Purpose**: Updates table attributes, grid layout coordinates, capacity, or reassigns floor.
- **Algorithm**:
  1. Find table:
     ```ts
     const existing = await tx.restaurantTable.findFirst({
       where: { id: input.tableId, businessId: input.businessId }
     });
     if (!existing) throw new FloorTableError("Table not found", 404);
     ```
  2. If `tableNumber` changed:
     ```ts
     if (input.tableNumber && input.tableNumber.trim() !== existing.tableNumber) {
       const duplicate = await tx.restaurantTable.findFirst({
         where: {
           businessId: input.businessId,
           branchId: existing.branchId,
           tableNumber: { equals: input.tableNumber.trim(), mode: "insensitive" },
           id: { not: input.tableId },
           isActive: true,
         }
       });
       if (duplicate) throw new FloorTableError(`Table "${input.tableNumber.trim()}" already exists in this branch`, 409);
     }
     ```
  3. If `floorId` changed, verify target floor belongs to the SAME branch:
     ```ts
     if (input.floorId && input.floorId !== existing.floorId) {
       const targetFloor = await tx.floor.findFirst({
         where: { id: input.floorId, businessId: input.businessId, branchId: existing.branchId, isActive: true }
       });
       if (!targetFloor) {
         throw new FloorTableError("Target floor not found or belongs to a different branch", 400);
       }
     }
     ```
  4. Status mutation guards:
     ```ts
     if (input.status) {
       if (input.status === "AVAILABLE" && (existing.currentSessionId || existing.status === "OCCUPIED" || existing.status === "BILLED")) {
         throw new FloorTableError(`Cannot set table to AVAILABLE while an active session exists. Close the session first.`, 409);
       }
       if (input.status === "OCCUPIED" && !existing.currentSessionId && existing.status !== "OCCUPIED") {
         throw new FloorTableError(`Cannot set table to OCCUPIED directly. Open a table session instead.`, 400);
       }
     }
     ```
  5. Deactivation guard:
     ```ts
     if (input.isActive === false && existing.isActive) {
       if (existing.status === "OCCUPIED" || existing.status === "BILLED" || existing.currentSessionId) {
         throw new FloorTableError(`Cannot deactivate table "${existing.tableNumber}" while it is occupied or billed`, 409);
       }
     }
     ```
  6. Update:
     ```ts
     return await tx.restaurantTable.update({
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
       }
     });
     ```

#### 10. `deleteTable(businessId: string, tableId: string, externalTx?: Prisma.TransactionClient)`
- **Purpose**: Deletes or soft-deletes a table.
- **Safety Invariant**:
  - Cannot delete table if `status === "OCCUPIED" | "BILLED"` or `currentSessionId !== null`.
  - If table has historical sessions or orders, soft delete (`isActive: false`).
  - If table has 0 historical sessions/orders, hard delete (`delete`).
- **Algorithm**:
  ```ts
  const table = await tx.restaurantTable.findFirst({ where: { id: tableId, businessId } });
  if (!table) throw new FloorTableError("Table not found", 404);

  if (table.currentSessionId || table.status === "OCCUPIED" || table.status === "BILLED") {
    throw new FloorTableError(`Cannot delete table "${table.tableNumber}" while it has an active session`, 409);
  }

  const [sessionCount, orderCount] = await Promise.all([
    tx.tableSession.count({ where: { tableId, businessId } }),
    tx.restaurantOrder.count({ where: { tableId, businessId } }),
  ]);

  if (sessionCount > 0 || orderCount > 0) {
    await tx.restaurantTable.update({
      where: { id: tableId },
      data: { isActive: false }
    });
    return { success: true, tableId, deleted: false, deactivated: true };
  } else {
    await tx.restaurantTable.delete({ where: { id: tableId } });
    return { success: true, tableId, deleted: true, deactivated: false };
  }
  ```

#### 11. `updateTablePositions(input: UpdateTablePositionsInput, externalTx?: Prisma.TransactionClient)`
- **Purpose**: Batch updates grid positions (X, Y, width, height, shape) for interactive drag-and-drop floor planners.
- **Algorithm**:
  ```ts
  const runner = async (tx: Prisma.TransactionClient) => {
    // 1. Verify floor
    const floor = await tx.floor.findFirst({
      where: { id: input.floorId, businessId: input.businessId, isActive: true }
    });
    if (!floor) throw new FloorTableError("Floor not found", 404);

    const updatedTables = [];
    for (const pos of input.positions) {
      const table = await tx.restaurantTable.findFirst({
        where: { id: pos.tableId, floorId: input.floorId, businessId: input.businessId, isActive: true }
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
        }
      });
      updatedTables.push(updated);
    }
    return updatedTables;
  };

  if (externalTx) return await runner(externalTx);
  return await db.$transaction(runner);
  ```

---

## 4. Zod Validation Schemas Specification

```ts
import { z } from "zod";

export const createFloorSchema = z.object({
  name: z.string().trim().min(1, "Floor name is required").max(100, "Floor name must be 100 characters or less"),
  branchId: z.string().uuid("Invalid branch ID format").optional().nullable(),
  displayOrder: z.coerce.number().int().default(0),
  metadata: z.record(z.unknown()).optional().nullable(),
});

export const updateFloorSchema = z.object({
  name: z.string().trim().min(1, "Floor name cannot be empty").max(100).optional(),
  displayOrder: z.coerce.number().int().optional(),
  isActive: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional().nullable(),
});

export const createTableSchema = z.object({
  floorId: z.string().uuid("Invalid floor ID format"),
  tableNumber: z.string().trim().min(1, "Table number is required").max(30, "Table number must be 30 characters or less"),
  capacity: z.coerce.number().int().min(1, "Capacity must be at least 1").max(100, "Capacity cannot exceed 100").default(4),
  shape: z.enum(["RECTANGLE", "ROUND", "SQUARE"]).default("RECTANGLE"),
  posX: z.coerce.number().int().min(0, "Grid X coordinate must be non-negative").default(0),
  posY: z.coerce.number().int().min(0, "Grid Y coordinate must be non-negative").default(0),
  width: z.coerce.number().int().min(1, "Width must be at least 1").max(20).default(1),
  height: z.coerce.number().int().min(1, "Height must be at least 1").max(20).default(1),
  status: z.enum(["AVAILABLE", "RESERVED"]).default("AVAILABLE"),
  branchId: z.string().uuid("Invalid branch ID format").optional().nullable(),
});

export const updateTableSchema = z.object({
  floorId: z.string().uuid("Invalid floor ID format").optional(),
  tableNumber: z.string().trim().min(1, "Table number cannot be empty").max(30).optional(),
  capacity: z.coerce.number().int().min(1, "Capacity must be at least 1").max(100).optional(),
  shape: z.enum(["RECTANGLE", "ROUND", "SQUARE"]).optional(),
  posX: z.coerce.number().int().min(0).optional(),
  posY: z.coerce.number().int().min(0).optional(),
  width: z.coerce.number().int().min(1).max(20).optional(),
  height: z.coerce.number().int().min(1).max(20).optional(),
  status: z.enum(["AVAILABLE", "OCCUPIED", "RESERVED", "BILLED"]).optional(),
  isActive: z.boolean().optional(),
});

export const updateTablePositionsBatchSchema = z.object({
  floorId: z.string().uuid("Invalid floor ID format"),
  positions: z.array(z.object({
    tableId: z.string().uuid("Invalid table ID format"),
    posX: z.coerce.number().int().min(0),
    posY: z.coerce.number().int().min(0),
    shape: z.enum(["RECTANGLE", "ROUND", "SQUARE"]).optional(),
    width: z.coerce.number().int().min(1).optional(),
    height: z.coerce.number().int().min(1).optional(),
  })).min(1, "At least one table position is required"),
});
```

---

## 5. REST API Route Specifications

### 5.1 Route: `backend/src/app/api/v1/restaurant/floors/route.ts`

#### `GET /api/v1/restaurant/floors`
- **Auth**: Required (`getSessionContext()`).
- **Roles**: All logged-in staff (`OWNER`, `MANAGER`, `CASHIER`, `SUPER_ADMIN`).
- **Query Parameters**:
  - `branchId` (string, optional, defaults to session `branchId`)
  - `includeTables` (string "true"|"false", default "true")
- **Delegation**: `getFloors({ businessId, branchId, includeTables: includeTables !== "false" })`
- **Response 200 OK**:
  ```json
  {
    "floors": [
      {
        "id": "f1b1a774-0001-4000-8000-000000000001",
        "businessId": "b1a77400-0000-4000-8000-000000000001",
        "branchId": "c1a77400-0000-4000-8000-000000000001",
        "name": "Ground Dining Room",
        "displayOrder": 0,
        "isActive": true,
        "metadata": { "gridWidth": 12, "gridHeight": 8 },
        "createdAt": "2026-11-01T04:00:00.000Z",
        "updatedAt": "2026-11-01T04:00:00.000Z",
        "tables": [
          {
            "id": "t1b1a774-0001-4000-8000-000000000001",
            "floorId": "f1b1a774-0001-4000-8000-000000000001",
            "tableNumber": "T1",
            "capacity": 4,
            "status": "AVAILABLE",
            "currentSessionId": null,
            "shape": "RECTANGLE",
            "posX": 1,
            "posY": 2,
            "width": 2,
            "height": 1,
            "isActive": true
          }
        ]
      }
    ]
  }
  ```

#### `POST /api/v1/restaurant/floors`
- **Auth**: Required.
- **Roles**: `OWNER`, `MANAGER`, `SUPER_ADMIN`. Cashiers return HTTP 403 Forbidden.
- **Request Body**:
  ```json
  {
    "name": "Rooftop Terrace",
    "branchId": "c1a77400-0000-4000-8000-000000000001",
    "displayOrder": 2,
    "metadata": { "gridWidth": 16, "gridHeight": 10 }
  }
  ```
- **Delegation**: `createFloor(...)`
- **Response 201 Created**:
  ```json
  {
    "floor": {
      "id": "f1b1a774-0002-4000-8000-000000000002",
      "businessId": "b1a77400-0000-4000-8000-000000000001",
      "branchId": "c1a77400-0000-4000-8000-000000000001",
      "name": "Rooftop Terrace",
      "displayOrder": 2,
      "isActive": true,
      "metadata": { "gridWidth": 16, "gridHeight": 10 },
      "createdAt": "2026-11-01T04:30:00.000Z",
      "updatedAt": "2026-11-01T04:30:00.000Z"
    }
  }
  ```
- **Error Codes**:
  - `400`: Zod validation error or missing branchId.
  - `401`: Unauthorized.
  - `403`: Forbidden (Cashier).
  - `404`: Branch not found.
  - `409`: Floor with name already exists in this branch.

---

### 5.2 Route: `backend/src/app/api/v1/restaurant/floors/[id]/route.ts`

**Next.js 16 Signature**:
```ts
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> })
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> })
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> })
```

#### `GET /api/v1/restaurant/floors/[id]`
- **Delegation**: `getFloorById(session.businessId, id, { includeTables: true })`
- **Response 200 OK**: `{ "floor": { ... } }`
- **Error Codes**: `401`, `404` (Floor not found).

#### `PATCH /api/v1/restaurant/floors/[id]`
- **Roles**: `OWNER`, `MANAGER`, `SUPER_ADMIN`.
- **Request Body**:
  ```json
  {
    "name": "Terrace Garden",
    "displayOrder": 1,
    "isActive": true,
    "metadata": { "gridWidth": 14, "gridHeight": 10 }
  }
  ```
- **Delegation**: `updateFloor({ businessId: session.businessId, floorId: id, ...parsedBody })`
- **Response 200 OK**: `{ "floor": { ... } }`
- **Error Codes**: `400` (Validation), `401`, `403`, `404` (Not found), `409` (Name duplicate or active tables on deactivation).

#### `DELETE /api/v1/restaurant/floors/[id]`
- **Roles**: `OWNER`, `MANAGER`, `SUPER_ADMIN`.
- **Delegation**: `deleteFloor(session.businessId, id)`
- **Response 200 OK**: `{ "success": true, "message": "Floor deleted successfully" }`
- **Error Codes**: `401`, `403`, `404` (Not found), `409` (Floor has existing tables).

---

### 5.3 Route: `backend/src/app/api/v1/restaurant/tables/route.ts`

#### `GET /api/v1/restaurant/tables`
- **Auth**: Required.
- **Roles**: All logged-in staff.
- **Query Parameters**:
  - `floorId` (string, optional)
  - `branchId` (string, optional, defaults to session `branchId`)
  - `status` (string, optional: `AVAILABLE`, `OCCUPIED`, `RESERVED`, `BILLED`)
- **Delegation**: `getTables({ businessId, branchId, floorId, status, includeFloor: true, includeCurrentSession: true })`
- **Response 200 OK**:
  ```json
  {
    "tables": [
      {
        "id": "t1b1a774-0001-4000-8000-000000000001",
        "floorId": "f1b1a774-0001-4000-8000-000000000001",
        "tableNumber": "T1",
        "capacity": 4,
        "status": "OCCUPIED",
        "currentSessionId": "s1b1a774-0001-4000-8000-000000000001",
        "shape": "RECTANGLE",
        "posX": 1,
        "posY": 1,
        "width": 2,
        "height": 1,
        "isActive": true,
        "floor": { "id": "f1b1a774-0001-4000-8000-000000000001", "name": "Ground Floor" },
        "tableSessions": [
          {
            "id": "s1b1a774-0001-4000-8000-000000000001",
            "sessionNumber": "TS-20261101-1000-1234",
            "guestCount": 3,
            "status": "ACTIVE",
            "openedAt": "2026-11-01T04:15:00.000Z"
          }
        ]
      }
    ]
  }
  ```

#### `POST /api/v1/restaurant/tables`
- **Auth**: Required.
- **Roles**: `OWNER`, `MANAGER`, `SUPER_ADMIN`.
- **Request Body**:
  ```json
  {
    "floorId": "f1b1a774-0001-4000-8000-000000000001",
    "tableNumber": "T10",
    "capacity": 6,
    "shape": "ROUND",
    "posX": 4,
    "posY": 3,
    "width": 2,
    "height": 2,
    "branchId": "c1a77400-0000-4000-8000-000000000001"
  }
  ```
- **Delegation**: `createTable({ businessId: session.businessId, ...parsedBody })`
- **Response 201 Created**: `{ "table": { ... } }`
- **Error Codes**:
  - `400`: Validation failed or branch mismatch.
  - `401`: Unauthorized.
  - `403`: Forbidden.
  - `404`: Floor not found.
  - `409`: Table number already exists in branch.

---

### 5.4 Route: `backend/src/app/api/v1/restaurant/tables/[id]/route.ts`

**Next.js 16 Signature**:
```ts
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> })
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> })
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> })
```

#### `GET /api/v1/restaurant/tables/[id]`
- **Delegation**: `getTableById(session.businessId, id, { includeSession: true })`
- **Response 200 OK**: `{ "table": { ... } }`
- **Error Codes**: `401`, `404` (Table not found).

#### `PATCH /api/v1/restaurant/tables/[id]`
- **Roles**: `OWNER`, `MANAGER`, `SUPER_ADMIN` (or staff adjusting position/capacity).
- **Request Body**:
  ```json
  {
    "tableNumber": "T10-VIP",
    "capacity": 8,
    "shape": "RECTANGLE",
    "posX": 5,
    "posY": 3,
    "width": 3,
    "height": 2,
    "status": "RESERVED"
  }
  ```
- **Delegation**: `updateTable({ businessId: session.businessId, tableId: id, ...parsedBody })`
- **Response 200 OK**: `{ "table": { ... } }`
- **Error Codes**:
  - `400`: Validation failure or invalid status transition.
  - `401`: Unauthorized.
  - `404`: Table or target floor not found.
  - `409`: Duplicate table number in branch or deactivating occupied table.

#### `DELETE /api/v1/restaurant/tables/[id]`
- **Roles**: `OWNER`, `MANAGER`, `SUPER_ADMIN`.
- **Delegation**: `deleteTable(session.businessId, id)`
- **Response 200 OK**: `{ "success": true, "message": "Table deleted successfully" }`
- **Error Codes**:
  - `401`: Unauthorized.
  - `403`: Forbidden.
  - `404`: Table not found.
  - `409`: Table is occupied or has active session.

---

## 6. Features Discovered Table

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Floor | Multi-tenant Floor Creation | Creates dining floor bound to `businessId` and `branchId` with unique name enforcement | `CreateFloorInput` (name, branchId, displayOrder, metadata) | Created `Floor` record | 400 validation, 404 branch not found, 409 name collision | `packages/db/prisma/schema.prisma:1113`, `PHASE_3_RESTAURANT_MVP.md` |
| 2 | Floor | Floor Listing with Tables | Fetches active floors ordered by `displayOrder`, embedding active tables ordered by coordinates | `GetFloorsFilter` (businessId, branchId, isActive, includeTables) | `Floor[]` with embedded `RestaurantTable[]` | 401 unauthorized, 500 server error | `backend/src/app/api/v1/restaurant/floors/route.ts` |
| 3 | Floor | Single Floor Inspection | Retrieves floor details and its table layout | `businessId`, `floorId`, `includeTables` | `Floor` record | 404 floor not found | M2 Explorer probe |
| 4 | Floor | Floor Updating & Renaming | Updates floor name, display order, metadata with duplicate name check in branch | `UpdateFloorInput` (name, displayOrder, metadata, isActive) | Updated `Floor` record | 400 validation, 404 not found, 409 name collision | `backend/src/app/api/v1/branches/[id]/route.ts` pattern |
| 5 | Floor | Safe Floor Deletion | Prevents deletion if active tables exist; soft/hard deletes if empty | `businessId`, `floorId` | `{ success: true, floorId, deleted, deactivated }` | 404 not found, 409 if tables exist on floor | Architecture Invariants Survey |
| 6 | Table | Table Creation with Grid Position | Creates table with seating capacity, 2D coordinates (X, Y), dimensions, and shape | `CreateTableInput` (floorId, tableNumber, capacity, shape, posX, posY, width, height) | Created `RestaurantTable` record | 400 validation/branch mismatch, 404 floor missing, 409 duplicate tableNumber | `packages/db/prisma/schema.prisma:1133` |
| 7 | Table | Table Filtering by Status & Floor | Lists tables filtered by branch, floor, status (`AVAILABLE`, `OCCUPIED`, `RESERVED`, `BILLED`) | `GetTablesFilter` (branchId, floorId, status, isActive) | `RestaurantTable[]` with floor and session data | 401 unauthorized, 500 error | `backend/src/app/api/v1/restaurant/tables/route.ts` |
| 8 | Table | Single Table Status Query | Queries single table with its active session and order round progress | `businessId`, `tableId`, `includeSession` | `RestaurantTable` with optional active session & orders | 404 table not found | UI Floor Grid requirements |
| 9 | Table | Table Updating & Coordinate Relocation | Modifies table capacity, dimensions, coordinates, shape, or reassigns floor | `UpdateTableInput` (tableNumber, capacity, shape, posX, posY, width, height, status) | Updated `RestaurantTable` record | 400 validation/illegal status jump, 404 not found, 409 duplicate number | Architecture Invariants Survey |
| 10 | Table | Safe Table Deletion | Deletes table; blocks deletion if table is occupied or billed; soft deletes if historical orders exist | `businessId`, `tableId` | `{ success: true, tableId, deleted, deactivated }` | 404 not found, 409 if occupied/billed | Architecture Invariants Survey |
| 11 | Layout | Batch Table Position Updates | Updates multiple table positions in single transaction for drag-and-drop floor planners | `UpdateTablePositionsInput` (floorId, positions: { tableId, posX, posY, shape, width, height }[]) | `RestaurantTable[]` updated | 400 validation, 404 floor not found | Hospitality UI/UX Floor Grid ergonomics |
| 12 | Schema Relation | `TableSession.restaurantOrders` naming | Prisma relation name is `restaurantOrders`, NOT `orders` | Prisma schema inspection | Accurate Prisma type references | TS2353 type errors when using `orders` | Typecheck probe in `packages/db/prisma/schema.prisma:1185` |

---

## 7. Edge Cases & Observed Behavior Matrix

| # | Feature | Input / Scenario | Observed / Required Behavior |
|---|---------|------------------|------------------------------|
| 1 | `createFloor` | Two floors created with exact same name in the same branch | Second call fails with HTTP 409 Conflict: `Floor "<name>" already exists in this branch`. |
| 2 | `createFloor` | Two floors created with the same name across two different branches of the same business | Succeeded (HTTP 201 Created). Unique index is composite `[businessId, branchId, name]`. |
| 3 | `createFloor` | Two floors created with same name across two different businesses | Succeeded (HTTP 201 Created). Multi-tenant isolation verified. |
| 4 | `deleteFloor` | Deleting a floor that has 3 active tables | Fails closed with HTTP 409 Conflict: `Cannot delete floor: it contains 3 table(s). Reassign or delete tables first.` |
| 5 | `updateFloor` | Deactivating a floor (`isActive: false`) while a table on it is `OCCUPIED` | Fails closed with HTTP 409 Conflict: `Cannot deactivate floor while it contains occupied or billed tables`. |
| 6 | `createTable` | `tableNumber` already exists in another branch | Succeeded (HTTP 201 Created). Unique index is composite `[businessId, branchId, tableNumber]`. |
| 7 | `createTable` | `tableNumber` already exists in the same branch | Fails closed with HTTP 409 Conflict: `Table "<number>" already exists in this branch`. |
| 8 | `createTable` | Specifying `branchId` that does not match `floor.branchId` | Fails with HTTP 400 Bad Request: `Floor belongs to a different branch than the specified branchId`. |
| 9 | `createTable` | Zero or negative capacity (`capacity: 0` or `-2`) | Blocked by Zod validation with HTTP 400 Bad Request: `Capacity must be at least 1`. |
| 10 | `createTable` | Negative grid coordinates (`posX: -1`, `posY: -3`) | Blocked by Zod validation with HTTP 400 Bad Request: `Grid X coordinate must be non-negative`. |
| 11 | `updateTable` | Moving a table to a floor in a different branch | Fails with HTTP 400 Bad Request: `Target floor not found or belongs to a different branch`. |
| 12 | `updateTable` | Manually setting `status: "AVAILABLE"` while `currentSessionId` is non-null | Fails closed with HTTP 409 Conflict: `Cannot set table to AVAILABLE while an active session exists. Close the session first.` |
| 13 | `updateTable` | Manually setting `status: "OCCUPIED"` on an available table via PATCH | Fails with HTTP 400 Bad Request: `Cannot set table to OCCUPIED directly. Open a table session instead.` |
| 14 | `deleteTable` | Table is in `OCCUPIED` or `BILLED` status | Fails closed with HTTP 409 Conflict: `Cannot delete table while it has an active session`. |
| 15 | `deleteTable` | Table is `AVAILABLE`, but has 5 historical settled sessions and orders in database | Table is soft-deleted (`isActive = false`) to preserve historical accounting and audit FK integrity. Returns HTTP 200 OK with `deactivated: true`. |
| 16 | `deleteTable` | Table is newly created with 0 sessions and 0 orders | Hard deleted from database (`restaurantTable.delete`). Returns HTTP 200 OK with `deleted: true`. |
| 17 | `Next.js 16 routes` | Accessing dynamic param without `await params` in `[id]/route.ts` | Triggers Next.js 16 runtime deprecation/promise unwrapping error. Must use `const { id } = await params;`. |
| 18 | `RBAC Authorization` | Cashier account attempting POST/PATCH/DELETE on `/restaurant/floors` or `/restaurant/tables` | Blocked with HTTP 403 Forbidden. Only `OWNER`, `MANAGER`, `SUPER_ADMIN` can modify layout. |

---

## 8. Verification & Implementation Method for Builders and Testers

### 8.1 Builder Action Plan
1. **Create Service**: Implement `backend/src/lib/services/floor-table-service.ts` matching the interfaces and algorithms specified in Section 3.
2. **Refactor Existing Floor Route**: Update `backend/src/app/api/v1/restaurant/floors/route.ts` to delegate to `floor-table-service.ts` and add RBAC checks.
3. **Create Floor Dynamic Route**: Implement `backend/src/app/api/v1/restaurant/floors/[id]/route.ts` handling GET, PATCH, and DELETE with `await params`.
4. **Refactor Existing Table Route**: Update `backend/src/app/api/v1/restaurant/tables/route.ts` to delegate to `floor-table-service.ts` and add RBAC checks.
5. **Create Table Dynamic Route**: Implement `backend/src/app/api/v1/restaurant/tables/[id]/route.ts` handling GET, PATCH, and DELETE with `await params`.

### 8.2 Tester Verification Checklist
1. **Typecheck Verification**:
   ```bash
   npm.cmd run typecheck
   ```
2. **Unit & Integration Tests**:
   Create or run `tests/restaurant-floor-table.integration.test.ts` to verify:
   - Tenant isolation: User from Business A cannot see or edit Floor/Table from Business B.
   - Unique constraints: Duplicate floor name in same branch fails with 409; duplicate table number in same branch fails with 409.
   - Deletion safety: Deleting a floor with tables fails with 409; deleting an occupied table fails with 409.
   - Soft vs hard deletion: Empty table hard-deletes; table with order history soft-deletes (`isActive: false`).
   - Coordinate preservation: Grid coordinates (`posX`, `posY`, `shape`, `capacity`) persist accurately.
