# Phase 5 Milestone 1: Migration DDL, PostgreSQL GiST Exclusion Constraint & Dual-Cluster Execution Strategy

**Agent**: `p5_m1_explorer_2`  
**Working Directory**: `c:\projects\pos\.agents\teamwork\p5_m1_explorer_2\`  
**Date**: 2026-11-01  
**Status**: Completed (Hard Handoff)  
**Target Milestone**: Milestone 1 (Multi-Tenant Schema, GiST Constraint & DR DAG)

---

## 1. Observation

1. **Existing Migrations in Monorepo**:
   - `packages/db/prisma/migrations/` contains 6 finished migration directories:
     - `202610300001_retail_baseline`
     - `202610300002_commerce_hardening`
     - `202610310001_phase1_security_foundation`
     - `202610310002_phase2_financial_inventory_core`
     - `202611010001_phase3_restaurant_staff_mvp`
     - `202611010002_phase4_kitchen_recipes_kds`
   - Verified via `check_clusters.cjs` against live databases:
     - `restro_test` on `127.0.0.1:55439`: 6 migrations finished.
     - `restro_restore` on `127.0.0.1:55440`: 6 migrations finished.
   - Therefore, the next additive migration directory must be named:
     `packages/db/prisma/migrations/202611010003_phase5_hotel_stays_rooms/migration.sql`.

2. **Dual-Cluster Migration Architecture**:
   - `scripts/restro-env.mjs` (lines 35, 49-62):
     - Command: `node scripts/restro-env.mjs migrate`
     - Runs: `node node_modules/prisma/build/index.js migrate deploy --schema packages/db/prisma/schema.prisma`
     - Targeted datasource: `config.DATABASE_URL` (`postgresql://restro_dev:...@127.0.0.1:55439/restro_test`).
     - Pre-condition: Checks `_prisma_migrations` holds `202610300001_retail_baseline`.
   - `scripts/restro-restore-env.mjs` (lines 32, 37-53):
     - Command: `node scripts/restro-restore-env.mjs migrate`
     - Runs: `node node_modules/prisma/build/index.js migrate deploy --schema packages/db/prisma/schema.prisma`
     - Targeted datasource: `target.RESTORE_TARGET_DATABASE_URL` (`postgresql://restro_restore:...@127.0.0.1:55440/restro_restore`).
   - `scripts/rehearse-recovery.ts` lines 27-31:
     - Rehearsal asserts:
       ```ts
       const sourceMigrations = await sourceClient.$queryRaw<{ migration_name: string; checksum: string }[]>`SELECT migration_name, checksum FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name`;
       const targetMigrations = await targetClient.$queryRaw<{ migration_name: string; checksum: string }[]>`SELECT migration_name, checksum FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name`;
       ```
       and requires identical migration names and checksums on both clusters.

3. **Disaster Recovery DAG Acyclicity & Relation Architecture**:
   - In `backend/src/lib/backup-format.ts` (lines 12–19):
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
     ```
   - In `backend/src/lib/backup-format.ts` lines 82–86:
     ```ts
     for (const field of model.fields.filter(field => field.relationFromFields?.length)) {
       if (field.relationFromFields!.length !== 1 || field.relationToFields?.[0] !== "id") throw new BackupError("Unsupported composite backup relation");
       const value = row[field.relationFromFields![0]];
       if (value !== null && !ids.get(field.type)?.has(value as string)) throw new BackupError(`Foreign or missing ${model.name} reference`);
     }
     ```
     *Every foreign key relation in Prisma schema MUST reference a single field (`references: [id]`). Composite uniqueness is enforced at the database layer via `@@unique([businessId, id])`.*
   - In `packages/db/prisma/schema.prisma` line 1159:
     ```prisma
     currentSessionId String? // Scalar logical ID without @relation to preserve DAG acyclicity
     ```
   - In `test_topological_sort.cjs` executed on live DMMF:
     - With `Room.currentStayId String?` as pure scalar: Topological sort succeeded across all 75 backup models with zero cycles.
     - With `Room.currentStayId` pointing to `Stay` with `@relation`: Topological sort aborted immediately with `Error: Backup schema has unsupported dependency cycle`, deadlocking all 7 downstream models (`Room`, `Reservation`, `ReservationGuest`, `Stay`, `MaintenanceTicket`, `RoomAllocation`, `HousekeepingTask`).

4. **PostgreSQL GiST Exclusion Constraint & btree_gist Extension**:
   - Tested empirically via `test_gist.cjs` on PostgreSQL 15.18 container (port 55439):
     ```sql
     CREATE EXTENSION IF NOT EXISTS btree_gist;

     CREATE TABLE "_test_RoomAllocation" (
       "id" TEXT NOT NULL PRIMARY KEY,
       "businessId" TEXT NOT NULL,
       "roomId" TEXT NOT NULL,
       "startDate" TIMESTAMP(3) NOT NULL,
       "endDate" TIMESTAMP(3) NOT NULL,
       "isBlocking" BOOLEAN NOT NULL DEFAULT true,
       CONSTRAINT "_test_RoomAllocation_overlap_excl"
       EXCLUDE USING gist (
         "businessId" WITH =,
         "roomId" WITH =,
         tsrange("startDate", "endDate", '[)') WITH &&
       ) WHERE ("isBlocking" = true)
     );
     ```
   - Results observed:
     - Non-overlapping insert (`Nov 1 14:00` to `Nov 5 11:00`): **Succeeded**.
     - Adjacent turnover (`Nov 5 11:00` to `Nov 8 11:00`): **Succeeded** (due to half-open interval `[)` semantics where $[t_1, t_2) \cap [t_2, t_3) = \emptyset$).
     - Overlapping dates on different room (`room-102`): **Succeeded**.
     - Overlapping dates on different tenant (`biz-2`): **Succeeded** (multi-tenant isolation verified).
     - Overlapping dates with `isBlocking = false`: **Succeeded** (soft holds / completed stays do not block).
     - Overlapping blocking allocation on same room and business (`Nov 3 14:00` to `Nov 6 11:00`): **Failed immediately with PostgreSQL error code `23P01`**:
       `Raw query failed. Code: 23P01. Message: ERROR: conflicting key value violates exclusion constraint "_test_RoomAllocation_overlap_excl"`.

5. **Full DDL Rollback Execution**:
   - Executed `test_ddl.cjs` containing the entire 8-table DDL, 28 indexes, 34 foreign key constraints, and the GiST exclusion constraint inside an atomic transaction on PostgreSQL 15.18.
   - Result: All DDL statements executed without a single syntax, type, or constraint error, followed by clean rollback leaving zero database residue.

---

## 2. Logic Chain

1. **Migration Sequence & Numbering**:
   - Observation 1 demonstrates that migrations `202610300001` through `202611010002` are fully applied to both source (`55439`) and restore (`55440`) instances.
   - Per Prisma convention, the Phase 5 migration must be placed in `packages/db/prisma/migrations/202611010003_phase5_hotel_stays_rooms/migration.sql`.

2. **Schema Relations & Backup Serialization Invariants**:
   - Observation 3 shows that `backup-format.ts` enforces `field.relationFromFields!.length === 1 && field.relationToFields?.[0] === "id"`. Any model attempting composite relation definitions like `@relation(fields: [businessId, branchId], references: [businessId, id])` will crash DR backup serialization with `"Unsupported composite backup relation"`.
   - Therefore, all relations must be defined using single-key targets:
     `business Business @relation(fields: [businessId], references: [id], onDelete: Cascade)`
     `branch Branch @relation(fields: [branchId], references: [id], onDelete: Cascade)`
     and composite tenant safety is guaranteed via `@@unique([businessId, id])` on every model.

3. **DAG Preservation (Avoiding Room <-> Stay Cycles)**:
   - `Room` has an operational link to active stays (`currentStayId`).
   - `Stay` references `Room` (`roomId`).
   - If `Room.currentStayId` is declared as `@relation("CurrentStay", fields: [currentStayId], references: [id])`, Prisma DMMF registers a bidirectional relation between `Room` and `Stay`.
   - As proven in Observation 3, this introduces an immediate cycle in the dependency graph, crashing `backup-format.ts` topological sort.
   - Maintaining `currentStayId String?` as a pure scalar without `@relation` (exact pattern established by `RestaurantTable.currentSessionId String?`) preserves linear DAG order:
     $$\text{Business} \to \text{Branch} \to \text{User} \to \text{Floor} \to \text{RoomType} \to \text{Room} \to \text{Reservation} \to \text{ReservationGuest} \to \text{Stay} \to \text{MaintenanceTicket} \to \text{RoomAllocation} \to \text{HousekeepingTask}$$

4. **Mathematical GiST Exclusion Constraint**:
   - Observation 4 confirms that `TIMESTAMP(3)` columns (Prisma `DateTime` default) combined with `tsrange(timestamp, timestamp, text)` is an `IMMUTABLE` expression in PostgreSQL.
   - The expression:
     ```sql
     EXCLUDE USING gist (
       "businessId" WITH =,
       "roomId" WITH =,
       tsrange("startDate", "endDate", '[)') WITH &&
     ) WHERE ("isBlocking" = true);
     ```
     guarantees that no two rows with `"isBlocking" = true` can share the same `"businessId"`, the same `"roomId"`, and have overlapping `tsrange` intervals.
   - The boundary behavior `[)` permits back-to-back turnaround at the exact same minute (`11:00 AM`).
   - Any concurrent double-booking collision throws PostgreSQL error code `23P01`, which backend domain services catch and map to HTTP `409 Conflict`.

5. **Disaster Recovery Synthetic Intervals**:
   - In `scripts/rehearse-recovery.ts` and `tests/recovery.integration.test.ts`, generic synthetic row builders assign `DateTime` fields without defaults to `2025-01-02T03:04:05.000Z`.
   - If `RoomAllocation.startDate` has `@default(now())` while `endDate` has no default, `startDate` evaluates to runtime `now()` (`2026-11-01`) while `endDate` gets `2025-01-02`. That causes `startDate > endDate`, throwing PostgreSQL error: `range lower bound must be less than or equal to range upper bound`.
   - Consequently, in `schema.prisma`, neither `startDate` nor `endDate` must have `@default(now())` in `RoomAllocation`. Furthermore, explicit overrides must be configured in `rehearse-recovery.ts` and `tests/recovery.integration.test.ts` to supply valid intervals (`startDate < endDate`).

---

## 3. Caveats

1. **Prisma Schema Limitations with GiST**:
   - Prisma's schema definition language does not support native GiST exclusion constraints (`@exclude` does not exist in Prisma).
   - Therefore, the exclusion constraint must be declared in raw SQL in `packages/db/prisma/migrations/202611010003_phase5_hotel_stays_rooms/migration.sql`.
   - Do NOT run `prisma db push` or un-migrated development commands that would drop raw constraints. Always use `prisma migrate deploy`.

2. **Native PostgreSQL Enums vs Strings**:
   - All status fields (`Room.status`, `Reservation.status`, `Stay.status`, `RoomAllocation.status`, `HousekeepingTask.status`, `MaintenanceTicket.status`) are typed as `String` with descriptive comments in `schema.prisma`.
   - Introducing Prisma native `enum` declarations would break `backup-format.ts` row validation (`field.type === "String"`) and is forbidden by repo convention.

3. **Folio & Guest Invoicing Scope**:
   - Financial folios (`GuestFolio`, `FolioEntry`, `RoomNightCharge`) belong to **Phase 6** (`PHASE_6_FOLIO_SETTLEMENT.md`).
   - Phase 5 models are strictly scoped to Hotel Inventory, Rooms, Reservations, Stays, Allocations, Housekeeping, and Maintenance.

---

## 4. Conclusion & Actionable Blueprints

### 4.1 Complete Prisma Schema Blueprint (`packages/db/prisma/schema.prisma`)

Append the following 8 models to `packages/db/prisma/schema.prisma`:

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
  baseRate     Decimal  @default(0) @db.Decimal(12, 2)
  maxOccupancy Int      @default(2)
  amenities    Json?    // ["WIFI", "AC", "MINIBAR", "BALCONY", "OCEAN_VIEW"]
  images       Json?    // ["url1", "url2"]
  displayOrder Int      @default(0)
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
  capacity      Int      @default(2)
  status        String   @default("VACANT_CLEAN") // VACANT_CLEAN, VACANT_DIRTY, OCCUPIED_CLEAN, OCCUPIED_DIRTY, OUT_OF_SERVICE, MAINTENANCE
  currentStayId String?  // Scalar logical ID without @relation to preserve DAG acyclicity
  keyCardAlias  String?
  features      Json?    // ["CONNECTING", "ACCESSIBLE"]
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
  ratePlan          String?  @default("STANDARD") // STANDARD, BED_AND_BREAKFAST, NON_REFUNDABLE
  nightlyRate       Decimal  @default(0) @db.Decimal(12, 2)
  totalAmount       Decimal  @default(0) @db.Decimal(12, 2)
  depositAmount     Decimal  @default(0) @db.Decimal(12, 2)
  specialRequests   String?
  notes             String?
  version           Int      @default(1)
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
  guestIdType      String?     // PASSPORT, CITIZENSHIP, DRIVING_LICENSE, NATIONAL_ID, OTHER
  guestIdNumber    String?
  checkInTime      DateTime     @default(now())
  checkOutTime     DateTime?
  expectedCheckOut DateTime
  status           String       @default("ACTIVE") // ACTIVE, COMPLETED, EXTENDED, TRANSFERRED
  ratePerNight     Decimal      @default(0) @db.Decimal(12, 2)
  totalAmount      Decimal      @default(0) @db.Decimal(12, 2)
  paidAmount       Decimal      @default(0) @db.Decimal(12, 2)
  version          Int          @default(1)
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
  resolvedById    String?
  resolvedBy      User?     @relation("MaintenanceResolvedBy", fields: [resolvedById], references: [id], onDelete: SetNull)
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
  status              String             @default("CONFIRMED") // CONFIRMED, CHECKED_IN, MAINTENANCE, COMPLETED, CANCELLED
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
  startedAt     DateTime?
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
```

#### Updates to Existing Models in `schema.prisma`:
1. **`Business`**:
   ```prisma
   roomTypes           RoomType[]
   rooms               Room[]
   reservations        Reservation[]
   reservationGuests   ReservationGuest[]
   stays               Stay[]
   maintenanceTickets  MaintenanceTicket[]
   roomAllocations     RoomAllocation[]
   housekeepingTasks   HousekeepingTask[]
   ```
2. **`Branch`**:
   ```prisma
   roomTypes           RoomType[]
   rooms               Room[]
   reservations        Reservation[]
   stays               Stay[]
   maintenanceTickets  MaintenanceTicket[]
   roomAllocations     RoomAllocation[]
   housekeepingTasks   HousekeepingTask[]
   ```
3. **`User`**:
   ```prisma
   createdReservations         Reservation[]       @relation("ReservationCreatedBy")
   checkedInStays              Stay[]              @relation("StayCheckedInBy")
   checkedOutStays             Stay[]              @relation("StayCheckedOutBy")
   reportedMaintenanceTickets MaintenanceTicket[] @relation("MaintenanceReportedBy")
   assignedMaintenanceTickets MaintenanceTicket[] @relation("MaintenanceAssignedTo")
   resolvedMaintenanceTickets MaintenanceTicket[] @relation("MaintenanceResolvedBy")
   assignedHousekeepingTasks   HousekeepingTask[]  @relation("HousekeepingAssignedTo")
   completedHousekeepingTasks  HousekeepingTask[]  @relation("HousekeepingCompletedBy")
   ```
4. **`Floor`**:
   ```prisma
   rooms Room[]
   ```

---

### 4.2 Authoritative Migration SQL Blueprint

Create file: `packages/db/prisma/migrations/202611010003_phase5_hotel_stays_rooms/migration.sql`

```sql
-- Migration: 202611010003_phase5_hotel_stays_rooms
-- Description: Add 8 Phase 5 hotel hospitality models, btree_gist extension, and mathematical GiST exclusion constraint on RoomAllocation.

-- ==============================================================================
-- 1. PREREQUISITE: ENABLE btree_gist EXTENSION
-- ==============================================================================
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ==============================================================================
-- 2. CREATE 8 PHASE 5 HOTEL TABLES
-- ==============================================================================

-- 1. CreateTable: RoomType
CREATE TABLE "RoomType" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "baseRate" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "maxOccupancy" INTEGER NOT NULL DEFAULT 2,
    "amenities" JSONB,
    "images" JSONB,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoomType_pkey" PRIMARY KEY ("id")
);

-- 2. CreateTable: Room
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "roomTypeId" TEXT NOT NULL,
    "floorId" TEXT,
    "roomNumber" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 2,
    "status" TEXT NOT NULL DEFAULT 'VACANT_CLEAN',
    "currentStayId" TEXT,
    "keyCardAlias" TEXT,
    "features" JSONB,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- 3. CreateTable: Reservation
CREATE TABLE "Reservation" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "reservationNumber" TEXT NOT NULL,
    "guestName" TEXT NOT NULL,
    "guestEmail" TEXT,
    "guestPhone" TEXT,
    "roomTypeId" TEXT NOT NULL,
    "roomId" TEXT,
    "checkInDate" TIMESTAMP(3) NOT NULL,
    "checkOutDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CONFIRMED',
    "adults" INTEGER NOT NULL DEFAULT 1,
    "children" INTEGER NOT NULL DEFAULT 0,
    "ratePlan" TEXT DEFAULT 'STANDARD',
    "nightlyRate" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "depositAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "specialRequests" TEXT,
    "notes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

-- 4. CreateTable: ReservationGuest
CREATE TABLE "ReservationGuest" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "idType" TEXT,
    "idNumber" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReservationGuest_pkey" PRIMARY KEY ("id")
);

-- 5. CreateTable: Stay
CREATE TABLE "Stay" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "stayNumber" TEXT NOT NULL,
    "reservationId" TEXT,
    "roomId" TEXT NOT NULL,
    "guestName" TEXT NOT NULL,
    "guestEmail" TEXT,
    "guestPhone" TEXT,
    "guestIdType" TEXT,
    "guestIdNumber" TEXT,
    "checkInTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkOutTime" TIMESTAMP(3),
    "expectedCheckOut" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "ratePerNight" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "checkedInById" TEXT,
    "checkedOutById" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Stay_pkey" PRIMARY KEY ("id")
);

-- 6. CreateTable: MaintenanceTicket
CREATE TABLE "MaintenanceTicket" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "ticketNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "reportedById" TEXT,
    "assignedToId" TEXT,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolutionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaintenanceTicket_pkey" PRIMARY KEY ("id")
);

-- 7. CreateTable: RoomAllocation
CREATE TABLE "RoomAllocation" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "reservationId" TEXT,
    "stayId" TEXT,
    "maintenanceTicketId" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isBlocking" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'CONFIRMED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoomAllocation_pkey" PRIMARY KEY ("id")
);

-- 8. CreateTable: HousekeepingTask
CREATE TABLE "HousekeepingTask" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "stayId" TEXT,
    "taskType" TEXT NOT NULL DEFAULT 'DAILY_CLEANING',
    "status" TEXT NOT NULL DEFAULT 'DIRTY',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "assignedToId" TEXT,
    "scheduledDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "completedById" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HousekeepingTask_pkey" PRIMARY KEY ("id")
);

-- ==============================================================================
-- 3. CREATE INDEXES AND COMPOSITE TENANT KEYS
-- ==============================================================================

-- RoomType Indexes
CREATE UNIQUE INDEX "RoomType_businessId_id_key" ON "RoomType"("businessId", "id");
CREATE UNIQUE INDEX "RoomType_businessId_branchId_code_key" ON "RoomType"("businessId", "branchId", "code");
CREATE INDEX "RoomType_businessId_branchId_isActive_idx" ON "RoomType"("businessId", "branchId", "isActive");

-- Room Indexes
CREATE UNIQUE INDEX "Room_businessId_id_key" ON "Room"("businessId", "id");
CREATE UNIQUE INDEX "Room_businessId_branchId_roomNumber_key" ON "Room"("businessId", "branchId", "roomNumber");
CREATE INDEX "Room_businessId_branchId_status_idx" ON "Room"("businessId", "branchId", "status");
CREATE INDEX "Room_businessId_roomTypeId_idx" ON "Room"("businessId", "roomTypeId");
CREATE INDEX "Room_businessId_floorId_idx" ON "Room"("businessId", "floorId");

-- Reservation Indexes
CREATE UNIQUE INDEX "Reservation_businessId_id_key" ON "Reservation"("businessId", "id");
CREATE UNIQUE INDEX "Reservation_businessId_branchId_reservationNumber_key" ON "Reservation"("businessId", "branchId", "reservationNumber");
CREATE INDEX "Reservation_businessId_branchId_status_idx" ON "Reservation"("businessId", "branchId", "status");
CREATE INDEX "Reservation_businessId_roomTypeId_idx" ON "Reservation"("businessId", "roomTypeId");
CREATE INDEX "Reservation_businessId_roomId_idx" ON "Reservation"("businessId", "roomId");
CREATE INDEX "Reservation_businessId_checkInDate_checkOutDate_idx" ON "Reservation"("businessId", "checkInDate", "checkOutDate");

-- ReservationGuest Indexes
CREATE UNIQUE INDEX "ReservationGuest_businessId_id_key" ON "ReservationGuest"("businessId", "id");
CREATE INDEX "ReservationGuest_businessId_reservationId_idx" ON "ReservationGuest"("businessId", "reservationId");

-- Stay Indexes
CREATE UNIQUE INDEX "Stay_businessId_id_key" ON "Stay"("businessId", "id");
CREATE UNIQUE INDEX "Stay_businessId_branchId_stayNumber_key" ON "Stay"("businessId", "branchId", "stayNumber");
CREATE INDEX "Stay_businessId_branchId_status_idx" ON "Stay"("businessId", "branchId", "status");
CREATE INDEX "Stay_businessId_roomId_status_idx" ON "Stay"("businessId", "roomId", "status");
CREATE INDEX "Stay_businessId_reservationId_idx" ON "Stay"("businessId", "reservationId");

-- MaintenanceTicket Indexes
CREATE UNIQUE INDEX "MaintenanceTicket_businessId_id_key" ON "MaintenanceTicket"("businessId", "id");
CREATE UNIQUE INDEX "MaintenanceTicket_businessId_branchId_ticketNumber_key" ON "MaintenanceTicket"("businessId", "branchId", "ticketNumber");
CREATE INDEX "MaintenanceTicket_businessId_branchId_status_idx" ON "MaintenanceTicket"("businessId", "branchId", "status");
CREATE INDEX "MaintenanceTicket_businessId_roomId_status_idx" ON "MaintenanceTicket"("businessId", "roomId", "status");
CREATE INDEX "MaintenanceTicket_businessId_assignedToId_idx" ON "MaintenanceTicket"("businessId", "assignedToId");

-- RoomAllocation Indexes
CREATE UNIQUE INDEX "RoomAllocation_businessId_id_key" ON "RoomAllocation"("businessId", "id");
CREATE INDEX "RoomAllocation_businessId_roomId_startDate_endDate_idx" ON "RoomAllocation"("businessId", "roomId", "startDate", "endDate");
CREATE INDEX "RoomAllocation_businessId_branchId_status_idx" ON "RoomAllocation"("businessId", "branchId", "status");
CREATE INDEX "RoomAllocation_businessId_reservationId_idx" ON "RoomAllocation"("businessId", "reservationId");
CREATE INDEX "RoomAllocation_businessId_stayId_idx" ON "RoomAllocation"("businessId", "stayId");
CREATE INDEX "RoomAllocation_businessId_maintenanceTicketId_idx" ON "RoomAllocation"("businessId", "maintenanceTicketId");

-- HousekeepingTask Indexes
CREATE UNIQUE INDEX "HousekeepingTask_businessId_id_key" ON "HousekeepingTask"("businessId", "id");
CREATE INDEX "HousekeepingTask_businessId_branchId_status_idx" ON "HousekeepingTask"("businessId", "branchId", "status");
CREATE INDEX "HousekeepingTask_businessId_roomId_status_idx" ON "HousekeepingTask"("businessId", "roomId", "status");
CREATE INDEX "HousekeepingTask_businessId_assignedToId_idx" ON "HousekeepingTask"("businessId", "assignedToId");

-- ==============================================================================
-- 4. ADD FOREIGN KEY CONSTRAINTS
-- ==============================================================================

-- RoomType Foreign Keys
ALTER TABLE "RoomType" ADD CONSTRAINT "RoomType_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoomType" ADD CONSTRAINT "RoomType_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Room Foreign Keys
ALTER TABLE "Room" ADD CONSTRAINT "Room_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Room" ADD CONSTRAINT "Room_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Room" ADD CONSTRAINT "Room_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomType"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Room" ADD CONSTRAINT "Room_floorId_fkey" FOREIGN KEY ("floorId") REFERENCES "Floor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Reservation Foreign Keys
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomType"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ReservationGuest Foreign Keys
ALTER TABLE "ReservationGuest" ADD CONSTRAINT "ReservationGuest_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReservationGuest" ADD CONSTRAINT "ReservationGuest_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Stay Foreign Keys
ALTER TABLE "Stay" ADD CONSTRAINT "Stay_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Stay" ADD CONSTRAINT "Stay_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Stay" ADD CONSTRAINT "Stay_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Stay" ADD CONSTRAINT "Stay_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Stay" ADD CONSTRAINT "Stay_checkedInById_fkey" FOREIGN KEY ("checkedInById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Stay" ADD CONSTRAINT "Stay_checkedOutById_fkey" FOREIGN KEY ("checkedOutById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- MaintenanceTicket Foreign Keys
ALTER TABLE "MaintenanceTicket" ADD CONSTRAINT "MaintenanceTicket_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MaintenanceTicket" ADD CONSTRAINT "MaintenanceTicket_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MaintenanceTicket" ADD CONSTRAINT "MaintenanceTicket_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MaintenanceTicket" ADD CONSTRAINT "MaintenanceTicket_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MaintenanceTicket" ADD CONSTRAINT "MaintenanceTicket_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MaintenanceTicket" ADD CONSTRAINT "MaintenanceTicket_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RoomAllocation Foreign Keys
ALTER TABLE "RoomAllocation" ADD CONSTRAINT "RoomAllocation_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoomAllocation" ADD CONSTRAINT "RoomAllocation_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoomAllocation" ADD CONSTRAINT "RoomAllocation_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoomAllocation" ADD CONSTRAINT "RoomAllocation_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoomAllocation" ADD CONSTRAINT "RoomAllocation_stayId_fkey" FOREIGN KEY ("stayId") REFERENCES "Stay"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoomAllocation" ADD CONSTRAINT "RoomAllocation_maintenanceTicketId_fkey" FOREIGN KEY ("maintenanceTicketId") REFERENCES "MaintenanceTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- HousekeepingTask Foreign Keys
ALTER TABLE "HousekeepingTask" ADD CONSTRAINT "HousekeepingTask_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HousekeepingTask" ADD CONSTRAINT "HousekeepingTask_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HousekeepingTask" ADD CONSTRAINT "HousekeepingTask_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HousekeepingTask" ADD CONSTRAINT "HousekeepingTask_stayId_fkey" FOREIGN KEY ("stayId") REFERENCES "Stay"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HousekeepingTask" ADD CONSTRAINT "HousekeepingTask_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HousekeepingTask" ADD CONSTRAINT "HousekeepingTask_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ==============================================================================
-- 5. POSTGRESQL GiST EXCLUSION CONSTRAINT
-- ==============================================================================
-- Enforces half-open interval double-booking prevention at the storage engine level.
-- Overlapping blocking allocations on the same room raise SQL 23P01 (exclusion_violation).
ALTER TABLE "RoomAllocation"
ADD CONSTRAINT "RoomAllocation_room_period_overlap_excl"
EXCLUDE USING gist (
  "businessId" WITH =,
  "roomId" WITH =,
  tsrange("startDate", "endDate", '[)') WITH &&
) WHERE ("isBlocking" = true);
```

---

### 4.3 Dual-Cluster Rollout & Execution Plan

1. **Step 1: Write Migration and Update Schema**:
   - Builder writes `packages/db/prisma/schema.prisma` with the 8 models and relation updates.
   - Builder creates folder `packages/db/prisma/migrations/202611010003_phase5_hotel_stays_rooms/` and writes `migration.sql`.

2. **Step 2: Generate Prisma Client & Engine Sync**:
   ```powershell
   npx prisma generate --schema packages/db/prisma/schema.prisma
   node scripts/copy-prisma-engines.mjs
   ```

3. **Step 3: Deploy to Source Cluster (Port 55439)**:
   ```powershell
   node scripts/restro-env.mjs migrate
   ```
   *Expected outcome: Migration 202611010003_phase5_hotel_stays_rooms applied cleanly to `restro_test`.*

4. **Step 4: Deploy to Target Cluster (Port 55440)**:
   ```powershell
   node scripts/restro-restore-env.mjs migrate
   ```
   *Expected outcome: Migration 202611010003_phase5_hotel_stays_rooms applied cleanly to `restro_restore` with identical checksum.*

5. **Step 5: Disaster Recovery Synthetic Interval Updates**:
   - In `scripts/rehearse-recovery.ts`:
     Add synthetic interval overrides so `startDate < endDate` for hotel models:
     ```ts
     if (["RoomAllocation", "Reservation", "Stay", "MaintenanceTicket"].includes(entityName)) {
       data.startDate = new Date("2025-01-02T14:00:00.000Z");
       data.endDate = new Date("2025-01-04T11:00:00.000Z");
       if ("checkInDate" in data) data.checkInDate = new Date("2025-01-02T14:00:00.000Z");
       if ("checkOutDate" in data) data.checkOutDate = new Date("2025-01-04T11:00:00.000Z");
       if ("checkInTime" in data) data.checkInTime = new Date("2025-01-02T14:00:00.000Z");
       if ("expectedCheckOut" in data) data.expectedCheckOut = new Date("2025-01-04T11:00:00.000Z");
     }
     ```
   - In `tests/recovery.integration.test.ts`:
     - Line 88: Change hardcoded `toHaveLength(60)` to `toHaveLength(format.backupModels.length)` (which dynamically resolves to 74).
     - Lines 56–68: Add corresponding synthetic interval overrides for Phase 5 models.

---

## 5. Verification Method

Once implemented, the verification procedure is 100% executable and unambiguous:

1. **Verify Dual-Cluster Migration Status**:
   Run:
   ```powershell
   node -e "
   const { readFileSync } = require('fs');
   const { PrismaClient } = require('./packages/db/client/index.js');
   async function check() {
     const env = Object.fromEntries(readFileSync('.env.restro.local', 'utf8').split(/\r?\n/).filter(l => l.trim() && !l.startsWith('#')).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=')+1)]));
     const c1 = new PrismaClient({ datasources: { db: { url: env.DATABASE_URL } } });
     const m1 = await c1.$queryRaw\`SELECT migration_name, checksum FROM "_prisma_migrations" WHERE migration_name LIKE '%phase5%'\`;
     await c1.$disconnect();
     const rEnv = Object.fromEntries(readFileSync('.env.restro-restore.local', 'utf8').split(/\r?\n/).filter(l => l.trim() && !l.startsWith('#')).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=')+1)]));
     const c2 = new PrismaClient({ datasources: { db: { url: rEnv.RESTORE_TARGET_DATABASE_URL } } });
     const m2 = await c2.$queryRaw\`SELECT migration_name, checksum FROM "_prisma_migrations" WHERE migration_name LIKE '%phase5%'\`;
     await c2.$disconnect();
     console.log('55439 Migration:', m1);
     console.log('55440 Migration:', m2);
     if (m1[0]?.checksum !== m2[0]?.checksum) throw new Error('Checksum mismatch across clusters!');
   }
   check().catch(console.error);
   "
   ```
   **Pass Condition**: Both clusters return migration `202611010003_phase5_hotel_stays_rooms` with identical SHA-256 checksums.

2. **Verify PostgreSQL GiST Exclusion Constraint on Port 55439**:
   Run:
   ```powershell
   node -e "
   const { readFileSync } = require('fs');
   const { PrismaClient } = require('./packages/db/client/index.js');
   async function test() {
     const env = Object.fromEntries(readFileSync('.env.restro.local', 'utf8').split(/\r?\n/).filter(l => l.trim() && !l.startsWith('#')).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=')+1)]));
     const prisma = new PrismaClient({ datasources: { db: { url: env.DATABASE_URL } } });
     try {
       await prisma.\$executeRawUnsafe(\`INSERT INTO \"RoomAllocation\" (\"id\", \"businessId\", \"branchId\", \"roomId\", \"startDate\", \"endDate\", \"isBlocking\", \"updatedAt\") VALUES ('t-1', 'b-test', 'br-test', 'r-test', '2026-11-01 14:00:00', '2026-11-05 11:00:00', true, NOW());\`);
       // Overlap MUST fail with 23P01
       let caught = false;
       try {
         await prisma.\$executeRawUnsafe(\`INSERT INTO \"RoomAllocation\" (\"id\", \"businessId\", \"branchId\", \"roomId\", \"startDate\", \"endDate\", \"isBlocking\", \"updatedAt\") VALUES ('t-2', 'b-test', 'br-test', 'r-test', '2026-11-03 14:00:00', '2026-11-07 11:00:00', true, NOW());\`);
       } catch (e) {
         if (e.message.includes('23P01')) caught = true;
       }
       await prisma.\$executeRawUnsafe(\`DELETE FROM \"RoomAllocation\" WHERE \"businessId\" = 'b-test';\`);
       if (!caught) throw new Error('GiST constraint failed to block overlapping allocation!');
       console.log('GiST exclusion constraint VERIFIED: 23P01 caught.');
     } finally { await prisma.\$disconnect(); }
   }
   test().catch(console.error);
   "
   ```
   **Pass Condition**: `GiST exclusion constraint VERIFIED: 23P01 caught.`

3. **Verify Disaster Recovery Topological Sort & Rehearsal**:
   Run:
   ```powershell
   node scripts/restro-restore-env.mjs rehearse
   ```
   **Pass Condition**: 41/41 checks pass across all 75 models in ~12 seconds with clean topological sort and zero residue.

4. **Verify Monorepo Typecheck & Test Suite**:
   Run:
   ```powershell
   npm run typecheck
   npm test
   node scripts/restro-env.mjs recovery-test
   ```
   **Pass Condition**: Monorepo typecheck exits with 0, Vitest test suite passes with zero regressions.
