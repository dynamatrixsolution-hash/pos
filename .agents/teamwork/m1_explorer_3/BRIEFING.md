# BRIEFING — 2026-10-31T22:50:00Z

## Mission
Design unit test suite tests/financial-decimal.test.ts for Milestone 1 (Decimal Testing Specialist).

## 🔒 My Identity
- Archetype: explorer
- Roles: Decimal Testing Specialist
- Working directory: c:\projects\pos\.agents\teamwork\m1_explorer_3
- Original parent: 400403a7-9a87-45bc-97f4-1570296f2846
- Milestone: Milestone 1

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Investigate Prisma.Decimal operations, exact banking/half-even rounding, scale 2 precision, and scale 4 precision for inventory stock.
- Formulate exact test code ready for Worker to implement.
- Verify npm.cmd test / vitest behavior.

## Current Parent
- Conversation ID: 400403a7-9a87-45bc-97f4-1570296f2846
- Updated: 2026-10-31T22:33:00Z

## Investigation State
- **Explored paths**:
  - `ORIGINAL_REQUEST.md`, `PROJECT.md`, `vitest.config.mts`, `package.json`
  - `tests/` (`commerce-policy.test.ts`, `commerce-transaction.test.ts`, `recovery-format.test.ts`, etc.)
  - `packages/db/client/index.js`, `packages/db/prisma/schema.prisma`
  - `backend/src/lib/commerce-policy.ts`, `backend/src/lib/backup-format.ts`
  - Vitest test runner execution and resolution mechanics
- **Key findings**:
  - `Prisma.Decimal` in `@dynapos/db` wraps decimal.js with full arbitrary-precision support.
  - Constant `Prisma.Decimal.ROUND_HALF_EVEN === 6` provides native Banker's Rounding via `.toDecimalPlaces(scale, Prisma.Decimal.ROUND_HALF_EVEN)`.
  - IEEE 754 drift (e.g. `0.1 + 0.2 = 0.30000000000000004`, `0.07 * 100 = 7.000000000000001`) is strictly eliminated using `Prisma.Decimal`.
  - Scale 2 precision (`Decimal(12, 2)`) supports prices, subtotals, taxes, discounts, tender balances, and payment splits with zero penny drift across 10,000 additions.
  - Scale 4 precision (`Decimal(12, 4)`) provides fractional quantities (`0.0001` min unit, `0.1250` kg) and reconciles signed stock movements ($\sum \text{StockMovement.quantity} \equiv \text{ProductStock.quantity}$).
  - All 5 new models (`PaymentAllocation`, `PaymentReversal`, `Refund`, `StockMovement`, `OutboxEvent`) and migrated models (`Sale`, `ProductStock`, `Customer`) can be instantiated and validated with `Prisma.Decimal`.
  - Designed, authored, and fully validated a 33-test suite in `proposed_financial-decimal.test.ts` passing 33/33 in 352ms.
- **Unexplored areas**: None for M1 testing scope.

## Key Decisions Made
- Authored `proposed_decimal-math.ts` providing `toDecimal`, `money`, `stockQty`, `roundHalfEven`, `addMoney`, `subMoney`, `mulMoney`, `divMoney`.
- Authored `proposed_financial-decimal.test.ts` containing 33 unit tests across 6 comprehensive suites.
- Validated test suite via Vitest runner (33 passed in 352ms).
- Formulated exact instructions and file contents for Worker to implement `backend/src/lib/services/decimal-math.ts` and `tests/financial-decimal.test.ts`.

## Artifact Index
- DISPATCH.md — record of incoming dispatch messages
- BRIEFING.md — persistent working memory
- progress.md — liveness heartbeat
- proposed_decimal-math.ts — drop-in implementation of decimal math service
- proposed_financial-decimal.test.ts — validated 33-test suite for `tests/financial-decimal.test.ts`
- handoff.md — 5-component handoff report
