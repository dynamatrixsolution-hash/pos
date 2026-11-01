# Tenant recovery milestone — 2026-10-31

> **Not production-ready.** This milestone delivers *tenant logical recovery* that has been rehearsed against a separate disposable PostgreSQL instance with synthetic data. It is not a disaster-recovery system. Nothing here touched production, imported a production dump, pushed, merged or deployed.

## Selected recovery strategy and supported scope

Two layers with different jobs. Only the second is implemented and rehearsed here.

| Layer | Purpose | Mechanism | Status |
|---|---|---|---|
| **1. Full-instance disaster recovery** | Lost server/volume/cluster, corruption, point-in-time rollback | PostgreSQL physical base backup + continuous WAL archiving (PITR), or scheduled cluster-level `pg_dump`/snapshots, stored off-host and encrypted | **NOT implemented, NOT rehearsed. Required before any release.** A JSON/logical export cannot replace it: it omits roles, migrations, platform onboarding rows, other tenants and uploads |
| **2. Tenant logical recovery** | Re-create **one tenant that is absent** from a same-schema database (lost tenant, rebuild a clone elsewhere, forensic copy) | Encrypted, authenticated, versioned per-tenant snapshot from one PostgreSQL repeatable-read transaction; additive restore in one serializable transaction | **Implemented; rehearsed on synthetic data** (below) |

**Supported:** restore of a tenant into a database whose finished Prisma migration history (names and checksums) and generated-schema hash are identical to the archive, where the tenant ID does not exist.
**Deliberately unsupported (disabled with an explicit 409 and UI text):** in-place restore over an existing tenant, partial/merge restore, deletion of live data, schema or migration upgrade during restore, restore of legacy plaintext JSON archives. Overwriting a live tenant would require a reviewed allocation/reconciliation design and is out of scope.

**Archive manifest (format v2):** `format`, `version`, tenant ID, creation time, generated-schema SHA-256, **finished migration identity (name + checksum, captured in the same snapshot transaction)**, and per-model row counts, all bound as AES-256-GCM additional authenticated data; the full payload is encrypted. Restore refuses any mismatch before it writes: schema hash (before decryption of rows), migration history (inside the restore transaction, before the first insert), tenant, key, tampering, size, filename.

**Attachments:** the repository has no server-side upload directory. Business logos, product images and payment-QR images are string columns. If a deployment stores them as inline data URLs, they are inside the archived rows (subject to the 32 MiB payload cap); if it stores externally hosted URLs or files, **those objects are not in any archive** and need their own object-storage versioning/backup and a reference check after restore. Which form production uses was **not verified**. Static assets in `frontend/public` are in source control.

## Rehearsal against a separate disposable target (this continuation)

**Topology.** Source = the existing restro development database (`127.0.0.1:55439/restro_test`, volume `prayassh-restro_restro_dev_data`, left in place). Target = a *new* container/volume/role/credential set created for this rehearsal: `compose.restro-restore.yml`, project `prayassh-restro-restore`, `127.0.0.1:55440/restro_restore`, volume `prayassh-restro-restore_restro_restore_data`, credentials in ignored `.env.restro-restore.local` (never printed). The rehearsal asserts that source and target differ in PostgreSQL system identifier (cluster), database and role. The launcher `scripts/restro-restore-env.mjs` and `restoreTargetUrl` refuse any other target, any non-loopback host, any query override, and the source port. The target was migrated with the two tracked migrations and its migration names/checksums were asserted equal to the source's. No volume was removed or reset. The source is only read by the backup; the rehearsal inserts its own synthetic fixtures there by generated ID and deletes only those IDs afterwards.

**Synthetic data.** Tenant A (the one backed up): one row in **every one of the 41 tenant models** (businesses, branches, users, products, stocks, batches, sales/items, payments, customer/supplier ledgers, purchases, sale/purchase returns, credit/debit notes, opening stock, stock transfers, audit logs, request-deduplication results, fiscal records, …) plus realistic extra volume: 3 batch-tracked products, 4 sales (paid, two partial, unpaid) with items and payments, 3 customer-ledger entries, 3 more audit rows, 2 more request results. **70 rows, 44,736-byte encrypted archive.** Models other than sales/payments/ledgers/stock/audit/request results have exactly one fixture row, so coverage of returns, notes, opening stock and transfers is structural, not volume. Tenant B (never restored) exists in the source. Tenant C is an unrelated synthetic tenant pre-loaded into the **target**.

**Result: 41/41 rehearsal checks passed, in 5 consecutive clean runs on the final code.**

| Verified | Evidence |
|---|---|
| Separate cluster/db/role; identical migration history | PostgreSQL `system_identifier`, `current_database()`, `current_user`; migration names + checksums compared |
| Entity counts | 41/41 models equal (70 rows) |
| Row-level fidelity | Every restored row of every model equals its source row (IDs, timestamps, Float values, SQL-NULL vs JSON-null) |
| Totals and balances (computed by SQL independently on each database) | sale total 4455.99; paid 2075.25 = payments 2075.25; customer receivable 2380.74 = customer balance = ledger debits; supplier balance 75.50 = ledger credits; stock 50.0 = batch sum 50.0 — identical source vs target |
| Invariants on the target | payments equal each sale's paidAmount; each stock projection equals its batches; receivable equals customer balance; no orphan sale items, return items or audit branches (all violation counts 0) |
| Audit and deduplication | audit rows and the 3 request-result rows preserved; exactly one `BACKUP_RESTORE` audit entry appended by recovery |
| Source untouched | Whole-database per-table row-count + md5 fingerprint: unchanged by backup, unchanged by the entire negative/restore sequence, and returned **exactly** to its pre-rehearsal state after generated-ID cleanup |
| Tenant isolation | Tenant C in the target is identical after the restore (all 41 models, every row, JSON-null markers); tenant B has no rows in the target; restore changed only the recovered tenant's tables |
| Corrupt/incompatible archives fail before any write (target fingerprint identical after each) | flipped ciphertext; truncated file; tampered manifest counts; wrong key; legacy plaintext JSON; wrong schema hash; authenticated archive with a different migration lineage (409); authenticated archive missing the Payment table (refused at seal); tenant B identity against tenant A archive; second restore of an existing tenant (409, no overwrite) |
| Unsafe paths | `../x`, `..\x`, absolute path, embedded traversal, non-UUID name, reserved name `nul`, empty name, missing file, symlink escaping the backup directory (**exercised**; Windows allowed creating it), oversized file |
| Access control | Existing R7: unauthenticated 401; MANAGER 403; legacy restore 409 with no effect; deactivated owner 401, using real database users |

**Measured duration** (synthetic, same-host loopback, 70 rows; not representative of production size): snapshot capture ≈ 0.2–0.4 s; encrypted write ≈ 0.2 s; archive validation/decrypt ≈ 0.01 s; restore transaction ≈ 0.25–0.35 s; whole rehearsal including seeding, 20+ negative cases and 4 fingerprint passes ≈ **10–13 s** (final-code runs: 10.0, 10.2, 10.7, 11.5, 12.8 s). These say nothing about large tenants (see limits).

### Defect found and fixed during the rehearsal

Before the fix, 4 of 5 rehearsal runs failed one check (`AuditLog` row equality); one passed by chance. Diagnosis (diagnostic output, not assumption): the `jsonDatabaseNulls` manifest was built from an `IN (...)` query with **no `ORDER BY`**, so key order followed physical row order and differed between clusters. The data was identical; the archive manifest was **nondeterministic**, and an exact-equality reconciliation exposed it. The single-row fixture in R1–R7 could never expose it. Fix: `ORDER BY "id"` in `TenantBackupStore.capture`. Regression test **R8** (8 SQL-null rows, rewritten so heap order ≠ key order) was run without the fix (**failed**) and with it (**passed**). After the fix, the rehearsal passed in all 7 subsequent runs (2 at the end of a mixed batch, then 5 clean).

### Procedure for an operator (isolated target only)

1. Confirm the archive file, its separate copy of the key, and the intended **absent** tenant ID. Treat the archive as highly sensitive: it contains the tenant's complete financial data **and the users' `passwordHash` values** (the whole `User` row is archived). They are protected only by the archive encryption; the old R1 assertion that the file does not contain "passwordHash" is vacuous for an encrypted file and proves nothing about payload contents. Excluding or separately protecting credential hashes is an open decision.
2. Provision a **separate** PostgreSQL instance at the same migration history (`prisma migrate deploy`, never the baseline CREATE against an existing install). Do not point recovery at a populated production database.
3. `node scripts/restro-env.mjs recovery restore <businessId> <backup-uuid.pbackup>` against the isolated target (rehearsal-only wiring). A tenant that exists returns 409; fix the cause, never delete to make it fit.
4. Reconcile before use: compare entity counts to the archive manifest, receivable vs customer balances, payments vs `paidAmount`, stock vs batches; review the one `BACKUP_RESTORE` audit row; reconcile external events after the snapshot time; then decide on cutover. **No approved production cutover procedure exists yet.**

### Backup retention and storage requirements (not yet met in production)

- Archives and the key live on **different** media; the key needs escrow (at least two custodians), documented rotation, and access logging. Losing the key makes every archive unreadable; there is no key ID or rotation support yet.
- Persistent **off-host** storage with a retention schedule (for example daily 14, weekly 8, monthly 12 — to be set from the agreed RPO/RTO and legal retention) and monitored success/failure alerts. The default `scratch/restro-backups` is local development only.
- Restrictive filesystem permissions or ACLs (POSIX 0600 is set; **Windows ACLs are not established**); restore tooling restricted to named operators.
- Layer 1 (cluster PITR) and its restore rehearsal with measured RPO/RTO must exist **in addition**; tenant archives are not a substitute.

## Changed files and exact verification (this continuation)

| File | Change |
|---|---|
| `backend/src/lib/backup-format.ts` | Manifest now carries and authenticates the finished-migration identity; validation rejects a missing/malformed one |
| `backend/src/lib/backup-service.ts` | Captures migration identity inside the snapshot transaction; restore refuses a migration-history mismatch (409) before the first write; deterministic `ORDER BY "id"` for the SQL-null manifest |
| `compose.restro-restore.yml` (new) | Disposable restore target: own project, volume, port 55440, role, credentials |
| `scripts/restro-restore-env.mjs` (new) | Guarded launcher: `init`, `db`, `migrate`, `rehearse`; refuses any other target |
| `scripts/database-verification.mjs` | `restoreTargetUrl` guard (loopback 55440/restro_restore/restro_restore, never the source) |
| `scripts/rehearse-recovery.ts` (new) | The 41-check rehearsal; writes `scratch/rehearsal-results-*.json` |
| `scripts/run-recovery-tests.mjs`, `tests/recovery.integration.test.ts` | Gate now requires **eight** executed cases; new R8 (deterministic manifest) |
| `tests/recovery-format.test.ts`, `tests/database-verification.test.ts` | Migration-identity unit case; target-guard unit case |

| Exact command | Result |
|---|---|
| `node scripts/restro-restore-env.mjs init` / `db` / `migrate` | Target created and healthy; both migrations applied |
| `node scripts/restro-restore-env.mjs rehearse` (5 clean consecutive runs, final code) | **41/41 checks passed each run**, exit 0 |
| `node scripts/restro-env.mjs recovery-test` | **8 executed / 8 passed / 0 failed / 0 skipped** |
| Same, with the `ORDER BY` fix temporarily removed | R8 **failed** (7 passed / 1 failed), as intended; fix restored |
| `node scripts/restro-env.mjs integration` (14-case commerce suite, rerun) | **14/14 passed, zero skipped** (node exit 0; expected error logs come from the tests' intentional failure paths) |
| `node node_modules/vitest/vitest.mjs run --exclude tests/commerce.integration.test.ts --exclude tests/recovery.integration.test.ts` | **30/30 passed**, six files |
| `npm.cmd run typecheck` | Backend and frontend passed |
| ESLint (`frontend/eslint.config.mjs`) on the ten changed/new code, script and test files | **0 errors, 0 warnings** |
| `git diff --check` | No whitespace errors (informational LF/CRLF notices only) |

Not rerun: the 60-pass race rounds, Next production builds (the changed files are backend library/scripts only; the preceding builds predate this change), Docker image build, remote CI. The rehearsal is **not** wired into CI because it needs a second PostgreSQL instance; CI still runs the single-database recovery suite.

> Counts in the older sections below (seven recovery cases, 28 unit tests, fingerprint `aad5466b…`) describe the earlier state and are superseded by this section and the refreshed `RECOVERY_WORKTREE.json`.

## Preserved hardening checkpoint

Local branch `restro` now contains checkpoint **`6078e686f84a2e5389bccb27bb4bc2a997b004d9`**, based on `565fad3c9d5f70b2c46e1daea0c7dfdb58b19943`. The commit contains the reviewed hardening code, migrations, tests and documentation. Credentials, databases, ignored artifacts and unrelated work were excluded; the working tree was clean immediately after that commit. Nothing was pushed, merged or deployed.

Before committing, all 250 raw file hashes matched the final tested manifest in `VERIFIED_WORKTREE.json`, aggregate **`659d4250254a1950fdf11353c88710467222feedd1fb6c1d82a84af4d70da880`**. The final 14/14 PostgreSQL report includes the strengthened T10/T14 persisted-state assertions. This preserves the verified checkpoint; recovery changes below are subsequent, uncommitted work. The original `AUDIT.md` remains the historical baseline audit.

## Implemented recovery boundary

The baseline `BackupService.executeRestore` deleted payments, stock, batches and other records omitted by its own export. This was a **critical data-loss blocker**. The replacement performs no live overwrite or deletion. Existing POST restore requests now return **409** before reading an archive or making changes; the UI no longer offers destructive restore or promises a JSON download from a metadata endpoint.

| Changed file / symbol | Implemented behavior | Verifying evidence |
|---|---|---|
| `backend/src/lib/backup-format.ts`: `backupModels`, `validateSnapshot` | Enumerates all 41 current tenant models; excludes platform onboarding requests. Requires exact model/field manifests, one tenant, unique identities, valid scalar types, same-schema hash, complete FK and selected logical links. Missing/foreign data fails closed | R1, R3; recovery format unit tests |
| Same: `sealSnapshot`, `openSnapshot` | AES-256-GCM encrypts the payload and authenticates tenant/schema/time/count metadata. Separate explicit 32-byte hex key; new random nonce per archive. Rejects legacy JSON, corruption, wrong key/tenant/schema. SHA-256 is a file identifier, not an encryption claim | R1–R3; unit authentication and legacy/schema tests |
| `backend/src/lib/backup-service.ts`: `TenantBackupStore.capture` | PostgreSQL repeatable-read transaction captures all models, including soft-deleted history, payments/provenance, ledgers, stock/batches, returns, adjustments, fiscal history and durable retry results. Preserves IDs, timestamps, Float values and SQL NULL versus JSON null | R1, R5, R6 |
| Same: `executeBackup`, `load`, `listBackups` | Absolute configured storage, restricted file mode, random filename, exclusive temporary write, file sync then rename. Confined filenames, size bound, symlink checks, authenticated listing. Invalid/legacy/foreign files are excluded. Metadata explicitly says integrity authenticated, recovery **NOT_REHEARSED** | R1–R2; configuration unit test |
| Same: `restoreMissingTenant` | Serializable, additive recovery into an **absent** tenant, in FK order, all rows plus recovery audit in one transaction. Any uniqueness/FK/write/audit failure rolls back. No ID remapping, balance recomputation, migration conversion or deletion | R4–R5 |
| `backend/src/app/api/v1/settings/backup/route.ts` | Current database authority; OWNER/SUPER_ADMIN only for complete tenant archives, no manager access. Typed safe failures; never prints archive contents or raw Prisma errors. Legacy restore returns 409 | R7 uses real PostgreSQL users and the real session-context helper; only the session identity source is mocked |
| Both settings pages | Show encrypted tenant snapshots, operator-only isolated recovery and honest rehearsal status. Remove upload/overwrite flows and misleading diagnostics | Typecheck, lint attribution and builds; browser interaction was not exercised |
| `scripts/restro-env.mjs`, `scripts/recover-restro-backup.ts` | Existing isolated URL guard precedes database imports. Explicit recovery configuration adds only missing development settings, never rotates an existing key. CLI accepts create or restore and refuses every other database target. Parser ignores blank/comment lines and reports child launch failures without secrets | Isolated commands executed; unit target guard coverage retained; CLI is not an approved production recovery tool |
| `scripts/run-recovery-tests.mjs`, `.github/workflows/restro-checks.yml` | Dedicated suite requires seven executed passes with zero skips; CI adds the recovery command after migrations and commerce verification, with no deployment job | Dedicated local command passed; remote CI was not run |
| `.dockerignore` | Excludes `scratch/` and encrypted archives from Docker build context | Source/diff inspection; no Docker image was built |

R1–R7 are the exact named cases in `tests/recovery.integration.test.ts`. These are real PostgreSQL tests, not mocked restore transactions. R1 asserts one row in **every** tenant model. R5 compares every restored scalar row and null marker exactly, allowing only one appended recovery audit. This establishes stored-value preservation for the synthetic graph, not historical accounting correctness.

## Isolated verification results

The existing `.env.restro.local` and existing `prayassh-restro` volume were reused. Docker engine 29.8.2 responded; `node scripts/restro-env.mjs db` reported Healthy. Only `127.0.0.1:55439/restro_test`, user `restro_dev`, was allowed. No init/reset, alternate database, baseline migration, production data or production credentials were used. Missing development-only encryption/storage settings were appended to the ignored file without printing secrets. No dependency/lockfile changes or schema migrations were introduced.

| Exact command / scope | Result |
|---|---|
| `node scripts/restro-env.mjs recovery-test` (final expanded run) | **7 executed / 7 passed / 0 failed / 0 skipped**, exit 0. JSON: `scratch/recovery-results-12607fb5-995b-4fea-80b3-57456ab1bffe.json` |
| R4 recovery failure | Database trigger rejects the final BACKUP_RESTORE audit. All 41 fixture identities remain absent, including RequestResult (no business FK). Trigger/function are removed in finally; identical restore subsequently succeeds in R5 |
| R6 concurrent snapshot | Real reader transaction pauses after its first Business SELECT while a separate Prisma client/connection commits sale/payment/customer/ledger updates. Distinct backend PIDs are asserted. Archive retains coherent old values; committed sale/payment amounts and customer balance are checked afterward |
| Fixture cleanup | Deletes only generated model IDs and the fixture business's audit rows, in reverse dependency order. An unrelated synthetic sentinel is checked before its own removal. No truncate, broad cleanup, manual-data deletion or database-volume reset |
| `node node_modules/vitest/vitest.mjs run --exclude tests/commerce.integration.test.ts --exclude tests/recovery.integration.test.ts` | **28 executed / 28 passed / 0 failed / 0 skipped**, six files, exit 0; includes four new recovery format/default-safety tests |
| `npm.cmd run typecheck` | Backend and frontend passed, exit 0 |
| ESLint with `frontend/eslint.config.mjs` on ten changed/new code/test/script files | Eight errors/eight warnings, all in the pre-existing main settings page. Every other selected file has zero diagnostics. Baseline attribution below; no introduced finding remains |
| `node scripts/restro-env.mjs backend-build` | Passed, exit 0. Existing Prisma CommonJS export and NFT tracing warnings remain |
| `node scripts/restro-env.mjs frontend-build` | Initial sandboxed build failed fetching existing Google Font; classified as network/build-environment failure, not an application test pass. Network-enabled retry **passed**, exit 0; existing NFT tracing warning remains |
| `git -c safe.directory=C:/projects/pos diff --check` | Passed; Git emits informational LF/CRLF notices |

Earlier attempts are not counted as successful verification: a Windows environment-parser failure prevented child startup (zero tests); it was fixed to ignore blank lines and report spawn errors. The first recovery fixture incorrectly supplied a nonexistent Payment.status field; transaction setup rolled back and six cases did not execute. The fixture was corrected to the actual schema without weakening assertions. An intermediate six-case suite then passed, followed by the seven-case final run above. These were harness issues, not demonstrated financial application defects.

The unchanged 14-case hardening and 60-race checks were **not rerun**. Their preserved evidence remains attached to the checkpoint. Recovery verification has its own manifest, `RECOVERY_WORKTREE.json`; it does not replace the earlier verified manifest or imply comprehensive endpoint coverage.

Final recovery code/config/test fingerprint: **`aad5466b4e5378700efdc82fa03f3dee1e2fffc02e23ce45481272237a722702`** across twelve files, raw byte hashes and aggregation recorded in that manifest. This identifies the uncommitted recovery state tested after `6078e68`; documentation and ignored/generated artifacts are outside the fingerprint. A final focused ESLint run on the nine selected files other than the existing main settings page exited 0 with zero diagnostics (apart from the informational root Pages-directory notice).

## Lint attribution

A detached separate worktree at `scratch/recovery-baseline` contains checkpoint `6078e68`, sharing the exact installed node_modules through a directory junction. The same ESLint binary/configuration inspected the same five pre-existing changed files. Baseline: **13 errors / 11 warnings**. Current corresponding files: **8 errors / 8 warnings**. The five new TypeScript/test/script files have zero diagnostics.

Remaining findings are the main settings page's six explicit-any errors, two state-in-effect errors, five unused-import warnings and three image warnings, all present in the baseline. The initial new backup-page state-in-effect finding and the newly unused toast import were fixed. No unrelated lint cleanup or dependency upgrade was performed. Raw JSON: `scratch/recovery-baseline-lint.json`, `scratch/recovery-lint.json`. The existing root Pages-directory notice is informational. Repository-wide lint is not claimed green.

## Remaining implementation gaps and release blockers

1. **Operational recovery is still a release blocker.** This is tenant logical recovery into an absent tenant, not PostgreSQL cluster backup/PITR. Agree RPO/RTO; establish persistent/offsite storage, retention, monitored scheduled backups, key escrow/rotation/access control, tested machine/volume loss and an operator-approved recovery/cutover procedure. Windows file modes alone do not establish restrictive ACLs. No approved production recovery command or live repair path exists.
2. Recover schema/migrations, database roles, deployment secrets, uploads/assets, platform onboarding records and external provider/fiscal state separately. Archives intentionally exclude these. Preserve provider provenance without treating it as renewed external confirmation. Reconcile any post-snapshot external events before resuming writes.
3. Recovery accepts only the exact generated Prisma schema hash. Existing-installation baseline adoption, historical drift and archive version upgrades require separate review and rehearsals. Incomplete old JSON archives cannot recover missing records; retain originals for controlled salvage, never invoke the legacy routine.
4. Current archive payload limit is 32 MiB unencrypted/64 MiB file; capture/listing are in memory and listing authenticates each archive. Larger tenants, paginated inventory, streaming, retention, key IDs and rotation need separate design/performance tests. Conflicting global IDs/unique fields fail the whole recovery; no automatic rename/remap is provided.
5. Filesystem and database commits cannot be atomic. A completed file may remain if subsequent BACKUP_CREATE audit insertion fails or the server crashes. An interrupted temporary write is not listed. Filesystem/directory durability, disk-full/permission failure, malicious filesystem replacement/symlink races, concurrent recovery attempts and crash/power-loss behavior have not been rehearsed. Storage must be restricted to trusted operators; logical corruption can still exist inside an authenticated archive.
6. **Float-money migration and historical reconciliation remain blockers.** Exact round-trip preservation proves neither decimal correctness nor correctness of old balances, stock posting or tax history. Monetary policy, allocations/refunds/reversals, retail regression fixtures and reconciliation precede restaurant settlement.
7. **Mock fiscal submission is not a real integration.** Real fiscal/provider verification, comprehensive endpoint authorization, legacy correction/refund gaps, client coordination, dependency vulnerabilities and runtime/container compatibility remain as documented in HARDENING_STATUS.md. No production-readiness claim is made.

No restaurant/hotel feature, financial migration, production access, push or deployment was performed. Recovery changes remain reviewable independently of the preserved hardening commit.
