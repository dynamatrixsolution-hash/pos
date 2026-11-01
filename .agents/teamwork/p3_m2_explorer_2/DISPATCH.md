## 2026-11-01T04:32:38Z
You are M2 Explorer 2 (TableSession Lifecycle Analyst) for Phase 3 Milestone M2: Floor, Table & TableSession Management Services & APIs.

Working Directory: c:\projects\pos\.agents\teamwork\p3_m2_explorer_2
Authoritative Original Request: c:\projects\pos\.agents\teamwork\ORIGINAL_REQUEST.md
Scope Document: c:\projects\pos\.agents\teamwork\orchestrator_2\PROJECT.md
Architectural References:
- c:\projects\pos\.agents\teamwork\planner_survey_2\planner_survey_report.md
- docs/hospitality/phases/PHASE_3_RESTAURANT_MVP.md
Database Schema: packages/db/prisma/schema.prisma

Your Mission:
Design and specify the complete TableSession lifecycle and table occupancy state machine:
1. `TableSession` service layer in `backend/src/lib/services/table-session-service.ts`:
   - `openTableSession`:
     * Validates table is in `AVAILABLE` status.
     * Generates monotonic `sessionNumber` per branch.
     * Creates `TableSession` with guestCount, openedById, openedAt.
     * Updates `RestaurantTable.status = OCCUPIED` and `RestaurantTable.currentSessionId = session.id` atomically.
   - `closeTableSession`:
     * Validates that all orders linked to the session are settled (`PAID`) or voided (`CANCELLED`/`REJECTED`).
     * Updates `TableSession.status = CLOSED` and `closedAt = now()`.
     * Clears `RestaurantTable.currentSessionId = null` and sets `status = AVAILABLE` atomically.
   - Session status transitions: `ACTIVE` -> `CLOSED` or `MERGED`.
   - Table occupancy statuses: `AVAILABLE`, `OCCUPIED`, `RESERVED`, `BILLED`.
2. REST API Routes:
   - `backend/src/app/api/v1/restaurant/sessions/route.ts` (POST to open, GET to list active)
   - `backend/src/app/api/v1/restaurant/sessions/[id]/route.ts` (GET, PATCH to update guestCount/notes)
   - `backend/src/app/api/v1/restaurant/sessions/[id]/close/route.ts` (POST to close)
3. Concurrency and OCC:
   - Use `version: Int` checking to prevent concurrent conflicting closures or session openings on the same table.

Execution Rules:
- You are read-only; DO NOT modify or create source code or test files.
- Maintain progress in c:\projects\pos\.agents\teamwork\p3_m2_explorer_2\progress.md.
- Write your comprehensive report to c:\projects\pos\.agents\teamwork\p3_m2_explorer_2\table_session_lifecycle_report.md.
- Write your 5-component handoff to c:\projects\pos\.agents\teamwork\p3_m2_explorer_2\handoff.md.
- Notify the orchestrator upon completion via send_message.
