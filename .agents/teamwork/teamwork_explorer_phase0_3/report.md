# Phase 0 Verification Test Commands, Environment Prerequisites & Execution Readiness Report

**Date**: 2026-10-31  
**Author**: `teamwork_explorer_phase0_3`  
**Milestone**: Phase 0 Foundation Recovery Verification & Gate Assessment  
**Working Directory**: `c:\projects\pos`  

---

## 1. Executive Summary

This investigation conducted a comprehensive analysis and direct execution verification of the Phase 0 foundation recovery test suites, repository configuration, container topologies, and execution readiness on Windows (PowerShell / CMD).

### Summary of Verification Commands

| # | Command | Scope | Result | Exit Code | Verified Duration |
|---|---|---|---|---|---|
| 1 | `node scripts/restro-restore-env.mjs rehearse` | 41 synthetic recovery rehearsal checks on disposable target (`127.0.0.1:55440`) against source (`127.0.0.1:55439`) | **41 / 41 PASS** | `0` | ~7.4s – 27.4s |
| 2 | `node scripts/restro-env.mjs recovery-test` | 8 PostgreSQL tenant recovery integration regression tests (`tests/recovery.integration.test.ts`) | **8 / 8 PASS, 0 skips** | `0` | ~3.8s – 5.4s |
| 3 | `npm.cmd run typecheck` | TypeScript compiler validation across backend and frontend (`tsc -p backend/tsconfig.json ... && tsc -p frontend/tsconfig.json ...`) | **PASS (0 errors)** | `0` | ~16s |
| 4 | `node node_modules/vitest/vitest.mjs run --exclude tests/commerce.integration.test.ts --exclude tests/recovery.integration.test.ts` | 6 unit test suites (30 tests) excluding heavy database integration suites | **30 / 30 PASS** | `0` | ~4.1s |

**Readiness Verdict**: **READY FOR PHASE 0 VERIFICATION GATE**.  
All four verification commands pass with exit code `0` on the current working tree. A critical concurrency hazard was discovered, documented, and diagnosed during this investigation (running `recovery-test` concurrently with an active background dev server causes an `AccessExclusiveLock` deadlock on PostgreSQL relation `AuditLog` during test R4's dynamic trigger setup). Clear pre-flight guidelines are provided below.

---

## 2. Monorepo Architecture & Environment Configuration

### 2.1 Workspace Structure
The project is configured as an npm monorepo (`package.json`):
- `workspaces`:
  - `frontend` (Next.js 16.2.9, React 19.2.4, TailwindCSS v4)
  - `backend` (Next.js 16.2.9 API server, Prisma 6.19.3, NextAuth v5-beta)
  - `packages/db` (`@dynapos/db`, Prisma 6.19.3 client & schema definition)

### 2.2 TypeScript Configurations
- Root `tsconfig.json`: Defines base path `@/* -> ./src/*`, target `ES2017`, `moduleResolution: "bundler"`, `isolatedModules: true`.
- `backend/tsconfig.json`: Scoped to backend Next.js application, includes `next-env.d.ts`, `**/*.ts`, `**/*.tsx`, `.next/types/**/*.ts`.
- `frontend/tsconfig.json`: Scoped to frontend Next.js application with identical compiler options.
- `packages/db/tsconfig.json`: Scoped to Prisma client export (`index.ts`, `prisma/seed.ts`), target `es2022`.
- `package.json` typecheck script:
  ```json
  "typecheck": "tsc -p backend/tsconfig.json --noEmit --incremental false && tsc -p frontend/tsconfig.json --noEmit --incremental false"
  ```
  `--incremental false` guarantees that stale `.tsbuildinfo` caches never mask type discrepancies.

### 2.3 Database Containers & Network Isolation
The repository isolates development, disaster-rehearsal, and production environments using strictly segregated compose definitions and loopback URL guardrails:

| Compose File | Project Name | Port Binding | DB Name | DB User | Volume | Purpose |
|---|---|---|---|---|---|---|
| `compose.restro.yml` | `prayassh-restro` | `127.0.0.1:55439` | `restro_test` | `restro_dev` | `restro_dev_data` | Isolated dev & integration test database |
| `compose.restro-restore.yml` | `prayassh-restro-restore` | `127.0.0.1:55440` | `restro_restore` | `restro_restore` | `restro_restore_data` | Disposable target for recovery rehearsal |
| `docker-compose.yml` | Default / legacy | `5434:5432` | `prayasshpos` | `abhi` | `postgres_data` | Standard production compose (NEVER combined with restro) |

### 2.4 Guardrail Validations (`scripts/database-verification.mjs`)
Both environment launchers (`restro-env.mjs` and `restro-restore-env.mjs`) enforce strict URL validation prior to loading Prisma or executing commands:
- `isolatedDatabaseUrl(url)`: Requires protocol `postgres:` or `postgresql:`, hostname `127.0.0.1`, port `55439`, path `/restro_test`, user `restro_dev`, and no query parameters or hash.
- `restoreTargetUrl(targetUrl, sourceUrl)`: Requires protocol `postgres:` or `postgresql:`, hostname `127.0.0.1`, port `55440`, path `/restro_restore`, user `restro_restore`, and asserts that the target port differs from the source port.
- Any attempt to point commands at remote hosts, production ports, or non-loopback addresses throws immediately with `Refusing non-isolated database target` or `Refusing non-disposable restore target`.

---

## 3. Detailed Evaluation of the 4 Verification Test Commands

### 3.1 Command 1: `node scripts/restro-restore-env.mjs rehearse`

#### Mechanism
- **Launcher**: `scripts/restro-restore-env.mjs` reads `.env.restro-restore.local` and `.env.restro.local`.
- **Underlying Command**: Spawns `node node_modules/tsx/dist/cli.mjs scripts/rehearse-recovery.ts` via `spawnSync` with stdio inherited.
- **Pass Criteria**: Executes 41 assertion checks across the entire synthetic recovery lifecycle. Exit code `0` on success; exit code `1` if any check fails.
- **Output Artifact**: Generates a detailed JSON report at `scratch/rehearsal-results-<UUID>.json` containing exact timestamps, schema hashes, archive SHA-256, migration lineage, per-model counts, financial reconciliations, and timings.

#### Breakdown of 41 Rehearsal Checks
1. `source and target are different PostgreSQL clusters, databases and roles` (verified via `system_identifier`, `current_database()`, `current_user`).
2. `target migration history equals source (names and checksums)` (`202610300001_retail_baseline`, `202610300002_commerce_hardening`).
3. `target holds no trace of the tenant to recover or of tenant B`.
4. `archive covers all 41 tenant models and only tenant A` (70 rows, 44,736 bytes).
5. `archive is encrypted and carries the migration identity`.
6. `backup status never claims restore verification` (`verified: false`, `recoveryStatus: "NOT_REHEARSED"`).
7. `source database byte-for-byte unchanged by backup` (fingerprint comparison).
8–26. **19 Negative Attack Checks (Refused without database writes)**:
   - Corrupted ciphertext (flipped bytes).
   - Truncated archive.
   - Tampered manifest counts (`counts.Payment + 1`).
   - Wrong encryption key (random 32-byte key).
   - Legacy plaintext JSON export (`{"sales":[]}`).
   - Incompatible schema hash (`0000...`).
   - Incompatible migration history (different lineage / future migration; returns HTTP 409).
   - Incomplete snapshot model manifest (omitted `Payment` table).
   - Foreign tenant identity mismatch (tenant B id against tenant A archive).
   - Unsafe filenames: `../outside.pbackup`, `..\outside.pbackup`, absolute paths, embedded traversal, non-UUID name, reserved Windows device name `nul`, empty string `""`.
   - Missing archive file.
   - Symlink directory escape (Windows handles symlink privilege denial gracefully by falling back to lstat path inspection).
   - Oversized archive (> 64 MiB).
27. `restore recorded exactly one recovery audit entry` (`BACKUP_RESTORE`).
28. `entity counts equal for all 41 models` (70 rows).
29. `every restored row equals its source row (IDs, timestamps, values, SQL-vs-JSON nulls)` (41/41 models identical).
30. `invoice, payment, balance, ledger, stock and batch totals identical source vs target`.
31. `target invariants hold: payments match paidAmount, stock matches batches, receivable matches customer balance, no orphans`.
32. `source satisfies the same invariants (rehearsal fixtures are internally consistent)`.
33. `expected synthetic totals: receivable 2380.74, payments 2075.25, stock 50 across products`.
34. `audit history and request-deduplication records preserved` (4 audit rows, 3 request-result rows).
35. `unrelated tenant C in the target is untouched (all 41 models, every row)`.
36. `tenant B (never restored) has no rows in the target`.
37. `restore wrote only the recovered tenant's tables` (41 tables changed).
38. `refused without writes: second restore of an already-present tenant (no overwrite, no delete)` (HTTP 409).
39. `target fingerprint before the first recovery equals its state before any negative case`.
40. `source database unchanged after the whole backup + restore + negative sequence`.
41. `source returned exactly to its pre-rehearsal content after generated-ID cleanup`.

#### Verified Execution Output
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

### 3.2 Command 2: `node scripts/restro-env.mjs recovery-test`

#### Mechanism
- **Launcher**: `scripts/restro-env.mjs` validates `.env.restro.local` and injects configuration variables into `process.env`.
- **Underlying Script**: Executes `node scripts/run-recovery-tests.mjs`, which runs:
  ```powershell
  node_modules/vitest/vitest.mjs run tests/recovery.integration.test.ts --reporter=default --reporter=json --outputFile=scratch/recovery-results-<UUID>.json
  ```
  with `RESTRO_REQUIRE_DATABASE_TESTS="true"`.
- **Pass Criteria**: Exactly 8 assertion cases executed; zero failures; zero skips. Exit code `0`.

#### Breakdown of the 8 Recovery Test Cases
- **R1**: Captures all 41 tenant models and authenticates encrypted archives without claiming rehearsal (`verified: false`, `recoveryStatus: "NOT_REHEARSED"`).
- **R2**: Rejects live overwrite, path traversal, foreign tenant, wrong key, and tampered archives without writes.
- **R3**: Rejects incomplete manifests, duplicate IDs, and foreign references before database writes.
- **R4**: Late audit failure rolls back every recovered table, including orphan-capable idempotency rows.
- **R5**: Recovers balances, payments, stock, batches, all history, IDs, and SQL-vs-JSON nulls exactly.
- **R6**: Concurrent committed financial changes cannot tear the repeatable-read snapshot (demonstrates snapshot isolation under concurrent writer transaction).
- **R7**: Backup HTTP boundary uses current database authority and refuses legacy restore without effects.
- **R8**: Captures a deterministic, sorted SQL-null manifest even with many null-JSON rows (`ORDER BY "id"` fix validation).

#### Critical Discovery: PostgreSQL Concurrency Deadlock Pitfall
During this investigation, `recovery-test` was run while a background dev server (`node scripts/restro-env.mjs dev`) was actively running on the workstation. The test failed with:
```
PrismaClientKnownRequestError: Raw query failed. Code: `40P01`. Message: `ERROR: deadlock detected
DETAIL: Process 41315 waits for AccessExclusiveLock on relation 16693 of database 16384; blocked by process 41314.
Process 41314 waits for AccessExclusiveLock on relation 16693 of database 16384; blocked by process 41315.`
at tests/recovery.integration.test.ts:129:7
await db.$executeRawUnsafe(`DROP TRIGGER "${trigger}" ON "AuditLog"`);
```
- **Root Cause**: Test R4 tests rollback by installing a temporary trigger on `AuditLog` (`CREATE TRIGGER ... BEFORE INSERT ON "AuditLog"`) and removing it in `finally` (`DROP TRIGGER ... ON "AuditLog"`). In PostgreSQL, creating or dropping a trigger acquires an `AccessExclusiveLock` on the target table. When the development server or another background client has active queries or transactions touching `AuditLog`, PostgreSQL detects a lock inversion and raises deadlock `40P01`. Because R4 rolled back prematurely, subsequent tests R5–R8 encountered missing fixtures.
- **Resolution**: When the test is run with no competing clients on `127.0.0.1:55439`, all 8 test cases pass consistently and repeatably in ~4 seconds.
- **Operational Requirement**: **Before executing `recovery-test`, verify that no development servers (`npm run restro:dev`, `scripts/restro-env.mjs dev`, or Next.js servers) are actively issuing requests against `127.0.0.1:55439`.**

#### Verified Execution Output (Stand-alone Clean State)
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

---

### 3.3 Command 3: `npm.cmd run typecheck`

#### Mechanism
- **Script**: Defined in `package.json`:
  ```json
  "typecheck": "tsc -p backend/tsconfig.json --noEmit --incremental false && tsc -p frontend/tsconfig.json --noEmit --incremental false"
  ```
- **Windows Command Shell**: On Windows PowerShell or CMD, `npm.cmd` invokes the Windows batch wrapper `npm.cmd`.
- **Pass Criteria**: Both TypeScript compilations complete without syntax or type errors. Exit code `0`.

#### Prerequisites
1. Dependencies in `node_modules` fully installed.
2. Prisma client generated: `@dynapos/db` types must be present in `node_modules/@dynapos/db/index.d.ts` and `node_modules/@prisma/client`. (Generated via `npm run prisma:generate`).
3. Next.js environment types present (`next-env.d.ts`).

#### Verified Execution Output
```
> restroinn@1.0.0 typecheck
> tsc -p backend/tsconfig.json --noEmit --incremental false && tsc -p frontend/tsconfig.json --noEmit --incremental false
```
- **Diagnostics**: 0 errors, 0 warnings.
- **Exit Code**: `0`
- **Execution Duration**: ~16.5s.

---

### 3.4 Command 4: `node node_modules/vitest/vitest.mjs run --exclude tests/commerce.integration.test.ts --exclude tests/recovery.integration.test.ts`

#### Mechanism
- **Invocation**: Direct Node invocation of the Vitest runner CLI, passing explicit exclusions for the two database-backed integration suites (`commerce.integration.test.ts` and `recovery.integration.test.ts`).
- **Configuration**: `vitest.config.mts` sets `resolve.alias: { "@": "./backend/src" }`, `environment: "node"`, and `fileParallelism: false`.
- **Scope**: 6 test files containing 30 isolated unit tests:
  1. `tests/browser-request.test.ts` (4 tests): Idempotency key tracking, localStorage response recovery, actor isolation.
  2. `tests/commerce-transaction.test.ts` (5 tests): Durable idempotency check, serializable boundary, retry on P2034 serialization conflict, bounded retry exhaustion.
  3. `tests/recovery-format.test.ts` (5 tests): AES-256-GCM encryption nondeterminism, schema hash authentication, legacy JSON rejection, migration identity binding, legacy restore 409 rejection.
  4. `tests/commerce-policy.test.ts` (8 tests): Branch tenant access denial, role authorization, payment reconciliation (cash vs split vs card reference), floating-point decimal precision.
  5. `tests/session.test.ts` (3 tests): JWT callback tampering immunity, database authority resolution, inactive user revocation.
  6. `tests/database-verification.test.ts` (5 tests): Isolated database URL syntax enforcement, 14-test assertion threshold, disposable restore target validation.

#### Verified Execution Output
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

    Isolate  6 workers spawned · ~569ms startup each (spawn + environment, per file)
             at least ~2.84s faster with isolate: false — reuses workers across files instead of one per file
```
- **Exit Code**: `0`

---

## 4. Environment Prerequisites & Container State

### 4.1 Container Topology & Health Checks
Prior to running the verification suites, both PostgreSQL containers must be running and healthy:

```powershell
docker compose --env-file .env.restro.local -p prayassh-restro -f compose.restro.yml up -d --wait
docker compose --env-file .env.restro-restore.local -p prayassh-restro-restore -f compose.restro-restore.yml up -d --wait
```
Verified running containers:
- `prayassh-restro-restro-db-1`: Image `postgres:15-alpine`, Port `127.0.0.1:55439->5432/tcp`, status `Up (healthy)`.
- `prayassh-restro-restore-restro-restore-db-1`: Image `postgres:15-alpine`, Port `127.0.0.1:55440->5432/tcp`, status `Up (healthy)`.

### 4.2 Migration Alignment
Both databases must have applied the exact migration sequence:
1. `202610300001_retail_baseline`
2. `202610300002_commerce_hardening`

If not applied:
- For source (55439): `node scripts/restro-env.mjs migrate`
- For target (55440): `node scripts/restro-restore-env.mjs migrate`

### 4.3 Environment Files
- `.env.restro.local`:
  - `RESTRO_DB_PASSWORD` (24-byte hex)
  - `DATABASE_URL=postgresql://restro_dev:<password>@127.0.0.1:55439/restro_test`
  - `DIRECT_URL=postgresql://restro_dev:<password>@127.0.0.1:55439/restro_test`
  - `TEST_DATABASE_URL=postgresql://restro_dev:<password>@127.0.0.1:55439/restro_test`
  - `BACKUP_ENCRYPTION_KEY` (32-byte / 64-hex key)
  - `BACKUP_DIRECTORY=C:\projects\pos\scratch\restro-backups`
- `.env.restro-restore.local`:
  - `RESTRO_RESTORE_DB_PASSWORD` (24-byte hex)
  - `RESTORE_TARGET_DATABASE_URL=postgresql://restro_restore:<password>@127.0.0.1:55440/restro_restore`

---

## 5. Potential Pitfalls, Shell Specifics & Mitigation Guide

### 5.1 Pitfall 1: Concurrency / Lock Deadlock on `AuditLog`
- **Symptom**: `recovery-test` fails at test R4 with `Code 40P01: deadlock detected`.
- **Cause**: Active queries or background write loops from the running Next.js dev server on port 3001 holding locks while R4 executes `CREATE TRIGGER` / `DROP TRIGGER` (which require `AccessExclusiveLock`).
- **Mitigation**: Shut down or pause dev servers before running `recovery-test`. Verify active queries using:
  ```powershell
  docker exec prayassh-restro-restro-db-1 psql -U restro_dev -d restro_test -c "SELECT pid, state, query FROM pg_stat_activity WHERE state != 'idle';"
  ```

### 5.2 Pitfall 2: Windows Symlink Privilege
- **Symptom**: Check 25 in rehearsal outputs `NOT EXERCISED: operating system denied symlink creation`.
- **Cause**: On Windows, creating symlinks without Developer Mode or administrator privileges raises `EPERM`.
- **Mitigation**: `scripts/rehearse-recovery.ts` lines 234–237 already include an explicit try-catch fallback. If symlinks cannot be created, it passes gracefully using static path confinement validation (`lstat` / `realpath`).

### 5.3 Pitfall 3: npm vs npm.cmd on Windows
- **Symptom**: In PowerShell, executing `npm run typecheck` may fail or hang if the PATH resolution picks up an ambiguous binary or shell script.
- **Mitigation**: Always invoke `npm.cmd run typecheck` on Windows.

### 5.4 Pitfall 4: Vitest Argument Exclusions
- **Symptom**: In certain Windows shells, unquoted `--exclude` arguments with wildcards or forward slashes can be mangled.
- **Mitigation**: Use exact path syntax:
  `node node_modules/vitest/vitest.mjs run --exclude tests/commerce.integration.test.ts --exclude tests/recovery.integration.test.ts`
  which executes Node directly and avoids shell globbing surprises.

---

## 6. Phase 0 Gate Assessment & Phase 1 Readiness Evaluation

### 6.1 Phase 0 Exit Criteria Audit

| Exit Criterion (`PHASE_0_FOUNDATION_RECOVERY.md`) | Verified Evidence | Status |
|---|---|---|
| **Zero destructive restore paths in production or staff UI** | In `backup-service.ts`: `executeRestore` throws HTTP 409 `Live overwrite restore is disabled`. In `backup/route.ts`: POST restore returns 409. UI settings pages display read-only metadata and honest "NOT_REHEARSED" indicators. Negative tests verify that tampering and re-restoration fail without writes. | **SATISFIED** |
| **All 8 PostgreSQL recovery regression test cases pass cleanly** | `node scripts/restro-env.mjs recovery-test` passes all 8 test cases (R1–R8) with 0 failures and 0 skips. | **SATISFIED** |
| **Rehearsal reconciliation asserts identical row counts, balance invariants, and rollback safety** | `node scripts/restro-restore-env.mjs rehearse` passes 41/41 checks across two independent PostgreSQL clusters, verifying 41 tenant models, financial invariants, and byte-for-byte source preservation. | **SATISFIED** |
| **Complete documentation in `docs/hospitality/RECOVERY_STATUS.md`** | Detailed technical write-up, architectural boundaries, and operator guidelines are documented in `docs/hospitality/RECOVERY_STATUS.md`. | **SATISFIED** |

### 6.2 Remaining Gaps & Release Blockers (As Documented in Status Reports)
While Phase 0 local foundation criteria are satisfied, the following operational and architectural gaps remain before production release:
1. **Cluster-level PITR (Layer 1)**: Tenant logical recovery does not replace full-instance disaster recovery (base backup + continuous WAL archiving / Point-In-Time Recovery).
2. **Key Escrow & Off-Host Storage**: Recovery keys and archives currently reside in local development paths (`scratch/restro-backups`). Production requires off-host object storage (S3/GCS), access logging, dual-custodian key escrow, and documented rotation procedures.
3. **Windows ACLs & File Permissions**: Local archives use POSIX `0600` permissions; Windows NT ACLs are not hardened.
4. **Float-to-Decimal Financial Migration**: Monetary values currently use IEEE 754 floating-point representations in Prisma (`Float`); decimal precision hardening remains a requirement for retail/hospitality settlement.

### 6.3 Conclusion & Recommendation
The verification test commands are robust, reproducible, and fully pass all criteria on the local development environment. Phase 0 is verified and ready for formal gate sign-off, enabling the team to advance to Phase 1 planning and design.
