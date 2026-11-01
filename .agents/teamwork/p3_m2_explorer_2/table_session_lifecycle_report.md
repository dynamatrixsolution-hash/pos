# Phase 3 Milestone M2: TableSession Lifecycle & Table Occupancy State Machine Specification Report

**Author**: M2 Explorer 2 (TableSession Lifecycle Analyst)  
**Target Milestone**: Phase 3 Milestone M2 (Floor, Table & TableSession Management Services & APIs)  
**Working Directory**: `c:\projects\pos\.agents\teamwork\p3_m2_explorer_2`  
**Date**: 2026-11-01  
**Status**: COMPLETE / READY FOR IMPLEMENTATION  

---

## 1. Executive Summary & Problem Formulation

Milestone M2 establishes the dining session core of RestroInn's Phase 3 Restaurant Staff POS. Unlike transient retail cart checkouts, hospitality transactions are long-lived, multi-round dining engagements bound to physical tables (`RestaurantTable`) through dining parties (`TableSession`).

This report provides the exhaustive specification for:
1. **The Dual Coupled State Machines**:
   - `RestaurantTable` occupancy lifecycle (`AVAILABLE`, `OCCUPIED`, `RESERVED`, `BILLED`).
   - `TableSession` operational lifecycle (`ACTIVE`, `BILLED`, `CLOSED`, `MERGED`).
2. **Atomic Service Operations in `backend/src/lib/services/table-session-service.ts`**:
   - `openTableSession`: Strict table availability validation, monotonic daily branch session numbering (`SESS-YYYYMMDD-XXXX`), atomic CAS table binding, audit logging.
   - `closeTableSession`: Rigorous settlement invariant verification (all orders must be `PAID`, `REFUNDED`, or explicitly voided as `REJECTED`/`CANCELLED`), kitchen preparation safety checks, atomic table release, audit logging.
   - Auxiliary methods: `getTableSessionById`, `getActiveTableSessions`, `updateTableSession`, `billTableSession`.
3. **REST API Endpoints**:
   - `backend/src/app/api/v1/restaurant/sessions/route.ts` (`POST` open, `GET` list).
   - `backend/src/app/api/v1/restaurant/sessions/[id]/route.ts` (`GET` details, `PATCH` update).
   - `backend/src/app/api/v1/restaurant/sessions/[id]/close/route.ts` (`POST` close).
   - Fully typed Zod schemas, HTTP status codes, and Next.js 16 async route params (`{ params }: { params: Promise<{ id: string }> }`).
4. **Optimistic Concurrency Control (OCC) & Serialization Safety**:
   - `TableSession.version: Int` check on mutations and closures.
   - Atomic Compare-And-Swap (CAS) guard on `RestaurantTable` to eliminate double-seating race conditions across multi-waiter terminals.
   - PostgreSQL `Serializable` transaction isolation boundaries.
5. **Critical Remediation of Current Codebase Draft**:
   - Identifies and provides fixes for 7 critical defects in `table-session-service.ts` (random non-monotonic numbering, non-existent `mergedIntoSessionId` column, invalid Prisma relations, `COMPLETED` vs `CLOSED` status naming, missing OCC versioning, and faulty order settlement checks).

---

## 2. State Machine Lifecycles & Invariants

Hospitality table management coordinates two distinct but coupled state machines: physical floor furniture (`RestaurantTable`) and logical dining party engagements (`TableSession`).

```
+-----------------------------------------------------------------------------------+
|                           RestaurantTable State Machine                           |
+-----------------------------------------------------------------------------------+
               │
               ▼
        [ AVAILABLE ] ◄─────────────────────────────────────────┐
          │         ▲                                           │
          │ open    │ closeTableSession                         │ closeTableSession
          │ session │ (direct close / void)                     │ (settled)
          ▼         │                                           │
        [ OCCUPIED ] ──────────────────► [ BILLED ] ────────────┘
          ▲                                  │
          │                                  │ (new items added
          └──────────────────────────────────┘  re-opens occupied)
```

```
+-----------------------------------------------------------------------------------+
|                            TableSession State Machine                             |
+-----------------------------------------------------------------------------------+
               │
               ▼
          [ ACTIVE ] ─────────────────────────► [ BILLED ]
            │     │                                  │
            │     └──────────────┐                   │
            │ closeTableSession  │ mergeTableSession │ closeTableSession
            │                    ▼                   ▼
            └──────────────► [ CLOSED ]          [ CLOSED ]
                                 ▲
                                 │
                            [ MERGED ] (Terminal: absorbed into target session)
```

### 2.1 Table Occupancy Statuses (`RestaurantTable.status`)

| Status | `currentSessionId` | Description & Semantics | Allowed Outgoing Transitions |
|---|---|---|---|
| `AVAILABLE` | MUST be `null` | Table is vacant, cleaned, and ready to seat guests. | `OCCUPIED` (via `openTableSession`), `RESERVED` |
| `OCCUPIED` | Points to active `TableSession.id` | Guests are actively seated; dining orders are actively accumulating or being fulfilled. | `BILLED` (bill requested), `AVAILABLE` (if closed without bill stage, or moved/merged away) |
| `BILLED` | Points to active `TableSession.id` | Final bill printed or requested. Diners are reviewing check or paying. Prevents walk-in seating. | `AVAILABLE` (upon full payment & session closure), `OCCUPIED` (if diner orders more items) |
| `RESERVED` | MUST be `null` | Table reserved for upcoming party. Blocked from walk-in seating. | `AVAILABLE` (cancellation/no-show), `OCCUPIED` (party arrives) |

#### Cardinal Invariants for `RestaurantTable`:
1. **Pointer Invariant**: `RestaurantTable.currentSessionId` is non-null IF AND ONLY IF `status` is `OCCUPIED` or `BILLED`. If `status` is `AVAILABLE` or `RESERVED`, `currentSessionId` MUST be `null`.
2. **DAG Invariant**: `RestaurantTable.currentSessionId` is stored as a scalar `String?` without an `@relation` attribute to prevent cyclic dependencies with `TableSession` in `backup-format.ts`.
3. **Multi-Tenant Composite Key**: Every table lookup and mutation must include `businessId` (`@@unique([businessId, id])`).

### 2.2 TableSession Lifecycle Statuses (`TableSession.status`)

| Status | `closedAt` | Description & Semantics | Allowed Outgoing Transitions |
|---|---|---|---|
| `ACTIVE` | `null` | Session is open. Staff can add rounds, lines, modify guest count, or add notes. | `BILLED`, `CLOSED`, `MERGED` |
| `BILLED` | `null` | Bill has been presented to the table. Orders are in final settlement. | `CLOSED` (all orders paid), `ACTIVE` (reopened if more rounds ordered) |
| `CLOSED` | Populated (`now()`) | Terminal status. Party has vacated; all orders are fully settled (`PAID`/`REFUNDED`) or voided (`CANCELLED`/`REJECTED`). Fully immutable. | None (Terminal) |
| `MERGED` | Populated (`now()`) | Terminal status. Session was absorbed into another table session via `mergeTableSessions`. All orders reparented to target session. | None (Terminal) |

#### Cardinal Invariants for `TableSession`:
1. **Exclusivity Invariant**: A `RestaurantTable` may have at most ONE active (`ACTIVE` or `BILLED`) session at any given moment.
2. **Monotonic Suffix Invariant**: `sessionNumber` is strictly unique and monotonically increasing per branch per calendar day (`@@unique([businessId, branchId, sessionNumber])`).
3. **Closure Settlement Guard**: A session CANNOT be transitioned to `CLOSED` if any associated `RestaurantOrder` has `settlementStatus IN ("UNPAID", "PARTIAL")`, UNLESS that order was voided (`acceptanceStatus == "REJECTED"` or `fulfillmentStatus == "CANCELLED"`).
4. **Kitchen Safety Guard**: A session CANNOT be closed if food lines are actively cooking (`acceptanceStatus == "ACCEPTED"` and `fulfillmentStatus IN ("QUEUED", "PREPARING")`), unless explicitly forced (`force: true`).
5. **OCC Invariant**: Any mutation to `TableSession` must verify `version` and increment `version` by 1. Stale writes fail closed with HTTP 409 Conflict.

---

## 3. Monotonic Session Number Generation Algorithm

### 3.1 Requirements
- Monotonic per branch.
- Deterministic, collision-resistant under concurrent multi-terminal requests.
- Human-readable daily sequence: `SESS-YYYYMMDD-XXXX` (e.g. `SESS-20261101-0001`).

### 3.2 Transactional Implementation Specification
```ts
/**
 * Generates a concurrency-safe, monotonic session number per branch for the given date.
 * Format: SESS-YYYYMMDD-XXXX (e.g., SESS-20261101-0001)
 */
export async function generateMonotonicSessionNumber(
  tx: Prisma.TransactionClient,
  businessId: string,
  branchId: string,
  now: Date = new Date()
): Promise<string> {
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, ""); // "20261101"
  const prefix = `SESS-${dateStr}-`;

  // Query the highest existing sessionNumber for this branch today
  const lastSession = await tx.tableSession.findFirst({
    where: {
      businessId,
      branchId,
      sessionNumber: { startsWith: prefix },
    },
    orderBy: { sessionNumber: "desc" },
    select: { sessionNumber: true },
  });

  let nextSequence = 1;
  if (lastSession?.sessionNumber) {
    const parts = lastSession.sessionNumber.split("-");
    const lastNum = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastNum)) {
      nextSequence = lastNum + 1;
    }
  }

  const paddedSequence = String(nextSequence).padStart(4, "0");
  return `${prefix}${paddedSequence}`;
}
```

### 3.3 Concurrency Protection
1. Inside a PostgreSQL `Serializable` transaction, if two transactions simultaneously query `findFirst` and attempt to insert the same `sessionNumber`, PostgreSQL aborts the second with error `40001: could not serialize access due to read/write dependencies`.
2. Even in lower isolation levels, the database schema enforces:
   `@@unique([businessId, branchId, sessionNumber])` (Postgres constraint `TableSession_businessId_branchId_sessionNumber_key`).
   Any duplicate attempt triggers a unique key violation (`P2002`), which is caught and mapped to a retry or 409 Conflict error.

---

## 4. `TableSession` Service Layer Specification (`backend/src/lib/services/table-session-service.ts`)

### 4.1 Interface Definitions
```ts
export class TableSessionError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "TableSessionError";
    this.statusCode = statusCode;
  }
}

export interface OpenSessionInput {
  businessId: string;
  branchId: string;
  tableId: string;
  guestCount?: number;
  openedById?: string | null;
  notes?: string | null;
}

export interface CloseSessionInput {
  businessId: string;
  sessionId: string;
  closedById?: string | null;
  notes?: string | null;
  force?: boolean;
  expectedVersion?: number;
}

export interface UpdateSessionInput {
  businessId: string;
  sessionId: string;
  guestCount?: number;
  notes?: string | null;
  expectedVersion?: number;
  actorId?: string | null;
}

export interface GetSessionsFilter {
  businessId: string;
  branchId?: string | null;
  floorId?: string | null;
  status?: string | null; // "ACTIVE" | "BILLED" | "CLOSED" | "MERGED" | "all"
}
```

---

### 4.2 `openTableSession` Specification

#### Step-by-Step Algorithm:
1. **Table Verification**:
   - Query `tx.restaurantTable.findFirst` matching `id`, `businessId`, `branchId`, `isActive: true`.
   - If not found: throw `TableSessionError("Table not found or is inactive", 404)`.
2. **Table Occupancy Pre-check**:
   - Check `table.status === "AVAILABLE"`.
   - If `table.status !== "AVAILABLE"`: throw `TableSessionError("Table ${table.tableNumber} is not available (current status: ${table.status})", 409)`.
3. **Session Exclusivity Check**:
   - Check if an active session already references this table:
     `tx.tableSession.findFirst({ where: { businessId, tableId, status: { in: ["ACTIVE", "BILLED"] } } })`.
   - If found: throw `TableSessionError("Table already has an active session (${existing.sessionNumber})", 409)`.
4. **Generate Monotonic Number**:
   - Call `await generateMonotonicSessionNumber(tx, input.businessId, input.branchId)`.
5. **Create TableSession**:
   - Insert `tx.tableSession.create`:
     - `guestCount`: `input.guestCount && input.guestCount > 0 ? input.guestCount : 1`.
     - `status`: `"ACTIVE"`.
     - `openedAt`: `new Date()`.
     - `openedById`: `input.openedById || null`.
     - `notes`: `input.notes || null`.
     - `version`: `1`.
6. **Atomic CAS Update on `RestaurantTable`**:
   - Use `tx.restaurantTable.updateMany` with optimistic CAS conditions:
     ```ts
     const tableUpdate = await tx.restaurantTable.updateMany({
       where: {
         id: input.tableId,
         businessId: input.businessId,
         status: "AVAILABLE",
         currentSessionId: null,
       },
       data: {
         status: "OCCUPIED",
         currentSessionId: session.id,
       },
     });
     if (tableUpdate.count === 0) {
       throw new TableSessionError(
         `Table ${table.tableNumber} was occupied by a concurrent request. Please refresh.`,
         409
       );
     }
     ```
7. **Audit Trail**:
   - Create `AuditEvent`: `action: "TABLE_SESSION_OPENED"`, `entity: "TableSession"`, `entityId: session.id`.
8. **Return**: `{ session, table: updatedTable }`.

---

### 4.3 `closeTableSession` Specification

#### Step-by-Step Algorithm:
1. **Fetch Session with Relations**:
   - Query `tx.tableSession.findFirst`:
     ```ts
     const session = await tx.tableSession.findFirst({
       where: { id: input.sessionId, businessId: input.businessId },
       include: {
         table: true,
         restaurantOrders: {
           include: {
             orderLines: true,
           },
         },
       },
     });
     ```
   - If not found: throw `TableSessionError("Session not found", 404)`.
2. **Terminal Status Check**:
   - If `session.status === "CLOSED" || session.status === "COMPLETED" || session.status === "MERGED"`:
     throw `TableSessionError("Session already closed with status: ${session.status}", 409)`.
3. **OCC Version Check**:
   - If `input.expectedVersion !== undefined && session.version !== input.expectedVersion`:
     throw `TableSessionError("Session version mismatch: current ${session.version}, expected ${input.expectedVersion}", 409)`.
4. **Order Settlement & Kitchen Safety Invariant Validation**:
   - If `!input.force`:
     * **Settlement Check**:
       ```ts
       const orders = session.restaurantOrders || [];
       const unsettledOrders = orders.filter((o) => {
         const isVoided = o.acceptanceStatus === "REJECTED" || o.fulfillmentStatus === "CANCELLED";
         if (isVoided) return false;
         const isSettled = o.settlementStatus === "PAID" || o.settlementStatus === "REFUNDED";
         return !isSettled;
       });
       if (unsettledOrders.length > 0) {
         throw new TableSessionError(
           `Cannot close session: ${unsettledOrders.length} order(s) remain unsettled (unpaid or partially paid)`,
           400
         );
       }
       ```
     * **Kitchen Preparation Safety Check**:
       ```ts
       const activeFoodLines = orders.flatMap((o) => o.orderLines || []).filter((l) =>
         l.acceptanceStatus === "ACCEPTED" &&
         (l.fulfillmentStatus === "QUEUED" || l.fulfillmentStatus === "PREPARING")
       );
       if (activeFoodLines.length > 0) {
         throw new TableSessionError(
           `Cannot close session: ${activeFoodLines.length} item(s) are actively preparing in the kitchen`,
           400
         );
       }
       ```
5. **Atomic Session Closure with Version Increment**:
   - Execute CAS update on `TableSession`:
     ```ts
     const sessionUpdate = await tx.tableSession.updateMany({
       where: {
         id: session.id,
         businessId: input.businessId,
         version: input.expectedVersion ?? session.version,
         status: { in: ["ACTIVE", "BILLED"] },
       },
       data: {
         status: "CLOSED",
         closedAt: new Date(),
         closedById: input.closedById || null,
         version: { increment: 1 },
         notes: input.notes
           ? `${session.notes || ""}\n[CLOSE NOTE]: ${input.notes}`.trim()
           : session.notes,
       },
     });
     if (sessionUpdate.count === 0) {
       throw new TableSessionError(
         `Concurrent modification detected on session ${session.sessionNumber}. Please refresh.`,
         409
       );
     }
     ```
6. **Atomic Table Release**:
   - Update `RestaurantTable`:
     ```ts
     const updatedTable = await tx.restaurantTable.update({
       where: { id: session.tableId },
       data: {
         status: "AVAILABLE",
         currentSessionId: null,
       },
     });
     ```
7. **Audit Trail**:
   - Create `AuditEvent`: `action: "TABLE_SESSION_CLOSED"`, `entity: "TableSession"`, `entityId: session.id`, with order summary.
8. **Return**: `{ session: closedSession, table: updatedTable }`.

---

### 4.4 Auxiliary Service Methods

#### `getTableSessionById`
```ts
export async function getTableSessionById(businessId: string, sessionId: string) {
  const session = await db.tableSession.findFirst({
    where: { id: sessionId, businessId },
    include: {
      table: {
        include: { floor: { select: { id: true, name: true } } },
      },
      openedBy: { select: { id: true, name: true, email: true } },
      closedBy: { select: { id: true, name: true, email: true } },
      restaurantOrders: {
        include: {
          rounds: { orderBy: { roundNumber: "asc" } },
          orderLines: { orderBy: { createdAt: "asc" } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!session) throw new TableSessionError("Session not found", 404);
  return session;
}
```

#### `getActiveTableSessions`
```ts
export async function getActiveTableSessions(filter: GetSessionsFilter) {
  const statusFilter = filter.status === "all"
    ? {}
    : filter.status
    ? { status: filter.status }
    : { status: { in: ["ACTIVE", "BILLED"] } };

  return await db.tableSession.findMany({
    where: {
      businessId: filter.businessId,
      ...(filter.branchId ? { branchId: filter.branchId } : {}),
      ...(filter.floorId ? { table: { floorId: filter.floorId } } : {}),
      ...statusFilter,
    },
    include: {
      table: { select: { id: true, tableNumber: true, capacity: true, status: true, floorId: true } },
      openedBy: { select: { id: true, name: true } },
      _count: { select: { restaurantOrders: true } },
    },
    orderBy: { openedAt: "desc" },
  });
}
```

#### `updateTableSession`
```ts
export async function updateTableSession(input: UpdateSessionInput) {
  return await db.$transaction(async (tx) => {
    const session = await tx.tableSession.findFirst({
      where: { id: input.sessionId, businessId: input.businessId },
    });
    if (!session) throw new TableSessionError("Session not found", 404);
    if (session.status !== "ACTIVE" && session.status !== "BILLED") {
      throw new TableSessionError(`Cannot update session with status ${session.status}`, 400);
    }
    if (input.expectedVersion !== undefined && session.version !== input.expectedVersion) {
      throw new TableSessionError(
        `Session version mismatch: current ${session.version}, expected ${input.expectedVersion}`,
        409
      );
    }

    const updateData: Prisma.TableSessionUpdateInput = {
      version: { increment: 1 },
    };
    if (input.guestCount !== undefined) {
      if (input.guestCount < 1) throw new TableSessionError("Guest count must be at least 1", 400);
      updateData.guestCount = input.guestCount;
    }
    if (input.notes !== undefined) {
      updateData.notes = input.notes;
    }

    const updated = await tx.tableSession.update({
      where: { id: session.id },
      data: updateData,
    });

    await createAuditEvent(
      {
        businessId: input.businessId,
        branchId: session.branchId,
        userId: input.actorId || null,
        action: "TABLE_SESSION_UPDATED",
        entity: "TableSession",
        entityId: session.id,
        oldValue: { guestCount: session.guestCount, notes: session.notes, version: session.version },
        newValue: { guestCount: updated.guestCount, notes: updated.notes, version: updated.version },
      },
      tx
    );

    return updated;
  });
}
```

---

## 5. REST API Route Specifications

All routes strictly adhere to Next.js 16 App Router standards: dynamic path parameters are received as `Promise<{ [key: string]: string }>` and must be awaited.

### 5.1 Route 1: `backend/src/app/api/v1/restaurant/sessions/route.ts`

```ts
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
  notes: z.string().max(500).optional().nullable(),
  branchId: z.string().optional().nullable(),
});

export async function GET(req: Request) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();

    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get("branchId") || session.branchId;
    const floorId = searchParams.get("floorId");
    const status = searchParams.get("status"); // "ACTIVE", "BILLED", "CLOSED", "all"

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
      return NextResponse.json({ error: "Branch context is required" }, { status: 400 });
    }

    const result = await openTableSession({
      businessId: session.businessId,
      branchId,
      tableId: parsed.tableId,
      guestCount: parsed.guestCount,
      openedById: session.userId,
      notes: parsed.notes,
    });

    return NextResponse.json(
      {
        success: true,
        message: `Session ${result.session.sessionNumber} opened on table ${result.table.tableNumber}`,
        session: result.session,
        table: result.table,
      },
      { status: 201 }
    );
  } catch (error: any) {
    if (error instanceof TableSessionError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Validation failed", details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: error.message || "Failed to open table session" },
      { status: 500 }
    );
  }
}
```

---

### 5.2 Route 2: `backend/src/app/api/v1/restaurant/sessions/[id]/route.ts`

```ts
import { NextResponse } from "next/server";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";
import {
  getTableSessionById,
  updateTableSession,
  TableSessionError,
} from "@/lib/services/table-session-service";
import { z } from "zod";

const updateSessionSchema = z.object({
  guestCount: z.coerce.number().int().min(1, "Guest count must be at least 1").optional(),
  notes: z.string().max(500).optional().nullable(),
  expectedVersion: z.coerce.number().int().optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();

    const { id } = await params;
    const tableSession = await getTableSessionById(session.businessId, id);

    return NextResponse.json({ session: tableSession });
  } catch (error: any) {
    if (error instanceof TableSessionError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { error: error.message || "Failed to fetch table session" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();

    const { id } = await params;
    const body = await req.json();
    const parsed = updateSessionSchema.parse(body);

    const updated = await updateTableSession({
      businessId: session.businessId,
      sessionId: id,
      guestCount: parsed.guestCount,
      notes: parsed.notes,
      expectedVersion: parsed.expectedVersion,
      actorId: session.userId,
    });

    return NextResponse.json({
      success: true,
      message: "Session updated successfully",
      session: updated,
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
      { error: error.message || "Failed to update table session" },
      { status: 500 }
    );
  }
}
```

---

### 5.3 Route 3: `backend/src/app/api/v1/restaurant/sessions/[id]/close/route.ts`

```ts
import { NextResponse } from "next/server";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";
import { closeTableSession, TableSessionError } from "@/lib/services/table-session-service";
import { z } from "zod";

const closeSessionSchema = z.object({
  notes: z.string().max(500).optional().nullable(),
  force: z.boolean().default(false),
  expectedVersion: z.coerce.number().int().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const parsed = closeSessionSchema.parse(body);

    const closed = await closeTableSession({
      businessId: session.businessId,
      sessionId: id,
      closedById: session.userId,
      notes: parsed.notes,
      force: parsed.force,
      expectedVersion: parsed.expectedVersion,
    });

    return NextResponse.json({
      success: true,
      message: `Session ${closed.sessionNumber} closed successfully. Table released to AVAILABLE.`,
      session: closed,
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
      { error: error.message || "Failed to close table session" },
      { status: 500 }
    );
  }
}
```

---

## 6. Concurrency, OCC & Race Condition Analysis

Hospitality point-of-sale environments feature multiple handheld terminals and cashier stations operating concurrently on shared tables and dining parties. This section details how the design guarantees safety.

### 6.1 Race Condition 1: Concurrent Double-Seating on the Same Table
- **Scenario**: Waiter Terminal A and Waiter Terminal B both tap table "T3" (which is `AVAILABLE`) at 12:00:01 and submit "Open Session".
- **Vulnerability in Naive Code**: Both read `table.status === "AVAILABLE"`. Both create a `TableSession`. Both update `RestaurantTable.currentSessionId = session.id`. Terminal B overwrites Terminal A, leaving Terminal A's session orphaned in `ACTIVE` state with diners ordering against a lost session.
- **Engineered OCC / CAS Resolution**:
  Step 6 of `openTableSession` uses conditional Compare-And-Swap:
  ```ts
  const tableUpdate = await tx.restaurantTable.updateMany({
    where: {
      id: input.tableId,
      businessId: input.businessId,
      status: "AVAILABLE",
      currentSessionId: null,
    },
    data: {
      status: "OCCUPIED",
      currentSessionId: session.id,
    },
  });
  if (tableUpdate.count === 0) {
    throw new TableSessionError("Table was occupied by a concurrent request", 409);
  }
  ```
  PostgreSQL acquires row-level exclusive locks during the update. Exactly one terminal succeeds (`count === 1`). The other terminal receives `count === 0` and rolls back with HTTP 409 Conflict. Furthermore, under `Serializable` transaction isolation, serialization anomalies are completely rejected.

### 6.2 Race Condition 2: Concurrent Session Closures
- **Scenario**: Cashier 1 closes Session S1 at the POS counter while Cashier 2 simultaneously closes Session S1 on a tablet.
- **Engineered OCC Resolution**:
  `closeTableSession` checks `expectedVersion`:
  ```ts
  const sessionUpdate = await tx.tableSession.updateMany({
    where: {
      id: session.id,
      businessId: input.businessId,
      version: input.expectedVersion ?? session.version,
      status: { in: ["ACTIVE", "BILLED"] },
    },
    data: {
      status: "CLOSED",
      version: { increment: 1 },
      closedAt: new Date(),
    },
  });
  if (sessionUpdate.count === 0) {
    throw new TableSessionError("Concurrent modification detected on session", 409);
  }
  ```
  The first cashier successfully increments version `1 -> 2` and sets status `CLOSED`. The second cashier sees `count === 0` because status is no longer in `["ACTIVE", "BILLED"]` (and version changed to 2), immediately returning HTTP 409 Conflict.

### 6.3 Race Condition 3: Submitting Order Round While Session Is Closing
- **Scenario**: Waiter submits Round 2 for Table T1 while Cashier clicks "Close Table".
- **Resolution**:
  `restaurant-order-service.ts` verifies `session.status IN ("ACTIVE", "BILLED")` inside transaction. If session closure commits first, order submission fails closed with `Cannot add order to session with status: CLOSED` (HTTP 400/409). If order submission commits first, session closure checks unsettled orders, detects the newly added unpaid round, and fails closed with `Cannot close session: 1 order(s) remain unsettled` (HTTP 400).

---

## 7. Discrepancy & Defect Audit of Existing Codebase

During investigation of `backend/src/lib/services/table-session-service.ts`, the following 7 defects were identified and cataloged:

| # | Existing Code Location | Defect Description | Required Remediation | Severity |
|---|---|---|---|---|
| **D1** | Lines 50–56 | Random non-monotonic session number: `generateSessionNumber()` uses `TS-YYYYMMDD-HHMMSS-RAND`. | Replace with transactional `generateMonotonicSessionNumber(tx, businessId, branchId)` formatting as `SESS-YYYYMMDD-XXXX`. | HIGH |
| **D2** | Lines 81–83 | `table.status === "OCCUPIED" \|\| table.status === "BILLED"` allows opening sessions on `RESERVED` tables without check. | Enforce strict `if (table.status !== "AVAILABLE") throw 409`. | MEDIUM |
| **D3** | Lines 119–125 | `tx.restaurantTable.update` without CAS condition allows concurrent double-seating. | Replace with `tx.restaurantTable.updateMany({ where: { id, status: "AVAILABLE", currentSessionId: null } })` checking `count === 1`. | HIGH |
| **D4** | Lines 397–404 | Order settlement filter: `orders.filter(o => o.settlementStatus !== "PAID" && o.settlementStatus !== "REFUNDED")` blocks closure on voided orders (`CANCELLED`/`REJECTED`). | Exempt voided orders: `isVoided = o.acceptanceStatus === "REJECTED" \|\| o.fulfillmentStatus === "CANCELLED"`. | HIGH |
| **D5** | Line 421 | Uses `status: "COMPLETED"` instead of `"CLOSED"`. | Set `status: "CLOSED"` per Milestone M2 state machine specification. | HIGH |
| **D6** | Line 420 | `TableSession.version` is never checked or incremented on closure or update. | Implement `expectedVersion` check and `version: { increment: 1 }`. | HIGH |
| **D7** | Missing Routes | `backend/src/app/api/v1/restaurant/sessions/*` routes do not exist. | Create routes for `sessions/route.ts`, `sessions/[id]/route.ts`, and `sessions/[id]/close/route.ts`. | CRITICAL |

---

## 8. Test Verification Strategies

### 8.1 Concurrency & OCC Integration Test (`tests/restaurant-concurrency.integration.test.ts`)
1. **Concurrent Session Openings (Double-Seating Guard)**:
   - Create Table T1 (`status: "AVAILABLE"`).
   - Launch two concurrent asynchronous calls to `openTableSession` on Table T1 via `Promise.allSettled`.
   - **Assertion**: Exactly ONE call succeeds (status 201, `TableSession` created, table `OCCUPIED`). Exactly ONE call fails with HTTP 409 Conflict (`Table is no longer available`).
   - Witness: Only 1 active session exists for Table T1 in DB.
2. **Concurrent Session Closures (OCC Guard)**:
   - Create Table T1 with active session S1 (`version: 1`).
   - Launch two concurrent calls to `closeTableSession(S1, expectedVersion: 1)`.
   - **Assertion**: Exactly ONE call succeeds (status 200, `version: 2`, status `CLOSED`, table `AVAILABLE`). Exactly ONE call fails with HTTP 409 Conflict.
3. **Stale Version Mutation**:
   - Call `updateTableSession(S1, expectedVersion: 1, guestCount: 5)`.
   - Call `updateTableSession(S1, expectedVersion: 1, guestCount: 8)` with stale version 1.
   - **Assertion**: Fails with 409 Conflict (`Session version mismatch`).

### 8.2 Invariant Integration Test (`tests/restaurant-invariants.integration.test.ts`)
1. **Unsettled Order Prevents Close**:
   - Open session S1.
   - Add `RestaurantOrder` with `settlementStatus: "UNPAID"`.
   - Attempt `closeTableSession(S1)`.
   - **Assertion**: Fails with HTTP 400 Bad Request (`Cannot close session: 1 order(s) remain unsettled`). Table remains `OCCUPIED`.
2. **Voided Order Exception**:
   - Open session S2.
   - Add `RestaurantOrder` with `settlementStatus: "UNPAID"` and `acceptanceStatus: "REJECTED"`.
   - Attempt `closeTableSession(S2)`.
   - **Assertion**: Succeeds! Session transitions to `CLOSED`, table released to `AVAILABLE`.
3. **Kitchen Food In-Flight Guard**:
   - Open session S3.
   - Add order with `settlementStatus: "PAID"`, but line in `fulfillmentStatus: "PREPARING"`.
   - Attempt `closeTableSession(S3, force: false)`.
   - **Assertion**: Fails with HTTP 400 (`1 item(s) are actively preparing in the kitchen`).
   - Attempt `closeTableSession(S3, force: true)`.
   - **Assertion**: Succeeds with force override.
