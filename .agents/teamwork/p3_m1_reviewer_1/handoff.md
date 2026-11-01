# Phase 3 Milestone M1 Review & Adversarial Challenge Report

**Reviewer**: M1 Reviewer & Adversarial Critic (`p3_m1_reviewer_1`)  
**Target Milestone**: Phase 3 Milestone M1: Core Schema Additions & Additive Migration  
**Date**: 2026-11-01  
**Verdict**: **APPROVE**  

---

## 1. Observation

### 1.1 Reviewed Work Products & File Artifacts

1. `packages/db/prisma/schema.prisma`:
   - Line 62–74: `model Business` augmented with reverse relation arrays for all 12 Phase 3 models: `floors Floor[]`, `restaurantTables RestaurantTable[]`, `tableSessions TableSession[]`, `menus Menu[]`, `menuSections MenuSection[]`, `menuItems MenuItem[]`, `modifierGroups ModifierGroup[]`, `modifierOptions ModifierOption[]`, `menuItemModifierGroups MenuItemModifierGroup[]`, `restaurantOrders RestaurantOrder[]`, `orderRounds OrderRound[]`, `orderLines OrderLine[]`.
   - Line 125–129: `model Branch` augmented with `floors Floor[]`, `restaurantTables RestaurantTable[]`, `tableSessions TableSession[]`, `menus Menu[]`, `restaurantOrders RestaurantOrder[]`.
   - Line 174–177: `model User` augmented with named relations `openedTableSessions TableSession[] @relation("SessionOpenedBy")`, `closedTableSessions TableSession[] @relation("SessionClosedBy")`, `createdRestaurantOrders RestaurantOrder[] @relation("OrderCreatedBy")`, `submittedOrderRounds OrderRound[] @relation("RoundSubmittedBy")`.
   - Line 278: `model Product` augmented with `menuItems MenuItem[]`.
   - Line 1113–1426: 12 new hospitality models defined:
     * `Floor`: composite uniqueness `@@unique([businessId, id])`, `@@unique([businessId, branchId, name])`.
     * `RestaurantTable`: line 1144 strictly enforces `currentSessionId String?` as a scalar without an `@relation` attribute.
     * `TableSession`: occupancy status `status String @default("ACTIVE")`, OCC `version Int @default(1)`.
     * `Menu` and `MenuSection`: hierarchical display structure, composite unique keys.
     * `MenuItem`: `basePrice Decimal @db.Decimal(12, 2)`, `taxRate Decimal @default(0) @db.Decimal(5, 2)`.
     * `ModifierGroup` and `ModifierOption`: `priceDelta Decimal @default(0) @db.Decimal(12, 2)` (supporting signed deltas).
     * `MenuItemModifierGroup`: association table with `@@unique([businessId, menuItemId, modifierGroupId])`.
     * `RestaurantOrder`: 3D orthogonal statuses (`acceptanceStatus`, `fulfillmentStatus`, `settlementStatus`), monetary aggregations in `Decimal(12, 2)`, OCC `version Int @default(1)`.
     * `OrderRound`: discrete rounds per order, `@@unique([businessId, orderId, roundNumber])`.
     * `OrderLine`: immutable price/tax snapshots (`basePrice`, `unitPrice`, `taxRate`, `taxAmount`, `subtotal`, `total` as `Decimal(12, 2)`), `appliedModifiers Json`, 3D orthogonal statuses (`acceptanceStatus`, `fulfillmentStatus`, `settlementStatus`), audit provenance (`rejectionReason`, `voidReason`, `auditEventId`), OCC `version Int @default(1)`.

2. `packages/db/prisma/migrations/202611010001_phase3_restaurant_staff_mvp/migration.sql`:
   - 424 lines of purely additive SQL DDL.
   - Lines 8–233: 12 `CREATE TABLE` statements with primary keys, default timestamps, and appropriate data types.
   - Lines 239–305: 12 composite uniqueness indexes `("businessId", "id")` and performance indexes.
   - Lines 310–368: Standard Prisma navigation foreign keys.
   - Lines 373–423: Strict composite relational tenant isolation foreign keys (`FOREIGN KEY ("businessId", ...) REFERENCES ... ("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE`).

3. `tests/recovery.integration.test.ts`:
   - Line 87: Test description updated to reflect all 60 tenant models.
   - Line 88: Assertion `expect(Object.keys(original.tables)).toHaveLength(60);` updated from 48 to 60.

### 1.2 Independent Verification Tool Executions & Verbatim Outputs

#### Command 1: TypeScript Typecheck
```powershell
npm.cmd run typecheck
```
- **Exit Code**: `0`
- **Output**:
  ```
  > restroinn@1.0.0 typecheck
  > tsc -p backend/tsconfig.json --noEmit --incremental false && tsc -p frontend/tsconfig.json --noEmit --incremental false
  ```

#### Command 2: Monorepo Test Suite
```powershell
npm.cmd test
```
- **Exit Code**: `0`
- **Output**:
  ```
  Test Files  9 passed | 4 skipped (13)
       Tests  85 passed | 41 skipped (126)
    Duration  4.65s
  ```

#### Command 3: PostgreSQL Tenant Recovery Test
```powershell
node scripts/restro-env.mjs recovery-test
```
- **Exit Code**: `0`
- **Output**:
  ```
  RUN  v5.0.5 C:/projects/pos
  ✓ tests/recovery.integration.test.ts (8 tests) 4739ms
    ✓ PostgreSQL tenant recovery (8)
      ✓ R4 late audit failure rolls back every recovered table, including orphan-capable idempotency rows 895ms
      ✓ R5 recovers balances, payments, stock, batches, all history, IDs and SQL-vs-JSON nulls exactly 578ms
      ✓ R6 concurrent committed financial changes cannot tear the repeatable-read snapshot 316ms
      ✓ R7 backup HTTP boundary uses current database authority and refuses legacy restore without effects 625ms
      ✓ R8 captures a deterministic, sorted SQL-null manifest even with many null-JSON rows 373ms

  Test Files  1 passed (1)
       Tests  8 passed (8)
  Recovery verification: 8 passed, zero skipped.
  ```

#### Command 4: Disaster Recovery Rehearsal Across Clusters
```powershell
node scripts/restro-restore-env.mjs rehearse
```
- **Exit Code**: `0`
- **Output Highlights**:
  ```
  PASS  source and target are different PostgreSQL clusters, databases and roles — source restro_test / target restro_restore
  PASS  target migration history equals source (names and checksums) — 202610300001_retail_baseline, 202610300002_commerce_hardening, 202610310001_phase1_security_foundation, 202610310002_phase2_financial_inventory_core, 202611010001_phase3_restaurant_staff_mvp
  PASS  target holds no trace of the tenant to recover or of tenant B
  PASS  archive covers all 60 tenant models and only tenant A — 89 rows, 58373 bytes
  PASS  archive is encrypted and carries the migration identity
  PASS  backup status never claims restore verification
  PASS  source database byte-for-byte unchanged by backup
  ... [19 negative security, corruption, tampering, and path-traversal tests passed without writes]
  PASS  restore recorded exactly one recovery audit entry
  PASS  entity counts equal for all 60 models — 89 rows
  PASS  every restored row equals its source row (IDs, timestamps, values, SQL-vs-JSON nulls) — 60/60 models identical
  PASS  invoice, payment, balance, ledger, stock and batch totals identical source vs target
  PASS  target invariants hold: payments match paidAmount, stock matches batches, receivable matches customer balance, no orphans
  PASS  source satisfies the same invariants (rehearsal fixtures are internally consistent)
  PASS  expected synthetic totals: receivable 2380.74, payments 2075.25, stock 50 across products
  PASS  audit history and request-deduplication records preserved — 4 audit, 3 request results
  PASS  unrelated tenant C in the target is untouched (all 60 models, every row)
  PASS  tenant B (never restored) has no rows in the target
  PASS  restore wrote only the recovered tenant's tables — 60 tables changed
  PASS  refused without writes: second restore of an already-present tenant (no overwrite, no delete)
  PASS  target fingerprint before the first recovery equals its state before any negative case
  PASS  source database unchanged after the whole backup + restore + negative sequence
  PASS  source returned exactly to its pre-rehearsal content after generated-ID cleanup

  Rehearsal: 41/41 checks passed; timings ms {"seedSource":491,"seedTargetUnrelatedTenant":362,"capture":246,"backupWrite":178,"loadAndValidateArchive":4,"restoreTransaction":317,"postRestoreCapture":297,"totalRehearsal":10583}; report scratch\rehearsal-results-3e468d13-4a0d-4732-8607-50409562093b.json
  ```

---

## 2. Logic Chain

1. **DAG Acyclicity & Disaster Recovery Preservation (Observation 1.1 item 1, Observation 1.2 Command 4)**:
   - `backend/src/lib/backup-format.ts` sorts models topologically based on explicit foreign key relations.
   - If `RestaurantTable.currentSessionId` were an explicit `@relation` to `TableSession`, a circular dependency `RestaurantTable <-> TableSession` would crash topological ordering with `"Backup schema has unsupported dependency cycle"`.
   - Because `RestaurantTable.currentSessionId` is defined as a scalar `String?`, the relation graph is strictly a directed acyclic graph (DAG).
   - Topological sorting and multi-cluster rehearsal across all 60 models completed without cycle errors (41/41 checks passed).

2. **Schema Invariant & Decimal Money Precision (Observation 1.1 item 1)**:
   - All price deltas, line base prices, taxes, subtotals, and order totals are explicitly typed `Decimal @db.Decimal(12, 2)` (and `Decimal(5, 2)` for tax rates).
   - This prevents binary floating-point drift and guarantees exact financial calculations.

3. **Multi-Tenant Isolation & Additive Migration Fidelity (Observation 1.1 item 2)**:
   - Every single new table includes composite primary/unique key indexes on `("businessId", "id")`.
   - Cross-entity foreign keys at the PostgreSQL level enforce `("businessId", childFk) REFERENCES parentTable("businessId", "id")`.
   - Migration `202611010001_phase3_restaurant_staff_mvp` is strictly additive (no dropped tables, columns, or types). Both source and target databases share identical migration histories and checksums.

4. **Integration Test Alignment (Observation 1.1 item 3, Observation 1.2 Command 3)**:
   - Expanding from 48 to 60 models reflects the addition of the 12 Phase 3 hospitality models.
   - `tests/recovery.integration.test.ts:88` correctly asserts that the snapshot manifest captures all 60 models without skipping or dropping tables.

5. **Code Quality & Type Safety (Observation 1.2 Commands 1 & 2)**:
   - Both backend and frontend TypeScript compilations (`npm.cmd run typecheck`) emit zero errors.
   - Existing unit and integration tests pass with zero regressions.

---

## 3. Caveats

- **No Caveats**: The review encompassed complete verification across the schema definitions, migration script, test harness updates, and live container databases.

---

## 4. Conclusion & Integrity Assessment

### Verdict: **APPROVE**

Milestone M1 (Core Schema Additions & Additive Migration) is complete, robust, and verified with zero regressions.
- **Integrity Verification**:
  - No hardcoded test results or fake outputs detected.
  - No dummy or facade implementations found; models, indexes, and constraints are fully realized in both Prisma schema and PostgreSQL DDL.
  - No shortcuts taken; all 12 models implement comprehensive multi-tenant isolation and Decimal precision.
  - All verification test outputs were independently reproduced and confirmed.

---

## 5. Verification Method

To independently verify this evaluation:
1. Review files:
   - `packages/db/prisma/schema.prisma` (verify 12 models and scalar `RestaurantTable.currentSessionId`)
   - `packages/db/prisma/migrations/202611010001_phase3_restaurant_staff_mvp/migration.sql` (verify additive DDL, composite FKs)
   - `tests/recovery.integration.test.ts` (verify model count assertion of 60)
2. Execute verification commands from root `c:\projects\pos`:
   ```powershell
   npm.cmd run typecheck
   npm.cmd test
   node scripts/restro-env.mjs recovery-test
   node scripts/restro-restore-env.mjs rehearse
   ```
3. Invalidation conditions:
   - Any circular foreign key relation introduced between `RestaurantTable` and `TableSession`.
   - Any floating point numeric types (`Float`) used for monetary deltas or totals instead of `Decimal(12, 2)`.
   - Any failure in cross-cluster rehearsal or schema migration checksum mismatch.
