# Milestone 1: Disaster Recovery Acyclic DAG & Test Verification Report

**Agent**: `p5_m1_explorer_3`  
**Working Directory**: `c:\projects\pos\.agents\teamwork\p5_m1_explorer_3\`  
**Date**: 2026-11-01  
**Status**: Completed (Hard Handoff)

---

## Executive Summary

This report establishes the disaster recovery (DR) architecture, acyclic DAG verification, synthetic tenant fixture generation, and test suite remediation for **RestroInn Phase 5 (Hotel Inventory, Rooms & Guest Stays)**.

Key findings and strategic determinations:
1. **Topological Sorter Invariant**: `backend/src/lib/backup-format.ts` dynamically calculates the model dependency graph at runtime using Kahn's algorithm (`pending.findIndex(...)`). To guarantee that adding the 8 new hotel models does not trigger `Error: Backup schema has unsupported dependency cycle`, `Room.currentStayId` **must remain a scalar `String?` field without an `@relation` attribute**. Any foreign key relation from `Room` to `Stay` would induce a bidirectional cycle (`Room <-> Stay`), crashing the disaster recovery subsystem.
2. **Interval Models Synthetic Date Defect**: In `scripts/rehearse-recovery.ts` (lines 78–82) and `tests/recovery.integration.test.ts` (lines 51–55), fallback date generation assigns identical timestamps (`new Date("2025-01-02T03:04:05.000Z")`) to all `DateTime` fields without defaults. For interval models (`RoomAllocation`, `Reservation`, `Stay`, `MaintenanceTicket`), this causes zero-duration intervals (`startDate === endDate`), inverted stay dates (`checkInTime > expectedCheckOut` due to `@default(now())`), and potential collision under PostgreSQL GiST exclusion rules. Explicit entity overrides must be applied.
3. **Hardcoded Assertion Defect**: In `tests/recovery.integration.test.ts` line 88, `expect(Object.keys(original.tables)).toHaveLength(60)` is a legacy constant from Phase 1. It currently fails on the 67 existing models and will fail on Phase 5's 75 models (74 backup models). It must be updated to `expect(Object.keys(original.tables)).toHaveLength(format.backupModels.length)`.
4. **Environment Isolation Protocol**: Executing `npx vitest run tests/recovery.integration.test.ts` directly skips all 8 tests because `TEST_DATABASE_URL` is undefined. The canonical execution harness is `node scripts/restro-env.mjs recovery-test`, which loads `.env.restro.local`, asserts database isolation on port 55439, and validates that all 8 cases pass with zero skips.

---

## 1. Observation

### 1.1 Disaster Recovery Topological Sorter (`backend/src/lib/backup-format.ts`)
Lines 11–20 of `backend/src/lib/backup-format.ts`:
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
- The algorithm processes models by checking whether all foreign key parents (`field.relationFromFields?.length > 0`) have already been resolved and pushed into `backupModels`.
- Reverse deletion during recovery rehearsal (`[...format.backupModels].reverse()`) deletes child records before parent records, avoiding foreign key cascade errors.
- Schema hash is computed deterministically from `backupModels`.
- In `validateSnapshot` (lines 81–86):
  ```ts
  for (const model of backupModels) for (const row of snapshot.tables[model.name]) {
    for (const field of model.fields.filter(field => field.relationFromFields?.length)) {
      if (field.relationFromFields!.length !== 1 || field.relationToFields?.[0] !== "id") throw new BackupError("Unsupported composite backup relation");
      const value = row[field.relationFromFields![0]];
      if (value !== null && !ids.get(field.type)?.has(value as string)) throw new BackupError(`Foreign or missing ${model.name} reference`);
    }
  ```
  Every foreign key relation must reference `"id"` on the parent model.

### 1.2 Synthetic Tenant Generator in `scripts/rehearse-recovery.ts`
Lines 72–96 of `scripts/rehearse-recovery.ts`:
```ts
      for (const field of entity.fields.filter(field => field.kind !== "object" && field.name !== "id")) {
        const relation = entity.fields.find(parent => parent.relationFromFields?.includes(field.name));
        if (relation) data[field.name] = ids[relation.type];
        else if (field.name === "businessId") data[field.name] = businessId;
        else if (field.name === "productId") data[field.name] = ids.Product;
        else if (field.name === "branchId") data[field.name] = ids.Branch;
        else if (field.type === "Json") data[field.name] = field.isRequired ? { response: "synthetic", label, financialTotal: 125.25 } : Prisma.DbNull;
        else if (field.name === "deletedAt" && ["Customer", "Product"].includes(entityName)) data[field.name] = new Date("2025-01-02T03:04:05.000Z");
        else if (!field.isRequired || field.hasDefaultValue) continue;
        else data[field.name] = field.type === "DateTime" ? new Date("2025-01-02T03:04:05.000Z") : (field.type === "Float" || field.type === "Decimal") ? 125.25 : field.type === "Int" ? 3 : field.type === "Boolean" ? true : `${entityName}-${field.name}-${tag}`;
      }
```
- For `RoomAllocation`: `startDate` and `endDate` are both required with no default, so both evaluate to `new Date("2025-01-02T03:04:05.000Z")`, resulting in `startDate === endDate`.
- For `Reservation`: `checkInDate` and `checkOutDate` both evaluate to `new Date("2025-01-02T03:04:05.000Z")`.
- For `Stay`: `checkInTime` has `@default(now())`, which is skipped by line 80 and receives `now()` at database insertion, whereas `expectedCheckOut` has no default and receives `2025-01-02T03:04:05.000Z`. This results in `checkInTime > expectedCheckOut`.
- For `RoomAllocation`: line 74 assigns `data.maintenanceTicketId = ids.MaintenanceTicket` along with `reservationId` and `stayId`, causing a stay allocation to also link to a maintenance ticket.

### 1.3 Recovery Test Failure (`tests/recovery.integration.test.ts`)
Direct command execution:
```
node scripts/restro-env.mjs recovery-test
```
Verbatim failure output:
```
 FAIL  tests/recovery.integration.test.ts > PostgreSQL tenant recovery > R1 captures all 60 tenant models and authenticates encrypted archives without claiming rehearsal
AssertionError: expected [ 'Business', 'Subscription', …(65) ] to have a length of 60 but got 67

- Expected
+ Received

- 60
+ 67

 ❯ tests/recovery.integration.test.ts:88:42
     86|
     87|   it("R1 captures all 60 tenant models and authenticates encrypted arc…
     88|     expect(Object.keys(original.tables)).toHaveLength(60);
       |                                          ^
```
- Tests R2 through R8 all passed (7 passed, 1 failed).
- Directly executing `npx vitest run tests/recovery.integration.test.ts` yielded:
  ```
  ↓ tests/recovery.integration.test.ts (8 tests | 8 skipped)
  Test Files  1 skipped (1)
  ```
  because `process.env.TEST_DATABASE_URL` is undefined when vitest is invoked outside the launcher script.

### 1.4 Baseline Rehearsal Verification (`scripts/restro-restore-env.mjs rehearse`)
Direct command execution:
```
node scripts/restro-restore-env.mjs rehearse
```
Verbatim result:
```
PASS  source and target are different PostgreSQL clusters, databases and roles — source restro_test / target restro_restore
PASS  target migration history equals source (names and checksums) — 202610300001_retail_baseline, 202610300002_commerce_hardening, 202610310001_phase1_security_foundation, 202610310002_phase2_financial_inventory_core, 202611010001_phase3_restaurant_staff_mvp, 202611010002_phase4_kitchen_recipes_kds
...
PASS  entity counts equal for all 67 models — 96 rows
PASS  every restored row equals its source row (IDs, timestamps, values, SQL-vs-JSON nulls) — 67/67 models identical
Rehearsal: 41/41 checks passed; timings ms {"seedSource":526,"seedTargetUnrelatedTenant":410,"capture":312,"backupWrite":266,"loadAndValidateArchive":9,"restoreTransaction":357,"postRestoreCapture":352,"totalRehearsal":12036}
```
- Disaster recovery backup, encryption, negative testing, restore into clean target on port 55440, and clean fixture removal operate cleanly.

### 1.5 TypeScript Typecheck
Direct command execution:
```
npm run typecheck
```
Exited with code 0 (no errors).

---

## 2. Logic Chain

### 2.1 Model Hierarchy & Directed Acyclic Graph (DAG) Structure
1. From Observation 1.1, `backupModels` topological sort succeeds if and only if for every model `M`, all models referenced by `M.fields` with `relationFromFields` are resolved prior to `M`.
2. The 8 Phase 5 models have the following foreign key dependencies:
   - `RoomType`: references `Business`, `Branch`. (0 hotel dependencies).
   - `Room`: references `Business`, `Branch`, `RoomType`, `Floor`. (1 hotel dependency: `RoomType`).
   - `Reservation`: references `Business`, `Branch`, `RoomType`, `Room` (optional), `User` (optional). (2 hotel dependencies: `RoomType`, `Room`).
   - `ReservationGuest`: references `Business`, `Reservation`. (1 hotel dependency: `Reservation`).
   - `Stay`: references `Business`, `Branch`, `Room`, `Reservation` (optional), `User` (optional). (2 hotel dependencies: `Room`, `Reservation`).
   - `MaintenanceTicket`: references `Business`, `Branch`, `Room`, `User` (optional). (1 hotel dependency: `Room`).
   - `RoomAllocation`: references `Business`, `Branch`, `Room`, `Reservation` (optional), `Stay` (optional), `MaintenanceTicket` (optional). (4 hotel dependencies: `Room`, `Reservation`, `Stay`, `MaintenanceTicket`).
   - `HousekeepingTask`: references `Business`, `Branch`, `Room`, `Stay` (optional), `User` (optional). (2 hotel dependencies: `Room`, `Stay`).
3. Notice that:
   - `Room` does NOT have a foreign key to `Stay`. `Room.currentStayId` is a scalar string:
     ```prisma
     currentStayId String? // Scalar logical ID without @relation to preserve DAG acyclicity
     ```
   - If `Room.currentStayId` were defined as an `@relation` pointing to `Stay`, `Room` would depend on `Stay`, while `Stay` has `roomId` depending on `Room`. This would create a 2-node cycle: `Room -> Stay -> Room`.
   - In that case, `pending.findIndex(...)` would fail to find any candidate whose parents are all in `backupModels`, throwing `Error: Backup schema has unsupported dependency cycle`.
   - By retaining `Room.currentStayId` as a scalar `String?`, `Room` resolves at Layer 2, `Stay` resolves at Layer 4, and no cycle exists.
4. Topological Layering:
   - **Layer 0**: `Business`, `Branch`, `Floor`, `User` (pre-existing)
   - **Layer 1**: `RoomType`
   - **Layer 2**: `Room`
   - **Layer 3**: `Reservation`
   - **Layer 4**: `ReservationGuest`, `Stay`, `MaintenanceTicket`
   - **Layer 5**: `RoomAllocation`, `HousekeepingTask`
5. Therefore, `topologicalSort` handles the new models cleanly without any code modification to `backend/src/lib/backup-format.ts`.

### 2.2 Synthetic Fixture Date Handling in Disaster Recovery
1. From Observation 1.2, generic row generation in `rehearse-recovery.ts` and `recovery.integration.test.ts` defaults `DateTime` values without defaults to `2025-01-02T03:04:05.000Z`.
2. When applied to `RoomAllocation`, both `startDate` and `endDate` become `2025-01-02T03:04:05.000Z`.
3. In PostgreSQL, `tsrange("startDate", "endDate", '[)')` with identical endpoints creates an empty range `empty`. Furthermore, a stay allocation with zero duration violates the domain business invariant that check-out occurs after check-in.
4. In `Stay`, `checkInTime` has `@default(now())`, while `expectedCheckOut` gets `2025-01-02T03:04:05.000Z`. This results in `checkInTime > expectedCheckOut`.
5. In `Reservation`, `checkInDate === checkOutDate`.
6. To ensure realistic, valid synthetic tenant snapshots that conform to domain intervals and the PostgreSQL GiST exclusion constraint (`tsrange("startDate", "endDate", '[)')`), explicit overrides must be introduced:
   - `Reservation`: check-in `2025-01-02T14:00:00.000Z`, check-out `2025-01-05T11:00:00.000Z`.
   - `Stay`: check-in `2025-01-02T14:00:00.000Z`, expected check-out `2025-01-05T11:00:00.000Z`.
   - `RoomAllocation`: start `2025-01-02T14:00:00.000Z`, end `2025-01-05T11:00:00.000Z`, `maintenanceTicketId: null`.
   - `MaintenanceTicket`: start `2025-01-10T10:00:00.000Z`, end `2025-01-12T18:00:00.000Z` (non-overlapping future window on the same synthetic room).

### 2.3 Hardcoded Model Assertion in `tests/recovery.integration.test.ts`
1. From Observation 1.3, test R1 fails on line 88 with `AssertionError: expected [ ... ] to have a length of 60 but got 67`.
2. The assertion `expect(Object.keys(original.tables)).toHaveLength(60)` was written when the platform had 60 models. In Phase 4, the platform grew to 67 models (66 backup models + 1 excluded model). With Phase 5, 8 new models will be introduced, bringing total models to 75 (74 backup models + 1 excluded model).
3. The assertion must compare against `format.backupModels.length`. Because `format.backupModels` is dynamically computed by `topologicalSort`, the assertion dynamically tracks the exact number of tenant models across all milestones.

---

## 3. Caveats

1. **Prisma Client Generation Dependency**:
   - `backend/src/lib/backup-format.ts` reads `Prisma.dmmf.datamodel.models`.
   - `backupModels` will not reflect the 8 new Phase 5 models until `npx prisma generate --schema packages/db/prisma/schema.prisma` is executed and engines are copied via `node scripts/copy-prisma-engines.mjs`.
2. **Dual-Cluster Migration Requirement for Rehearsal**:
   - `scripts/rehearse-recovery.ts` checks:
     `targetMigrationHistory equals source (names and checksums)`
   - Therefore, `node scripts/restro-restore-env.mjs rehearse` will fail if the migration is applied to port 55439 (`restro_test`) but not yet deployed to port 55440 (`restro_restore`).
3. **GiST Exclusion Constraint Presence**:
   - The GiST exclusion constraint (`RoomAllocation_room_period_overlap_excl`) is created via raw DDL in `migration.sql`. It is not expressed in `schema.prisma`.
   - Rehearsal inserts 1 synthetic `RoomAllocation` per tenant. With `startDate < endDate`, this row complies with the GiST constraint without conflict.

---

## 4. Conclusion & Concrete Implementation Strategy

### 4.1 Changes to `backend/src/lib/backup-format.ts`
**Assessment**: **ZERO CODE CHANGES REQUIRED**.
- The existing dynamic Kahn topological sorter (lines 12–19) and snapshot validator (lines 81–89) automatically handle any acyclic schema where foreign keys are single-field references to `id`.
- The strict structural requirement is that `Room.currentStayId` must be defined in `packages/db/prisma/schema.prisma` without `@relation`:
  ```prisma
  model Room {
    ...
    currentStayId String? // Scalar logical ID without @relation to preserve DAG acyclicity
    ...
  }
  ```

### 4.2 Exact Code Patch for `scripts/rehearse-recovery.ts`

In `scripts/rehearse-recovery.ts`, add the hotel entity overrides into `row()` between line 95 and line 96:

```diff
--- a/scripts/rehearse-recovery.ts
+++ b/scripts/rehearse-recovery.ts
@@ -95,6 +95,25 @@
       if (entityName === "StockMovement") Object.assign(data, { quantity: 7.5, sourceType: "SALE", sourceId: ids.Sale, unit: "pcs" });
       if (entityName === "OutboxEvent") Object.assign(data, { aggregateType: "Sale", aggregateId: ids.Sale, eventType: "SALE_COMPLETED", payload: { response: "synthetic", label, financialTotal: 125.25 }, status: "PENDING" });
+      if (entityName === "Reservation") Object.assign(data, {
+        checkInDate: new Date("2025-01-02T14:00:00.000Z"),
+        checkOutDate: new Date("2025-01-05T11:00:00.000Z"),
+        totalAmount: 300,
+        depositAmount: 100,
+      });
+      if (entityName === "Stay") Object.assign(data, {
+        checkInTime: new Date("2025-01-02T14:00:00.000Z"),
+        expectedCheckOut: new Date("2025-01-05T11:00:00.000Z"),
+        ratePerNight: 100,
+        totalAmount: 300,
+        paidAmount: 100,
+      });
+      if (entityName === "RoomAllocation") Object.assign(data, {
+        startDate: new Date("2025-01-02T14:00:00.000Z"),
+        endDate: new Date("2025-01-05T11:00:00.000Z"),
+        maintenanceTicketId: null,
+      });
+      if (entityName === "MaintenanceTicket") Object.assign(data, {
+        startDate: new Date("2025-01-10T10:00:00.000Z"),
+        endDate: new Date("2025-01-12T18:00:00.000Z"),
+      });
       return { ...data, ...overrides };
     }
```

### 4.3 Exact Code Patch for `tests/recovery.integration.test.ts`

In `tests/recovery.integration.test.ts`:
1. Add hotel entity overrides into `beforeAll` row builder (lines 68–69).
2. Fix line 88 hardcoded count assertion and test description.

```diff
--- a/tests/recovery.integration.test.ts
+++ b/tests/recovery.integration.test.ts
@@ -68,6 +68,25 @@
         if (entity.name === "StockMovement") Object.assign(row, { quantity: 7.5, sourceType: "SALE", sourceId: ids.Sale, unit: "pcs" });
         if (entity.name === "OutboxEvent") Object.assign(row, { aggregateType: "Sale", aggregateId: ids.Sale, eventType: "SALE_COMPLETED", payload: { response: "synthetic", financialTotal: 125.25 }, status: "PENDING" });
+        if (entity.name === "Reservation") Object.assign(row, {
+          checkInDate: new Date("2025-01-02T14:00:00.000Z"),
+          checkOutDate: new Date("2025-01-05T11:00:00.000Z"),
+          totalAmount: 300,
+          depositAmount: 100,
+        });
+        if (entity.name === "Stay") Object.assign(row, {
+          checkInTime: new Date("2025-01-02T14:00:00.000Z"),
+          expectedCheckOut: new Date("2025-01-05T11:00:00.000Z"),
+          ratePerNight: 100,
+          totalAmount: 300,
+          paidAmount: 100,
+        });
+        if (entity.name === "RoomAllocation") Object.assign(row, {
+          startDate: new Date("2025-01-02T14:00:00.000Z"),
+          endDate: new Date("2025-01-05T11:00:00.000Z"),
+          maintenanceTicketId: null,
+        });
+        if (entity.name === "MaintenanceTicket") Object.assign(row, {
+          startDate: new Date("2025-01-10T10:00:00.000Z"),
+          endDate: new Date("2025-01-12T18:00:00.000Z"),
+        });
         await model(tx, entity.name).createMany({ data: [row] });
       }
     });
@@ -85,7 +104,7 @@
     await fs.rmdir(directory).catch(() => undefined);
   });
 
-  it("R1 captures all 60 tenant models and authenticates encrypted archives without claiming rehearsal", async () => {
-    expect(Object.keys(original.tables)).toHaveLength(60);
+  it("R1 captures all tenant models and authenticates encrypted archives without claiming rehearsal", async () => {
+    expect(Object.keys(original.tables)).toHaveLength(format.backupModels.length);
     for (const rows of Object.values(original.tables)) expect(rows).toHaveLength(1);
     const bytes = await fs.readFile(path.join(directory, filename));
```

### 4.4 Recommended New Test File: `tests/challenger-p5-m1-schema-acyclicity.test.ts`

To guarantee adversarial defense for Phase 5 (modeled on the proven `tests/challenger-p3-m1-schema-acyclicity.test.ts`), implement `tests/challenger-p5-m1-schema-acyclicity.test.ts` covering:
1. **Dynamic Model Resolution**:
   - `backupModels` contains all 8 Phase 5 models (`RoomType`, `Room`, `Reservation`, `ReservationGuest`, `Stay`, `RoomAllocation`, `HousekeepingTask`, `MaintenanceTicket`).
2. **Strict Topological Progression**:
   - `RoomType` precedes `Room`.
   - `Room` precedes `Reservation`.
   - `Reservation` precedes `ReservationGuest`.
   - `Room` and `Reservation` precede `Stay`.
   - `Room` precedes `MaintenanceTicket`.
   - `Room`, `Reservation`, `Stay`, `MaintenanceTicket` precede `RoomAllocation`.
   - `Room` and `Stay` precede `HousekeepingTask`.
3. **Room vs Stay Acyclicity Invariant**:
   - Verifies that `Room.currentStayId` is a scalar `String?` without an `@relation` attribute.
   - Verifies that `Stay.roomId` has a foreign key to `Room.id`.
4. **Adversarial Oracle**:
   - Injects `@relation` on `Room.currentStayId` pointing to `Stay` -> asserts `topologicalSort` throws `Error: Backup schema has unsupported dependency cycle`.
   - Injects relation on `Stay` pointing to `RoomAllocation` -> asserts `topologicalSort` throws cycle error.
5. **Live PostgreSQL Engine Foreign Key Verification**:
   - Queries `information_schema.table_constraints` on live DB to confirm no foreign key exists on `Room.currentStayId` and valid foreign key exists on `Stay.roomId`.

---

## 5. Verification Method

Once implemented by the builder agent, independently verify using the following commands:

### Step 1: Regenerate Client & Copy Engines
```bash
npx prisma generate --schema packages/db/prisma/schema.prisma
node scripts/copy-prisma-engines.mjs
```
*Expected Result*: Prisma Client updated with all 75 models (74 backup models).

### Step 2: Apply Dual-Cluster Migrations
```bash
node scripts/restro-env.mjs migrate
node scripts/restro-restore-env.mjs migrate
```
*Expected Result*: Migration `202611010003_phase5_hotel_stays_rooms` deployed to both clusters (55439 and 55440) with matching checksums.

### Step 3: Run Disaster Recovery Rehearsal
```bash
node scripts/restro-restore-env.mjs rehearse
```
*Expected Result*: All 41/41 checks pass cleanly across all 74 backup models in ~12 seconds with zero residue.

### Step 4: Run Recovery Integration Test Suite
```bash
node scripts/restro-env.mjs recovery-test
```
*Expected Result*: `8 passed, zero skipped` with exit code 0.

### Step 5: Run Phase 5 Challenger Acyclicity Test
```bash
node scripts/restro-env.mjs test tests/challenger-p5-m1-schema-acyclicity.test.ts
```
*Expected Result*: All tests pass, validating DAG ordering and catching adversarial cycle injections.

### Step 6: Monorepo Typecheck
```bash
npm run typecheck
```
*Expected Result*: Backend and frontend TypeScript checks pass with 0 errors.
