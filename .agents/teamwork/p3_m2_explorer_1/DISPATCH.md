## 2026-11-01T04:32:30Z
You are M2 Explorer 1 (Floor & Table Service & Route Spec Miner) for Phase 3 Milestone M2: Floor, Table & TableSession Management Services & APIs.

Working Directory: c:\projects\pos\.agents\teamwork\p3_m2_explorer_1
Authoritative Original Request: c:\projects\pos\.agents\teamwork\ORIGINAL_REQUEST.md
Scope Document: c:\projects\pos\.agents\teamwork\orchestrator_2\PROJECT.md
Architectural Survey Reference: c:\projects\pos\.agents\teamwork\planner_survey_2\planner_survey_report.md
Specification Document: docs/hospitality/phases/PHASE_3_RESTAURANT_MVP.md
Database Schema: packages/db/prisma/schema.prisma

Your Mission:
Mine and specify the complete service layer and REST API routes for Floor and Dining Table management:
1. Services in `backend/src/lib/services/floor-table-service.ts`:
   - Floor CRUD: `createFloor`, `getFloors`, `updateFloor`, `deleteFloor` (with multi-tenant `businessId` checks).
   - Table CRUD & status queries: `createTable`, `getTables`, `getTableById`, `updateTable`, `deleteTable`.
   - Grid layout metadata support (X, Y coordinates, shape, seating capacity).
2. REST API Routes:
   - `backend/src/app/api/v1/restaurant/floors/route.ts` (GET, POST)
   - `backend/src/app/api/v1/restaurant/floors/[id]/route.ts` (GET, PATCH, DELETE)
   - `backend/src/app/api/v1/restaurant/tables/route.ts` (GET, POST)
   - `backend/src/app/api/v1/restaurant/tables/[id]/route.ts` (GET, PATCH, DELETE)
3. Input validation with Zod schemas matching existing `backend/src/` patterns.
4. Error handling and HTTP status codes (400 Bad Request, 401 Unauthorized, 404 Not Found, 409 Conflict).

Execution Rules:
- You are read-only; DO NOT modify or create source code or test files.
- Maintain progress in c:\projects\pos\.agents\teamwork\p3_m2_explorer_1\progress.md.
- Write your comprehensive specification report to c:\projects\pos\.agents\teamwork\p3_m2_explorer_1\floor_table_spec_report.md.
- Write your 5-component handoff report to c:\projects\pos\.agents\teamwork\p3_m2_explorer_1\handoff.md.
- Notify the orchestrator upon completion via send_message.
