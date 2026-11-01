# BRIEFING — 2026-11-01T04:41:00Z

## Mission
Deliver Phase 3 Milestone M2: Floor, Table & TableSession Management Services & APIs, strictly adhering to Prisma schema, Next.js 16 conventions, and transaction safety invariants.

## 🔒 My Identity
- Archetype: implementer
- Roles: implementer, qa, specialist
- Working directory: c:\projects\pos\.agents\teamwork\p3_m2_worker_1
- Original parent: 98f60f04-06d4-493d-9df7-9f604839d4bc
- Milestone: Phase 3 Milestone M2

## 🔒 Key Constraints
- File Write Boundaries:
  - backend/src/lib/services/floor-table-service.ts
  - backend/src/lib/services/table-session-service.ts
  - backend/src/app/api/v1/restaurant/floors/
  - backend/src/app/api/v1/restaurant/tables/
  - backend/src/app/api/v1/restaurant/sessions/
  - tests/
- Integrity Mandate: Genuine implementations only. No hardcoded results, no facade dummy implementations.
- Next.js 16 async params: `{ params }: { params: Promise<{ id: string }> }`.
- Prisma relations: use `restaurantOrders` (not `orders`), no `mergedIntoSessionId` column on `TableSession` (store in notes/metadata).
- Monotonic daily branch session number: `SESS-YYYYMMDD-XXXX`.
- Serialized locking / deadlock prevention on table merge.
- Zero duplicate or lost order lines across moves/merges.

## Current Parent
- Conversation ID: 98f60f04-06d4-493d-9df7-9f604839d4bc
- Updated: 2026-11-01T04:41:00Z

## Task Summary
- **What to build**: Floor & Table CRUD services & routes, TableSession lifecycle management (open, close, move, merge), comprehensive unit & integration tests.
- **Success criteria**: All type checks pass (`npm.cmd run typecheck`), all tests pass (`npm.cmd test`), recovery & restore rehearsal pass.
- **Interface contracts**: REST API endpoints for floors, tables, moves, merges, sessions.

## Change Tracker
- **Files modified**: None yet
- **Build status**: Pending initial run
- **Pending issues**: None

## Quality Status
- **Build/test result**: Pending
- **Lint status**: Pending
- **Tests added/modified**: Pending

## Loaded Skills
- None
