## 2026-11-01T03:39:49Z
From: 98f60f04-06d4-493d-9df7-9f604839d4bc (orchestrator)
Role: Tester Concurrency & Invariants Explorer for Phase 3: Restaurant Staff MVP (Dine-in, Tables, Menus & Orders).

Working Directory: c:\projects\pos\.agents\teamwork\tester_survey_2
Authoritative Original Request: c:\projects\pos\.agents\teamwork\ORIGINAL_REQUEST.md
Specification Documents:
- docs/hospitality/phases/PHASE_3_RESTAURANT_MVP.md
- docs/hospitality/IMPLEMENTATION_PLAN.md
Scripts & Environment References:
- scripts/restro-env.mjs
- scripts/restro-restore-env.mjs
- package.json
- tests/

Your Mission:
Survey and design the verification strategy, test environment architecture, and adversarial test matrix for Phase 3:
1. Environment & Script Architecture:
   - Isolated PostgreSQL container configuration on 127.0.0.1:55439.
   - Verification commands:
     * `npm.cmd run typecheck`
     * `npm.cmd test`
     * `node scripts/restro-env.mjs recovery-test`
     * `node scripts/restro-restore-env.mjs rehearse`
     * `node scripts/restro-env.mjs backend-build`
     * `node scripts/restro-env.mjs frontend-build`
   - Evaluate backup-format and recovery test assertions for Phase 3 restaurant models.
2. Invariants & State Machine Test Matrix:
   - Three-dimensional status independence: Prove that transitioning Settlement (e.g. UNPAID -> PAID) does NOT alter Fulfillment status (e.g. READY remains READY, not SERVED).
   - Multi-round ordering: Submitting Round 2 preserves all Round 1 items, statuses, modifiers, and line totals intact.
   - Atomic Table Move & Table Merge: Verify that moving Table A -> Table B transfers the active TableSession and all orders atomically without duplicating order lines or dropping unserved items. Verify Table Merge combines sessions cleanly.
   - Mandatory audit logging: Voiding or rejecting an order line fails if reason is missing; creates immutable audit record.
   - Immutable price snapshotting: Price changes to MenuItem or ModifierOption in catalog do not affect existing submitted OrderLines.
3. Adversarial Concurrency & Edge Cases:
   - Concurrent terminal operations on the same TableSession (simultaneous item additions, simultaneous move/merge requests).
   - Stale writes against settled or voided lines fail closed (optimistic locking / version checks).
   - Split-billing reconciliation: Test itemized split and equal-shares split with fractional pennies to verify zero penny drift ($\sum \text{splits} \equiv \text{order total}$).
4. Test Architecture & Harness Design:
   - Plan integration test suites in `tests/` (e.g. `tests/restaurant-invariants.integration.test.ts`, `tests/restaurant-concurrency.integration.test.ts`).

Execution Rules:
- You are read-only; DO NOT modify or create any source code or test files.
- Maintain progress in c:\projects\pos\.agents\teamwork\tester_survey_2\progress.md.
- Write your comprehensive test survey report to c:\projects\pos\.agents\teamwork\tester_survey_2\tester_survey_report.md.
- Write your structured 5-component handoff to c:\projects\pos\.agents\teamwork\tester_survey_2\handoff.md.
- Notify the orchestrator upon completion via send_message.
