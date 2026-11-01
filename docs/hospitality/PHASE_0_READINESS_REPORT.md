# Phase 0 Verification and Readiness Report: Foundation Recovery & System Gate Assessment

**Document**: `docs/hospitality/PHASE_0_READINESS_REPORT.md`  
**Date**: 2026-10-31  
**Milestone**: Phase 0 Foundation Recovery Verification & Gate Assessment  
**Author**: Verification & Readiness Specialist (`teamwork_worker_phase0_report_1`)  
**Repository State**: Git Working Tree on branch `restro` (Hardening Checkpoint `6078e686f84a2e5389bccb27bb4bc2a997b004d9`)  
**Authoritative Specifications**:
- `docs/hospitality/phases/PHASE_0_FOUNDATION_RECOVERY.md`
- `docs/hospitality/RECOVERY_STATUS.md`
- `docs/hospitality/IMPLEMENTATION_PLAN.md`
- `docs/hospitality/HARDENING_STATUS.md`
- `docs/hospitality/LOCAL_DEVELOPMENT.md`
- `.agent/skill/uiuxskills.md`
- `.agent/skill/stack.md`
- `.agents/teamwork/ORIGINAL_REQUEST.md`

---

## 1. Executive Summary & Explicit Go/No-Go Recommendation

### 1.1 Dual Gate Evaluation Matrix

An exhaustive technical, architectural, and operational evaluation of the Phase 0 foundation recovery implementation was performed across repository code, container infrastructure, test suites, and operational contracts. The gate decision strictly differentiates between application development progression and production release readiness:

```
+--------------------------------------------------------------------------------------------------------------------------+
|                                              PHASE 0 GATE EVALUATION MATRIX                                              |
+---------------------------------------------------+-----------------------------------+----------------------------------+
| Gate Dimension                                    | Status                            | Primary Rationale                |
+---------------------------------------------------+-----------------------------------+----------------------------------+
| Phase 1 Development Progression                   | CONDITIONAL GO                    | Core code foundation verified;   |
| (Security Foundation & Multi-Tenant Boundaries)   | (Approved to Proceed)             | 41/41 rehearsal checks pass;     |
|                                                   |                                   | 8/8 recovery tests pass;         |
|                                                   |                                   | 30/30 unit tests pass;           |
|                                                   |                                   | Typecheck 0 errors;              |
|                                                   |                                   | Destructive overwrites excised.  |
+---------------------------------------------------+-----------------------------------+----------------------------------+
| Production Release Readiness                      | HARD NO-GO                        | Layer 1 cluster PITR missing;    |
| (Live Customer Data / Production Deployment)      | (Blocked by Release Prerequisites)| Key escrow/rotation missing;     |
|                                                   |                                   | Offsite replication missing;     |
|                                                   |                                   | Operator runbooks unapproved;    |
|                                                   |                                   | Windows NTFS ACLs unhardened;    |
|                                                   |                                   | Float currency schema active.    |
+---------------------------------------------------+-----------------------------------+----------------------------------+
```

### 1.2 Recommendation Rationale

#### 1. Phase 1 Development Progression: CONDITIONAL GO (Approved to Proceed)
- **Safe Development Boundary**: All Phase 1 development activities will be executed within the guarded loopback development environment (`127.0.0.1:55439/restro_test`). Environment launchers (`scripts/restro-env.mjs`, `scripts/database-verification.mjs`) enforce strict port, hostname, and database name validation, preventing accidental execution against remote or production databases.
- **Eradication of Destructive Paths**: The critical data-loss hazard present in baseline code—where `BackupService.executeRestore` deleted payments, stocks, batches, and unexported records—has been permanently eliminated. `BackupService.executeRestore` throws HTTP 409, the API rejects restore commands, and the UI provides honest read-only metadata without destructive upload/restore controls.
- **Verified Recovery Engine (Layer 2)**: The tenant logical recovery engine (Format v2) encapsulates all 41 Prisma tenant models into an authenticated AES-256-GCM envelope bound to the generated schema hash and finished migration lineage. Cross-cluster recovery rehearsal against an independent disposable PostgreSQL container (`127.0.0.1:55440`) verifies 100% row-level fidelity, balance invariance, and rollback atomicity.
- **Preconditions for Phase 1**:
  1. All work must remain on the isolated development database (`127.0.0.1:55439`).
  2. No live schema alterations may bypass the Prisma migration workflow.
  3. Pre-flight checks must ensure no background dev server contends with `AuditLog` during automated test runs.

#### 2. Production Release Readiness: HARD NO-GO (Blocked by Operational Prerequisites)
- **Layer 1 Disaster Recovery Missing**: As documented in `RECOVERY_STATUS.md`, tenant logical recovery (Layer 2) can only re-create an absent tenant within a healthy, identical database cluster. It **cannot** recover from a lost server, corrupted storage volume, or compromised database cluster. Full cluster-level physical base backups and continuous WAL archiving (Point-In-Time Recovery / PITR) are **not implemented**.
- **Operational Prerequisites Unmet**: Production deployment requires:
  1. Documented and rehearsed Layer 1 PITR with business-approved Recovery Point Objective (RPO < 5 min) and Recovery Time Objective (RTO < 30 min).
  2. Multi-custodian encryption key escrow and rotation procedures (current implementation relies on a single static 32-byte hex key without key versioning).
  3. Automated off-host encrypted storage replication with retention schedules (backups currently default to local `scratch/restro-backups`).
  4. Formally signed-off production disaster cutover runbooks (current tooling is hard-coded to refuse non-loopback connections).
  5. Windows NTFS Access Control Lists (ACLs) to replace ineffective POSIX octal file modes (`0o600` / `0o700`).
  6. Migration from IEEE 754 `Float` to arbitrary-precision `Decimal` for all currency amounts (scheduled for Phase 2).

---

## 2. Exact Verification Test Suite Execution Outputs

The Phase 0 verification suite comprises four deterministic commands covering cross-cluster recovery rehearsal, PostgreSQL transaction regression, full-workspace TypeScript compilation, and pure unit policies. All four commands pass with exit code `0`.

### 2.1 Verification Command Matrix

| # | Command | Target / Scope | Passed / Total | Skips | Exit Code | Verified Duration |
|---|---|---|---|---|---|---|
| **1** | `node scripts/restro-restore-env.mjs rehearse` | Disposable restore container (`127.0.0.1:55440`) vs Source (`127.0.0.1:55439`) | **41 / 41 checks** | `0` | `0` | ~7.4s – 12.8s |
| **2** | `node scripts/restro-env.mjs recovery-test` | Isolated dev DB (`127.0.0.1:55439`) regression suite (`tests/recovery.integration.test.ts`) | **8 / 8 tests** | `0` | `0` | ~3.8s – 4.2s |
| **3** | `npm.cmd run typecheck` | Backend (`backend/tsconfig.json`) & Frontend (`frontend/tsconfig.json`) | **0 errors** | `0` | `0` | ~16.5s |
| **4** | `node node_modules/vitest/vitest.mjs run --exclude tests/commerce.integration.test.ts --exclude tests/recovery.integration.test.ts` | 6 unit test files (pure policies, format validation, session authority, target guards) | **30 / 30 tests** | `0` | `0` | ~4.1s |

---

### 2.2 Detailed Execution: Command 1 (`rehearse`)

- **Execution Command**: `node scripts/restro-restore-env.mjs rehearse`
- **Underlying Script**: Spawns `node node_modules/tsx/dist/cli.mjs scripts/rehearse-recovery.ts` via `spawnSync` with stdio inherited.
- **Target Topology**:
  - Source Database: `127.0.0.1:55439/restro_test` (User: `restro_dev`, Volume: `prayassh-restro_restro_dev_data`)
  - Target Database: `127.0.0.1:55440/restro_restore` (User: `restro_restore`, Volume: `prayassh-restro-restore_restro_restore_data`)
- **Synthetic Fixture Volume**: Seedes Tenant A with rows across all 41 Prisma tenant models, plus realistic volume: 3 batch-tracked products, 4 sales (paid, partial, unpaid), 3 customer ledger entries, 3 audit entries, 2 request deduplication rows (70 rows total, 44,736-byte encrypted archive). Tenant B seeded in source; Tenant C pre-seeded in target as unrelated tenant.
- **Itemized Breakdown of the 41 Rehearsal Checks**:
  1. `source and target are different PostgreSQL clusters, databases and roles` — **PASS** (verified `system_identifier`, `current_database()`, `current_user`).
  2. `target migration history equals source (names and checksums)` — **PASS** (`202610300001_retail_baseline`, `202610300002_commerce_hardening`).
  3. `target holds no trace of the tenant to recover or of tenant B` — **PASS** (`target.business.count === 0`).
  4. `archive covers all 41 tenant models and only tenant A` — **PASS** (70 rows, 44,736 bytes).
  5. `archive is encrypted and carries the migration identity` — **PASS** (zero plaintext strings, migration array verified).
  6. `backup status never claims restore verification` — **PASS** (`verified: false`, `recoveryStatus: "NOT_REHEARSED"`).
  7. `source database byte-for-byte unchanged by backup` — **PASS** (pre/post MD5 table fingerprint equal).
  8. `negative refusal: corrupted ciphertext` — **PASS** (flipped bit rejected by AES-256-GCM auth tag; target untouched).
  9. `negative refusal: truncated archive` — **PASS** (sliced payload rejected; target untouched).
  10. `negative refusal: tampered manifest counts` — **PASS** (incremented Payment count in AAD rejected; target untouched).
  11. `negative refusal: wrong encryption key` — **PASS** (random 32-byte key rejected by decipher; target untouched).
  12. `negative refusal: legacy plaintext JSON` — **PASS** (`{"sales":[]}` rejected as invalid format).
  13. `negative refusal: incompatible schema hash` — **PASS** (`0000...` schemaHash rejected before database writes).
  14. `negative refusal: incompatible migration history` — **PASS** (unknown future migration rejected with 409 inside restore transaction).
  15. `negative refusal: missing model in manifest` — **PASS** (omitted Payment table rejected during snapshot sealing).
  16. `negative refusal: mismatched tenant identity` — **PASS** (Tenant B ID requested for Tenant A archive rejected).
  17. `negative refusal: path traversal ../` — **PASS** (`../outside.pbackup` rejected by filename validator).
  18. `negative refusal: path traversal ..\\` — **PASS** (`..\outside.pbackup` rejected by filename validator).
  19. `negative refusal: absolute path in filename` — **PASS** (full path rejected by filename validator).
  20. `negative refusal: embedded traversal` — **PASS** (`${filename}/../../${filename}` rejected).
  21. `negative refusal: non-UUID filename` — **PASS** (`backup-not-a-uuid.pbackup` rejected).
  22. `negative refusal: Windows reserved device name` — **PASS** (`nul` rejected).
  23. `negative refusal: empty filename` — **PASS** (`""` rejected).
  24. `negative refusal: nonexistent file` — **PASS** (valid UUID not on disk rejected as unavailable).
  25. `negative refusal: symlink escape` — **PASS** (symlink escaping backup directory rejected by `lstat`/`realpath`).
  26. `negative refusal: oversized archive` — **PASS** (> 64 MiB rejected on file stat).
  27. `restore recorded exactly one recovery audit entry` — **PASS** (action `BACKUP_RESTORE`, role `RECOVERY_OPERATOR`).
  28. `entity counts equal for all 41 models` — **PASS** (70 rows restored across all 41 models).
  29. `every restored row equals its source row (IDs, timestamps, values, SQL-vs-JSON nulls)` — **PASS** (field-by-field equality).
  30. `invoice, payment, balance, ledger, stock and batch totals identical source vs target` — **PASS** (independent SQL queries match: saleTotal 4455.99, salePaid 2075.25, paymentTotal 2075.25, customerBalance 2380.74, supplierBalance 75.50, stockQuantity 50.0).
  31. `target invariants hold: payments match paidAmount, stock matches batches, receivable matches customer balance, no orphans` — **PASS** (violation count 0).
  32: `source satisfies the same invariants` — **PASS** (synthetic fixture internally consistent).
  33. `expected synthetic totals: receivable 2380.74, payments 2075.25, stock 50 across products` — **PASS**.
  34. `audit history and request-deduplication records preserved` — **PASS** (4 audit rows, 3 request-result rows).
  35. `unrelated tenant C in the target is untouched` — **PASS** (all 41 models, every row, JSON null markers identical).
  36. `tenant B (never restored) has no rows in the target` — **PASS** (0 rows in Business and Sale).
  37. `restore wrote only the recovered tenant's tables` — **PASS** (fingerprint diff limited to restored tenant).
  38. `refused without writes: second restore of an already-present tenant` — **PASS** (HTTP 409, no overwrite).
  39. `target fingerprint before the first recovery equals its state before any negative case` — **PASS**.
  40. `source database unchanged after the whole backup + restore + negative sequence` — **PASS**.
  41. `source returned exactly to its pre-rehearsal content after generated-ID cleanup` — **PASS**.
- **Verified Output Summary**:
  ```
  PASS  source and target are different PostgreSQL clusters, databases and roles — source restro_test / target restro_restore
  PASS  target migration history equals source (names and checksums) — 202610300001_retail_baseline, 202610300002_commerce_hardening
  PASS  target holds no trace of the tenant to recover or of tenant B
  PASS  archive covers all 41 tenant models and only tenant A — 70 rows, 44736 bytes
  ...
  PASS  source returned exactly to its pre-rehearsal content after generated-ID cleanup

  Rehearsal: 41/41 checks passed; timings ms {"seedSource":373,"seedTargetUnrelatedTenant":309,"capture":210,"backupWrite":156,"loadAndValidateArchive":4,"restoreTransaction":225,"postRestoreCapture":251,"totalRehearsal":7428}; report scratch\rehearsal-results-6dde610b-3620-467b-9170-5fed9adb0efb.json
  ```
- **Exit Code**: `0`

---

### 2.3 Detailed Execution: Command 2 (`recovery-test`)

- **Execution Command**: `node scripts/restro-env.mjs recovery-test`
- **Underlying Script**: Spawns `node scripts/run-recovery-tests.mjs`, invoking Vitest 5.0.5 on `tests/recovery.integration.test.ts` with `RESTRO_REQUIRE_DATABASE_TESTS="true"`.
- **Pass Criteria**: Exactly 8 test cases executed; 0 failures; 0 skips.
- **Itemized Test Case Breakdown**:
  - **R1**: Captures all 41 tenant models; authenticates encrypted archives without claiming rehearsal (`verified: false`, `recoveryStatus: "NOT_REHEARSED"`).
  - **R2**: Rejects live overwrite (409), path traversal (`../outside.json`), foreign tenant IDs, wrong encryption keys, and tampered manifest counts without database writes.
  - **R3**: Rejects incomplete manifests (missing Payment table), duplicate IDs, and foreign references prior to database write attempts.
  - **R4**: Late audit failure atomicity. Attaches a PostgreSQL trigger on `AuditLog` that aborts on `BACKUP_RESTORE`. Asserts that the entire transaction aborts, leaving 0 persisted rows across all 41 models and `RequestResult`.
  - **R5**: Recovers balances, payments, stock, batches, history, IDs, and SQL-vs-JSON nulls exactly. Appends exactly one `BACKUP_RESTORE` audit log. Rejects secondary restore with 409.
  - **R6**: Concurrent committed financial changes cannot tear the repeatable-read snapshot. Proves MVCC snapshot isolation while a concurrent connection commits sales, payments, and ledger modifications.
  - **R7**: Backup HTTP endpoint (`/api/v1/settings/backup`) uses current database authority. Unauthenticated requests return 401; non-owner staff returns 403; live restore returns 409 without database modifications.
  - **R8**: Captures a deterministic, sorted SQL-null manifest even with many null-JSON rows (validates `ORDER BY "id"` fix across unordered heap allocations).
- **Verified Output Log**:
  ```
   RUN  v5.0.5 C:/projects/pos

   ✓ tests/recovery.integration.test.ts (8 tests) 3840ms
     ✓ PostgreSQL tenant recovery (8)
       ✓ R1 captures all 41 tenant models and authenticates encrypted archives without claiming rehearsal 18ms
       ✓ R2 rejects live overwrite, path traversal, foreign tenant, wrong key and tampered archives without writes 157ms
       ✓ R3 rejects incomplete manifests, duplicate IDs and foreign references before database writes 163ms
       ✓ R4 late audit failure rolls back every recovered table, including orphan-capable idempotency rows 541ms
       ✓ R5 recovers balances, payments, stock, batches, all history, IDs and SQL-vs-JSON nulls exactly 422ms
       ✓ R6 concurrent committed financial changes cannot tear the repeatable-read snapshot 59ms
       ✓ R7 backup HTTP boundary uses current database authority and refuses legacy restore without effects 510ms
       ✓ R8 captures a deterministic, sorted SQL-null manifest even with many null-JSON rows 309ms

   Test Files  1 passed (1)
        Tests  8 passed (8)
     Start at  20:33:32
     Duration  4.18s (tests 98%, import 1%, transform 1%)

  JSON report written to C:/projects/pos/scratch/recovery-results-b8e05470-8404-483a-932b-b3e8c36b9a43.json
  Recovery verification: 8 passed, zero skipped.
  ```
- **Exit Code**: `0`

#### Concurrency Diagnosis: PostgreSQL Deadlock Hazard (`40P01` on `AuditLog`)
During technical exploration, a critical concurrency hazard was diagnosed when executing `recovery-test` while an active Next.js development server (`npm run restro:dev` / `scripts/restro-env.mjs dev`) was running concurrently in the background:
- **Observed Failure**:
  ```
  PrismaClientKnownRequestError: Raw query failed. Code: `40P01`. Message: `ERROR: deadlock detected
  DETAIL: Process 41315 waits for AccessExclusiveLock on relation 16693 of database 16384; blocked by process 41314.
  Process 41314 waits for AccessExclusiveLock on relation 16693 of database 16384; blocked by process 41315.`
  at tests/recovery.integration.test.ts:129:7
  await db.$executeRawUnsafe(`DROP TRIGGER "${trigger}" ON "AuditLog"`);
  ```
- **Root Cause Analysis**: Test R4 verifies rollback atomicity by dynamically installing a temporary failure trigger on `AuditLog` (`CREATE TRIGGER ... BEFORE INSERT ON "AuditLog"`) and dropping it in a `finally` block (`DROP TRIGGER ... ON "AuditLog"`). In PostgreSQL, creating or dropping a trigger requires an `AccessExclusiveLock` on the target relation. If the background dev server or any other concurrent process executes queries touching `AuditLog` (e.g. background polling or API requests), PostgreSQL encounters a lock inversion and raises deadlock error `40P01`. Because R4 rolled back prematurely, subsequent tests R5–R8 encountered missing fixtures and cascaded into false failures.
- **Operational Pre-flight Protocol**:
  1. **Rule**: Before executing `node scripts/restro-env.mjs recovery-test`, terminate or suspend all background development servers (`npm run restro:dev`, `scripts/restro-env.mjs dev`, or Next.js processes).
  2. **Active Query Inspection**: Verify no lingering active connections exist using:
     ```powershell
     docker exec prayassh-restro-restro-db-1 psql -U restro_dev -d restro_test -c "SELECT pid, state, query FROM pg_stat_activity WHERE state != 'idle';"
     ```
  3. When run in isolation, all 8 tests pass reliably with zero flakiness.

---

### 2.4 Detailed Execution: Command 3 (`typecheck`)

- **Execution Command**: `npm.cmd run typecheck`
- **Underlying Scripts**: Defined in `package.json`:
  ```json
  "typecheck": "tsc -p backend/tsconfig.json --noEmit --incremental false && tsc -p frontend/tsconfig.json --noEmit --incremental false"
  ```
- **Configuration & Integrity**:
  - `--incremental false` ensures no stale `.tsbuildinfo` caches mask type discrepancies between packages.
  - Compiles backend Next.js application, API routes, library services, and `@dynapos/db` Prisma client types.
  - Compiles frontend Next.js application, React 19 client components, dashboards, and shared interfaces.
- **Verified Output Log**:
  ```
  > restroinn@1.0.0 typecheck
  > tsc -p backend/tsconfig.json --noEmit --incremental false && tsc -p frontend/tsconfig.json --noEmit --incremental false
  ```
- **Diagnostics**: 0 errors, 0 warnings.
- **Exit Code**: `0` (Duration: ~16.5s).

---

### 2.5 Detailed Execution: Command 4 (Isolated Unit Suites)

- **Execution Command**:
  ```powershell
  node node_modules/vitest/vitest.mjs run --exclude tests/commerce.integration.test.ts --exclude tests/recovery.integration.test.ts
  ```
- **Underlying Configuration**: `vitest.config.mts` configured with `resolve.alias: { "@": "./backend/src" }`, `environment: "node"`, and `fileParallelism: false`.
- **Scope & Verified Test Files (30 tests across 6 files)**:
  1. `tests/browser-request.test.ts` (4 tests): Idempotency key generation, local storage response caching, actor isolation, response replay.
  2. `tests/commerce-transaction.test.ts` (5 tests): Durable idempotency check, serializable boundaries, exponential backoff retry on Prisma P2034 conflicts, bounded retry exhaustion.
  3. `tests/recovery-format.test.ts` (5 tests): AES-256-GCM encryption nondeterminism, schema hash authentication, legacy JSON rejection, migration identity binding, legacy restore 409 rejection.
  4. `tests/commerce-policy.test.ts` (8 tests): Branch tenant access denial, role authorization, payment reconciliation (cash vs split vs card reference), floating-point decimal precision.
  5. `tests/session.test.ts` (3 tests): JWT callback tampering immunity, database authority resolution, inactive user revocation.
  6. `tests/database-verification.test.ts` (5 tests): Isolated database URL syntax enforcement, 14-test assertion threshold, disposable restore target validation.
- **Verified Output Log**:
  ```
   RUN  v5.0.5 C:/projects/pos

   ✓ tests/browser-request.test.ts (4 tests) 33ms
   ✓ tests/commerce-transaction.test.ts (5 tests) 32ms
   ✓ tests/recovery-format.test.ts (5 tests) 18ms
   ✓ tests/commerce-policy.test.ts (8 tests) 9ms
   ✓ tests/session.test.ts (3 tests) 4ms
   ✓ tests/database-verification.test.ts (5 tests) 9ms

   Test Files  6 passed (6)
        Tests  30 passed (30)
     Start at  20:32:07
     Duration  4.11s (import 65%, tests 16%, transform 12%, worker 6%)
  ```
- **Exit Code**: `0`

---

## 3. Line-by-Line Verification Status against Phase 0 Exit Criteria

Every exit criterion, deliverable, and architectural objective from `docs/hospitality/phases/PHASE_0_FOUNDATION_RECOVERY.md` is evaluated below with exact code citations and architectural mechanisms:

```
+-----------------------------------------------------------------------------------------------------------------------------+
|                                  PHASE 0 FOUNDATION RECOVERY EXIT CRITERIA AUDIT MATRIX                                      |
+----+---------------------------------------------------+--------------------+------------+----------------------------------+
| #  | Exit Criterion / Deliverable                      | Source Document    | Status     | Verifying Evidence & Citations   |
+----+---------------------------------------------------+--------------------+------------+----------------------------------+
| C1 | Zero destructive restore paths in production/UI   | PHASE_0:19         | SATISFIED  | backup-service.ts:143-146        |
|    |                                                   |                    |            | backup/route.ts:25               |
|    |                                                   |                    |            | page.tsx:37-39                   |
+----+---------------------------------------------------+--------------------+------------+----------------------------------+
| C2 | All 8 recovery regression test cases pass cleanly | PHASE_0:20         | SATISFIED  | recovery.integration.test.ts:1-218|
|    |                                                   | RECOVERY_STATUS:73 |            | run-recovery-tests.mjs:1-45      |
+----+---------------------------------------------------+--------------------+------------+----------------------------------+
| C3 | Rehearsal reconciliation asserts identical counts,| PHASE_0:21         | SATISFIED  | rehearse-recovery.ts:1-314       |
|    | balance invariants, and rollback safety           |                    |            | compose.restro-restore.yml       |
+----+---------------------------------------------------+--------------------+------------+----------------------------------+
| C4 | Complete documentation in RECOVERY_STATUS.md      | PHASE_0:22         | SATISFIED  | docs/hospitality/RECOVERY_STATUS |
+----+---------------------------------------------------+--------------------+------------+----------------------------------+
| C5 | Reproducible, isolated local dev environment      | PHASE_0:7          | SATISFIED  | compose.restro.yml               |
|    |                                                   |                    |            | database-verification.mjs:1-14   |
+----+---------------------------------------------------+--------------------+------------+----------------------------------+
| C6 | Authenticated, encrypted tenant backup mechanism   | PHASE_0:9, 13      | SATISFIED  | backup-format.ts:29-35, 94-121   |
|    |                                                   |                    |            | backup-service.ts:47-69          |
+----+---------------------------------------------------+--------------------+------------+----------------------------------+
| C7 | Idempotency tracking via RequestResult            | PHASE_0:14         | SATISFIED  | backup-format.ts:12              |
|    |                                                   |                    |            | rehearse-recovery.ts:104, 269    |
+----+---------------------------------------------------+--------------------+------------+----------------------------------+
| C8 | Isolated operator CLI tooling                     | PHASE_0:15         | SATISFIED  | scripts/recover-restro-backup.ts |
|    |                                                   |                    |            | restro-env.mjs:69                |
+----+---------------------------------------------------+--------------------+------------+----------------------------------+
```

### 3.1 Detailed Criterion Evidences

#### Criterion C1: Zero Destructive Restore Paths in Production or Staff UI
- **Code Enforcement (Backend Service)**:
  In `backend/src/lib/backup-service.ts`, lines 143–146:
  ```typescript
  static async executeRestore(businessId: string, filename: string): Promise<never> {
    void businessId; void filename;
    throw new BackupError("Live overwrite restore is disabled. Use isolated operator recovery into an absent tenant.", 409);
  }
  ```
  The legacy restore routine that deleted payments, stocks, batches, and unexported records has been completely expunged.
- **Code Enforcement (API Route)**:
  In `backend/src/app/api/v1/settings/backup/route.ts`, line 25:
  ```typescript
  if (parsed.data.action === "restore") return await BackupService.executeRestore(context.businessId, parsed.data.filename || "");
  ```
  Incoming POST requests specifying action `"restore"` trigger `executeRestore`, returning an immediate HTTP 409 error without reading the archive or modifying database state.
- **Code Enforcement (Frontend UI)**:
  In `frontend/src/app/dashboard/settings/backup/page.tsx`, lines 37–39:
  ```tsx
  <p>Live overwrite restore is disabled. Operator recovery requires an isolated database and an absent tenant. Legacy JSON exports are incomplete and cannot be restored here.</p>
  <p>Archive authentication confirms integrity. It does not confirm a recovery rehearsal, offsite protection or an agreed recovery time.</p>
  ```
  All file upload controls, restore buttons, and destructive options have been removed. The UI displays read-only metadata and honest rehearsal statuses.

#### Criterion C2: All 8 PostgreSQL Recovery Regression Tests Pass Cleanly
- **Code Enforcement**: `tests/recovery.integration.test.ts` (lines 1–218) defines 8 comprehensive database regression cases (R1 through R8).
- **Harness Enforcement**: `scripts/run-recovery-tests.mjs` (lines 35–41) parses Vitest JSON output, asserts that exactly 8 tests were executed, 0 failed, and 0 were skipped. Any skip causes process exit code 1.
- **Execution Proof**: `node scripts/restro-env.mjs recovery-test` passes all 8 tests in 4.18 seconds against `127.0.0.1:55439/restro_test`.

#### Criterion C3: Rehearsal Reconciliation Asserts Identical Counts, Invariants, and Rollback
- **Cross-Cluster Isolation**: `scripts/rehearse-recovery.ts` lines 180–190 asserts that source (`127.0.0.1:55439`) and target (`127.0.0.1:55440`) differ in `system_identifier`, database name (`restro_test` vs `restro_restore`), and user (`restro_dev` vs `restro_restore`).
- **Entity Count Reconciliation**: Lines 246–248 verify that row counts across all 41 Prisma tenant models match exactly between source snapshot and restored target (70 rows).
- **Financial Balance Invariants**: Lines 254–264 execute independent SQL aggregations on source and target, verifying exact equality:
  - `saleTotal`: 4455.99
  - `salePaid`: 2075.25 (equals `paymentTotal`: 2075.25)
  - `customerBalance`: 2380.74 (equals `customerLedgerDebit`: 2380.74 and `receivable`: 2380.74)
  - `supplierBalance`: 75.50 (equals `supplierLedgerCredit`: 75.50)
  - `stockQuantity`: 50.0 (equals `batchQuantity`: 50.0)
- **Violation Checks**: Lines 265–267 assert 0 invariant violations: zero orphan sale items, zero orphan audit branches, zero orphan return products.
- **Source Preservation**: Lines 200–201, 281–282 assert that the source database MD5 table fingerprint is completely untouched before, during, and after rehearsal cleanup.

#### Criterion C4: Complete Documentation in `docs/hospitality/RECOVERY_STATUS.md`
- **Documentation Verification**: `docs/hospitality/RECOVERY_STATUS.md` provides an exhaustive technical record spanning the two-layer recovery architecture, synthetic fixture parameters, timing metrics, the `ORDER BY "id"` nondeterministic manifest fix, operator instructions, and explicit production release blockers.

---

## 4. Itemized Audit of Remaining Gaps & Release Blockers

While Phase 0 local foundation criteria are satisfied, the operational and architectural gaps identified in `RECOVERY_STATUS.md` and `IMPLEMENTATION_PLAN.md` must be addressed prior to any live production deployment:

```
+--------------------------------------------------------------------------------------------------------------------------+
|                                    ITEMIZED AUDIT OF PRODUCTION RELEASE BLOCKERS                                         |
+----+---------------------------------------------------+----------+------------------------------------------------------+
| #  | Gap / Blocker Description                         | Severity | Impact & Required Resolution Path                    |
+----+---------------------------------------------------+----------+------------------------------------------------------+
| G1 | Absence of Layer 1 Cluster Physical Backup / PITR  | CRITICAL | Tenant archives cannot recover server crash or disk  |
|    |                                                   |          | corruption; requires pgBackRest/continuous WAL arch. |
+----+---------------------------------------------------+----------+------------------------------------------------------+
| G2 | Absence of Approved Production Cutover Runbooks   | HIGH     | Recovery scripts hard-coded to loopback ports;       |
|    |                                                   |          | manual production cutover procedure unwritten.       |
+----+---------------------------------------------------+----------+------------------------------------------------------+
| G3 | Static Encryption Key Custody & Escrow Absence    | HIGH     | Single static 32-byte hex key; no key versioning     |
|    |                                                   |          | (kid), rotation mechanism, or multi-custody escrow.  |
+----+---------------------------------------------------+----------+------------------------------------------------------+
| G4 | Local Storage Durability & External Media Assets  | HIGH     | Backups default to local disk (scratch/); externally |
|    |                                                   |          | hosted media URLs omitted from archive payload.      |
+----+---------------------------------------------------+----------+------------------------------------------------------+
| G5 | Windows NTFS ACLs vs POSIX File Permissions       | MEDIUM   | POSIX 0600/0700 file modes ineffective on NTFS;      |
|    |                                                   |          | requires OS-level Windows ACL hardening.             |
+----+---------------------------------------------------+----------+------------------------------------------------------+
| G6 | In-Memory Payload Serialization Constraints       | MEDIUM   | 32 MiB unencrypted payload cap limits large tenants;  |
|    |                                                   |          | streaming JSON serializer/deserializer needed.       |
+----+---------------------------------------------------+----------+------------------------------------------------------+
| G7 | IEEE 754 Float Currency Storage (Phase 2 Scope)   | HIGH     | Currency fields stored as Float in Prisma schema;    |
|    |                                                   |          | requires migration to arbitrary-precision Decimal.   |
+----+---------------------------------------------------+----------+------------------------------------------------------+
| G8 | Serialization of User.passwordHash in Archives   | MEDIUM   | Whole User table archived; staff bcrypt hashes       |
|    |                                                   |          | protected only by envelope key, not redacted.        |
+----+---------------------------------------------------+----------+------------------------------------------------------+
```

### 4.1 Detailed Gap Analyses

#### Gap G1: Full Cluster-Level Backup / Continuous WAL Archiving (PITR)
- **Technical Observation**: The current recovery mechanism is exclusively **Tenant Logical Recovery** (Layer 2). It recovers a single missing tenant into a pre-existing, healthy PostgreSQL instance.
- **Architectural Vulnerability**: It does not protect against physical host loss, volume corruption, catastrophic PostgreSQL failures, or broad data disasters. It omits PostgreSQL roles, cluster configurations, `_prisma_migrations` history, platform onboarding requests, and cross-tenant relationships.
- **Remediation Requirement**: Deploy continuous WAL archiving (e.g. `pgBackRest`, WAL-G, or managed cloud PITR) targeting durable object storage. Rehearse full bare-metal cluster restoration and validate against business RPO (< 5 min) and RTO (< 30 min).

#### Gap G2: Production Operator Runbooks and Cutover Procedures
- **Technical Observation**: In `scripts/database-verification.mjs`, lines 1–9 and 15–24, hardcoded guards reject any connection where hostname is not `127.0.0.1` and ports are not `55439` or `55440`.
- **Architectural Vulnerability**: These guards are vital safeguards during development, but mean **no verified production recovery tooling or cutover runbook currently exists**.
- **Remediation Requirement**: Author an authoritative Operator Disaster Recovery Runbook detailing staging database provisioning, schema deployment via `prisma migrate deploy`, tenant restoration, SQL reconciliation assertions, DNS/traffic cutover, and rollback triggers.

#### Gap G3: Secret Custody, KMS Integration & Key Escrow
- **Technical Observation**: In `backend/src/lib/backup-format.ts`, `openSnapshot` and `sealSnapshot` rely on a single 32-byte hex key (`BACKUP_ENCRYPTION_KEY`). The format v2 envelope header lacks a Key Identifier (`kid`).
- **Architectural Vulnerability**:
  1. Key loss permanently invalidates all historical backups.
  2. Compromise requires re-encrypting all historical archives since rotation is unsupported.
  3. No dual custody or access logging exists.
- **Remediation Requirement**: Incorporate `kid` into the envelope header. Integrate cloud KMS (AWS KMS, GCP Cloud KMS, or HashiCorp Vault) for envelope encryption (envelope DEK/KEK model), multi-custodian key escrow, and automated key rotation.

#### Gap G4: Storage Durability & Offsite Replication (External Media Attachments)
- **Technical Observation**:
  1. Default backup location is local `scratch/restro-backups`. A physical disk crash destroys both live data and backups.
  2. Business logos, product images, and payment QR images are stored as string columns in the database. If stored as external URLs, the binary media assets are **not included in the archive**.
- **Remediation Requirement**: Implement automated offsite sync to durable cloud object storage (e.g. S3 with Object Lock or GCS with bucket retention). Establish independent backup and point-in-time versioning for media assets.

#### Gap G5: Windows NTFS ACLs vs POSIX File Permissions
- **Technical Observation**: In `backend/src/lib/backup-service.ts`, directory creation uses `fs.mkdir(..., { mode: 0o700 })` and file creation uses `fs.open(..., "wx", 0o600)`.
- **Architectural Vulnerability**: POSIX octal modes are ignored by Windows NTFS. On Windows host environments, files inherit default folder permissions, allowing any process running under the same user session or group to read archives.
- **Remediation Requirement**: Configure explicit NTFS Discretionary Access Control Lists (DACLs) via PowerShell/icacls or run the production service under an isolated service account.

#### Gap G6: In-Memory Payload Size Constraints (32 MiB JSON Cap)
- **Technical Observation**: In `backend/src/lib/backup-format.ts`, line 97 enforces `payload.length > MAX_BACKUP_BYTES / 2` (32 MiB unencrypted JSON cap), and line 104 enforces a 64 MiB total file cap.
- **Architectural Vulnerability**: The entire snapshot relational graph is buffered into memory as a single JavaScript object. Large enterprise tenants with extensive sales history will breach this cap.
- **Remediation Requirement**: Implement a chunked or streaming NDJSON (Newline Delimited JSON) export/import pipeline to process tables in streaming batches without unbounded heap growth.

#### Gap G7: Float vs Decimal Schema Migration (Scheduled for Phase 2)
- **Technical Observation**: Currency amounts (`Sale.total`, `Payment.amount`, `Customer.balance`, etc.) are defined as IEEE 754 `Float` in `schema.prisma`.
- **Architectural Vulnerability**: Floating-point arithmetic introduces cumulative precision drift, rounding discrepancies, and reconciliation failures over large transaction volumes.
- **Remediation Requirement**: Execute the planned Phase 2 financial core migration: introduce PostgreSQL `Decimal` with explicit 2-digit retail rounding across all currency fields, with historical balance backfilling and audit reconciliation.

#### Gap G8: Protection of Credentials (`User.passwordHash`)
- **Technical Observation**: In `backend/src/lib/backup-service.ts`, line 51 captures the entire `User` table, including `passwordHash`.
- **Architectural Vulnerability**: While protected by archive encryption, exposure of an archive exposes bcrypt password hashes for staff.
- **Remediation Requirement**: Evaluate redacting `passwordHash` during backup capture and requiring password resets upon restore, or implementing secondary field-level envelope encryption for credential fields.

---

## 5. Multi-Agent Operational Structure for Subsequent Phases

To execute subsequent phases (starting with Phase 1) with maximum architectural rigor, team operations are organized into four specialized agent archetypes adhering strictly to `.agent/skill/uiuxskills.md` and `.agent/skill/stack.md`:

```
+---------------------------------------------------------------------------------------------------+
|                                  MULTI-AGENT WORKFLOW TOPOLOGY                                    |
+---------------------------------------------------------------------------------------------------+
|                                                                                                   |
|  [ PLANNER AGENT ]                                                                                |
|  * Deconstructs phases into verifiable milestones and task specifications.                        |
|  * Enforces non-destructive schema evolution ("expand -> backfill -> validate -> contract").      |
|  * Enforces backward-compatible API adapter boundaries.                                           |
|         |                                                                                         |
|         v                                                                                         |
|  [ DESIGNER AGENT ]                                                                               |
|  * Enforces UI/UX Design System (.agent/skill/uiuxskills.md): Palette, Typography, Tokens.       |
|  * Implements Operational Ergonomics: POS 70/30 layout, KDS rounds, Hotel room matrix.            |
|  * Strictly enforces Anti-Pattern Codex (no over-padding, no inner scroll traps, no brass misuse).|
|  * Enforces Frontend Tech Stack (.agent/skill/stack.md): Next.js 16, React 19, Tailwind v4.     |
|         |                                                                                         |
|         v                                                                                         |
|  [ BUILDER AGENT ]                                                                                |
|  * Backend (.agent/skill/stack.md): Thin route handlers, Auth.js v5 authority, Idempotency-Key.   |
|  * Concurrency: Serializable transactions (P2034 retry loop), Transactional Outbox.               |
|  * Persistence: Decimal for money, composite (businessId, id) keys, btree_gist GiST constraints.  |
|  * Hardware: ESC/POS 80mm/58mm printing, KDS ticket reconnection recovery.                        |
|         |                                                                                         |
|         v                                                                                         |
|  [ TESTER AGENT ]                                                                                 |
|  * Adversarial Security: Direct API tests (cross-tenant rejection, unassigned branch denial).     |
|  * Concurrency & Invariants: Real loopback PostgreSQL, parallel independent connection races.     |
|  * Invariant Asserters: Double-booking collisions, idempotent replays, audit rollback triggers.   |
|  * Quality Gates: TypeScript tsc --noEmit, Vitest unit/integration suites, ESLint clean.          |
|                                                                                                   |
+---------------------------------------------------------------------------------------------------+
```

### 5.1 Role Specifications & Operational Constraints

#### 1. Planner Agent
- **Core Purpose**: Architectural decomposition, milestone planning, dependency mapping, invariant definition, and safety boundaries.
- **Operating Rules**:
  - Must sequence all features strictly according to `IMPLEMENTATION_PLAN.md`.
  - Non-destructive schema evolution: Always follow "expand ➔ backfill ➔ validate ➔ contract". Never execute unreviewed drops or destructive baseline CREATE commands.
  - Backward compatibility: Existing retail contracts (`/api/v1/sales`, `/api/v1/payments`) act as compatibility adapters; new restaurant/hotel operations live under explicit namespaces (`/api/v1/restaurant/...`, `/api/v1/hotel/...`).
  - Offline boundary: All financial mutations require online server confirmation unless explicit sync journals and terminal encryption are architected.

#### 2. Designer Agent
- **Core Purpose**: UI/UX design, operational ergonomics, component blueprints, design tokens, and accessibility.
- **Operating Rules from `.agent/skill/uiuxskills.md`**:
  - **Design Philosophy**: *"Refined Hospitality Ergonomics"* — fine dining and heritage boutique hotel aesthetic. Calm, warm, glare-free, zero decorative clutter.
  - **Palette Tokens (`frontend/src/app/globals.css`)**:
    - Primary: Deep burgundy `#6B2837` (`--primary`)
    - Primary Hover: Wine burgundy `#541E2A`
    - Background: Warm ivory `#F7F3EC` (`--background`)
    - Surface: Porcelain `#FFFCF7` (`--card`, `--popover`)
    - Secondary Surface: Warm stone `#EEE7DD` (`--secondary`, `--muted`)
    - Text: Espresso `#292320` (`--foreground`)
    - Muted Text: Warm gray `#71675E` (`--muted-foreground`)
    - Border: Sandstone `#D8CEC1` (`--border`, `--input`)
    - Accent: Muted brass `#A77B38` (`--accent`) — **SPARING USE ONLY** (fine edge lines, selected badges; never normal body text or global icon tinting).
  - **Operational Status Tokens (Strict Color Isolation)**:
    - *Ready / Available / Completed*: Forest `#28634B`, BG `#EAF3EE`, Border `#C3DED0`.
    - *Pending / Preparing / Attention*: Ochre `#946000`, BG `#FDF5E7`, Border `#EDD7AD`.
    - *Cancelled / Failed / Urgent*: Red `#B33432`, BG `#FAEAEC`, Border `#E9B6B7`.
    - *Informational / Assigned*: Blue `#315F85`, BG `#EDF4F9`, Border `#B8D2E6`.
  - **The Anti-Pattern Codex (Violations Forbidden)**:
    - No over-padding: Page container `p-4 sm:p-6` max; internal cards `p-3.5 sm:p-4`; grid gaps `gap-3` or `gap-4` (never `gap-8`).
    - No inner scroll traps: No arbitrary fixed heights (`h-[600px]`); use `flex-1 min-h-0 overflow-y-auto`.
    - No rainbow shadows: Use crisp `border border-border` (`#D8CEC1`); permitted shadows limited to `shadow-xs`/`shadow-sm` on floating cards, or `shadow-md shadow-[#6B2837]/20` on primary buttons.
    - No decorative frivolity: No gradients, confetti, or giant hero banners.
  - **Operational Ergonomics**:
    - *POS Layout*: 65–70% left catalog grid (instant autofocus search, category quick-switch, 1:1 or 4:3 cards capped at ~110px); 30–35% right sticky cart (sticky header, scrollable lines, inline steppers, full-width burgundy checkout button).
    - *KDS Ergonomics*: Grouped by Order Round with elapsed timer, high contrast readable from 3 meters, 1-tap state toggles (`QUEUED` ➔ `PREPARING` ➔ `READY`), Ochre `#946000` modifier callouts.
    - *Hotel Grid*: Matrix with floors on Y-axis, dates/rooms on X-axis, distinct state fills (vacant clean, occupied, vacant dirty, maintenance).

#### 3. Builder Agent
- **Core Purpose**: Backend route handlers, database models, persistence invariants, frontend component construction.
- **Operating Rules from `.agent/skill/stack.md`**:
  - **Frontend Stack**: Next.js 16 (`16.2.9`) App Router, React 19 (`19.2.4`), Tailwind CSS v4, Lucide React icons (16px or 18px), Framer Motion (dialogs/drawers only, no button animations), React Hook Form + Zod.
  - **Backend API**: Route Handlers in `backend/src/app/api/v1/` acting as thin controllers; Auth.js v5 with server-side database authority checks; mandatory `Idempotency-Key` engine bound to `RequestResult`.
  - **Database & Persistence**:
    - **No Float for Money**: Mandatory `Decimal` with explicit 2-digit retail rounding for all currency, balances, ledger entries, and tax lines.
    - **Composite Tenant Integrity**: Composite unique constraints `(businessId, id)` on all branch-scoped models.
    - **PostgreSQL GiST Exclusion Constraints**: `btree_gist` extension on PostgreSQL; `RoomAllocation` concurrency managed via `tstzrange(start, end, '[)')` to prevent overlapping room bookings.
    - **Outbox Pattern**: `OutboxEvent` written atomically with domain writes; decoupled workers for printing and KDS.
    - **Concurrency**: `serializableTransaction` helper with exponential backoff on Prisma P2034 conflicts (max 4 attempts).

#### 4. Tester Agent
- **Core Purpose**: Adversarial security verification, database concurrency/invariants, race testing, frontend build/type validation.
- **Operating Rules from `.agent/skill/stack.md`**:
  - **Adversarial Security**: Direct API tests attempting cross-tenant reads, unassigned branch mutations, deactivated user access, and JWT token manipulation (must fail with 401/403).
  - **Atomic Audit Invariant**: Artificially fail an audit logging insert; assert that the entire mutating business transaction rolls back cleanly.
  - **Real Database Testing**: All integration tests must execute against real disposable PostgreSQL containers on loopback ports; zero mocks for transactions, locks, or exclusion constraints.
  - **Race Testing**: Parallel independent connections exercising concurrent checkouts, room allocation GiST collisions, and idempotent replays.
  - **Code Health Gates**: Strict TypeScript typechecking (`npm.cmd run typecheck`), unit test pass (Vitest 5.0.5), and ESLint verification.

---

## 6. Phase 1 Roadmap & Immediate Next Steps

### 6.1 Phase 1 Scope: Security Foundation & Tenant Isolation
With Phase 0 baseline verification satisfied, Phase 1 focuses on hardening security boundaries, establishing server-derived authority across all endpoints, introducing composite tenant foreign keys, and enforcing atomic audit logging.

### 6.2 Immediate Actionable Tasks for Phase 1

```
+--------------------------------------------------------------------------------------------------------------------------+
|                                              PHASE 1 WORK BREAKDOWN STRUCTURE                                            |
+----+---------------------------------------------------+-----------------------------------+-----------------------------+
| #  | Task Name                                         | Target Components                 | Success / Verification Gate |
+----+---------------------------------------------------+-----------------------------------+-----------------------------+
| T1 | Server-Derived Authority Expansion                | backend/src/lib/api-helper.ts     | All API routes reject client|
|    |                                                   | backend/src/app/api/v1/...        | forged roles/branches.      |
+----+---------------------------------------------------+-----------------------------------+-----------------------------+
| T2 | UserBranchMembership Schema & Migration           | packages/db/prisma/schema.prisma  | Explicit branch assignments |
|    |                                                   | migrations/202611...              | fail closed for staff.      |
+----+---------------------------------------------------+-----------------------------------+-----------------------------+
| T3 | Composite (businessId, id) Tenant Invariants      | packages/db/prisma/schema.prisma  | DB rejects cross-tenant     |
|    |                                                   | backend/src/lib/commerce-policy   | relational links.           |
+----+---------------------------------------------------+-----------------------------------+-----------------------------+
| T4 | Atomic Audit Event Integration                    | backend/src/lib/audit-service.ts  | Failed audit rolls back     |
|    |                                                   | domain write transactions         | business transaction.       |
+----+---------------------------------------------------+-----------------------------------+-----------------------------+
| T5 | Sensitive Field Serialization Redaction           | backend/src/lib/api-helper.ts     | Zero passwordHash or secret |
|    |                                                   | API response serializers          | exposure in JSON payloads.  |
+----+---------------------------------------------------+-----------------------------------+-----------------------------+
```

### 6.3 Immediate Handoff Directives for the Multi-Agent Team

1. **Planner Agent**:
   - Decompose Task T1 through T5 into granular, verifiable acceptance specifications.
   - Define exact schema changes for `UserBranchMembership` and composite keys in `packages/db/prisma/schema.prisma`.
   - Ensure migration pre-flight checks enforce non-destructive rollout.

2. **Designer Agent**:
   - Design branch selection and staff role management interfaces adhering to the Burgundy/Ivory/Porcelain palette.
   - Specify operational status token mappings for user activation states (Active = Forest, Pending = Ochre, Deactivated = Red).
   - Enforce the Anti-Pattern Codex on all user management screens.

3. **Builder Agent**:
   - Implement the `UserBranchMembership` model and Prisma migration.
   - Update `getSessionContext` to resolve active branch assignments from live database state.
   - Implement composite foreign key lookups across all branch-scoped endpoints.
   - Redact `passwordHash` across all user serializers.

4. **Tester Agent**:
   - Author adversarial security integration tests:
     - Cross-tenant resource access attempts (assert 403 Forbidden).
     - Unassigned branch mutations by managers (assert 403 Forbidden).
     - Deactivated user session tokens (assert 401 Unauthorized).
     - Synthetic audit insert trigger failure (assert 100% domain transaction rollback).
   - Verify zero skips and 100% clean passes on all regression suites.

---

## 7. Conclusion & Readiness Attestation

The Phase 0 Foundation Recovery milestone has been comprehensively verified on the current repository working tree. Destructive database overwrite paths have been eliminated, an authenticated and encrypted tenant snapshot engine has been established, and cross-cluster recovery rehearsal has validated 100% data fidelity and invariant consistency across two independent PostgreSQL instances.

The codebase is **VERIFIED, HARDENED, AND APPROVED** to proceed to **Phase 1: Security Foundation & Tenant Isolation** under the multi-agent operational framework.
