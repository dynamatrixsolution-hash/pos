## 2026-11-01T04:40:55Z
You are the M2 Builder Worker for Phase 3 Milestone M2: Floor, Table & TableSession Management Services & APIs.

Working Directory: c:\projects\pos\.agents\teamwork\p3_m2_worker_1
Authoritative Original Request: c:\projects\pos\.agents\teamwork\ORIGINAL_REQUEST.md
Scope Document: c:\projects\pos\.agents\teamwork\orchestrator_2\PROJECT.md

Explorer Deliverables & References (Read these before implementing):
- c:\projects\pos\.agents\teamwork\p3_m2_explorer_1\floor_table_spec_report.md
- c:\projects\pos\.agents\teamwork\p3_m2_explorer_1\handoff.md
- c:\projects\pos\.agents\teamwork\p3_m2_explorer_2\table_session_lifecycle_report.md
- c:\projects\pos\.agents\teamwork\p3_m2_explorer_2\handoff.md
- c:\projects\pos\.agents\teamwork\p3_m2_explorer_3\move_merge_spec_report.md
- c:\projects\pos\.agents\teamwork\p3_m2_explorer_3\handoff.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

File Write Boundaries:
You own exclusively:
- backend/src/lib/services/floor-table-service.ts
- backend/src/lib/services/table-session-service.ts
- backend/src/app/api/v1/restaurant/floors/
- backend/src/app/api/v1/restaurant/tables/
- backend/src/app/api/v1/restaurant/sessions/
- tests/ (tests covering floor, table, session, move, and merge)

Your Mission:
1. Implement `backend/src/lib/services/floor-table-service.ts`:
   - Full CRUD for Floor (`createFloor`, `getFloors`, `getFloorById`, `updateFloor`, `deleteFloor`). Block deletion if floor has tables.
   - Full CRUD for RestaurantTable (`createTable`, `getTables`, `getTableById`, `updateTable`, `deleteTable`, `updateTablePositions`). Block deletion/deactivation if occupied or billed.
   - Multi-tenant isolation and composite uniqueness checks on `(businessId, branchId, name)` and `(businessId, branchId, tableNumber)`.
2. Implement / Refactor `backend/src/lib/services/table-session-service.ts`:
   - Fix compilation errors: use `restaurantOrders` (not `orders`), remove non-existent `mergedIntoSessionId` column (store merge provenance in session metadata/notes).
   - Monotonic daily branch session number generator: `SESS-YYYYMMDD-XXXX`.
   - `openTableSession`: atomic CAS validation (table must be `AVAILABLE`), set `RestaurantTable.status = OCCUPIED`, `currentSessionId = session.id`, OCC version increment.
   - `closeTableSession`: validate that all orders linked to the session are settled (`PAID`, `REFUNDED`) or voided (`CANCELLED`, `REJECTED`), verify no food in active preparation (`PREPARING`), clear table `currentSessionId = null`, set `status = AVAILABLE`, OCC version increment.
   - `moveTableSession`: serializable transaction, atomically repoint `TableSession.tableId`, update orders tableId cache, clear source table to `AVAILABLE`, set target table to `OCCUPIED`. Guarantee zero order lines duplicated or lost.
   - `mergeTableSessions`: sorted table lock order eliminating deadlocks, re-parent all orders from source sessions to target session, mark source sessions as `MERGED`, clear source tables to `AVAILABLE`, aggregate guest count, record `AuditEvent`. Guarantee zero order lines duplicated.
3. Implement / Update Next.js 16 REST API route handlers:
   - `backend/src/app/api/v1/restaurant/floors/route.ts` & `[id]/route.ts`
   - `backend/src/app/api/v1/restaurant/tables/route.ts` & `[id]/route.ts`
   - `backend/src/app/api/v1/restaurant/tables/move/route.ts` & `merge/route.ts` (ensure both `/tables/move` and `/tables/[id]/move` route shapes are supported)
   - `backend/src/app/api/v1/restaurant/sessions/route.ts`, `[id]/route.ts`, `[id]/close/route.ts`
   - Ensure all dynamic routes use Next.js 16 async params: `{ params }: { params: Promise<{ id: string }> }`.
4. Tests:
   - Write unit and integration tests covering Floor/Table CRUD, TableSession lifecycle, and atomic Move/Merge without line duplication.
5. Verification Commands:
   - `npm.cmd run typecheck`
   - `npm.cmd test`
   - `node scripts/restro-env.mjs recovery-test`
   - `node scripts/restro-restore-env.mjs rehearse`
6. Write 5-component handoff report (Observation, Logic Chain, Caveats, Conclusion, Verification Method) with all command outputs and exit codes to:
   `c:\projects\pos\.agents\teamwork\p3_m2_worker_1\handoff.md`.
7. Notify orchestrator upon completion via send_message.
