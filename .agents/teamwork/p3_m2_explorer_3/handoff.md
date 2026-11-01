# Handoff Report: Atomic Table Move & Table Merge Transactions (Phase 3 Milestone M2)

**Agent**: M2 Explorer 3 (Move & Merge Transaction Specialist)  
**Date**: 2026-11-01  
**Target Milestone**: Phase 3 M2 (Floor, Table & TableSession Management Services & APIs)  
**Working Directory**: `c:\projects\pos\.agents\teamwork\p3_m2_explorer_3`  
**Primary Specification Report**: `c:\projects\pos\.agents\teamwork\p3_m2_explorer_3\move_merge_spec_report.md`  

---

## 1. Observation

1. **Database Schema & Columns (`packages/db/prisma/schema.prisma`)**:
   - `RestaurantTable` (lines 1133-1161):
     ```prisma
     model RestaurantTable {
       id               String            @id @default(uuid())
       businessId       String
       branchId         String
       floorId          String
       tableNumber      String
       capacity         Int               @default(4)
       status           String            @default("AVAILABLE") // AVAILABLE, OCCUPIED, RESERVED, BILLED
       currentSessionId String?           // Scalar logical ID without @relation to preserve DAG acyclicity
       ...
       tableSessions    TableSession[]
       restaurantOrders RestaurantOrder[]
     }
     ```
   - `TableSession` (lines 1163-1191):
     ```prisma
     model TableSession {
       id            String            @id @default(uuid())
       businessId    String
       branchId      String
       tableId       String
       sessionNumber String
       guestCount    Int               @default(1)
       status        String            @default("ACTIVE") // ACTIVE, BILLED, COMPLETED, CANCELLED
       openedAt      DateTime          @default(now())
       closedAt      DateTime?
       version       Int               @default(1) // OCC
       notes         String?
       restaurantOrders RestaurantOrder[]
     }
     ```
   - `TableSession` does **not** contain `mergedIntoSessionId` or `metadata` columns.
   - `AuditEvent` (lines 972-996): Contains `metadata Json?`, `oldValue Json?`, `newValue Json?`, `action String`, `entity String`.
   - `RestaurantOrder` (lines 1318-1360): Contains `tableSessionId String?`, `tableId String?`, `acceptanceStatus`, `fulfillmentStatus`, `settlementStatus`, `version Int @default(1)`.

2. **TypeScript Compilation Status (`npx tsc --noEmit -p backend/tsconfig.json`)**:
   - Verbatim compilation errors:
     * `backend/src/lib/services/table-session-service.ts(312,9): error TS2353: Object literal may only specify known properties, and 'mergedIntoSessionId' does not exist in type 'Without<TableSessionUpdateInput, TableSessionUncheckedUpdateInput> & TableSessionUncheckedUpdateInput'.`
     * `backend/src/lib/services/table-session-service.ts(379,9): error TS2353: Object literal may only specify known properties, and 'orders' does not exist in type 'TableSessionInclude<DefaultArgs>'.`
     * `backend/src/app/api/v1/restaurant/sessions/route.ts(31,9): error TS2353: Object literal may only specify known properties, and 'orders' does not exist in type 'TableSessionInclude<DefaultArgs>'.`

3. **Existing Transaction & Audit Primitives**:
   - `backend/src/lib/commerce-transaction.ts:19-28`:
     `serializable()` wrapper uses `db.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10000, timeout: 30000 })` and retries on Prisma conflict error `P2034` up to 3 attempts before raising HTTP 409 Conflict.
   - `backend/src/lib/audit-event.ts:49-72`:
     `createAuditEvent(input, tx)` accepts a transactional client `tx` to guarantee audit writes commit or roll back atomically with business mutations.

4. **Existing API Routes**:
   - `backend/src/app/api/v1/restaurant/tables/[id]/move/route.ts` exists (takes `sourceTableId` as `[id]` param and `{ targetTableId, reason }` in body).
   - `backend/src/app/api/v1/restaurant/tables/[id]/merge/route.ts` exists (takes single `sourceTableId` as `[id]` param and `{ targetTableId, reason }` in body).
   - `PROJECT.md` interface specifications require top-level endpoints: `POST /api/v1/restaurant/tables/move` and `POST /api/v1/restaurant/tables/merge` accepting `{ sourceTableIds: string[], targetTableId }`.

---

## 2. Logic Chain

1. **Schema Integrity & Compilation Fix** (From Observation 1 & 2):
   - Because `TableSession` lacks a `mergedIntoSessionId` column in `schema.prisma`, any code attempting `tx.tableSession.update({ data: { mergedIntoSessionId: ... } })` will fail typechecking.
   - Because M1 additive migration is frozen, adding a new migration is unnecessary and disruptive.
   - The correct pattern is to record the retirement status `status = "MERGED"`, store `[MERGED_INTO:${targetSession.id}] Merged into Table ${targetTable.tableNumber}` in `TableSession.notes`, and log the structured `{ mergedIntoSessionId: targetSession.id }` in `AuditEvent.metadata`.
   - In `TableSession`, the relation is named `restaurantOrders`, so all queries must use `include: { restaurantOrders: true }` instead of `include: { orders: true }`.

2. **Zero-Duplication Invariant for Move** (From Observation 1 & 3):
   - Moving Table A -> Table B must never recreate `RestaurantOrder`, `OrderRound`, or `OrderLine` records.
   - By executing `UPDATE "TableSession" SET "tableId" = targetTable.id WHERE id = session.id` and `UPDATE "RestaurantOrder" SET "tableId" = targetTable.id WHERE "tableSessionId" = session.id`, all order lines remain strictly intact.
   - In PostgreSQL `Serializable` mode, concurrent moves to the same target table are detected via write conflicts (`P2034`), ensuring that one succeeds while the other is rejected with 409 Conflict.

3. **Deadlock Elimination for Multi-Table Merge** (From Observation 1 & 3):
   - In `mergeTableSessions`, $N$ source tables and 1 target table are involved.
   - Concurrent merges with overlapping tables (e.g. T1->T2 vs T2->T1) risk circular wait deadlocks (`SQLSTATE 40P01`).
   - By sorting all participant table IDs lexicographically (`allTableIds = [...new Set([...sourceTableIds, targetTableId])].sort()`) and locking them in ascending order, circular lock dependencies are eliminated mathematically.

4. **Multi-Source Merge Invariant** (From Observation 1, 2, & 4):
   - A party may combine multiple tables (e.g. T1 and T2 into T3).
   - The algorithm re-parents all `RestaurantOrder` records from every source session to `targetSession.id` and `targetTable.id`, marks each source session `MERGED`, sets each source table `AVAILABLE`, sums `guestCount` into the target session, and records an immutable `AuditEvent` (`TABLES_MERGED`).

5. **Endpoint Parity** (From Observation 4):
   - Providing top-level endpoints `POST /api/v1/restaurant/tables/move` and `POST /api/v1/restaurant/tables/merge` directly matches the `PROJECT.md` API specification while maintaining `[id]/move` and `[id]/merge` for parameter routing backward compatibility.

---

## 3. Caveats

1. **Database Schema Additions**: We operate in read-only mode and assume the M1 schema is fixed. No new columns (`mergedIntoSessionId`) are added to `TableSession`; merge references are stored in `notes` and `AuditEvent.metadata`.
2. **Target Session Auto-Opening**: The merge algorithm assumes the target table already has an active dining session. If a business workflow requires merging two occupied tables into an empty (`AVAILABLE`) table, a session on the target table must first be opened via `openTableSession`.
3. **Hardware KDS / Printing**: Printing physical tickets and live KDS status synchronization are out of scope for Phase 3 (deferred to Phase 4). Move and merge update database order headers and table status without triggering physical print jobs.

---

## 4. Conclusion

The specification report `move_merge_spec_report.md` provides complete, unambiguous, and production-ready designs for:
1. `moveTableSession(tx, params)`: Atomic table transfer with OCC versioning, zero order line duplication, and 409 Conflict rejection for occupied target tables.
2. `mergeTableSessions(tx, params)`: Multi-source table session consolidation with deterministic sorted table locking (`allTableIds.sort()`), order re-parenting, guest count aggregation, and audit logging.
3. Explicit solutions for current compilation errors in `table-session-service.ts`.
4. REST API route definitions for `POST /api/v1/restaurant/tables/move` and `POST /api/v1/restaurant/tables/merge`.
5. Unit and adversarial concurrency test suites featuring real PostgreSQL PID witnessing.

---

## 5. Verification Method

To independently verify this specification and its downstream implementation:

1. **Verify TypeScript Compilation**:
   ```bash
   npx tsc --noEmit -p backend/tsconfig.json
   ```
   *Expected Result*: Once `mergedIntoSessionId` is replaced with `notes`/`AuditEvent` and `orders` replaced with `restaurantOrders`, zero TypeScript errors must be emitted.

2. **Inspect Specification Artifacts**:
   - `c:\projects\pos\.agents\teamwork\p3_m2_explorer_3\move_merge_spec_report.md`
   - `c:\projects\pos\.agents\teamwork\p3_m2_explorer_3\progress.md`

3. **Verify Concurrency & Invariant Test Cases**:
   - Run Vitest suite:
     ```bash
     npm test tests/commerce-transaction.test.ts
     ```
   - For Milestone M6 integration tests against isolated PostgreSQL container (127.0.0.1:55439):
     ```bash
     npm test tests/restaurant-concurrency.integration.test.ts
     ```
   - Invalidation Conditions:
     * If an order line count changes during move or merge $\to$ Invalidation: zero duplication / zero loss invariant violated.
     * If two concurrent moves to the same target table both succeed $\to$ Invalidation: serializable isolation failed.
     * If a circular merge causes unhandled deadlock $\to$ Invalidation: deterministic lock ordering failed.
