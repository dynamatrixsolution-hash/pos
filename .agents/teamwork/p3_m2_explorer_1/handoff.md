# Handoff Report: Floor & Table Management Service & API Route Specification

**Author**: M2 Explorer 1 (Floor & Table Service & Route Spec Miner)  
**Task**: Mine and specify the complete service layer and REST API routes for Floor and Dining Table management (Phase 3 Milestone M2).  
**Working Directory**: `c:\projects\pos\.agents\teamwork\p3_m2_explorer_1`  
**Handoff Type**: Hard (Task Complete)

---

## 1. Observation

1. **Database Models & Invariants**:
   - In `packages/db/prisma/schema.prisma` lines 1113–1131, `Floor` is defined with fields `id`, `businessId`, `branchId`, `name`, `displayOrder`, `isActive`, `metadata` (Json?), `createdAt`, `updatedAt`, and relation `tables RestaurantTable[]`. Enforces `@@unique([businessId, id])`, `@@unique([businessId, branchId, name])`, and `@@index([businessId, branchId, displayOrder])`.
   - In `packages/db/prisma/schema.prisma` lines 1133–1161, `RestaurantTable` is defined with fields `id`, `businessId`, `branchId`, `floorId`, `tableNumber`, `capacity` (Int, default 4), `status` (String, default "AVAILABLE"), `currentSessionId` (String?), `shape` (String, default "RECTANGLE"), `posX` (Int, default 0), `posY` (Int, default 0), `width` (Int, default 1), `height` (Int, default 1), `isActive` (Boolean, default true), and relations `tableSessions TableSession[]` and `restaurantOrders RestaurantOrder[]`. Enforces `@@unique([businessId, id])`, `@@unique([businessId, branchId, tableNumber])`, `@@index([businessId, branchId, floorId])`, and `@@index([businessId, status])`.
   - `RestaurantTable.currentSessionId` is intentionally a scalar `String?` without an `@relation` to `TableSession` to preserve acyclicity for the disaster recovery backup topological sort engine (`backend/src/lib/backup-format.ts`).

2. **Existing Implementation Status**:
   - `backend/src/lib/services/floor-table-service.ts` DOES NOT EXIST. Currently, existing routes perform ad-hoc inline Prisma queries.
   - `backend/src/app/api/v1/restaurant/floors/route.ts` exists (71 lines) with basic GET and POST methods, but lacks RBAC checks (cashiers can currently POST), lacks duplicate name collision handling, and does not delegate to a service layer.
   - `backend/src/app/api/v1/restaurant/floors/[id]/route.ts` DOES NOT EXIST.
   - `backend/src/app/api/v1/restaurant/tables/route.ts` exists (100 lines) with GET and POST methods, but does not delegate to a service layer and lacks full RBAC filtering.
   - `backend/src/app/api/v1/restaurant/tables/[id]/route.ts` DOES NOT EXIST.
   - Sub-routes `backend/src/app/api/v1/restaurant/tables/[id]/move/route.ts` and `merge/route.ts` already exist and utilize `backend/src/lib/services/table-session-service.ts`.

3. **Prisma Relation Naming Caveat & Typecheck Findings**:
   - Command `npm.cmd run typecheck` revealed TypeScript compilation errors in existing files:
     ```
     backend/src/app/api/v1/restaurant/sessions/route.ts(31,9): error TS2353: Object literal may only specify known properties, and 'orders' does not exist in type 'TableSessionInclude<DefaultArgs>'.
     backend/src/lib/services/table-session-service.ts(379,9): error TS2353: Object literal may only specify known properties, and 'orders' does not exist in type 'TableSessionInclude<DefaultArgs>'.
     ```
   - This directly proves that in `schema.prisma`, `TableSession` links to `restaurantOrders RestaurantOrder[]`, NOT `orders`. All future Floor/Table services and routes referencing orders must use `restaurantOrders`.

4. **Next.js 16 Route Handler Conventions**:
   - Inspection of `backend/src/app/api/v1/branches/[id]/route.ts` and `backend/src/app/api/v1/restaurant/tables/[id]/move/route.ts` confirms dynamic routes must use `props: { params: Promise<{ id: string }> }` and `const { id } = await params;`.

---

## 2. Logic Chain

1. **Multi-Tenancy & Integrity**:
   - Observation 1 establishes composite uniqueness `@@unique([businessId, branchId, name])` on `Floor` and `@@unique([businessId, branchId, tableNumber])` on `RestaurantTable`.
   - Therefore, any create or update operation must verify that no entity in the same branch already possesses the target name or number, returning HTTP 409 Conflict if violated.

2. **Service Layer Abstraction (`floor-table-service.ts`)**:
   - Observation 2 reveals that `floor-table-service.ts` is missing, forcing API routes to contain raw database logic.
   - Creating `backend/src/lib/services/floor-table-service.ts` with standard CRUD and query operations (`createFloor`, `getFloors`, `getFloorById`, `updateFloor`, `deleteFloor`, `createTable`, `getTables`, `getTableById`, `updateTable`, `deleteTable`, and `updateTablePositions`) centralizes business validation and ensures consistent tenant isolation.

3. **Deletion & Deactivation Safety Rules**:
   - Observation 1 shows `RestaurantTable` has foreign key `floorId` cascading from `Floor`.
   - If a floor were directly deleted while containing tables, all tables would be cascadingly deleted. In a hospitality system, deleting a floor with tables must be blocked (HTTP 409 Conflict).
   - Furthermore, deleting or deactivating a table that is currently `OCCUPIED` or `BILLED` must fail closed (HTTP 409 Conflict).
   - Historical tables with associated sessions/orders must be soft-deleted (`isActive = false`) rather than hard deleted to avoid foreign key violations and preserve financial audit trails.

4. **REST API Route Contract Design**:
   - Following Observation 4, `floors/[id]/route.ts` and `tables/[id]/route.ts` must implement GET, PATCH, and DELETE using async Next.js 16 `params`.
   - Routes `floors/route.ts` and `tables/route.ts` must be refactored to delegate directly to `floor-table-service.ts`.
   - RBAC rules from `backend/src/lib/api-helper.ts` dictate that while all staff (including `CASHIER`) may read layout via GET, mutating operations (POST, PATCH, DELETE) require `OWNER`, `MANAGER`, or `SUPER_ADMIN`.

---

## 3. Caveats

- **Table Session Lifecycles**: `TableSession` creation, moving, and merging are managed by `backend/src/lib/services/table-session-service.ts` (assigned to M2 Explorer 2 / Builder 2). `RestaurantTable.status` updates tied to session start/close must coordinate with session lifecycle events.
- **Physical Overlap Prevention**: The data model permits overlapping grid coordinates (`posX`, `posY`) so that drag-and-drop operations do not hit intermediate collision deadlocks in the database. Layout collision resolution or visual grid snapping is handled by the frontend floor plan canvas component.

---

## 4. Conclusion

The specification for `backend/src/lib/services/floor-table-service.ts` and REST API routes under `backend/src/app/api/v1/restaurant/` is completely finalized and documented in `floor_table_spec_report.md`. It includes exact TypeScript method signatures, Zod schemas, HTTP status codes, multi-tenant composite key invariants, safety guards, and edge cases. The implementation is ready to be executed by Builder agents.

---

## 5. Verification Method

To independently verify the specification and prepare for implementation:

1. **Inspect Specification Document**:
   - Review `c:\projects\pos\.agents\teamwork\p3_m2_explorer_1\floor_table_spec_report.md`.
2. **Schema Verification**:
   - View `packages/db/prisma/schema.prisma` lines 1113–1161 to confirm all fields (`name`, `capacity`, `shape`, `posX`, `posY`, `width`, `height`, `status`, `currentSessionId`) and unique composite indexes.
3. **Route & Param Compatibility**:
   - Inspect `backend/src/app/api/v1/restaurant/tables/[id]/move/route.ts` lines 11–20 to verify the Next.js 16 async params pattern `const { id } = await params;`.
4. **Post-Implementation Test Command**:
   - Upon implementation by builders, execute:
     ```powershell
     npm.cmd run typecheck
     ```
     and run the restaurant integration test suite:
     ```powershell
     npx vitest run tests/restaurant-floor-table.integration.test.ts
     ```
