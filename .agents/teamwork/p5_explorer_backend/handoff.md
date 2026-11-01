# Phase 5: Hotel Stays, Rooms, Housekeeping & Maintenance — Backend & API Survey Report

## 1. Observation

### 1.1 Existing Architecture & Standards in the Codebase

1. **Multi-Tenant Isolation Invariant**:
   - In `packages/db/prisma/schema.prisma`, every multi-tenant table defines `businessId String`, references `Business(id) ON DELETE CASCADE`, and enforces `@@unique([businessId, id])`.
   - In `backend/src/lib/services/floor-table-service.ts` (lines 114-131) and `backend/src/lib/services/table-session-service.ts` (lines 155-166), every query and mutation filters strictly by `businessId` and verifies branch membership against `context.branchId`.

2. **Topological DAG Ordering & Disaster Recovery Acyclicity**:
   - In `backend/src/lib/backup-format.ts` (lines 12-19):
     ```ts
     const models = Prisma.dmmf.datamodel.models.filter(model => !excludedModels.includes(model.name));
     export const backupModels: typeof models = [];
     const pending = [...models];
     while (pending.length) {
       const index = pending.findIndex(model => model.fields.filter(field => field.relationFromFields?.length).every(field => backupModels.some(parent => parent.name === field.type)));
       if (index < 0) throw new Error("Backup schema has unsupported dependency cycle");
       backupModels.push(pending.splice(index, 1)[0]);
     }
     ```
   - In `packages/db/prisma/schema.prisma` line 1159:
     ```prisma
     currentSessionId String? // Scalar logical ID without @relation to preserve DAG acyclicity
     ```
   - In `tests/challenger-p3-m1-schema-acyclicity.test.ts` (lines 186-211), giving `currentSessionId` an `@relation` to `TableSession` causes `topologicalSort()` to fail with:
     `"Backup schema has unsupported dependency cycle"`.
   - Therefore, in Phase 5, any reference from `Room` back to `Stay` (`Room.currentStayId`) **must be a pure scalar `String?` without an `@relation` attribute**.

3. **Concurrency & Atomic CAS Patterns**:
   - In `backend/src/lib/commerce-transaction.ts` (lines 19-28), transactions requiring serializability use `serializable(work)`:
     ```ts
     export async function serializable<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
       for (let attempt = 0; ; attempt++) {
         try {
           return await db.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10000, timeout: 30000 });
         } catch (error) {
           if ((error as { code?: string }).code !== "P2034") throw error;
           if (attempt >= 3) throw new CommerceError("Concurrent update; retry with the same Idempotency-Key", 409);
         }
       }
     }
     ```
   - In `backend/src/lib/services/table-session-service.ts` (lines 217-235), state transitions use atomic Compare-And-Swap (`updateMany` with expected predicate) checking `tableUpdate.count === 0` to immediately reject concurrent collisions with HTTP `409 Conflict`.

4. **PostgreSQL GiST Exclusion Constraint Verification**:
   - Phase 5 specification in `docs/hospitality/phases/PHASE_5_HOTEL_STAYS_ROOMS.md` requires:
     `EXCLUDE USING gist (room_id WITH =, allocation_period WITH &&) WHERE (is_blocking = true)`
   - Empirical test on live PostgreSQL 15.18 container (port 55439) revealed:
     - Testing `tstzrange("startDate", "endDate", '[)')` against Prisma `TIMESTAMP(3)` columns failed with PostgreSQL error:
       `Raw query failed. Code: 42P17. Message: ERROR: functions in index expression must be marked IMMUTABLE`
       (because `TIMESTAMP(3)` is `timestamp without time zone`, and converting it to `timestamptz` depends on the server session's `TimeZone`).
     - Testing `tsrange("startDate", "endDate", '[)')` with `btree_gist` succeeded 100%:
       ```sql
       CREATE EXTENSION IF NOT EXISTS btree_gist;

       ALTER TABLE "RoomAllocation"
       ADD CONSTRAINT "RoomAllocation_no_overlap_blocking"
       EXCLUDE USING gist (
         "businessId" WITH =,
         "roomId" WITH =,
         tsrange("startDate", "endDate", '[)') WITH &&
       ) WHERE ("isBlocking" = true);
       ```
     - Results verified:
       - Adjacent allocations (`[2026-11-01 14:00, 2026-11-05 11:00)` and `[2026-11-05 11:00, 2026-11-10 11:00)`) succeeded without collision.
       - Overlapping allocation (`[2026-11-03 14:00, 2026-11-07 11:00)`) was immediately rejected by PostgreSQL with:
         `Code: 23P01. Message: ERROR: conflicting key value violates exclusion constraint "RoomAllocation_no_overlap_blocking"`

5. **API Route & Session Context Helpers**:
   - `backend/src/app/api/v1/restaurant/` routes import `getSessionContext` and `authErrorResponse` from `@/lib/api-helper`.
   - Status codes: `201 Created` for creations, `200 OK` for mutations/queries, `400 Bad Request` for Zod schema validation errors, `401 Unauthorized` for missing session, `403 Forbidden` for role violations, `404 Not Found` for missing resources, `409 Conflict` for state collisions or exclusion constraint violations.

---

## 2. Logic Chain

1. **Multi-Tenant Composite Keys**:
   - From Observation 1.1, all existing entities are scoped by `businessId`. To adhere to restro monorepo invariants, all 8 Phase 5 entities (`RoomType`, `Room`, `Reservation`, `ReservationGuest`, `Stay`, `RoomAllocation`, `HousekeepingTask`, `MaintenanceTicket`) must include `businessId String`, link to `Business`, and declare `@@unique([businessId, id])`.

2. **Topological Acyclicity**:
   - From Observation 1.2, `backup-format.ts` executes a topological sort on `Prisma.dmmf.datamodel.models`. If model $A$ references model $B$, and model $B$ references model $A$, the sort fails and disaster recovery rehearsal halts.
   - Therefore, the dependency graph must be strictly linear/directed:
     $$\text{Business} \to \text{RoomType} \to \text{Room} \to \text{Reservation} \to \text{ReservationGuest} \to \text{Stay} \to \text{MaintenanceTicket} \to \text{RoomAllocation} \to \text{HousekeepingTask}$$
   - `Room` must store `currentStayId String?` as a plain scalar without `@relation("RoomCurrentStay")`.

3. **Exclusion Constraint Precision**:
   - From Observation 1.4, Prisma maps `DateTime` fields to `TIMESTAMP(3)` without timezone. PostgreSQL rejects `tstzrange(timestamp, timestamp)` in index expressions as non-immutable (`42P17`).
   - Using `tsrange("startDate", "endDate", '[)')` with the `btree_gist` extension is mathematically immutable and enforces the half-open interval `[start, end)` semantic: arrival at 11:00 AM on checkout date does not collide with departure at 11:00 AM.
   - Any overlapping attempt triggers PostgreSQL error `23P01`, which our backend services catch and convert to HTTP `409 Conflict`.

4. **Service Segregation**:
   - Phase 5 requires clear domain service separation in `backend/src/lib/services/`:
     - `room-availability-service.ts`: Room catalog, availability queries, tape chart matrix.
     - `hotel-reservation-service.ts`: Booking lifecycle (`CONFIRMED`, `CHECKED_IN`, `CHECKED_OUT`, `CANCELLED`, `NO_SHOW`).
     - `hotel-checkin-service.ts`: Atomic room occupancy CAS and stay activation.
     - `hotel-room-transfer-service.ts`: Atomic move of active stay from source room to target room, generating dirty housekeeping task on source.
     - `hotel-checkout-service.ts`: Occupancy release, stay completion, automatic `VACANT_DIRTY` transition, and `HousekeepingTask` generation.
     - `hotel-housekeeping-service.ts`: Independent cleanliness tracking (`DIRTY` $\to$ `IN_PROGRESS` $\to$ `CLEAN` $\to$ `INSPECTED`) and maintenance blocking tickets.

---

## 3. Caveats

1. **PostgreSQL Extension Prerequisite**:
   - The PostgreSQL `btree_gist` extension must be installed before applying the exclusion constraint. The migration script must begin with `CREATE EXTENSION IF NOT EXISTS btree_gist;` so that both `restro_test` (55439) and `restro_restore` (55440) receive it automatically.
2. **Prisma Client Untyped Constraints**:
   - Prisma Client does not have a native `@gist` exclusion attribute in `schema.prisma`. The constraint must be defined via raw SQL migration in `packages/db/prisma/migrations/202611010003_phase5_hotel_stays_rooms/migration.sql`.
3. **Disaster Recovery Rehearsal Seed Data**:
   - In `scripts/rehearse-recovery.ts`, synthetic seeding sets all non-nullable `DateTime` fields without defaults to `2025-01-02T03:04:05.000Z`. If `RoomAllocation.startDate` has `@default(now())` while `endDate` does not, `startDate` would evaluate to `2026-11-01` and `endDate` to `2025-01-02`, violating `lower bound <= upper bound`.
   - **Mandatory Rule**: In `RoomAllocation`, neither `startDate` nor `endDate` should have `@default(now())` in the Prisma schema; defaults should be passed by services.

---

## 4. Conclusion & Concrete Blueprints

### 4.1 Schema Additions Blueprint (`packages/db/prisma/schema.prisma`)

```prisma
// ==========================================
// Phase 5: Hotel Inventory, Rooms & Guest Stays
// ==========================================

model RoomType {
  id            String   @id @default(uuid())
  businessId    String
  business      Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
  branchId      String
  branch        Branch   @relation(fields: [branchId], references: [id], onDelete: Cascade)
  name          String   // e.g. "Deluxe King", "Executive Suite"
  code          String   // e.g. "DLX-K", "EXEC-S"
  description   String?
  baseRate      Decimal  @default(0) @db.Decimal(12, 2)
  maxOccupancy  Int      @default(2)
  amenities     Json?    // ["WIFI", "AC", "BALCONY", "OCEAN_VIEW", "MINIBAR"]
  isActive      Boolean  @default(true)
  displayOrder  Int      @default(0)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  rooms        Room[]
  reservations Reservation[]

  @@unique([businessId, id])
  @@unique([businessId, branchId, code])
  @@index([businessId, branchId, isActive])
}

model Room {
  id            String   @id @default(uuid())
  businessId    String
  business      Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
  branchId      String
  branch        Branch   @relation(fields: [branchId], references: [id], onDelete: Cascade)
  roomTypeId    String
  roomType      RoomType @relation(fields: [roomTypeId], references: [id], onDelete: Cascade)
  floorId       String?
  floor         Floor?   @relation(fields: [floorId], references: [id], onDelete: SetNull)
  roomNumber    String   // e.g. "101", "204B"
  
  // Operational Status: VACANT_CLEAN, VACANT_DIRTY, OCCUPIED_CLEAN, OCCUPIED_DIRTY, OUT_OF_SERVICE, MAINTENANCE
  status        String   @default("VACANT_CLEAN")
  
  // Scalar logical reference to active Stay to preserve DAG acyclicity
  currentStayId String?

  capacity      Int      @default(2)
  features      Json?    // Custom room traits: ["CONNECTING", "ACCESSIBLE"]
  isActive      Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  reservations       Reservation[]
  stays              Stay[]
  allocations        RoomAllocation[]
  housekeepingTasks  HousekeepingTask[]
  maintenanceTickets MaintenanceTicket[]

  @@unique([businessId, id])
  @@unique([businessId, branchId, roomNumber])
  @@index([businessId, branchId, status])
  @@index([businessId, roomTypeId])
}

model Reservation {
  id                String    @id @default(uuid())
  businessId        String
  business          Business  @relation(fields: [businessId], references: [id], onDelete: Cascade)
  branchId          String
  branch            Branch    @relation(fields: [branchId], references: [id], onDelete: Cascade)
  reservationNumber String    // e.g. "RES-20261101-0001"
  
  customerId        String?
  customer          Customer? @relation(fields: [customerId], references: [id], onDelete: SetNull)
  roomTypeId        String
  roomType          RoomType  @relation(fields: [roomTypeId], references: [id], onDelete: Cascade)
  assignedRoomId    String?
  assignedRoom      Room?     @relation(fields: [assignedRoomId], references: [id], onDelete: SetNull)

  primaryGuestName  String
  primaryGuestEmail String?
  primaryGuestPhone String?

  checkInDate       DateTime
  checkOutDate      DateTime
  adultCount        Int       @default(1)
  childCount        Int       @default(0)

  // Status Lifecycle: CONFIRMED, CHECKED_IN, CHECKED_OUT, CANCELLED, NO_SHOW
  status            String    @default("CONFIRMED")
  ratePlan          String    @default("STANDARD") // STANDARD, NON_REFUNDABLE, CORPORATE
  nightlyRate       Decimal   @default(0) @db.Decimal(12, 2)
  totalAmount       Decimal   @default(0) @db.Decimal(12, 2)
  depositAmount     Decimal   @default(0) @db.Decimal(12, 2)

  version           Int       @default(1) // Optimistic concurrency control
  notes             String?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  guests            ReservationGuest[]
  stays             Stay[]
  allocations       RoomAllocation[]

  @@unique([businessId, id])
  @@unique([businessId, branchId, reservationNumber])
  @@index([businessId, branchId, status])
  @@index([businessId, checkInDate, checkOutDate])
}

model ReservationGuest {
  id            String      @id @default(uuid())
  businessId    String
  business      Business    @relation(fields: [businessId], references: [id], onDelete: Cascade)
  reservationId String
  reservation   Reservation @relation(fields: [reservationId], references: [id], onDelete: Cascade)
  fullName      String
  email         String?
  phone         String?
  idType        String?     // PASSPORT, CITIZENSHIP, DRIVING_LICENSE
  idNumber      String?
  isPrimary     Boolean     @default(false)
  createdAt     DateTime    @default(now())

  @@unique([businessId, id])
  @@index([businessId, reservationId])
}

model Stay {
  id                 String       @id @default(uuid())
  businessId         String
  business           Business     @relation(fields: [businessId], references: [id], onDelete: Cascade)
  branchId           String
  branch             Branch       @relation(fields: [branchId], references: [id], onDelete: Cascade)
  stayNumber         String       // e.g. "STAY-20261101-0001"
  reservationId      String?
  reservation        Reservation? @relation(fields: [reservationId], references: [id], onDelete: SetNull)
  roomId             String
  room               Room         @relation(fields: [roomId], references: [id], onDelete: Cascade)

  primaryGuestName   String
  primaryGuestEmail  String?
  primaryGuestPhone  String?
  idType             String?
  idNumber           String?

  checkInAt          DateTime     @default(now())
  expectedCheckOutAt DateTime
  actualCheckOutAt   DateTime?

  // Status: ACTIVE, COMPLETED, EXTENDED, TRANSFERRED
  status             String       @default("ACTIVE")
  totalAmount        Decimal      @default(0) @db.Decimal(12, 2)
  paidAmount         Decimal      @default(0) @db.Decimal(12, 2)

  version            Int          @default(1) // Optimistic concurrency control
  checkedInById      String?
  checkedInBy        User?        @relation("StayCheckedInBy", fields: [checkedInById], references: [id], onDelete: SetNull)
  checkedOutById     String?
  checkedOutBy       User?        @relation("StayCheckedOutBy", fields: [checkedOutById], references: [id], onDelete: SetNull)

  notes              String?
  createdAt          DateTime     @default(now())
  updatedAt          DateTime     @updatedAt

  allocations        RoomAllocation[]
  housekeepingTasks  HousekeepingTask[]

  @@unique([businessId, id])
  @@unique([businessId, branchId, stayNumber])
  @@index([businessId, roomId, status])
  @@index([businessId, branchId, status])
}

model MaintenanceTicket {
  id           String    @id @default(uuid())
  businessId   String
  business     Business  @relation(fields: [businessId], references: [id], onDelete: Cascade)
  branchId     String
  branch       Branch    @relation(fields: [branchId], references: [id], onDelete: Cascade)
  roomId       String
  room         Room      @relation(fields: [roomId], references: [id], onDelete: Cascade)
  title        String
  description  String?
  priority     String    @default("MEDIUM") // LOW, MEDIUM, HIGH, URGENT
  
  // Status: OPEN, IN_PROGRESS, RESOLVED, CANCELLED
  status       String    @default("OPEN")
  startDate    DateTime
  endDate      DateTime
  reportedById String?
  reportedBy   User?     @relation("MaintenanceReportedBy", fields: [reportedById], references: [id], onDelete: SetNull)
  resolvedById String?
  resolvedBy   User?     @relation("MaintenanceResolvedBy", fields: [resolvedById], references: [id], onDelete: SetNull)
  resolvedAt   DateTime?
  notes        String?
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  allocations  RoomAllocation[]

  @@unique([businessId, id])
  @@index([businessId, roomId, status])
  @@index([businessId, branchId, status])
}

model RoomAllocation {
  id                  String             @id @default(uuid())
  businessId          String
  business            Business           @relation(fields: [businessId], references: [id], onDelete: Cascade)
  roomId              String
  room                Room               @relation(fields: [roomId], references: [id], onDelete: Cascade)
  reservationId       String?
  reservation         Reservation?       @relation(fields: [reservationId], references: [id], onDelete: SetNull)
  stayId              String?
  stay                Stay?              @relation(fields: [stayId], references: [id], onDelete: SetNull)
  maintenanceTicketId String?
  maintenanceTicket   MaintenanceTicket? @relation(fields: [maintenanceTicketId], references: [id], onDelete: SetNull)

  // Interval endpoints: must NOT have @default(now()) to avoid DR rehearsal skew
  startDate           DateTime
  endDate             DateTime
  isBlocking          Boolean            @default(true)
  
  // Status: CONFIRMED, CHECKED_IN, MAINTENANCE, COMPLETED, CANCELLED
  status              String             @default("CONFIRMED")
  notes               String?
  createdAt           DateTime           @default(now())
  updatedAt           DateTime           @updatedAt

  @@unique([businessId, id])
  @@index([businessId, roomId, startDate, endDate])
  @@index([businessId, isBlocking])
}

model HousekeepingTask {
  id           String    @id @default(uuid())
  businessId   String
  business     Business  @relation(fields: [businessId], references: [id], onDelete: Cascade)
  branchId     String
  branch       Branch    @relation(fields: [branchId], references: [id], onDelete: Cascade)
  roomId       String
  room         Room      @relation(fields: [roomId], references: [id], onDelete: Cascade)
  stayId       String?
  stay         Stay?     @relation(fields: [stayId], references: [id], onDelete: SetNull)
  taskType     String    @default("DAILY_CLEANING") // CHECKOUT_CLEANING, DAILY_CLEANING, DEEP_CLEAN, INSPECTION
  
  // Status: DIRTY, IN_PROGRESS, CLEAN, INSPECTED
  status       String    @default("DIRTY")
  priority     String    @default("MEDIUM") // LOW, MEDIUM, HIGH, URGENT
  assignedToId String?
  assignedTo   User?     @relation("HousekeepingAssignedTo", fields: [assignedToId], references: [id], onDelete: SetNull)
  inspectedById String?
  inspectedBy  User?     @relation("HousekeepingInspectedBy", fields: [inspectedById], references: [id], onDelete: SetNull)
  startedAt    DateTime?
  completedAt  DateTime?
  inspectedAt  DateTime?
  notes        String?
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  @@unique([businessId, id])
  @@index([businessId, branchId, status])
  @@index([businessId, roomId, status])
}
```

---

### 4.2 PostgreSQL GiST Exclusion DDL Blueprint

In the migration SQL file:
```sql
-- Enable btree_gist extension for PostgreSQL equality on text/uuid
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Mathematical exclusion constraint preventing overlapping blocking allocations
ALTER TABLE "RoomAllocation"
ADD CONSTRAINT "RoomAllocation_no_overlap_blocking"
EXCLUDE USING gist (
  "businessId" WITH =,
  "roomId" WITH =,
  tsrange("startDate", "endDate", '[)') WITH &&
) WHERE ("isBlocking" = true);
```

---

### 4.3 Domain Services Blueprint

#### 1. `room-availability-service.ts`
- **Path**: `backend/src/lib/services/room-availability-service.ts`
- **Key Functions**:
  - `createRoomType(input: CreateRoomTypeInput)`
  - `getRoomTypes(filter: GetRoomTypesFilter)`
  - `updateRoomType(input: UpdateRoomTypeInput)`
  - `createRoom(input: CreateRoomInput)`
  - `getRooms(filter: GetRoomsFilter)`
  - `updateRoom(input: UpdateRoomInput)`
  - `updateRoomStatus(input: UpdateRoomStatusInput)`
  - `getRoomAvailability(filter: GetRoomAvailabilityFilter)`:
    - Filters rooms by `branchId` and optional `roomTypeId`.
    - Queries `RoomAllocation` for overlapping blocking intervals:
      $$\text{startDate} < \text{filter.endDate} \quad \text{AND} \quad \text{endDate} > \text{filter.startDate} \quad \text{AND} \quad \text{isBlocking} = \text{true}$$
    - Returns aggregated availability matrix per room type: `totalRooms`, `availableRooms`, `occupiedRooms`, `maintenanceRooms`.
  - `getRoomTapeChart(filter: GetTapeChartFilter)`:
    - Matrix of rooms with all assigned allocations between `startDate` and `endDate` formatted for the visual Tape Chart / Room Rack.

#### 2. `hotel-reservation-service.ts`
- **Path**: `backend/src/lib/services/hotel-reservation-service.ts`
- **Key Functions**:
  - `createReservation(input: CreateReservationInput)`:
    - Generates monotonic `reservationNumber` (`RES-YYYYMMDD-XXXX`).
    - Executes inside `serializable` transaction.
    - If `assignedRoomId` provided, creates blocking `RoomAllocation` `[checkInDate, checkOutDate)`.
    - Catches code `23P01` or exclusion violation and throws `HotelError("Room is already reserved or occupied for this period", 409)`.
    - Creates `Reservation` and `ReservationGuest` records.
  - `modifyReservation(input: ModifyReservationInput)`:
    - Updates reservation details, dates, or room assignment with version increment.
  - `cancelReservation(input: CancelReservationInput)`:
    - Transitions `status` to `CANCELLED`.
    - Sets linked `RoomAllocation.isBlocking = false` and `RoomAllocation.status = 'CANCELLED'`.
  - `markReservationNoShow(input: NoShowReservationInput)`:
    - Transitions `status` to `NO_SHOW` and unblocks allocation.

#### 3. `hotel-checkin-service.ts`
- **Path**: `backend/src/lib/services/hotel-checkin-service.ts`
- **Key Functions**:
  - `checkInReservation(input: CheckInReservationInput)`
  - `checkInWalkIn(input: CheckInWalkInInput)`
- **Core Invariants & Flow**:
  1. Executes inside `serializable` transaction.
  2. Verifies room is NOT in `MAINTENANCE` or `OUT_OF_SERVICE`.
  3. Creates or updates blocking `RoomAllocation` (`status = 'CHECKED_IN'`).
     - PostgreSQL GiST constraint enforces no concurrent overlaps, throwing 409 on race conditions.
  4. Executes Atomic CAS update on `Room`:
     ```ts
     const updated = await tx.room.updateMany({
       where: {
         id: input.roomId,
         businessId: input.businessId,
         status: { in: ["VACANT_CLEAN", "VACANT_DIRTY"] },
         currentStayId: null,
       },
       data: {
         status: room.status === "VACANT_DIRTY" ? "OCCUPIED_DIRTY" : "OCCUPIED_CLEAN",
         currentStayId: stay.id,
       },
     });
     if (updated.count === 0) throw new HotelError("Room is no longer vacant", 409);
     ```
  5. Creates `Stay` record (`STAY-YYYYMMDD-XXXX`).
  6. If from reservation, transitions `Reservation.status = 'CHECKED_IN'`.
  7. Emits `HOTEL_CHECK_IN` audit event.

#### 4. `hotel-room-transfer-service.ts`
- **Path**: `backend/src/lib/services/hotel-room-transfer-service.ts`
- **Core Invariant**:
  - **Atomically transfers an active stay to a new room preserving stay identity, historical charges, and folio.**
- **Atomic Transaction Sequence**:
  1. Fetch `Stay` where `id = stayId` and `status = 'ACTIVE'`.
  2. Verify `sourceRoom.currentStayId === stay.id`.
  3. Verify `targetRoom.status IN ('VACANT_CLEAN', 'VACANT_DIRTY')` and `targetRoom.currentStayId === null`.
  4. Truncate existing source room allocation `endDate = now()`.
  5. CAS update source room:
     ```ts
     await tx.room.update({
       where: { id: sourceRoomId },
       data: { status: "VACANT_DIRTY", currentStayId: null },
     });
     ```
  6. Automatically generate `HousekeepingTask` on source room with `status = 'DIRTY'`, `priority = 'HIGH'`.
  7. Create new blocking `RoomAllocation` on target room from `now()` to `stay.expectedCheckOutAt`.
     - Protected by GiST constraint!
  8. CAS update target room:
     ```ts
     await tx.room.update({
       where: { id: targetRoomId },
       data: {
         status: targetRoom.status === "VACANT_DIRTY" ? "OCCUPIED_DIRTY" : "OCCUPIED_CLEAN",
         currentStayId: stay.id,
       },
     });
     ```
  9. Update `Stay`:
     `roomId = targetRoomId`
     Append transfer log to `notes`.
  10. Emits `HOTEL_ROOM_TRANSFERRED` audit event.

#### 5. `hotel-checkout-service.ts`
- **Path**: `backend/src/lib/services/hotel-checkout-service.ts`
- **Core Invariants & Flow**:
  1. Verify `Stay.status === 'ACTIVE'`.
  2. Folio validation: check that `paidAmount >= totalAmount` (or `force = true` / folio transferred to billing account).
  3. Release occupancy on `Room`:
     ```ts
     await tx.room.update({
       where: { id: stay.roomId },
       data: { status: "VACANT_DIRTY", currentStayId: null },
     });
     ```
     *(Per specification: checkout ends occupancy and marks room `VACANT_DIRTY`; it does not mark it `CLEAN`)*.
  4. Generate `HousekeepingTask`:
     ```ts
     await tx.housekeepingTask.create({
       data: {
         businessId,
         branchId,
         roomId: stay.roomId,
         stayId: stay.id,
         taskType: "CHECKOUT_CLEANING",
         status: "DIRTY",
         priority: "HIGH",
         notes: `Checkout cleaning for Stay ${stay.stayNumber}`,
       },
     });
     ```
  5. Close `Stay`: `status = 'COMPLETED'`, `actualCheckOutAt = new Date()`.
  6. Close `RoomAllocation`: `status = 'COMPLETED'`, `endDate = new Date()`.
  7. If reservation linked: `Reservation.status = 'CHECKED_OUT'`.
  8. Emits `HOTEL_CHECK_OUT` audit event.

#### 6. `hotel-housekeeping-service.ts`
- **Path**: `backend/src/lib/services/hotel-housekeeping-service.ts`
- **Housekeeping Lifecycle**:
  - Status progression: `DIRTY` $\to$ `IN_PROGRESS` $\to$ `CLEAN` $\to$ `INSPECTED`.
  - When task is marked `CLEAN`:
    - If room is `VACANT_DIRTY` $\to$ updates room to `VACANT_CLEAN`.
    - If room is `OCCUPIED_DIRTY` $\to$ updates room to `OCCUPIED_CLEAN`.
  - When task is marked `INSPECTED`: records inspector and inspection timestamp.
- **Maintenance Lifecycle**:
  - `createMaintenanceTicket`:
    - Creates ticket (`OPEN`).
    - Sets room status to `MAINTENANCE`.
    - Creates blocking `RoomAllocation` with `status = 'MAINTENANCE'`. GiST constraint prevents scheduling over existing reservations/stays.
  - `resolveMaintenanceTicket`:
    - Sets ticket `status = 'RESOLVED'`.
    - Unblocks `RoomAllocation` (`isBlocking = false`, `status = 'COMPLETED'`).
    - Transitions room status to `VACANT_DIRTY` (maintenance work requires cleaning).
    - Creates `HousekeepingTask` with `DIRTY` status.

---

### 4.4 API Route Catalog (`backend/src/app/api/v1/hotel/`)

| Endpoint | Method | Purpose | Input / Body (Zod) | Success | Error Statuses |
|---|---|---|---|---|---|
| `/api/v1/hotel/room-types` | `GET` | List room types for branch | Query: `branchId?`, `isActive?` | `200` (`{ roomTypes: [...] }`) | `401`, `500` |
| `/api/v1/hotel/room-types` | `POST` | Create room type | `name`, `code`, `baseRate`, `maxOccupancy`, `amenities?` | `201` (`{ roomType }`) | `400`, `401`, `409`, `500` |
| `/api/v1/hotel/room-types/[id]` | `PATCH` | Update room type | `name?`, `baseRate?`, `maxOccupancy?`, `amenities?`, `isActive?` | `200` (`{ roomType }`) | `400`, `401`, `404`, `500` |
| `/api/v1/hotel/rooms` | `GET` | List rooms | Query: `branchId?`, `roomTypeId?`, `status?`, `floorId?` | `200` (`{ rooms: [...] }`) | `401`, `500` |
| `/api/v1/hotel/rooms` | `POST` | Create room | `roomTypeId`, `roomNumber`, `floorId?`, `capacity?`, `features?` | `201` (`{ room }`) | `400`, `401`, `409`, `500` |
| `/api/v1/hotel/rooms/[id]` | `GET` | Get room with active stay | URL param: `id` | `200` (`{ room }`) | `401`, `404`, `500` |
| `/api/v1/hotel/rooms/[id]/status` | `PATCH` | Update room operational status | `status: Enum(VACANT_CLEAN, VACANT_DIRTY, OUT_OF_SERVICE)` | `200` (`{ room }`) | `400`, `401`, `404`, `409`, `500` |
| `/api/v1/hotel/availability` | `GET` | Check availability & counts | Query: `startDate`, `endDate`, `branchId?`, `roomTypeId?` | `200` (`{ availability: [...] }`) | `400`, `401`, `500` |
| `/api/v1/hotel/tape-chart` | `GET` | Tape chart matrix of allocations | Query: `startDate`, `endDate`, `branchId?` | `200` (`{ tapeChart: [...] }`) | `400`, `401`, `500` |
| `/api/v1/hotel/reservations` | `GET` | List reservations | Query: `branchId?`, `status?`, `search?`, `from?`, `to?` | `200` (`{ reservations: [...] }`) | `401`, `500` |
| `/api/v1/hotel/reservations` | `POST` | Create reservation | `roomTypeId`, `assignedRoomId?`, `checkInDate`, `checkOutDate`, `primaryGuestName`, `primaryGuestPhone?`, `depositAmount?` | `201` (`{ reservation }`) | `400`, `401`, `409`, `500` |
| `/api/v1/hotel/reservations/[id]` | `GET` | Get reservation details | URL param: `id` | `200` (`{ reservation }`) | `401`, `404`, `500` |
| `/api/v1/hotel/reservations/[id]/cancel` | `POST` | Cancel reservation | `reason?` | `200` (`{ reservation }`) | `401`, `404`, `409`, `500` |
| `/api/v1/hotel/stays/check-in` | `POST` | Check-in (reservation or walk-in) | `reservationId?`, `roomId`, `expectedCheckOutAt`, `guestName`, `guestPhone?`, `idType?`, `idNumber?`, `paidAmount?` | `201` (`{ stay, room }`) | `400`, `401`, `409`, `500` |
| `/api/v1/hotel/stays/[id]/transfer` | `POST` | Room transfer | `targetRoomId`, `reason?` | `200` (`{ stay, sourceRoom, targetRoom }`) | `400`, `401`, `404`, `409`, `500` |
| `/api/v1/hotel/stays/[id]/extend` | `POST` | Extend stay | `newExpectedCheckOutAt` | `200` (`{ stay }`) | `400`, `401`, `404`, `409`, `500` |
| `/api/v1/hotel/stays/[id]/check-out` | `POST` | Check-out stay | `force?`, `notes?` | `200` (`{ stay, room, housekeepingTask }`) | `400`, `401`, `404`, `409`, `500` |
| `/api/v1/hotel/housekeeping` | `GET` | List housekeeping tasks | Query: `branchId?`, `status?`, `roomId?` | `200` (`{ tasks: [...] }`) | `401`, `500` |
| `/api/v1/hotel/housekeeping` | `POST` | Create manual task | `roomId`, `taskType`, `priority?`, `notes?` | `201` (`{ task }`) | `400`, `401`, `500` |
| `/api/v1/hotel/housekeeping/[id]` | `PATCH` | Update task status | `status: Enum(DIRTY, IN_PROGRESS, CLEAN, INSPECTED)`, `assignedToId?` | `200` (`{ task, room }`) | `400`, `401`, `404`, `500` |
| `/api/v1/hotel/maintenance` | `GET` | List maintenance tickets | Query: `branchId?`, `status?`, `roomId?` | `200` (`{ tickets: [...] }`) | `401`, `500` |
| `/api/v1/hotel/maintenance` | `POST` | Create maintenance ticket | `roomId`, `title`, `startDate`, `endDate`, `priority?`, `description?` | `201` (`{ ticket, room }`) | `400`, `401`, `409`, `500` |
| `/api/v1/hotel/maintenance/[id]/resolve` | `POST` | Resolve ticket | `notes?` | `200` (`{ ticket, room, housekeepingTask }`) | `400`, `401`, `404`, `500` |

---

## 5. Verification Method

To independently verify these conclusions and blueprints:

1. **Verify PostgreSQL GiST Exclusion Constraint & btree_gist**:
   Execute the test script in `scratch/test-gist.js` against the PostgreSQL database:
   ```powershell
   node scratch/test-gist.js
   ```
   **Expected Result**: Confirms `tsrange("startDate", "endDate", '[)')` is immutable, permits adjacent booking boundaries, and rejects overlapping blocking allocations with error code `23P01`.

2. **Verify DAG Acyclicity & Disaster Recovery Invariant**:
   Inspect `backend/src/lib/backup-format.ts` and run:
   ```powershell
   npx vitest run tests/challenger-p3-m1-schema-acyclicity.test.ts
   ```
   **Expected Result**: Confirms topological sort succeeds when `Room.currentStayId` is a scalar `String?` without an `@relation` attribute.

3. **Verify Monorepo Build & Typecheck**:
   Ensure monorepo type checking and unit test suites pass:
   ```powershell
   npm run typecheck
   npm test
   ```

4. **Integration Test Suite for Phase 5**:
   The implementer must create `tests/phase5-hotel-stays.integration.test.ts` implementing:
   - 10 parallel check-in / reservation requests for the same room and date interval: exactly 1 succeeds with `201`, exactly 9 reject with `409 Conflict`.
   - Atomic room transfer reassigns room allocation while preserving `Stay.id` and generating a `DIRTY` `HousekeepingTask` on the source room.
   - Check-out transitions room status to `VACANT_DIRTY` and spawns a `HousekeepingTask`.
   - Maintenance ticket creates a blocking allocation preventing bookings during the window.
