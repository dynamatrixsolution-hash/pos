# Phase 3 Milestone M2 Handoff Report: TableSession Lifecycle & Table Occupancy State Machine

**Author**: M2 Explorer 2 (TableSession Lifecycle Analyst)  
**Target Milestone**: Phase 3 Milestone M2 (Floor, Table & TableSession Management Services & APIs)  
**Date**: 2026-11-01  
**Status**: COMPLETE / VERIFIED  

---

## 1. Observation

### 1.1 Direct File Observations & Schema Inspection
1. **`packages/db/prisma/schema.prisma`**:
   - `model RestaurantTable` (lines 1133–1161):
     ```prisma
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
     Observed: `status` is a `String` defaulting to `"AVAILABLE"`, `currentSessionId` is a scalar `String?` without an `@relation` attribute. There is no `version` field on `RestaurantTable`.
   - `model TableSession` (lines 1163–1191):
     ```prisma
     model TableSession {
       id            String            @id @default(uuid())
       businessId    String
       business      Business          @relation(fields: [businessId], references: [id], onDelete: Cascade)
       branchId      String
       branch        Branch            @relation(fields: [branchId], references: [id], onDelete: Cascade)
       tableId       String
       table         RestaurantTable   @relation(fields: [tableId], references: [id], onDelete: Cascade)
       sessionNumber String
       guestCount    Int               @default(1)
       status        String            @default("ACTIVE") // ACTIVE, BILLED, COMPLETED, CANCELLED
       openedAt      DateTime          @default(now())
       closedAt      DateTime?
       openedById    String?
       openedBy      User?             @relation("SessionOpenedBy", fields: [openedById], references: [id], onDelete: SetNull)
       closedById    String?
       closedBy      User?             @relation("SessionClosedBy", fields: [closedById], references: [id], onDelete: SetNull)
       version       Int               @default(1) // Optimistic Concurrency Control
       notes         String?
       createdAt     DateTime          @default(now())
       updatedAt     DateTime          @updatedAt

       restaurantOrders RestaurantOrder[]

       @@unique([businessId, id])
       @@unique([businessId, branchId, sessionNumber])
       @@index([businessId, branchId, status])
       @@index([businessId, tableId, status])
     }
     ```
     Observed: `TableSession` defines `version Int @default(1)`, unique constraint on `[businessId, branchId, sessionNumber]`, and relation `restaurantOrders RestaurantOrder[]`. Notice that there is NO `mergedIntoSessionId` column on `TableSession`.
   - `model RestaurantOrder` (lines 1318–1360):
     Observed: defines independent 3D statuses:
     - `acceptanceStatus`: `"PENDING"`, `"ACCEPTED"`, `"REJECTED"`
     - `fulfillmentStatus`: `"QUEUED"`, `"PREPARING"`, `"READY"`, `"SERVED"`, `"CANCELLED"`
     - `settlementStatus`: `"UNPAID"`, `"PARTIAL"`, `"PAID"`, `"REFUNDED"`

2. **Existing Implementation Audit: `backend/src/lib/services/table-session-service.ts`**:
   - Lines 50–56: `generateSessionNumber()` produces `TS-${dateStr}-${timeStr}-${rand}` with `Math.random()`, which is NOT monotonic.
   - Lines 81–83: Checks `if (table.status === "OCCUPIED" || table.status === "BILLED")`, failing to check `RESERVED`.
   - Lines 119–125: Directly calls `tx.restaurantTable.update({ where: { id: input.tableId } })` without an atomic compare-and-swap (CAS) condition on `status: "AVAILABLE"`, creating a race condition for concurrent double-seating.
   - Lines 397–404: `unsettledOrders` checks `o.settlementStatus !== "PAID" && o.settlementStatus !== "REFUNDED"` without exempting voided orders (`REJECTED` or `CANCELLED`).
   - Line 421: Sets `status: "COMPLETED"` rather than `"CLOSED"`.
   - Line 420: Does NOT verify or increment `version` (OCC is completely unhandled).
   - Line 312: Attempts to store `mergedIntoSessionId: targetSession.id`, which does not exist in `schema.prisma`.

3. **REST API Route Audit**:
   - `backend/src/app/api/v1/restaurant/tables/route.ts`: Exists, handles Table CRUD with Zod validation.
   - `backend/src/app/api/v1/restaurant/tables/[id]/move/route.ts`: Exists, awaits Next.js 16 async params `const { id } = await params`.
   - `backend/src/app/api/v1/restaurant/tables/[id]/merge/route.ts`: Exists, awaits Next.js 16 async params.
   - `backend/src/app/api/v1/restaurant/sessions/`: DOES NOT EXIST.
   - `backend/src/app/api/v1/restaurant/sessions/[id]/`: DOES NOT EXIST.
   - `backend/src/app/api/v1/restaurant/sessions/[id]/close/`: DOES NOT EXIST.

4. **Workspace Typecheck & Build Status**:
   - Ran `npm.cmd run typecheck`: Exit code 0 (TypeScript passes).

---

## 2. Logic Chain

1. **Table Occupancy & Session Coupling**:
   - In `schema.prisma`, `RestaurantTable` has `currentSessionId String?` and `status String @default("AVAILABLE")`.
   - To seat diners, a table must transition `AVAILABLE -> OCCUPIED` and store the created `TableSession.id` in `currentSessionId`.
   - When closing, the table must release `currentSessionId = null` and return `status = "AVAILABLE"`.
   - Because `currentSessionId` is a scalar to prevent DAG cycles in `backup-format.ts`, referential integrity must be strictly enforced within atomic service transactions.

2. **Monotonic Sequence Requirement**:
   - The mission explicitly requires: "Generates monotonic `sessionNumber` per branch."
   - The unique index is `@@unique([businessId, branchId, sessionNumber])`.
   - A random string like `TS-YYYYMMDD-HHMMSS-RAND` violates monotonicity and predictability.
   - By querying the latest `sessionNumber` matching `SESS-YYYYMMDD-` for the tenant's branch inside a serializable transaction and incrementing the suffix counter (`0001`, `0002`...), we guarantee strictly monotonic session numbers while preventing duplicates.

3. **Settlement Invariant Logic**:
   - The mission requires: "Validates that all orders linked to the session are settled (`PAID`) or voided (`CANCELLED`/`REJECTED`)."
   - In restaurant operations, a party may order an item that gets rejected by the kitchen (`acceptanceStatus === "REJECTED"`) or cancelled by staff (`fulfillmentStatus === "CANCELLED"`). These orders remain `UNPAID` but incur zero monetary obligation.
   - Therefore, filtering solely by `settlementStatus !== "PAID"` erroneously prevents closing sessions with voided orders. The settlement filter must explicitly exclude orders where `acceptanceStatus === "REJECTED"` or `fulfillmentStatus === "CANCELLED"`.
   - Furthermore, active food lines (`fulfillmentStatus IN ("QUEUED", "PREPARING")`) must block session close unless staff explicitly forces closure (`force: true`), preventing vacating tables while food is cooking.

4. **Optimistic Concurrency Control (OCC)**:
   - `TableSession` defines `version Int @default(1)`.
   - To prevent concurrent conflicting closures across multiple waiter terminals, `closeTableSession` and `updateTableSession` must accept an optional `expectedVersion`, verify that `session.version === expectedVersion`, and increment `version` by 1 via atomic CAS (`updateMany({ where: { id, version }, data: { version: { increment: 1 } } })`).
   - If two terminals attempt to close or mutate the session simultaneously, the first increments the version, and the second fails closed with HTTP 409 Conflict.
   - For table openings, because `RestaurantTable` lacks a `version` column, atomic CAS is achieved via `updateMany({ where: { id: tableId, status: "AVAILABLE", currentSessionId: null } })`, ensuring only one terminal can seat an available table.

5. **REST API Architecture**:
   - Following Next.js 16 conventions (`node_modules/next/dist/docs/`), route handlers must await `params` (`Promise<{ id: string }>`).
   - Endpoints `/api/v1/restaurant/sessions`, `/api/v1/restaurant/sessions/[id]`, and `/api/v1/restaurant/sessions/[id]/close` map directly to the service layer functions, using Zod schemas for input validation and returning consistent JSON payloads with standard HTTP status codes (200, 201, 400, 401, 404, 409, 500).

---

## 3. Caveats

1. **`RestaurantTable` Versioning**:
   `RestaurantTable` does not currently include a `version: Int` field in `packages/db/prisma/schema.prisma`. Atomic compare-and-swap (CAS) using `status: "AVAILABLE"` and `currentSessionId: null` inside `updateMany` was designed to compensate and provide complete race-condition immunity without requiring another schema migration.
2. **Terminal Status Naming**:
   The Prisma schema comments suggest `ACTIVE, BILLED, COMPLETED, CANCELLED`, whereas the authoritative mission prompt specifies:
   `Session status transitions: ACTIVE -> CLOSED or MERGED` and `Updates TableSession.status = CLOSED and closedAt = now()`.
   The specification strictly aligns with `CLOSED` as the terminal status, while maintaining read compatibility with `COMPLETED` for any existing records.
3. **Hardware Printing and KDS Scope**:
   Hardware ESC/POS receipt printing and KDS live stations are explicitly deferred to Phase 4 per `PROJECT.md`. The `BILLED` status represents the logical state of check presentation without requiring hardware driver execution.

---

## 4. Conclusion

1. The complete lifecycle and state machine specification for `TableSession` and `RestaurantTable` has been fully developed and documented in `c:\projects\pos\.agents\teamwork\p3_m2_explorer_2\table_session_lifecycle_report.md`.
2. Seven concrete defects in the existing draft of `backend/src/lib/services/table-session-service.ts` have been diagnosed with complete remediation algorithms provided.
3. The monotonic session numbering algorithm (`SESS-YYYYMMDD-XXXX`), order settlement validation logic, kitchen safety guards, and atomic OCC/CAS concurrency mechanisms are fully formulated and ready for implementation by the Builder Worker.
4. The complete REST API specifications for `sessions/route.ts`, `sessions/[id]/route.ts`, and `sessions/[id]/close/route.ts` are ready for creation.

---

## 5. Verification Method

To independently verify this specification and its subsequent implementation:
1. **TypeScript Typecheck**:
   ```powershell
   npm.cmd run typecheck
   ```
   Validates that all route parameters await Next.js 16 `params: Promise<{ id: string }>` and all Prisma queries use valid schema field names.
2. **Schema & Migration Integrity**:
   Verify `TableSession` in `packages/db/prisma/schema.prisma` lines 1163–1191 matches the interface contracts.
3. **Concurrency Integration Verification**:
   When implementing tests in `tests/restaurant-concurrency.integration.test.ts`:
   - Concurrently execute two `openTableSession` calls on the same available table: witness that exactly 1 succeeds and 1 throws 409 Conflict.
   - Concurrently execute two `closeTableSession` calls on the same active session: witness that exactly 1 succeeds and 1 throws 409 Conflict.
4. **Invalidation Conditions**:
   - Any commit that adds a circular `@relation` between `RestaurantTable.currentSessionId` and `TableSession` invalidates the disaster recovery acyclicity invariant.
   - Generating random session numbers instead of monotonic sequence invalidates the branch sequencing invariant.
