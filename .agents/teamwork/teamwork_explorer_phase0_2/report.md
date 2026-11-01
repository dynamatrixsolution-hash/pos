# Technical Investigation Report: Phase 0 Recovery Architecture, Container Infrastructure, and Operational State

**Investigator**: Subagent `teamwork_explorer_phase0_2`  
**Date**: 2026-10-31  
**Scope**: Recovery scripts, rehearsal test harness, container orchestration, rehearsal checks, operational runbooks, and Phase 0 gate assessment.  
**Working Directory**: `c:\projects\pos`

---

## Executive Summary

A comprehensive architectural and operational audit of the recovery system was conducted across repository scripts, Docker compose topology, database verification gates, and hospitality phase documentation.

1. **Recovery Implementation Status**: The repository has fully implemented an encrypted, authenticated, tenant-isolated logical backup and recovery engine (Format v2) covering all 41 Prisma tenant models. All destructive live overwrite routes have been eradicated (returning HTTP 409).
2. **Rehearsal Verification**: Executed `node scripts/restro-restore-env.mjs rehearse`. All **41 rehearsal checks passed with exit code 0** on a separate disposable PostgreSQL 15 container (`127.0.0.1:55440`), proving row-level data fidelity, balance invariance, and transactional atomicity.
3. **Integration & Unit Testing**: Executed `node scripts/restro-env.mjs recovery-test` (**8/8 passed, 0 skipped**) and unit test suites (**30/30 passed**). Frontend and backend TypeScript compilation passed with exit code 0.
4. **Container Orchestration**: The local loopback infrastructure strictly isolates development (`127.0.0.1:55439`, volume `restro_dev_data`) from rehearsal restore (`127.0.0.1:55440`, volume `restro_restore_data`) and legacy app containers (`5434:5432`). Guard functions prevent any cross-port or non-loopback connections.
5. **Operational Gaps**: While Layer 2 (Tenant Logical Recovery) is implemented and rehearsed on synthetic data, **Layer 1 (Cluster-level physical backup / Continuous WAL Archiving / PITR)**, production disaster cutover runbooks, key rotation/escrow procedures, and offsite storage automation are currently **missing**.

---

## 1. Codebase & Script Architecture Review

The recovery architecture consists of five core scripts and test files, supported by cryptographic and format utilities:

### 1.1 `scripts/recover-restro-backup.ts`
- **Location**: `scripts/recover-restro-backup.ts` (22 lines)
- **Role**: Operator command-line interface for taking backups and restoring missing tenants.
- **Safety Enforcement**:
  - Invokes `isolatedDatabaseUrl(process.env.DATABASE_URL)` (line 4) from `database-verification.mjs`.
  - Enforces `process.env.DIRECT_URL === target` and `process.env.TEST_DATABASE_URL === target` (line 5).
  - Dynamically imports `@dynapos/db` and `backend/src/lib/backup-service`.
- **Supported Actions**:
  - `create <businessId>`: Calls `store.executeBackup(businessId)` and outputs JSON metadata.
  - `restore <businessId> <filename>`: Calls `store.restoreMissingTenant(businessId, filename)`.
- **Constraint / Vulnerability Safeguard**: The script is strictly constrained by `isolatedDatabaseUrl` to port `55439` (username `restro_dev`, database `restro_test`). It cannot accidentally be pointed at production, a remote host, or an arbitrary port without failing immediately.

### 1.2 `scripts/rehearse-recovery.ts`
- **Location**: `scripts/rehearse-recovery.ts` (314 lines)
- **Role**: End-to-end automated rehearsal test harness verifying cross-cluster tenant recovery.
- **Topology**:
  - Source database: `127.0.0.1:55439/restro_test` (read-only for backup; synthetic fixtures inserted and cleaned up strictly by generated ID).
  - Target database: `127.0.0.1:55440/restro_restore` (disposable PostgreSQL container, separate cluster, volume, role, and credentials).
- **Architecture**:
  - Connects two independent Prisma clients (`source` on 55439, `target` on 55440).
  - Generates whole-database table fingerprints using SQL row count and concatenated MD5 hashes (`SELECT count(*)::int AS n, coalesce(md5(string_agg(t::text, '|' ORDER BY t."id")), '') AS h`).
  - Generates synthetic fixtures across all 41 tenant models with realistic volume (batch-tracked stock, split-payment sales, customer/supplier ledger balances, audit trails, request deduplication records).
  - Executes 41 distinct checks spanning cluster identity, archive encryption, negative refusal, good restore, reconciliation, and tenant isolation.

### 1.3 `scripts/restro-restore-env.mjs`
- **Location**: `scripts/restro-restore-env.mjs` (58 lines)
- **Role**: Environment manager and orchestrator for the disposable restore target on port 55440.
- **Commands**:
  - `init`: Generates random 24-byte hex password and creates `.env.restro-restore.local` with file mode `0o600`. Refuses to overwrite existing files.
  - `db`: Spawns Docker Compose project `prayassh-restro-restore` with `-f compose.restro-restore.yml up -d --wait`.
  - `migrate`: Deploys Prisma migrations strictly to the restore target. Asserts that public schema is either empty or already at baseline before deploying.
  - `rehearse`: Spawns `scripts/rehearse-recovery.ts` via `tsx`, passing source and target configurations.
- **Security Guards**: Calls `restoreTargetUrl(target.RESTORE_TARGET_DATABASE_URL, source.DATABASE_URL)` and `isolatedDatabaseUrl(source.DATABASE_URL)`.

### 1.4 `scripts/restro-env.mjs`
- **Location**: `scripts/restro-env.mjs` (66 lines)
- **Role**: Launcher for the primary development/test environment on port 55439.
- **Commands**:
  - `init`: Creates `.env.restro.local` with generated credentials, Auth secret, and loopback URLs.
  - `recovery-config`: Appends missing `BACKUP_ENCRYPTION_KEY` (32-byte hex) and `BACKUP_DIRECTORY` (`scratch/restro-backups`) without rotating existing keys or printing secrets.
  - `db`: Spawns Docker Compose project `prayassh-restro` with `-f compose.restro.yml up -d --wait`.
  - `migrate`: Deploys Prisma migrations to the development database, verifying baseline migration `202610300001_retail_baseline`.
  - `recovery-test`: Spawns `scripts/run-recovery-tests.mjs`.
  - `recovery`: Spawns `scripts/recover-restro-backup.ts` with user arguments.
  - `integration`, `dev`, `verify-failed`, `verify-races`, `backend-build`, `frontend-build`.

### 1.5 `tests/recovery.integration.test.ts`
- **Location**: `tests/recovery.integration.test.ts` (218 lines)
- **Role**: Vitest suite of 8 PostgreSQL integration test cases verifying transaction isolation, failure rollback, and format invariants.
- **Verified Cases**:
  1. `R1`: Captures all 41 tenant models; validates AES-256-GCM authenticated encryption; verifies metadata flags `verified: false`, `recoveryStatus: "NOT_REHEARSED"`, `integrityVerified: true`.
  2. `R2`: Rejects live overwrite (409), path traversal (`../outside.json`), foreign tenant IDs, wrong encryption keys, and tampered manifest counts without writing to the database.
  3. `R3`: Rejects incomplete manifests (missing Payment table), duplicate IDs, and foreign references prior to database write attempts.
  4. `R4`: Proves late failure atomicity. Attaches a PostgreSQL trigger on `AuditLog` that aborts on `BACKUP_RESTORE`. Verifies that the entire transaction aborts and leaves 0 persisted rows across all 41 models.
  5. `R5`: Proves high-fidelity recovery. Reconstructed balances, payments, stock projections, batches, and SQL-null vs JSON-null distinctions match original data byte-for-byte. Appends exactly one `BACKUP_RESTORE` audit log. Rejects secondary restore with 409.
  6. `R6`: Proves RepeatableRead snapshot consistency under concurrent writers. Reader pauses mid-transaction while a concurrent connection commits updates to sales, payments, customer balances, and ledgers; reader's snapshot remains untorn and reflects pre-update values.
  7. `R7`: Tests HTTP endpoint `/api/v1/settings/backup`. Unauthenticated requests yield 401; non-owner staff yields 403; live restore requests yield 409 without database modifications.
  8. `R8`: Proves deterministic manifest sorting. Populates rows with null JSON values in unordered heap allocations; verifies `jsonDatabaseNulls` manifests are lexicographically sorted and reproducible across runs.

---

## 2. Rehearsal Checks (41 Checks) on Disposable Target Container (127.0.0.1:55440)

The recovery rehearsal suite (`scripts/rehearse-recovery.ts`) executes **41 rigorous assertions** across six functional categories on the disposable target container:

| # | Check Name | Execution Method / Verification Logic | Result |
|---|---|---|---|
| **1** | Source & target cluster separation | Compares `pg_control_system()`, `current_database()`, and `current_user` between source and target. Asserts different system identifier, db name, and role. | **PASS** |
| **2** | Target migration history matches source | Queries `_prisma_migrations` from both databases and asserts identical migration names and SHA-256 checksums (`202610300001_retail_baseline`, `202610300002_commerce_hardening`). | **PASS** |
| **3** | Target initial tenant cleanliness | Asserts `target.business.count` for Tenant A and Tenant B is 0. | **PASS** |
| **4** | Archive model completeness & isolation | Asserts metadata covers all 41 tenant models; snapshot contains exactly 1 business and 0 foreign tenant records (70 rows, 44,736 bytes). | **PASS** |
| **5** | Archive encryption & migration binding | Asserts archive payload does not contain plaintext strings (`synthetic`, `passwordHash`); manifest carries full migration identity array. | **PASS** |
| **6** | Honest metadata reporting | Asserts `metadata.verified === false`, `metadata.recoveryStatus === "NOT_REHEARSED"`, and `metadata.integrityVerified === true`. | **PASS** |
| **7** | Source unchanged by backup | Asserts source database fingerprint (row count + MD5 per table) is identical before and after backup. | **PASS** |
| **8** | Negative refusal: corrupted ciphertext | Bit flipped in ciphertext; target fingerprint verified unchanged before and after refused restore. | **PASS** |
| **9** | Negative refusal: truncated archive | Half of ciphertext sliced; restore rejected without target writes. | **PASS** |
| **10** | Negative refusal: tampered manifest counts | Increment Payment count in unencrypted AAD header; GCM authentication tag mismatch rejects without writes. | **PASS** |
| **11** | Negative refusal: wrong encryption key | Restore attempted with random 32-byte key; rejected by GCM decipher. | **PASS** |
| **12** | Negative refusal: legacy plaintext JSON | Submits `{ sales: [], payments: [] }`; rejected as unsupported legacy format. | **PASS** |
| **13** | Negative refusal: incompatible schema hash | Tampered `schemaHash` in header; rejected before database writes. | **PASS** |
| **14** | Negative refusal: incompatible migration history | Archive contains future migration `202699990001_unknown_future`; rejected with HTTP 409 inside restore transaction before inserting any row. | **PASS** |
| **15** | Negative refusal: missing model in manifest | Snapshot missing Payment table; fails sealing validation. | **PASS** |
| **16** | Negative refusal: mismatched tenant identity | Restores Tenant A archive with Tenant B business ID; rejected with tenant mismatch error. | **PASS** |
| **17** | Negative refusal: path traversal `../` | `../outside.pbackup` rejected by filename validator. | **PASS** |
| **18** | Negative refusal: path traversal `..\` | `..\outside.pbackup` rejected by filename validator. | **PASS** |
| **19** | Negative refusal: absolute path in filename | Full path rejected by filename validator. | **PASS** |
| **20** | Negative refusal: embedded traversal | `${filename}/../../${filename}` rejected. | **PASS** |
| **21** | Negative refusal: non-UUID filename | `backup-not-a-uuid.pbackup` rejected. | **PASS** |
| **22** | Negative refusal: Windows reserved device name | Filename `nul` rejected. | **PASS** |
| **23** | Negative refusal: empty filename | Empty string `""` rejected. | **PASS** |
| **24** | Negative refusal: nonexistent file | Valid UUID filename that does not exist on disk rejected with unavailable error. | **PASS** |
| **25** | Negative refusal: symlink escape | Symlink created pointing outside backup directory; rejected by `fs.lstat` and `realpath` confinement check. | **PASS** |
| **26** | Negative refusal: oversized archive | File size exceeding `MAX_BACKUP_BYTES` (64 MiB); rejected on stat inspection. | **PASS** |
| **27** | Recovery audit trail logged | Restores Tenant A; asserts exactly one audit record created with action `BACKUP_RESTORE` and role `RECOVERY_OPERATOR`. | **PASS** |
| **28** | Entity counts identical for all 41 models | Compares table row counts between source snapshot and restored target; 0 mismatches across 70 rows. | **PASS** |
| **29** | Row-level fidelity & SQL-vs-JSON nulls | Compares every row and field in all 41 models; asserts identical values, IDs, timestamps, and exact `DbNull` vs `JsonNull` distinction. | **PASS** |
| **30** | Financial & inventory SQL aggregates | SQL queries run independently on source and target yield identical values: `saleTotal` (4455.99), `salePaid` (2075.25), `paymentTotal` (2075.25), `customerBalance` (2380.74), `supplierBalance` (75.50), `customerLedgerDebit` (2380.74), `supplierLedgerCredit` (75.50), `stockQuantity` (50.0), `batchQuantity` (50.0), `receivable` (2380.74). | **PASS** |
| **31** | Target business invariants hold | Evaluates SQL violation counts on target; all 6 checks return 0: payments match paid amounts, stock matches batch sums, receivable matches customer balance, zero orphan sale items, zero orphan audit branches, zero orphan return products. | **PASS** |
| **32** | Source business invariants hold | Evaluates the same 6 invariant checks on source to confirm synthetic fixtures are internally consistent. | **PASS** |
| **33** | Synthetic totals match expected parameters | Asserts exact synthetic totals: receivable 2380.740000, payments 2075.250000, stock 50.000000. | **PASS** |
| **34** | Audit history & idempotency preserved | Restored `AuditLog` (4 rows) and `RequestResult` (3 rows) equal source snapshot. | **PASS** |
| **35** | Target multi-tenant isolation | Pre-existing unrelated Tenant C on target is 100% identical before and after restore across all 41 models and null markers. | **PASS** |
| **36** | Non-restored tenant exclusion | Asserts Tenant B has 0 rows in target `Business` and `Sale` tables. | **PASS** |
| **37** | Restored table scope containment | Fingerprint diff shows only tables belonging to the restored tenant were modified. | **PASS** |
| **38** | Anti-overwrite enforcement (idempotence) | Attempts second restore of Tenant A into target; rejected with HTTP 409 ("In-place restore is disabled; recover only into an absent tenant"). | **PASS** |
| **39** | Target integrity during negative attacks | Target fingerprint before good restore equals target fingerprint before any negative case ran, proving 0 side-effects from attacks. | **PASS** |
| **40** | Source untouched during entire cycle | Source database fingerprint after backup + restore + negative cases equals source fingerprint after initial seeding. | **PASS** |
| **41** | Source returns to baseline after cleanup | Cleans up synthetic fixtures from source by generated ID; source fingerprint matches pre-rehearsal baseline exactly. | **PASS** |

---

## 3. Container Orchestration & Infrastructure Analysis

### 3.1 Container Topology
Three distinct PostgreSQL container environments exist in the repository:

```
+---------------------------------------------------------------------------------------+
| Docker Host                                                                           |
|                                                                                       |
|   [Project: prayassh-restro]                                                           |
|   Container: prayassh-restro-restro-db-1                                              |
|   Image: postgres:15-alpine                                                           |
|   Port: 127.0.0.1:55439 -> 5432                                                       |
|   Database: restro_test  |  User: restro_dev                                          |
|   Volume: restro_dev_data                                                             |
|   Purpose: Local development & primary integration tests                              |
|                                                                                       |
|   [Project: prayassh-restro-restore]                                                  |
|   Container: prayassh-restro-restore-restro-restore-db-1                              |
|   Image: postgres:15-alpine                                                           |
|   Port: 127.0.0.1:55440 -> 5432                                                       |
|   Database: restro_restore  |  User: restro_restore                                    |
|   Volume: restro_restore_data                                                         |
|   Purpose: Disposable disaster recovery rehearsal target                              |
|                                                                                       |
|   [Project: pos (docker-compose.yml)]                                                 |
|   Container: dynaone-db                                                               |
|   Image: postgres:15-alpine                                                           |
|   Port: 5434 -> 5432                                                                  |
|   Database: prayasshpos  |  User: abhi                                                |
|   Volume: postgres_data                                                               |
|   Purpose: Legacy full-stack demo compose stack                                       |
+---------------------------------------------------------------------------------------+
```

### 3.2 Port Mapping & Network Isolation Safeguards
- **Strict Loopback Binding**: `compose.restro.yml` and `compose.restro-restore.yml` bind ports strictly to `127.0.0.1:55439` and `127.0.0.1:55440`. No public network interface (`0.0.0.0`) is exposed.
- **Port-Level Target Validation**:
  - `isolatedDatabaseUrl()` in `scripts/database-verification.mjs` (lines 1-9) rejects any URL that does not strictly match `127.0.0.1:55439`, username `restro_dev`, and database `/restro_test`. Query string parameters (e.g. `?host=remote`) are explicitly forbidden.
  - `restoreTargetUrl()` in `scripts/database-verification.mjs` (lines 15-24) rejects any URL that does not match `127.0.0.1:55440`, username `restro_restore`, and database `/restro_restore`. It also asserts `url.port !== new URL(sourceValue).port` to prevent accidental restoration into the development database.

### 3.3 Container Lifecycle Management
- **Startup**: `scripts/restro-env.mjs db` and `scripts/restro-restore-env.mjs db` execute `docker compose up -d --wait`, utilizing the built-in healthchecks (`pg_isready -U <user> -d <db>`).
- **Teardown**: Both containers remain running as long-lived test services. Tearing down the rehearsal target container is performed via `docker compose -p prayassh-restro-restore -f compose.restro-restore.yml down` without data loss to `restro_dev_data`.
- **Active Operational State**: Inspection via `docker ps` confirmed both `prayassh-restro-restro-db-1` (Up 9+ hours, healthy) and `prayassh-restro-restore-restro-restore-db-1` (Up 2+ hours, healthy) are operational and responsive.

---

## 4. Assessment of Cluster-Level Backup / PITR Documentation & Operator Runbooks

A systematic search and analysis was conducted across `docs/hospitality/`, `scripts/`, and the repository root for cluster-level backup tools, continuous archiving, PITR configurations, and operator runbooks.

### 4.1 What Exists (Current Operational Assets)
1. **Two-Layer Architecture Definition**:
   - `docs/hospitality/RECOVERY_STATUS.md` (lines 9-13) establishes a clear conceptual distinction between:
     - **Layer 1: Full-instance disaster recovery**: Physical base backups + WAL archiving (PITR) or cluster-level `pg_dump`/snapshots stored off-host and encrypted.
     - **Layer 2: Tenant logical recovery**: Encrypted, authenticated per-tenant snapshots captured via RepeatableRead transactions and restored via Serializable transactions.
2. **Documented Tenant Recovery Procedure (Isolated Target Only)**:
   - `docs/hospitality/RECOVERY_STATUS.md` (lines 49-55) and `docs/hospitality/LOCAL_DEVELOPMENT.md` outline operator steps for restoring an absent tenant into an isolated database using `node scripts/restro-env.mjs recovery restore <businessId> <backup.pbackup>`.
3. **Explicit Boundary Constraints**:
   - Documents clearly record that tenant snapshots intentionally exclude platform registration records (`BusinessRegistrationRequest`), database roles, deployment credentials, uploaded images/files, and external fiscal service states.
   - Live overwrite restore is explicitly disabled in both API (`BackupService.executeRestore` returns 409) and UI (`frontend/src/app/dashboard/settings/backup/page.tsx`).

### 4.2 What Is Missing (Operational Gaps & Release Blockers)

| Category | Missing Component | Severity for Production | Impact on Phase 0 Gate |
|---|---|---|---|
| **Layer 1 PITR** | Continuous WAL archiving (e.g. `archive_command`, WAL-G, pgBackRest, or cloud managed PITR). | **CRITICAL RELEASE BLOCKER** | Documented as an unfulfilled requirement for production release in `RECOVERY_STATUS.md` |
| **Layer 1 Base Backup** | Scheduled cluster-level physical backups (`pg_basebackup` or filesystem snapshots). | **CRITICAL RELEASE BLOCKER** | Required before any live customer data deployment |
| **Operator Runbook** | Approved Production Cutover Runbook. `RECOVERY_STATUS.md` explicitly notes: *"No approved production cutover procedure exists yet."* | **HIGH** | Operator cannot execute a live disaster recovery cutover |
| **Key Custody & Escrow** | Documented procedure for multi-custodian key escrow, key rotation, and secret storage for `BACKUP_ENCRYPTION_KEY`. | **HIGH** | A lost key invalidates all tenant archives permanently |
| **Offsite Storage** | Automation to push `.pbackup` files to offsite encrypted object storage (S3/GCS) with retention lifecycle policies. | **HIGH** | Current backups default to local `scratch/restro-backups` |
| **Disaster Drill / Metrics** | Measured Recovery Point Objective (RPO) and Recovery Time Objective (RTO) under production-scale data. Phase 8 targets RPO < 5 min and RTO < 30 min, but no Phase 0 measurement exists. | **MEDIUM** | Measured only on 70-row synthetic fixture (~10s) |
| **Credential Redaction** | `User.passwordHash` values are serialized into the tenant archive payload. While encrypted, credential hashes are not separated or masked. | **MEDIUM** | Requires security decision on password hash handling |

---

## 5. Phase 0 Gate Assessment & Phase 1 Readiness

### 5.1 Criteria Audit against `docs/hospitality/phases/PHASE_0_FOUNDATION_RECOVERY.md`

| Phase 0 Exit Criterion | Status | Evidence |
|---|---|---|
| **Zero destructive restore paths in production or staff UI** | **MET** | `BackupService.executeRestore()` throws 409; `/api/v1/settings/backup` returns 409; frontend UI removes restore/upload controls and displays safeguard notices. |
| **All 8 PostgreSQL recovery regression test cases pass cleanly (`recovery-test`)** | **MET** | Executed `node scripts/restro-env.mjs recovery-test`: 8 executed, 8 passed, 0 skipped in 4.20s. |
| **Rehearsal reconciliation asserts identical row counts, balance invariants, and rollback safety** | **MET** | Executed `node scripts/restro-restore-env.mjs rehearse`: 41/41 checks passed, 0 failures. Exact SQL balance reconciliation and rollback triggers verified. |
| **Complete documentation in `docs/hospitality/RECOVERY_STATUS.md`** | **MET** | Documentation fully records the implemented scope, test evidence, defect fixes, operator procedures, and remaining release blockers. |

### 5.2 Broader Phase 0 Gate Considerations from `IMPLEMENTATION_PLAN.md`
`docs/hospitality/IMPLEMENTATION_PLAN.md` (lines 8-9 and line 147) defines broader foundational requirements before full production release:
- *"Still required for P0: cluster backup/PITR (layer 1) and its rehearsal; offsite/persistent storage, monitored scheduling/retention, key custody/rotation, disaster/cutover rehearsal and agreed RPO/RTO..."*
- However, `IMPLEMENTATION_PLAN.md` also notes:
  - *"Next shared-core milestone after recovery review: monetary precision/rounding policy, additive Float-to-decimal migration with historical reconciliation, payment allocations/reversals and settlement/report reconciliation."*

### 5.3 Recommendation: Conditional GO for Phase 1
- **Recommendation**: **CONDITIONAL GO** to proceed with **Phase 1 (Security Authority & Multi-Tenant Boundaries)**.
- **Rationale**:
  1. The code foundation, developer environment isolation, type checking, unit tests, and tenant recovery engine are completely verified and rock-solid.
  2. The remaining gaps (Cluster PITR, operator cutover runbooks, offsite storage) are **operational/infrastructure procedures** required for staging/production release, not code blockers for implementing Phase 1 security boundaries or Phase 2 financial cores.
  3. Holding software architecture progression until cloud PITR infrastructure is provisioned would unnecessarily stall application development.
- **Condition**: Prior to Phase 8 (Rollout & Pilot) and before any production deployment, Layer 1 PITR must be implemented and a formal operator cutover runbook must be published.

---

## 6. Verification Commands & Reproducibility Guide

To independently reproduce all findings in this report, execute the following commands from the repository root:

```powershell
# 1. Verify container operational status
docker ps -a --filter "name=prayassh-restro"

# 2. Run recovery rehearsal (41 checks on 127.0.0.1:55440)
node scripts/restro-restore-env.mjs rehearse

# 3. Run recovery integration test suite (8 cases on 127.0.0.1:55439)
node scripts/restro-env.mjs recovery-test

# 4. Run unit tests
node node_modules/vitest/vitest.mjs run --exclude tests/commerce.integration.test.ts --exclude tests/recovery.integration.test.ts

# 5. Run full workspace TypeScript verification
npm.cmd run typecheck
```
