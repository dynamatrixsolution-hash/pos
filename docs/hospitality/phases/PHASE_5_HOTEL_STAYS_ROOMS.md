# Phase 5: Hotel Inventory, Rooms & Guest Stays

> **Status**: Completed & Verified.
> **Dependencies**: Phase 1 & Phase 2.

## 1. Objectives & Scope
- Model hotel physical room inventory, room types, rates, and occupancy calendar.
- Enforce authoritative PostgreSQL GiST exclusion constraints (`btree_gist` + `tsrange("startDate", "endDate", '[)')`) to mathematically prevent double-booking at the database storage engine level.
- Manage guest reservations, check-in, atomic room transfers, stay extensions, and check-out workflows.
- Track housekeeping (`DIRTY`, `IN_PROGRESS`, `CLEAN`, `INSPECTED`) and maintenance ticket blocks (`MAINTENANCE`) independently from occupancy.

---

## 2. Key Entities & Schema Additions
Added 8 multi-tenant hotel models to `packages/db/prisma/schema.prisma` with composite `@@unique([businessId, id])` keys and acyclic DAG design (`Room.currentStayId` maintained as a scalar reference without circular relation) for disaster recovery:
1. `RoomType`: Category of accommodation (e.g., Deluxe King, Executive Suite) with base rate (`@db.Decimal(12, 2)`), max occupancy, and amenities.
2. `Room`: Physical room unit with room number, floor, capacity, operational status (`VACANT_CLEAN`, `VACANT_DIRTY`, `OCCUPIED_CLEAN`, `OCCUPIED_DIRTY`, `OUT_OF_SERVICE`, `MAINTENANCE`), and scalar `currentStayId`.
3. `Reservation`: Booking agreement holding guest info, check-in/out dates, deposit & total amounts (`@db.Decimal(12, 2)`), rate plan, and optimistic concurrency `version`.
4. `ReservationGuest`: Companion guest profiles associated with a reservation.
5. `Stay`: Active hotel stay binding guests to a physical room, check-in/out timestamps, expected checkout, rate per night, paid/total amounts, and `version`.
6. `RoomAllocation`: Interval booking record holding `startDate`, `endDate`, `isBlocking`, and `status` (`CONFIRMED`, `CHECKED_IN`, `MAINTENANCE`, `COMPLETED`, `CANCELLED`).
7. `HousekeepingTask`: Housekeeping task tracking (`DIRTY`, `IN_PROGRESS`, `CLEAN`, `INSPECTED`), priority, and staff assignment.
8. `MaintenanceTicket`: Operational block preventing room allocation during repairs (`OPEN`, `IN_PROGRESS`, `RESOLVED`, `CANCELLED`).

---

## 3. Strict Concurrency & Exclusion Rules Enforced
- **PostgreSQL GiST Exclusion Constraint (`RoomAllocation_room_period_overlap_excl`)**:
  - `EXCLUDE USING gist ("roomId" WITH =, tsrange("startDate", "endDate", '[)') WITH &&) WHERE ("isBlocking" = true)`
  - Rejects overlapping blocking allocations for the same room at the PostgreSQL engine level (raising SQL `23P01`, mapped to `409 Conflict` / `ROOM_DOUBLE_BOOKED`).
  - Adjacent stays (departure at 11:00 AM, arrival at 11:00 AM) are permitted by half-open `[startDate, endDate)` intervals.
- **Atomic Compare-And-Swap (CAS) Room Check-In & Transfer**:
  - `checkInGuest` and `transferRoom` execute atomic `updateMany` CAS transitions on `Room` (`status in ["VACANT_CLEAN", "VACANT_DIRTY"]`, `currentStayId: null`), ensuring zero double-occupancy races.
  - `transferRoom` moves the stay atomically to the target room while preserving `stay.id`, `stay.stayNumber`, and guest identity, releasing the source room to `VACANT_DIRTY` and spawning a `HIGH`-priority `CHECK_OUT_CLEANING` task.
- **Decoupled Check-Out & Housekeeping**:
  - `checkOutStay` completes the stay, releases the active `RoomAllocation`, transitions the room to `VACANT_DIRTY` (never directly to `CLEAN`), and automatically creates a `DIRTY` `HousekeepingTask`.
  - Advancing the housekeeping task to `CLEAN` or `INSPECTED` transitions the room back to `VACANT_CLEAN` (or `OCCUPIED_CLEAN` if occupied).

---

## 4. Implemented Services, API Endpoints & UI/UX
- **Domain Services (`backend/src/lib/services/`)**:
  - [`room-availability-service.ts`](file:///c:/projects/pos/backend/src/lib/services/room-availability-service.ts): `HotelError`, `isExclusionViolation`, RoomType & Room CRUD, `getRoomAvailability`, `getTapeChartMatrix`.
  - [`hotel-reservation-service.ts`](file:///c:/projects/pos/backend/src/lib/services/hotel-reservation-service.ts): `createReservation`, `getReservations`, `getReservationById`, `updateReservation`, `cancelReservation`.
  - [`hotel-checkin-service.ts`](file:///c:/projects/pos/backend/src/lib/services/hotel-checkin-service.ts): `checkInGuest`, `getStays`, `extendStay`.
  - [`hotel-room-transfer-service.ts`](file:///c:/projects/pos/backend/src/lib/services/hotel-room-transfer-service.ts): `transferRoom`.
  - [`hotel-checkout-service.ts`](file:///c:/projects/pos/backend/src/lib/services/hotel-checkout-service.ts): `checkOutStay`.
  - [`hotel-housekeeping-service.ts`](file:///c:/projects/pos/backend/src/lib/services/hotel-housekeeping-service.ts): `createHousekeepingTask`, `getHousekeepingTasks`, `updateHousekeepingTaskStatus`, `createMaintenanceTicket`, `getMaintenanceTickets`, `resolveMaintenanceTicket`.
- **REST API Endpoints (`backend/src/app/api/v1/hotel/`)**:
  - `GET, POST /api/v1/hotel/room-types` & `PATCH, DELETE /api/v1/hotel/room-types/[id]`
  - `GET, POST /api/v1/hotel/rooms` & `PATCH /api/v1/hotel/rooms/[id]`
  - `GET /api/v1/hotel/availability` & `GET /api/v1/hotel/tape-chart`
  - `GET, POST /api/v1/hotel/reservations` & `GET, PATCH, DELETE /api/v1/hotel/reservations/[id]`
  - `GET, POST /api/v1/hotel/stays` & `POST /api/v1/hotel/stays/check-in`
  - `POST /api/v1/hotel/stays/[id]/transfer`, `POST /api/v1/hotel/stays/[id]/extend`, `POST /api/v1/hotel/stays/[id]/check-out`
  - `GET, POST /api/v1/hotel/housekeeping` & `PATCH /api/v1/hotel/housekeeping/[id]`
  - `GET, POST /api/v1/hotel/maintenance` & `PATCH /api/v1/hotel/maintenance/[id]`
- **Hospitality UI/UX (`frontend/src/app/dashboard/hotel/`)**:
  - [`/dashboard/hotel/rooms`](file:///c:/projects/pos/frontend/src/app/dashboard/hotel/rooms/page.tsx): Interactive Room Rack & Tape Chart matrix (7D/14D horizon) with RestroInn semantic tokens (Vacant Clean `#28634B`, Occupied `#6B2837`, Vacant Dirty `#946000`, Maintenance `#B33432`) and Fast Check-In drawer.
  - [`/dashboard/hotel/reservations`](file:///c:/projects/pos/frontend/src/app/dashboard/hotel/reservations/page.tsx): Reservation management, creation modal, one-click Check-In and cancellation.
  - [`/dashboard/hotel/stays`](file:///c:/projects/pos/frontend/src/app/dashboard/hotel/stays/page.tsx): Active In-House Stays with Room Transfer, Stay Extension, and Check-Out modals.
  - [`/dashboard/hotel/housekeeping`](file:///c:/projects/pos/frontend/src/app/dashboard/hotel/housekeeping/page.tsx): Housekeeping status progression board and Maintenance ticket blocks.
  - Sidebar navigation updated in [`frontend/src/lib/nav-config.ts`](file:///c:/projects/pos/frontend/src/lib/nav-config.ts).

---

## 5. Verification Evidence

| Test Suite / Command | Scope | Result |
| :--- | :--- | :---: |
| `tests/phase5-hotel-stays.integration.test.ts` | 10-way concurrent GiST exclusion (1 win, 9 reject `409`), adjacent half-open interval, check-in, atomic room transfer, checkout dirty transition, maintenance blocking | **5/5 PASSED** |
| `tests/challenger-p5-m1-schema-acyclicity.test.ts` | 75-model DAG topological acyclicity, composite tenant keys, `Room.currentStayId` scalar cycle prevention | **20/20 PASSED** |
| `tests/adversarial-p5-m1-gist-constraint.test.ts` | PostgreSQL `btree_gist` exclusion DDL and interval overlap verification | **13/13 PASSED** |
| `npm test` | All unit & invariant test suites (13 test files) | **136 PASSED** |
| `scripts/restro-restore-env.mjs rehearse` | 75-model disaster recovery rehearsal, topological sort, tenant isolation | **41/41 PASSED** |
| `npm run typecheck` | Cross-workspace strict TypeScript typecheck (`backend` + `frontend`) | **0 ERRORS** |
