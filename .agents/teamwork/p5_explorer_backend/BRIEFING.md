# BRIEFING — 2026-11-01T05:32:00Z

## Mission
Comprehensive backend & API investigation for Phase 5 (Hotel Stays, Rooms, Housekeeping & Maintenance), establishing concrete patterns, domain service blueprints, API contracts, concurrency safeguards, and test strategies.

## 🔒 My Identity
- Archetype: explorer
- Roles: backend investigation, API design analysis, concurrency & architecture synthesis
- Working directory: c:\projects\pos\.agents\teamwork\p5_explorer_backend
- Original parent: 35cca4ca-b4fa-46c8-b9ea-1c5b07e1cb84
- Milestone: Phase 5 Backend & API Architecture & Specification

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Inspect existing services in backend/src/lib/services/ for transactions, tenant isolation, error handling, Zod validation
- Inspect existing API routes in backend/src/app/api/v1/ for routing, auth/tenant context, status codes
- Inspect existing tests in backend/ or packages/ for test conventions
- Enumerate domain services and API specifications for Phase 5 with strict concurrency and atomic race condition prevention

## Current Parent
- Conversation ID: 35cca4ca-b4fa-46c8-b9ea-1c5b07e1cb84
- Updated: not yet

## Investigation State
- **Explored paths**:
  - `ORIGINAL_REQUEST.md` and `docs/hospitality/phases/PHASE_5_HOTEL_STAYS_ROOMS.md`
  - `backend/src/lib/services/` (floor-table-service, table-session-service, kitchen-routing-service, decimal-math)
  - `backend/src/app/api/v1/` (api-helper, commerce-policy, commerce-transaction, tables, sessions)
  - `packages/db/prisma/schema.prisma` and migrations
  - `backend/src/lib/backup-format.ts`, `scripts/rehearse-recovery.ts`, and DAG acyclicity tests
  - Live PostgreSQL on port 55439 (`btree_gist` extension, `tsrange` GiST exclusion constraint validation)
- **Key findings**:
  1. DAG Acyclicity Invariant: `Room.currentStayId` must be a scalar `String?` without an `@relation` attribute to prevent dependency cycles in `backup-format.ts` and disaster recovery rehearsal.
  2. PostgreSQL GiST Exclusion Constraint: Prisma maps `DateTime` to `TIMESTAMP(3)` without timezone. In PostgreSQL, `tstzrange` on timestamp without timezone is not immutable (`42P17`). However, `tsrange("startDate", "endDate", '[)')` is 100% IMMUTABLE and works cleanly with `btree_gist` on `("businessId", "roomId")`. Empirically verified to permit adjacent intervals and reject overlaps with SQL code `23P01`.
  3. Domain services required: 6 distinct services with atomic CAS and `serializable` transactions.
  4. API endpoints required: 18 endpoints under `backend/src/app/api/v1/hotel/`.
- **Unexplored areas**: None, all critical paths explored and verified.

## Key Decisions Made
- Use `tsrange("startDate", "endDate", '[)')` with `btree_gist` for the PostgreSQL GiST exclusion constraint.
- Structure `RoomAllocation` as the authoritative interval locking table.
- Keep `Room.currentStayId` as a pure scalar to guarantee DR rehearsal compatibility.

## Artifact Index
- DISPATCH.md — record of incoming dispatch messages
- progress.md — liveness heartbeat and progress log
- handoff.md — final 5-component handoff report
