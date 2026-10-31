# PrayasshPOS baseline hospitality readiness audit

Date: 2026-10-30. Source revision: `565fad3c9d5f70b2c46e1daea0c7dfdb58b19943`.

## Scope and evidence standard

This is a source audit, not a production certification. **Verified** below means visible in repository source; **risk** means an implication requiring an isolated runtime test; **proposed** means future work. No database connections, migrations, seeds, restores, deployments or feature changes were performed. No Nodedr source was accessed or copied.

Read root `AGENTS.md`: consult installed Next.js guides before writing code. No application code was written. `node_modules/next/dist/docs/` is unavailable because dependencies are absent; future implementation must install the pinned dependencies and read the relevant local guides first. The checked-in architecture/feature documents are descriptive claims, not proof: their example schema differs from the actual Prisma schema.

## Actual architecture and deployment

| Area | Verified evidence | Implication |
|---|---|---|
| Workspace | Root `package.json`: npm workspaces `frontend`, `backend`, `packages/db`; internal name `dynapos-monorepo` | One repository with two server applications, not a browser-only frontend plus a conventional separate API framework |
| Runtime | `frontend/package.json`, `backend/package.json`: Next.js 16.2.9, React 19.2.4, TypeScript; NextAuth 5 beta; Zod 4; Prisma 6.19.3 | App Router UI and route-handler API. Frontend also runs server authentication and imports database access |
| UI | Frontend dependencies: Tailwind 4, React Hook Form, Recharts, jsPDF, XLSX, HTML QR scanner | Reusable presentation primitives; none establishes domain correctness |
| Request routing | `frontend/next.config.ts:rewrites` sends `/api/v1/*` and API docs to backend; `frontend/src/app/api/auth/[...nextauth]/route.ts`; both `src/auth.ts` and `src/auth.config.ts` copies | Session/cookie/secret agreement across services is required; deployed agreement is unverified |
| Persistence | `packages/db/prisma/schema.prisma`: PostgreSQL, DATABASE_URL/DIRECT_URL; generated client in `packages/db/client`; `packages/db/index.ts:db`, both apps' `src/lib/db.ts` | Shared database/client, route handlers directly own business logic; no central transaction/domain service layer on reviewed paths |
| Containers | `Dockerfile`: Node 20 Alpine, standalone Next output, non-root runner; `docker-compose.yml`: Postgres 15, named database volume, separate app ports | Local/VPS deployment definition exists. DB port is exposed; compose contains plaintext DB credentials (values deliberately omitted here) |
| Delivery | `.github/workflows/deploy.yml`: pushes to main/master rsync to VPS as root, rebuild Compose, prune images | No test, migration, backup or health-gated rollout step in this workflow. Actual host, TLS, DB configuration, recovery and release state were not inspected |

Root `README.md` remains the generic Next starter guide. Root build generates clients for all workspaces; frontend build also runs `copy-engines.js`. Docker builds generate Prisma, but generation does not apply schema migrations. Development uses ports 3000/3001; production Compose maps frontend/backend to 3004/3003. No dedicated queue worker is defined in Compose.

## Actual schema map

Authoritative source: `packages/db/prisma/schema.prisma` (model names are relevant symbols).

- Identity: `Business`, `Subscription`, `Branch`, `User`, `BusinessRegistrationRequest`. User belongs to one business with one optional branch; role is a string. No membership join for multiple branches or database permission tables.
- Catalog/stock: `Category`, `Subcategory`, `Brand`, `Unit`, `Product`, `ProductStock`, `Batch`, `OpeningStock`, `StockTransfer`, `StockTransferItem`. Stock is unique on product/branch. Units are names without conversion rules; warehouse IDs on some records are strings, not a Warehouse entity. Batch has no composite uniqueness on product/branch/batch number.
- Commerce: `Customer`, `CustomerLedger`, `Supplier`, `SupplierLedger`, `Sale`, `SaleItem`, `Purchase`, `PurchaseItem`, `Payment`, `SaleReturn`/items, `PurchaseReturn`/items, `CreditNote`/items, `DebitNote`/items.
- Supporting finance/history: `ExpenseCategory`, `Expense`, `IncomeCategory`, `Income`, `AuditLog`, `Notification`, `FiscalYear`, `FiscalYearInvoiceSequence`, `CbmsSyncQueue`.
- Monetary fields and many quantities use `Float`. Sale invoice, purchase, return and note numbers are globally unique, while fiscal invoice sequences are unique per business/branch/fiscal year. Sale has status, paymentStatus, paidAmount, active/cancellation/correction and printing metadata. Payment has optional sale/purchase/customer/supplier/branch/user references; no allocation, reversal, provider-event or idempotency model.
- Tenant IDs and ordinary foreign keys exist, but relations do not generally enforce matching business IDs through composite foreign keys. ProductStock can therefore reference a product and branch from different businesses if application validation fails. No RLS policy or SQL constraint migrations were found in tracked sources; deployed database policies remain unknown.
- No persisted floors, restaurant tables, menus, modifiers, rounds, kitchen stations/tickets, recipes, rooms, reservations, stays, allocations, folios or guest authorization models exist.

## Checkout, payment and refund traces

### Retail checkout

1. `frontend/src/app/dashboard/pos/page.tsx:handleCheckoutSubmit` builds a completed sale with selected branch, cart, totals, payment status and split methods. Registered customer is required by the UI for credit. Quantities are clamped to at least one in this payload despite the API supporting fractional values.
2. Frontend rewrite forwards `POST /api/v1/sales` to `backend/src/app/api/v1/sales/route.ts:POST`; `saleCreateSchema` parses the payload and `getSessionContext` authenticates it.
3. Branch is accepted from payload/session, or the oldest branch is selected/created. Customer is resolved within the business. Subscription transaction count is checked before the transaction.
4. Within `$transaction`, settings/fiscal year are resolved; `FiscalYearInvoiceSequence` is incremented, with update/upsert fallback. Products are loaded within the business and retail/wholesale database prices replace client prices. Discounts remain client inputs. Stock and optional selected batch are deducted; negative stock is allowed unless settings disable it.
5. Sale/items, outstanding customer balance/ledger (subject to credit limit), payments, audit logs and low-stock notifications are created in that transaction.
6. After commit `CbmsService.submitInvoice` is invoked without awaiting completion for completed sales; response is 201. Browser clears the cart and may print. Receipt data spreads the server response but then overwrites subtotal/total/tax with browser calculations (`invoiceData`), so displayed/printed values can differ from recorded values.

Verified issues: the same stock, payment and ledger work runs for API `DRAFT` and `ON_HOLD` statuses. `sales/[id]/route.ts:PUT` blocks updates only when existing status is COMPLETED; otherwise it accepts arbitrary truthy status/paymentStatus strings without a transition schema, audit or finalization service. Changing a draft to completed does not invoke the checkout submission pipeline again.

### Payments and outstanding amounts

`sales/route.ts:POST` creates multiple Payment rows for supplied split amounts, including CREDIT, but stores paidAmount and paymentStatus independently from client input. It does not reconcile split sum, collected funds and total. Initial sale payments omit branchId/customerId/userId. Purchase payments similarly omit metadata and **type**, so schema default RECEIVED is used even for money paid to a supplier (`purchases/route.ts:POST`).

`payments/route.ts:POST` rejects CASHIER only, accepts positive amount and optional entity links, creates a count-based receipt, records Payment and optionally reduces a scoped customer/supplier balance with ledger and audit in one transaction. It does not update linked Sale/Purchase paidAmount/paymentStatus or validate all linked entities as a consistent same-business/branch graph. Branch is payload-first. With saleId alone, no customer balance update occurs. This is not a verified incremental settlement service.

`payments/[id]/route.ts:DELETE` reads the payment before the transaction, reverses customer/supplier balance when linked, physically deletes it and writes audit. It does not recompute invoice settlement. PUT edits metadata without an audit record. GET can return income/expense fallback records including an unrestricted related User object; response projection needs review for sensitive fields. Payment listing merges income/expense records and caps each query at 5,000 before paginating; totals are therefore bounded rather than complete.

No real payment gateway capture, signed webhook reconciliation or provider refund implementation was established in these reviewed flows; method labels such as ESEWA/CARD are recorded declarations, not payment confirmation.

### Returns, refunds, cancellations and corrections

- `credit-notes/route.ts:POST` restricts role to OWNER/SUPER_ADMIN/MANAGER, validates sale tenant, checks each requested product against original sale and bounds that individual quantity. It restores ProductStock, creates CreditNote/items, reduces customer balance (floored at zero), writes ledger/audit and asynchronously submits CBMS. It uses supplied return price and current tax configuration. It does not aggregate prior returns or repeated product lines, restore batches, create an outbound refund Payment, or adjust Sale paidAmount/paymentStatus. A credit note labelled refund is not evidence of cash returned.
- `sales/[id]/cancel/route.ts:POST` has the same role allowlist and tenant check; it restores stock/batches, reverses unpaid customer receivable, marks invoice inactive and audits in one transaction. Existing payments remain; no cash/provider refund is executed. Active state is read before an unconditional update, so competing cancellation/correction requests need concurrency protection.
- `sales/[id]/correct/route.ts:POST` restores original stock/receivable, marks original inactive, creates a replacement sale with sequence/tax/stock/payment/ledger work and audit in one transaction. Old payments remain and new payments can be created without settlement transfer/reconciliation. Its customer price lookup is by ID without tenant scope and payload customerId can be linked before a later scoped balance lookup, unlike normal checkout's customer resolution. Negative-stock behavior differs from checkout.
- `SaleReturn` exists in schema, but no dedicated sale-return API was found in the route inventory. Credit notes, cancellation and correction are distinct implemented operations and must not be treated as interchangeable refund mechanisms.

## Inventory end to end

| Operation | Verified route/symbol and effects | Limitation |
|---|---|---|
| Receive purchase | `purchases/route.ts:POST`: scoped product/category/unit lookup; stock/batch additions, latest product cost, Purchase/items, supplier debt, payment/audit in transaction | Header totals trusted; branch not ownership-validated; count-based purchase number; payment direction defect above |
| Opening stock | `inventory/opening/route.ts:POST`, `approveOpeningStockTransaction`; `opening/[id]/route.ts` | Entry creation and approval are separate operations; bulk loop can partially commit. Approval helper adds stock/batches without an applied-once guard; supplied entity ownership/approval authorization requires hardening |
| Manual adjustment | `inventory/adjust/route.ts:POST`: scoped product, stock absolute/in/out/damage update and audit in transaction | No role gate or branch ownership check; absolute adjustment requires positive quantity, preventing zero |
| Alternate adjustment | `products/[id]/adjust/route.ts:POST`: rejects CASHIER, updates stock, then `logActivity` | Different authorization and clamping semantics; no transaction joining update and audit; batch balances untouched |
| Transfer | `inventory/transfer/route.ts:POST` validates tenant branches and creates pending header/items; `[id]/route.ts:PATCH` APPROVE moves source and destination stock/batches in transaction | Item product tenant not checked at creation. Stock moves at approval, before DISPATCH/RECEIVE. State read outside transaction; concurrent approval can duplicate movement. Batch loop does not reject an unfulfilled remaining quantity |
| Sale and reversal | Checkout/cancel/correct/credit note paths above | Multiple implementations of stock arithmetic and differing batch reversal rules |
| History | `inventory/stock-movements/route.ts:GET` reconstructs sales/purchases/transfers; `damage-expiry/route.ts:GET` parses audit text for damage | No authoritative stock movement entity. Reconstruction omits adjustment/reversal detail and includes sales without active/status filtering; damage audit query is tenant-wide despite branch-filtered batches |

Read-modify-write quantities and account balances are common. A transaction gives rollback atomicity but does not itself prevent lost updates or enforce stock/credit limits across concurrent transactions. No explicit serializable isolation, row-lock or idempotency primitive was found in the reviewed paths. Runtime race behavior is untested.

## Isolation, authorization and audit findings

| Priority | Verified evidence | Risk / required response |
|---|---|---|
| Critical | Both `src/auth.config.ts:jwt` copies copy role/branch from session update payload. Backend `api-helper.ts:getSessionContext` only rechecks ID/business existence, returning role/branch from token and not checking isActive/deletedAt | Potential privilege/branch escalation via session update; inactive users and changed roles may retain access. Exploitability needs isolated auth integration test; derive authority from current server-side membership |
| Critical | `sales/route.ts:POST`, purchases and adjustment routes accept branch IDs without tenant ownership validation; Payment accepts independent foreign keys | Cross-tenant relation/stock contamination is possible at source-validation level; enforce composite tenant references and validate all submitted IDs |
| High | `sales/[id]/route.ts:GET/PUT`, cancel/correct/credit notes check tenant but not assigned branch; sales GET only forces branch for CASHIER; report GET accepts optional branch without role-based branch scoping | Tenant filters are common and useful, but uniform branch isolation is not established |
| High | `api-auth.ts` defines `requirePermission`, `withAuth`, `verifyBranchAccess`; no usages found in API route search. Helper gives OWNER/SUPER_ADMIN blanket branch access; missing assigned branch can leave queries unrestricted | Helpers are not enforcement evidence. Frontend proxy matches dashboard only; direct API calls need explicit deny-by-default policy |
| High | `rbac.ts:Role` has four roles while schema comments name more; manual payment/purchase authorization blocks CASHIER rather than allowing explicit capabilities | Unknown/new roles may be allowed on sensitive APIs; kitchen/housekeeping must have narrowly scoped permissions |
| High | Sale transaction writes detailed audit; adjustment audit is less structured; `activity-logger.ts:logActivity` catches failures and is often called after commit; payment PUT and sale PUT lack audit | Useful history exists, but completeness and atomicity are inconsistent; no append-only/tamper protection established |
| High | `backup-service.ts:executeRestore` deletes tenant audit logs; schema uses cascading deletes on many financial relations | Invoice route immutability does not ensure database/history immutability |
| Medium | `settings/audit-logs/route.ts:GET` allows managers tenant-wide latest 100 logs | No branch scope or full paginated audit export in this endpoint |

These findings come from backend handlers and schema, not menu visibility or screenshots. Full route-by-route penetration testing, CSRF/cookie validation, platform-admin scope and deployed DB privilege review remain outstanding.

## Transaction, duplicate and monetary safety

- **Verified strengths:** checkout, purchases, notes, cancellation and correction group key changes in Prisma transactions; database prices are used in checkout; product tenant filters and selected batch quantity checks exist; sequence increments are atomic for an existing sequence; finalized sale PUT/DELETE is blocked.
- **High risk:** stock/balance read-modify-write and state checks without conditional transitions; count-plus-one numbering for receipts/purchases/notes; no stable request-key storage or response replay. A timeout after commit followed by retry can create another sale/payment. Browser busy state is not backend protection.
- **High risk:** invoice sequences are branch/tenant scoped but rendered number contains prefix, fiscal name and sequence only, while invoiceNumber is globally unique. Matching prefixes across branches/businesses can collide. Existing unique constraint prevents duplicate numbers, but does not produce reliable successful numbering. Concurrent initial fiscal-year creation and sequence fallback need testing.
- **High risk:** Float money and JavaScript arithmetic; no shared currency rounding/allocation policy. Overall discount is subtracted wholly from taxable base even for mixed taxable/exempt baskets, line taxes can disagree with header tax, excessive discounts can yield negative totals, and `vatPercentage || 13` replaces zero with 13. Paid status/amount and split CREDIT can disagree with actual collected cash. Purchase header amounts are client-controlled.
- **High risk:** reports `reports/route.ts:GET` sum COMPLETED sales without isActive filtering and group payments without excluding CREDIT. Cancelled/corrected sales can remain in totals; credit-note offsets are not part of that aggregate. This blocks reuse for consolidated hospitality revenue without reconciliation.
- **Verified integration limitation:** `cbms-service.ts:CbmsService.executeMockRequest` simulates delay/failure/reference IDs; it is not verified live fiscal submission. Queue creation happens after checkout commit through fire-and-forget execution, leaving a crash window. Current tax/VAT-refund comments are implementation behavior, not validated legal rules.

## Tests, migrations, recovery, printing and offline

No tracked test/spec files or SQL migration files were found with repository file searches and `git ls-files`; package scripts contain no test runners. `packages/db/package.json` supplies generate, migrate dev and seed; root also exposes db push. No checked-in migration history or release migration step was found. A real deployment may have a different schema: introspection was intentionally not performed.

`BackupService.executeBackup` reads a subset of tables using independent Promise.all queries, including password hashes in full User rows. It omits Business/Branch, payments, stocks/batches, customer/supplier ledgers, suppliers/purchases, transfers/opening stock and other entities. It computes SHA256 and sets verified=true without restore verification. Restore deletes payments/stocks/ledgers and does not recreate them, does not restore backed-up users, and can cascade into omitted relations. It trusts file contents beyond top-level business ID, does not verify checksum, and accepts an unconfined filename joined to backup directory. Stored files are local `scratch/backups`; Compose provides no app backup volume. **Treat this as unsafe for recovery until repaired and rehearsed.** No backup/restore endpoint was executed. Infrastructure snapshots/PITR, encryption, retention, RPO/RTO and restore success are unknown.

`frontend/src/lib/thermal-printer.ts:printThermalReceipt` renders HTML into hidden iframe, calls browser print, optionally fire-and-forgets print audit; fallback calls window.print. `sales/[id]/print/route.ts:POST` increments count and writes audit separately; first-print detection can race. Browser print success/cancellation and physical delivery are not acknowledged. There is no persisted KOT printer/station spool or hardware transport proof. Receipt content and tax copy need server-snapshot and physical-printer tests.

POS active carts/held bills use global localStorage keys `pos_active_orders`, `pos_current_order_id`, `pos_held_bills` (`pos/page.tsx` mount/save effects). Keys are not tenant/user/branch scoped; shared browser leakage/stale cart reuse needs testing. Holds are local, not multi-terminal open orders. Checkout needs API connectivity and reports connection failure. No registered offline transaction queue, IndexedDB synchronization or service-worker implementation was found; `cache-utils.ts` references unregistering service workers. Local cart persistence is not offline checkout support.

### Checks actually attempted

| Check | Result |
|---|---|
| Repository status | Initially clean using `git -c safe.directory=C:/projects/pos status --short`; per-command ownership exception only, no global Git config edit |
| Dependency/local guide availability | Root node_modules absent; local Next docs unavailable |
| `npm run lint --workspace=frontend` | PowerShell npm.ps1 blocked by execution policy; retried via npm.cmd |
| `npm.cmd run lint --workspace=frontend` | Failed: eslint executable unavailable because dependencies are not installed |
| `npm.cmd run test --workspaces --if-present` | Exit 0, but no test scripts exist: **no tests ran**, not a passing test suite |
| Build/typecheck/Prisma validation/integration/concurrency/hardware | Not run: dependencies/generated client and isolated database unavailable. Did not install packages, invoke seed/db push/migrate or use live services |

## Retail assumptions obstructing hospitality

`pos/page.tsx` has RESTAURANT mode, dining/table labels and local holds; table label is attached to local receipt data but absent from saleCreateSchema and database Sale. It proves presentation scaffolding only. Current checkout combines inventory consumption, fiscal invoice creation and payment capture declaration. It cannot safely represent acceptance, multiple rounds, kitchen preparation and settlement independently. Every SaleItem requires a Product, with no immutable modifier/recipe snapshots; stock moves at checkout rather than a chosen preparation event. Room nights cannot be ProductStock and rooms cannot be restaurant tables. Customer.balance is a business receivable, not an authorized stay folio. No date-range allocation or room/housekeeping state model exists. These are domain boundaries, not missing dropdown options.

## Keep / refactor / build-new matrix

| Component | Decision | Reason / prerequisite |
|---|---|---|
| Monorepo, Next app shell, Postgres, Prisma workspace | Keep | Shared identity/data transactions suit combined operations; improve release checks first |
| Retail UI, public v1 shapes and workflows | Keep with regression fixtures | Preserve behavior; explicitly document security/accounting fixes that must alter unsafe behavior |
| Business/branch/customer/supplier/catalog | Reuse + refactor constraints | Existing entities fit shared core; enforce tenant graph and membership |
| Authentication, permissions, audit | Refactor | Current token authority/branch checks and audit coverage insufficient |
| Invoice, tax, payment and reporting | Refactor behind compatibility adapters | Reconciliation, decimal amounts, allocation/refund ledger, reliable numbering and one revenue source required |
| Stock/batch/purchase functionality | Reuse entities; refactor mutation service | Central atomic stock movement ledger, recipe units and consistent reversal rules |
| Receipt rendering/export | Reuse presentation; refactor data source | Authoritative snapshots; distinguish print requests from confirmed output |
| Backup, fiscal sync, print delivery | Refactor / new worker infrastructure | Incomplete recovery, mock fiscal client, no durable job acknowledgment |
| Restaurant order/menu/modifier/round/KOT/KDS/stations | Build new domain module | Independent acceptance, fulfillment and settlement; no retail Sale draft reuse |
| Rooms/reservations/stays/allocations/folios/operations | Build new domain module | Date concurrency and stay lifecycle need purpose-built schema |
| QR locations, expiring guest sessions/service requests | Build new public module | Permanent location identity is not guest authority |

## Recommendation and unresolved decisions

**Extend this repository as a modular monolith**, with separate restaurant, hotel and guest interfaces/domain packages and a hardened shared financial/inventory core. Retain v1 retail adapters. This avoids duplicating identity, stock and financial truth or introducing distributed folio/payment commits immediately. A separately deployed public guest frontend is reasonable within the same repo; it must call restricted APIs, not the staff database client. Do not add all hospitality logic to the existing large POS page or Sale status string.

A separate hospitality app/database would reduce UI coupling, but requires reliable cross-app identity, stock/revenue reconciliation, events and compensations that do not exist today. Reconsider service extraction only after contracts/outbox, operational ownership and scaling measurements support it. This recommendation assumes one business can operate retail, restaurant and hotel branches together; validate that assumption.

Before implementation resolve: jurisdiction/tax and invoice timing with qualified business advisers; currency/rounding and discount allocation; payment providers and cash-change semantics; deposit liabilities, cancellation/no-show/refund policy; room timezone, arrival/departure boundaries and provisional hold expiry; room-type inventory/group booking needs; split folio/company billing; night audit/room-rate posting cadence; kitchen consumption timing/waste policy; branch access matrix, guest verification and shared-room bill privacy; printing hardware/LAN and outage expectations; Google review URL ownership; RPO/RTO and production schema/migration history. No legal compliance or provider certification is asserted by this audit.

The dependent backlog, proposed schema and required regression gates are in [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md). No hospitality implementation should bypass the foundation gates there.

## Follow-up on restro

The sections above preserve the original baseline audit. A first hardening change set, its compatibility changes, new tests/migrations and remaining release blockers are recorded at the top of [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md). That change set does not supersede the baseline evidence with a claim of production readiness; the later scoped verification checkpoint passed the full PostgreSQL suite and repeated races, as recorded in [HARDENING_STATUS.md](HARDENING_STATUS.md). Remaining implementation and release blockers are not cleared. Local setup is documented in [LOCAL_DEVELOPMENT.md](LOCAL_DEVELOPMENT.md).
