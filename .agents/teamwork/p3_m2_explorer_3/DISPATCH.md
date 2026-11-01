## 2026-11-01T04:32:50Z
You are M2 Explorer 3 (Move & Merge Transaction Specialist) for Phase 3 Milestone M2: Floor, Table & TableSession Management Services & APIs.

Working Directory: c:\projects\pos\.agents\teamwork\p3_m2_explorer_3
Authoritative Original Request: c:\projects\pos\.agents\teamwork\ORIGINAL_REQUEST.md
Scope Document: c:\projects\pos\.agents\teamwork\orchestrator_2\PROJECT.md
Architectural References:
- c:\projects\pos\.agents\teamwork\planner_survey_2\planner_survey_report.md
- docs/hospitality/phases/PHASE_3_RESTAURANT_MVP.md
Database Schema: packages/db/prisma/schema.prisma

Your Mission:
Formulate the exact PostgreSQL serializable transactional algorithms for Atomic Table Move and Atomic Table Merge:
1. Atomic Table Move (`moveTableSession`):
   - Input: `{ businessId, sourceTableId, targetTableId, actorId }`
   - Invariant: Transfer active session and all accumulated orders/rounds/lines atomically WITHOUT DUPLICATING ANY ORDER LINES or dropping state.
   - Algorithm:
     * Check source table is `OCCUPIED` and has active session.
     * Check target table is `AVAILABLE` (reject with 409 Conflict if already occupied).
     * Inside serializable transaction:
       - Update `TableSession.tableId = targetTableId`.
       - Update `RestaurantTable(sourceTableId)`: `currentSessionId = null`, `status = AVAILABLE`.
       - Update `RestaurantTable(targetTableId)`: `currentSessionId = session.id`, `status = OCCUPIED`.
       - Update any active `RestaurantOrder.tableId = targetTableId` (if tableId is cached on order).
       - Record `AuditEvent` (`TABLE_MOVED`).
   - Endpoint: `POST /api/v1/restaurant/tables/move`.
2. Atomic Table Merge (`mergeTableSessions`):
   - Input: `{ businessId, sourceTableIds: string[], targetTableId, actorId }`
   - Invariant: Combine sessions from multiple tables into a single destination table's session WITHOUT duplicating line items.
   - Algorithm:
     * Target table must have an active session (or create one).
     * For each source table:
       - Verify it has an active session.
       - Re-parent all `RestaurantOrder` records from source session to target session (`order.tableSessionId = targetSession.id`, `order.tableId = targetTableId`).
       - Mark source session as `MERGED` with pointer `mergedIntoSessionId = targetSession.id` in metadata.
       - Clear source table: `currentSessionId = null`, `status = AVAILABLE`.
       - Update target session guestCount (sum of guest counts).
       - Record `AuditEvent` (`TABLES_MERGED`).
   - Endpoint: `POST /api/v1/restaurant/tables/merge`.
3. Provide complete TypeScript contracts, error conditions, and test verification strategies.

Execution Rules:
- You are read-only; DO NOT modify or create source code or test files.
- Maintain progress in c:\projects\pos\.agents\teamwork\p3_m2_explorer_3\progress.md.
- Write your comprehensive report to c:\projects\pos\.agents\teamwork\p3_m2_explorer_3\move_merge_spec_report.md.
- Write your 5-component handoff to c:\projects\pos\.agents\teamwork\p3_m2_explorer_3\handoff.md.
- Notify the orchestrator upon completion via send_message.
