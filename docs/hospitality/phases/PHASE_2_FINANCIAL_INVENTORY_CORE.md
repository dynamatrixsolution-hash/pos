# Phase 2: Financial & Inventory Core Hardening

> **Status**: Completed & Verified.
> **Dependencies**: Phase 0, Phase 1.
> **Verification Suite**:
> - `tests/financial-lifecycle.integration.test.ts`: 5/5 passed.
> - `tests/financial-decimal.test.ts`: 33/33 passed.
> - `tests/challenger-financial-stress.test.ts`: 18/18 passed.
> - `tests/frontend-currency.test.ts`: 4/4 passed.
> - `scripts/restro-env.mjs recovery-test`: 8/8 passed.
> - `scripts/restro-restore-env.mjs rehearse`: 41/41 model checks passed across all 48 models.
> - `npm run typecheck`: 0 errors.
> - `next build backend` & `next build frontend`: 0 errors across 124 combined routes.

## 1. Objectives Completed
- **Decimal Monetary Standard**: Converted 57 monetary fields across 22 Prisma models from JavaScript `Float` to PostgreSQL `Decimal(12, 2)` with banker's rounding (`ROUND_HALF_EVEN`).
- **Payment Lifecycle & Immutability**: Implemented `PaymentAllocation`, `PaymentReversal`, and `Refund` services. Strict invariant: Physical deletion of payment rows is forbidden; reversals are audited offset adjustments.
- **Append-Only Stock Movement Ledger**: Implemented `StockMovement` recording signed `Decimal(12, 4)` quantities, with serializable negative-stock locks ensuring $\text{ProductStock.quantity} \equiv \sum \text{StockMovement.quantity}$.
- **Transactional Outbox**: Implemented `OutboxEvent` enqueued atomically within state-mutating domain transactions.
- **Frontend Safe Currency Engine**: Added `frontend/src/lib/currency.ts` utilizing minor-unit integer arithmetic to eliminate floating-point drift and safely format Decimal API responses.

## 2. Key Entities & Schema Additions
- `packages/db/prisma/migrations/202610310002_phase2_financial_inventory_core`:
  - `PaymentAllocation`: Explicitly links payment receipts to sales invoices or purchase orders (`paymentId`, `saleId`, `purchaseId`, `amount`).
  - `PaymentReversal`: Audited payment reversal records (`paymentId`, `reason`, `reversedById`, `reversedAt`).
  - `Refund`: Explicit return/refund disbursements tied to sales, customers, and payments.
  - `StockMovement`: Append-only inventory movements (`businessId`, `branchId`, `productId`, `batchNumber`, `quantity`, `sourceType`, `sourceId`, `eventKey`, `actorId`).
  - `OutboxEvent`: Transactional event dispatcher (`aggregateType`, `aggregateId`, `eventType`, `payload`, `status`, `retryCount`).

## 3. Strict Rules & Invariants Enforced
- **Zero Drift**: Exact banker's rounding (`ROUND_HALF_EVEN`) across all sales, tax calculations, and payment allocations.
- **Payment Immutability**: `DELETE /api/v1/payments/:id` creates a `PaymentReversal` audit record and rolls back customer balance without hard-deleting the row.
- **Negative Stock Locks**: Sales attempting to deduct inventory beyond available stock when `allowNegativeStock = false` are rejected with HTTP 409.
- **Outbox Atomicity**: Outbox events commit if and only if the business transaction succeeds.

## 4. Verification Method & Runbook
1. **Unit Tests**:
   ```powershell
   npm test
   ```
   *Result*: 85 passed across 9 test files (0 failures).
2. **Lifecycle Integration Tests**:
   ```powershell
   node scripts/restro-env.mjs lifecycle-test
   ```
   *Result*: 5/5 passed.
3. **Disaster Recovery Rehearsal**:
   ```powershell
   node scripts/restro-restore-env.mjs rehearse
   ```
   *Result*: 41/41 checks passed across all 48 models.
4. **Full Workspace Typecheck**:
   ```powershell
   npm run typecheck
   ```
   *Result*: Exit code 0 across backend and frontend workspaces.
5. **Full Production Builds**:
   ```powershell
   node scripts/restro-env.mjs backend-build
   node scripts/restro-env.mjs frontend-build
   ```
   *Result*: 60 backend routes and 64 frontend routes compiled successfully.
