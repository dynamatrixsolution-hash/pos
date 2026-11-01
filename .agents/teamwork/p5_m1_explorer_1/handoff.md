# Phase 5 Milestone 1 Schema Strategy & Architecture Analysis Report

**Agent**: `p5_m1_explorer_1`  
**Working Directory**: `c:\projects\pos\.agents\teamwork\p5_m1_explorer_1\`  
**Target Milestone**: Milestone 1 — Schema Additions, GiST Exclusion, Client Generation & DR Topology  
**Date**: 2026-11-01  
**Status**: Completed (Hard Handoff)

---

## 1. Observation

1. **Current Schema & Model Inventory**:
   - `packages/db/prisma/schema.prisma` currently contains 68 models (67 tenant models + 1 excluded platform onboarding model `BusinessRegistrationRequest`).
   - Verified via `tsx`:
     ```bash
     node node_modules/tsx/dist/cli.mjs -e "import { Prisma } from '@dynapos/db'; import * as format from './backend/src/lib/backup-format'; console.log('Total models:', Prisma.dmmf.datamodel.models.length, 'Backup models:', format.backupModels.length);"
     ```
     Output: `Total models: 68 Backup models: 67`.
   - Every tenant model consistently declares `businessId String` and composite uniqueness `@@unique([businessId, id])`.
   - Model definitions in `schema.prisma` avoid native PostgreSQL/Prisma enum types and instead store statuses/types as `String` with descriptive code comments (e.g. `status String @default("VACANT_CLEAN") // VACANT_CLEAN, VACANT_DIRTY, ...`). This is required by `backend/src/lib/backup-format.ts` which expects `field.type === "String"`.

2. **Disaster Recovery Dynamic Topological Sort & DAG Invariants**:
   - `backend/src/lib/backup-format.ts` lines 12–19 implements dynamic dependency resolution:
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
   - In `RestaurantTable` (line 1159), `currentSessionId String?` is maintained as a scalar field without an `@relation` attribute:
     ```prisma
     currentSessionId String? // Scalar logical ID without @relation to preserve DAG acyclicity
     ```
   - Introducing an `@relation` from `Room.currentStayId` to `Stay.id` creates a two-way cycle (`Room -> Stay` and `Stay -> Room`), because `Stay` has `roomId String` with `@relation(fields: [roomId], references: [id])`. In topological sorting, `pending.findIndex(...)` finds no resolvable model and throws `Error: Backup schema has unsupported dependency cycle`.

3. **Existing Reverse Relation Anchor Points**:
   - `Business` (lines 13–82): Contains child collections for all tenant models.
   - `Branch` (lines 100–142): Contains child collections for all branch-scoped models.
   - `User` (lines 144–191): Contains named relation arrays for user audit fields (e.g. `openedTableSessions`, `createdRestaurantOrders`).
   - `Floor` (lines 1128–1146): Currently contains `tables RestaurantTable[]`. Does not yet contain `rooms Room[]`.

4. **Engine Copying & Client Generation Assets**:
   - `packages/db/prisma/schema.prisma` lines 7–11:
     ```prisma
     generator client {
       provider      = "prisma-client-js"
       output        = "../client"
       binaryTargets = ["native", "rhel-openssl-3.0.x"]
     }
     ```
   - `packages/db/client/` contains:
     - `query_engine-windows.dll.node` (21,182,976 bytes)
     - `libquery_engine-rhel-openssl-3.0.x.so.node` (17,547,808 bytes)
   - `frontend/next.config.ts` lines 13–15:
     ```ts
     outputFileTracingIncludes: {
       "**/*": ["client/libquery_engine-*.node"],
     },
     ```
   - Next.js standalone tracing in `frontend` expects `client/libquery_engine-*.node` to be available under `frontend/client/`.
   - `scripts/copy-prisma-engines.mjs` was referenced in prior plans and prompts but is currently absent from `scripts/`. A dedicated script must be created so that `node scripts/copy-prisma-engines.mjs` copies the query engine binaries from `packages/db/client/` to `frontend/client/`.

5. **Existing Migrations & Target Migration Checksum Match**:
   - `packages/db/prisma/migrations/` contains:
     - `202610300001_retail_baseline`
     - `202610300002_commerce_hardening`
     - `202610310001_phase1_security_foundation`
     - `202610310002_phase2_financial_inventory_core`
     - `202611010001_phase3_restaurant_staff_mvp`
     - `202611010002_phase4_kitchen_recipes_kds`
   - Next sequential migration: `202611010003_phase5_hotel_stays_rooms`.
   - `rehearse-recovery.ts` validates that migration history and checksums between `restro_test` (port 55439) and `restro_restore` (port 55440) match identically via `check("rehearsed target migration history matches source", targetMigrations === sourceMigrations)`.

6. **Recovery Test Hardcoded Count Defect**:
   - `tests/recovery.integration.test.ts` line 88 contains:
     ```ts
     expect(Object.keys(original.tables)).toHaveLength(60);
     ```
   - This hardcoded assertion fails because Phase 4 expanded tenant models to 67, and Phase 5 will expand them to 75. It must be dynamically asserted against `format.backupModels.length`.

---

## 2. Logic Chain

1. **Model Hierarchy and DAG Order**:
   - Model dependencies follow a clean DAG:
     - `RoomType` depends on `Business` and `Branch`. Both exist.
     - `Room` depends on `Business`, `Branch`, `RoomType`, and `Floor` (nullable). All exist.
     - `Reservation` depends on `Business`, `Branch`, `RoomType`, `Room` (nullable), `User` (nullable). All exist.
     - `ReservationGuest` depends on `Business` and `Reservation`. Both exist.
     - `Stay` depends on `Business`, `Branch`, `Room`, `Reservation` (nullable), `User` (nullable). All exist.
     - `MaintenanceTicket` depends on `Business`, `Branch`, `Room`, `User` (nullable). All exist.
     - `HousekeepingTask` depends on `Business`, `Branch`, `Room`, `Stay` (nullable), `User` (nullable). All exist.
     - `RoomAllocation` depends on `Business`, `Branch`, `Room`, `Reservation` (nullable), `Stay` (nullable), `MaintenanceTicket` (nullable). All exist.
   - Because `Room.currentStayId` is a scalar `String?` without an `@relation` attribute, there is no edge from `Room` to `Stay`. The DAG is acyclic.
   - In reverse order (for deletion in `rehearse-recovery.ts`), allocations and housekeeping tasks are deleted before stays, stays before reservations, reservations before rooms, rooms before room types, preserving foreign key integrity throughout disaster recovery.

2. **Exclusion Constraint Storage Mechanics**:
   - Double-booking prevention requires half-open timestamp range exclusion on overlapping intervals: `tsrange("startDate", "endDate", '[)')`.
   - The PostgreSQL extension `btree_gist` enables scalar equality operators (`=`) on `UUID`/`TEXT` (`roomId`) within GiST indices.
   - The constraint must filter on active blocking intervals: `WHERE ("isBlocking" = true)`.
   - Non-blocking allocations (e.g. cancelled bookings, soft inquiry holds) will not trigger exclusion violations.
   - Adjacent intervals (`[2026-11-01T14:00, 2026-11-05T11:00)` and `[2026-11-05T11:00, 2026-11-08T11:00)`) have disjoint bounds (`[a, b) && [b, c) = false`), allowing back-to-back same-day room turnover.
   - Prisma schema generator cannot express PostgreSQL `EXCLUDE USING gist`, so this statement must be placed in `migration.sql`.

3. **Dual-Cluster Migration and DR Rehearsal**:
   - `node scripts/restro-env.mjs migrate` deploys to port 55439 (`restro_test`).
   - `node scripts/restro-restore-env.mjs migrate` deploys to port 55440 (`restro_restore`).
   - In `scripts/rehearse-recovery.ts`, synthetic rows for `RoomAllocation` must provide `startDate < endDate`, and `Reservation` must provide `checkInDate < checkOutDate`. If generic synthetic generators assign identical timestamps (`startDate === endDate`), PostgreSQL creates `empty` ranges or interval checks fail. Explicit overrides for `RoomType`, `Room`, `Reservation`, `Stay`, `RoomAllocation`, and `MaintenanceTicket` in `rehearse-recovery.ts` are mandatory.

---

## 3. Caveats

1. **No Native Prisma Enums**:
   - As observed in all 67 prior models, `schema.prisma` must continue using `String` with descriptive comments for enum values (`status String @default("VACANT_CLEAN")`). Introducing native Prisma `enum` constructs breaks `backup-format.ts`'s reflection validation (`field.type === "String"`) and requires schema rewrite across the repo.
2. **Folios and Billing Scope**:
   - `GuestFolio`, `FolioEntry`, and `RoomNightCharge` belong to **Phase 6** (`PHASE_6_FOLIO_SETTLEMENT.md`). They must not be introduced in Phase 5 schema to prevent scope creep.
3. **Database Migration Lock**:
   - `packages/db/prisma/migrations/migration_lock.toml` tracks the provider (`postgresql`). Do not delete or recreate it.

---

## 4. Conclusion & Complete Implementation Plan

### A. Exact Definitions for the 8 New Models

Add the following 8 models to `packages/db/prisma/schema.prisma`:

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

### B. Required Reverse Relations on Existing Models

1. **`model Business`**:
   Append after line 81:
   ```prisma
     roomTypes              RoomType[]
     rooms                  Room[]
     reservations           Reservation[]
     reservationGuests      ReservationGuest[]
     stays                  Stay[]
     roomAllocations        RoomAllocation[]
     housekeepingTasks      HousekeepingTask[]
     maintenanceTickets     MaintenanceTicket[]
   ```

2. **`model Branch`**:
   Append after line 139:
   ```prisma
     roomTypes              RoomType[]
     rooms                  Room[]
     reservations           Reservation[]
     stays                  Stay[]
     roomAllocations        RoomAllocation[]
     housekeepingTasks      HousekeepingTask[]
     maintenanceTickets     MaintenanceTicket[]
   ```

3. **`model User`**:
   Append after line 188:
   ```prisma
     createdReservations         Reservation[]       @relation("ReservationCreatedBy")
     checkedInStays              Stay[]              @relation("StayCheckedInBy")
     checkedOutStays             Stay[]              @relation("StayCheckedOutBy")
     assignedHousekeepingTasks   HousekeepingTask[]  @relation("HousekeepingAssignedTo")
     completedHousekeepingTasks  HousekeepingTask[]  @relation("HousekeepingCompletedBy")
     reportedMaintenanceTickets MaintenanceTicket[] @relation("MaintenanceReportedBy")
     assignedMaintenanceTickets MaintenanceTicket[] @relation("MaintenanceAssignedTo")
   ```

4. **`model Floor`**:
   Append after line 1141:
   ```prisma
     rooms Room[]
   ```

### C. Engine Copy Script (`scripts/copy-prisma-engines.mjs`)

Create `scripts/copy-prisma-engines.mjs`:
```js
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(__dirname, "../packages/db/client");
const destDir = path.resolve(__dirname, "../frontend/client");

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

const files = fs.readdirSync(srcDir).filter(f => f.includes("query_engine") && f.endsWith(".node"));
for (const file of files) {
  fs.copyFileSync(path.join(srcDir, file), path.join(destDir, file));
  console.log(`Copied engine ${file} -> frontend/client/${file}`);
}
```

### D. Migration SQL (`202611010003_phase5_hotel_stays_rooms/migration.sql`)

Create directory `packages/db/prisma/migrations/202611010003_phase5_hotel_stays_rooms/` and write `migration.sql` containing:
- Table creation statements for `RoomType`, `Room`, `Reservation`, `ReservationGuest`, `Stay`, `RoomAllocation`, `HousekeepingTask`, `MaintenanceTicket`.
- Primary keys, unique indexes, standard composite indexes, and foreign keys.
- **GiST exclusion constraint block**:
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

### E. Disaster Recovery Synchronization

1. **`scripts/rehearse-recovery.ts`**:
   Add model overrides into `seedTenant`:
   ```ts
   if (entityName === "RoomType") Object.assign(data, { code: `RT-${tag.slice(-6)}` });
   if (entityName === "Room") Object.assign(data, { roomNumber: `R-${tag.slice(-6)}` });
   if (entityName === "Reservation") Object.assign(data, {
     reservationNumber: `RES-${tag.slice(-6)}`,
     checkInDate: new Date("2025-01-02T14:00:00.000Z"),
     checkOutDate: new Date("2025-01-05T11:00:00.000Z"),
     totalAmount: 300,
   });
   if (entityName === "Stay") Object.assign(data, {
     stayNumber: `STY-${tag.slice(-6)}`,
     checkInTime: new Date("2025-01-02T14:00:00.000Z"),
     expectedCheckOut: new Date("2025-01-05T11:00:00.000Z"),
     ratePerNight: 100,
     totalAmount: 300,
   });
   if (entityName === "RoomAllocation") Object.assign(data, {
     startDate: new Date("2025-01-02T14:00:00.000Z"),
     endDate: new Date("2025-01-05T11:00:00.000Z"),
     isBlocking: true,
   });
   if (entityName === "MaintenanceTicket") Object.assign(data, {
     ticketNumber: `MT-${tag.slice(-6)}`,
     startDate: new Date("2025-01-10T10:00:00.000Z"),
     endDate: new Date("2025-01-12T18:00:00.000Z"),
   });
   ```
2. **`tests/recovery.integration.test.ts`**:
   Update line 88 from `toHaveLength(60)` to `toHaveLength(format.backupModels.length)`.

---

## 5. Verification Method

Once implemented by the builder, execute the following verification steps in sequence:

1. **Client Generation & Typecheck**:
   ```bash
   npx prisma generate --schema packages/db/prisma/schema.prisma
   node scripts/copy-prisma-engines.mjs
   npm run typecheck
   ```
   *Expected outcome*: Client generated to `packages/db/client`, engine `.node` files copied to `frontend/client/`, and monorepo typecheck completes with 0 errors.

2. **Dual-Cluster Additive Migrations**:
   ```bash
   node scripts/restro-env.mjs migrate
   node scripts/restro-restore-env.mjs migrate
   ```
   *Expected outcome*: `202611010003_phase5_hotel_stays_rooms` applies cleanly to both cluster 55439 and cluster 55440.

3. **PostgreSQL GiST Exclusion Verification**:
   Execute SQL test against port 55439:
   - Insert booking for Room 101 on `[2026-11-01 14:00:00, 2026-11-05 11:00:00)`.
   - Attempt overlapping booking for Room 101 on `[2026-11-03 14:00:00, 2026-11-06 11:00:00)`.
   *Expected outcome*: Overlapping attempt fails at database engine level with PostgreSQL error code `23P01` (`exclusion_violation`).

4. **Disaster Recovery Rehearsal**:
   ```bash
   node scripts/restro-restore-env.mjs rehearse
   ```
   *Expected outcome*: 41/41 checks pass across all 75 backup models in ~12 seconds with clean topological sort and zero residue.

5. **Recovery Test Suite**:
   ```bash
   node scripts/restro-env.mjs recovery-test
   ```
   *Expected outcome*: Recovery integration tests pass with 0 failures across all 75 models.
