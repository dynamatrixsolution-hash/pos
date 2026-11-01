# Milestone 1 Handoff Report: Core Schema & Decimal Migration

## 1. Observation
- **Schema Migration**:
  - `packages/db/prisma/schema.prisma`: Converted all 57 monetary `Float` columns across 22 models to `Decimal @db.Decimal(12, 2)`. Preserved optional/nullability on `Batch.costPrice` and `Batch.sellPrice`.
  - Added 5 new models with exact composite foreign keys, tenant scoping, indices, and reverse relations:
    1. `PaymentAllocation` (`allocatedAmount Decimal @db.Decimal(12, 2)`)
    2. `PaymentReversal` (`amount Decimal @db.Decimal(12, 2)`)
    3. `Refund` (`amount Decimal @db.Decimal(12, 2)`)
    4. `StockMovement` (`quantity Decimal @db.Decimal(12, 4)`)
    5. `OutboxEvent` (`topic`, `eventType`, `payload Json`, `status`, `retryCount`)
  - Reverse relations added to `Business`, `Branch`, `User`, `Product`, `Payment`, `Sale`, `Purchase`, and `Customer`.
  - Prisma client generated cleanly via `npm.cmd run prisma:generate`.

- **SQL Migration**:
  - `packages/db/prisma/migrations/202610310002_phase2_financial_inventory_core/migration.sql`:
    - Safely converts 57 existing columns using `TYPE DECIMAL(12, 2) USING ROUND("column"::numeric, 2)`.
    - Creates tables `"PaymentAllocation"`, `"PaymentReversal"`, `"Refund"`, `"StockMovement"`, `"OutboxEvent"`.
    - Creates indexes and foreign keys.
    - Idempotently backfills default baseline records for `allowNegativeStock: false`.

- **Decimal Math Service**:
  - `backend/src/lib/services/decimal-math.ts`:
    - Exported `DecimalMathError`, `toDecimal`, `roundHalfEven`, `money`, `stockQty`, `addMoney`, `subMoney`, `mulMoney`, `divMoney`.
    - Implements IEEE 754-2008 banker's rounding (`ROUND_HALF_EVEN`) to 2 decimal places for currency, 4 decimal places for inventory quantities.
    - Validates finite numbers, rejects negative values where disallowed, rejects division by zero.

- **Backup Format Validation**:
  - `backend/src/lib/backup-format.ts`: Updated `validateSnapshot()` to accept both `string` (serialized decimal representation) and `number` for monetary fields, validating that strings represent valid finite decimal numbers.

- **Unit & Integration Tests**:
  - `tests/financial-decimal.test.ts`: Created with 33 test cases covering Decimal conversion, banker's rounding, edge cases (0.005, 0.015, negative rounding), arithmetic operations, division by zero, invalid input handling, and inventory stock quantity scaling.
  - `tests/recovery.integration.test.ts` & `scripts/rehearse-recovery.ts`: Updated total model count to 48 (`const MODEL_COUNT = 48`), updated fixture generators to supply valid Decimal fields for all 48 models, and converted equality assertions to `Number(...)` wrappers.
  - `tests/commerce.integration.test.ts`: Updated monetary field assertions (`paidAmount`, `amount`, `balance`, `debit`, `credit`) to wrap in `Number(...)` when comparing Prisma `Decimal` instances with numeric literals.

- **Verification Tool Runs**:
  - `node scripts/restro-env.mjs migrate`: Applied `202610310002_phase2_financial_inventory_core` successfully to PostgreSQL on `127.0.0.1:55439`.
  - `npm.cmd run typecheck`: Passed with exit code 0 (`tsc -p backend/tsconfig.json --noEmit --incremental false && tsc -p frontend/tsconfig.json --noEmit --incremental false`).
  - `npm.cmd test`: Passed with exit code 0. Result: `7 passed | 3 skipped (10 test files), 63 passed | 36 skipped (99 tests)`.
  - `node scripts/restro-env.mjs integration`: Passed with exit code 0. Result: `14 passed (14 tests)`.
  - `node scripts/restro-env.mjs recovery-test`: Passed with exit code 0. Result: `8 passed (8 tests)`.

## 2. Logic Chain
1. *Observation*: Prisma generates `Prisma.Decimal` (wrapping `decimal.js`) objects for `Decimal` columns instead of native JavaScript numbers.
2. *Inference*: Existing backend API routes using arithmetic operators (`+`, `-`, `*`, `/`) or comparison operators (`>`, `<`) on Prisma record properties would fail TypeScript compilation (TS2362, TS2365).
3. *Action*: Inspected all backend route files flagged by `tsc`. Applied `Number(field)` where numeric arithmetic/aggregation was used for reporting/calculation, or invoked Decimal operations directly (`.add()`, `.toNumber()`).
4. *Observation*: Vitest's `expect(val).toBe(literal)` performs strict reference/primitive comparison (`Object.is`). Prisma's returned model attributes for monetary fields are `Prisma.Decimal` instances rather than numbers, causing `toBe(100)` to fail when received is `Decimal("100")`.
5. *Action*: Updated assertions in `tests/commerce.integration.test.ts` and `tests/recovery.integration.test.ts` to convert Decimal fields via `Number(...)` or check deep equality appropriately.
6. *Result*: Full TypeScript compilation passed cleanly without any type errors or lint disable workarounds. All unit, integration, and tenant recovery tests executed and passed against real PostgreSQL.

## 3. Caveats
- No changes were made to frontend UI formatting beyond existing numeric inputs. Future milestones will utilize the Decimal serialization from backend responses.
- In `Batch`, `costPrice` and `sellPrice` remain nullable `Decimal? @db.Decimal(12, 2)` to preserve backwards compatibility with batches created without explicit cost or sell overrides.
- In `StockMovement`, quantity is `Decimal(12, 4)` to support fractional unit measurements (e.g. kg/liters), while `Batch.quantity` remains Float as designed in the schema specifications.

## 4. Conclusion
Milestone 1 is complete:
- 57 monetary fields migrated to `Decimal(12, 2)`.
- 5 new models created with full reverse relations and composite keys.
- Additive SQL migration script deployed to the database.
- `backend/src/lib/services/decimal-math.ts` fully implemented and verified.
- Monorepo typecheck is clean (exit code 0).
- All 63 unit tests, 14 commerce integration tests, and 8 recovery tests pass cleanly against PostgreSQL.

## 5. Verification Method
To independently verify Milestone 1:
1. Monorepo Typecheck:
   ```powershell
   npm.cmd run typecheck
   ```
   *Expected*: Exits 0 with zero errors for both backend and frontend.

2. Unit Test Suite:
   ```powershell
   npm.cmd test
   ```
   *Expected*: Exits 0; 7 test files pass (including `tests/financial-decimal.test.ts` with 33 tests).

3. Containerized Commerce Integration Tests:
   ```powershell
   node scripts/restro-env.mjs integration
   ```
   *Expected*: Exits 0; 14 tests pass.

4. Containerized Recovery Integration Tests:
   ```powershell
   node scripts/restro-env.mjs recovery-test
   ```
   *Expected*: Exits 0; 8 tests pass covering all 48 models.
