# Original User Request

## Initial Request — 2026-11-01T03:22:30Z

Organize work using the specialized 4-agent roles requested by the user:
- Planner: Architecture & Invariants (Table/Order State Machine Lifecycles, 3D status separation, table sessions, rounds).
- Designer: Refined Hospitality UI/UX per `.agent/skill/uiuxskills.md` (Floor grid, table occupancy badges, touch-friendly modifier modal with price deltas, compact menu grid, split-billing sheet).
- Builder: Full-Stack Engineer per `.agent/skill/stack.md` (Next.js 16, React 19, Prisma schema, additive migrations, Decimal pricing deltas).
- Tester: Adversarial Concurrency, State Machine Invariants, Multi-Round Order Integrity, and Reconciliation.
Implement Phase 3: Restaurant Staff MVP (Dine-in, Tables, Menus & Orders) for production as specified in `docs/hospitality/phases/PHASE_3_RESTAURANT_MVP.md` and `docs/hospitality/IMPLEMENTATION_PLAN.md`.

Working directory: c:\projects\pos
Integrity mode: development

## Requirements

### R1. Floor & Table Management
Provide floor plans and dining table entities with occupancy status (Available, Occupied, Reserved, Billed) and seating capacity. Support active table sessions that track dining parties and accumulate orders, with atomic table move and table merge operations that transfer open sessions without duplicating lines.

### R2. Restaurant Menu & Modifier Catalog
Implement a hierarchical catalog with menus, sections, items, modifier groups, and options with Decimal price deltas. Ensure order lines snapshot base prices, applied modifiers, tax, and notes immutably upon order submission.

### R3. Multi-Round Orders & Three-Dimensional Status Separation
Implement restaurant orders supporting multiple rounds (e.g., drinks, appetizers, mains), preserving all items and states from earlier rounds when submitting subsequent rounds. Enforce independent three-dimensional status lifecycles:
- Acceptance: PENDING -> ACCEPTED -> REJECTED (rejections/voids require mandatory staff reason and audit record).
- Fulfillment: QUEUED -> PREPARING -> READY -> SERVED -> CANCELLED.
- Settlement: UNPAID -> PARTIAL -> PAID -> REFUNDED.
Enforce the invariant that paying for an order does not mark food served.

### R4. Hospitality Staff POS UI/UX
Implement refined hospitality staff UI/UX per `.agent/skill/uiuxskills.md`, including an interactive floor grid with table occupancy badges, a compact POS menu item grid with category quick-switching, a touch-friendly modifier selection modal with instant price delta calculations, and a split-billing sheet supporting itemized splitting and equal shares.

### R5. Concurrency, Tenant Isolation, Scope & Documentation
Maintain strict multi-tenant isolation using composite businessId keys and compatibility with the disaster recovery backup topology. Ensure concurrent order or session updates across terminals handle versioning gracefully, failing closed on stale writes to settled or voided lines. Restrict scope strictly to Phase 3 Restaurant Staff MVP, deferring KDS routing/printing and recipe consumption to Phase 4. Update `docs/hospitality/phases/PHASE_3_RESTAURANT_MVP.md` to document implemented schema additions, rules, and exit criteria status.

## Verification Resources
- Isolated PostgreSQL container on 127.0.0.1:55439.
- Monorepo typecheck: `npm.cmd run typecheck`.
- Full test suites: `npm.cmd test`, `node scripts/restro-env.mjs recovery-test`, `node scripts/restro-restore-env.mjs rehearse`.
- Production builds: `node scripts/restro-env.mjs backend-build` and `node scripts/restro-env.mjs frontend-build`.

## Acceptance Criteria

### Core Schema & State Invariants
- [ ] Schema additions for Floor, RestaurantTable, TableSession, Menu, MenuSection, MenuItem, ModifierGroup, ModifierOption, MenuItemModifierGroup, RestaurantOrder, OrderLine, and OrderRound are defined with Decimal pricing deltas and multi-tenant composite keys.
- [ ] Three-dimensional status lifecycles (Acceptance, Fulfillment, Settlement) operate independently; paying for an order does not transition lines to SERVED.
- [ ] Moving or merging tables transfers open sessions atomically without duplicating line items.
- [ ] Submitting Round 2 preserves all items and states from Round 1.
- [ ] Voiding or rejecting order lines requires a mandatory staff reason and preserves audit history.

### User Interface & Ergonomics
- [ ] Interactive floor grid displays real-time occupancy status (Available, Occupied, Reserved, Billed).
- [ ] Touch-friendly modifier selection modal displays and updates price deltas.
- [ ] Compact menu grid enables category quick-switching.
- [ ] Split-billing sheet supports splitting by item and by equal shares.

### Automated Testing & System Verification
- [ ] Concurrent terminal operations on the same table session handle version conflicts gracefully without state corruption.
- [ ] Stale writes against settled or voided lines fail closed.
- [ ] `npm.cmd run typecheck` passes with exit code 0.
- [ ] `npm.cmd test`, `node scripts/restro-env.mjs recovery-test`, and `node scripts/restro-restore-env.mjs rehearse` all pass with zero regressions.
- [ ] `node scripts/restro-env.mjs backend-build` and `node scripts/restro-env.mjs frontend-build` succeed with 0 errors.

### Documentation
- [ ] `docs/hospitality/phases/PHASE_3_RESTAURANT_MVP.md` is updated with completed implementation details and verification results.


## Follow-up — 2026-11-01T04:22:50Z

The host server restarted. Postgres containers on ports 55439 and 55440 are verified up and healthy. Additive migration 202611010001_phase3_restaurant_staff_mvp is verified applied to both restro_test (55439) and restro_restore (55440). Prisma client has been generated and engines copied. Please resume orchestration immediately from Milestone 1 gate verification and proceed into Milestone 2 (Floor & Table Management Services).

## Follow-up — 2026-11-01T05:17:19Z

Use multiple best models whenever needed to complete Phase 5 (Hotel Inventory, Rooms & Guest Stays) properly and fast for the RestroInn platform in production.

Integrity mode: development

Reference material:
- Specification: `docs/hospitality/phases/PHASE_5_HOTEL_STAYS_ROOMS.md`

## Requirements

### R1. Multi-Tenant Schema Additions & Database Migrations
Add the multi-tenant Prisma models for hotel inventory and stays in `packages/db/prisma/schema.prisma`:
- `RoomType`: Category of accommodation with base rate, max occupancy, amenities.
- `Room`: Physical room unit with room number, floor, status (`VACANT_CLEAN`, `VACANT_DIRTY`, `OCCUPIED_CLEAN`, `OCCUPIED_DIRTY`, `OUT_OF_SERVICE`, `MAINTENANCE`), branch/business isolation.
- `Reservation`: Booking agreement holding guests, dates (checkInDate, checkOutDate), status (`CONFIRMED`, `CHECKED_IN`, `CHECKED_OUT`, `CANCELLED`, `NO_SHOW`), rate plan.
- `ReservationGuest`: Guest profiles associated with reservations.
- `Stay`: Active hotel stay binding guest to a room, check-in timestamp, check-out timestamp, status (`ACTIVE`, `COMPLETED`, `EXTENDED`, `TRANSFERRED`).
- `RoomAllocation`: Interval booking record holding `startDate`, `endDate`, `isBlocking`, and exclusion logic.
- `HousekeepingTask`: Housekeeping status tracking (`CLEAN`, `DIRTY`, `INSPECTED`, priority, notes, assigned staff).
- `MaintenanceTicket`: Operational block preventing room allocation during repairs.
- Strict composite tenant isolation: `@@unique([businessId, id])` across all models.
- Additive Prisma migration applied to both database clusters: port `55439` (restro_test) and port `55440` (restro_restore).
- Maintain Acyclic DAG topology for Disaster Recovery rehearsal in `backup-format.ts`.

### R2. Domain Services
Implement domain services in `backend/src/lib/services/`:
- Room management & availability calendar service.
- Reservation service (create, modify, cancel, no-show).
- Check-in service (atomic allocation lock, stay record creation, transition room to `OCCUPIED_CLEAN` or `OCCUPIED_DIRTY`).
- Room transfer service (atomic move of active allocation to a new room preserving stay identity).
- Check-out service (releases occupancy, marks room as `VACANT_DIRTY`, creates `HousekeepingTask`).
- Housekeeping & Maintenance service (update room cleaning status, create maintenance block).

### R3. API Endpoints
Implement API routes in `backend/src/app/api/v1/hotel/`:
- Room types & rooms CRUD and status endpoints.
- Reservations & guest bookings endpoints.
- Check-in, stay extension, room transfer, and check-out endpoints.
- Housekeeping tasks and status transition endpoints.

### R4. UI/UX Ergonomics
Implement hotel dashboard interface in `frontend/src/app/dashboard/hotel/`:
- Interactive Room Rack / Tape Chart matrix of rooms vs dates with occupancy status colors per RestroInn design tokens:
  - Vacant Clean: Soft forest / Emerald
  - Occupied: Soft burgundy (`#6B2837`)
  - Vacant Dirty: Soft ochre / Amber
  - Maintenance: Soft red
- Fast Check-In drawer / modal (guest details, identification, rate selection).
- Sidebar navigation integration in `frontend/src/lib/nav-config.ts`.

### R5. Quality & Verification
- Comprehensive integration test suite for Phase 5 covering concurrency and double-booking race condition checks, room transfer atomicity, and check-out housekeeping triggers.
- Full test suite passing via `npm test`.
- Full TypeScript check passing with 0 errors via `npm run typecheck` across frontend and backend.
- Disaster recovery rehearsal passing via `node scripts/restro-restore-env.mjs rehearse`.
- Successful frontend and backend builds.

## Acceptance Criteria

### Schema & Migrations
- [ ] Prisma schema includes `RoomType`, `Room`, `Reservation`, `ReservationGuest`, `Stay`, `RoomAllocation`, `HousekeepingTask`, and `MaintenanceTicket` with `@@unique([businessId, id])`.
- [ ] Additive migrations applied cleanly to both test and restore database instances (ports 55439 and 55440).
- [ ] Disaster recovery rehearsal (`node scripts/restro-restore-env.mjs rehearse`) passes 100% on the updated model set with acyclic DAG topology.

### Domain Logic & APIs
- [ ] Concurrent reservation/check-in requests for overlapping dates on the same room result in exactly one successful booking and conflict rejection (`409 Conflict`) for competing requests.
- [ ] Check-in transitions room status to occupied and creates an active stay.
- [ ] Room transfer atomically reassigns room allocation while preserving stay and guest identity.
- [ ] Check-out completes stay, transitions room to `VACANT_DIRTY`, and generates a `HousekeepingTask` with `DIRTY` status.
- [ ] Maintenance ticket creates a blocking allocation preventing room bookings during the maintenance window.
- [ ] All hotel API endpoints in `backend/src/app/api/v1/hotel/` return appropriate status codes and validated payloads.

### UI & Navigation
- [ ] Hotel section accessible from navigation sidebar in `frontend/src/lib/nav-config.ts`.
- [ ] Room Rack / Tape Chart displays matrix of rooms by date using token colors (Emerald for Vacant Clean, Soft burgundy `#6B2837` for Occupied, Amber for Vacant Dirty, Soft red for Maintenance).
- [ ] Fast Check-In modal/drawer captures guest details and initiates check-in.

### Build & Verification
- [ ] `npm test` runs and passes with zero test failures.
- [ ] `npm run typecheck` passes with zero errors across the monorepo.
- [ ] Frontend and backend production builds compile without errors.

## Follow-up — 2026-11-01T05:58:43Z

User Directive on Phase 5 Execution Speed & Parallelism:
"complete this phase fast ok hope u achive all the milestone properly"

Instructions:
1. Prioritize speed: dispatch Milestone 2 (Domain Services), Milestone 3 (API routes), and Milestone 4 (UI/UX) in parallel where the interface contracts defined in `PROJECT.md` allow.
2. Keep review gates lean, focused, and rigorous.
3. Ensure all acceptance criteria (concurrency 409, transfer atomicity, checkout housekeeping, maintenance blocking, npm test, typecheck, DR rehearse, and both builds) pass before claiming completion.
4. Record this update in your ORIGINAL_REQUEST.md tracking.


## Follow-up — 2026-11-01T05:58:30Z

User request: "complete this phase fast ok hope u achive all the milestone properly". Please prioritize speed: run M2 (services) and M3 (API routes) and M4 (UI) in parallel where interface contracts in PROJECT.md allow, keep review gates lean but rigorous, and ensure all acceptance criteria (concurrency 409, transfer atomicity, checkout housekeeping, maintenance blocking, npm test, typecheck, DR rehearse, both builds) pass before reporting completion.
