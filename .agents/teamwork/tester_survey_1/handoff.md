# Comprehensive Test Infrastructure Survey & Adversarial Verification Strategy
**Phase 2: Financial & Inventory Core Hardening**

## Executive Summary
This survey establishes the complete testing topology, adversarial race verification mechanics, and financial reconciliation harness specifications for Phase 2: Financial & Inventory Core Hardening. The investigation evaluated the isolated PostgreSQL container harness (`127.0.0.1:55439`), existing test execution pipelines (`vitest`, `npm.cmd run typecheck`), transaction serialization and connection-witnessing patterns, and the exact invariant formulas required to certify inventory movement and payment ledgers.

---

## 1. Observation

### 1.1 Isolated Test Container Environment & Database Enforcement
- **Loopback Binding**: `scripts/database-verification.mjs` (lines 1–9) strictly validates all database connection strings against:
  - Protocol: `postgres:` or `postgresql:`
  - Host: `127.0.0.1`
  - Port: `55439`
  - Database: `restro_test`
  - User: `restro_dev`
  - Zero search query or hash fragment.
  Any divergence throws `"Refusing non-isolated database target"`.
- **Disposable Recovery Rehearsal Port**: `scripts/database-verification.mjs` (lines 15–24) defines a separate isolated destination for restore rehearsals at `127.0.0.1:55440` (`restro_restore` database, `restro_restore` role), explicitly forbidding targeting `55439`.
- **Environment Management**: `scripts/restro-env.mjs` (lines 8–24) manages `.env.restro.local` (mode 0600), setting:
  - `RESTRO_DB_PASSWORD`
  - `DATABASE_URL`, `DIRECT_URL`, `TEST_DATABASE_URL` (must match identically)
  - `AUTH_SECRET`, `AUTH_TRUST_HOST=true`, `BACKEND_URL=http://127.0.0.1:3001`, `ENABLE_MOCK_CBMS=false`
- **Container Lifecycle**: `compose.restro.yml` defines service `restro-db` using `postgres:15-alpine` mapped to `127.0.0.1:55439:5432` with volume `restro_dev_data` and healthcheck `pg_isready -U restro_dev -d restro_test`.
- **Migration Gate**: `scripts/restro-env.mjs` (lines 35, 47–60) checks the PostgreSQL catalog `pg_tables`. If tables exist outside `_prisma_migrations`, it confirms finished migration `202610300001_retail_baseline` before allowing `prisma migrate deploy`. Unbaselined schemas are rejected.
- **Verification Gate**: `scripts/database-verification.mjs` (lines 26–32) requires at least 14 passed cases and zero skipped tests (`assertDatabaseReport`).

### 1.2 Test Runners, Scripts & Current Health
- **Vitest Configuration**: `vitest.config.mts` (lines 4–7) defines:
  - Node environment (`test.environment: "node"`)
  - Test glob (`test.include: ["tests/**/*.test.ts"]`)
  - Sequential execution across files (`test.fileParallelism: false`), ensuring test files never collide on shared database state.
  - Path alias `@` -> `./backend/src`.
- **Typecheck Script**: `package.json` line 24:
  `tsc -p backend/tsconfig.json --noEmit --incremental false && tsc -p frontend/tsconfig.json --noEmit --incremental false`
  *Verified observation*: Executed synchronously and exited with code 0 (`Task finished with result: Command exited with code 0`).
- **Existing Suite Status**: `npm.cmd test` execution:
  - 30 unit tests passed across 6 test files (`tests/browser-request.test.ts`, `tests/commerce-transaction.test.ts`, `tests/recovery-format.test.ts`, `tests/commerce-policy.test.ts`, `tests/database-verification.test.ts`, `tests/session.test.ts`).
  - 2 test files skipped cleanly when database target is offline (`tests/commerce.integration.test.ts` [14 tests], `tests/recovery.integration.test.ts` [8 tests]).

### 1.3 Concurrency & Transaction Architecture
- **Transaction Wrapper**: `backend/src/lib/commerce-transaction.ts`:
  - `serializable()` (lines 19–28): Executes interactive transactions with `isolationLevel: Serializable`, `maxWait: 10000`, `timeout: 30000`. Catches Prisma error `P2034` (PostgreSQL `40001` serialization failure) and retries up to 3 times before raising 409 Conflict.
  - `commerceTransaction()` (lines 31–53): Enforces header `Idempotency-Key` (16–128 chars), computes SHA-256 `requestHash` over `{ userId, branchId, role, body }`, performs coarse row-level lock via `await tx.business.update({ where: { id: context.businessId }, data: { updatedAt: new Date() } })`, verifies `requestResult` to replay cached response on exact hash match or reject with 409 on hash mismatch.
- **Race Condition Witnessing**: `tests/commerce.integration.test.ts` (lines 55–83) and `scripts/verify-restro-milestone.mjs` (lines 37–48):
  - When `RESTRO_OBSERVE_RACES === "true"`, `vi.spyOn(db, "$transaction")` intercepts interactive transactions and injects:
    ```sql
    SELECT pg_backend_pid() AS pid;
    SELECT pg_sleep(0.025);
    ```
  - Logs `RACE_CONNECTIONS {"test": "...", "attempts": N, "pids": [pid1, pid2]}`.
  - Asserts `new Set(witness.pids).size >= 2`, providing undeniable proof of concurrent PostgreSQL backends rather than sequential multiplexing.

### 1.4 Current Schema & Mutation Gaps in Inventory and Payments
- **Float Usage**: `packages/db/prisma/schema.prisma` currently uses `Float` across all prices, stock quantities, and monetary fields (`Product.costPrice`, `Product.sellingPrice`, `ProductStock.quantity`, `Batch.quantity`, `Sale.total`, `SaleItem.price`, `Payment.amount`, `Customer.balance`, etc.).
- **Batch Stock Mutation Without Negative-Stock Flag**: In `backend/src/app/api/v1/sales/route.ts` (lines 326–334):
  ```ts
  if (!batch || batch.quantity < item.quantity) {
    throw new Error(`Insufficient batch stock for product "${product.name}" in batch "${item.batchNumber}".`);
  }
  await tx.batch.update({
    where: { id: batch.id },
    data: { quantity: { decrement: item.quantity } },
  });
  ```
  `ProductStock` checks `settings.allowNegativeStock !== false && settings.preventNegativeStock !== true` (line 295), but `Batch` unconditionally rejects if `batch.quantity < item.quantity`.
- **Absence of Dedicated Movement Ledger**: In `backend/src/app/api/v1/inventory/stock-movements/route.ts` (lines 28–120), movements are dynamically fabricated on-the-fly by querying `db.sale`, `db.purchase`, and `db.stockTransfer`. Opening stock approvals, manual adjustments, and damage writes are completely omitted. No signed quantity ledger exists.
- **Payment Hard Deletion**: In `backend/src/app/api/v1/payments/[id]/route.ts` (lines 347–349), standalone payments are physically deleted:
  ```ts
  await tx.payment.delete({ where: { id: payment.id } });
  ```
  While invoice-linked payments return 409 (line 288), standalone payments are hard-deleted.
- **Sale Immutability Guard**: In `backend/src/app/api/v1/sales/[id]/route.ts` (lines 94–97), `DELETE` rejects physical deletion of finalized invoices with HTTP 400. `PUT` rejects modification of `COMPLETED` invoices with HTTP 400 (lines 64–66).
- **Recovery Schema Coupling**: `backend/src/lib/backup-format.ts` (lines 12–20) dynamically calculates `schemaHash` and `backupModels` directly from `Prisma.dmmf.datamodel.models`. `tests/recovery.integration.test.ts` (line 83) hardcodes `expect(Object.keys(original.tables)).toHaveLength(43)`.

---

## 2. Logic Chain

### 2.1 Concurrency & Race Mechanics Under Serializable Isolation
1. **Premise**: Under PostgreSQL `Serializable` isolation level, concurrent transactions operating on overlapping data read from snapshot views. When two transactions perform read-then-write or concurrent updates on the same row, one commits and the second encounters a serialization failure (`SQLSTATE 40001`, Prisma code `P2034`).
2. **Current Handling**: `serializable()` catches `P2034` and retries up to 3 times. In `commerceTransaction`, each transaction attempts to update the `Business` record (`tx.business.update`).
3. **Contention on Same Batch**:
   - Consider Product $P$ with Batch $B_1$ having `quantity = 5`.
   - Terminal 1 and Terminal 2 simultaneously issue checkout requests for 4 units from Batch $B_1$.
   - Both transactions acquire connection PIDs and execute `pg_sleep(0.025)`.
   - Terminal 1 commits first: `Batch.quantity` is updated to $5 - 4 = 1$.
   - Terminal 2's transaction fails with `P2034` on conflict, triggering `serializable()` retry attempt 1.
   - On retry attempt 1, Terminal 2 re-reads `Batch.quantity = 1`.
   - Condition `batch.quantity (1) < item.quantity (4)` evaluates to true.
   - Transaction throws `Insufficient batch stock`, rolling back all changes and returning HTTP 400.
4. **Verification Requirement**: Adversarial tests must prove that under high concurrency (e.g., $N=5$ concurrent workers competing for limited batch inventory):
   - Over-selling is mathematically impossible when `preventNegativeStock: true`.
   - When `allowNegativeStock: true`, every decrement is recorded and batch/stock levels project into negative numbers without lost updates.
   - `pg_backend_pid()` must witness at least 2 distinct PostgreSQL processes for each race test.

### 2.2 Financial Reconciliation Invariants
1. **Premise**: Financial and inventory core hardening requires that projections are completely verifiable from append-only event ledgers.
2. **Stock Movement Ledger Invariant**:
   - For any `(businessId, branchId, productId)`:
     $$\text{ProductStock.quantity} \equiv \sum \text{StockMovement.quantity}$$
   - For any batch:
     $$\text{Batch.quantity} \equiv \sum_{\text{batchId}} \text{StockMovement.quantity}$$
   - Every state-mutating operation (Sale, Purchase, OpeningStock, Adjustment, Return, Transfer) must emit a signed `StockMovement` atomically inside the transaction.
3. **Invoice Settlement Invariant**:
   - For any finalized `Sale` (Invoice):
     $$\text{Invoice.total} \equiv \sum \text{PaymentAllocation.amount} - \sum \text{Refund.amount} + \text{RemainingUnpaid}$$
     $$\text{Invoice.paidAmount} \equiv \sum \text{PaymentAllocation.amount} - \sum \text{Refund.amount}$$
   - `Invoice.paymentStatus` must strictly derive:
     - `PAID` if $\text{paidAmount} \ge \text{total}$
     - `PARTIAL` if $0 < \text{paidAmount} < \text{total}$
     - `UNPAID` if $\text{paidAmount} \le 0$
     - `REFUNDED` if settled and refunded in full.
   - Tenders: Applied cash must exclude change ($\text{TenderedCash} = \text{AppliedCash} + \text{Change}$). Credit is accounts receivable (`CustomerLedger.debit`), never a `Payment` row.
4. **Audit & Non-Destructive Lifecycle**:
   - `Payment` and finalized `Sale` entities must reject physical `DELETE`.
   - Soft-deletion requires setting `deletedAt` and creating explicit `PaymentReversal` or `Refund` records.

### 2.3 Recovery & Schema Impact
1. **Premise**: `backupModels` in `backend/src/lib/backup-format.ts` sorts all non-excluded Prisma models topologically.
2. **Impact of Phase 2 Additions**:
   - Adding `PaymentAllocation`, `PaymentReversal`, `Refund`, `StockMovement`, `OutboxEvent` expands the tenant models from 43 to 48.
   - `tests/recovery.integration.test.ts` line 83 (`expect(Object.keys(original.tables)).toHaveLength(43)`) will fail unless updated to reflect the new models.
   - Any new models must define `businessId`, maintain clean foreign-key references without circular dependency, and define `@@unique([businessId, id])`.
   - In `tests/recovery.integration.test.ts` lines 54, `field.type === "Decimal"` must be supported in fixture generation.

---

## 3. Caveats
1. **Docker Daemon Offline**: At the time of this survey, the Docker Desktop daemon was not running on the local host. While unit tests and TypeScript compiler checks run and pass cleanly, PostgreSQL-bound integration suites (`tests/commerce.integration.test.ts`) skip until the isolated container on `127.0.0.1:55439` is started via `npm run restro:db`.
2. **Read-Only Explorer Scope**: In accordance with the Explorer archetype, no source files, migrations, or test files were modified during this survey.
3. **Legacy Migration Adoption**: `scripts/restro-env.mjs` strictly prohibits baseline CREATE against non-empty schemas. Any schema updates must be created as additive migrations (`202611...`).

---

## 4. Conclusion & Recommended Test Architecture

### 4.1 Recommended Test Suite Structure
The Phase 2 testing harness should be partitioned into four distinct, targeted test modules:

```
tests/
├── commerce.integration.test.ts       # Retain existing 14 commerce atomicity & role tests
├── concurrency.integration.test.ts    # Dedicated adversarial race conditions & batch contention
├── reconciliation.integration.test.ts # Financial & inventory ledger reconciliation harnesses
├── financial-decimal.test.ts          # Pure unit tests for Decimal precision, rounding & tenders
├── recovery.integration.test.ts       # Updated to include Phase 2 models in backup/restore
```

### 4.2 Adversarial Concurrency Test Matrix
The dedicated adversarial test suite (`tests/concurrency.integration.test.ts`) must implement the following scenarios against real PostgreSQL (`127.0.0.1:55439`):

| Test Case ID | Test Scenario | Initial Setup | Concurrency Pattern | Expected Outcome |
|---|---|---|---|---|
| **RACE-01** | Exact Batch Exhaustion | Batch $B_1$ qty = 5; `preventNegativeStock = true` | 2 concurrent checkout requests for 4 units from $B_1$ with distinct Idempotency-Keys | Exactly one request returns 201; second request returns 400 (Insufficient stock); remaining Batch qty = 1; remaining ProductStock = 1; exactly one `StockMovement` (-4). |
| **RACE-02** | High-Contention Multi-Terminal Depletion | Batch $B_1$ qty = 10; `preventNegativeStock = true` | 5 concurrent requests for 3 units each (demand = 15) | Exactly 3 requests return 201 (total sold = 9); 2 requests return 400; remaining Batch qty = 1; zero negative stock breaches. |
| **RACE-03** | Concurrent Sales with Allow Negative Stock | Batch $B_1$ qty = 2; `preventNegativeStock = false`, `allowNegativeStock = true` | 2 concurrent requests for 3 units each from $B_1$ | Both requests return 201; remaining Batch qty = -4; ProductStock = -4; two `StockMovement` records (-3 each). |
| **RACE-04** | Concurrent Duplicate Sale Replay (Idempotency) | Batch $B_1$ qty = 5 | 2 concurrent requests with identical `Idempotency-Key` and payload | Both return 201 with identical invoice IDs; exactly 1 Sale record, 1 payment, 1 `StockMovement` (-1); remaining Batch qty = 4. |
| **RACE-05** | Mixed-Cart Atomic Failure Rollback | Product 1 (plenty stock), Product 2 (batch qty = 0) | Concurrent requests attempting mixed checkout | Both items in failed request roll back completely; Product 1 stock remains untouched; zero partial `StockMovement` rows. |
| **RACE-06** | Concurrent Payment Allocation to Same Invoice | Invoice total = 100, unpaid | 2 concurrent manual payments of 60 against the same invoice | Exactly one payment succeeds (paidAmount = 60, status PARTIAL); second payment either succeeds for 40 or rejects exceeding balance; total allocated payments never exceed invoice total. |

### 4.3 Financial Reconciliation Harness Specifications
The reconciliation test harness (`tests/reconciliation.integration.test.ts`) must implement programmatic verification functions:

#### Harness Function 1: `reconcileInventoryLedger(db, businessId, productId, branchId)`
```ts
export async function assertInventoryReconciliation(
  db: PrismaClient,
  businessId: string,
  branchId: string,
  productId: string
) {
  const stock = await db.productStock.findUniqueOrThrow({
    where: { productId_branchId: { productId, branchId } },
  });
  const movementSum = await db.stockMovement.aggregate({
    where: { businessId, branchId, productId },
    _sum: { quantity: true },
  });
  const totalMovements = movementSum._sum.quantity ?? new Prisma.Decimal(0);
  expect(stock.quantity.toString()).toBe(totalMovements.toString());

  // Batch reconciliation
  const batches = await db.batch.findMany({ where: { productId, branchId } });
  for (const batch of batches) {
    const batchMovementSum = await db.stockMovement.aggregate({
      where: { businessId, branchId, productId, batchNumber: batch.batchNumber },
      _sum: { quantity: true },
    });
    const totalBatchMovements = batchMovementSum._sum.quantity ?? new Prisma.Decimal(0);
    expect(batch.quantity.toString()).toBe(totalBatchMovements.toString());
  }
}
```

#### Harness Function 2: `reconcileInvoiceSettlement(db, saleId)`
```ts
export async function assertInvoiceReconciliation(
  db: PrismaClient,
  saleId: string
) {
  const sale = await db.sale.findUniqueOrThrow({
    where: { id: saleId },
    include: { payments: true, paymentAllocations: true, refunds: true },
  });

  const allocatedSum = await db.paymentAllocation.aggregate({
    where: { saleId },
    _sum: { amount: true },
  });
  const refundSum = await db.refund.aggregate({
    where: { saleId },
    _sum: { amount: true },
  });

  const totalAllocated = allocatedSum._sum.amount ?? new Prisma.Decimal(0);
  const totalRefunded = refundSum._sum.amount ?? new Prisma.Decimal(0);
  const netPaid = totalAllocated.minus(totalRefunded);

  expect(sale.paidAmount.toString()).toBe(netPaid.toString());

  if (netPaid.gte(sale.total)) {
    expect(sale.paymentStatus).toBe("PAID");
  } else if (netPaid.gt(0)) {
    expect(sale.paymentStatus).toBe("PARTIAL");
  } else {
    expect(sale.paymentStatus).toBe("UNPAID");
  }
}
```

#### Harness Function 3: `assertNoHardDeleteEnforcement(db, saleId, paymentId)`
- Invokes `DELETE /api/v1/sales/:id` -> asserts status 400 with message `"IRD Compliance: Finalized sales invoices are immutable"`.
- Invokes `DELETE /api/v1/payments/:id` -> asserts that physical record in `Payment` table still exists (`deletedAt` populated or 409 rejection), and that an audit entry is created in `AuditEvent`/`AuditLog`.

---

## 5. Verification Method

### 5.1 Commands to Verify Environment and Test Execution
1. **Typecheck Verification**:
   ```powershell
   npm.cmd run typecheck
   ```
   *Expected*: Exit code 0 across backend and frontend workspaces.

2. **Unit Test Verification**:
   ```powershell
   npm.cmd test
   ```
   *Expected*: All unit tests pass; integration tests skip cleanly if database container is offline.

3. **Database Container Initialization & Verification**:
   ```powershell
   # 1. Start isolated container
   node scripts/restro-env.mjs db

   # 2. Deploy migrations
   node scripts/restro-env.mjs migrate

   # 3. Run integration tests
   node scripts/restro-env.mjs integration

   # 4. Run adversarial race verification (10 rounds with connection witnesses)
   node scripts/restro-env.mjs verify-races
   ```

4. **Independent Invalidation Conditions**:
   - Any race test where `new Set(witness.pids).size < 2` invalidates the test as non-concurrent.
   - Any test where `ProductStock.quantity !== sum(StockMovement.quantity)` invalidates inventory integrity.
   - Any test where `Invoice.paidAmount !== sum(PaymentAllocations) - sum(Refunds)` invalidates financial settlement.
   - Any execution of `db.payment.delete()` or `db.sale.delete()` invalidates audit compliance.

---

### Artifact Index
- `handoff.md`: This comprehensive test survey and verification specification.
- `progress.md`: Liveness heartbeat and milestone tracking log.
- `BRIEFING.md`: Persistent agent briefing memory.
- `DISPATCH.md`: Inbound task directives.
