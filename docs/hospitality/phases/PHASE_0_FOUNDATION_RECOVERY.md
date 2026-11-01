# Phase 0: Baseline Verification & Safe Tenant Recovery

> **Status**: Verified in Working Tree (Local Rehearsal Passed).
> **Dependencies**: None. Foundation for all subsequent phases.

## 1. Objectives
- Establish a reproducible, isolated local development environment.
- Eliminate unsafe live database overwrite paths.
- Deliver an authenticated, encrypted, tenant-isolated backup and recovery mechanism.
- Rehearse disaster recovery on a separate disposable PostgreSQL target (`127.0.0.1:55440`).

## 2. Key Entities & Artifacts
- `TenantBackupArchive`: Versioned envelope with SHA-256 manifest and migration identifier.
- `RequestResult`: Idempotency tracking table.
- `scripts/recover-restro-backup.ts`: Safe recovery CLI tool.
- `scripts/rehearse-recovery.ts`: Automated rehearsal and reconciliation test harness.

## 3. Exit Criteria
- Zero destructive restore paths in production or staff UI.
- All 8 PostgreSQL recovery regression test cases pass cleanly (`recovery-test`).
- Rehearsal reconciliation asserts identical row counts, balance invariants, and rollback safety.
- Complete documentation in `docs/hospitality/RECOVERY_STATUS.md`.

