# Progress - Planner Survey 1

- Completed in-depth architectural and schema survey for Phase 2: Financial & Inventory Core Hardening.
- Completed targets:
  1. Full mapping of all 57 monetary Float fields across 22 models to `Decimal(12, 2)`.
  2. Full Prisma schema design for 5 new models: `PaymentAllocation`, `PaymentReversal`, `Refund`, `StockMovement`, `OutboxEvent`.
  3. Identified financial immutability invariants: disallowing hard payment deletion in `payments/[id]/route.ts` and mandating audited offset records.
  4. Formulated concurrency and stock isolation invariants: serializable transactions, negative-stock enforcement, and reconciliation against `ProductStock` projections.
  5. Delivered detailed decomposition, dependency graph, non-destructive migration roadmap, and frontend Decimal compatibility rules (R6).
- Completed 5-component `handoff.md`.
- Updated `BRIEFING.md`.

Last visited: 2026-10-31T22:31:00Z
