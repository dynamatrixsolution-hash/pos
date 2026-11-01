# Plan — Phase 2: Financial & Inventory Core Hardening

## Overview
Implement production-grade hardening of the financial and inventory core in RestroPOS according to `docs/hospitality/phases/PHASE_2_FINANCIAL_INVENTORY_CORE.md` and `docs/hospitality/IMPLEMENTATION_PLAN.md`.

## Role Alignment
1. **Planner (Architecture & Invariants)**:
   - Focus: Schema design, Decimal migration, invariants, transactions, immutable ledger guarantees.
2. **Designer (UI/UX Specialist)**:
   - Guided by: `.agent/skill/uiuxskills.md`
   - Focus: Existing frontend components & form adaptation for Decimal numbers, payments, and stock display without creating new dedicated UI screens.
3. **Builder (Full-Stack Engineer)**:
   - Guided by: `.agent/skill/stack.md`
   - Focus: High-quality implementation across Prisma schema, backend service layer, API routes, migrations, and frontend integration.
4. **Tester (Adversarial Security, Concurrency & Financial Reconciliation)**:
   - Focus: Stress testing concurrent sales, race condition exploitation, negative-stock breach attempts, double-spend / over-refund attempts, reconciliation audits against isolated test container (`127.0.0.1:55439`).

## Execution Phases
- **Phase 0: Survey & Spec Mining (Parallel Explorers)**:
  - Planner Explorer: Inspect Prisma schema, backend transaction helpers, financial models, existing migrations.
  - Designer Explorer: Inspect frontend forms, components, payment modals, receipt views, number parsing, UI skills.
  - Tester Explorer: Inspect `scripts/restro-env.mjs`, isolated test database container at `127.0.0.1:55439`, existing Vitest and integration test suites.
- **Phase 1: PROJECT.md Synthesis & Feature Inventory**:
  - Merge Explorer findings into comprehensive Feature Inventory with 100% assignment to milestones.
- **Phase 2: Milestone Iterations (Explorer -> Worker -> Reviewers -> Challengers -> Auditor)**:
  - M1: Prisma Schema & Decimal Migration
  - M2: Payment Lifecycle & Financial Models (PaymentAllocation, PaymentReversal, Refund)
  - M3: Append-Only StockMovement Ledger & Concurrency Isolation
  - M4: Transactional Outbox (OutboxEvent & atomicity)
  - M5: Frontend Component & Form Adaptation
  - M6: Adversarial Concurrency, Financial Reconciliation & Final Verification
- **Phase 3: Exit Criteria & Documentation**:
  - Update `docs/hospitality/phases/PHASE_2_FINANCIAL_INVENTORY_CORE.md`
  - Forensic Victory Audit confirmation
