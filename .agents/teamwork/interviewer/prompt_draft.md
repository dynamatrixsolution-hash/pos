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
