# Project: RestroInn Phase 5 — Hotel Inventory, Rooms & Guest Stays

## Architecture

RestroInn Phase 5 implements the complete Hotel Management domain across the monorepo:
1. **Database & DR Layer (`packages/db`)**:
   - Multi-tenant Prisma models: `RoomType`, `Room`, `Reservation`, `ReservationGuest`, `Stay`, `RoomAllocation`, `HousekeepingTask`, `MaintenanceTicket`.
   - Strict composite tenant isolation: `@@unique([businessId, id])` across all models.
   - DAG Acyclicity: `Room.currentStayId` is maintained as a scalar `String?` without an `@relation` attribute to guarantee topological acyclicity for disaster recovery (`backup-format.ts`).
   - PostgreSQL GiST Exclusion Constraint: `tsrange("startDate", "endDate", '[)')` with `btree_gist` on `RoomAllocation` enforcing half-open interval double-booking prevention at the database engine level (throwing SQL `23P01`).
   - Dual-cluster additive migrations applied to both `restro_test` (port 55439) and `restro_restore` (port 55440).
2. **Backend Domain Services & Concurrency (`backend/src/lib/services/`)**:
   - `room-availability-service.ts`: Catalog, status tracking, interval availability calculation, tape chart allocation matrix.
   - `hotel-reservation-service.ts`: Reservation lifecycle (`CONFIRMED`, `CHECKED_IN`, `CHECKED_OUT`, `CANCELLED`, `NO_SHOW`), room allocations, optimistic versioning.
   - `hotel-checkin-service.ts`: Atomic room check-in (walk-in or reservation), atomic Compare-And-Swap (CAS) on room status, stay creation, race condition rejection (`409 Conflict`).
   - `hotel-room-transfer-service.ts`: Atomic transfer of active stay to destination room, closing source allocation, marking source room `VACANT_DIRTY`, auto-generating dirty housekeeping task, and preserving stay identity.
   - `hotel-checkout-service.ts`: Completing stay, releasing room occupancy to `VACANT_DIRTY`, auto-generating `HousekeepingTask` with `DIRTY` status.
   - `hotel-housekeeping-service.ts`: Cleanliness lifecycle (`DIRTY` -> `IN_PROGRESS` -> `CLEAN` -> `INSPECTED`), maintenance tickets and blocking allocations.
3. **Backend API Endpoints (`backend/src/app/api/v1/hotel/`)**:
   - REST endpoints with Zod validation, multi-tenant session context, and standardized status codes (`200`, `201`, `400`, `401`, `403`, `404`, `409 Conflict`).
4. **Frontend UI/UX Ergonomics (`frontend/src/app/dashboard/hotel/`)**:
   - Room Rack / Tape Chart matrix of rooms vs dates (7/14/30 days) with RestroInn design token colors:
     - Vacant Clean: Emerald (`#28634B`)
     - Occupied: Soft burgundy (`#6B2837`)
     - Vacant Dirty: Soft ochre / Amber (`#946000`)
     - Maintenance: Soft red (`#B33432`)
     - Confirmed Reservation: Soft blue (`#315F85`)
   - Fast Check-In drawer / modal with guest identity, ID verification, rate plan, monetary precision using `@/lib/currency`.
   - Housekeeping board with quick status toggles.
   - Sidebar navigation integration in `frontend/src/lib/nav-config.ts`.
5. **E2E & Disaster Recovery Verification (`tests/`)**:
   - Integration test suite covering concurrent race conditions, room transfer atomicity, checkout housekeeping triggers, and maintenance blocking.
   - DR rehearsal passing 100% on port 55440 with 75 models.

---

## Feature Inventory

| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Multi-Tenant Schema Models | 8 models (`RoomType`, `Room`, `Reservation`, `ReservationGuest`, `Stay`, `RoomAllocation`, `HousekeepingTask`, `MaintenanceTicket`) with `@@unique([businessId, id])` | M1 | Survey (p5_spec_miner_schema) |
| 2 | DR Acyclic DAG Topology | `Room.currentStayId` scalar logical ID without `@relation` attribute to prevent cycles in `backup-format.ts` | M1 | Survey (p5_spec_miner_schema) |
| 3 | PostgreSQL GiST Exclusion Constraint | `tsrange("startDate", "endDate", '[)')` with `btree_gist` preventing overlapping blocking allocations | M1 | Survey (p5_explorer_backend, p5_spec_miner_schema) |
| 4 | Dual Cluster Database Migration | Migration script applied cleanly to port 55439 (`restro_test`) and port 55440 (`restro_restore`) | M1 | Survey (p5_spec_miner_schema) |
| 5 | DR Synthetic Date Intervals | Adjust `rehearse-recovery.ts` and `recovery.integration.test.ts` for 75 models and `startDate < endDate` | M1 | Survey (p5_spec_miner_schema) |
| 6 | Room Catalog & Availability Service | `room-availability-service.ts` for rooms, room types, tape chart data, and date-range availability | M2 | Survey (p5_explorer_backend) |
| 7 | Hotel Reservation Service | `hotel-reservation-service.ts` for booking lifecycle, guest companion records, cancellation, and no-shows | M2 | Survey (p5_explorer_backend) |
| 8 | Concurrency-Safe Check-In Service | `hotel-checkin-service.ts` with atomic CAS room status transition and GiST double-booking rejection (`409 Conflict`) | M2 | Survey (p5_explorer_backend) |
| 9 | Atomic Room Transfer Service | `hotel-room-transfer-service.ts` moving stay between rooms atomically and generating source housekeeping dirty task | M2 | Survey (p5_explorer_backend) |
| 10 | Decoupled Check-Out Service | `hotel-checkout-service.ts` releasing stay, marking room `VACANT_DIRTY`, and generating `HousekeepingTask` with `DIRTY` status | M2 | Survey (p5_explorer_backend) |
| 11 | Housekeeping & Maintenance Service | `hotel-housekeeping-service.ts` for cleaning progression (`CLEAN`, `INSPECTED`) and blocking maintenance tickets | M2 | Survey (p5_explorer_backend) |
| 12 | Room Types & Rooms API Endpoints | `/api/v1/hotel/room-types` and `/api/v1/hotel/rooms` CRUD and status update routes | M3 | Survey (p5_explorer_backend) |
| 13 | Reservations API Endpoints | `/api/v1/hotel/reservations` CRUD and cancel routes | M3 | Survey (p5_explorer_backend) |
| 14 | Stays Lifecycle API Endpoints | `/api/v1/hotel/stays/check-in`, `transfer`, `extend`, and `check-out` routes | M3 | Survey (p5_explorer_backend) |
| 15 | Housekeeping & Maintenance API Endpoints | `/api/v1/hotel/housekeeping` and `/api/v1/hotel/maintenance` routes | M3 | Survey (p5_explorer_backend) |
| 16 | Availability & Tape Chart API Endpoints | `/api/v1/hotel/availability` and `/api/v1/hotel/tape-chart` routes | M3 | Survey (p5_explorer_backend) |
| 17 | Sidebar Navigation Integration | `Hotel` nav item in `frontend/src/lib/nav-config.ts` with 4 child routes | M4 | Survey (p5_explorer_frontend) |
| 18 | Interactive Room Rack / Tape Chart UI | `/dashboard/hotel/rooms` date matrix with RestroInn token colors and stay bar spans | M4 | Survey (p5_explorer_frontend) |
| 19 | Fast Check-In Drawer UI | Slide-over modal capturing guest profile, identification, room selection, and rate plan with `@/lib/currency` | M4 | Survey (p5_explorer_frontend) |
| 20 | In-House Stays & Stay Actions UI | `/dashboard/hotel/stays` with modals for atomic transfer, stay extension, and checkout | M4 | Survey (p5_explorer_frontend) |
| 21 | Housekeeping & Maintenance Board UI | `/dashboard/hotel/housekeeping` with clean/dirty/inspected quick actions and maintenance ticket creation | M4 | Survey (p5_explorer_frontend) |
| 22 | Reservations Management UI | `/dashboard/hotel/reservations` booking management view | M4 | Survey (p5_explorer_frontend) |
| 23 | Concurrency & Race Condition Test Suite | `tests/phase5-hotel-stays.integration.test.ts` testing 10 parallel overlapping requests (1 win, 9 reject 409) | M5 | Survey (p5_explorer_backend) |
| 24 | Room Transfer & Checkout Invariant Tests | Integration tests validating atomic transfer, checkout dirty transition, and housekeeping spawn | M5 | Survey (p5_explorer_backend) |
| 25 | Full Monorepo Typecheck & Test Pass | `npm run typecheck` and `npm test` passing with 0 errors | M5 | Survey (p5_explorer_backend, p5_explorer_frontend) |
| 26 | Disaster Recovery Rehearsal Pass | `node scripts/restro-restore-env.mjs rehearse` passing 100% across all 75 models | M5 | Survey (p5_spec_miner_schema) |
| 27 | Production Builds Pass | Frontend and backend Next.js production builds compile without errors | M5 | Survey (p5_explorer_frontend) |

---

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Multi-Tenant Schema, GiST Constraint & DR DAG | `schema.prisma` additions, `migration.sql` with `btree_gist` and `tsrange` exclusion constraint, dual cluster migration (55439 & 55440), update `backup-format.ts`, `rehearse-recovery.ts`, and `recovery.integration.test.ts` | none | COMPLETED |
| M2 | Hotel Domain Services & Concurrency | `room-availability-service.ts`, `hotel-reservation-service.ts`, `hotel-checkin-service.ts`, `hotel-room-transfer-service.ts`, `hotel-checkout-service.ts`, `hotel-housekeeping-service.ts` with atomic CAS and exclusion error mapping | M1 | COMPLETED |
| M3 | Hotel REST API Endpoints | All routes in `backend/src/app/api/v1/hotel/` for room types, rooms, reservations, check-in, transfer, extend, checkout, housekeeping, maintenance, tape-chart | M2 | COMPLETED |
| M4 | Hotel UI/UX Ergonomics & Tape Chart | `frontend/src/lib/nav-config.ts`, `/dashboard/hotel/rooms` (Tape Chart), `/dashboard/hotel/stays`, `/dashboard/hotel/housekeeping`, `/dashboard/hotel/reservations`, Fast Check-In drawer, Stay action modals | M3 | COMPLETED |
| M5 | Comprehensive Verification, E2E & DR Rehearsal | Integration test suite `tests/phase5-hotel-stays.integration.test.ts`, `npm test`, `npm run typecheck`, DR rehearsal (`rehearse`), production builds | M4 | COMPLETED |

---

## Interface Contracts

### Domain Services <-> API Layer
- `RoomAvailabilityService`:
  - `getRoomAvailability(businessId, branchId, { startDate, endDate, roomTypeId? }): Promise<AvailabilityResult>`
  - `getTapeChartMatrix(businessId, branchId, { startDate, endDate, floorId? }): Promise<TapeChartResult>`
- `HotelReservationService`:
  - `createReservation(businessId, branchId, data): Promise<Reservation>`
  - `cancelReservation(businessId, branchId, id, reason?): Promise<Reservation>`
- `HotelCheckinService`:
  - `checkIn(businessId, branchId, data): Promise<{ stay: Stay, room: Room }>` -> Throws `HotelError(409)` on conflict
- `HotelRoomTransferService`:
  - `transferRoom(businessId, branchId, stayId, targetRoomId, reason?): Promise<{ stay: Stay, sourceRoom: Room, targetRoom: Room }>`
- `HotelCheckoutService`:
  - `checkOut(businessId, branchId, stayId, options?): Promise<{ stay: Stay, room: Room, housekeepingTask: HousekeepingTask }>`
- `HotelHousekeepingService`:
  - `updateTaskStatus(businessId, branchId, taskId, status, userId?): Promise<{ task: HousekeepingTask, room?: Room }>`
  - `createMaintenanceTicket(businessId, branchId, data): Promise<{ ticket: MaintenanceTicket, room: Room }>`

### Backend API <-> Frontend Client
- Proxied via `frontend/next.config.ts` rewrites from `/api/v1/hotel/*` to `http://localhost:3001/api/v1/hotel/*`.
- Standard JSON responses `{ [entityName]: data }` or `{ error: string, code?: string }`.
- Error code `409 Conflict` signals double-booking collision or stale state.

---

## Code Layout

- `packages/db/prisma/schema.prisma`: Multi-tenant hotel models
- `packages/db/prisma/migrations/202611010003_phase5_hotel_stays_rooms/migration.sql`: Additive migration DDL + `btree_gist` exclusion constraint
- `backend/src/lib/backup-format.ts`: Disaster recovery model topology
- `scripts/rehearse-recovery.ts`: Synthetic data generator with valid date intervals
- `backend/src/lib/services/`:
  - `room-availability-service.ts`
  - `hotel-reservation-service.ts`
  - `hotel-checkin-service.ts`
  - `hotel-room-transfer-service.ts`
  - `hotel-checkout-service.ts`
  - `hotel-housekeeping-service.ts`
- `backend/src/app/api/v1/hotel/`:
  - `room-types/route.ts` & `room-types/[id]/route.ts`
  - `rooms/route.ts` & `rooms/[id]/route.ts` & `rooms/[id]/status/route.ts`
  - `availability/route.ts`
  - `tape-chart/route.ts`
  - `reservations/route.ts` & `reservations/[id]/route.ts` & `reservations/[id]/cancel/route.ts`
  - `stays/check-in/route.ts`
  - `stays/[id]/transfer/route.ts`
  - `stays/[id]/extend/route.ts`
  - `stays/[id]/check-out/route.ts`
  - `housekeeping/route.ts` & `housekeeping/[id]/route.ts`
  - `maintenance/route.ts` & `maintenance/[id]/resolve/route.ts`
- `frontend/src/lib/nav-config.ts`: Sidebar navigation
- `frontend/src/lib/hotel-api.ts`: API client types and functions
- `frontend/src/app/dashboard/hotel/`:
  - `rooms/page.tsx`: Interactive Tape Chart / Room Rack
  - `stays/page.tsx`: In-House Stays & Fast Check-In
  - `reservations/page.tsx`: Future Bookings
  - `housekeeping/page.tsx`: Housekeeping & Maintenance Board
- `frontend/src/components/hotel/`:
  - `tape-chart-matrix.tsx`
  - `fast-check-in-drawer.tsx`
  - `stay-actions-modals.tsx`
  - `housekeeping-grid.tsx`
- `tests/`:
  - `phase5-hotel-stays.integration.test.ts`: Concurrency, transfer, checkout, maintenance test suite
