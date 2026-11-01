# Authoritative Specification Mining & Phase 0 Foundation Recovery Gap Analysis

**Author**: Specification Miner Subagent (`teamwork_spec_miner_phase0_1`)  
**Date**: 2026-10-31  
**Working Directory**: `c:\projects\pos\.agents\teamwork\teamwork_spec_miner_phase0_1\`  
**Target Milestone**: Phase 0 Foundation Recovery Audit & Multi-Agent Operational Specifications  
**Authoritative Documents**:
- `docs/hospitality/phases/PHASE_0_FOUNDATION_RECOVERY.md`
- `docs/hospitality/RECOVERY_STATUS.md`
- `docs/hospitality/IMPLEMENTATION_PLAN.md`
- `docs/hospitality/HARDENING_STATUS.md`
- `docs/hospitality/LOCAL_DEVELOPMENT.md`
- `.agent/skill/uiuxskills.md`
- `.agent/skill/stack.md`
- `c:\projects\pos\.agents\teamwork\ORIGINAL_REQUEST.md`

---

## 1. Executive Summary & Phase 0 Gate Evaluation

### 1.1 Gate Evaluation: CONDITIONAL GO FOR PHASE 1 / HARD NO-GO FOR PRODUCTION RELEASE

Based on an exhaustive examination of the codebase, test suites, architecture contracts, and milestone documentation:

1. **For Phase 1 Development Progression (CONDITIONAL GO)**:
   - **Status**: **APPROVED TO PROCEED**.
   - **Rationale**: Phase 0 has successfully achieved its core local engineering objectives: eliminating destructive live overwrite paths in the UI and API, establishing an authenticated and encrypted tenant snapshot envelope (AES-256-GCM, format v2), and validating a 41-check end-to-end recovery rehearsal across 41 tenant models on a separate disposable PostgreSQL instance (`127.0.0.1:55440`). The 8-case recovery regression suite (`recovery-test`) and 14-case commerce hardening regression suite pass cleanly with zero skips.
   - **Preconditions**: Development in Phase 1 must proceed in the isolated development loopback environment (`127.0.0.1:55439/restro_test`). No production deployment or live data modification is authorized.

2. **For Production Release / Live Deployment (HARD NO-GO)**:
   - **Status**: **BLOCKED (RELEASE BLOCKERS ACTIVE)**.
   - **Rationale**: As explicitly documented in `RECOVERY_STATUS.md` and `IMPLEMENTATION_PLAN.md`, the recovery system implemented to date is **Tenant Logical Recovery** (Layer 2) for re-creating an absent tenant on a matching schema. It is **NOT** a full-instance disaster recovery system (Layer 1). Full cluster-level physical backup/continuous WAL archiving (PITR), agreed RPO/RTO targets, off-host persistent storage, key custody/escrow procedures, production cutover runbooks, credential exposure safeguards (`User.passwordHash`), and Windows ACL hardening have **NOT** been implemented or rehearsed.

---

## 2. Authoritative Specification Extraction

### 2.1 Requirements & Scope Extraction from `PHASE_0_FOUNDATION_RECOVERY.md`

| Requirement ID | Requirement Description | Documented Scope & Artifacts |
|---|---|---|
| **P0-OBJ-1** | Reproducible, isolated local dev environment | Guarded loopback PostgreSQL container (`127.0.0.1:55439/restro_test`), strict environment parser, no fallback to production credentials. |
| **P0-OBJ-2** | Eliminate unsafe live database overwrite paths | Hard-disable `BackupService.executeRestore` in API and UI with HTTP 409; remove UI file upload/overwrite inputs. |
| **P0-OBJ-3** | Authenticated, encrypted, tenant-isolated backup/recovery | AES-256-GCM envelope, SHA-256 schema hash binding, migration lineage binding, 41 tenant models captured in a single repeatable-read transaction. |
| **P0-OBJ-4** | Disaster recovery rehearsal on separate disposable target | Dedicated compose project (`compose.restro-restore.yml`, port `55440`), automated rehearsal harness (`scripts/rehearse-recovery.ts`). |
| **P0-ART-1** | `TenantBackupArchive` | Version 2 envelope containing encrypted payload, AEAD header metadata, migration identities, row counts, and JSON null flags. |
| **P0-ART-2** | `RequestResult` | Idempotency tracking entity ensuring durable replay and conflict detection. |
| **P0-ART-3** | `scripts/recover-restro-backup.ts` | Isolated operator CLI tool supporting `create` and `restore` actions against isolated targets. |
| **P0-ART-4** | `scripts/rehearse-recovery.ts` | 41-check end-to-end rehearsal and reconciliation test harness. |

### 2.2 Architectural Scope Extraction from `RECOVERY_STATUS.md`

`RECOVERY_STATUS.md` formalizes the dual-layer recovery architecture:

```
+-------------------------------------------------------------------------------------------------------+
| LAYER 1: Full-Instance Disaster Recovery (NOT IMPLEMENTED - RELEASE BLOCKER)                           |
| Purpose: Lost server/volume/cluster, catastrophic corruption, point-in-time recovery                  |
| Mechanism: PostgreSQL physical base backup + continuous WAL archiving (PITR), off-host encrypted       |
| Scope: PostgreSQL cluster, all databases, roles, migrations, platform tables, uploads, credentials    |
+-------------------------------------------------------------------------------------------------------+
                                                 |
                                                 v
+-------------------------------------------------------------------------------------------------------+
| LAYER 2: Tenant Logical Recovery (IMPLEMENTED & REHEARSED ON SYNTHETIC DATA)                          |
| Purpose: Re-create ONE absent tenant in a same-schema database (lost tenant, forensic clone)          |
| Mechanism: Encrypted (AES-256-GCM), authenticated, versioned per-tenant snapshot (format v2)          |
| Capture: Single PostgreSQL repeatable-read transaction across all 41 tenant models                   |
| Restore: Single serializable transaction into an absent tenant; additive only; no live overwrite     |
+-------------------------------------------------------------------------------------------------------+
```

#### Key Rules of the Implemented Recovery Boundary:
1. **Strict Absent-Tenant Constraint**: Restore only into a database where the target `businessId` does NOT exist. If present, returns HTTP 409 immediately without reading archive payload or modifying state.
2. **Strict Schema & Migration Lineage Binding**:
   - Manifest binds SHA-256 of all 41 Prisma datamodel models (`schemaHash`).
   - Manifest binds finished migration identities (`name` + `checksum`) from `_prisma_migrations`.
   - Restore validates `schemaHash` before decrypting rows; validates applied migrations within the restore transaction before the first table insert. Any mismatch throws HTTP 409.
3. **Payload & Size Constraints**:
   - Archive unencrypted payload cap: 32 MiB (`MAX_BACKUP_BYTES / 2`).
   - Archive total file cap: 64 MiB (`MAX_BACKUP_BYTES`).
   - In-memory serialization and deserialization.
4. **Attachments & External State Handling**:
   - Logo, product images, and QR images stored as string columns (data URLs or external links).
   - If stored as external URLs, the physical binary files are **NOT in the archive** and require separate object storage backup.

### 2.3 Milestone Context from `IMPLEMENTATION_PLAN.md`

`IMPLEMENTATION_PLAN.md` establishes the sequential roadmap and dependencies:
- **Baseline Checkpoint**: Preserved in git commit `6078e686f84a2e5389bccb27bb4bc2a997b004d9` on branch `restro`.
- **Preceding Hardening Milestone**: Closed critical data loss vectors (T10 negative payments clamped to zero, T14 improper status discards on cancellation/correction, concurrent checkout races, 14/14 database tests passing, 60 connection race witnesses).
- **Core Dependency Chain**:
  `Phase 0 (Baseline & Recovery)` ➔ `Phase 1 (Security & Authority)` ➔ `Phase 2 (Financial Core & Decimal Migration)` ➔ `Phase 3 (Restaurant MVP)` ➔ `Phase 4 (Kitchen KDS & Recipes)` ➔ `Phase 5 (Hotel Inventory & Stays)` ➔ `Phase 6 (Folio Settlement)` ➔ `Phase 7 (Guest Portal & QR)` ➔ `Phase 8 (Rollout & Pilot)`.

---

## 3. Multi-Agent Operating Model (`.agent/skill/uiuxskills.md` & `.agent/skill/stack.md`)

The user prompt mandates organizing subsequent phases under a specialized four-agent structure: **Planner**, **Designer**, **Builder**, and **Tester**. This section details how each archetype derives its operational rules and constraints from the repository skill definitions.

```
+---------------------------------------------------------------------------------------------------+
|                                  MULTI-AGENT WORKFLOW TOPOLOGY                                    |
+---------------------------------------------------------------------------------------------------+
|                                                                                                   |
|  [ PLANNER ]                                                                                      |
|  * Deconstructs phase into verifiable milestones.                                                 |
|  * Defines invariant contracts, migration sequences, and compatibility adapters.                 |
|  * Maps dependencies to IMPLEMENTATION_PLAN.md.                                                   |
|         |                                                                                         |
|         v                                                                                         |
|  [ DESIGNER ]                                                                                     |
|  * Enforces UI/UX Design System (.agent/skill/uiuxskills.md): Palette, Typography, Tokens.       |
|  * Designs Operational Screen Ergonomics (POS 70/30 layout, KDS rounds, Hotel room matrix).       |
|  * Restricts components via Anti-Pattern Codex (no over-padding, no inner scrolls, no brass misuse)|
|  * Specifies Frontend Tech Stack (.agent/skill/stack.md): Next.js 16, React 19, Tailwind v4.     |
|         |                                                                                         |
|         v                                                                                         |
|  [ BUILDER ]                                                                                      |
|  * Backend (.agent/skill/stack.md): Route handlers, Auth.js v5 authority, Idempotency-Key engine.  |
|  * Concurrency: Serializable transactions (P2034 retry loop), Transactional Outbox.               |
|  * Persistence: Decimal for all currency (no Float!), (businessId, id) composite keys.             |
|  * Hotel Concurrency: btree_gist GiST exclusion constraints on RoomAllocation tstzrange.          |
|  * Hardware: Dual ESC/POS 80mm/58mm thermal printing, KDS ticket reconnection.                    |
|         |                                                                                         |
|         v                                                                                         |
|  [ TESTER ]                                                                                       |
|  * Direct API Adversarial Security Tests: Tenant isolation, unassigned branch mutations, JWT mocks|
|  * Concurrency & Invariants: Real loopback PostgreSQL, parallel independent connections.          |
|  * Double-booking races, idempotent retry/conflict verification, audit rollback assertions.       |
|  * Quality Gates: Full TypeScript typecheck, Vitest unit/integration suites, ESLint verification.|
|                                                                                                   |
+---------------------------------------------------------------------------------------------------+
```

### 3.1 Agent Responsibilities & Specification Mapping

#### 1. Planner Agent
- **Scope**: Phase sequencing, milestone definition, interface contracts, and safety boundary definition.
- **Authoritative Rules**:
  - Must sequence all features strictly according to `IMPLEMENTATION_PLAN.md`.
  - Must ensure non-destructive schema evolution: "expand ➔ backfill ➔ validate ➔ contract" (never destructive baseline CREATE or unreviewed drop).
  - Must enforce backward compatibility: existing retail route contracts (`/api/v1/sales`, etc.) act as compatibility adapters; new restaurant/hotel operations live under explicit namespaces (`/api/v1/restaurant/...`, `/api/v1/hotel/...`).
  - Mandatory offline scope boundary: mutations require online server confirmation unless explicit sync journals and terminal encryption are designed.

#### 2. Designer Agent
- **Scope**: User interface design, ergonomics, operational ergonomics, component blueprints, design tokens.
- **Authoritative Rules from `.agent/skill/uiuxskills.md`**:
  - **Design Philosophy**: *"Refined Hospitality Ergonomics"* — fine dining and heritage boutique hotel aesthetic (warm, calm, zero decorative clutter).
  - **Strict Palette Tokens**:
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
    - No over-padding: Page padding `p-4 sm:p-6` max; card padding `p-3.5 sm:p-4`; grid gaps `gap-3` or `gap-4` (never `gap-8`).
    - No inner scroll traps: No arbitrary fixed heights (`h-[600px]`); use `flex-1 min-h-0 overflow-y-auto`.
    - No rainbow shadows: Only `border border-border` (`#D8CEC1`) with `shadow-xs`/`shadow-sm` on floating cards, or `shadow-md shadow-[#6B2837]/20` on primary buttons.
    - No decorative frivolity: No gradients, confetti, or giant hero banners.
  - **Operational Ergonomics**:
    - *POS Layout*: 65–70% left catalog grid (instant autofocus search, category quick-switch, 1:1 or 4:3 cards capped at ~110px); 30–35% right sticky cart (sticky header, scrollable lines, inline steppers, full-width burgundy checkout button).
    - *KDS Ergonomics*: Grouped by Order Round with elapsed timer, high contrast readable from 3 meters, 1-tap state toggles (`QUEUED` ➔ `PREPARING` ➔ `READY`), Ochre `#946000` modifier callouts.
    - *Hotel Grid*: Clean matrix with floors on Y-axis, dates/rooms on X-axis, distinct state fills (vacant clean, occupied, vacant dirty, maintenance).

#### 3. Builder Agent
- **Scope**: Backend route implementation, database models, persistence invariants, frontend component construction.
- **Authoritative Rules from `.agent/skill/stack.md`**:
  - **Frontend**: Next.js 16 (`16.2.9`) App Router, React 19 (`19.2.4`), Tailwind CSS v4, Lucide React icons (16px or 18px), Framer Motion (dialogs/drawers only, no button animations), React Hook Form + Zod.
  - **Backend API**: Next.js Route Handlers in `backend/src/app/api/v1/` acting as thin controllers; Auth.js v5 with server-side database validation; mandatory `Idempotency-Key` engine bound to `RequestResult`.
  - **Database & Persistence**:
    - **No Float for Money**: Mandatory `Decimal` with explicit 2-digit rounding for all currency, balances, ledger entries, and tax lines.
    - **Composite Tenant Integrity**: Composite unique constraints `(businessId, id)` on all branch-scoped models.
    - **PostgreSQL GiST Exclusion Constraints**: `btree_gist` extension on PostgreSQL; `RoomAllocation` concurrency managed via `tstzrange(start, end, '[)')` to prevent overlapping room bookings.
    - **Outbox Pattern**: `OutboxEvent` written atomically with domain writes; decoupled workers for printing and KDS.
    - **Concurrency**: `serializableTransaction` helper with exponential backoff on Prisma P2034 conflicts (max 4 attempts).

#### 4. Tester Agent
- **Scope**: Security verification, database concurrency/invariants, adversarial race testing, frontend build/type validation.
- **Authoritative Rules from `.agent/skill/stack.md` & Phase Plans**:
  - **Adversarial Security**: Direct API tests attempting cross-tenant reads, unassigned branch mutations, deactivated user access, and JWT token manipulation (must fail with 401/403).
  - **Atomic Audit Invariant**: Artificially fail an audit logging insert; assert that the entire mutating business transaction rolls back cleanly.
  - **Real Database Testing**: All integration tests must execute against real disposable PostgreSQL containers on loopback ports; zero mocks for transactions, locks, or exclusion constraints.
  - **Race Testing**: Parallel independent connections exercising concurrent checkouts, room allocation GiST collisions, and idempotent replays.
  - **Code Health Gates**: Strict TypeScript typechecking (`tsc --noEmit`), unit test pass (Vitest 5.0.5), and ESLint verification.

---

## 4. Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Recovery Format | Version 2 Envelope Header | Authenticated metadata header binding format, version, businessId, creation timestamp, schemaHash, finished migrations, and per-table row counts. | `TenantSnapshot` object, 32-byte encryption key | Serialized JSON envelope with Base64 nonce, tag, ciphertext | Throws `BackupError` (400/503) on invalid payload, oversized archive, or missing key. | `backend/src/lib/backup-format.ts:22-36` |
| 2 | Recovery Format | Schema Hash Binding | SHA-256 digest of all 41 Prisma datamodel models filtered of non-tenant platform entities; validated before decryption. | Prisma DMMF models | 64-character hex string | Throws `BackupError("Snapshot tenant, version or schema mismatch")` on drift. | `backend/src/lib/backup-format.ts:20,45` |
| 3 | Recovery Format | Migration Lineage Binding | Array of finished Prisma migrations (`name` + `checksum`) captured inside the snapshot transaction; validated before restore writes. | `_prisma_migrations` query inside snapshot transaction | Array of `{ name, checksum }` | Throws `BackupError("Target database migration history differs...", 409)` if mismatch. | `backend/src/lib/backup-format.ts:21-25`, `backup-service.ts:33-36` |
| 4 | Recovery Format | AES-256-GCM Encryption | Symmetrical encryption of complete JSON snapshot payload with 12-byte random nonce and 16-byte authentication tag; header bound as AAD. | 32-byte hex key, snapshot JSON | Base64 ciphertext, nonce, tag | Throws `BackupError` on corrupted ciphertext, truncated file, or tampered counts. | `backend/src/lib/backup-format.ts:94-121` |
| 5 | Recovery Capture | Repeatable-Read MVCC Capture | Captures complete relational graph across all 41 tenant models in a single PostgreSQL transaction; immune to concurrent commits. | `businessId` | Validated `TenantSnapshot` | Throws `BackupError` on snapshot timeout or model extraction failure. | `backend/src/lib/backup-service.ts:47-69` |
| 6 | Recovery Capture | Deterministic SQL-Null Ordering | Generates sorted, deterministic manifest of SQL NULL vs JSON DbNull/JsonNull values using `ORDER BY "id"`. | Model JSON fields | `jsonDatabaseNulls` map ordered by row primary key | Manifest ordering remains stable across distinct PostgreSQL cluster physical heap layouts. | `backend/src/lib/backup-service.ts:59-63`, Regression test R8 |
| 7 | Recovery Restore | Additive Missing-Tenant Restore | Serializable transaction that inserts all archived records in topological FK dependency order into an absent tenant only. | `businessId`, archive filename | Database rows inserted; single `BACKUP_RESTORE` audit log created | Throws `BackupError(409)` if tenant exists, migration history differs, or FK violation occurs. | `backend/src/lib/backup-service.ts:117-137` |
| 8 | Recovery Storage | File Confinement & Path Protection | Restricts backup archives to absolute configured directory; rejects directory traversal, symlinks, non-UUID names, and OS reserved words. | Filename string | Verified absolute path handle | Throws `BackupError` on `..`, absolute paths, symlinks, or non-UUID filenames. | `backend/src/lib/backup-service.ts:75-87` |
| 9 | Recovery API | Database Authority Guard | Enforces that only active `OWNER` or `SUPER_ADMIN` users can create or list backups; checks live DB, not client JWT claims. | HTTP request, session context | JSON array of metadata or single creation metadata | Returns 401 for unauthenticated/inactive, 403 for non-owner, 409 for legacy restore. | `backend/src/app/api/v1/settings/backup/route.ts:11-35` |
| 10 | Recovery API | Safe Error Disguise | Redacts raw Prisma exceptions, stack traces, and database connection strings from HTTP responses; returns typed safe messages. | Internal error object | Sanitized JSON `{ error: message }` | Conceals underlying SQL state and cryptographic key diagnostics from API callers. | `backend/src/app/api/v1/settings/backup/route.ts:8-10` |
| 11 | Recovery CLI | Isolated Target Guard | Operator CLI enforces that commands run only against loopback PostgreSQL (`127.0.0.1:55439` or `55440`) with specific DB names. | Environment variables (`DATABASE_URL`, `TEST_DATABASE_URL`) | Command execution or process termination | Throws `Error("Refusing non-isolated database target")` if URL points to any other host. | `scripts/database-verification.mjs:1-24` |
| 12 | Recovery Harness | 41-Check Rehearsal & Reconciliation | Automated harness seeding synthetic tenants in source, backing up, testing 20+ negative attacks, restoring into target, and checking invariants. | Isolated source (`55439`) and target (`55440`) | Rehearsal JSON report (`scratch/rehearsal-results-*.json`), console logs | Exits with status code 1 if any check fails or row/balance mismatch is found. | `scripts/rehearse-recovery.ts:1-314` |
| 13 | UI/UX System | Refined Hospitality Palette | Global design tokens for warm, glare-free boutique hospitality UI (burgundy, ivory, porcelain, stone, espresso, brass). | CSS variables in `globals.css` | Styled components | Strict linting and design review against arbitrary hex codes and unapproved colors. | `.agent/skill/uiuxskills.md:9-35` |
| 14 | UI/UX System | Operational Status Token Isolation | Four strictly isolated status colors (Forest = Ready, Ochre = Pending, Red = Cancelled, Blue = Info). | Semantic status string | Isolated badge styling with matching background, border, text | Semantic status tokens must never be interchanged or swapped across domains. | `.agent/skill/uiuxskills.md:25-34` |
| 15 | UI/UX System | Operational Screen Ergonomics | Layout budgets for high-throughput interfaces (POS 70/30 split, KDS order round grouping, Hotel room matrix). | Viewport width/height | Density-optimized interface components | Anti-pattern rules reject inner scroll traps, large padding (`p-8`), and giant banners. | `.agent/skill/uiuxskills.md:159-186` |
| 16 | Persistence | PostgreSQL GiST Exclusion Constraint | `btree_gist` extension enforcing non-overlapping `tstzrange` intervals for room allocations (`RoomAllocation`). | `roomId`, `businessId`, `tstzrange(start, end, '[)')` | Exclusion constraint in PostgreSQL catalog | PostgreSQL rejects overlapping ranges with constraint violation error (mapped to 409). | `.agent/skill/stack.md:52-55`, `IMPLEMENTATION_PLAN.md:121-124` |
| 17 | Persistence | Idempotent Request Result Engine | Binds unique `(businessId, operation, key)` in `RequestResult` table; commits domain write and response together. | `Idempotency-Key` header, request hash | Cached response replay or new operation execution | Returns 428 if key missing; returns 409 if body/actor conflicts with existing key. | `.agent/skill/stack.md:39`, `IMPLEMENTATION_PLAN.md:27,95` |
| 18 | Concurrency | Bounded Serializable Retry Loop | Wraps Prisma transactions in serializable isolation; catches P2034 conflicts and retries with backoff up to 4 times. | Transaction worker callback | Committed transaction result | Throws HTTP 409 upon retry exhaustion. | `.agent/skill/stack.md:40`, `IMPLEMENTATION_PLAN.md:28` |

---

## 5. Edge Cases Discovered

| # | Feature | Input / Condition | Observed & Enforced Behavior | Discovered Via |
|---|---------|-------------------|-----------------------------|----------------|
| 1 | Archive Manifest | Heap order of SQL NULL rows differs between source and target clusters. | `ORDER BY "id"` in SQL query guarantees deterministic JSON null manifest; prevents nondeterministic archive hash differences. | `scripts/rehearse-recovery.ts:45-48`, Regression test R8 |
| 2 | Archive Tampering | Ciphertext flipped by 1 bit (`cipher[len/2] ^= 0xff`). | Decryption fails AES-256-GCM authentication; operation rolls back with zero database writes. | `scripts/rehearse-recovery.ts:215-216`, `tests/recovery.integration.test.ts:98-103` |
| 3 | Archive Tampering | Manifest row count altered in outer unencrypted header. | GCM Additional Authenticated Data (AAD) verification fails auth tag match; restore rejected before reading ciphertext. | `scripts/rehearse-recovery.ts:218`, `tests/recovery.integration.test.ts:98-103` |
| 4 | Archive Corruption | Truncated archive file (half of the bytes missing). | JSON parser or GCM auth tag validation throws; target database fingerprint unchanged. | `scripts/rehearse-recovery.ts:217` |
| 5 | Archive Tampering | Wrong 32-byte encryption key provided. | Decipher throws authentication tag mismatch; target database remains completely untouched. | `scripts/rehearse-recovery.ts:219`, `tests/recovery.integration.test.ts:97` |
| 6 | Archive Compatibility | Legacy plaintext JSON backup uploaded. | Rejected immediately by filename parser or schema envelope parser; no live overwrite. | `scripts/rehearse-recovery.ts:220`, `backup-service.ts:76` |
| 7 | Archive Compatibility | Archive produced from schema with modified models (`schemaHash` mismatch). | Rejected before attempting payload decryption; returns schema mismatch error. | `scripts/rehearse-recovery.ts:221`, `backup-format.ts:45,107` |
| 8 | Archive Compatibility | Authenticated archive from identical schema but differing Prisma migration lineage. | Verified inside the restore transaction; returns HTTP 409 before writing a single table row. | `scripts/rehearse-recovery.ts:222-223`, `backup-service.ts:122` |
| 9 | Archive Integrity | Archive missing an entire model table (e.g. `Payment` table deleted from snapshot). | `sealSnapshot` and `validateSnapshot` reject incomplete model manifests. | `scripts/rehearse-recovery.ts:224-225`, `tests/recovery.integration.test.ts:107-108` |
| 10 | Tenant Isolation | Tenant A archive restored with Tenant B business ID requested. | Rejected with `tenant or schema mismatch`; cross-tenant restoration refused. | `scripts/rehearse-recovery.ts:226`, `tests/recovery.integration.test.ts:96` |
| 11 | File Path Security | Directory traversal in filename (`../outside.pbackup`, `..\outside`, `nul`, absolute path). | Regex check rejects non-UUID names; `fs.realpath` verifies file confinement within root backup directory. | `scripts/rehearse-recovery.ts:227-229`, `backup-service.ts:76-79` |
| 12 | File Path Security | Symlink pointing outside backup directory. | `fs.lstat` checks `isSymbolicLink()` and rejects unconfined symlink targets. | `scripts/rehearse-recovery.ts:231-237`, `backup-service.ts:79` |
| 13 | File Size Security | Archive file exceeding 64 MiB (`MAX_BACKUP_BYTES`). | File open handle checks file size via `stat.size`; throws size limit error before reading into memory. | `scripts/rehearse-recovery.ts:239-242`, `backup-service.ts:83` |
| 14 | Database Rollback | Late audit log insertion fails via synthetic DB trigger during restore. | Entire serializable transaction rolls back; all 41 restored models and `RequestResult` rows remain absent. | `tests/recovery.integration.test.ts:116-132` (R4) |
| 15 | Snapshot Isolation | Concurrent write transaction updates sales, payments, and ledgers while snapshot is capturing. | PostgreSQL repeatable-read transaction ensures reader sees consistent snapshot prior to writer commit. | `tests/recovery.integration.test.ts:148-182` (R6) |
| 16 | API Authority | User session has `OWNER` claim in JWT, but user role was changed to `MANAGER` in database. | Server checks database authority; rejects backup request with HTTP 403 Forbidden. | `tests/recovery.integration.test.ts:188-191` (R7) |
| 17 | API Authority | User is deactivated (`isActive: false`) in database. | Server rejects request with HTTP 401 Unauthorized immediately. | `tests/recovery.integration.test.ts:198-199` (R7) |
| 18 | Restore Idempotence | Attempting a second restore of an already restored/existing tenant. | Throws HTTP 409 "In-place restore is disabled; recover only into an absent tenant". | `scripts/rehearse-recovery.ts:279`, `backup-service.ts:123` |
| 19 | Unrelated Tenant Safety | Target database contains pre-existing Tenant C before restoring Tenant A. | Tenant C's rows across all 41 models are asserted byte-for-byte identical before and after restoring Tenant A. | `scripts/rehearse-recovery.ts:273-274` |
| 20 | Source Database Safety | Source database used to capture snapshot of Tenant A and B. | Full whole-database table fingerprints (row counts + md5) prove source is completely unchanged after backup. | `scripts/rehearse-recovery.ts:200-201, 281-282` |

---

## 6. Itemized Phase 0 Exit Criteria Audit & Status Matrix

This matrix evaluates every single exit criterion from `PHASE_0_FOUNDATION_RECOVERY.md`, `RECOVERY_STATUS.md`, and `IMPLEMENTATION_PLAN.md` against actual codebase evidence.

| # | Exit Criterion / Deliverable | Source Document | Current Status | Verifying Evidence / Code Reference |
|---|---|---|---|---|
| **C1** | Zero destructive restore paths in production or staff UI | `PHASE_0_FOUNDATION_RECOVERY.md:19` | **SATISFIED** | `BackupService.executeRestore` throws 409 (`backup-service.ts:145`); UI page removes file upload/restore buttons and displays explicit warning (`frontend/src/app/dashboard/settings/backup/page.tsx:37`). |
| **C2** | All 8 PostgreSQL recovery regression test cases pass cleanly | `PHASE_0_FOUNDATION_RECOVERY.md:20`, `RECOVERY_STATUS.md:73` | **SATISFIED** | `tests/recovery.integration.test.ts` contains R1 through R8; `scripts/run-recovery-tests.mjs` enforces 8 passes and 0 skips against isolated loopback PostgreSQL. |
| **C3** | Rehearsal reconciliation asserts identical row counts, balance invariants, rollback safety | `PHASE_0_FOUNDATION_RECOVERY.md:21` | **SATISFIED (LOCAL SYNTHETIC)** | `scripts/rehearse-recovery.ts` executes 41 checks: asserts 41/41 model counts match, row equality, receivables match customer balance, payments match paidAmount, and source is untouched. |
| **C4** | Complete documentation in `RECOVERY_STATUS.md` | `PHASE_0_FOUNDATION_RECOVERY.md:22` | **SATISFIED** | Comprehensive documentation exists detailing topology, synthetic data, timings, fixed defects, operator instructions, and remaining blockers. |
| **C5** | Reproducible, isolated local development environment | `PHASE_0_FOUNDATION_RECOVERY.md:7`, `LOCAL_DEVELOPMENT.md` | **SATISFIED** | Standalone Compose environments (`compose.restro.yml` on 55439, `compose.restro-restore.yml` on 55440); launchers validate loopback target before importing DB clients. |
| **C6** | Baseline schema migration drift reviewed | `IMPLEMENTATION_PLAN.md:147` | **SATISFIED (WORKING TREE)** | Two tracked migrations (`202610300001_retail_baseline` and `202610300002_commerce_hardening`) applied cleanly; launcher checks `_prisma_migrations` checksums. |
| **C7** | Cluster-level backup & PITR (Layer 1) implemented | `RECOVERY_STATUS.md:11`, `IMPLEMENTATION_PLAN.md:9` | **MISSING (RELEASE BLOCKER)** | Physical base backup and continuous WAL archiving are **NOT** implemented. Tenant archive (Layer 2) cannot recover server loss, database roles, or migrations. |
| **C8** | Agreed RPO and RTO targets established | `IMPLEMENTATION_PLAN.md:9, 147`, `RECOVERY_STATUS.md:59` | **MISSING (RELEASE BLOCKER)** | No formal Recovery Point Objective (RPO) or Recovery Time Objective (RTO) targets have been approved or signed off by business stakeholders. |
| **C9** | Persistent, off-host storage & retention schedule | `RECOVERY_STATUS.md:59`, `IMPLEMENTATION_PLAN.md:9` | **MISSING (RELEASE BLOCKER)** | Backups currently reside in local development path `scratch/restro-backups`. No offsite replication, cloud bucket integration (e.g. S3/GCS), or automated pruning. |
| **C10** | Key custody, escrow, and rotation procedures | `RECOVERY_STATUS.md:58`, `IMPLEMENTATION_PLAN.md:9` | **MISSING (RELEASE BLOCKER)** | Single static 32-byte hex key in local `.env.restro.local`. No key identifier (`kid`), dual custody, key escrow, or rotation mechanism exists in the codebase. |
| **C11** | Production operator cutover & disaster recovery runbook | `RECOVERY_STATUS.md:54, 148` | **MISSING (RELEASE BLOCKER)** | Script `scripts/recover-restro-backup.ts` is explicitly gated to loopback development; no operator-approved runbook exists for live production disaster cutover. |
| **C12** | Protection of `User.passwordHash` in archive payloads | `RECOVERY_STATUS.md:51`, `IMPLEMENTATION_PLAN.md:9` | **OPEN DECISION (RELEASE BLOCKER)** | Entire `User` table including bcrypt password hashes is archived. Protected only by archive AES-256-GCM key; no secondary encryption or redaction exists. |
| **C13** | Windows filesystem ACL enforcement | `RECOVERY_STATUS.md:60, 148` | **MISSING (RELEASE BLOCKER)** | POSIX `0o600` / `0o700` permissions used in code are ineffective for restricting Windows NTFS access control lists. |
| **C14** | External asset and upload storage recovery plan | `RECOVERY_STATUS.md:19, 149` | **MISSING (RELEASE BLOCKER)** | Media URLs stored in DB point to unverified storage. If images are externally hosted, they are omitted from tenant archives and require independent backup. |
| **C15** | Large tenant streaming & memory scalability | `RECOVERY_STATUS.md:43, 151` | **MISSING (ARCHITECTURAL DEBT)** | Entire snapshot is loaded into memory as a JSON object; 32 MiB unencrypted payload cap limits large tenant scalability; streaming backup is not implemented. |
| **C16** | Decimal financial migration and historical reconciliation | `RECOVERY_STATUS.md:153`, `IMPLEMENTATION_PLAN.md:10` | **PENDING (PHASE 2 SCOPE)** | Float fields still used for currency and balances; round-trip preservation in Float does not prove decimal accounting correctness. Deferred to Phase 2. |

---

## 7. Deep-Dive Gap Analysis & Production Release Blockers

### 7.1 Gap 1: Absence of Layer 1 Cluster-Level Disaster Recovery & PITR
- **Finding**: The system currently provides only **Tenant Logical Recovery** (Layer 2). This mechanism can restore a single missing business into a healthy PostgreSQL cluster that already possesses identical migrations, database roles, and global configurations.
- **Vulnerability**: If the physical host crashes, the storage volume corrupts, or the PostgreSQL server is compromised, Layer 2 is incapable of recovery. It intentionally excludes database roles, Prisma migration history tables, platform onboarding requests, server secrets, and other tenant databases.
- **Resolution Path Required for Production**:
  1. Configure PostgreSQL continuous WAL archiving and base backups (e.g., using `pgBackRest` or cloud-native snapshots).
  2. Implement Point-In-Time Recovery (PITR) to allow restoring the entire database cluster to an exact minute prior to an incident.
  3. Rehearse catastrophic loss of the primary database host and measure RTO.

### 7.2 Gap 2: Encryption Key Custody, Escrow, and Rotation
- **Finding**: In `backend/src/lib/backup-format.ts`, `openSnapshot` and `sealSnapshot` rely on a single 32-byte hex key (`BACKUP_ENCRYPTION_KEY`). The archive envelope format v2 stores `nonce`, `tag`, and `ciphertext`, but does **not** store a Key Identifier (`kid`).
- **Vulnerability**:
  1. If the single encryption key is lost, all historical backup archives become permanently unrecoverable.
  2. If the encryption key is compromised, there is no mechanism to rotate the key without re-encrypting all historical archive files or breaking archive validation.
  3. Archives contain sensitive user credentials (`User.passwordHash`). If a key leaks, all staff password hashes are exposed.
- **Resolution Path Required for Production**:
  1. Introduce Key Identifier (`kid`) into the archive envelope header to support key versioning and seamless rotation.
  2. Establish a dual-custody key escrow policy (e.g. secret sharing or cloud KMS: AWS KMS / GCP Cloud KMS / HashiCorp Vault).
  3. Evaluate separately re-hashing or encrypting `User.passwordHash` prior to serialization.

### 7.3 Gap 3: Storage, Retention, and Windows ACL Limitations
- **Finding**:
  1. Archives are stored in a single directory specified by `BACKUP_DIRECTORY`, defaulting locally to `scratch/restro-backups`.
  2. In `backend/src/lib/backup-service.ts`, directory creation uses `fs.mkdir(..., { mode: 0o700 })` and file creation uses `fs.open(..., "wx", 0o600)`.
- **Vulnerability**:
  1. POSIX octal permissions (`0o600` / `0o700`) have no security effect on Windows NTFS file systems. Any process running under the same Windows user account or with broad read rights can access the archives.
  2. Storage is purely local to the host. Disk failure destroys both the live database and its backups.
  3. There is no automated lifecycle policy (e.g., retain daily for 14 days, weekly for 8 weeks, monthly for 12 months).
- **Resolution Path Required for Production**:
  1. Implement automated off-host sync to secured object storage (e.g. S3 with Object Lock or GCS with retention policies).
  2. Configure OS-level Windows Access Control Lists (ACLs) or run services under dedicated service accounts with restricted filesystem DACLs.

### 7.4 Gap 4: Production Operator Runbooks & Guarded Tooling
- **Finding**: `scripts/recover-restro-backup.ts` and `scripts/database-verification.mjs` contain hardcoded guards:
  ```typescript
  if (!["postgres:", "postgresql:"].includes(url.protocol) || url.hostname !== "127.0.0.1" || url.port !== "55439" || url.pathname !== "/restro_test") {
    throw new Error("Refusing non-isolated database target");
  }
  ```
- **Implication**: These scripts are intentionally forbidden from executing against production databases. While this is an essential safety guard during development, it means **no verified production recovery tooling or cutover runbook currently exists**. Attempting a production restore requires either modifying the scripts or manually orchestrating Prisma/database operations.
- **Resolution Path Required for Production**:
  1. Author a step-by-step Operator Recovery Runbook detailing how to spin up an isolated staging database, execute `prisma migrate deploy`, restore the tenant archive, run SQL reconciliation assertions, and execute traffic cutover.
  2. Develop production-certified operator CLI tools with strict role-based authentication and dual authorization.

### 7.5 Gap 5: Non-Atomic File & Database Commits
- **Finding**: In `backend/src/lib/backup-service.ts`, `executeBackup` writes and renames the encrypted archive file on disk. Then, in `backend/src/app/api/v1/settings/backup/route.ts:27-32`, the route attempts to record a `BACKUP_CREATE` audit entry in PostgreSQL.
- **Vulnerability**: If the database crashes or rejects the audit insertion after the file has been written, the completed archive file remains on disk without a corresponding database audit trail. Conversely, temporary `.partial` files from crashed processes may accumulate in `scratch/`.
- **Resolution Path Required for Production**:
  1. Implement a periodic background cleanup task to prune orphaned `.partial` files older than 1 hour.
  2. Include a file existence verification step during audit log reconciliation.

---

## 8. Transition Strategy & Bridge to Phase 1

### 8.1 Why Progression to Phase 1 is Safe
Advancing to Phase 1 (Security Foundation & Tenant Isolation) does **not** introduce data loss risks because:
1. All work in Phase 1 will execute against the isolated loopback development database (`127.0.0.1:55439/restro_test`).
2. Destructive live restore has been permanently excised from the application routes and UI.
3. Phase 1 focuses on server-derived authority, composite `(businessId, id)` tenant foreign keys, `UserBranchMembership`, and atomic audit logs — changes that directly harden tenant isolation and complement the backup boundary.

### 8.2 Handoff Requirements for the Multi-Agent Team in Phase 1

1. **For the Planner Agent**:
   - Decompose Phase 1 into discrete tasks:
     - T1: Server-derived authority helper expansion across all remaining endpoints.
     - T2: `UserBranchMembership` schema model and migration.
     - T3: Composite unique constraints `(businessId, id)` and composite foreign key validation.
     - T4: Atomic `AuditEvent` transaction integration (audit failure must roll back business mutation).
     - T5: Sensitive field serialization stripping (`passwordHash` redaction).
   - Ensure migration preflight checks prevent unreviewed baseline CREATE commands.

2. **For the Designer Agent**:
   - Adhere strictly to `.agent/skill/uiuxskills.md`:
     - Maintain Burgundy (`#6B2837`), Warm Ivory (`#F7F3EC`), and Porcelain (`#FFFCF7`) palette.
     - Ensure all role-based UI states use the exact operational status tokens (Forest, Ochre, Red, Blue).
     - Follow the Anti-Pattern Codex: enforce compact padding (`p-4 sm:p-6`), no fixed inner scroll traps, no decorative confetti or gradients.

3. **For the Builder Agent**:
   - Implement thin route controllers delegating to domain services.
   - Enforce mandatory `Idempotency-Key` headers on all state-mutating POST endpoints via `RequestResult`.
   - Implement `serializableTransaction` retries on Prisma P2034 conflicts.
   - Strip `passwordHash` and session secrets from all API response shapes and audit payloads.

4. **For the Tester Agent**:
   - Create direct API adversarial test suites:
     - Verify cross-tenant queries return 401/403.
     - Verify unassigned branch operations are rejected.
     - Verify manipulated/stale JWT claims fail against current database state.
     - Test intentional audit failure rollback (reproducing the R4 pattern from Phase 0).
   - Maintain the requirement for zero skips and 100% clean passes on all regression suites.

---

## 9. Conclusion

Phase 0 Foundation Recovery has delivered a robust, mathematically reconciled, and cryptographically authenticated **Tenant Logical Recovery** mechanism that satisfies all local development exit criteria. While operational disaster recovery (Layer 1) remains a documented release blocker for production, the engineering baseline is thoroughly hardened and stable.

The codebase is **READY AND APPROVED** to proceed to **Phase 1: Security Foundation & Tenant Isolation** under the multi-agent operational framework.
