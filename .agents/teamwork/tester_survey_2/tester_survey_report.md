# Phase 3 Verification Strategy, Test Environment Architecture & Adversarial Matrix Report
**Restaurant Staff MVP (Dine-in, Tables, Menus & Orders)**

Date: 2026-11-01  
Working Directory: `c:\projects\pos\.agents\teamwork\tester_survey_2`  
Author: Tester Concurrency & Invariants Explorer (`tester_survey_2`)  
Authoritative Specifications:
- `docs/hospitality/phases/PHASE_3_RESTAURANT_MVP.md`
- `docs/hospitality/IMPLEMENTATION_PLAN.md`
- `.agents/teamwork/ORIGINAL_REQUEST.md`

---

## 1. Executive Summary & Verification Resource Survey

An exhaustive survey of the test harness, container environment, and verification scripts was conducted to establish the testing architecture and adversarial matrix for **Phase 3: Restaurant Staff MVP**.

### 1.1 Live Verification Resource Audit

All six standard verification commands and supporting test suites were executed live against the isolated PostgreSQL container environment on `127.0.0.1:55439`:

| Verification Command | Scope / Target | Result | Evidence |
|---|---|---|---|
| `npm.cmd run typecheck` | Monorepo TypeScript check (`backend` & `frontend`) | **PASSED (Exit 0)** | Zero type errors across both TS configurations |
| `npm.cmd test` | Pure unit and policy suites (Vitest) | **PASSED (Exit 0)** | 9 test files passed, 85 passed tests, 41 integration tests cleanly skipped |
| `node scripts/restro-env.mjs recovery-test` | Isolated PostgreSQL tenant recovery regression (`55439`) | **PASSED (Exit 0)** | 8/8 tests passed, zero skipped |
| `node scripts/restro-restore-env.mjs rehearse` | Cross-cluster synthetic recovery rehearsal (`55439` -> `55440`) | **PASSED (Exit 0)** | 41/41 reconciliation and negative checks passed |
| `node scripts/restro-env.mjs integration` | Core commerce checkout atomicity suite | **PASSED (Exit 0)** | 14/14 tests passed, zero skipped |
| `node scripts/restro-env.mjs backend-build` | Next.js 16.2.9 Turbopack production backend build | **PASSED (Exit 0)** | Successfully compiled and traced 60 routes |
| `node scripts/restro-env.mjs frontend-build` | Next.js 16.2.9 Turbopack production frontend build | **PASSED (Exit 0)** | Successfully compiled and traced 64 routes |

### 1.2 Isolated Environment Architecture
- **Primary Loopback Target**: Port `127.0.0.1:55439` (`restro_test` DB, `restro_dev` user). Hardcoded verification in `scripts/database-verification.mjs:isolatedDatabaseUrl` strictly refuses any non-loopback or production target.
- **Disposable Restore Target**: Port `127.0.0.1:55440` (`restro_restore` DB, `restro_restore` user). Used exclusively for disaster recovery rehearsal via `scripts/restro-restore-env.mjs rehearse`.
- **Concurrency & Race Witnessing**: `scripts/verify-restro-milestone.mjs` and `tests/commerce.integration.test.ts` implement PostgreSQL backend PID witnessing via `SELECT pg_backend_pid() AS pid;` and `pg_sleep(0.025);`. Concurrency tests empirically assert `new Set(witness.pids).size >= 2`.

---

## 2. Backup-Format & Recovery Test Assertion Evaluation

A critical aspect of Phase 3 is ensuring that schema additions do not break the tenant recovery engine or disaster recovery rehearsal.

### 2.1 Schema Dependency Analysis in `backup-format.ts`
In `backend/src/lib/backup-format.ts` (lines 12–19), the backup engine dynamically builds the topological dependency list of models:
```ts
const models = Prisma.dmmf.datamodel.models.filter(model => !excludedModels.includes(model.name));
export const backupModels: typeof models = [];
const pending = [...models];
while (pending.length) {
  const index = pending.findIndex(model => 
    model.fields.filter(field => field.relationFromFields?.length)
      .every(field => backupModels.some(parent => parent.name === field.type))
  );
  if (index < 0) throw new Error("Backup schema has unsupported dependency cycle");
  backupModels.push(pending.splice(index, 1)[0]);
}
export const schemaHash = createHash("sha256").update(JSON.stringify(backupModels)).digest("hex");
```

### 2.2 Phase 3 Model Dependency Graph & Acyclicity Proof
Phase 3 introduces 12 new entities into Prisma:
1. `Floor` (depends on `Business`, `Branch`)
2. `RestaurantTable` (depends on `Business`, `Branch`, `Floor`)
3. `TableSession` (depends on `Business`, `Branch`, `RestaurantTable`, `User`)
4. `Menu` (depends on `Business`, `Branch?`)
5. `MenuSection` (depends on `Business`, `Menu`)
6. `MenuItem` (depends on `Business`, `MenuSection`, `Product?`)
7. `ModifierGroup` (depends on `Business`)
8. `ModifierOption` (depends on `Business`, `ModifierGroup`)
9. `MenuItemModifierGroup` (depends on `Business`, `MenuItem`, `ModifierGroup`)
10. `RestaurantOrder` (depends on `Business`, `Branch`, `TableSession?`, `RestaurantTable?`, `User?`)
11. `OrderRound` (depends on `Business`, `RestaurantOrder`, `User?`)
12. `OrderLine` (depends on `Business`, `RestaurantOrder`, `OrderRound`, `MenuItem`, `User?`)

**Crucial Acyclicity Invariant**:
- `TableSession` must NOT hold a foreign key to `RestaurantOrder` (e.g. `activeOrderId`). `RestaurantOrder` holds `tableSessionId` pointing to `TableSession`. If `TableSession` were to add a foreign key pointing back to `RestaurantOrder`, a **circular dependency cycle** would form, causing `backup-format.ts` line 17 to throw `"Backup schema has unsupported dependency cycle"` and bricking all backup/restore functionality.
- Therefore, the relation must remain strictly directional: `TableSession` has 1-to-many `orders RestaurantOrder[]`, and `RestaurantOrder` has `tableSessionId String?`.

### 2.3 Exact Assertion Impact on Existing Test Suites
- **`tests/recovery.integration.test.ts` Line 88**:
  ```ts
  expect(Object.keys(original.tables)).toHaveLength(48);
  ```
  *Current state*: 48 tenant models (Phase 0 + Phase 1 + Phase 2).  
  *Phase 3 impact*: 48 + 12 = **60 models**.  
  *Required change*: When Phase 3 models are migrated, `tests/recovery.integration.test.ts` Line 88 must be updated to expect `60` models. Otherwise, `node scripts/restro-env.mjs recovery-test` will fail assertion R1.
- **`scripts/rehearse-recovery.ts` Dynamics**:
  * Good news: `rehearse-recovery.ts` uses dynamic model resolution:
    ```ts
    check(`entity counts equal for all ${format.backupModels.length} models`, ...);
    ```
    It dynamically iterates through all models in `format.backupModels`. As long as all required fields have valid defaults or match generic types (`DateTime`, `String`, `Int`, `Decimal`, `Boolean`), rehearsal will automatically seed synthetic rows across all 60 models and execute 41/41 checks cleanly.
- **`schemaHash` Invalidation**:
  * Adding Phase 3 models will change the sha256 `schemaHash`. Any snapshot taken prior to Phase 3 cannot be restored into a Phase 3 database without schema migration identity verification, which is strictly enforced by design.

---

## 3. Invariants & State Machine Test Matrix

The core mission of Phase 3 testing is proving restaurant state machine invariants under normal and adversarial conditions.

### 3.1 Three-Dimensional Status Independence Matrix
Restaurant orders possess three completely independent operational dimensions:

```
[ Acceptance Lifecycle ]     [ Fulfillment Lifecycle ]       [ Settlement Lifecycle ]
       PENDING                        QUEUED                          UNPAID
          │                             │                                │
          ├───► ACCEPTED                ├───► PREPARING                  ├───► PARTIAL
          │                             │                                │
          └───► REJECTED (reason)       ├───► READY                      ├───► PAID
                                        │                                │
                                        ├───► SERVED                     └───► REFUNDED
                                        │
                                        └───► CANCELLED (reason)
```

#### Test Specifications:
| Test ID | Test Scenario | Preconditions | Action | Invariant Assertion |
|---|---|---|---|---|
| **INV-3D-1** | Paying an order does NOT mark food served | Order has lines in `fulfillmentStatus: "READY"`, `settlementStatus: "UNPAID"` | Cashier records full payment (`paidAmount == total`) | `settlementStatus` transitions to `"PAID"`. **`fulfillmentStatus` MUST REMAIN `"READY"`**. Lines must NOT transition to `"SERVED"`. |
| **INV-3D-2** | Delivering food does NOT settle order | Order has lines in `fulfillmentStatus: "READY"`, `settlementStatus: "UNPAID"` | Waiter marks order lines as served | `fulfillmentStatus` transitions to `"SERVED"`. **`settlementStatus` MUST REMAIN `"UNPAID"`**. `paidAmount` remains 0. |
| **INV-3D-3** | Upfront payment preserves kitchen queue | Order created with fast-casual upfront payment | Order created with immediate payment collection | `settlementStatus` is `"PAID"`. **`fulfillmentStatus` is `"QUEUED"`**. Kitchen sees unmade food. |
| **INV-3D-4** | Kitchen rejection does NOT auto-refund | Order is `"PAID"`, lines are `"QUEUED"` | Kitchen rejects line with reason `"86'd out of stock"` | Line `acceptanceStatus` is `"REJECTED"`, `fulfillmentStatus` is `"CANCELLED"`. **`settlementStatus` remains `"PAID"`** until an explicit refund/reversal transaction is executed. |
| **INV-3D-5** | Independent line status within same order | Order contains 2 lines: Line 1 (Appetizer), Line 2 (Entree) | Appetizer is served, Entree is cooking | Line 1 is `"SERVED"`, Line 2 is `"PREPARING"`. Aggregating status correctly derives partial fulfillment without flattening. |

---

### 3.2 Multi-Round Ordering Integrity Matrix
A dining party typically places orders in multiple rounds (Drinks -> Starters -> Mains -> Desserts).

#### Test Specifications:
| Test ID | Test Scenario | Preconditions | Action | Invariant Assertion |
|---|---|---|---|---|
| **INV-MR-1** | Round 2 submission preserves Round 1 items | Round 1 has 3 items submitted, status `"PREPARING"`, line total $45.00 | Staff submits Round 2 with 2 items, line total $60.00 | 1. Round 1 items, modifiers, prices ($45.00), notes, and statuses (`PREPARING`) remain completely intact.<br>2. Round 1 lines are NOT duplicated.<br>3. Round 2 lines are added under new `OrderRound(roundNumber: 2)`.<br>4. Cumulative order total = $105.00. |
| **INV-MR-2** | Staggered preparation across rounds | Round 1 items are in `fulfillmentStatus: "SERVED"` | Round 2 is submitted | Round 1 items remain `"SERVED"`. Round 2 items are `"QUEUED"`. Order header derives `"PARTIALLY_SERVED"`. |
| **INV-MR-3** | Round modifier immutability | Round 1 item has modifier "Medium Rare" (+$0.00) | Round 2 is submitted with item having modifier "Extra Cheese" (+$2.00) | Round 1 item's snapshot is unchanged. Round 2 modifier delta applies only to Round 2 item. |
| **INV-MR-4** | Multi-round billing formula | Order with $R$ submitted rounds | Calculate total bill | $\text{OrderTotal} \equiv \sum_{r=1}^R \sum_{l \in r, l.\text{active}} l.\text{total}$. Round line sum equals order header total. |

---

### 3.3 Atomic Table Move & Table Merge Matrix
Guests frequently request to move to a different table (e.g. from bar to booth, or indoors to terrace) or combine tables for larger parties.

#### Test Specifications:
| Test ID | Test Scenario | Preconditions | Action | Invariant Assertion |
|---|---|---|---|---|
| **INV-TM-1** | Atomic Table Move (Success) | Table A is `OCCUPIED` with Session $S_A$ (2 orders, 6 lines, $140.00). Table B is `AVAILABLE`. | Request `POST /api/v1/restaurant/tables/move` (from: A, to: B) | In a single atomic transaction:<br>1. Table A becomes `AVAILABLE`.<br>2. Table B becomes `OCCUPIED`.<br>3. Session $S_A$ `tableId` is updated to Table B.<br>4. All 2 orders and 6 lines remain linked to $S_A$ with zero line duplications and zero dropped lines. |
| **INV-TM-2** | Table Move Contention Rollback | Table A is `OCCUPIED`. Table B is concurrently occupied by another party during move. | Terminal attempts move Table A -> Table B | Transaction encounters conflict/validation failure. **Rolls back completely**; Table A remains `OCCUPIED` with $S_A$, Table B remains occupied with its own session. Zero orphan records. |
| **INV-TM-3** | Atomic Table Merge (Success) | Table A has Session $S_A$ (Guest count: 2, 1 order, $50.00). Table B has Session $S_B$ (Guest count: 3, 1 order, $75.00). | Request `POST /api/v1/restaurant/tables/merge` (primary: A, secondary: B) | In a single atomic transaction:<br>1. Orders from $S_B$ transfer cleanly to $S_A$.<br>2. Session $S_B$ transitions to `MERGED`.<br>3. Guest count of $S_A$ becomes $2 + 3 = 5$.<br>4. Total of $S_A$ becomes $50.00 + 75.00 = $125.00.<br>5. Table B references joined session or is marked occupied. |
| **INV-TM-4** | Merge with Unserved Lines | Both sessions have unserved items in kitchen (`QUEUED` / `PREPARING`) | Execute Table Merge | All active kitchen tickets/lines remain valid and linked to the active session. No kitchen lines are duplicated or cancelled. |

---

### 3.4 Mandatory Audit Logging Matrix
Hospitality staff must not be able to silently void items after they have been prepared or ordered.

#### Test Specifications:
| Test ID | Test Scenario | Preconditions | Action | Invariant Assertion |
|---|---|---|---|---|
| **INV-AL-1** | Void without reason fails closed | Active `OrderLine` in `RestaurantOrder` | Staff requests void with missing reason (`reason: ""` or whitespace) | **Rejects with HTTP 400 Bad Request** (`"Void reason is mandatory"`). Line status is NOT changed. |
| **INV-AL-2** | Rejection without reason fails closed | Kitchen receives line in `QUEUED` | Staff attempts rejection without reason | **Rejects with HTTP 400 Bad Request**. Line remains `QUEUED`. |
| **INV-AL-3** | Valid void produces immutable audit record | Active `OrderLine` | Staff requests void with reason `"Customer allergic to nuts"` | 1. Line transitions to `CANCELLED` / voided.<br>2. `AuditEvent` created with `action: "ORDER_LINE_VOIDED"`, `entity: "OrderLine"`, `reason: "Customer allergic to nuts"`, `userId`, `oldValue`, `newValue`. |
| **INV-AL-4** | Audit insertion failure rolls back void | Postgres trigger configured to simulate DB audit failure | Staff requests void with valid reason | Transaction throws exception. **OrderLine remains un-voided**. Zero partial mutations. |

---

### 3.5 Immutable Price Snapshotting Matrix
Menu prices and modifier costs change over time (e.g. inflation, happy hour expiration). Existing orders must never change price when catalog prices are edited.

#### Test Specifications:
| Test ID | Test Scenario | Preconditions | Action | Invariant Assertion |
|---|---|---|---|---|
| **INV-PS-1** | Menu item catalog price increase | `MenuItem` "Steak" base price is $25.00. Order line created for $25.00. | Manager updates `MenuItem` base price to $35.00 in catalog | Open order's `OrderLine` STILL has `itemBasePrice: 25.00`, `total: 25.00`. Order total remains unchanged. |
| **INV-PS-2** | Modifier option price delta increase | `ModifierOption` "Truffle Oil" is +$3.00. Order line created with Truffle Oil ($25 + $3 = $28). | Manager updates "Truffle Oil" delta to +$5.00 in catalog | Existing `OrderLine` STILL has `modifierTotal: 3.00`, `total: 28.00`. `appliedModifiers` JSON retains snapshot `[{ id, name: "Truffle Oil", priceDelta: "3.00" }]`. |
| **INV-PS-3** | Catalog item deletion (soft delete) | Item ordered in active session | Manager deletes `MenuItem` from catalog | Order line continues to display item name, price, and modifiers correctly on the guest bill and POS screen. |

---

## 4. Adversarial Concurrency & Edge Cases Matrix

### 4.1 Concurrent Terminal Operations on the Same TableSession
In a busy restaurant, two servers (or a server and a bartender) frequently tap the same table on different handheld terminals simultaneously.

#### Concurrency Scenarios & Assertions:
1. **Simultaneous Line Additions**:
   - Terminal 1 adds 1x "Margherita Pizza" ($15.00). Terminal 2 adds 1x "Draft Beer" ($6.00) at the identical millisecond.
   - *Harness Mechanism*: `Promise.all([terminal1.postOrderLines(), terminal2.postOrderLines()])` wrapped in interactive transactions with `serializable()` retries.
   - *Assertion*: Both succeed (one commits, second retries on `P2034` and commits). Exactly two lines created. Total bill increases by exactly $21.00 ($15.00 + $6.00). Zero lost updates.
   - *Witnessing*: Logs `RACE_CONNECTIONS` confirming `new Set(pids).size >= 2`.
2. **Simultaneous Move vs. Move Race**:
   - Terminal 1 requests: Move Table 4 -> Table 8. Terminal 2 requests: Move Table 4 -> Table 12.
   - *Assertion*: Exactly one request succeeds (HTTP 200/201). The second request encounters state conflict (Table 4 is no longer occupied or table session version mismatch) and fails with HTTP 409 Conflict. Table 4 session ends up on exactly one table.
3. **Simultaneous Add Line vs. Table Merge**:
   - Terminal 1 adds an item to Table 3. Terminal 2 executes Table Merge (Table 3 merged into Table 5).
   - *Assertion*: If Add commits first, Merge transfers all lines including the new item. If Merge commits first, Add targets the merged session or fails with 409 prompting refresh. Zero orphan or lost items.

---

### 4.2 Stale Writes & Optimistic Concurrency Failing Closed

1. **Stale Line Modification (Optimistic Locking)**:
   - Terminal 1 reads `OrderLine` at `version = 1`.
   - Waiter on Terminal 2 voids the line (line status becomes `CANCELLED`, `version` becomes 2).
   - Terminal 1 attempts to update modifiers or mark served sending expected `version: 1`.
   - *Assertion*: Server executes `UPDATE ... WHERE id = :id AND version = 1`. Row count is 0. Returns **HTTP 409 Conflict** (`"Stale write: order line has been modified"`).
2. **Stale Modification of Settled Order**:
   - Cashier on POS terminal settles order (Settlement: `PAID`).
   - Server on floor terminal attempts to submit an additional round or apply a discount to the settled order.
   - *Assertion*: Fails closed with **HTTP 409 Conflict** (`"Cannot modify a settled order"`).

---

### 4.3 Split-Billing Reconciliation & Zero Penny Drift

Split billing is notoriously vulnerable to fractional-penny drift and rounding errors.

#### 1. Itemized Split Billing:
- Order contains items $I_1, I_2, \dots, I_m$. Guests $G_1, \dots, G_k$ select mutually exclusive subsets of items.
- Invariant:
  $$\sum_{j=1}^k \text{GuestBill}(G_j) \equiv \text{GrandTotal}(\text{Order})$$
- Tax and discounts applied per-item or distributed proportionally using Banker's Rounding (`ROUND_HALF_EVEN`), with remainder cents allocated to the highest line total.

#### 2. Equal-Shares Split Billing (The Fractional Penny Algorithm):
When a bill of $T$ cents is split equally among $N$ guests:
$$\text{BaseCents} = \left\lfloor \frac{T}{N} \right\rfloor, \quad R = T \pmod N$$
- The first $R$ guests pay $\text{BaseCents} + 1$ cent.
- The remaining $N - R$ guests pay $\text{BaseCents}$.
- Zero Penny Drift Invariant:
  $$\sum_{i=1}^N \text{Share}_i = R \times (\text{Base} + 1) + (N - R) \times \text{Base} = N \times \text{Base} + R = T$$
  $$\text{Drift} \equiv \left| T - \sum_{i=1}^N \text{Share}_i \right| = 0.000000$$

#### Split-Billing Adversarial Test Matrix:

| Bill Total | Share Count ($N$) | Quotient ($T/N$) | Remainder ($R$) | Exact Share Breakdown | Drift Assertion |
|---|---|---|---|---|---|
| **$100.00** | 3 guests | 3333 cents | 1 cent | Guest 1: $33.34<br>Guest 2: $33.33<br>Guest 3: $33.33 | Sum = $100.00 (Drift = $0.00) |
| **$100.00** | 7 guests | 1428 cents | 4 cents | Guests 1–4: $14.29 each ($57.16)<br>Guests 5–7: $14.28 each ($42.84) | Sum = $100.00 (Drift = $0.00) |
| **$25.03** | 3 guests | 834 cents | 1 cent | Guest 1: $8.35<br>Guests 2–3: $8.34 each | Sum = $25.03 (Drift = $0.00) |
| **$333.33** | 11 guests | 3030 cents | 3 cents | Guests 1–3: $30.31 each ($90.93)<br>Guests 4–11: $30.30 each ($242.40) | Sum = $333.33 (Drift = $0.00) |
| **$10.01** | 13 guests | 77 cents | 0 cents | Guests 1–13: $0.77 each ($10.01) | Sum = $10.01 (Drift = $0.00) |

---

## 5. Test Architecture & Harness Design

### 5.1 Test Suite Organization in `tests/`

Three dedicated test suites should be structured to cover all Phase 3 requirements:

```
tests/
├── restaurant-invariants.integration.test.ts  # Real PostgreSQL state machine & invariant checks
├── restaurant-concurrency.integration.test.ts # Real PostgreSQL multi-connection race harness
└── restaurant-split-billing.test.ts           # Fast mathematical unit test suite for split logic
```

### 5.2 Test Harness Specifications

#### Suite 1: `tests/restaurant-invariants.integration.test.ts`
- **Runner**: Vitest with `describe.skipIf(!target)` pattern.
- **Connection**: Dedicated loopback PostgreSQL `127.0.0.1:55439`.
- **Isolation**: Each test runs with a unique synthetic tenant (`businessId = randomUUID()`) and isolated branches/users. Fixtures cleaned up in `afterAll` without affecting other tests.
- **Assertions**:
  1. 3D Status independence: UNPAID -> PAID does not change fulfillment; SERVED does not change UNPAID; upfront PAID starts in QUEUED.
  2. Multi-round ordering: Submitting Round 2 preserves Round 1 lines, modifiers, and line totals.
  3. Atomic Table Move: Table A -> Table B transfers session and orders atomically; rollback verified.
  4. Atomic Table Merge: Session A + Session B merges orders and combines guest counts.
  5. Mandatory Audit Logging: Voiding/rejecting without reason fails (HTTP 400); with reason creates `AuditEvent`; trigger failure rolls back void.
  6. Price Snapshotting: Catalog price updates do not mutate existing order lines.

#### Suite 2: `tests/restaurant-concurrency.integration.test.ts`
- **Runner**: Vitest with `db.$transaction` interactive transaction spy.
- **Race Witnessing**: Intercepts transactions to capture `pg_backend_pid()` and inject `pg_sleep(0.025)`.
- **Assertions**:
  1. Concurrent line addition: 2 simultaneous requests create 2 lines with cumulative totals; `new Set(pids).size >= 2`.
  2. Concurrent table move contention: 2 terminals move Table A to different targets; exactly 1 succeeds, 1 receives 409.
  3. Stale line modification: Writing to an edited/voided line fails with 409.
  4. Stale write to settled order: Modifying paid order fails with 409.

#### Suite 3: `tests/restaurant-split-billing.test.ts`
- **Runner**: Vitest (pure TypeScript, zero DB dependency for extreme speed).
- **Assertions**:
  1. 10,000 randomized split bills across prime denominators ($N = 2, 3, 5, 7, 11, 13, 17, 19$) asserting:
     ```ts
     expect(splits.reduce((acc, s) => acc.add(s), new Prisma.Decimal(0)).equals(billTotal)).toBe(true);
     ```
  2. Itemized split line assignment and tax reconciliation.
  3. Partial split payments transitions (`UNPAID` -> `PARTIAL` -> `PAID`).

### 5.3 Script Additions in `scripts/`
- Create `scripts/run-restaurant-tests.mjs`:
  ```js
  import { spawnSync } from "node:child_process";
  import { isolatedDatabaseUrl } from "./database-verification.mjs";
  const target = isolatedDatabaseUrl(process.env.TEST_DATABASE_URL);
  const result = spawnSync(process.execPath, [
    "node_modules/vitest/vitest.mjs", "run",
    "tests/restaurant-invariants.integration.test.ts",
    "tests/restaurant-concurrency.integration.test.ts",
    "tests/restaurant-split-billing.test.ts"
  ], { env: { ...process.env, RESTRO_REQUIRE_DATABASE_TESTS: "true" }, stdio: "inherit" });
  process.exit(result.status ?? 1);
  ```
- Add to `scripts/restro-env.mjs` command dispatcher:
  `"restaurant-test": ["node", ["scripts/run-restaurant-tests.mjs"]]`

---

## 6. Implementation Readiness & Risk Matrix

| Risk Dimension | Severity | Mitigating Strategy / Test Enforcement |
|---|---|---|
| **Circular Foreign Keys in Prisma** | CRITICAL | Strictly enforce 1-way relation `RestaurantOrder.tableSessionId -> TableSession`. Never add reverse FK on `TableSession`. Test with `backup-format.ts:schemaHash`. |
| **Recovery Test Hardcoded Assertion** | HIGH | Update `tests/recovery.integration.test.ts:88` from `48` to `60` models immediately following migration. |
| **Float Precision in Pricing** | HIGH | All pricing fields in Phase 3 models must use `@db.Decimal(12, 2)` or `@db.Decimal(12, 4)`. Test with `decimal-math.ts`. |
| **Concurrency Lost Updates on Orders** | HIGH | Wrap session and order mutations in `serializable()` with retry on Prisma `P2034` or row-level versioning checks. |
| **Drift in Split-Billing** | MEDIUM | Enforce integer remainder allocation algorithm in cents; assert zero penny drift across all splits. |

---
*Report certified by Tester Concurrency & Invariants Explorer (`tester_survey_2`).*
