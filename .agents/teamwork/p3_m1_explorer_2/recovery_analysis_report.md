# Disaster Recovery Topological Analysis & Verification Report

**Author**: M1 Explorer 2 (Disaster Recovery Topological Analyst)  
**Working Directory**: `c:\projects\pos\.agents\teamwork\p3_m1_explorer_2`  
**Target Milestone**: Phase 3 (M1) — Restaurant Staff MVP Core Schema & DR Topology  
**Date**: 2026-11-01  
**Status**: COMPLETE / VERIFIED  

---

## 1. Executive Summary

This report delivers the authoritative disaster recovery (DR) topological analysis for the DynaPOS Phase 3: Restaurant Staff MVP database schema additions. DynaPOS implements an automated tenant backup engine (`backend/src/lib/backup-format.ts`, `backend/src/lib/backup-service.ts`) and multi-stage verification harness (`tests/recovery.integration.test.ts`, `scripts/rehearse-recovery.ts`).

### Core Findings & Architectural Guarantees:
1. **Strictly Acyclic Directed Graph (DAG)**: Adding the 12 Phase 3 models (`Floor`, `RestaurantTable`, `TableSession`, `Menu`, `MenuSection`, `MenuItem`, `ModifierGroup`, `ModifierOption`, `MenuItemModifierGroup`, `RestaurantOrder`, `OrderRound`, `OrderLine`) expands the tenant model set from 48 to **60 models**. The greedy topological sort algorithm in `backup-format.ts` (lines 14–19) resolves all 60 models without deadlock.
2. **Circular Dependency Proof (`RestaurantTable` vs `TableSession`)**: `RestaurantTable.currentSessionId` **MUST** be defined as a scalar `String?` without a Prisma `@relation` attribute. Defining `@relation` on both `RestaurantTable.currentSessionId` and `TableSession.tableId` induces a circular dependency cycle ($A \to B \to A$) that crashes `backup-format.ts` at module evaluation time with `Error: Backup schema has unsupported dependency cycle`, prevents foreign key insertion during recovery, and deadlocks reverse-order teardown.
3. **Exact Test Suite Assertion Update**: In `tests/recovery.integration.test.ts`, line 88 currently asserts `expect(Object.keys(original.tables)).toHaveLength(48);`. This **must be updated to 60** (along with line 87 test description).
4. **Dynamic Model Resolution in Rehearsal**: `scripts/rehearse-recovery.ts` uses dynamic model discovery (`format.backupModels.map(...)`, `format.backupModels.length`) with zero hardcoded model count assertions. Rehearsal will execute 41/41 negative and reconciliation checks dynamically once both source (`55439`) and disposable target (`55440`) have the additive migration applied.
5. **Worker Execution Protocol**: Concrete instructions are provided to guarantee `node scripts/restro-env.mjs recovery-test` and `node scripts/restro-restore-env.mjs rehearse` pass with zero regressions.

---

## 2. In-Depth Analysis of the Backup Engine (`backend/src/lib/backup-format.ts`)

The backup engine defines the tenant snapshot archive structure, cryptographic sealing, and validation logic.

### 2.1 Topological Dependency Sort (Lines 12–20)
```ts
12: const models = Prisma.dmmf.datamodel.models.filter(model => !excludedModels.includes(model.name));
13: export const backupModels: typeof models = [];
14: const pending = [...models];
15: while (pending.length) {
16:   const index = pending.findIndex(model => model.fields.filter(field => field.relationFromFields?.length).every(field => backupModels.some(parent => parent.name === field.type)));
17:   if (index < 0) throw new Error("Backup schema has unsupported dependency cycle");
18:   backupModels.push(pending.splice(index, 1)[0]);
19: }
20: export const schemaHash = createHash("sha256").update(JSON.stringify(backupModels)).digest("hex");
```

#### How the Algorithm Works:
- **Exclusion Filter**: Excludes non-tenant models (`BusinessRegistrationRequest`).
- **Dependency Detection**: In Prisma DMMF, a field represents a directed foreign key reference if and only if `field.relationFromFields?.length > 0`. The target entity type is `field.type`.
- **Greedy Selection**: At each iteration, the algorithm inspects all models in `pending`. It selects the first model whose outbound relation targets are all already present in `backupModels`.
- **Cycle Guard**: If `pending` is non-empty but no model can be selected (`index < 0`), a cycle exists in the foreign key graph. Line 17 throws an immediate fatal exception: `Error: Backup schema has unsupported dependency cycle`.
- **Schema Hash**: `schemaHash` is computed as the SHA-256 digest of the serialized `backupModels` array. This hash seals the archive envelope (`envelopeSchema`), guaranteeing that archives cannot be restored if schema drift occurs.

### 2.2 Relational Integrity & Multi-Tenant Boundaries (Lines 80–90)
```ts
80:   if (snapshot.tables.Business.length !== 1) throw new BackupError("Snapshot must contain exactly one business");
81:   for (const model of backupModels) for (const row of snapshot.tables[model.name]) {
82:     for (const field of model.fields.filter(field => field.relationFromFields?.length)) {
83:       if (field.relationFromFields!.length !== 1 || field.relationToFields?.[0] !== "id") throw new BackupError("Unsupported composite backup relation");
84:       const value = row[field.relationFromFields![0]];
85:       if (value !== null && !ids.get(field.type)?.has(value as string)) throw new BackupError(`Foreign or missing ${model.name} reference`);
86:     }
87:     const logical = ["SaleReturnItem", "PurchaseReturnItem"].includes(model.name) ? [["productId", "Product"]] : model.name === "AuditLog" ? [["branchId", "Branch"]] : model.name === "Sale" ? [["correctedInvoiceId", "Sale"]] : [];
88:     for (const [field, parent] of logical) if (row[field] !== null && !ids.get(parent)?.has(row[field] as string)) throw new BackupError(`Foreign or missing ${model.name} logical reference`);
89:   }
```

#### Key Invariants Enforced:
1. **Single-Field Foreign Key Invariant (Line 83)**:
   `field.relationFromFields!.length === 1 && field.relationToFields?.[0] === "id"`
   Prisma relations must reference single primary key `id` columns. Composite foreign keys (e.g. `fields: [businessId, id]`) are explicitly rejected with `"Unsupported composite backup relation"`. Tenant isolation is enforced via `businessId` fields and composite uniqueness `@@unique([businessId, id])`, not composite foreign keys.
2. **Snapshot Referential Integrity (Line 85)**:
   Every non-null foreign key reference in every table must resolve to an entity `id` captured within the same tenant snapshot (`ids.get(field.type)?.has(value)`). Cross-tenant or dangling references immediately fail validation.
3. **Logical References (Lines 87–88)**:
   Specific unconstrained scalar references (such as `AuditLog.branchId` or `Sale.correctedInvoiceId`) are validated if listed in `logical`. Unlisted optional scalar strings (such as `RestaurantTable.currentSessionId`) are treated as pure data attributes and do not impose foreign key constraints.

---

## 3. Mathematical & Empirical Proof: Why `RestaurantTable.currentSessionId` MUST Be Scalar

### 3.1 The Circular Dependency Hazard
In hospitality workflows, a physical dining table (`RestaurantTable`) has an active dining session (`TableSession`), and a dining session is seated at a dining table.

#### Scenario 1: Both Entities Have Prisma `@relation` (Fatal Anti-Pattern)
```prisma
// FATAL SCHEMA DEFINITION
model RestaurantTable {
  id               String        @id @default(uuid())
  ...
  currentSessionId String?
  currentSession   TableSession? @relation("CurrentTableSession", fields: [currentSessionId], references: [id])
  tableSessions    TableSession[] @relation("AllTableSessions")
}

model TableSession {
  id               String          @id @default(uuid())
  ...
  tableId          String
  table            RestaurantTable @relation("AllTableSessions", fields: [tableId], references: [id])
  currentTables    RestaurantTable[] @relation("CurrentTableSession")
}
```

#### Formal Graph Analysis:
1. Let $G = (V, E)$ be the dependency graph where vertices $V$ are Prisma models, and directed edges $(u, v) \in E$ represent a foreign key relation where $u$ references $v$ (i.e. $u$ depends on $v$).
2. Under Scenario 1:
   - `RestaurantTable` has foreign key `currentSessionId` referencing `TableSession.id`. Hence, edge $(\text{RestaurantTable}, \text{TableSession}) \in E$.
   - `TableSession` has foreign key `tableId` referencing `RestaurantTable.id`. Hence, edge $(\text{TableSession}, \text{RestaurantTable}) \in E$.
3. Cycle Detection:
   $$\text{RestaurantTable} \to \text{TableSession} \to \text{RestaurantTable}$$
   This induces a cycle of length 2: $C_2 \subset G$.
4. **Failure in `backup-format.ts`**:
   - Initial `backupModels`: $[\text{Business}, \text{Subscription}, \text{Branch}, \text{User}, \dots]$
   - `pending` reaches state where only models depending on `RestaurantTable` or `TableSession` remain.
   - For `RestaurantTable` to be resolved: `TableSession` must be in `backupModels`.
   - For `TableSession` to be resolved: `RestaurantTable` must be in `backupModels`.
   - Neither condition can be met: `pending.findIndex(...)` returns `-1`.
   - Line 17 throws:
     `Error: Backup schema has unsupported dependency cycle`
   - **Empirical Verification**: We executed an isolated simulation of this scenario with Node.js; Kahn's algorithm halted with `CYCLE DETECTED: [ 'RestaurantTable', 'TableSession' ]` and threw line 17.

5. **Failure in Database Restoration (`restoreMissingTenant`)**:
   - `TenantBackupStore.restoreMissingTenant` (`backend/src/lib/backup-service.ts`:124–133) iterates through `backupModels` sequentially:
     ```ts
     for (const model of backupModels) {
       await delegate(tx, model.name).createMany({ data });
     }
     ```
   - In PostgreSQL, foreign keys are checked immediately unless deferred.
   - If `RestaurantTable` inserts first: any occupied table with `currentSessionId` populated will raise:
     `ERROR: insert or update on table "RestaurantTable" violates foreign key constraint` because the target `TableSession` does not exist yet.
   - If `TableSession` inserts first: every session has a non-nullable `tableId`, which will raise `foreign key constraint violation` because `RestaurantTable` does not exist yet.
   - Restoration is completely deadlocked.

6. **Failure in Test Fixture Teardown**:
   - `tests/recovery.integration.test.ts:29` and `scripts/rehearse-recovery.ts:135` delete fixtures in reverse topological order:
     ```ts
     for (const entity of [...format.backupModels].reverse()) {
       await model(tx, entity.name).deleteMany({ where: { id: ids[entity.name] } });
     }
     ```
   - Reverse deletion of mutually referencing foreign keys fails with `violates foreign key constraint` on whichever model is deleted first.

---

### 3.2 The Valid Architecture: Unidirectional Relation with Logical Scalar Pointer

```prisma
// AUTHORITATIVE ACYCLIC SCHEMA
model RestaurantTable {
  id               String          @id @default(uuid())
  businessId       String
  business         Business        @relation(fields: [businessId], references: [id], onDelete: Cascade)
  branchId         String
  branch           Branch          @relation(fields: [branchId], references: [id], onDelete: Cascade)
  floorId          String
  floor            Floor           @relation(fields: [floorId], references: [id], onDelete: Cascade)
  tableNumber      String
  capacity         Int             @default(4)
  status           String          @default("AVAILABLE")
  currentSessionId String?         // PURE SCALAR LOGICAL ID, NO @relation!
  shape            String          @default("RECTANGLE")
  posX             Int             @default(0)
  posY             Int             @default(0)
  width            Int             @default(1)
  height           Int             @default(1)
  isActive         Boolean         @default(true)
  createdAt        DateTime        @default(now())
  updatedAt        DateTime        @updatedAt

  tableSessions    TableSession[]
  restaurantOrders RestaurantOrder[]

  @@unique([businessId, id])
  @@unique([businessId, branchId, tableNumber])
  @@index([businessId, branchId, floorId])
  @@index([businessId, status])
}

model TableSession {
  id            String          @id @default(uuid())
  businessId    String
  business      Business        @relation(fields: [businessId], references: [id], onDelete: Cascade)
  branchId      String
  branch        Branch          @relation(fields: [branchId], references: [id], onDelete: Cascade)
  tableId       String
  table         RestaurantTable @relation(fields: [tableId], references: [id], onDelete: Cascade)
  sessionNumber String
  guestCount    Int             @default(1)
  status        String          @default("ACTIVE")
  openedAt      DateTime        @default(now())
  closedAt      DateTime?
  openedById    String?
  openedBy      User?           @relation("SessionOpenedBy", fields: [openedById], references: [id], onDelete: SetNull)
  closedById    String?
  closedBy      User?           @relation("SessionClosedBy", fields: [closedById], references: [id], onDelete: SetNull)
  version       Int             @default(1)
  notes         String?
  createdAt     DateTime        @default(now())
  updatedAt     DateTime        @updatedAt

  restaurantOrders RestaurantOrder[]

  @@unique([businessId, id])
  @@unique([businessId, branchId, sessionNumber])
  @@index([businessId, branchId, status])
  @@index([businessId, tableId, status])
}
```

#### Why This Resolves All Invariants:
1. **Acyclic Topological Sort**:
   - `RestaurantTable` depends only on `Business`, `Branch`, `Floor`. (Resolved first).
   - `TableSession` depends on `RestaurantTable`, `User`, `Business`, `Branch`. (Resolved second).
   - Path: $\text{Floor} \to \text{RestaurantTable} \to \text{TableSession}$. Edge $(\text{TableSession}, \text{RestaurantTable})$ exists; edge $(\text{RestaurantTable}, \text{TableSession})$ does NOT exist.
2. **Zero Restoration Deadlock**:
   - `RestaurantTable` is inserted before `TableSession`. Even if `currentSessionId` holds a string, PostgreSQL enforces no foreign key on that column, so the row commits cleanly.
   - `TableSession` is inserted second and its `tableId` successfully references the already-committed `RestaurantTable`.
3. **Clean Teardown**:
   - In reverse order, `TableSession` rows are deleted first, followed by `RestaurantTable` rows.
4. **Application Navigation**:
   - The active session is retrieved either via `table.currentSessionId` or via the indexed relation `tableSessions: { where: { status: "ACTIVE" }, take: 1 }`.

---

## 4. Complete 60-Model Topological Sort Verification

When the 12 Phase 3 models are introduced, the complete dependency sort order computed by `backup-format.ts` is deterministic.

### Complete Model Ordering Table:
| Rank | Model Name | Dependencies (Outbound Foreign Keys) | Domain Phase |
|---|---|---|:---:|
| 1 | `Business` | *none (root)* | Baseline |
| 2 | `Subscription` | `Business` | Baseline |
| 3 | `Branch` | `Business` | Baseline |
| 4 | `User` | `Business` | Baseline |
| 5 | `Category` | `Business` | Baseline |
| 6 | `Brand` | `Business` | Baseline |
| 7 | `Subcategory` | `Business`, `Category` | Baseline |
| 8 | `Unit` | `Business` | Baseline |
| 9 | `Product` | `Business`, `Category`, `Subcategory?`, `Brand?`, `Unit?` | Baseline |
| 10 | `ProductStock` | `Business`, `Product`, `Branch` | Baseline |
| 11 | `Customer` | `Business` | Baseline |
| 12 | `CustomerLedger` | `Business`, `Customer` | Baseline |
| 13 | `Supplier` | `Business` | Baseline |
| 14 | `Batch` | `Business`, `Product`, `Branch` | Baseline |
| 15 | `SupplierLedger` | `Business`, `Supplier` | Baseline |
| 16 | `Purchase` | `Business`, `Supplier`, `Branch`, `User` | Baseline |
| 17 | `PurchaseItem` | `Business`, `Purchase`, `Product` | Baseline |
| 18 | `RequestResult` | `Business` | Phase 1 |
| 19 | `PurchaseReturn` | `Business`, `Purchase`, `Supplier`, `Branch` | Baseline |
| 20 | `PurchaseReturnItem` | `Business`, `PurchaseReturn` | Baseline |
| 21 | `ExpenseCategory` | `Business` | Baseline |
| 22 | `Expense` | `Business`, `ExpenseCategory`, `Branch`, `User` | Baseline |
| 23 | `IncomeCategory` | `Business` | Baseline |
| 24 | `Income` | `Business`, `IncomeCategory`, `Branch`, `User` | Baseline |
| 25 | `StockTransfer` | `Business`, `Branch (from)`, `Branch (to)`, `User` | Baseline |
| 26 | `StockTransferItem` | `Business`, `StockTransfer`, `Product` | Baseline |
| 27 | `AuditLog` | `Business`, `User?` | Baseline |
| 28 | `Notification` | `Business`, `User?` | Baseline |
| 29 | `OpeningStock` | `Business`, `Product`, `Branch` | Baseline |
| 30 | `FiscalYear` | `Business` | Baseline |
| 31 | `Sale` | `Business`, `Branch`, `Customer?`, `User` | Baseline |
| 32 | `SaleItem` | `Business`, `Sale`, `Product` | Baseline |
| 33 | `Payment` | `Business`, `Sale?`, `Purchase?`, `Branch` | Baseline |
| 34 | `SaleReturn` | `Business`, `Sale`, `Customer?`, `Branch` | Baseline |
| 35 | `SaleReturnItem` | `Business`, `SaleReturn` | Baseline |
| 36 | `FiscalYearInvoiceSequence` | `Business`, `FiscalYear`, `Branch` | Baseline |
| 37 | `CreditNote` | `Business`, `SaleReturn?`, `Customer?`, `FiscalYear?`, `Branch` | Baseline |
| 38 | `CreditNoteItem` | `Business`, `CreditNote`, `Product` | Baseline |
| 39 | `DebitNote` | `Business`, `PurchaseReturn?`, `Supplier?`, `FiscalYear?`, `Branch` | Baseline |
| 40 | `DebitNoteItem` | `Business`, `DebitNote`, `Product` | Baseline |
| 41 | `CbmsSyncQueue` | `Business` | Baseline |
| 42 | `UserBranchMembership` | `Business`, `User`, `Branch` | Phase 1 |
| 43 | `AuditEvent` | `Business`, `Branch?`, `User?` | Phase 1 |
| 44 | `PaymentAllocation` | `Business`, `Payment`, `Sale?`, `Purchase?` | Phase 2 |
| 45 | `PaymentReversal` | `Business`, `Payment`, `User?` | Phase 2 |
| 46 | `Refund` | `Business`, `Branch`, `Payment?`, `User?` | Phase 2 |
| 47 | `StockMovement` | `Business`, `Branch`, `Product`, `Batch?`, `User?` | Phase 2 |
| 48 | `OutboxEvent` | `Business` | Phase 2 |
| **49** | **`Floor`** | `Business`, `Branch` | **Phase 3 (New)** |
| **50** | **`RestaurantTable`** | `Business`, `Branch`, `Floor` | **Phase 3 (New)** |
| **51** | **`TableSession`** | `Business`, `Branch`, `RestaurantTable`, `User?` | **Phase 3 (New)** |
| **52** | **`Menu`** | `Business`, `Branch?` | **Phase 3 (New)** |
| **53** | **`MenuSection`** | `Business`, `Menu` | **Phase 3 (New)** |
| **54** | **`MenuItem`** | `Business`, `MenuSection`, `Product?` | **Phase 3 (New)** |
| **55** | **`ModifierGroup`** | `Business` | **Phase 3 (New)** |
| **56** | **`ModifierOption`** | `Business`, `ModifierGroup` | **Phase 3 (New)** |
| **57** | **`MenuItemModifierGroup`** | `Business`, `MenuItem`, `ModifierGroup` | **Phase 3 (New)** |
| **58** | **`RestaurantOrder`** | `Business`, `Branch`, `TableSession?`, `RestaurantTable?`, `User?` | **Phase 3 (New)** |
| **59** | **`OrderRound`** | `Business`, `RestaurantOrder`, `User?` | **Phase 3 (New)** |
| **60** | **`OrderLine`** | `Business`, `RestaurantOrder`, `OrderRound`, `MenuItem?` | **Phase 3 (New)** |

*(Note: Depending on the order of models declared in `schema.prisma`, models with no cross-dependencies such as `Floor`, `Menu`, and `ModifierGroup` may resolve earlier in `backupModels`, but in all cases exactly 60 models resolve acyclically).*

---

## 5. Inspection of Test Suites & Rehearsal Harness

### 5.1 `tests/recovery.integration.test.ts`
- **Location**: Line 87–88
- **Current Content**:
  ```ts
  87:   it("R1 captures all 48 tenant models and authenticates encrypted archives without claiming rehearsal", async () => {
  88:     expect(Object.keys(original.tables)).toHaveLength(48);
  89:     for (const rows of Object.values(original.tables)) expect(rows).toHaveLength(1);
  ```
- **Analysis**:
  - The test generates 1 synthetic row for each model in `format.backupModels`.
  - When Phase 3 models are migrated, `original.tables` will contain 60 table keys.
  - If line 88 is not modified, Vitest fails with:
    `AssertionError: expected [Array(60)] to have a length of 48 but got 60`
- **Required Change**:
  ```ts
  <<<<
  87:   it("R1 captures all 48 tenant models and authenticates encrypted archives without claiming rehearsal", async () => {
  88:     expect(Object.keys(original.tables)).toHaveLength(48);
  ====
  87:   it("R1 captures all 60 tenant models and authenticates encrypted archives without claiming rehearsal", async () => {
  88:     expect(Object.keys(original.tables)).toHaveLength(60);
  >>>>
  ```
- **Other Assertions**:
  - R2 through R8 (lines 98–221) are fully dynamic or test specific boundary conditions (`Payment`, `Sale`, `AuditLog`, `Customer`).
  - No other lines require changes.

### 5.2 `scripts/rehearse-recovery.ts`
- **Model Enumeration**:
  - Line 46: `const tableNames = [...format.backupModels.map(entity => entity.name), "BusinessRegistrationRequest"];`
  - Line 68: `for (const entity of format.backupModels) ids[entity.name] = entity.name === "Business" ? businessId : randomUUID();`
  - Line 103: `for (const entity of format.backupModels) await insert(tx, entity.name, row(entity.name, ids[entity.name], businessId));`
  - Line 135: `for (const entity of [...format.backupModels].reverse()) ...`
  - Line 202: `check(\`archive covers all ${format.backupModels.length} tenant models and only tenant A\`, ...)`
  - Line 262: `check(\`entity counts equal for all ${format.backupModels.length} models\`, mismatched.length === 0, ...)`
  - Line 269: `check("every restored row equals its source row (IDs, timestamps, values, SQL-vs-JSON nulls)", rowDiff.length === 0, ...)`
- **Financial Reconciliation Assertions (Lines 270–274)**:
  - Reconciles `Sale`, `Payment`, `CustomerLedger`, `SupplierLedger`, `ProductStock`, and `Batch`.
  - These financial checks are isolated to retail sales and inventory; the 12 new restaurant models do NOT participate in `reconcile()` queries.
  - Expected synthetic totals (`receivable 2380.74`, `payments 2075.25`, `stock 50`) will remain exact and unchanged.

---

## 6. Verification Checklist & Concrete Worker Instructions

The Builder/Worker executing Milestone M1 must adhere strictly to the following execution sequence:

### Step 1: Model Schema Definition (`packages/db/prisma/schema.prisma`)
1. Add the 12 Phase 3 models to `schema.prisma`.
2. **VERIFY INVARIANT**: Ensure `RestaurantTable.currentSessionId` is declared as:
   ```prisma
   currentSessionId String?
   ```
   **DO NOT** add `@relation` to `currentSessionId`.
3. Ensure `TableSession.tableId` is declared with `@relation`:
   ```prisma
   tableId String
   table   RestaurantTable @relation(fields: [tableId], references: [id], onDelete: Cascade)
   ```
4. Verify complementary reverse relation arrays on parent models:
   - `Business`: add `floors Floor[]`, `restaurantTables RestaurantTable[]`, `tableSessions TableSession[]`, `menus Menu[]`, `menuSections MenuSection[]`, `menuItems MenuItem[]`, `modifierGroups ModifierGroup[]`, `modifierOptions ModifierOption[]`, `menuItemModifierGroups MenuItemModifierGroup[]`, `restaurantOrders RestaurantOrder[]`, `orderRounds OrderRound[]`, `orderLines OrderLine[]`.
   - `Branch`: add `floors Floor[]`, `restaurantTables RestaurantTable[]`, `tableSessions TableSession[]`, `menus Menu[]`, `restaurantOrders RestaurantOrder[]`.
   - `User`: add `openedTableSessions TableSession[] @relation("SessionOpenedBy")`, `closedTableSessions TableSession[] @relation("SessionClosedBy")`, `createdRestaurantOrders RestaurantOrder[] @relation("OrderCreatedBy")`, `submittedOrderRounds OrderRound[] @relation("RoundSubmittedBy")`.
   - `Product`: add `menuItems MenuItem[]`.
5. Ensure all foreign key relations reference single primary key `id` columns (`relationFromFields.length === 1 && relationToFields === ["id"]`).
6. Ensure composite multi-tenant uniqueness `@@unique([businessId, id])` on every new model.

### Step 2: Client Generation & Database Migrations
1. Re-generate Prisma Client:
   ```powershell
   npx prisma generate --schema=packages/db/prisma/schema.prisma
   ```
2. Create additive SQL migration under `packages/db/prisma/migrations/202611010001_phase3_restaurant_staff_mvp/migration.sql`.
3. Apply migration to primary development/test container (port `55439`):
   ```powershell
   node scripts/restro-env.mjs migrate
   ```
4. **CRITICAL STEP — Apply migration to disposable restore target (port `55440`)**:
   ```powershell
   node scripts/restro-restore-env.mjs migrate
   ```
   *Rationale*: `scripts/rehearse-recovery.ts` lines 181–183 inspect `_prisma_migrations` on both databases. If the restore target is not migrated, Check 0 (`target migration history equals source`) will fail.

### Step 3: Test Assertion Update
1. Open `tests/recovery.integration.test.ts`.
2. Update line 87: change `48` to `60`.
3. Update line 88: change `expect(Object.keys(original.tables)).toHaveLength(48);` to `expect(Object.keys(original.tables)).toHaveLength(60);`.

### Step 4: Verification Execution
Execute the verification pipeline in order:
```powershell
# 1. Typecheck monorepo
npm.cmd run typecheck

# 2. Execute unit tests
npm.cmd test

# 3. Execute recovery regression test
node scripts/restro-env.mjs recovery-test

# 4. Execute recovery rehearsal test
node scripts/restro-restore-env.mjs rehearse
```

#### Expected Pass Criteria:
- `recovery-test`: Output `Recovery verification: 8 passed, zero skipped.`
- `rehearse`: Output `Rehearsal: 41/41 checks passed` and zero errors.

---
*End of Report.*
