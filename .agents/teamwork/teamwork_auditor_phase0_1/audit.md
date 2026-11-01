# Forensic Integrity Audit Report: Phase 0 Foundation Recovery

**Work Product**: Phase 0 Foundation Recovery Artifacts, Test Suites, and Phase 0 Readiness Report (`docs/hospitality/PHASE_0_READINESS_REPORT.md`)  
**Profile**: General Project  
**Integrity Mode**: Development (per `ORIGINAL_REQUEST.md`)  
**Verdict**: **CLEAN**  
**Auditor**: `teamwork_auditor_phase0_1`  
**Date**: 2026-10-31  

---

## 1. Executive Summary

A comprehensive forensic integrity audit was conducted across the Phase 0 Foundation Recovery implementation, test execution infrastructure, cryptographic models, and the Phase 0 Readiness Report (`docs/hospitality/PHASE_0_READINESS_REPORT.md`).

All four core audit dimensions required by dispatch were independently investigated:
1. **Audit for Hardcoding / Fabrication**: Verified that `scripts/rehearse-recovery.ts` and `tests/recovery.integration.test.ts` execute authentic PostgreSQL queries, transactions, dynamic triggers, and exclusion invariants against real containers. Zero hardcoded results, mock bypasses, or fabricated pass flags exist.
2. **Audit for Live Overwrite Disabling Authenticity**: Verified that live in-place restore has been completely excised. `BackupService.executeRestore` unconditionally throws an HTTP 409 `BackupError`, the Next.js API route returns HTTP 409 without database mutation, and the frontend UI eliminates all restore inputs and controls.
3. **Audit for Cryptographic & Invariant Integrity**: Verified AES-256-GCM authenticated encryption with Additional Authenticated Data (AAD) binding metadata, SHA-256 schema hash enforcement across all 41 Prisma models, and strict Prisma migration lineage validation (`_prisma_migrations` name and checksum matching).
4. **Audit for Report Accuracy**: Verified that `docs/hospitality/PHASE_0_READINESS_REPORT.md` faithfully reflects repository code, container topology, command outputs, concurrency hazards (e.g. `40P01` deadlock on `AuditLog`), and production release blockers (G1–G8).

All empirical verification commands were executed directly by the auditor, passing 100% cleanly with zero skips and exit code 0.

---

## 2. Phase Results Matrix

| # | Forensic Check Name | Scope | Result | Empirical Status |
|---|---|---|:---:|---|
| **1** | Hardcoded Output Detection | `scripts/rehearse-recovery.ts`, `tests/recovery.integration.test.ts` | **PASS** | No hardcoded result strings or fake counters; results dynamically computed from live PostgreSQL container responses. |
| **2** | Facade Implementation Detection | `backend/src/lib/backup-service.ts`, `backend/src/lib/backup-format.ts` | **PASS** | Full relational traversal, topological sorting, RepeatableRead snapshotting, Serializable restore transactions, and dynamic PL/pgSQL triggers implemented. |
| **3** | Live Overwrite Elimination | `backup-service.ts:143-146`, `route.ts:25`, `page.tsx:37-39` | **PASS** | In-place restore is permanently disabled; unconditionally throws HTTP 409 before reading files or touching DB. UI has zero restore controls. |
| **4** | Cryptographic & AAD Integrity | `backend/src/lib/backup-format.ts:94-121` | **PASS** | AES-256-GCM cipher with random 12-byte nonce, 16-byte auth tag, and AAD envelope binding schemaHash, businessId, and migration list. Flipped bit, truncation, and metadata tampering cleanly rejected. |
| **5** | Schema Hash & Lineage Binding | `backup-format.ts:20,45`, `backup-service.ts:33-36,122` | **PASS** | SHA-256 digest of 41 topologically sorted Prisma models; `_prisma_migrations` finished migration history validated inside restore transaction before any write. |
| **6** | Pre-populated Artifact Detection | `scratch/*.json` | **PASS** | Test runner output files in `scratch/` are generated dynamically by child processes and verified by JSON report assertion schemas. |
| **7** | Empirical Rehearsal Execution | `node scripts/restro-restore-env.mjs rehearse` | **PASS** | **41 / 41 checks passed** against independent disposable PostgreSQL container (`127.0.0.1:55440`), exit code 0. |
| **8** | Empirical Recovery Test Suite | `node scripts/restro-env.mjs recovery-test` | **PASS** | **8 / 8 tests passed, 0 skipped** against dev PostgreSQL container (`127.0.0.1:55439`), exit code 0. |
| **9** | Workspace Typecheck Execution | `npm.cmd run typecheck` | **PASS** | **0 errors, 0 warnings** across backend and frontend workspaces (`--incremental false`), exit code 0. |
| **10** | Empirical Unit Suite Execution | `node node_modules/vitest/vitest.mjs run --exclude ...` | **PASS** | **30 / 30 tests passed** across 6 files, exit code 0. |
| **11** | Readiness Report Accuracy | `docs/hospitality/PHASE_0_READINESS_REPORT.md` | **PASS** | Verifiably accurate; accurately documents the 41-check breakdown, R1–R8 cases, concurrency deadlock diagnosis, and G1–G8 production blockers. |

---

## 3. Detailed Forensic Findings

### 3.1 Hardcoding & Fabrication Analysis
- **`scripts/rehearse-recovery.ts`**:
  - Validates that source (`127.0.0.1:55439`) and target (`127.0.0.1:55440`) belong to distinct PostgreSQL clusters by querying `pg_control_system()` (`system_identifier`), `current_database()`, and `current_user`.
  - Computes per-table MD5 fingerprints using PostgreSQL aggregations (`SELECT count(*)::int AS n, coalesce(md5(string_agg(t::text, '|' ORDER BY t."id")), '') AS h FROM ...`).
  - Executes live financial aggregations (`Sale.total`, `Payment.amount`, `Customer.balance`, `ProductStock.quantity`) via raw parameterized SQL.
  - Invariant violation checks are computed directly in SQL (e.g. `abs(s."paidAmount" - coalesce((SELECT sum(p."amount")...)) > 0.005`).
  - Assertions are evaluated against live data: `checks.push({ name, ok, detail })`; exit code 1 is raised if `failed.length > 0`.
- **`tests/recovery.integration.test.ts`**:
  - Connects to PostgreSQL using a live `PrismaClient({ datasourceUrl: target })`.
  - The only mocked module is `@/auth` (to supply mock session identity for API route role checks). The database layer is 100% live.
  - Test R4 dynamically creates a real PostgreSQL trigger on `AuditLog` using `CREATE FUNCTION ... LANGUAGE plpgsql` and `CREATE TRIGGER ... BEFORE INSERT ON "AuditLog"` to test atomic transaction abort.
  - Test R6 spins up two real PostgreSQL client connections (`db` and `writer`), queries `pg_backend_pid()`, and asserts MVCC snapshot isolation using `pg_stat_activity`.
  - Test R8 creates 8 database rows, rewrites them to randomize heap allocation, and verifies deterministic `ORDER BY "id"` JSON null manifest collation.

### 3.2 Live Overwrite Disabling Authenticity
- **Backend Service Layer (`backend/src/lib/backup-service.ts`)**:
  - `BackupService.executeRestore` (lines 143–146) unconditionally throws:
    ```typescript
    static async executeRestore(businessId: string, filename: string): Promise<never> {
      void businessId; void filename;
      throw new BackupError("Live overwrite restore is disabled. Use isolated operator recovery into an absent tenant.", 409);
    }
    ```
  - `TenantBackupStore.restoreMissingTenant` (line 123) checks if the tenant exists in the target database (`if (await tx.business.findUnique({ where: { id: businessId } }))`) and immediately aborts with HTTP 409 before writing any row.
- **API Boundary (`backend/src/app/api/v1/settings/backup/route.ts`)**:
  - In `POST`, if `parsed.data.action === "restore"`, it invokes `BackupService.executeRestore`, which throws HTTP 409, converted by the failure handler into `NextResponse.json({ error: ... }, { status: 409 })`.
- **Frontend Boundary (`frontend/src/app/dashboard/settings/backup/page.tsx`)**:
  - All file upload inputs, drag-and-drop zones, and restore buttons are completely eliminated.
  - UI copy explicitly states: *"Live overwrite restore is disabled. Operator recovery requires an isolated database and an absent tenant."*

### 3.3 Cryptographic & Invariant Integrity
- **AES-256-GCM Envelope Encryption (`backend/src/lib/backup-format.ts`)**:
  - Key validation requires a 64-character hex string (32 bytes).
  - Generates a cryptographically strong 12-byte random nonce via `randomBytes(12)`.
  - Additional Authenticated Data (AAD) binds the unencrypted metadata (format, version, businessId, createdAt, schemaHash, migrations array, and per-model counts).
  - Authentication tag (16 bytes) is verified via `decipher.setAuthTag(tagBytes)`. Tampering with any byte of ciphertext or metadata triggers an OpenSSL authentication error, throwing `BackupError("Archive is invalid, incomplete, legacy or failed authentication")`.
- **Schema Hash Enforcement**:
  - Topologically sorts 41 Prisma tenant models (`backupModels`).
  - Computes `schemaHash = createHash("sha256").update(JSON.stringify(backupModels)).digest("hex")`.
  - Verified prior to decryption in `openSnapshot` and validated inside `validateSnapshot`.
- **Migration Lineage Validation**:
  - Snapshot captures applied migrations from `_prisma_migrations` (`SELECT migration_name, checksum FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name`).
  - Restore transaction verifies that target migrations match archive migrations exactly before executing the first insert statement.

### 3.4 Accuracy of `PHASE_0_READINESS_REPORT.md`
- **Dual Gate Matrix**: The differentiation between Phase 1 development (CONDITIONAL GO) and production release (HARD NO-GO) accurately matches the operational boundaries established in `RECOVERY_STATUS.md`.
- **Test Results**: All documented test outputs, test counts (41 rehearsal checks, 8 recovery tests, 0 typecheck errors, 30 unit tests), and timing metrics accurately correspond to empirical executions.
- **Concurrency & Deadlock Documentation**: The report accurately documents the PostgreSQL `40P01` deadlock hazard caused by background Next.js development processes contending with `AuditLog` during the dynamic trigger test R4, providing the required pre-flight mitigation protocol.
- **Production Blockers (G1–G8)**: The report comprehensively and honestly catalogues all 8 architectural blockers (Layer 1 PITR absence, cutover runbook absence, static key custody, local storage durability, Windows NTFS ACLs, 32 MiB memory cap, Float currency schema, and passwordHash archiving).

---

## 4. Raw Empirical Verification Evidence

### 4.1 Command 1: Recovery Rehearsal (`node scripts/restro-restore-env.mjs rehearse`)
```text
PASS  source and target are different PostgreSQL clusters, databases and roles — source restro_test / target restro_restore
PASS  target migration history equals source (names and checksums) — 202610300001_retail_baseline, 202610300002_commerce_hardening
PASS  target holds no trace of the tenant to recover or of tenant B
PASS  archive covers all 41 tenant models and only tenant A — 70 rows, 44736 bytes
PASS  archive is encrypted and carries the migration identity
PASS  backup status never claims restore verification
PASS  source database byte-for-byte unchanged by backup
PASS  refused without writes: corrupted ciphertext — Archive is invalid, incomplete, legacy or failed authentication
PASS  refused without writes: truncated archive — Archive is invalid, incomplete, legacy or failed authentication
PASS  refused without writes: tampered manifest counts — Archive is invalid, incomplete, legacy or failed authentication
PASS  refused without writes: wrong encryption key — Archive is invalid, incomplete, legacy or failed authentication
PASS  refused without writes: legacy plaintext JSON export — Archive is invalid, incomplete, legacy or failed authentication
PASS  refused without writes: incompatible schema hash — Snapshot tenant or schema mismatch
PASS  refused without writes: incompatible migration history (authenticated archive, different schema lineage) — Target database migration history differs from the archive; recovery refused before any write
PASS  refused without writes: authenticated archive missing the Payment table — Incomplete snapshot model manifest
PASS  refused without writes: tenant B identity against tenant A archive — Snapshot tenant or schema mismatch
PASS  refused without writes: unsafe filename "../outside.pbackup" — Invalid archive filename; legacy JSON recovery is unsupported
PASS  refused without writes: unsafe filename "..\\outside.pbackup" — Invalid archive filename; legacy JSON recovery is unsupported
PASS  refused without writes: unsafe filename "C:\\projects\\pos\\scratch\\rehearsal-14c..." — Invalid archive filename; legacy JSON recovery is unsupported
PASS  refused without writes: unsafe filename "backup-1c77f2b5-bc7a-4634-aa5b-27851b..." — Invalid archive filename; legacy JSON recovery is unsupported
PASS  refused without writes: unsafe filename "backup-not-a-uuid.pbackup" — Invalid archive filename; legacy JSON recovery is unsupported
PASS  refused without writes: unsafe filename "nul" — Invalid archive filename; legacy JSON recovery is unsupported
PASS  refused without writes: unsafe filename "" — Invalid archive filename; legacy JSON recovery is unsupported
PASS  refused without writes: missing archive file — Archive unavailable
PASS  refused without writes: symlink escaping the backup directory — Archive path is not confined
PASS  refused without writes: oversized archive — Invalid archive file or size
PASS  restore recorded exactly one recovery audit entry
PASS  entity counts equal for all 41 models — 70 rows
PASS  every restored row equals its source row (IDs, timestamps, values, SQL-vs-JSON nulls) — 41/41 models identical
PASS  invoice, payment, balance, ledger, stock and batch totals identical source vs target — {"saleTotal":"4455.990000","salePaid":"2075.250000","paymentTotal":"2075.250000","customerBalance":"2380.740000","supplierBalance":"75.500000","customerLedgerDebit":"2380.740000","supplierLedgerCredit":"75.500000","stockQuantity":"50.000000","batchQuantity":"50.000000","receivable":"2380.740000"}
PASS  target invariants hold: payments match paidAmount, stock matches batches, receivable matches customer balance, no orphans — {"paymentsVsPaidAmount":"0","stockVsBatches":"0","receivableVsCustomerBalance":"0","orphanSaleItems":"0","orphanLogicalAuditBranch":"0","orphanReturnItemProducts":"0"}
PASS  source satisfies the same invariants (rehearsal fixtures are internally consistent)
PASS  expected synthetic totals: receivable 2380.74, payments 2075.25, stock 50 across products — receivable 2380.740000, payments 2075.250000, stock 50.000000
PASS  audit history and request-deduplication records preserved — 4 audit, 3 request results
PASS  unrelated tenant C in the target is untouched (all 41 models, every row)
PASS  tenant B (never restored) has no rows in the target
PASS  restore wrote only the recovered tenant's tables — 41 tables changed
PASS  refused without writes: second restore of an already-present tenant (no overwrite, no delete) — In-place restore is disabled; recover only into an absent tenant
PASS  target fingerprint before the first recovery equals its state before any negative case
PASS  source database unchanged after the whole backup + restore + negative sequence
PASS  source returned exactly to its pre-rehearsal content after generated-ID cleanup

Rehearsal: 41/41 checks passed; timings ms {"seedSource":526,"seedTargetUnrelatedTenant":362,"capture":215,"backupWrite":207,"loadAndValidateArchive":8,"restoreTransaction":287,"postRestoreCapture":261,"totalRehearsal":7916}; report scratch\rehearsal-results-9235d517-ceb0-414e-8572-943dc58ed455.json
Process exit code: 0
```

### 4.2 Command 2: Recovery Integration Suite (`node scripts/restro-env.mjs recovery-test`)
```text
 RUN  v5.0.5 C:/projects/pos

 ✓ tests/recovery.integration.test.ts (8 tests) 3425ms
   ✓ PostgreSQL tenant recovery (8)
     ✓ R1 captures all 41 tenant models and authenticates encrypted archives without claiming rehearsal 22ms
     ✓ R2 rejects live overwrite, path traversal, foreign tenant, wrong key and tampered archives without writes 219ms
     ✓ R3 rejects incomplete manifests, duplicate IDs and foreign references before database writes 164ms
     ✓ R4 late audit failure rolls back every recovered table, including orphan-capable idempotency rows 500ms
     ✓ R5 recovers balances, payments, stock, batches, all history, IDs and SQL-vs-JSON nulls exactly 431ms
     ✓ R6 concurrent committed financial changes cannot tear the repeatable-read snapshot 257ms
     ✓ R7 backup HTTP boundary uses current database authority and refuses legacy restore without effects 468ms
     ✓ R8 captures a deterministic, sorted SQL-null manifest even with many null-JSON rows 372ms

 Test Files  1 passed (1)
      Tests  8 passed (8)
   Start at  20:46:35
   Duration  3.64s (tests 99%, import 1%)

JSON report written to C:/projects/pos/scratch/recovery-results-1c8ea61a-2b12-4f1d-9caf-25dc88d128b9.json
Recovery verification: 8 passed, zero skipped.
Process exit code: 0
```

### 4.3 Command 3: Full TypeScript Typecheck (`npm.cmd run typecheck`)
```text
> restroinn@1.0.0 typecheck
> tsc -p backend/tsconfig.json --noEmit --incremental false && tsc -p frontend/tsconfig.json --noEmit --incremental false

Process exit code: 0
```

### 4.4 Command 4: Isolated Unit Suites (`vitest`)
```powershell
node node_modules/vitest/vitest.mjs run --exclude tests/commerce.integration.test.ts --exclude tests/recovery.integration.test.ts
```
```text
 RUN  v5.0.5 C:/projects/pos

 ✓ tests/commerce-transaction.test.ts (5 tests) 26ms
 ✓ tests/browser-request.test.ts (4 tests) 32ms
 ✓ tests/recovery-format.test.ts (5 tests) 14ms
 ✓ tests/commerce-policy.test.ts (8 tests) 6ms
 ✓ tests/database-verification.test.ts (5 tests) 7ms
 ✓ tests/session.test.ts (3 tests) 4ms

 Test Files  6 passed (6)
      Tests  30 passed (30)
   Start at  20:47:11
   Duration  1.55s (import 63%, tests 15%, transform 14%, worker 7%)

Process exit code: 0
```

---

## 5. Forensic Verdict

**VERDICT: CLEAN**

No integrity violations, hardcoded test shortcuts, facade implementations, or fabricated outputs were detected. The Phase 0 Foundation Recovery artifacts, test execution suites, and Phase 0 Readiness Report verifiably adhere to all authenticity, cryptographic, and architectural constraints.
