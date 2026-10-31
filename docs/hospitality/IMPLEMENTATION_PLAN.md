# Hospitality implementation proposal

Current verification checkpoint (2026-10-31): [HARDENING_STATUS.md](HARDENING_STATUS.md) supersedes the historical verification claims below. Both previously failing PostgreSQL regressions now pass; the full expanded suite passed 14/14 with zero skips, followed by ten independent-connection race rounds and a passing post-stress full run. The current verification milestone is complete; broader P0/P1/P2 implementation and production release gates remain incomplete. No hospitality implementation or release is authorized by this checkpoint.

## First hardening milestone review — 2026-10-30

Implemented on existing branch **restro**, starting from `565fad3c9d5f70b2c46e1daea0c7dfdb58b19943`, which matched local main and origin/main. No remote restro head was advertised by `git ls-remote --heads origin restro`. Original uncommitted audit/plan files were retained. No commits, pushes, production merges or deployments were made. The original proposal below remains a roadmap; **P0/P1/P2 as whole phases are not complete**.

### Implemented scope and evidence

| Change | Files / symbols | Review impact |
|---|---|---|
| Current database authority | Both apps' `src/auth.config.ts:jwt`, `src/lib/api-helper.ts:getSessionContext`, `src/lib/api-auth.ts:getAuthContext` | Client session updates cannot replace role/branch. Inactive/deleted users/businesses, unknown roles and branchless non-owner staff fail closed. UI token claims may remain stale until refresh, but hardened APIs read current user authority |
| Explicit branch checks | `backend/src/lib/commerce-policy.ts:assertBranch`, `commerce-transaction.ts:resolveBranch`; sales list/detail/print/cancel/correct, payment list/detail/create/edit/delete, primary adjustments, purchase/report, opening-stock and transfer routes | Tenant ownership, active branch and assigned staff branch enforced on these paths. Owners/SUPER_ADMIN are limited to their current tenant. Cross-branch transfer commands require access to both branches |
| Server settlement | `commerce-policy.ts:reconcilePayment`, sales POST, correction POST, payment POST and purchase POST | Client paymentStatus is no longer authoritative. CREDIT does not create collected Payment rows. Cash change is excluded from applied funds; inconsistent split sums, unsupported overpayment and missing non-cash references are rejected. Retail amount rounding uses two fractional digits with precision bounds; Float persistence and full currency policy remain pending |
| Explicit payment provenance | `Payment.source`, sale/purchase/payment writers | New collections are STAFF_RECORDED, historical records default LEGACY_UNVERIFIED. Clients cannot supply PROVIDER_VERIFIED. Non-cash staff declarations require a reference; no provider adapter or webhook verification was added. A QR/client success flag has no verification authority |
| Durable retry identity | `RequestResult`, `commerceTransaction`; browser `postCommerce` and POS/manual payment forms | Checkout/payment/correction/credit/debit-note commands require an Idempotency-Key. Business effects and stored JSON response commit together; actor/body mismatch returns 409. Browser retains ambiguous request identity in scoped local storage across reloads and releases it only after reading a valid successful response |
| Concurrent stock protection | `serializable` retry helper; checkout and existing stock writers in purchases, product upsert/adjustments, opening approval, transfer approval, cancellation, correction, credit/debit notes | Serializable transactions retry P2034 up to four total attempts; exhaustion returns 409. Checkout uses atomic stock/batch decrement and preserves configured allow/prevent-negative policy. Coarse Business row update serializes idempotent commands and first sequence creation. Throughput and real race behavior still require PostgreSQL verification |
| Supporting safety changes | scoped invoice sequence upsert, globally distinct new invoice identifiers, `OpeningStock.appliedAt`, primary report aggregate filters, invoice immutability guards | New invoice numbers include business/branch identity to match global uniqueness; old numbers remain unchanged. Opening posting gets an applied-once marker. Main reports exclude inactive invoices and CREDIT collections, but comprehensive accounting reconciliation remains outstanding |
| Isolation/test infrastructure | `compose.restro.yml`, `scripts/restro-env.mjs`, `vitest.config.mts`, `tests/*.test.ts`, `.github/workflows/restro-checks.yml`, root package scripts/lockfile | Dedicated loopback test DB target, ignored generated credentials, pure/unit tests plus seven real-PostgreSQL regression cases; CI uses a disposable service and no production secrets |

### Compatibility changes requiring review

- Existing URLs and successful sale/payment response shapes are retained, with additive payment provenance. External callers must send stable 16–128 character Idempotency-Key values for hardened POST commands. Missing/invalid keys return 428; conflicting reuse returns 409. Request hashing preserves exact JSON ordering: retry the same serialized body/key, not a reconstructed edited payload. Actor/role/branch changes cannot replay a prior authority context's response; branch access is rechecked before replay.
- Checkout paymentStatus is accepted for request compatibility but derived from collections. Partial/unpaid sales require a valid registered customer and respect credit limits. Non-cash manual entries require paymentReference (or reference on manual payments); POS prompts explicitly for a staff-recorded reference. Staff payment permission does not establish external provider verification. Unknown payment method strings are rejected instead of silently becoming CASH.
- Frontend POS/manual received/sent forms supply durable keys automatically. Other API consumers, including future correction/note screens, must be updated before use. No hospitality screens were added.
- Checkout only finalizes COMPLETED invoices. API DRAFT/ON_HOLD creation and arbitrary invoice status/paymentStatus PUT are rejected; browser-local retail holds remain available. A server-side draft lifecycle needs a separately reviewed service.
- Manual payment POST requires OWNER/MANAGER/SUPER_ADMIN. Invoice links must match tenant, branch, direction and party; amount cannot exceed invoice/party outstanding. Late invoice payments update paidAmount/paymentStatus and the matching party ledger atomically. Standalone party receipts remain party-level allocations, not implicit payment against every invoice.
- Deleting invoice-linked Payment rows, correcting settled/credited invoices, or cancelling paid/credited invoices returns 409 until an allocated reversal/refund workflow exists. These are deliberate restrictions on previously unsafe behavior. Standalone payment reversal remains supported; it rereads existence within a serializable transaction. No cash/provider refund implementation is claimed.
- Owner list/report endpoints now resolve a valid branch when none is supplied instead of accidentally opening tenant-wide queries. Cashier inventory adjustments are consistently denied on the hardened paths; managers cannot move stock across an unassigned branch. Unknown legacy roles require a reviewed permission mapping before re-enabling.
- New invoice numbers include full business/branch IDs, increasing their length; receipt width and downstream fiscal format compatibility require review. Prior invoice numbers are untouched. Existing receipt totals now use checkout's server response; full line snapshot/printing fidelity remains a follow-up.

### Migrations and local environment

See [LOCAL_DEVELOPMENT.md](LOCAL_DEVELOPMENT.md). The root ignore rule that hid migrations was removed. `202610300001_retail_baseline` reproduces the reviewed schema from source; `202610300002_commerce_hardening` adds Payment.source, RequestResult with unique business/operation/key, and OpeningStock.appliedAt. Neither was applied locally. Do not apply the baseline CREATE migration to an existing installation; drift comparison and baseline adoption require a separate reviewed procedure.

An ignored `.env.restro.local` was generated with random development-only credentials. The launcher validates 127.0.0.1:55439/restro_test and overrides inherited database variables. Docker CLI exists but the engine is not running, and psql was unavailable. No production credentials/data/database or production migration was used. Existing deployment triggers are main/master only; restro's new CI has no deployment job. External hosting triggers were not verified. Nothing was pushed.

### Verification results

- Lockfile install: `npm.cmd ci --legacy-peer-deps --ignore-scripts` succeeded. Vitest was added with npm, audited and upgraded to 5.0.5 with explicit Vite 8.3.5 peer dependency (Node 24 tooling/CI); Prisma client generation succeeded. Prisma reports deprecated package.json configuration, tracked for future tooling work.
- `npm test`: **19 unit tests passed; 7 PostgreSQL integration tests skipped** without an explicit target. Unit coverage includes browser retry identity after lost/truncated responses, tenant/branch/role rejection, database authority over stale/forged claims, manual/provider provenance, split/credit/change/rounding, idempotent replay/conflict and bounded serialization retries. Mocked transaction tests do not prove database rollback or race safety.
- `npm run test:integration`: **failed in suite setup**, unable to reach only the isolated loopback database. None of its seven cases ran. Cases are written for foreign/unassigned branches, provider-claim rejection, derived status, concurrent duplicate checkout/payment replay, both negative-stock policies, and failed-checkout rollback including sequence/stock/payment/request result.
- Both apps' TypeScript checks passed. Both final Next production builds exited 0 with the isolated launcher; builds do not establish database correctness. Turbopack reported generated Prisma CommonJS/export and broad file-tracing warnings; artifact contents and Node 20 container runtime still need release verification. No production server was started. `git diff --check` passed.
- Full frontend lint failed on existing application/vendor lint debt. Initial run: 315 errors and 334 warnings; final ESLint API run: **312 errors and 331 warnings**. Comparison limited to changed frontend files: baseline 67 errors versus current 64. New commerce policy/transaction/browser-request helpers passed focused lint; repository-wide lint is not green. Raw logs are in ignored scratch files, not release artifacts.
- Final install audit reported **17 vulnerabilities (1 moderate, 11 high, 5 critical)** in the dependency graph. The newly added test runner was upgraded to patched Vitest 5.0.5 after audit; no sweeping dependency upgrades or automatic audit fix was applied. Review the final dependency audit before any release.

### Remaining gates and release blockers

1. Run both migrations and all seven integration cases on disposable PostgreSQL; test real contention, crash/retry behavior and business-lock throughput. Review expanded API regressions and request-key behavior with multiple tabs/terminals. The current milestone is reviewable, **not cleared for release**.
2. Complete endpoint-by-endpoint tenant/branch policy coverage and composite tenant foreign keys. The new shared authority helper is global; explicit resource guards currently cover the listed financial/stock paths, not every catalog/ledger/report/platform endpoint. No blanket claim of tenant isolation is made.
3. Decimal schema/currency policy, historical balance/stock reconciliation, full refund/allocation model, credit/debit-note tax/revenue integration, rate-limited provider event verification and complete report correctness remain required. Current manual collection provenance is not a real gateway integration.
4. Existing backup/restore remains incomplete and unsafe for recovery. No repair/rehearsal was performed; do not use it on live data. Fiscal submission remains a mock, opt-in on edited sale/credit-note paths and never proof of compliance. Existing fiscal admin/debit-note behavior still requires review before release.
5. Opening-stock entry creation/status changes and audit helper calls are not yet a fully atomic audited workflow; the applied marker protects new posting duplicates but historical opening entries need reconciliation. Main stock projection still lacks an authoritative movement ledger; alternate imports, batch constraints and all approval transitions need further regression coverage.
6. Repair repository lint debt, triage dependency vulnerabilities, rehearse printer formats for longer invoice IDs and complete release migration/backup checks. No restaurant/hotel/guest features should start before this review and the required foundation gates.

---

Original roadmap dated 2026-10-30. The first-milestone implementation status and limitations are recorded above; remaining phases are proposals. Original evidence: [AUDIT.md](AUDIT.md).

## Architecture and compatibility contract

Extend the existing repository with bounded modules, keeping the current retail route contracts as compatibility adapters. Proposed directories are design targets, not existing files. Route handlers authenticate, validate and call application services; they should not duplicate stock, settlement or state-transition logic. Feature flags are per business/branch; retail remains the default. New hospitality APIs live under explicit restaurant/hotel/guest namespaces without repurposing retail Sale statuses.

| Boundary | Owns | May depend on |
|---|---|---|
| Shared identity/policy | Businesses, branches, user memberships, permissions, capability flags, active membership resolution | DB and security infrastructure |
| Catalog/inventory | Products, suppliers, purchases, stock/batch ledger, units/conversions, recipe consumption posting | Identity, audit |
| Billing/settlement | Invoice/tax snapshots, charges, payment allocation, deposits, credit/refund/reversal, reconciliation | Identity, audit, explicit inventory commands |
| Retail adapter | Existing v1 request/response translation and retail UI behavior | Shared catalog, inventory and billing services |
| Restaurant | Floors/tables, menus/modifiers, orders/rounds, acceptance, kitchen tickets/stations and fulfillment | Policy, catalog, recipe service, billing |
| Hotel | Rooms/types, availability/allocations, reservations/stays, moves/extensions, housekeeping/maintenance | Policy, billing; restaurant through explicit folio-posting command |
| Guest access | QR resolution, stay-scoped sessions, own bill/order tracking/service requests | Restricted hotel/restaurant interfaces; no general staff APIs |
| Delivery/operations | Durable outbox/inbox, KDS updates, printer jobs, fiscal/provider adapters, backup/monitoring | Transactionally emitted domain events |

A dedicated guest frontend and worker may deploy separately from the staff UI while sharing repository contracts. KDS reconnects from persisted ticket versions; transport (polling/SSE/WebSocket) is an implementation decision after deployment verification.

## Proposed persistence and invariants

### Shared core changes

- Add unique `(businessId,id)` keys and tenant-consistent composite references for branch-scoped resources and submitted relations. Backfill and detect corrupt cross-tenant links before enforcing. Introduce `UserBranchMembership` and explicit capability checks; staff without an authorized branch fail closed. Platform support access requires explicit scoped context and audit.
- Introduce Decimal money columns with explicit precision, currency and rounding policy; Decimal quantities/unit conversions separately. Expand/backfill/compare/contract rather than casting live Float values silently. Preserve historical invoice amounts; investigate discrepancies instead of recomputing history from current prices/taxes.
- Central pricing/tax calculation snapshots line description, price, discount allocations, tax rates/bases and rounding. Bound discounts; derive settlement status from allocated collected payments. Credit is receivable, not a payment capture. Separate tendered cash, applied amount and change.
- Add `IdempotencyRecord(businessId, operation, key, requestHash, resultReference, response, state)` with unique business/operation/key. Reserve/commit alongside domain writes; same key/body replays result, different body conflicts. Add unique provider-event IDs and source-event IDs. Define retention longer than permitted retry windows.
- Add `PaymentAllocation`, `PaymentReversal`, `Refund` and refund allocations with immutable references to original settlement; deposits represent liability/credit until applied. Payment lifecycle separates initiated/confirmed/failed/refunded. Existing Payment/Sale fields become reconciled projections through legacy adapters. No hard delete for new financial history.
- Add append-only `StockMovement`/lines with business, branch, product/batch, signed quantity, unit, source type/id, event key, reversal reference and actor. Uniqueness prevents repeated consumption/reversal. Keep ProductStock as an atomic projection; stock limit checks and mutation happen under locks/conditional updates. Add batch keys, indexes and reconciliation against historical opening balances.
- Replace count numbering with atomic scoped sequences and a rendered invoice identifier compatible with its uniqueness policy. Preserve old numbers and v1 lookup behavior. Add transaction-safe `AuditEvent` with actor/stay identity, branch, operation/request ID, entity version, before/after and reason; restrict mutation privileges and redact secrets.
- Add `OutboxEvent`, consumer `InboxEvent`, `PrintJob`/attempts and durable retry metadata. Commit events with source transaction; workers acknowledge independently. Actual fiscal/provider integration must replace mock behavior before any compliance claim.

### Restaurant module

Proposed entities: `Floor`, `RestaurantTable`, `TableSession`, `Menu`, `MenuSection`, `MenuItem`, `ModifierGroup`, `ModifierOption`, `MenuItemModifierGroup`, `RestaurantOrder`, `OrderLine`, `OrderRound`, `RoundLine`, `KitchenStation`, `StationRoute`, `KitchenTicket`, `KitchenTicketLine`, `RecipeVersion`, `RecipeIngredient`, `ConsumptionPosting`, `WaiterCall`.

Every aggregate has tenant/branch ownership, versions and scoped indexes. Table identity is unique within branch; table occupancy/session differs from order and supports table moves/merges through audited commands. MenuItem may reference a stock product or recipe; it is not a room. OrderLine snapshots modifiers, price/tax and recipe version. Submitted rounds are immutable revisions; additions/cancellations generate explicit kitchen deltas.

Keep three independent dimensions:

- Acceptance: PENDING, ACCEPTED, REJECTED (cancellation commands preserve history).
- Fulfillment: line/ticket QUEUED, PREPARING, READY, SERVED, CANCELLED; aggregate progress is derived.
- Settlement: UNPAID, PARTIAL, PAID, PARTIALLY_REFUNDED, REFUNDED, derived from charges and allocations.

Acceptance never implies payment or readiness; paying never marks food served. Routing is snapshotted per round/station and persisted even while printer/KDS is disconnected. Unique round/station/revision dispatch keys prevent repeated tickets. Choose and document consumption trigger (for example preparation start); retries consume once, pre-preparation cancellation releases reservations, post-preparation cancellation records waste rather than restoring edible stock automatically. Refund and physical return are separate decisions.

### Hotel module

Proposed entities: `RoomType`, `Room`, `Reservation`, `ReservationGuest`, `Stay`, `StayGuest`, `RoomAllocation`, `RoomRateSnapshot`, `RoomNightCharge`, `GuestFolio`, `FolioEntry`, `FolioSettlementAllocation`, `HousekeepingTask`, `MaintenanceTicket` and operational history.

Rooms have stable identity and branch-local unique room number. Room operational availability/maintenance and housekeeping CLEAN/DIRTY/INSPECTED are independent from occupancy, which is derived from allocations/stays. Checkout ends occupancy and creates cleaning work; it does not mark a room clean. Maintenance blocks use the same allocation conflict mechanism.

**Concurrency rule:** `RoomAllocation` stores room, tenant/branch, start/end timestamptz and explicit blocking state. Use half-open `[start,end)` intervals with start < end. A PostgreSQL GiST exclusion constraint rejects overlapping blocking ranges for the same room (tenant key included where appropriate); enable the required equality operator extension in a reviewed SQL migration. Reservation holds, confirmed stays and maintenance blocks all participate. Availability query is advisory; the database allocation write is authoritative. Prisma alone will not express the full exclusion constraint: retain custom SQL in migrations and test against PostgreSQL.

Expired holds must explicitly transition out of blocking state via transactional expiry/revalidation; do not put volatile current-time expressions in a partial constraint. Allocation commands lock/expire due holds then attempt insertion, map conflicts to 409 and retry serialization/deadlock errors within bounds. A room-type booking without a room needs separately locked type-capacity inventory before acceptance, or defer that feature; room exclusion alone does not protect unspecific room-type inventory.

Check-in binds guest, active Stay, allocation and folio. Transfer closes/adjusts the old allocation and creates the new one atomically, retaining the same stay and folio. Extension atomically changes allocation end after conflict validation; on conflict retain the old end. Back-to-back departures/arrivals are allowed by the interval rule, subject to housekeeping readiness policy. Room-night postings are unique by stay/date/charge kind and rate revision policy. Deposits and refunds remain distinct from room revenue.

### Revenue and folio bridge

Every food/service/room charge has one canonical source and immutable monetary snapshot. `FolioEntry` belongs to `GuestFolio -> Stay`, never a room-number string, and has a unique `(businessId, sourceType, sourceId, postingKind)` key plus reversal link. Posting checks that the stay is active and authorized, locking against simultaneous checkout; checkout freezes posting and either commits settlement or returns a defined outstanding-balance result.

Proposed accounting contract: restaurant finalization owns the food invoice/revenue; charge-to-room posts a **receivable transfer** linked to that invoice into the stay folio, not a second sale, Income row or second revenue charge. Hotel checkout collects/allocates against that receivable; consolidated presentation may reference the food invoice but does not recognize food revenue again. Room-night charges have their own invoiceable source. If business rules instead require one final hotel tax invoice, agree that alternative before implementation and use un-invoiced charge sources until checkout; never run both recognition paths. Define tax timing and liability entries with the business's accounting adviser.

Example acceptance invariant: food invoice 1,000 posted twice to a stay produces one 1,000 food revenue source and one 1,000 folio receivable; checkout payment 1,000 clears it without another 1,000 revenue. A 200 food credit/reversal reduces outstanding/revenue adjustment once and references its source; room charges and cash refunds reconcile independently. Cross-module posting is one DB transaction initially; outbox only distributes notifications afterward.

### Permanent QR and guest authorization

Add `QrLocation` with a stable opaque public ID and exactly one location target (room or restaurant table), plus `GuestAccessGrant`, hashed/rotatable `GuestSession` credentials, `ServiceRequest` and status history. QR identifies branch/location and can show public menu/help; it carries no reusable stay secret. Guest enrollment uses an approved verification flow (front-desk handoff/OTP, to decide). A session binds business, active stay, guest and allowed scopes; expiry is bounded by stay authorization and server checks active status on every privileged request.

Checkout/revocation invalidates all stay grants atomically; extension may extend explicit authorization and room transfer changes permitted location binding without changing folio ownership. A new occupant scanning the same room QR cannot inherit the prior guest bill/orders. Table QR supports only table-scoped order initiation with abuse controls and staff acceptance; it cannot read a hotel folio. Guest bill visibility is explicitly scoped for shared rooms. Order tracking and waiter calls use tenant/branch/stay authorization, rate limits and deduplication. Google review URL is configured per property and exposed without granting access to any accounting data.

## Phased backlog and exit criteria

Priority order is risk-based. Each phase requires review before release; this document authorizes no implementation or production action.

| Phase | Work items | Dependencies | Acceptance / exit gate |
|---|---|---|---|
| P0: baseline and recovery | Install locked dependencies in a controlled environment, read local Next guides, capture retail API fixtures, establish disposable PostgreSQL, inventory actual deployed schema through an approved read-only process, baseline migrations, document secrets/config, repair/rehearse backups | Business environment and recovery owners identified | Lint/typecheck/build results recorded; baseline drift documented; clean DB reproducible from migrations; isolated restore recovers all balances/stock/links; RPO/RTO and rollback procedure agreed; no use of current destructive restore on live data |
| P1: security foundation | Server-derived current authority, memberships/capabilities, tenant/branch composite constraints and validation, endpoint authorization matrix, scoped response projections, atomic audit | P0 | Direct API tests reject foreign tenant IDs, wrong branch, inactive/deleted user, stale role and forged session role/branch; unknown roles deny; sensitive user fields absent; required audit failure rolls back mutation |
| P2: financial/inventory core | Decimal/rounding service, atomic stock and balance mutations, sequences, idempotency, allocations/refunds/reversals, report reconciliation, transactional outbox; retain retail adapters | P0/P1 | Same request retried/concurrent produces one effect; split collections/status agree; simultaneous sales cannot violate configured stock/credit limits; cumulative returns bounded; all legacy retail fixtures pass or approved bugfix deltas documented; cancelled/corrected/refunded revenue reconciles |
| P3: restaurant staff MVP | Floors/tables, menu/modifier validation and snapshots, persisted open orders/table sessions, rounds, acceptance/fulfillment/payment separation, partial/multiple payments | P1/P2 | Two terminals see same versioned order; stale writes conflict; rejected order does not enter preparation; paying does not change kitchen state; new round preserves earlier rounds; retail APIs unchanged |
| P4: production kitchen and ingredients | Station routing, KOT jobs, KDS state/reconnect, cancellation deltas, recipes/conversions, consumption/waste | P3 and durable worker from P2 | Each round routes once per station; reconnect/retry/reprint creates no duplicate logical ticket or consumption; partial station completion derives correct progress; recipe revision snapshots retained; printer failure does not lose order |
| P5: hotel inventory and stays | Rooms/types, allocation exclusion constraints, reservations/deposits, check-in/out, transfers/extensions, housekeeping and maintenance | P1/P2; hotel policy decisions | Concurrent same-room overlapping reservation/check-in/maintenance attempts yield at most one blocking allocation; adjacent stays allowed; extension conflict preserves old stay; transfer is atomic; occupied+dirty and vacant+dirty represented independently |
| P6: folios and combined settlement | Room-night postings, active-stay charges, restaurant-to-folio transfer, deposit application, refunds, checkout freeze/reconciliation | P3/P5, P4 for recipe-enabled food | Duplicate food posting never duplicates receivable or revenue; simultaneous checkout/posting cannot attach to closed stay; partial payment/deposit/refund balances reconcile; transfer retains same folio; own bill matches canonical sources |
| P7: guest portal and QR | Permanent location QR, verified stay sessions, menu/order/service requests/waiter calls, tracking/bill/checkout request, review link | P3/P5/P6; guest verification and privacy policy | Printed QR survives occupant turnover; old credentials fail immediately at checkout; unauthenticated QR reveals no prior bill; guest cannot access another stay/branch; checkout request does not silently check out; retried calls/orders dedupe |
| P8: pilot and rollout | Property flags, observability, hardware rehearsals, load/concurrency tests, operations training, deployment gates, recovery rehearsal, limited property pilot | All required preceding phases | Retail regression suite green; financial totals reconciled for pilot; worker backlog/failed printers visible; migration rollback/forward-fix rehearsed; restore meets agreed targets; feature flags can disable new entry points without erasing committed charges |

Offline financial mutations are a separate gated scope after P2 idempotency and conflict policy. Initial hospitality behavior should clearly preserve drafts locally and require online confirmation for allocations, folio postings and payment finalization. If offline operation is mandatory, design terminal identity, encrypted tenant-scoped storage, sync journals, duplicate replay and payment/room conflict resolution before promising it.

## Required regression and adversarial tests

Use real disposable PostgreSQL for constraints/transactions and parallel independent connections for races; mocked Prisma unit tests cannot prove allocation or stock safety. Keep existing v1 response fixtures and compare behavior, while explicitly approving fixes to unsafe behavior.

| Suite | Required scenarios / assertions |
|---|---|
| Retail pricing and receipts | Retail/wholesale, fractional API quantities, taxable/exempt mixed carts, zero VAT, per-line/overall/excess discounts, currency precision, cash change, stale browser pricing. Printed receipt and API totals equal persisted canonical snapshot |
| Retail settlement | Cash/card/credit/split/partial/overpayment, late payment allocation, payment reversal, duplicate submit after lost response; CREDIT excluded from collected cash; no paidAmount/status drift |
| Returns/corrections | Repeated/cumulative and duplicate-line credit notes, historical tax/discount amounts, batch restoration, physical return versus cash refund, concurrent cancel/correct/refund; one reversal and no over-refund |
| Inventory | Purchase/opening/adjust/transfer, zero correction, repeated opening approval, concurrent deduction and credit-limit checks, batch exhaustion/expiry, failed transaction rollback, ledger/projection reconciliation |
| Security and audit | Every endpoint/action by role and branch; arbitrary linked IDs from another tenant; unassigned branch denied; session update forgery, deactivation/role change, guest revocation; audit actor/reason completeness and absence of secrets |
| Numbering and jobs | First invoice and simultaneous invoices in multiple branches/businesses/fiscal years; stable idempotency replay; same key/different body rejected; crash before/after commit; worker retries, duplicate provider events, fiscal failure; one financial effect |
| Restaurant | Independent acceptance/kitchen/payment transitions, round additions/modifiers, table move/merge, multi-station completion, stale edits, rejected QR orders, repeated ticket delivery, preparation cancellation/waste, recipe conversion/consumption once |
| Hotel concurrency | Overlap/nested overlap, adjacent intervals, simultaneous booking/check-in/extension/transfer/maintenance, expired hold race, cancelled allocation release, room-type capacity if supported; no double allocation after retries |
| Folio accounting | Active-stay validation, duplicate room-night/food sources, checkout/post race, room move and extension, deposits, split settlement, refund after checkout; source-level revenue counted once and ledger balances reconcile |
| Guest portal | Same QR across stays, revoked/expired/rotated grants, guessed IDs, shared-room privacy, cross-stay tracking, duplicate service request, request rate limiting, checkout request approval and configured review link |
| Recovery and operations | Complete encrypted backup/restore and checksum corruption rejection, tenant-isolated restore validation, migration upgrade from retail fixtures, printer cancel/offline/reprint behavior, KDS reconnect, process restart/outbox replay, feature-flag rollback |

## Decisions and rollout safeguards

Resolve the audit's questions during P0 and record decisions, especially tax invoice timing, folio recognition, deposits, reservation holds, consumption event, provider confirmation, printing and mandatory offline scope. No schedule estimates are offered without those decisions and baseline checks. Existing UI restaurant labels are not an MVP acceptance criterion.

Use expand/backfill/validate/contract migrations with reconciled checkpoints and disposable-clone rehearsals. Introduce additive models and flags first; avoid reinterpretation of historic Sale rows or destructive blanket casts. Retain legacy financial records and IDs. Fix security defects across both UI and direct API access even where that requires documenting a deliberate behavior change. Do not fork duplicate financial truth into a new hospitality database to avoid these foundation fixes.
