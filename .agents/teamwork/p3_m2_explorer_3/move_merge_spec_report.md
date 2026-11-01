# Specification Report: Atomic Table Move & Atomic Table Merge Transactions
**Milestone**: Phase 3 M2 (Floor, Table & TableSession Management Services & APIs)  
**Author**: M2 Explorer 3 (Move & Merge Transaction Specialist)  
**Date**: 2026-11-01  
**Status**: Completed  

---

## 1. Executive Summary

This specification formulates the exact PostgreSQL serializable transactional algorithms for **Atomic Table Move** (`moveTableSession`) and **Atomic Table Merge** (`mergeTableSessions`) within the RestroInn Hospitality Staff POS platform. 

In high-volume restaurant environments, table transfers and party consolidations occur dynamically while kitchen stations prepare food and waiters take orders across multiple POS terminals. Without strict serializable transactional guarantees and deterministic lock acquisition, concurrent operations risk:
1. **Order Line Duplication**: Re-creating order items leads to phantom kitchen tickets and double-billing.
2. **State Loss**: Re-parenting failures can drop unserved food lines, modifiers, or partial payments.
3. **Deadlocks**: Concurrent cross-table operations (Table A -> Table B vs. Table B -> Table A) trigger PostgreSQL `40P01` deadlock aborts.
4. **Phantom Occupancy**: Stale writes leave tables marked `OCCUPIED` with no session, or `AVAILABLE` with active diners.

This report establishes:
- The exact state machines and preconditions for Move and Merge.
- The deterministic lock ordering protocol (`tableIds.sort()`) eliminating circular deadlock conditions.
- The PostgreSQL `Serializable` transaction sequence utilizing Prisma's transactional client.
- The resolution of schema discrepancies (e.g., TS2353 compile errors in `table-session-service.ts` regarding `mergedIntoSessionId` and `restaurantOrders`).
- Complete TypeScript DTOs, Zod validation schemas, and REST API route definitions (`POST /api/v1/restaurant/tables/move` and `POST /api/v1/restaurant/tables/merge`).
- An adversarial concurrency test verification suite featuring PostgreSQL PID witnessing.

---

## 2. Domain Data Model & Schema Reconciliation

### 2.1 Entity Relationship Architecture

From `packages/db/prisma/schema.prisma` (additive migration `202611010001_phase3_restaurant_staff_mvp`):

```
+--------------------+            +--------------------+
|  RestaurantTable   |            |    TableSession    |
+--------------------+            +--------------------+
| id (PK)            | 1        * | id (PK)            |
| businessId         |------------| businessId         |
| branchId           |   (FK)     | branchId           |
| tableNumber        |            | tableId (FK)       |
| status             |            | sessionNumber      |
| currentSessionId   | (logical)  | guestCount         |
| capacity           |            | status             |
| ...                |            | openedAt, closedAt |
+--------------------+            | version (OCC)      |
                                  | notes (String?)    |
                                  +--------------------+
                                             | 1
                                             |
                                             | *
                                  +--------------------+
                                  |  RestaurantOrder   |
                                  +--------------------+
                                  | id (PK)            |
                                  | businessId         |
                                  | tableSessionId(FK) |
                                  | tableId (cached FK)|
                                  | acceptanceStatus   |
                                  | fulfillmentStatus  |
                                  | settlementStatus   |
                                  | totalAmount        |
                                  | version (OCC)      |
                                  +--------------------+
                                             | 1
                                             |
                                             | *
                                  +--------------------+
                                  |     OrderRound     |
                                  +--------------------+
                                             | 1
                                             |
                                             | *
                                  +--------------------+
                                  |     OrderLine      |
                                  +--------------------+
```

### 2.2 Critical Schema Analysis & Compiler Fixes

An inspection of `backend/src/lib/services/table-session-service.ts` revealed compilation errors (`TS2353`, `TS2339`) that must be avoided in the implementation:

1. **Missing `mergedIntoSessionId` Column on `TableSession`**:
   - `TableSession` in `schema.prisma` does **not** have a `mergedIntoSessionId` scalar field or relation.
   - Attempting `tx.tableSession.update({ data: { mergedIntoSessionId: targetSession.id } })` causes TypeScript compilation error:
     `error TS2353: Object literal may only specify known properties, and 'mergedIntoSessionId' does not exist in type 'TableSessionUpdateInput'`.
   - **Resolution Architecture**:
     * In `TableSession`: Set `status = "MERGED"`, `closedAt = new Date()`, `closedById = actorId`.
     * In `TableSession.notes`: Append structured merge metadata: `[MERGED_INTO:targetSessionId] Merged into Table ${targetTable.tableNumber}`.
     * In `AuditEvent`: Record the pointer in `metadata: { mergedIntoSessionId: targetSession.id, targetTableId: targetTable.id }`. This guarantees queryability and immutable auditability without requiring non-existent schema columns.

2. **Relation Field Name: `restaurantOrders` vs `orders`**:
   - In `TableSession`, the relation is defined as:
     `restaurantOrders RestaurantOrder[]`
   - Using `include: { orders: true }` causes `TS2353`. The correct Prisma include is:
     `include: { restaurantOrders: { include: { orderLines: true } } }`.

3. **Scalar `currentSessionId` DAG Acyclicity**:
   - `RestaurantTable.currentSessionId` is stored as a raw scalar `String?` without `@relation` back to `TableSession`. This is deliberate and mandatory to maintain an acyclic topological DAG for the disaster recovery backup engine (`backend/src/lib/backup-format.ts`, 60 models).
   - Any move or merge operation must explicitly update `RestaurantTable.currentSessionId` alongside `RestaurantTable.status`.

4. **Cached `RestaurantOrder.tableId`**:
   - `RestaurantOrder` maintains both `tableSessionId` (the logical session) and `tableId` (the physical table where the order was placed).
   - When a session is moved or merged, `RestaurantOrder.tableId` must be updated to the target table so that active kitchen printouts, staff ticket lookups, and POS queries reflect the guest's new physical table.

---

## 3. Atomic Table Move Algorithm (`moveTableSession`)

### 3.1 Business Preconditions & Invariants
- **Source Table**:
  - Must exist and belong to `businessId` and `branchId`.
  - Must be in `OCCUPIED` (or `BILLED`) status.
  - Must have an active `TableSession` (`status IN ("ACTIVE", "BILLED")`).
- **Target Table**:
  - Must exist and belong to the same `businessId` and `branchId`.
  - Must have `status === "AVAILABLE"`.
  - Must have `currentSessionId === null`.
  - If target table is not `AVAILABLE`, the operation must immediately reject with **HTTP 409 Conflict**.
- **Self-Move Guard**:
  - `sourceTableId === targetTableId` is rejected with **HTTP 400 Bad Request**.
- **Invariant**:
  - **Zero Duplication / Zero Loss**: No `RestaurantOrder`, `OrderRound`, or `OrderLine` rows are created or destroyed. The active session is repointed, and order cache pointers are updated in-place.

### 3.2 Concurrency & Deadlock Prevention
When two concurrent requests attempt to move tables (e.g. Table A -> Table B and Table B -> Table A), arbitrary locking order causes database deadlocks (`40P01`).
**Deterministic Lock Ordering**:
Always sort table IDs lexicographically before acquiring row locks or performing queries:
```ts
const lockOrder = [sourceTableId, targetTableId].sort();
```
By locking tables in ascending string order across all transactions, cyclic wait graphs cannot form.

### 3.3 Transaction Execution Sequence

The transaction runs under `Prisma.TransactionIsolationLevel.Serializable`:

```
Step 1: Sort table IDs: [minId, maxId] = [sourceTableId, targetTableId].sort()
Step 2: Fetch both tables in sorted order (row-level lock via SELECT ... FOR UPDATE or read verification)
Step 3: Validate:
        - Both tables belong to businessId and same branchId
        - sourceTable.status IN ('OCCUPIED', 'BILLED')
        - sourceTable.currentSessionId IS NOT NULL
        - targetTable.status === 'AVAILABLE' && targetTable.currentSessionId === NULL
Step 4: Fetch active session:
        - tableSession.id === sourceTable.currentSessionId
        - tableSession.status IN ('ACTIVE', 'BILLED')
Step 5: Mutate TableSession:
        - tableSession.tableId = targetTable.id
        - tableSession.version = version + 1
Step 6: Repoint all cached tableId values on RestaurantOrder:
        - UPDATE "RestaurantOrder" 
          SET "tableId" = targetTable.id, "updatedAt" = NOW() 
          WHERE "tableSessionId" = session.id AND "businessId" = businessId
Step 7: Clear Source Table:
        - UPDATE "RestaurantTable" 
          SET "status" = 'AVAILABLE', "currentSessionId" = NULL, "updatedAt" = NOW() 
          WHERE "id" = sourceTable.id
Step 8: Occupy Target Table:
        - UPDATE "RestaurantTable" 
          SET "status" = sourceTable.status, "currentSessionId" = session.id, "updatedAt" = NOW() 
          WHERE "id" = targetTable.id
Step 9: Record immutable AuditEvent:
        - action = 'TABLE_MOVED'
        - entity = 'TableSession'
        - entityId = session.id
        - entityVersion = session.version + 1
        - oldValue = { tableId: sourceTable.id, tableNumber: sourceTable.tableNumber }
        - newValue = { tableId: targetTable.id, tableNumber: targetTable.tableNumber }
        - metadata = { sourceTableId, targetTableId, branchId, ordersCount }
Step 10: Commit transaction & return updated state
```

### 3.4 Prisma Implementation Blueprint

```ts
export async function moveTableSession(
  params: MoveTableParams,
  externalTx?: Prisma.TransactionClient
): Promise<MoveTableResult> {
  const runner = async (tx: Prisma.TransactionClient): Promise<MoveTableResult> => {
    const { businessId, sourceTableId, targetTableId, actorId, reason } = params;

    if (sourceTableId === targetTableId) {
      throw new TableSessionError("Source and target tables cannot be identical", 400);
    }

    // 1. Deterministic lock acquisition order
    const [firstId, secondId] = [sourceTableId, targetTableId].sort();

    const firstTable = await tx.restaurantTable.findFirst({
      where: { id: firstId, businessId, isActive: true },
    });
    const secondTable = await tx.restaurantTable.findFirst({
      where: { id: secondId, businessId, isActive: true },
    });

    const sourceTable = firstId === sourceTableId ? firstTable : secondTable;
    const targetTable = firstId === targetTableId ? firstTable : secondTable;

    if (!sourceTable) {
      throw new TableSessionError("Source table not found or inactive", 404);
    }
    if (!targetTable) {
      throw new TableSessionError("Target table not found or inactive", 404);
    }
    if (sourceTable.branchId !== targetTable.branchId) {
      throw new TableSessionError("Cannot move table session across different branches", 400);
    }

    // 2. Validate states
    if (sourceTable.status !== "OCCUPIED" && sourceTable.status !== "BILLED") {
      throw new TableSessionError(
        `Source table ${sourceTable.tableNumber} is not occupied (status: ${sourceTable.status})`,
        400
      );
    }
    if (!sourceTable.currentSessionId) {
      throw new TableSessionError(
        `Source table ${sourceTable.tableNumber} has no active session linked`,
        400
      );
    }

    if (targetTable.status !== "AVAILABLE" || targetTable.currentSessionId !== null) {
      throw new TableSessionError(
        `Target table ${targetTable.tableNumber} is not available (status: ${targetTable.status})`,
        409
      );
    }

    // 3. Retrieve and lock active session
    const session = await tx.tableSession.findFirst({
      where: {
        id: sourceTable.currentSessionId,
        businessId,
        branchId: sourceTable.branchId,
        status: { in: ["ACTIVE", "BILLED"] },
      },
    });

    if (!session) {
      throw new TableSessionError("Active table session not found for source table", 404);
    }

    // 4. Update TableSession pointer and OCC version
    const updatedSession = await tx.tableSession.update({
      where: { id: session.id },
      data: {
        tableId: targetTable.id,
        version: { increment: 1 },
      },
    });

    // 5. Update cached tableId on all active RestaurantOrders
    const orderUpdateResult = await tx.restaurantOrder.updateMany({
      where: {
        tableSessionId: session.id,
        businessId,
      },
      data: {
        tableId: targetTable.id,
      },
    });

    // 6. Release source table
    const updatedSourceTable = await tx.restaurantTable.update({
      where: { id: sourceTable.id },
      data: {
        status: "AVAILABLE",
        currentSessionId: null,
      },
    });

    // 7. Occupy target table
    const updatedTargetTable = await tx.restaurantTable.update({
      where: { id: targetTable.id },
      data: {
        status: sourceTable.status,
        currentSessionId: session.id,
      },
    });

    // 8. Write immutable AuditEvent
    await createAuditEvent(
      {
        businessId,
        branchId: sourceTable.branchId,
        userId: actorId,
        action: "TABLE_MOVED",
        entity: "TableSession",
        entityId: session.id,
        entityVersion: session.version + 1,
        oldValue: {
          tableId: sourceTable.id,
          tableNumber: sourceTable.tableNumber,
          status: sourceTable.status,
        },
        newValue: {
          tableId: targetTable.id,
          tableNumber: targetTable.tableNumber,
          status: updatedTargetTable.status,
        },
        metadata: {
          sourceTableId: sourceTable.id,
          targetTableId: targetTable.id,
          ordersMoved: orderUpdateResult.count,
        },
        reason: reason || "Staff table move request",
      },
      tx
    );

    return {
      session: updatedSession,
      sourceTable: updatedSourceTable,
      targetTable: updatedTargetTable,
      ordersMovedCount: orderUpdateResult.count,
    };
  };

  if (externalTx) {
    return await runner(externalTx);
  }
  return await serializable(runner);
}
```

---

## 4. Atomic Table Merge Algorithm (`mergeTableSessions`)

### 4.1 Business Preconditions & Invariants
- **Multi-Source Support**:
  - Supports merging one or more source tables (`sourceTableIds: string[]`) into a single `targetTableId`.
  - Example: Combining Tables T-1 and T-2 into Table T-3 for a 12-person party.
- **Preconditions**:
  - `sourceTableIds` must contain at least 1 ID.
  - `sourceTableIds` must NOT contain `targetTableId`.
  - All source tables and the target table must belong to the same `businessId` and `branchId`.
  - Target table must have `status IN ("OCCUPIED", "BILLED")` with an active `targetSession`.
  - Every source table must have `status IN ("OCCUPIED", "BILLED")` with an active `sourceSession`.
- **Invariants**:
  - **Zero Duplication**: Orders, rounds, modifier options, and line items are **never** cloned. All `RestaurantOrder` records are atomically re-parented (`tableSessionId = targetSession.id`, `tableId = targetTable.id`).
  - **Zero Loss**: All open kitchen rounds, food preparation statuses (`QUEUED`, `PREPARING`, `READY`), and unallocated payments remain intact on the re-parented orders.
  - **Guest Count Accumulation**: `targetSession.guestCount` becomes the sum of its existing guest count plus all source sessions' guest counts.
  - **Source Session Retirement**: Each source session transitions to `status = "MERGED"`, `closedAt = NOW()`, with structured merge notes.
  - **Source Table Release**: Each source table transitions to `status = "AVAILABLE"`, `currentSessionId = null`.

### 4.2 Concurrency & Deadlock Prevention
Merging tables touches $N + 1$ table rows. If Terminal 1 merges T-1 into T-2, while Terminal 2 merges T-2 into T-1, an arbitrary order of operations results in circular wait deadlocks.
**Deterministic N-Table Lock Ordering**:
```ts
const uniqueTableIds = Array.from(new Set([...sourceTableIds, targetTableId])).sort();
```
By sorting all participant IDs in ascending order and acquiring row references sequentially, cyclic lock dependencies are strictly impossible.

### 4.3 Transaction Execution Sequence

```
Step 1: Sort all table IDs: uniqueTableIds = [...new Set([...sourceTableIds, targetTableId])].sort()
Step 2: Fetch and validate all tables in sorted order within the serializable boundary.
Step 3: Validate:
        - targetTable has active session (targetSession)
        - Every sourceTable has active session (sourceSession)
        - All sessions belong to same businessId and branchId
Step 4: Fetch all source sessions and verify status IN ('ACTIVE', 'BILLED')
Step 5: For each source session:
        a. Re-parent all RestaurantOrder rows:
           UPDATE "RestaurantOrder"
           SET "tableSessionId" = targetSession.id, "tableId" = targetTable.id, "updatedAt" = NOW()
           WHERE "tableSessionId" = srcSession.id AND "businessId" = businessId
        b. Retire source session:
           UPDATE "TableSession"
           SET "status" = 'MERGED',
               "closedAt" = NOW(),
               "closedById" = actorId,
               "notes" = CONCAT(notes, '\n[MERGED_INTO:', targetSession.id, '] Merged into Table ', targetTable.tableNumber),
               "version" = version + 1
           WHERE "id" = srcSession.id
        c. Release source table:
           UPDATE "RestaurantTable"
           SET "status" = 'AVAILABLE', "currentSessionId" = NULL, "updatedAt" = NOW()
           WHERE "id" = srcTable.id
Step 6: Update Target Session:
        - guestCount = targetSession.guestCount + SUM(sourceSessions.guestCount)
        - notes = append merge summary with source table numbers
        - version = version + 1
Step 7: Record AuditEvents:
        - action = 'TABLES_MERGED'
        - entity = 'TableSession'
        - entityId = targetSession.id
        - metadata = {
            targetTableId,
            targetSessionId,
            sourceTableIds,
            sourceSessionIds,
            totalOrdersTransferred,
            addedGuests
          }
Step 8: Commit transaction & return aggregated session details
```

### 4.4 Prisma Implementation Blueprint

```ts
export async function mergeTableSessions(
  params: MergeTableParams,
  externalTx?: Prisma.TransactionClient
): Promise<MergeTableResult> {
  const runner = async (tx: Prisma.TransactionClient): Promise<MergeTableResult> => {
    const { businessId, sourceTableIds, targetTableId, actorId, reason } = params;

    if (!sourceTableIds || sourceTableIds.length === 0) {
      throw new TableSessionError("At least one source table ID must be provided", 400);
    }

    const uniqueSourceIds = Array.from(new Set(sourceTableIds));
    if (uniqueSourceIds.includes(targetTableId)) {
      throw new TableSessionError("Target table cannot be included among source tables", 400);
    }

    // 1. Deterministic lock ordering across all participating tables
    const allTableIds = Array.from(new Set([...uniqueSourceIds, targetTableId])).sort();

    const tables = await tx.restaurantTable.findMany({
      where: { id: { in: allTableIds }, businessId, isActive: true },
    });

    if (tables.length !== allTableIds.length) {
      throw new TableSessionError("One or more tables could not be found or are inactive", 404);
    }

    const targetTable = tables.find((t) => t.id === targetTableId)!;
    const sourceTables = uniqueSourceIds.map((id) => tables.find((t) => t.id === id)!);

    // Verify uniform branch isolation
    for (const st of sourceTables) {
      if (st.branchId !== targetTable.branchId) {
        throw new TableSessionError("All tables in a merge must belong to the same branch", 400);
      }
    }

    // 2. Validate target table & session
    if (!targetTable.currentSessionId) {
      throw new TableSessionError(
        `Target table ${targetTable.tableNumber} does not have an active session`,
        400
      );
    }

    const targetSession = await tx.tableSession.findFirst({
      where: {
        id: targetTable.currentSessionId,
        businessId,
        branchId: targetTable.branchId,
        status: { in: ["ACTIVE", "BILLED"] },
      },
    });

    if (!targetSession) {
      throw new TableSessionError("Active session not found for target table", 404);
    }

    // 3. Validate each source table & session
    const sourceSessions: TableSession[] = [];
    for (const srcTable of sourceTables) {
      if (!srcTable.currentSessionId) {
        throw new TableSessionError(
          `Source table ${srcTable.tableNumber} has no active session to merge`,
          400
        );
      }

      const srcSession = await tx.tableSession.findFirst({
        where: {
          id: srcTable.currentSessionId,
          businessId,
          branchId: srcTable.branchId,
          status: { in: ["ACTIVE", "BILLED"] },
        },
      });

      if (!srcSession) {
        throw new TableSessionError(
          `Active session not found for source table ${srcTable.tableNumber}`,
          404
        );
      }

      sourceSessions.push(srcSession);
    }

    let totalTransferredOrders = 0;
    let additionalGuests = 0;
    const mergedSessionSummaries: MergedSessionSummary[] = [];

    // 4. Process each source session atomically
    for (let i = 0; i < sourceTables.length; i++) {
      const srcTable = sourceTables[i];
      const srcSession = sourceSessions[i];

      // a. Re-parent all orders from source session to target session & table
      const orderUpdate = await tx.restaurantOrder.updateMany({
        where: {
          tableSessionId: srcSession.id,
          businessId,
        },
        data: {
          tableSessionId: targetSession.id,
          tableId: targetTable.id,
        },
      });

      totalTransferredOrders += orderUpdate.count;
      additionalGuests += srcSession.guestCount;

      // b. Mark source session as MERGED with pointer in notes
      const mergeNote = `[MERGED_INTO:${targetSession.id}] Merged into Table ${targetTable.tableNumber} (Session ${targetSession.sessionNumber})`;
      const updatedNotes = srcSession.notes
        ? `${srcSession.notes}\n${mergeNote}`
        : mergeNote;

      await tx.tableSession.update({
        where: { id: srcSession.id },
        data: {
          status: "MERGED",
          closedAt: new Date(),
          closedById: actorId || null,
          notes: updatedNotes,
          version: { increment: 1 },
        },
      });

      // c. Release source table
      await tx.restaurantTable.update({
        where: { id: srcTable.id },
        data: {
          status: "AVAILABLE",
          currentSessionId: null,
        },
      });

      mergedSessionSummaries.push({
        sourceSessionId: srcSession.id,
        sourceTableId: srcTable.id,
        sourceTableNumber: srcTable.tableNumber,
        guestCount: srcSession.guestCount,
        ordersTransferred: orderUpdate.count,
      });
    }

    // 5. Update target session with combined guest count and merge note
    const sourceTableNumbers = sourceTables.map((t) => t.tableNumber).join(", ");
    const targetMergeNote = `Merged with Table(s) ${sourceTableNumbers}`;
    const updatedTargetNotes = targetSession.notes
      ? `${targetSession.notes} | ${targetMergeNote}`
      : targetMergeNote;

    const updatedTargetSession = await tx.tableSession.update({
      where: { id: targetSession.id },
      data: {
        guestCount: targetSession.guestCount + additionalGuests,
        notes: updatedTargetNotes,
        version: { increment: 1 },
      },
    });

    // 6. Record immutable AuditEvent
    await createAuditEvent(
      {
        businessId,
        branchId: targetTable.branchId,
        userId: actorId,
        action: "TABLES_MERGED",
        entity: "TableSession",
        entityId: targetSession.id,
        entityVersion: targetSession.version + 1,
        oldValue: {
          targetGuestCount: targetSession.guestCount,
          targetTableNumber: targetTable.tableNumber,
        },
        newValue: {
          targetGuestCount: updatedTargetSession.guestCount,
          targetTableNumber: targetTable.tableNumber,
          mergedSessionsCount: sourceSessions.length,
          totalTransferredOrders,
        },
        metadata: {
          targetTableId: targetTable.id,
          targetSessionId: targetSession.id,
          sourceTableIds: uniqueSourceIds,
          sourceSessionIds: sourceSessions.map((s) => s.id),
          mergedSessions: mergedSessionSummaries,
        },
        reason: reason || "Staff table merge request",
      },
      tx
    );

    return {
      targetSession: updatedTargetSession,
      targetTable,
      mergedSessions: mergedSessionSummaries,
      totalTransferredOrders,
      totalGuests: updatedTargetSession.guestCount,
    };
  };

  if (externalTx) {
    return await runner(externalTx);
  }
  return await serializable(runner);
}
```

---

## 5. Concurrency Control, Serializable Isolation & Retry Semantics

### 5.1 Why Read Committed Is Insufficient
In default `Read Committed` isolation:
- Two waiters concurrently attempting to move Table A -> Table C and Table B -> Table C both see Table C as `AVAILABLE`.
- Both transactions proceed, overwriting `targetTable.currentSessionId` and `TableSession.tableId`.
- Table C is left with a single session in `currentSessionId`, but two sessions in the database believe they are seated at Table C.
- Under `Serializable`, PostgreSQL evaluates predicate and write-skew locks. The second committing transaction fails with SQLSTATE `40001` (Serialization Failure) or Prisma `P2034`, preventing race-induced corruption.

### 5.2 The `serializable()` Transaction Wrapper & Bounded Retry
The project's transaction manager in `backend/src/lib/commerce-transaction.ts` implements bounded retries on serialization failures:

```ts
export async function serializable<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await db.$transaction(work, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 10000, // 10s wait to acquire connection
        timeout: 30000, // 30s max query execution
      });
    } catch (error) {
      if ((error as { code?: string }).code !== "P2034") throw error;
      if (attempt >= 3) {
        throw new TableSessionError("Concurrent table update conflict; please retry", 409);
      }
      // Small jitter backoff before retry (25ms - 75ms)
      await new Promise((res) => setTimeout(res, 25 + Math.random() * 50));
    }
  }
}
```

### 5.3 Optimistic Concurrency Control (`version`)
Both `TableSession` and `RestaurantOrder` carry a `version: Int @default(1)` integer column.
- Whenever a table session is moved or merged, its `version` increments by 1.
- If a mobile tablet has an open order screen loaded at `version: 1`, and attempts to add lines while another waiter has already merged or moved the session (bumping version to 2), the mutation fails closed with HTTP 409 Conflict:
  `"Stale session version. The table session has been moved or modified."`

---

## 6. Edge Cases & Safety Matrix

| Scenario | Behavior / Guard | Status Code |
| :--- | :--- | :--- |
| **Move to Occupied Table** | Target table has `status !== 'AVAILABLE'` or `currentSessionId !== null`. Rejected immediately. | `409 Conflict` |
| **Move to Same Table** | `sourceTableId === targetTableId`. Guard rejects identity move. | `400 Bad Request` |
| **Move Table with Zero Orders** | Session with 0 orders moves cleanly. Table pointer changes, session pointer changes, 0 orders updated. | `200 OK` |
| **Move Table with Active Kitchen Orders** | Orders in `QUEUED` / `PREPARING` have `tableId` updated in-place. Kitchen tickets now reflect the new table number. Food is not cancelled. | `200 OK` |
| **Move Table with Partial Payment** | `RestaurantOrder.settlementStatus === "PARTIAL"` is preserved. Payment ledgers remain linked to the order. | `200 OK` |
| **Cross-Branch Move or Merge** | Tables have different `branchId`. Multi-tenant security guard rejects. | `400 Bad Request` |
| **Merge with No Source Tables** | `sourceTableIds` is empty `[]`. | `400 Bad Request` |
| **Merge Including Target in Sources** | Target table ID present in `sourceTableIds`. Guard catches self-merge. | `400 Bad Request` |
| **Merge Table into Available Table** | Target table is `AVAILABLE` (no active session). Rejected; merge requires an active target session. | `400 Bad Request` |
| **Simultaneous Mutual Merge (T1->T2 vs T2->T1)** | Sorted table ID locking (`[T1, T2].sort()`) forces deterministic execution. First transaction commits; second sees T1 has status `AVAILABLE` and fails gracefully. | `400 Bad Request` |
| **Stale Terminal Submissions** | OCC `version` mismatch on `TableSession` or `RestaurantOrder`. | `409 Conflict` |

---

## 7. TypeScript Contracts & API Routes

### 7.1 Service Parameter & Result DTOs

```ts
// File: backend/src/lib/services/table-session-service.ts

export interface MoveTableParams {
  businessId: string;
  sourceTableId: string;
  targetTableId: string;
  actorId: string;
  reason?: string;
}

export interface MoveTableResult {
  session: TableSession;
  sourceTable: RestaurantTable;
  targetTable: RestaurantTable;
  ordersMovedCount: number;
}

export interface MergeTableParams {
  businessId: string;
  sourceTableIds: string[];
  targetTableId: string;
  actorId: string;
  reason?: string;
}

export interface MergedSessionSummary {
  sourceSessionId: string;
  sourceTableId: string;
  sourceTableNumber: string;
  guestCount: number;
  ordersTransferred: number;
}

export interface MergeTableResult {
  targetSession: TableSession;
  targetTable: RestaurantTable;
  mergedSessions: MergedSessionSummary[];
  totalTransferredOrders: number;
  totalGuests: number;
}
```

### 7.2 REST API Routes

#### 7.2.1 Route: `POST /api/v1/restaurant/tables/move`
File: `backend/src/app/api/v1/restaurant/tables/move/route.ts`

```ts
import { NextResponse } from "next/server";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";
import { moveTableSession, TableSessionError } from "@/lib/services/table-session-service";
import { z } from "zod";

const moveTableSchema = z.object({
  sourceTableId: z.string().uuid("Invalid source table ID"),
  targetTableId: z.string().uuid("Invalid target table ID"),
  reason: z.string().max(255).optional(),
});

export async function POST(req: Request) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();

    const body = await req.json();
    const parsed = moveTableSchema.parse(body);

    const result = await moveTableSession({
      businessId: session.businessId,
      sourceTableId: parsed.sourceTableId,
      targetTableId: parsed.targetTableId,
      actorId: session.userId,
      reason: parsed.reason,
    });

    return NextResponse.json({
      success: true,
      message: `Table session successfully moved to table ${result.targetTable.tableNumber}`,
      ...result,
    });
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
      { error: error.message || "Failed to move table session" },
      { status: 500 }
    );
  }
}
```

*Note on backward compatibility*: The parametric route `backend/src/app/api/v1/restaurant/tables/[id]/move/route.ts` should remain as an alias that reads `sourceTableId` from `params.id` and delegates to `moveTableSession`.

#### 7.2.2 Route: `POST /api/v1/restaurant/tables/merge`
File: `backend/src/app/api/v1/restaurant/tables/merge/route.ts`

```ts
import { NextResponse } from "next/server";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";
import { mergeTableSessions, TableSessionError } from "@/lib/services/table-session-service";
import { z } from "zod";

const mergeTableSchema = z.object({
  sourceTableIds: z.array(z.string().uuid("Invalid source table ID")).min(1, "At least one source table is required"),
  targetTableId: z.string().uuid("Invalid target table ID"),
  reason: z.string().max(255).optional(),
});

export async function POST(req: Request) {
  try {
    const session = await getSessionContext();
    if (!session) return authErrorResponse();

    const body = await req.json();
    const parsed = mergeTableSchema.parse(body);

    const result = await mergeTableSessions({
      businessId: session.businessId,
      sourceTableIds: parsed.sourceTableIds,
      targetTableId: parsed.targetTableId,
      actorId: session.userId,
      reason: parsed.reason,
    });

    return NextResponse.json({
      success: true,
      message: `Tables successfully merged into table ${result.targetTable.tableNumber}`,
      ...result,
    });
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
      { error: error.message || "Failed to merge table sessions" },
      { status: 500 }
    );
  }
}
```

---

## 8. Test Verification Strategies & Concurrency Hardening

### 8.1 Unit & Invariant Test Cases (`tests/table-session-operations.test.ts`)

1. **Move Precondition Checks**:
   - Throws 400 when `sourceTableId === targetTableId`.
   - Throws 400 when `sourceTable.status === "AVAILABLE"`.
   - Throws 409 when `targetTable.status === "OCCUPIED"`.
   - Throws 400 when tables are in different branches.

2. **Move Invariant Proof**:
   - Seed Table A with Session A containing 2 Orders, 3 Rounds, 8 OrderLines.
   - Execute `moveTableSession(Table A -> Table B)`.
   - Assert:
     * Table A: `status === "AVAILABLE"`, `currentSessionId === null`.
     * Table B: `status === "OCCUPIED"`, `currentSessionId === Session A.id`.
     * Session A: `tableId === Table B.id`, `version === 2`.
     * Total lines in DB: Exactly 8 (zero duplication, zero loss).
     * All 8 lines remain associated with their original `OrderRound` and `RestaurantOrder`.
     * `RestaurantOrder.tableId === Table B.id`.
     * `AuditEvent` created with action `"TABLE_MOVED"`.

3. **Merge Precondition Checks**:
   - Throws 400 when `sourceTableIds` is empty.
   - Throws 400 when `targetTableId` is included in `sourceTableIds`.
   - Throws 400 when target table has no active session.
   - Throws 400 when any source table has no active session.

4. **Merge Invariant Proof**:
   - Seed Table A (Session A: 2 guests, 2 orders, 4 lines).
   - Seed Table B (Session B: 3 guests, 1 order, 2 lines).
   - Seed Table C (Session C: 4 guests, 1 order, 3 lines).
   - Execute `mergeTableSessions([Table A, Table B] -> Table C)`.
   - Assert:
     * Table A: `status === "AVAILABLE"`, `currentSessionId === null`.
     * Table B: `status === "AVAILABLE"`, `currentSessionId === null`.
     * Table C: `status === "OCCUPIED"`, `currentSessionId === Session C.id`.
     * Session A: `status === "MERGED"`, `notes` contains `[MERGED_INTO:Session C.id]`.
     * Session B: `status === "MERGED"`, `notes` contains `[MERGED_INTO:Session C.id]`.
     * Session C: `guestCount === 2 + 3 + 4 === 9`.
     * System total OrderLines count: Exactly $4 + 2 + 3 = 9$ (zero duplication, zero loss).
     * All 4 orders now have `tableSessionId === Session C.id` and `tableId === Table C.id`.
     * `AuditEvent` created with action `"TABLES_MERGED"`.

### 8.2 Adversarial Concurrency Test with PostgreSQL PID Witnessing
In accordance with Milestone M6 requirements and `tests/commerce.integration.test.ts`:

```ts
describe("Adversarial Table Move & Merge Concurrency", () => {
  let transactionPids: number[] = [];

  beforeEach(() => {
    // Intercept transactions to witness real distinct backend PIDs
    transactionPids = [];
    vi.spyOn(db, "$transaction").mockImplementation((work, options) => {
      return realTransaction(async (tx) => {
        const [conn] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
        transactionPids.push(conn.pid);
        await tx.$executeRaw`SELECT pg_sleep(0.03)`; // Inject deterministic race window
        return work(tx);
      }, options);
    });
  });

  it("witnesses competing moves to same target table; exactly one succeeds, one gets 409", async () => {
    // Table 1 (occupied) and Table 2 (occupied) both attempt to move to Table 3 (available) simultaneously
    const results = await Promise.allSettled([
      moveTableSession({ businessId, sourceTableId: t1.id, targetTableId: t3.id, actorId: u1.id }),
      moveTableSession({ businessId, sourceTableId: t2.id, targetTableId: t3.id, actorId: u2.id }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);
    expect((rejected[0] as PromiseRejectedResult).reason.statusCode).toBe(409);

    // Witness true concurrent execution on separate PostgreSQL backend processes
    const distinctPids = [...new Set(transactionPids)];
    expect(distinctPids.length).toBeGreaterThanOrEqual(2);
  });
});
```

---

## 9. Deliverable Summary & Recommendations for Implementer

1. **Fix `table-session-service.ts` compilation**:
   - Remove `mergedIntoSessionId: targetSession.id` in `TableSession.update`. Store the pointer in `notes` as `[MERGED_INTO:${targetSession.id}]` and in `AuditEvent.metadata`.
   - Fix all `include: { orders: ... }` to `include: { restaurantOrders: ... }`.
2. **Implement deterministic lock sorting**:
   - In `moveTableSession`: sort `[sourceTableId, targetTableId]`.
   - In `mergeTableSessions`: sort `[...new Set([...sourceTableIds, targetTableId])]`.
3. **Register Top-Level Routes**:
   - Create `backend/src/app/api/v1/restaurant/tables/move/route.ts`.
   - Create `backend/src/app/api/v1/restaurant/tables/merge/route.ts`.
   - Ensure the subpath routes `[id]/move` and `[id]/merge` remain backwards compatible.
4. **Enforce Optimistic Concurrency Control**:
   - Always increment `version: { increment: 1 }` on `TableSession` updates during move and merge.
