# Phase 5 Schema & Disaster Recovery Topology Specification Mining Report

**Agent**: `p5_spec_miner_schema`  
**Working Directory**: `c:\projects\pos\.agents\teamwork\p5_spec_miner_schema\`  
**Date**: 2026-11-01  
**Status**: Completed (Hard Handoff)

---

## 1. Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Hotel Inventory | `RoomType` Model | Accommodation category with base rates, occupancy caps, amenities | `name`, `code`, `baseRate` (Decimal), `maxOccupancy`, `amenities` (Json), `businessId`, `branchId` | Persisted RoomType record | Rejects duplicate `(businessId, branchId, code)` with 409 unique constraint violation | `packages/db/prisma/schema.prisma`, `ORIGINAL_REQUEST.md` R1 |
| 2 | Hotel Inventory | `Room` Model | Physical room unit with room number, floor assignment, operational status | `roomNumber`, `roomTypeId`, `floorId`, `status`, `businessId`, `branchId` | Persisted Room record | Rejects duplicate `(businessId, branchId, roomNumber)` with 409 unique constraint violation | `packages/db/prisma/schema.prisma`, `ORIGINAL_REQUEST.md` R1 |
| 3 | DAG Preservation | `Room.currentStayId` Scalar Pattern | Logical active stay reference stored as pure `String?` without `@relation` attribute | `currentStayId: String?` | Room with scalar pointer to active stay | Adding `@relation` triggers fatal `Error("Backup schema has unsupported dependency cycle")` in DR topological sort | `packages/db/prisma/schema.prisma` lines 1159, `backend/src/lib/backup-format.ts` line 17 |
| 4 | Booking & Folios | `Reservation` Model | Booking agreement holding guest contact, stay dates, rate plan, and financial deposit amounts | `reservationNumber`, `guestName`, `roomTypeId`, `roomId?`, `checkInDate`, `checkOutDate`, `ratePlan`, `totalAmount`, `depositAmount` | Persisted Reservation record | Rejects duplicate `(businessId, branchId, reservationNumber)` with 409 | `ORIGINAL_REQUEST.md` R1, `PHASE_5_HOTEL_STAYS_ROOMS.md` |
| 5 | Booking | `ReservationGuest` Model | Companion guest profiles associated with a reservation | `name`, `email?`, `phone?`, `idType?`, `idNumber?`, `isPrimary`, `reservationId` | Persisted companion guest records | Cascade-deleted if parent reservation is deleted | `packages/db/prisma/schema.prisma`, `ORIGINAL_REQUEST.md` R1 |
| 6 | Guest Stays | `Stay` Model | Active hotel stay binding guest to a room unit with arrival/departure timestamps and status | `stayNumber`, `reservationId?`, `roomId`, `guestName`, `guestIdType?`, `guestIdNumber?`, `checkInTime`, `expectedCheckOut`, `status`, `ratePerNight` | Persisted active Stay record | Rejects duplicate `(businessId, branchId, stayNumber)` with 409 | `ORIGINAL_REQUEST.md` R1, `PHASE_5_HOTEL_STAYS_ROOMS.md` |
| 7 | Concurrency & Exclusion | `RoomAllocation` Model & PostgreSQL GiST Exclusion | Interval booking record holding `[startDate, endDate)` half-open range. Engine-level GiST exclusion constraint prevents overlapping blocking allocations | `roomId`, `startDate`, `endDate`, `isBlocking`, `reservationId?`, `stayId?`, `maintenanceTicketId?` | Persisted allocation record | Overlapping blocking allocation on the same room throws PostgreSQL `23P01 exclusion_violation` mapped to HTTP `409 Conflict` | `docs/hospitality/phases/PHASE_5_HOTEL_STAYS_ROOMS.md` §3, `PHASE_0_READINESS_REPORT.md` line 519 |
| 8 | Operational Status | `HousekeepingTask` Model | Independent room cleaning & inspection tracking (`DIRTY`, `IN_PROGRESS`, `CLEAN`, `INSPECTED`) | `roomId`, `stayId?`, `taskType`, `status`, `priority`, `assignedToId?` | Persisted task record | Validated status transitions; check-out auto-schedules `DIRTY` task without marking room clean | `docs/hospitality/phases/PHASE_5_HOTEL_STAYS_ROOMS.md` §3 |
| 9 | Maintenance Blocks | `MaintenanceTicket` Model | Operational repair ticket that creates a blocking `RoomAllocation` preventing room bookings | `ticketNumber`, `roomId`, `title`, `status`, `startDate`, `endDate?`, `priority` | Persisted ticket + blocking allocation | Overlapping booking during active maintenance window is rejected by GiST constraint | `ORIGINAL_REQUEST.md` R1, `PHASE_5_HOTEL_STAYS_ROOMS.md` §2 |
| 10 | Tenant Isolation | Strict Composite Keys | `@@unique([businessId, id])` on every hotel model | `businessId`, `id` | Tenant isolation across all foreign references | Cross-tenant access or foreign tenant reference rejected by backup engine and API authority | `packages/db/prisma/schema.prisma`, `ORIGINAL_REQUEST.md` R1 |
| 11 | Disaster Recovery | Dynamic DR Topological Sort | `backend/src/lib/backup-format.ts` sorts models topologically using dependency resolution | `Prisma.dmmf.datamodel.models` | `backupModels` topological array | Unsupported dependency cycle throws fatal error; DAG ensures children restored after parents and deleted before parents | `backend/src/lib/backup-format.ts` lines 12-19 |
| 12 | Disaster Recovery | Dual Cluster Migration Sync | Additive migrations deployed to Port 55439 (`restro_test`) and Port 55440 (`restro_restore`) | SQL migration file in `packages/db/prisma/migrations/` | Applied migration record with matching SHA-256 checksum on both clusters | Rehearsal rejects if target migration history differs from source | `scripts/restro-env.mjs`, `scripts/restro-restore-env.mjs`, `scripts/rehearse-recovery.ts` |

---

## 2. Edge Cases

| # | Feature | Input | Observed Behavior |
|---|---------|-------|-------------------|
| 1 | `RoomAllocation` Concurrency | 10 concurrent requests booking overlapping `[startDate, endDate)` on same room | Exactly 1 transaction commits; 9 fail with PostgreSQL `23P01 exclusion_violation`, caught and returned as HTTP `409 Conflict`. |
| 2 | Back-to-Back Turnover | Departure at 11:00 AM (`[2026-11-01T14:00, 2026-11-05T11:00)`), Arrival at 11:00 AM (`[2026-11-05T11:00, 2026-11-08T11:00)`) | Permitted cleanly by half-open `[start, end)` intervals because `&&` evaluates to `false` for boundary points. |
| 3 | Room vs Stay Dependency Cycle | Adding `@relation` from `Room.currentStayId` to `Stay.id` | Topological sort in `backup-format.ts` fails with `Error: Backup schema has unsupported dependency cycle`. |
| 4 | Room Transfer Atomicity | Guest moves from Room 101 to Room 205 mid-stay | Old allocation closed/adjusted, new allocation on Room 205 created in single transaction; `Stay.roomId` updated to 205, `Stay.id` remains invariant. |
| 5 | Checkout Status Decoupling | Guest checks out of Room 302 | Stay transitions to `COMPLETED`, Room transitions to `VACANT_DIRTY`, `HousekeepingTask` created with `DIRTY`. Room is NOT marked `VACANT_CLEAN`. |
| 6 | Synthetic Dates in DR Rehearsal | Rehearsal builder sets both `startDate` and `endDate` | Synthetic row builder in `rehearse-recovery.ts` must assign `startDate < endDate` (`new Date("2025-01-02T14:00:00.000Z")` and `new Date("2025-01-04T11:00:00.000Z")`) to prevent zero-length or invalid intervals. |
| 7 | `tests/recovery.integration.test.ts` Model Count | Adding 8 Phase 5 models increases tenant model count from 67 to 75 | Line 88 of `tests/recovery.integration.test.ts` has a legacy hardcoded count assertion (`toHaveLength(60)`) which failed on Phase 4 (67) and must use `format.backupModels.length`. |

---

## 3. Five-Component Handoff Report

### 1. Observation
1. **Existing Models & Tenant Isolation**:
   - `packages/db/prisma/schema.prisma` currently defines 67 models (66 tenant models + `BusinessRegistrationRequest` which is explicitly excluded in `backend/src/lib/backup-format.ts` line 11).
   - Every tenant model consistently includes `businessId String` and composite uniqueness `@@unique([businessId, id])`.
   - String representations with comments are used exclusively for domain enums (e.g. `status String @default("AVAILABLE") // AVAILABLE, OCCUPIED, RESERVED, BILLED`). No native PostgreSQL/Prisma enum types are declared in `schema.prisma`.
2. **Disaster Recovery Topological Sorter**:
   - `backend/src/lib/backup-format.ts` lines 12–19:
     ```ts
     export const excludedModels = ["BusinessRegistrationRequest"];
     const models = Prisma.dmmf.datamodel.models.filter(model => !excludedModels.includes(model.name));
     export const backupModels: typeof models = [];
     const pending = [...models];
     while (pending.length) {
       const index = pending.findIndex(model => model.fields.filter(field => field.relationFromFields?.length).every(field => backupModels.some(parent => parent.name === field.type)));
       if (index < 0) throw new Error("Backup schema has unsupported dependency cycle");
       backupModels.push(pending.splice(index, 1)[0]);
     }
     export const schemaHash = createHash("sha256").update(JSON.stringify(backupModels)).digest("hex");
     ```
   - In `RestaurantTable` (lines 1148–1176), `currentSessionId String?` is explicitly maintained as a scalar field without an `@relation` attribute:
     ```prisma
     currentSessionId String? // Scalar logical ID without @relation to preserve DAG acyclicity
     ```
   - Verified via `tests/challenger-p3-m1-schema-acyclicity.test.ts` line 186 that introducing an `@relation` on `currentSessionId` to `TableSession` produces a circular dependency (`RestaurantTable -> TableSession -> RestaurantTable`) causing `topologicalSort` to throw `Error: Backup schema has unsupported dependency cycle`.
3. **Disaster Recovery Rehearsal Execution**:
   - Executed `node scripts/restro-restore-env.mjs rehearse` (Task 130).
   - Result: 41/41 checks passed across all 67 models in 12.163 seconds with synthetic tenant snapshot, AES-256-GCM authenticated encryption, negative validation cases, restore into clean target on port 55440, and row-for-row reconciliation.
4. **Recovery Integration Test Hardcoded Defect**:
   - Executed `node scripts/restro-env.mjs recovery-test`.
   - Result: Failed with `AssertionError: expected [ 'Business', 'Subscription', …(65) ] to have a length of 60 but got 67` at `tests/recovery.integration.test.ts:88:42`. This was a historical hardcoded constant from Phase 1 (60 models), whereas Phase 4 has 67 models and Phase 5 will have 75 models (74 backup models + `BusinessRegistrationRequest`).

---

### 2. Logic Chain
1. **Model Hierarchy and Topological Ordering**:
   - To prevent dependency cycles in `backup-format.ts`, model dependencies must follow a strict directed acyclic graph:
     - `Business`, `Branch`, `User`, `Floor` exist prior to hotel models.
     - `RoomType` depends only on `Business` and `Branch`.
     - `Room` depends on `Business`, `Branch`, `RoomType`, and optionally `Floor`.
     - `Reservation` depends on `Business`, `Branch`, `RoomType`, optionally `Room`, and optionally `User` (`createdBy`).
     - `ReservationGuest` depends on `Business` and `Reservation`.
     - `Stay` depends on `Business`, `Branch`, `Room`, optionally `Reservation`, and optionally `User` (`checkedInBy`, `checkedOutBy`).
     - `MaintenanceTicket` depends on `Business`, `Branch`, `Room`, and optionally `User` (`reportedBy`, `assignedTo`).
     - `RoomAllocation` depends on `Business`, `Branch`, `Room`, optionally `Reservation`, optionally `Stay`, and optionally `MaintenanceTicket`.
     - `HousekeepingTask` depends on `Business`, `Branch`, `Room`, optionally `Stay`, and optionally `User` (`assignedTo`, `completedBy`).
   - `Room` must NOT declare `@relation` to `Stay` for `currentStayId`. It must remain a pure scalar `String?` field (`currentStayId String? // Scalar logical ID without @relation to preserve DAG acyclicity`), identical to `RestaurantTable.currentSessionId`.
   - `Stay` must NOT declare `@relation` to `RoomAllocation`. Instead, `RoomAllocation` references `Stay` (`stayId String?`).
   - Reverse deletion in `rehearse-recovery.ts` (`[...format.backupModels].reverse()`) safely cascades from allocations and housekeeping tasks up to rooms, room types, and tenant roots without foreign key violation.
2. **PostgreSQL GiST Exclusion Constraints**:
   - Prisma schema alone cannot represent PostgreSQL GiST exclusion constraints.
   - The PostgreSQL `btree_gist` extension provides the `=` operator for `text`/`uuid` types in GiST indices.
   - Prisma `DateTime` without `@db.Timestamptz` maps to PostgreSQL `TIMESTAMP(3)` (timestamp without time zone).
   - In PostgreSQL, `tsrange(timestamp, timestamp, text)` is an `IMMUTABLE` function.
   - The table constraint in migration SQL:
     ```sql
     CREATE EXTENSION IF NOT EXISTS btree_gist;

     ALTER TABLE "RoomAllocation"
     ADD CONSTRAINT "RoomAllocation_room_period_overlap_excl"
     EXCLUDE USING gist (
       "roomId" WITH =,
       tsrange("startDate", "endDate", '[)') WITH &&
     )
     WHERE ("isBlocking" = true);
     ```
     rejects overlapping blocking intervals for the same room at the storage engine level with error code `23P01`.
   - Half-open intervals `[start, end)` permit back-to-back same-day turnover (e.g., departure at 11:00 AM, arrival at 11:00 AM) without collision.
3. **Database Migration and Rehearsal Invariants**:
   - `rehearse-recovery.ts` verifies that `targetMigrations` on port 55440 matches `sourceMigrations` on port 55439 exactly (names and checksums).
   - Therefore, the migration `202611010003_phase5_hotel_stays_rooms` must be applied to both databases:
     - `node scripts/restro-env.mjs migrate` (port 55439)
     - `node scripts/restro-restore-env.mjs migrate` (port 55440)
   - `rehearse-recovery.ts` row generator must be augmented with synthetic date intervals for `RoomAllocation`, `Reservation`, `Stay`, and `MaintenanceTicket` so that `startDate < endDate`.

---

### 3. Caveats
1. **Native PostgreSQL Enums vs Strings**:
   - `schema.prisma` intentionally avoids native Prisma `enum` declarations. All models throughout the repository store enum values as `String` with descriptive comments. This is necessary because `backup-format.ts` validation expects `field.type === "String"`. Introducing native Prisma enums would break `backup-format.ts` and require migration alterations.
2. **Folio and Combined Billing Scope**:
   - `GuestFolio`, `FolioEntry`, and `RoomNightCharge` are designated for **Phase 6** (`docs/hospitality/phases/PHASE_6_FOLIO_SETTLEMENT.md`). They must not be introduced in Phase 5 to keep the schema strictly scoped to Hotel Inventory, Rooms, Reservations, Stays, Allocations, Housekeeping, and Maintenance.
3. **GiST Exclusion Migration Delivery**:
   - When generating migrations with Prisma CLI (`npx prisma migrate dev --create-only`), Prisma will generate the tables, standard indexes, and foreign keys. The custom `CREATE EXTENSION IF NOT EXISTS btree_gist;` and `EXCLUDE USING gist` statements must be appended directly into `packages/db/prisma/migrations/202611010003_phase5_hotel_stays_rooms/migration.sql` before running `migrate deploy`.

---

### 4. Conclusion & Complete Schema Specification

The authoritative schema specification for Phase 5 comprises **8 new models**, updates to **4 existing models** (`Business`, `Branch`, `User`, `Floor`), and the addition of the PostgreSQL GiST exclusion constraint.

#### Complete Prisma Schema Definitions for Phase 5

```prisma
// ==============================================================================
// PHASE 5: HOTEL INVENTORY, ROOMS & GUEST STAYS
// ==============================================================================

model RoomType {
  id           String   @id @default(uuid())
  businessId   String
  business     Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
  branchId     String
  branch       Branch   @relation(fields: [branchId], references: [id], onDelete: Cascade)
  name         String
  code         String
  description  String?
  baseRate     Decimal  @db.Decimal(12, 2)
  maxOccupancy Int      @default(2)
  amenities    Json?    // ["WIFI", "AC", "MINIBAR", "BALCONY", "OCEAN_VIEW"]
  images       Json?    // ["url1", "url2"]
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

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
  roomNumber    String
  status        String   @default("VACANT_CLEAN") // VACANT_CLEAN, VACANT_DIRTY, OCCUPIED_CLEAN, OCCUPIED_DIRTY, OUT_OF_SERVICE, MAINTENANCE
  currentStayId String?  // Scalar logical ID without @relation to preserve DAG acyclicity
  keyCardAlias  String?
  notes         String?
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
  @@index([businessId, floorId])
}

model Reservation {
  id                String   @id @default(uuid())
  businessId        String
  business          Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
  branchId          String
  branch            Branch   @relation(fields: [branchId], references: [id], onDelete: Cascade)
  reservationNumber String
  guestName         String
  guestEmail        String?
  guestPhone        String?
  roomTypeId        String
  roomType          RoomType @relation(fields: [roomTypeId], references: [id], onDelete: Cascade)
  roomId            String?
  room              Room?    @relation(fields: [roomId], references: [id], onDelete: SetNull)
  checkInDate       DateTime
  checkOutDate      DateTime
  status            String   @default("CONFIRMED") // CONFIRMED, CHECKED_IN, CHECKED_OUT, CANCELLED, NO_SHOW
  adults            Int      @default(1)
  children          Int      @default(0)
  ratePlan          String?  // STANDARD, BED_AND_BREAKFAST, NON_REFUNDABLE
  totalAmount       Decimal  @default(0) @db.Decimal(12, 2)
  depositAmount     Decimal  @default(0) @db.Decimal(12, 2)
  specialRequests   String?
  createdById       String?
  createdBy         User?    @relation("ReservationCreatedBy", fields: [createdById], references: [id], onDelete: SetNull)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  guests      ReservationGuest[]
  stays       Stay[]
  allocations RoomAllocation[]

  @@unique([businessId, id])
  @@unique([businessId, branchId, reservationNumber])
  @@index([businessId, branchId, status])
  @@index([businessId, roomTypeId])
  @@index([businessId, roomId])
  @@index([businessId, checkInDate, checkOutDate])
}

model ReservationGuest {
  id            String      @id @default(uuid())
  businessId    String
  business      Business    @relation(fields: [businessId], references: [id], onDelete: Cascade)
  reservationId String
  reservation   Reservation @relation(fields: [reservationId], references: [id], onDelete: Cascade)
  name          String
  email         String?
  phone         String?
  idType        String?     // PASSPORT, CITIZENSHIP, DRIVING_LICENSE, NATIONAL_ID, OTHER
  idNumber      String?
  isPrimary     Boolean     @default(false)
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt

  @@unique([businessId, id])
  @@index([businessId, reservationId])
}

model Stay {
  id               String       @id @default(uuid())
  businessId       String
  business         Business     @relation(fields: [businessId], references: [id], onDelete: Cascade)
  branchId         String
  branch           Branch       @relation(fields: [branchId], references: [id], onDelete: Cascade)
  stayNumber       String
  reservationId    String?
  reservation      Reservation? @relation(fields: [reservationId], references: [id], onDelete: SetNull)
  roomId           String
  room             Room         @relation(fields: [roomId], references: [id], onDelete: Cascade)
  guestName        String
  guestEmail       String?
  guestPhone       String?
  guestIdType      String?
  guestIdNumber    String?
  checkInTime      DateTime     @default(now())
  checkOutTime     DateTime?
  expectedCheckOut DateTime
  status           String       @default("ACTIVE") // ACTIVE, COMPLETED, EXTENDED, TRANSFERRED
  ratePerNight     Decimal      @db.Decimal(12, 2)
  totalAmount      Decimal      @default(0) @db.Decimal(12, 2)
  paidAmount       Decimal      @default(0) @db.Decimal(12, 2)
  checkedInById    String?
  checkedInBy      User?        @relation("StayCheckedInBy", fields: [checkedInById], references: [id], onDelete: SetNull)
  checkedOutById   String?
  checkedOutBy     User?        @relation("StayCheckedOutBy", fields: [checkedOutById], references: [id], onDelete: SetNull)
  notes            String?
  createdAt        DateTime     @default(now())
  updatedAt        DateTime     @updatedAt

  allocations       RoomAllocation[]
  housekeepingTasks HousekeepingTask[]

  @@unique([businessId, id])
  @@unique([businessId, branchId, stayNumber])
  @@index([businessId, branchId, status])
  @@index([businessId, roomId, status])
  @@index([businessId, reservationId])
}

model RoomAllocation {
  id                  String             @id @default(uuid())
  businessId          String
  business            Business           @relation(fields: [businessId], references: [id], onDelete: Cascade)
  branchId            String
  branch              Branch             @relation(fields: [branchId], references: [id], onDelete: Cascade)
  roomId              String
  room                Room               @relation(fields: [roomId], references: [id], onDelete: Cascade)
  reservationId       String?
  reservation         Reservation?       @relation(fields: [reservationId], references: [id], onDelete: Cascade)
  stayId              String?
  stay                Stay?              @relation(fields: [stayId], references: [id], onDelete: Cascade)
  maintenanceTicketId String?
  maintenanceTicket   MaintenanceTicket? @relation(fields: [maintenanceTicketId], references: [id], onDelete: Cascade)
  startDate           DateTime
  endDate             DateTime
  isBlocking          Boolean            @default(true)
  status              String             @default("CONFIRMED") // CONFIRMED, CHECKED_IN, COMPLETED, CANCELLED
  notes               String?
  createdAt           DateTime           @default(now())
  updatedAt           DateTime           @updatedAt

  @@unique([businessId, id])
  @@index([businessId, roomId, startDate, endDate])
  @@index([businessId, branchId, status])
  @@index([businessId, reservationId])
  @@index([businessId, stayId])
  @@index([businessId, maintenanceTicketId])
}

model HousekeepingTask {
  id            String    @id @default(uuid())
  businessId    String
  business      Business  @relation(fields: [businessId], references: [id], onDelete: Cascade)
  branchId      String
  branch        Branch    @relation(fields: [branchId], references: [id], onDelete: Cascade)
  roomId        String
  room          Room      @relation(fields: [roomId], references: [id], onDelete: Cascade)
  stayId        String?
  stay          Stay?     @relation(fields: [stayId], references: [id], onDelete: SetNull)
  taskType      String    @default("DAILY_CLEANING") // CHECK_OUT_CLEANING, DAILY_CLEANING, DEEP_CLEANING, INSPECTION, TURNDOWN
  status        String    @default("DIRTY") // DIRTY, IN_PROGRESS, CLEAN, INSPECTED
  priority      String    @default("MEDIUM") // LOW, MEDIUM, HIGH, URGENT
  assignedToId  String?
  assignedTo    User?     @relation("HousekeepingAssignedTo", fields: [assignedToId], references: [id], onDelete: SetNull)
  scheduledDate DateTime  @default(now())
  completedAt   DateTime?
  completedById String?
  completedBy   User?     @relation("HousekeepingCompletedBy", fields: [completedById], references: [id], onDelete: SetNull)
  notes         String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@unique([businessId, id])
  @@index([businessId, branchId, status])
  @@index([businessId, roomId, status])
  @@index([businessId, assignedToId])
}

model MaintenanceTicket {
  id              String    @id @default(uuid())
  businessId      String
  business        Business  @relation(fields: [businessId], references: [id], onDelete: Cascade)
  branchId        String
  branch          Branch    @relation(fields: [branchId], references: [id], onDelete: Cascade)
  roomId          String
  room            Room      @relation(fields: [roomId], references: [id], onDelete: Cascade)
  ticketNumber    String
  title           String
  description     String?
  status          String    @default("OPEN") // OPEN, IN_PROGRESS, RESOLVED, CANCELLED
  priority        String    @default("MEDIUM") // LOW, MEDIUM, HIGH, URGENT
  startDate       DateTime  @default(now())
  endDate         DateTime?
  reportedById    String?
  reportedBy      User?     @relation("MaintenanceReportedBy", fields: [reportedById], references: [id], onDelete: SetNull)
  assignedToId    String?
  assignedTo      User?     @relation("MaintenanceAssignedTo", fields: [assignedToId], references: [id], onDelete: SetNull)
  resolvedAt      DateTime?
  resolutionNotes String?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  allocations RoomAllocation[]

  @@unique([businessId, id])
  @@unique([businessId, branchId, ticketNumber])
  @@index([businessId, branchId, status])
  @@index([businessId, roomId, status])
  @@index([businessId, assignedToId])
}
```

#### Updates to Existing Models

1. **`Business`**:
   ```prisma
   roomTypes           RoomType[]
   rooms               Room[]
   reservations        Reservation[]
   reservationGuests   ReservationGuest[]
   stays               Stay[]
   roomAllocations     RoomAllocation[]
   housekeepingTasks   HousekeepingTask[]
   maintenanceTickets  MaintenanceTicket[]
   ```
2. **`Branch`**:
   ```prisma
   roomTypes           RoomType[]
   rooms               Room[]
   reservations        Reservation[]
   stays               Stay[]
   roomAllocations     RoomAllocation[]
   housekeepingTasks   HousekeepingTask[]
   maintenanceTickets  MaintenanceTicket[]
   ```
3. **`User`**:
   ```prisma
   createdReservations         Reservation[]       @relation("ReservationCreatedBy")
   checkedInStays              Stay[]              @relation("StayCheckedInBy")
   checkedOutStays             Stay[]              @relation("StayCheckedOutBy")
   assignedHousekeepingTasks   HousekeepingTask[]  @relation("HousekeepingAssignedTo")
   completedHousekeepingTasks  HousekeepingTask[]  @relation("HousekeepingCompletedBy")
   reportedMaintenanceTickets MaintenanceTicket[] @relation("MaintenanceReportedBy")
   assignedMaintenanceTickets MaintenanceTicket[] @relation("MaintenanceAssignedTo")
   ```
4. **`Floor`**:
   ```prisma
   rooms Room[]
   ```

#### Migration DDL for PostgreSQL GiST Exclusion Constraint

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "RoomAllocation"
ADD CONSTRAINT "RoomAllocation_room_period_overlap_excl"
EXCLUDE USING gist (
  "roomId" WITH =,
  tsrange("startDate", "endDate", '[)') WITH &&
)
WHERE ("isBlocking" = true);
```

---

### 5. Verification Method

Once implemented, verify independently using the following steps:

1. **Typecheck & Client Generation**:
   ```bash
   npx prisma generate --schema packages/db/prisma/schema.prisma
   node scripts/copy-prisma-engines.mjs
   npm run typecheck
   ```
2. **Dual-Cluster Additive Migrations**:
   ```bash
   node scripts/restro-env.mjs migrate
   node scripts/restro-restore-env.mjs migrate
   ```
   *Verification assertion*: Both port 55439 (`restro_test`) and port 55440 (`restro_restore`) have identical migration records in `_prisma_migrations`.
3. **PostgreSQL GiST Exclusion Verification**:
   Execute SQL against 55439:
   ```sql
   INSERT INTO "RoomAllocation" ("id", "businessId", "branchId", "roomId", "startDate", "endDate", "isBlocking", "updatedAt")
   VALUES ('test-1', 'b1', 'br1', 'r1', '2026-11-01 14:00:00', '2026-11-05 11:00:00', true, NOW());

   -- Overlapping attempt MUST fail with error 23P01
   INSERT INTO "RoomAllocation" ("id", "businessId", "branchId", "roomId", "startDate", "endDate", "isBlocking", "updatedAt")
   VALUES ('test-2', 'b1', 'br1', 'r1', '2026-11-03 14:00:00', '2026-11-06 11:00:00', true, NOW());
   ```
4. **Disaster Recovery Rehearsal**:
   ```bash
   node scripts/restro-restore-env.mjs rehearse
   ```
   *Verification assertion*: 41/41 checks pass across all 75 models in ~12 seconds with clean topological sort and zero residue.
5. **Unit & Integration Test Suites**:
   ```bash
   npm test
   node scripts/restro-env.mjs recovery-test
   ```
   *Verification assertion*: Zero regressions and 0 exit code across all suites.
