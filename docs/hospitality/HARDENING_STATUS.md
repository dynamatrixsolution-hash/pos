# Restro hardening review status

Local checkpoint preserved on `restro`: **`6078e686f84a2e5389bccb27bb4bc2a997b004d9`**. All 250 final tested file hashes matched the manifest before committing, including the strengthened assertions used by the final 14-test run. The working tree was clean after the checkpoint; the uncommitted-state descriptions below are historical. Subsequent recovery work and its separate verification/remaining blockers are recorded in [RECOVERY_STATUS.md](RECOVERY_STATUS.md). The original audit remains the baseline audit.

**Recovery update (2026-10-31, uncommitted after the checkpoint):** the unsafe baseline restore is disabled, backups are complete encrypted authenticated per-tenant snapshots bound to schema and migration identity, and tenant recovery into an absent tenant was rehearsed against a separate disposable PostgreSQL instance with synthetic data (41/41 checks, 5 clean runs; source database unchanged; unrelated tenant untouched; corrupt/incompatible/unsafe inputs refused without writes). The 14-case hardening suite was **rerun and still passes 14/14**; the race rounds were not rerun. This is **not** disaster recovery and not release approval: cluster-level backup/PITR, off-host storage, key custody, retention and measured RPO/RTO remain release blockers. A nondeterministic archive manifest ordering found by the rehearsal was fixed and has regression test R8. Details and limits: [RECOVERY_STATUS.md](RECOVERY_STATUS.md).

## Completed verification checkpoint — 2026-10-31

**The current verification milestone passed. This is not production-release approval.** Both previously failing regressions passed first, the full expanded PostgreSQL suite passed **14/14 with zero skips**, and ten independent-connection race rounds passed. Application implementation gaps and release blockers remain below. Earlier blocked/failing runs are retained as historical evidence, not mixed into these pass counts.

### Exact working-tree state tested

- Branch: `restro`; HEAD/baseline: `565fad3c9d5f70b2c46e1daea0c7dfdb58b19943`. All changes remain uncommitted; the HEAD alone does not identify the tested hardening code.
- Tested code/configuration/migration/test snapshot SHA-256: **`659d4250254a1950fdf11353c88710467222feedd1fb6c1d82a84af4d70da880`**.
- [VERIFIED_WORKTREE.json](VERIFIED_WORKTREE.json) contains individual SHA-256 hashes for 250 files and their aggregate fingerprint. Markdown, hospitality report artifacts, ignored environment files, generated clients/build output and node_modules are excluded. Installed tooling remains Node 24.18.0, Prisma 6.19.3 and Vitest 5.0.5 with the existing lockfile. No dependencies were upgraded during this continuation.
- No application source or migration SQL changes were necessary in this continuation. Changes are limited to stronger regression assertions, observational race instrumentation, isolated verification commands, a stricter fourteen-case gate and evidence files/documentation.

### The two application defects and their verification

| Test | Expected behavior | Original actual failure | Root cause / fix previously pending | Current result |
|---|---|---|---|---|
| T10: **rejects negative amounts and mismatched splits without stock or accounting effects** | Negative paidAmount and mismatched split totals return 400; no committed stock, sale, payment, customer balance/ledger, audit or retry-result effects | `paidAmount: -1` returned **201**, so the original test stopped before its split assertion | `saleCreateSchema` clamped negative input to zero with Math.max. The pending fix was `z.coerce.number().nonnegative().default(0)` rather than clamping | **Passed** in focused and full PostgreSQL runs. Both rejection assertions now execute; stock remains 1, balance 0, and sale/payment/ledger/audit/RequestResult counts remain 0 |
| T14: **rejects paid cancellation, settled correction and linked payment reversal without partial effects** | All three operations return 409 and leave financial/stock/audit records unchanged | Paid cancellation returned **400** instead of 409; later assertions were not reached in that original run | Cancel's catch discarded CommerceError.status. Cancel and correct catch blocks now preserve it. These fixes were already written but lacked a database rerun | **Passed** in focused and full PostgreSQL runs. All three 409 assertions execute; exact before/after snapshots of sale, payment, stock, customer, ledgers, audits and request results match. Sale stays active; stock 0; one sale and one payment remain |

No further application fix was needed to make either pass. Assertions were strengthened, not removed or relaxed. T14 retains soft status assertions so all rejection calls and persisted-state checks run even if a future status regression occurs; a failed soft assertion still fails the test.

### Isolated target and infrastructure/harness classification

Docker responded with engine **29.8.2**. `node scripts/restro-env.mjs db` started the existing `prayassh-restro-restro-db-1` service and reported Healthy. Its existing volume was reused: no volume removal/reset, alternative database, init, schema push, seed, migration application, production connection or deployment occurred in this continuation.

The existing ignored `.env.restro.local` was reused without printing secrets. Connection checks confirmed only **127.0.0.1:55439/restro_test**, user **restro_dev**, PostgreSQL **15.18**. Both previously applied migration names were present, and their stored checksums matched the current SQL files. No baseline CREATE was rerun.

The earlier missing Docker Linux-engine pipe, host out-of-memory interruption and connection-setup failures were infrastructure failures, not application passes. A preparatory inline command in this continuation also failed before execution because CommonJS did not permit top-level await; the harness was corrected before connecting or running tests. That parse failure counts as zero tests, not a failed application regression or a pass. The successful runs below were uninterrupted.

### Exact executed checks

| Command / scope | Executed result |
|---|---|
| `node scripts/restro-env.mjs verify-failed` | Exit 0; **2 selected / 2 passed / 0 failed**; twelve unrelated cases intentionally unselected. This focused result is not presented as a fourteen-case suite pass |
| `npm.cmd run test:integration` after the focused cases | Exit 0; **14 executed / 14 passed / 0 failed / 0 skipped** |
| `node scripts/restro-env.mjs verify-races` | Exit 0; **10 rounds × 6 selected cases = 60 passes**, zero selected failures/skips. Each round intentionally excludes eight unrelated cases; those exclusions are not full-suite passes |
| `npm.cmd run test:integration` after the race rounds | Exit 0; **14 executed / 14 passed / 0 failed / 0 skipped** on the final snapshot |
| `node node_modules/vitest/vitest.mjs run --exclude tests/commerce.integration.test.ts` | Exit 0; **24 unit tests passed**, zero failures/skips, five test files passed |
| Affected-file ESLint using `backend/eslint.config.mjs` on `tests/commerce.integration.test.ts`, `tests/database-verification.test.ts`, `scripts/database-verification.mjs`, `scripts/run-db-tests.mjs`, `scripts/restro-env.mjs`, `scripts/verify-restro-milestone.mjs` | Exit 0; no rule diagnostics. Existing root-layout Pages-directory notice remains informational |
| `npm.cmd run typecheck` | Exit 0; backend and frontend passed |
| `git -c safe.directory=C:/projects/pos diff --check` | Passed at completion |

The dedicated full-suite gate now requires at least **fourteen** actual passing cases and no pending/skipped/todo/failed assertions. A new unit test rejects a thirteen-case partial report. Focused and repeated-race commands validate their exact selected names and fail if any selected case does not pass; they cannot satisfy or weaken the full-suite gate. Earlier application builds and baseline lint attribution remain recorded below; builds and unrelated lint cleanup were not repeated because no application/configuration/dependency source changed in this continuation.

The final full-suite JSON is `scratch/database-results-2690da28-c05e-4105-9aca-ad06ea17ab55.json`; log: `scratch/verification-full-final.txt`. Focused-run evidence is indexed in `scratch/verification-failed-summary.json`. Raw local evidence stays ignored; the portable connection-witness summary is [VERIFICATION_RACES.json](VERIFICATION_RACES.json).

### Repeated real-PostgreSQL races and persisted invariants

Ten rounds each exercised T3, T4, T5, T7, T8 and T13. An observer wraps the original Prisma `$transaction` callback, executes `pg_backend_pid()` inside that **real transaction**, briefly overlaps starts with PostgreSQL `pg_sleep(0.025)`, then calls the original business callback with unchanged isolation/options. It does not fake a database result, serialize work through an in-memory mutex, replace writes or suppress rollback/retries. Every case/round observed **two distinct PostgreSQL backend PIDs**: 60 connection witnesses and 210 transaction attempts, including retries/replay/conflict attempts. The report records those PIDs per case and round.

| Race, repeated ten times | Final persisted values asserted every round |
|---|---|
| T3: concurrent same-key checkout and replay | One sale, one 40-unit payment, paidAmount 40; customer debt 60; one ledger debit of 60; stock 0; one RequestResult. Replay returns the same sale ID; changed body with the same key returns 409 |
| T4: two different checkouts, negative stock forbidden | One 201 and one 400; one sale/payment/request result; collected amount 100; stock 0; customer balance 0; no customer ledger entries |
| T5: negative stock explicitly allowed | Two 201s; two sales/payments/request results; collected amount 200; stock -1; customer balance 0; no customer ledger entries |
| T7: concurrent same-key late payment | One sale and one 100-unit payment; paidAmount 100 and PAID; customer balance 0; exactly two ledger entries totalling debit 100 and credit 100; stock 0; two RequestResults (checkout and payment) |
| T8: overlapping independent transactions | Two distinct backend PIDs; actual PostgreSQL transactions overlap |
| T13: opening-stock API approvals and concurrent service retries | Exactly one opening entry, one batch with quantity 3, one stock projection with quantity 4 from initial 1; appliedAt set; customer balance 0 and no customer ledger entries. Additional concurrent service-level retries after approval do not post again |

Fixture cleanup remains restricted to its randomized synthetic IDs; each round's unrelated synthetic sentinel survives before its own explicit cleanup. No unrelated manual data was enumerated or deleted. The race checks verify these specific policies and flows, not arbitrary throughput or all inventory-writer interleavings.

### Verified hardening fixes

- T10 negative-payment and split rejection, and T14 conflict statuses/no-effect behavior, are now verified against PostgreSQL rather than documentation or mocks alone.
- All fourteen named database cases pass, including scoped tenant/branch rejection, server-derived authority/settlement, staff-recorded provenance, idempotent responses/conflicts, actual late-audit failure rollback and applied-once opening posting.
- The repeated race evidence above verifies the configured stock policy, same-key financial effects and final committed quantities/balances/counts across independent connections.
- These are scoped application-service checks. Auth/session acquisition and fiscal submission remain mocked at their external boundary; actual cookie transport, gateways and fiscal systems were not certified.

### Remaining implementation gaps

- Repository-wide permissions/branch coverage and tenant-consistent composite foreign keys remain incomplete; this is not full isolation certification.
- Allocated refund/reversal workflow, legacy paidAmount-only correction history, full note tax/revenue/batch treatment and comprehensive reporting remain unresolved.
- Opening approval status/posting/audit are still separate transactions; approval-versus-rejection and other writer interleavings need coverage. The successful retries do not reconcile historical opening stock.
- Durable outbox delivery, fiscal/provider retry recovery, multi-tab/legacy browser pending-intent migration and actual authenticated UI behavior remain incomplete.

### Release blockers — not cleared by this verification

Incomplete/unsafe backup and restore; Float-money/Decimal and currency-policy migration; historical accounting/stock/revenue reconciliation; mock fiscal submission rather than a real integration; dependency vulnerabilities recorded below; remaining authorization gaps; external-client/OpenAPI coordination and physical printing/Node 20 container verification remain release gates. Existing-installation migration adoption is pending separate review. No production readiness, production rollout, merge or hospitality implementation is authorized or claimed.

## Previous review evidence (historical)

Review completed: 2026-10-31. Branch: `restro`. Reviewed baseline: `565fad3c9d5f70b2c46e1daea0c7dfdb58b19943`. Changes remain uncommitted. No push, merge, deployment, production access or hospitality feature implementation occurred.

Review changes beyond the earlier milestone are limited to stronger verification/CI and migration preflight guards; expanded regression cases and a corrected mutable-token test; negative-payment validation and cancellation/correction error-status fixes; browser pending-intent protection and clearer error display; the missing purchase reference input; and scoped typing/unused-import lint cleanup. Application dependency versions and migration SQL were not upgraded or rewritten. Database-sensitive fixes are not marked resolved while their rerun is blocked.

**Historical blocked checkpoint, superseded by the completed verification above:** the original seven PostgreSQL cases passed after clean migration, but expanded coverage exposed two failures. Their database rerun was initially blocked when Docker became unavailable. The completed checkpoint above now verifies those fixes; it does not clear the remaining release blockers.

[AUDIT.md](AUDIT.md) is the **baseline audit**, not a statement about current code. [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) contains earlier implementation claims, which this report qualifies. [LOCAL_DEVELOPMENT.md](LOCAL_DEVELOPMENT.md) describes the isolated environment.

## Prior-review database evidence and safety (historical)

The existing `.env.restro.local` was reused without printing it or running init. The first sandbox Docker check was denied; an authorized elevated `docker info --format '{{.ServerVersion}}'` returned engine **29.8.2**. `node scripts/restro-env.mjs db` started only project `prayassh-restro`, service `restro-db`, bound to 127.0.0.1:55439, with its own newly created volume. No production Compose project was used.

The migration launcher queried the isolated public schema and printed **“Verified empty isolated public schema.”** Both migrations then applied successfully:

- `202610300001_retail_baseline`: source-derived baseline CREATE statements.
- `202610300002_commerce_hardening`: Payment.source, RequestResult uniqueness and OpeningStock.appliedAt.

This verifies initialization of that empty isolated database only. No baseline CREATE was attempted against an existing installation. Existing-installation drift inspection, adoption/baseline resolution and recovery rehearsal remain pending separate review. The migration SQL itself was not changed during this review.

Later, after the environment interruption, an elevated Docker check failed with:

```text
failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine;
open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified.
```

Database-dependent verification stopped at that point. There was no fallback database. The latest rerun failed at Prisma `$connect`, executing zero cases; that is not a successful integration run. The local volume was not removed/reset, and environment secrets were not changed.

### Recorded database runs

| Run | Executed | Passed | Failed cases | Skipped | Command outcome |
|---|---:|---:|---:|---:|---|
| Original suite after clean migrations | 7 | 7 | 0 | 0 | `npm.cmd run test:integration`, exit 0; dedicated report confirmed seven passes |
| Expanded suite before fixes | 14 | 12 | 2 | 0 | `node scripts/restro-env.mjs integration`, exit 1 |
| Expanded suite after fixes, Docker unavailable | 0 | 0 | 0 | 14 | Same command, exit 1; suite setup failed at `$connect` |

An intervening PowerShell invocation also failed with a host `System.OutOfMemoryException`; it was rerun directly with Node to obtain the actual 12-pass/2-fail result above. That host failure is not counted as a test result.

## Prior-review finding-to-evidence matrix (historical)

Test IDs refer to exact names in the next section. “Scoped evidence” deliberately does not mean that the original repository-wide issue is resolved.

| Original finding / severity | Changed files and symbols | Implemented fix | Exact verifying test | Recorded result | Remaining limitations |
|---|---|---|---|---|---|
| Client-updatable session authority — **Critical** | Both `src/auth.config.ts:jwt`, both `src/lib/api-helper.ts:getSessionContext`, `src/lib/api-auth.ts:getAuthContext` | Ignore client role/branch updates; resolve current active database user and tenant; fail closed for unknown roles and missing staff branch | `tests/session.test.ts: ignores client role/branch updates in JWT callback`; T9, T1, T7 | Unit passes; expanded T9/T1/T7 passed against real user records | Auth itself is mocked at the route boundary. Cookie issuance, signed session transport and frontend proxy behavior are not end-to-end verified. The old callback unit assertion compared a mutable token with itself; review fixed it to compare a pristine clone |
| Tenant/branch relation validation — **Critical** | `commerce-policy.ts:assertBranch`; `commerce-transaction.ts:resolveBranch`; guarded sales/payment/purchase/adjustment/opening/transfer paths | Require same tenant, active branch and assigned branch for ordinary staff; owners remain tenant-scoped | T1 and policy unit `rejects another tenant even for an owner` | T1 passed; pure policy tests pass | Other catalog, ledger, report/platform endpoints and composite tenant foreign keys remain incomplete. This is not repository-wide isolation certification |
| Client-controlled settlement / mismatched payment totals — **High** | `commerce-policy.ts:reconcilePayment`; sales/payment/correction/purchase POST | Derive settlement from applied collections; exclude CREDIT; cap cash change; reject mismatched splits and non-cash overpayment | T2, T7, T10; policy split/change/rounding cases | T2/T7 passed; units pass. **T10 failed**: negative paidAmount became zero and checkout returned 201 | The initial failed run stopped before checking splits. The completed checkpoint above now verifies both negative and split rejection; Float/currency limitations remain |
| Manual declarations confused with verified funds — **High** | `Payment.source`; payment/sale writers; `reconcilePayment`; purchase reference field | New entries always STAFF_RECORDED; provider-source claims rejected; non-cash reference required | T2, T11; unit `cannot declare provider verification or reconcile inconsistent splits` | T2/T11 passed; units pass | A reference is arbitrary text, not a signed provider event. No real provider adapter/capture/refund exists. PAID represents recorded allocation, not independently verified external transfer |
| Duplicate checkout/payment effects — **High** | RequestResult migration; `commerceTransaction`; browser `postCommerce`; POS and received/sent forms | Store actor/authority/body hash and response atomically with effects; replay same key; conflict on changed payload | T3, T7; transaction unit replay/conflict cases | T3/T7 passed with concurrent real PostgreSQL transactions; units pass | Coarse tenant lock, exact JSON ordering, retention and ambiguous-operation support need operational policy. Refreshed authority can intentionally invalidate a prior replay |
| Edited ambiguous browser request creates new sale identity — **High, found in review** | `frontend/src/lib/idempotent-request.ts:postCommerce`; `tests/browser-request.test.ts` | Persist one key/body per operation scope; block changed body while outcome is unresolved; permit a new intent after success or definitive validation/authorization rejection | `isolates actors and refuses edited payloads while a prior outcome is unresolved`; lost/truncated-response and intentional-new-attempt cases | New test first failed, then all browser helper unit cases passed | Browser/localStorage tests mock fetch; multi-tab races, navigation to another cart, legacy pending-storage formats, manual reconciliation and actual UI persistence remain unverified. No discard-pending control was added; drain/reconcile older ambiguous intents before any rollout |
| Concurrent stock deductions — **High** | `serializable`; sales atomic decrements; existing stock-writer transaction changes | Serializable transactions, bounded P2034 retries, configured allow/prevent-negative policy | T4, T5, T8 | All passed; T8 proved two overlapping PostgreSQL backend PIDs | Broader writer interactions, batch constraints, approval/rejection races, contention/throughput and process-crash recovery need more tests |
| Partial checkout commits — **High** | sales transaction; RequestResult commit boundary | Roll back invoice, stock, customer balance/ledger, payment, audit and sequence when a late write fails | T6, T12 | Both passed. T12 used a real PostgreSQL audit-insert failure trigger, not a mocked transaction | Fiscal submission remains outside the transaction; no durable outbox or provider recovery is proven |
| Repeated opening approval — **High** | `OpeningStock.appliedAt`; `approveOpeningStockTransaction`; opening PATCH | Applied marker and serializable posting make new entries post once | T13 | Passed: concurrent/repeated approvals produced one stock and batch posting | Approval status update and posting/audit are still separate transactions. Reject-versus-approve and historical APPROVED rows remain unreconciled |
| Unsafe invoice reversal/correction — **High** | sales cancel/correct POST; payments DELETE | Reject paid/credited cancellation, settled/credited correction and linked-payment hard deletion | T14 | **Failed** at first assertion: paid cancellation returned 400 instead of documented 409 | The completed checkpoint above now verifies conflict statuses and unchanged persisted snapshots. Legacy paidAmount without Payment rows is still not explicitly blocked by correction's row-count guard; follow-up required |
| Unsafe migration target / skipped CI database suite — **High, verification gaps** | `scripts/database-verification.mjs`, `run-db-tests.mjs`, `restro-env.mjs`, `.github/workflows/restro-checks.yml` | Validate protocol/user/host/port/database/no query override and all URL agreement; refuse unbaselined nonempty public schema; require >=7 actual passing DB assertions and zero skips | `tests/database-verification.test.ts` three cases; no-target subprocess; original seven-case dedicated report; empty-schema migration preflight | Units pass; no-target command exits 1; original dedicated report passed; empty initialization succeeded | CI was inspected, not executed remotely. Existing-schema refusal branch has not been exercised against a populated isolated schema. Guard is not an existing-installation adoption procedure |
| Float money / backups / historical reconciliation / fiscal mock — **High release blockers** | Baseline audit; rounding helper; unchanged backup and CBMS services | Limited two-decimal arithmetic only; edited fiscal paths require mock opt-in | No successful recovery, Decimal migration or real fiscal/provider verification test | **Open** | Float persistence, unsupported currency policies, incomplete unsafe restore, historical balances/revenue, mock fiscal success claims and outbox/retry durability remain blockers |

## PostgreSQL test inventory and historical first results

All tests are in `tests/commerce.integration.test.ts`, suite **real PostgreSQL checkout atomicity**. Prisma is real; only staff session acquisition and fiscal submission are mocked. Races use overlapping independently pooled transactions, not in-memory mutexes. Expected P2034 logs during retry are not test failures.

| ID | Exact test name | Expanded run before fixes |
|---|---|---|
| T1 | rejects cross-tenant and unassigned branches using current DB identity | Passed |
| T2 | rejects provider claims and derives unpaid status instead of trusting PAID | Passed |
| T3 | replays a concurrent duplicate without duplicating any effects | Passed; also asserts changed-body/same-key 409 |
| T4 | sells the last unit once when negative stock is forbidden | Passed |
| T5 | preserves every decrement when configured to allow negative stock | Passed |
| T6 | rolls back stock, invoice sequence and effects when a later item fails | Passed |
| T7 | authorizes manual payments and replays them without duplicate settlement | Passed |
| T8 | uses independent overlapping PostgreSQL transactions | Passed |
| T9 | ignores forged role/branch updates and revokes stale, inactive and deleted staff | Passed |
| T10 | rejects negative amounts and mismatched splits without stock or accounting effects | Failed historically; current full run passed |
| T11 | keeps a claimed provider-success reference strictly staff-recorded | Passed |
| T12 | rolls back sale, payment, ledger, stock and audit when database audit insertion fails | Passed |
| T13 | posts concurrent and repeated opening-stock approvals exactly once | Passed |
| T14 | rejects paid cancellation, settled correction and linked payment reversal without partial effects | Failed historically; current full run passed |

Fixtures create randomized business/user/product/branch IDs. Cleanup predicates use those IDs; no TRUNCATE, global delete, db push, reset, production seed or production dump is used. An additional independently identified synthetic sentinel business survived the other fixture cleanup before being deleted by its own exact ID. No unrelated manual development records were enumerated or deleted. The T12 trigger has a generated identifier, acts only on its fixture business and is dropped in finally. An abruptly killed runner can still leave its own synthetic records/trigger and needs a scoped cleanup review.

## Client and compatibility inventory

| Endpoint / requirement | Repository client or consumer | Review result |
|---|---|---|
| POST `/api/v1/sales`: key; paymentReference for collected non-cash funds | `frontend/src/app/dashboard/pos/page.tsx:handleCheckoutSubmit` via `postCommerce` | Supplies key scoped to actor/cart, prompts for reference. Review now surfaces the helper's unresolved-operation message instead of calling every exception a connection failure. Browser helper tests cover lost/truncated response, conflict preservation, actor separation and new operation after confirmed success |
| POST `/api/v1/payments`: key; `reference` for non-cash | `payments/received/page.tsx:handleAddPayment`, `payments/sent/page.tsx:handleAddPayment` | Both use postCommerce and existing reference inputs; schema rejection is displayed. Their per-actor pending intent blocks changing an ambiguous request until resolved |
| POST `/api/v1/purchases`: paymentReference for non-cash, no new key requirement | `purchases/page.tsx:onSubmit` | **Found missing reference input**. Review added a form field and staff-recorded disclaimer; backend still validates it. Actual authenticated purchase UI flow was not exercised during this verification |
| POST `/sales/{id}/correct`, `/credit-notes`, `/debit-notes`: key; correction non-cash reference | No executable frontend caller found by repository search | External/manual clients need coordinated updates. There are no corresponding retail correction/note forms to certify |
| POST `/sales/{id}/cancel` | No executable frontend cancellation caller found | No browser cancellation UI verified; T14 backend contract now passes as recorded above |
| DELETE `/payments/{id}` | received/sent `handleDeletePayment` | Source checks res.ok, displays server error, and only refreshes/shows success afterward. No optimistic financial mutation was found. Actual browser 409 handling not executed; current T14 verifies backend no-effect assertions |
| GET sale/payment/report endpoints; POST sale print | sales list, report/accounting/outstanding/transaction screens, thermal printer | No idempotency key was newly required on these calls. Branch defaults, long invoice IDs and report composition still need user-facing regressions |
| API documentation and example snippets | `backend/src/app/api/docs/openapi.json/route.ts`; both `src/lib/api-examples.ts` | OpenAPI does not yet document the new key/reference/error contract comprehensively. Example snippets are strings, not deployed callers. Contract/documentation synchronization remains a release gate |
| Flutter/mobile/external clients | No Dart, Flutter project or mobile client found in tracked repository search | **Unknown outside this repo**, not certified absent. API owner must inventory deployed clients and coordinate stable key storage, exact retry body, manual references, 428/409 handling, authority changes and new-operation creation before rollout |

Reference text such as `PROVIDER_VERIFIED:client-success` remains untrusted display text. T11 persisted it while Payment.source stayed STAFF_RECORDED. No code path was found promoting that text to provider verification. External consumers must not infer trust from reference, method, PAID status, displayed QR or a client success flag.

### Newly rejected operations

- Cancel a paid invoice or an invoice with credit notes: intended 409; current T14 verifies paid-cancellation status propagation. Inactive invoice and branch/role failures remain separately rejected.
- Correct an invoice with existing Payment or CreditNote rows: intended 409. Non-cash corrections without a reference fail validation, unauthorized party/branch links fail, missing key returns 428 and changed-body key reuse returns 409. Legacy paidAmount-only history is an outstanding gap.
- Delete an invoice-linked incoming/outgoing payment: 409, directing callers toward a future allocated reversal workflow. This is not a refund execution.
- Credit-note requests for inactive invoices, repeated products or cumulative returned quantity above the original bound are rejected. Note POSTs now require a key. There is no real cash/provider refund API to certify; current note pricing/tax/batch/revenue reconciliation remains incomplete.
- Create a server DRAFT/ON_HOLD invoice or mutate its status/paymentStatus through PUT: rejected; local retail holds remain available.

Current T14 verifies all three rejection calls and exact persisted before/after snapshots. Its earlier failed run had stopped on the first cancellation status assertion; that historical limitation is now cleared for this scenario. Received/sent UI rejection handling is still source-reviewed only.

## Prior-review lint attribution and build checks (historical)

Baseline comparison uses a **separate detached worktree** at `%TEMP%/pos-restro-baseline-565fad3`, commit `565fad3`, and a node_modules junction to exactly the current installed dependencies. Both applications' eslint.config.mjs files are byte-identical between worktrees. React resolves to the same installed module in both. No baseline source was edited.

`scripts/review-lint.mjs` compares application source/config files in both worktrees and normalizes embedded absolute paths and moved line numbers. Public vendor bundles are excluded from this attribution scope on both sides; full current frontend lint is reported separately. This avoids misclassifying React compiler diagnostic code frames as new errors. Initial broad lint attempts consumed excessive memory and were stopped; the worktree was moved outside the application tsconfig tree and dependency junction re-established before the controlled comparison.

The controlled comparison conservatively attributed one changed-line `any` error to each application's session helper. Review removed unchecked session casts within that changed function and five unused imports in changed transaction routes. A targeted refresh against the saved complete baseline/current comparison produced:

| Source/config scope | Baseline errors / warnings | Reviewed errors / warnings | Introduced errors after fix |
|---|---:|---:|---:|
| Frontend | 315 / 246 | 306 / 245 | 0 |
| Backend | 298 / 32 | 288 / 27 | 0 |

The targeted refresh is `scripts/review-lint.mjs --refresh-review-fixes`; its cache is valid only for this run, where the refreshed helper/import files were the only application changes after the complete comparison. Use the ordinary uncached command for future changes. Baseline debt remains substantial; reduced totals are not a blanket lint pass.

### Commands and results

| Exact command / scope | Result and limitation |
|---|---|
| `docker info --format '{{.ServerVersion}}'` with authorized elevation | Initially exit 0, engine 29.8.2. Later exit 1, missing Linux-engine pipe; no further database attempts after confirming this blocker |
| `node scripts/restro-env.mjs db` | Exit 0, isolated service healthy; existing environment reused |
| `node scripts/restro-env.mjs migrate` | Exit 0, empty-schema preflight then both migrations applied |
| `npm.cmd run test:integration` | Original seven cases executed/passed, zero skipped, exit 0 |
| `node scripts/restro-env.mjs integration` | Expanded run: 12 passed, 2 failed, exit 1. After fixes: setup failure, zero executed / fourteen skipped, exit 1 |
| `npm.cmd test` | Final unit/default run: 23 executed/passed, zero failed, fourteen database cases skipped, five test files passed and one skipped; exit 0 is **not** database verification |
| `node node_modules/vitest/vitest.mjs run --exclude tests/commerce.integration.test.ts` | Unit-only run: 23 passed, zero failed/skipped, five files passed |
| `node scripts/run-db-tests.mjs` with all DB URL variables omitted in a child | Exit 1 before connecting. Unit tests also reject zero-case and all-pending JSON reports |
| `npm.cmd run typecheck` | Both backend and frontend passed, exit 0, including final session-helper typing and import cleanup |
| `node scripts/restro-env.mjs backend-build`; `node scripts/restro-env.mjs frontend-build` | Final sequential builds both passed, exit 0, including the review fixes and typing/import cleanup. Earlier overlapping repeats stopped for resource contention are not counted as passes. Node 20 container runtime was not tested |
| Set `RESTRO_BASELINE_WORKTREE` to the detached worktree, run `node scripts/review-lint.mjs`, then `--refresh-review-fixes` | Controlled same-dependency/config comparison and targeted refresh completed. Final counts are above, with **zero introduced source/config errors or warnings**. Before cleanup the comparator identified five introduced warnings |
| `node node_modules/eslint/bin/eslint.js --config backend/eslint.config.mjs tests scripts backend/src/lib/commerce-policy.ts backend/src/lib/commerce-transaction.ts frontend/src/lib/idempotent-request.ts` | Exit 0; no diagnostics on new helpers/tests/scripts, apart from a root-layout “Pages directory cannot be found” configuration notice |
| Full frontend ESLint CLI, invoked from frontend with `--format json` | Final completed full run: exit 1, **306 errors / 330 warnings**, including public vendor files. It is not green. Source/config attribution is recorded separately above |
| `git -c safe.directory=C:/projects/pos diff --check` | Passed at review checkpoint |

Next builds emit generated Prisma CommonJS/export and broad file-tracing warnings. No production process was started. Available checks do not prove auth transport, print delivery, deployment artifact safety or database correctness. Some redundant parallel lint/build repeats were interrupted to reduce memory pressure and are not counted as completed checks. No unrelated mass lint cleanup or dependency upgrade was performed.

## Dependency review (prior-review snapshot)

The successful audit snapshot obtained during this review reports **31 affected package entries: 5 critical, 11 high, 15 moderate**. `npm audit --omit=dev --json` reports **13 entries: 4 critical, 8 high, 1 moderate**. These counts include meta-vulnerable dependents and are not counts of independent CVEs. Later audit retries exited 1 without vulnerability metadata; retain the successful snapshot as dated evidence, not a promise of continuing registry availability. No package/lockfile upgrade was applied during this review.

“Runtime graph” below means retained by npm's omit-dev graph, not proven reachable in the traced Docker image or remotely exploitable in this application. Development issues still affect trusted build/input handling.

| Packages / installed version | Severity / scope | Advertised fix and compatibility impact |
|---|---|---|
| next 16.2.9 | Critical / runtime | Audit suggests 16.4.3; validate local Next guides, auth, routing, build/printing and API regressions before upgrading |
| next-auth 5.0.0-beta.25; @auth/core 0.37.2 | Critical / runtime | Compatible fix advertised without pinned target in audit; beta/session/cookie compatibility needs explicit migration tests |
| dompurify 3.4.9 | Critical / runtime | Compatible fix advertised; recheck generated receipt/export and untrusted HTML handling |
| shell-quote 1.9.0 | Critical / development | Compatible fix advertised; review concurrently/script invocation chain; not a reason to run blanket force upgrades |
| prisma; @prisma/config 6.19.3; deepmerge-ts 7.1.5 | High / runtime graph (CLI also used at build) | Audit proposes Prisma 7.10.1, a major migration: datasource/config/client generation and deployment changes require a separate project |
| postcss 8.4.31; sharp 0.34.5 | High / runtime graph | Audit routes fix through Next 16.4.3; verify CSS/image and standalone artifact behavior |
| nanoid 5.1.15; zod 4.4.3 | High / runtime | Compatible fixes advertised; preserve identifier and request-coercion/error semantics |
| xlsx 0.18.5 | High / runtime | No automatic registry fix advertised; evaluate maintained replacement/vendor strategy with import/export regression fixtures |
| brace-expansion 5.0.6 / 1.1.15; browserslist 4.28.2; js-yaml 4.2.0 | High / development | Compatible fixes advertised; review transitive resolution/build behavior |
| baseline-browser-mapping 2.10.36 | Moderate / runtime graph | Compatible fix advertised; verify bundling/build targets |
| eslint 9.39.4; @eslint/config-array 0.21.2; @eslint/eslintrc 3.3.5; minimatch 10.2.5 / 3.1.5 | Moderate / development | Audit suggests eslint 4.0.0 for some chains: **a major downgrade**, incompatible with current flat configs. Do not apply blindly |
| eslint-config-next 16.2.9; eslint-plugin-import 2.32.0; eslint-plugin-jsx-a11y 6.10.2; @typescript-eslint/parser, typescript-estree, utils; typescript-eslint 8.61.0 | Moderate / development | Some suggestions downgrade eslint-config-next to 12.0.4. Reject automatic downgrade; plan an aligned modern lint stack |
| @typescript-eslint/eslint-plugin, type-utils 8.61.0; eslint-plugin-react 7.37.5 | Moderate / development | Compatible fixes advertised; test rule/config changes and repeat baseline attribution |

Audit JSON is retained in ignored `scratch/review-audit-full.json` and `review-audit-runtime.json`, including upstream advisory URLs. Availability/fix suggestions are audit metadata, not approved upgrade instructions. Patched Vitest 5.0.5 and Vite 8.3.5 were not listed in these reports; their Node 24 tooling requirement remains distinct from the unchanged Node 20 application Docker runtime, which has not been verified here.

## Release decision

The current scoped verification milestone is complete: both regressions passed, all fourteen PostgreSQL cases passed without skips, and ten independent-connection race rounds passed. This does **not** clear production release or authorize hospitality implementation. Remaining gates include repository-wide authorization and legacy reversal gaps, full client/API coordination, existing-installation migration adoption, dependency triage, backup/restore, Float-money migration, historical reconciliation and a real fiscal/provider integration. Those implementation/release blockers are separate from the now-completed test verification.
