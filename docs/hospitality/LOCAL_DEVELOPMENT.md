# Isolated restro environment

## Recovery working tree

Hardening is preserved in local commit `6078e686f84a2e5389bccb27bb4bc2a997b004d9` on `restro`. Subsequent tenant-recovery changes and executed evidence are in [RECOVERY_STATUS.md](RECOVERY_STATUS.md). No production restore is authorized or provided by these commands.

Reuse the existing `.env.restro.local`; **do not rerun init**. Never display or commit its contents. From the repository root:

```powershell
node scripts/restro-env.mjs db
node scripts/restro-env.mjs recovery-config
node scripts/restro-env.mjs recovery-test
```

`recovery-config` appends only missing BACKUP_ENCRYPTION_KEY (random 32-byte hex) and absolute BACKUP_DIRECTORY (ignored `scratch/restro-backups`). It does not rotate an existing key or alter database credentials. Protect both archive storage and a separate copy of the key; these local settings do not establish offsite recovery. Existing application environments without explicit key/storage configuration return 503 for backup creation/listing.

For a **synthetic tenant** already created in the isolated target, operator commands are:

```powershell
node scripts/restro-env.mjs recovery create <businessId>
node scripts/restro-env.mjs recovery restore <businessId> <backup-uuid.pbackup>
```

Replace angle-bracket placeholders with actual synthetic IDs/filenames. The restore command accepts only an authenticated same-schema archive and an absent tenant. An existing tenant returns a conflict and is never deleted. There is deliberately no delete/reset/overwrite preparation command. For rehearsal use the synthetic integration suite, which removes only its own generated records and proves rollback/round-trip preservation. Do not manually delete development tenants to make a restore fit.

Only loopback `127.0.0.1:55439/restro_test`, user `restro_dev`, is accepted, with DATABASE_URL/DIRECT_URL/TEST_DATABASE_URL agreement. No other environment/database fallback is allowed. The dedicated suite fails for a missing target or anything other than eight actual passes with zero skips; ordinary unit-test discovery is insufficient. The CLI prints only safe metadata/status, never decrypted rows or keys. Legacy plaintext JSON backups are incomplete and unsupported.

### Separate restore target and rehearsal

Recovery is rehearsed against a **different** PostgreSQL instance so the restro development database is never a restore destination. It uses its own container, volume (`prayassh-restro-restore_restro_restore_data`), role, credentials and loopback port 55440, defined in `compose.restro-restore.yml` and configured by ignored `.env.restro-restore.local`. Never print or commit that file; do not rerun `init` (it refuses to overwrite). From the repository root:

```powershell
node scripts/restro-restore-env.mjs init      # once; creates ignored credentials
node scripts/restro-restore-env.mjs db        # starts the disposable target
node scripts/restro-restore-env.mjs migrate   # applies tracked migrations to the target only
node scripts/restro-restore-env.mjs rehearse  # synthetic backup -> restore -> reconcile -> negative cases
```

`rehearse` reads from the restro source, restores into the disposable target, and inserts/deletes only its own generated synthetic IDs in the source (it asserts the source returns to its exact prior content). It writes `scratch/rehearsal-results-*.json` (ignored). The launcher refuses any target other than `127.0.0.1:55440/restro_restore`, any query override, and the source port. Never use production credentials or import a production dump. The target is disposable: stop it with `docker compose -p prayassh-restro-restore -f compose.restro-restore.yml down` (omit `-v` unless you intend to delete only this synthetic target's volume).

No new migration is needed. Do not apply baseline CREATE to an existing installation or reset the existing volume. Same-schema tenant logical recovery does not recover roles, migrations, platform onboarding, uploaded files or external fiscal/provider state. Keep operational recovery and existing-installation adoption blocked until separately reviewed and rehearsed.

Verification update, 2026-10-31: see [HARDENING_STATUS.md](HARDENING_STATUS.md). Docker is available again; the existing isolated volume and environment were reused without reset. Both regressions and the complete 14-case suite passed, as did ten independent-connection race rounds. This completes the current verification milestone, not the remaining implementation/release gates. Do not substitute another target.

All hardening work is on `restro`, baseline `565fad3c9d5f70b2c46e1daea0c7dfdb58b19943`. No push, merge or deployment is part of this milestone. The original uncommitted audit and plan are preserved.

The existing deployment workflow triggers on main/master only. New `restro-checks.yml` runs tests on restro pushes and pull requests using an ephemeral PostgreSQL service, fixed synthetic CI credentials and **no production secrets**, deployment steps or production database access. Its migration target is the isolated test database only. Repository settings and external hosting automation are not inspectable from local workflow files; do not assume those are covered by this check.

## Local commands

Use Node 24 (the isolated CI/test runner requirement), the root npm lockfile and npm workspaces. Existing application Docker images still use Node 20; their runtime verification remains a release gate. Use:

```text
npm ci --ignore-scripts
npm run prisma:generate
npm run restro:init
npm run restro:db
npm run restro:migrate
node scripts/restro-env.mjs verify-failed
npm run test:integration
node scripts/restro-env.mjs verify-races
npm test
npm run typecheck
npm run restro:dev
```

On PowerShell systems that block npm.ps1, use `npm.cmd`. The init command refuses to overwrite an existing environment. It creates ignored `.env.restro.local` with randomly generated development-only credentials; do not print, commit or copy it to production. The current workspace already has this file, so skip init here. No existing environment files were modified.

`compose.restro.yml` is a standalone Compose project, not an override of the production Compose file. It binds PostgreSQL to loopback port 55439 and uses its own `restro_dev_data` volume under project `prayassh-restro`. Its database is `restro_test`, containing synthetic fixtures only; the test suite creates/deletes its own business IDs. Do not import a production dump. This database can also support manual development with newly created synthetic businesses.

The environment launcher reads only `.env.restro.local`, overrides inherited DATABASE_URL/DIRECT_URL and validates host, port and database before launching commands. It never falls back to production/root .env settings. Test collection without TEST_DATABASE_URL skips PostgreSQL tests; an explicitly configured but unreachable target fails the suite. Database target validation occurs before Prisma/route import. No reset or db push command is used.

The dedicated `npm run test:integration` command now invokes `scripts/run-db-tests.mjs`: it rejects a missing target, requires URL agreement and rejects query-string connection overrides. It fails unless its JSON report contains at least fourteen actually passed PostgreSQL cases and no skips/todos/failures. All fourteen current cases must pass. Restro CI runs this dedicated command separately, so a successful unit-only run cannot hide a skipped database suite. `npm test` without a target still intentionally reports database skips and is insufficient for release verification.

For builds with this isolated configuration, run `node scripts/restro-env.mjs backend-build` and `node scripts/restro-env.mjs frontend-build` after client generation and `node frontend/copy-engines.js`. Next's installed local guides were consulted at `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` and `01-app/02-guides/environment-variables.md`.

## Migration review

Two new tracked migration files reproduce the reviewed source schema then apply additive hardening:

- `202610300001_retail_baseline`: generated offline from the baseline commit's Prisma schema, **not** a database export.
- `202610300002_commerce_hardening`: adds `Payment.source` with LEGACY_UNVERIFIED default, durable `RequestResult` with business/operation/key uniqueness and `OpeningStock.appliedAt`.

During the review, both migrations applied successfully to a verified empty isolated schema. **Do not run the baseline CREATE migration against an existing installation.** The launcher now refuses a populated public schema lacking the recognized completed baseline migration. Future adoption requires schema drift review, backup/recovery rehearsal and a separately reviewed baseline resolution procedure. No production migration or baseline-marking command was executed. Float money, historical reconciliation and composite tenant constraints remain follow-up work.

Historical APPROVED opening-stock rows are presumed already applied by legacy logic; do not invoke the posting helper as a backfill. The new applied marker protects newly posted entries; reconciliation of old opening balances remains required.

## Infrastructure and focused verification

The earlier missing Docker engine and interrupted runs remain historical failures, not passes. The current checkpoint reconnected to the same isolated PostgreSQL 15.18 target, confirmed both existing migration checksums, reran both regressions first, and passed all fourteen cases with zero skips. `verify-races` runs six selected cases ten times, requiring real transaction connection witnesses and all persisted-state assertions each round. Intentionally unselected cases in focused/race modes do not count as full-suite passes. If Docker becomes unavailable again, report that infrastructure failure and do not substitute production or reset the volume.
