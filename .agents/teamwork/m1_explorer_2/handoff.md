# Milestone 1: Backup Format & Recovery Test Impact Analysis Report

**Author**: M1 Explorer 2 (Backup Format & Recovery Specialist)  
**Working Directory**: `c:\projects\pos\.agents\teamwork\m1_explorer_2`  
**Milestone**: Phase 2 — Milestone 1 (Core Schema & Decimal Migration)  
**Date**: 2026-10-31  

---

## Executive Summary
This report analyzes the architectural and operational impact of Milestone 1 (Phase 2: Financial & Inventory Core Hardening) on the tenant backup engine (`backend/src/lib/backup-format.ts`, `backend/src/lib/backup-service.ts`), the recovery verification suite (`tests/recovery.integration.test.ts`), and the synthetic rehearsal harness (`scripts/rehearse-recovery.ts`).

Adding the 5 new models (`PaymentAllocation`, `PaymentReversal`, `Refund`, `StockMovement`, `OutboxEvent`) and migrating 57 monetary fields to `@db.Decimal(12, 2)` directly impacts:
1. Dynamic topological model sorting and `schemaHash` calculation.
2. The snapshot validation rule in `validateSnapshot()`, which previously omitted scalar type `"Decimal"`.
3. Recovery integration test assertion of model count (43 -> 48 models).
4. Fixture generation in test and rehearsal scripts, where Decimal fields previously defaulted to UUID string fallbacks causing PostgreSQL `invalid input syntax for type numeric` errors.
5. Vitest strict equality assertions on Decimal fields (`toBe(125.25)` vs `Decimal` instance).

Exact, drop-in edits are formulated for the Worker.

---

## 1. Observation

### 1.1 `backupModels` & `schemaHash` Computation in `backend/src/lib/backup-format.ts`
Inspection of `backend/src/lib/backup-format.ts` (lines 10–20):
```ts
// Platform onboarding is not owned by an operating tenant.
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
- **Filter**: All models from `Prisma.dmmf.datamodel.models` are inspected, excluding `BusinessRegistrationRequest` (platform onboarding).
- **Topological Sort**: Iteratively scans `pending` using `findIndex`. A model is selected if and only if every field that owns foreign keys (`relationFromFields?.length > 0`) references a parent model already placed in `backupModels`.
- **Current Baseline Order**: 43 models, starting with `Business` (index 1) and ending with `AuditEvent` (index 43).
- **`schemaHash`**: A 64-character SHA-256 hex digest of `JSON.stringify(backupModels)`. Because `backupModels` serializes the complete DMMF model metadata (field names, types, constraints, default values), **any** modification—including migrating `Float` to `Decimal` or adding models—dynamically changes `schemaHash`.

### 1.2 The Missing `Decimal` Type Check in `validateSnapshot`
Inspection of `backend/src/lib/backup-format.ts` (lines 59–68):
```ts
      for (const field of fields) {
        const value = row[field.name];
        if (value === null && (!field.isRequired || field.type === "Json")) continue;
        const valid = field.type === "String" ? typeof value === "string" : field.type === "Boolean" ? typeof value === "boolean" :
          field.type === "Float" ? typeof value === "number" && Number.isFinite(value) :
          field.type === "Int" ? typeof value === "number" && Number.isInteger(value) && value >= -2147483648 && value <= 2147483647 :
          field.type === "DateTime" ? typeof value === "string" && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value :
          field.type === "Json" ? value !== undefined : false;
        if (!valid) throw new BackupError(`Invalid ${model.name}.${field.name}`);
      }
```
- In Prisma DMMF, fields defined as `Decimal` in `schema.prisma` have `field.type === "Decimal"`.
- When Prisma reads a row and serializes via `JSON.parse(JSON.stringify(rows))` in `TenantBackupStore.capture()`, `Prisma.Decimal` instances serialize as string representations (verified: `JSON.stringify(new Prisma.Decimal("125.25")) === '"125.25"'`).
- **Defect Observation**: If `field.type === "Decimal"`, `valid` evaluates to `false` because `"Decimal"` is not in the ternary chain. `validateSnapshot` will throw `BackupError: Invalid <Model>.<field>` on the very first Decimal field encountered.

### 1.3 Recovery Test Fixture Generation & Assertions in `tests/recovery.integration.test.ts`
Inspection of `tests/recovery.integration.test.ts`:
1. **Model Count Assertion** (lines 82–84):
   ```ts
   it("R1 captures all 43 tenant models and authenticates encrypted archives without claiming rehearsal", async () => {
     expect(Object.keys(original.tables)).toHaveLength(43);
   ```
   Hardcoded to 43 models. Adding 5 models will cause immediate failure unless updated to 48.
2. **Fixture Generation Fallthrough** (lines 45–55):
   ```ts
   else row[field.name] = field.type === "DateTime" ? new Date("2025-01-02T03:04:05.000Z") : field.type === "Float" ? 125.25 : field.type === "Int" ? 3 : field.type === "Boolean" ? true : `${entity.name}-${field.name}-${businessId}`;
   ```
   Any required Decimal field without default value (e.g. `PaymentAllocation.amount`, `Refund.amount`, `StockMovement.quantity`, `Expense.amount`) falls through to `${entity.name}-${field.name}-${businessId}`. Inserting a non-numeric string into a PostgreSQL `numeric` column fails with `invalid input syntax for type numeric`.
3. **Repeatable-Read Assertion Strict Equality** (lines 179–181):
   ```ts
   expect((await db.sale.findUniqueOrThrow({ where: { id: ids.Sale } })).paidAmount).toBe(125.25);
   expect((await db.payment.findUniqueOrThrow({ where: { id: ids.Payment } })).amount).toBe(125.25);
   expect((await db.customer.findUniqueOrThrow({ where: { id: ids.Customer } })).balance).toBe(0);
   ```
   When `paidAmount`, `amount`, and `balance` become `Decimal`, Prisma returns `Prisma.Decimal` instances. Vitest `.toBe(...)` enforces strict referential identity (`Object.is(Decimal, 125.25)`), which evaluates to `false` and fails.
4. Identical fixture generation logic exists in `scripts/rehearse-recovery.ts` (line 81).

---

## 2. Logic Chain

### 2.1 Topological Resolution of the 5 New Models
1. **Foreign Key Relations Analysis**:
   - `OutboxEvent`: Foreign keys: `businessId` -> `Business`. Zero inter-model dependencies. Resolved as soon as `Business` (position 1) is registered.
   - `StockMovement`: Foreign keys: `businessId` -> `Business`, `branchId` -> `Branch`, `productId` -> `Product`, `actorId` -> `User` (`batchNumber` and `sourceId` are string scalars). Resolved once `Product` (position 9) is registered.
   - `PaymentAllocation`: Foreign keys: `businessId` -> `Business`, `paymentId` -> `Payment`, `saleId` -> `Sale`, `purchaseId` -> `Purchase`, `allocatedById` -> `User`. Resolved once `Payment` (position 33) is registered.
   - `PaymentReversal`: Foreign keys: `businessId` -> `Business`, `paymentId` -> `Payment` (`@unique`), `reversedById` -> `User`. Resolved once `Payment` (position 33) is registered.
   - `Refund`: Foreign keys: `businessId` -> `Business`, `branchId` -> `Branch`, `saleId` -> `Sale`, `paymentId` -> `Payment`, `customerId` -> `Customer`, `createdById` -> `User`. Resolved once `Payment` (position 33) is registered.
2. **Inter-Model Dependencies**:
   - None of the 5 new models reference each other via Prisma `@relation` foreign keys.
   - None of the 43 existing models have foreign keys pointing to the 5 new models (`Payment` only has inverse collection relations: `allocations PaymentAllocation[]`, `reversal PaymentReversal?`, `refunds Refund[]`).
   - Thus, there are **zero circular dependencies**.
3. **Deterministic Sorting Sequence**:
   - When the 5 models are appended at the bottom of `packages/db/prisma/schema.prisma` in order:
     1. `PaymentAllocation`
     2. `PaymentReversal`
     3. `Refund`
     4. `StockMovement`
     5. `OutboxEvent`
   - The dynamic `while (pending.length)` loop in `backup-format.ts` selects existing models 1 through 43 in their exact historical sequence, followed immediately by:
     - **44**: `PaymentAllocation`
     - **45**: `PaymentReversal`
     - **46**: `Refund`
     - **47**: `StockMovement`
     - **48**: `OutboxEvent`
4. **Foreign Key Deletion Safety**:
   - Fixture teardown (`tests/recovery.integration.test.ts` line 29 and `scripts/rehearse-recovery.ts` line 130) executes `[...format.backupModels].reverse()`.
   - Models 48 through 44 (`OutboxEvent`, `StockMovement`, `Refund`, `PaymentReversal`, `PaymentAllocation`) are deleted *before* `Payment` (33), `Sale` (31), `Purchase` (16), `Product` (9), `Branch` (3), and `Business` (1), guaranteeing zero foreign key constraint violations during cleanup.

### 2.2 Schema Hash & Migration Identity Binding
1. In `validateSnapshot()`, `snapshot.schemaHash === schemaHash` verifies that the snapshot structure matches the running application code.
2. In `appliedMigrations(tx)`:
   ```sql
   SELECT migration_name, checksum FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name
   ```
   Recovery into a missing tenant checks that the target database migration history identically matches `snapshot.migrations`. Adding migration `202610310002_phase2_financial_inventory_core` is automatically included in this query without code changes in `backup-service.ts`.

---

## 3. Caveats

1. **Docker Container Availability**: While unit tests and compiler typechecks run cleanly in memory, full PostgreSQL-bound verification (`tests/recovery.integration.test.ts`, `scripts/rehearse-recovery.ts`) requires starting the isolated test database on `127.0.0.1:55439` via `node scripts/restro-env.mjs db` and executing `prisma migrate deploy`.
2. **Read-Only Explorer Discipline**: In accordance with the Explorer archetype, no source files, test files, or scripts were modified directly during this analysis.
3. **Prisma Client Generation Dependency**: Any changes to `schema.prisma` require running `npx prisma generate` before `backend/src/lib/backup-format.ts` or test suites can see the updated DMMF metadata and Decimal types.

---

## 4. Conclusion & Complete Edit Formulations

### 4.1 Summary of Exact Changes
1. **`backend/src/lib/backup-format.ts`**: Add `Decimal` scalar type handling to `validateSnapshot()`, accepting string decimals (`/^-?\d+(\.\d+)?$/`) or finite numbers.
2. **`tests/recovery.integration.test.ts`**:
   - Update model count from 43 to 48.
   - Update generic fixture generation in line 54 to assign numeric `125.25` for `field.type === "Decimal"`.
   - Add explicit fixture overrides for `PaymentAllocation`, `PaymentReversal`, `Refund`, `StockMovement`, and `OutboxEvent`.
   - Wrap Decimal field assertions in Test R6 with `Number(...)` or `.toNumber()`.
3. **`scripts/rehearse-recovery.ts`**:
   - Update generic fixture generation in line 81 to assign numeric `125.25` for `field.type === "Decimal"`.
   - Add explicit fixture overrides for the 5 new models.

---

### 4.2 Exact Drop-In Code Edits for Worker

#### Edit 1: `backend/src/lib/backup-format.ts` (Line 62–67)

**Target Lines**: 62–67  
**Before**:
```ts
        const valid = field.type === "String" ? typeof value === "string" : field.type === "Boolean" ? typeof value === "boolean" :
          field.type === "Float" ? typeof value === "number" && Number.isFinite(value) :
          field.type === "Int" ? typeof value === "number" && Number.isInteger(value) && value >= -2147483648 && value <= 2147483647 :
          field.type === "DateTime" ? typeof value === "string" && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value :
          field.type === "Json" ? value !== undefined : false;
        if (!valid) throw new BackupError(`Invalid ${model.name}.${field.name}`);
```

**After**:
```ts
        const valid = field.type === "String" ? typeof value === "string" : field.type === "Boolean" ? typeof value === "boolean" :
          field.type === "Float" ? typeof value === "number" && Number.isFinite(value) :
          field.type === "Decimal" ? (typeof value === "string" && /^-?\d+(\.\d+)?$/.test(value)) || (typeof value === "number" && Number.isFinite(value)) :
          field.type === "Int" ? typeof value === "number" && Number.isInteger(value) && value >= -2147483648 && value <= 2147483647 :
          field.type === "DateTime" ? typeof value === "string" && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value :
          field.type === "Json" ? value !== undefined : false;
        if (!valid) throw new BackupError(`Invalid ${model.name}.${field.name}`);
```

---

#### Edit 2: `tests/recovery.integration.test.ts` (Fixture Builder, Lines 53–65)

**Target Lines**: 53–65  
**Before**:
```ts
          else if (!field.isRequired || field.hasDefaultValue) continue;
          else row[field.name] = field.type === "DateTime" ? new Date("2025-01-02T03:04:05.000Z") : field.type === "Float" ? 125.25 : field.type === "Int" ? 3 : field.type === "Boolean" ? true : `${entity.name}-${field.name}-${businessId}`;
        }
        if (entity.name === "Business") row.settings = Prisma.JsonNull;
        if (entity.name === "Sale") Object.assign(row, { total: 125.25, paidAmount: 25.25, paymentStatus: "PARTIAL" });
        if (entity.name === "Payment") Object.assign(row, { amount: 25.25, method: "CASH" });
        if (entity.name === "Customer") row.balance = 100;
        if (entity.name === "CustomerLedger") Object.assign(row, { debit: 100, balance: 100 });
        if (entity.name === "Supplier") row.balance = 75.5;
        if (entity.name === "SupplierLedger") Object.assign(row, { credit: 75.5, balance: 75.5 });
        if (["ProductStock", "Batch"].includes(entity.name)) row.quantity = 7.5;
        await model(tx, entity.name).createMany({ data: [row] });
```

**After**:
```ts
          else if (!field.isRequired || field.hasDefaultValue) continue;
          else row[field.name] = field.type === "DateTime" ? new Date("2025-01-02T03:04:05.000Z") : (field.type === "Float" || field.type === "Decimal") ? 125.25 : field.type === "Int" ? 3 : field.type === "Boolean" ? true : `${entity.name}-${field.name}-${businessId}`;
        }
        if (entity.name === "Business") row.settings = Prisma.JsonNull;
        if (entity.name === "Sale") Object.assign(row, { total: 125.25, paidAmount: 25.25, paymentStatus: "PARTIAL" });
        if (entity.name === "Payment") Object.assign(row, { amount: 25.25, method: "CASH" });
        if (entity.name === "Customer") row.balance = 100;
        if (entity.name === "CustomerLedger") Object.assign(row, { debit: 100, balance: 100 });
        if (entity.name === "Supplier") row.balance = 75.5;
        if (entity.name === "SupplierLedger") Object.assign(row, { credit: 75.5, balance: 75.5 });
        if (["ProductStock", "Batch"].includes(entity.name)) row.quantity = 7.5;
        if (entity.name === "PaymentAllocation") Object.assign(row, { amount: 25.25, saleId: ids.Sale, purchaseId: null });
        if (entity.name === "PaymentReversal") Object.assign(row, { reason: "Synthetic payment reversal" });
        if (entity.name === "Refund") Object.assign(row, { amount: 25.25, reason: "Synthetic customer return", method: "CASH", status: "COMPLETED" });
        if (entity.name === "StockMovement") Object.assign(row, { quantity: 7.5, sourceType: "SALE", sourceId: ids.Sale, unit: "pcs" });
        if (entity.name === "OutboxEvent") Object.assign(row, { aggregateType: "Sale", aggregateId: ids.Sale, eventType: "SALE_COMPLETED", payload: { response: "synthetic", financialTotal: 125.25 }, status: "PENDING" });
        await model(tx, entity.name).createMany({ data: [row] });
```

---

#### Edit 3: `tests/recovery.integration.test.ts` (Model Count & Assertions, Lines 82–84, 179–181)

**Target Lines**: 82–84  
**Before**:
```ts
  it("R1 captures all 43 tenant models and authenticates encrypted archives without claiming rehearsal", async () => {
    expect(Object.keys(original.tables)).toHaveLength(43);
    for (const rows of Object.values(original.tables)) expect(rows).toHaveLength(1);
```

**After**:
```ts
  it("R1 captures all 48 tenant models and authenticates encrypted archives without claiming rehearsal", async () => {
    expect(Object.keys(original.tables)).toHaveLength(48);
    for (const rows of Object.values(original.tables)) expect(rows).toHaveLength(1);
```

**Target Lines**: 179–181  
**Before**:
```ts
    expect((await db.sale.findUniqueOrThrow({ where: { id: ids.Sale } })).paidAmount).toBe(125.25);
    expect((await db.payment.findUniqueOrThrow({ where: { id: ids.Payment } })).amount).toBe(125.25);
    expect((await db.customer.findUniqueOrThrow({ where: { id: ids.Customer } })).balance).toBe(0);
```

**After**:
```ts
    expect(Number((await db.sale.findUniqueOrThrow({ where: { id: ids.Sale } })).paidAmount)).toBe(125.25);
    expect(Number((await db.payment.findUniqueOrThrow({ where: { id: ids.Payment } })).amount)).toBe(125.25);
    expect(Number((await db.customer.findUniqueOrThrow({ where: { id: ids.Customer } })).balance)).toBe(0);
```

---

#### Edit 4: `scripts/rehearse-recovery.ts` (Lines 80–92)

**Target Lines**: 80–92  
**Before**:
```ts
        else if (!field.isRequired || field.hasDefaultValue) continue;
        else data[field.name] = field.type === "DateTime" ? new Date("2025-01-02T03:04:05.000Z") : field.type === "Float" ? 125.25 : field.type === "Int" ? 3 : field.type === "Boolean" ? true : `${entityName}-${field.name}-${tag}`;
      }
      if (entityName === "Business") data.settings = Prisma.JsonNull;
      if (entityName === "Sale") Object.assign(data, { total: 125.25, paidAmount: 25.25, paymentStatus: "PARTIAL" });
      if (entityName === "Payment") Object.assign(data, { amount: 25.25, method: "CASH" });
      if (entityName === "Customer") data.balance = 100;
      if (entityName === "CustomerLedger") Object.assign(data, { debit: 100, balance: 100 });
      if (entityName === "Supplier") data.balance = 75.5;
      if (entityName === "SupplierLedger") Object.assign(data, { credit: 75.5, balance: 75.5 });
      if (["ProductStock", "Batch"].includes(entityName)) data.quantity = 7.5;
      return { ...data, ...overrides };
```

**After**:
```ts
        else if (!field.isRequired || field.hasDefaultValue) continue;
        else data[field.name] = field.type === "DateTime" ? new Date("2025-01-02T03:04:05.000Z") : (field.type === "Float" || field.type === "Decimal") ? 125.25 : field.type === "Int" ? 3 : field.type === "Boolean" ? true : `${entityName}-${field.name}-${tag}`;
      }
      if (entityName === "Business") data.settings = Prisma.JsonNull;
      if (entityName === "Sale") Object.assign(data, { total: 125.25, paidAmount: 25.25, paymentStatus: "PARTIAL" });
      if (entityName === "Payment") Object.assign(data, { amount: 25.25, method: "CASH" });
      if (entityName === "Customer") data.balance = 100;
      if (entityName === "CustomerLedger") Object.assign(data, { debit: 100, balance: 100 });
      if (entityName === "Supplier") data.balance = 75.5;
      if (entityName === "SupplierLedger") Object.assign(data, { credit: 75.5, balance: 75.5 });
      if (["ProductStock", "Batch"].includes(entityName)) data.quantity = 7.5;
      if (entityName === "PaymentAllocation") Object.assign(data, { amount: 25.25, saleId: ids.Sale, purchaseId: null });
      if (entityName === "PaymentReversal") Object.assign(data, { reason: "Synthetic payment reversal" });
      if (entityName === "Refund") Object.assign(data, { amount: 25.25, reason: "Synthetic customer return", method: "CASH", status: "COMPLETED" });
      if (entityName === "StockMovement") Object.assign(data, { quantity: 7.5, sourceType: "SALE", sourceId: ids.Sale, unit: "pcs" });
      if (entityName === "OutboxEvent") Object.assign(data, { aggregateType: "Sale", aggregateId: ids.Sale, eventType: "SALE_COMPLETED", payload: { response: "synthetic", label, financialTotal: 125.25 }, status: "PENDING" });
      return { ...data, ...overrides };
```

---

## 5. Verification Method

### 5.1 Verification Commands
1. **Typecheck Entire Monorepo**:
   ```powershell
   npm.cmd run typecheck
   ```
   *Expected Outcome*: Exit code 0 with zero compilation errors across `backend` and `frontend`.

2. **In-Memory Recovery Format Unit Tests**:
   ```powershell
   npx.cmd vitest run tests/recovery-format.test.ts
   ```
   *Expected Outcome*: 5 passed tests; validates snapshot sealing, tampering rejection, schemaHash binding, and migration identity check.

3. **Isolated PostgreSQL Integration Suite**:
   ```powershell
   # 1. Start isolated test container
   node scripts/restro-env.mjs db

   # 2. Deploy schema migration
   node scripts/restro-env.mjs migrate

   # 3. Execute recovery integration tests
   node scripts/restro-env.mjs test tests/recovery.integration.test.ts
   ```
   *Expected Outcome*: All 8 tests in `tests/recovery.integration.test.ts` pass, certifying that all 48 models are captured, sealed, tampered archives are rejected, and recovered missing tenants exactly match original data including Decimal precision.

4. **Multi-Cluster Synthetic Recovery Rehearsal**:
   ```powershell
   node scripts/restro-restore-env.mjs rehearse
   ```
   *Expected Outcome*: Rehearsal completes across `127.0.0.1:55439` and `127.0.0.1:55440` with all 48 models verified and zero SQL invariant violations.

### 5.2 Independent Invalidation Conditions
- Any test execution where `Object.keys(snapshot.tables).length !== 48` invalidates the backup manifest.
- Any error `BackupError: Invalid <Model>.<field>` on a Decimal field indicates missing Decimal type handling in `validateSnapshot()`.
- Any error `invalid input syntax for type numeric` indicates that fixture generation is producing string fallback tokens instead of Decimal numbers.
- Any test failure on `expect(actual).toBe(125.25)` indicates strict referential inequality between a `Prisma.Decimal` instance and a Javascript number.
