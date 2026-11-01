## 2026-10-31T14:40:13Z

The user wants to organize work using a specialized multi-agent structure (Planner, Designer, Builder, Tester) where the Planner plans how to complete each phase, the Designer designs UI/UX and stack specifications based on `.agent/skill/uiuxskills.md` and `.agent/skill/stack.md`, the Builder implements it, and the Tester tests security, database concurrency/invariants, and frontend rendering, completing each phase properly before moving to the next. Start with `docs/hospitality/phases/PHASE_0_FOUNDATION_RECOVERY.md`, review and verify Phase 0 criteria, identify any remaining gaps for the Phase 0 gate (e.g. cluster-level backup/PITR documentation, operator procedures), and evaluate readiness to proceed to Phase 1.

Working directory: c:\projects\pos
Integrity mode: development

## Requirements

### R1. Phase 0 Verification and Gap Audit
Review and verify Phase 0 criteria in `docs/hospitality/phases/PHASE_0_FOUNDATION_RECOVERY.md` against current repository state (`scripts/recover-restro-backup.ts`, `scripts/rehearse-recovery.ts`, `tests/recovery.integration.test.ts`, and `docs/hospitality/RECOVERY_STATUS.md`). Execute automated recovery rehearsal and test suites against the local loopback test database containers. Audit the exit criteria and identify any remaining gaps for the Phase 0 gate (such as cluster-level backup/PITR documentation and operator procedures).

### R2. Phase 0 Gate Assessment and Phase 1 Readiness Report
Produce a Phase 0 verification and readiness report documenting the status of all Phase 0 exit criteria, automated test and rehearsal execution outputs, an itemized assessment of remaining gaps/release blockers (including cluster-level backup/PITR documentation and operator procedures), and an explicit go/no-go recommendation for advancing to Phase 1.

## Acceptance Criteria

### Verification
- [ ] `node scripts/restro-restore-env.mjs rehearse` passes all 41 rehearsal checks on the disposable target container (`127.0.0.1:55440`) with exit code 0.
- [ ] `node scripts/restro-env.mjs recovery-test` executes and passes all 8 recovery integration test cases with 0 failures and 0 skips.
- [ ] `npm.cmd run typecheck` passes with exit code 0 for both frontend and backend.
- [ ] `node node_modules/vitest/vitest.mjs run --exclude tests/commerce.integration.test.ts --exclude tests/recovery.integration.test.ts` executes and passes unit test suites with exit code 0.

### Deliverables
- [ ] A written Phase 0 verification and readiness report detailing:
  - Exact command outputs from the verification test suites above.
  - Line-by-line verification status against each exit criterion in `docs/hospitality/phases/PHASE_0_FOUNDATION_RECOVERY.md`.
  - Itemized audit of remaining gaps and release blockers identified in `docs/hospitality/RECOVERY_STATUS.md` and `docs/hospitality/IMPLEMENTATION_PLAN.md` (e.g. cluster-level backup/PITR documentation, operator procedures, credential handling).
  - Explicit readiness evaluation and go/no-go recommendation for advancing to Phase 1.
