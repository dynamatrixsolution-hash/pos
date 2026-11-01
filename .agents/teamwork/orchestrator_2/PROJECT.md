# Project: RestroInn Hospitality Staff POS — Phase 3: Restaurant Staff MVP (Dine-in, Tables, Menus & Orders)

## Architecture

- **Domain Entity & Data Model Architecture**:
  - 12 new multi-tenant Prisma models under `packages/db/prisma/schema.prisma`:
    * Layout & Tables: `Floor`, `RestaurantTable`, `TableSession`.
    * Menu Catalog: `Menu`, `MenuSection`, `MenuItem`, `ModifierGroup`, `ModifierOption`, `MenuItemModifierGroup`.
    * Orders & Lifecycles: `RestaurantOrder`, `OrderRound`, `OrderLine`.
  - Multi-tenant isolation enforced via composite `businessId` keys (`@@unique([businessId, id])`, index on `[businessId, ...]`).
  - Strict acyclic dependency DAG: `RestaurantTable.currentSessionId` is stored as a scalar `String?` without an explicit `@relation` to `TableSession`. This preserves full compatibility with the disaster recovery engine (`backend/src/lib/backup-format.ts`), preventing relation cycles and ensuring seamless topological sorting across all 60 tenant models.

- **Three-Dimensional (3D) Decoupled Status Lifecycles**:
  - Independent, orthogonal state lifecycles tracked on both `RestaurantOrder` and `OrderLine`:
    * **Acceptance**: `PENDING` -> `ACCEPTED` -> `REJECTED` (Rejections require mandatory staff reason & immutable `AuditEvent`).
    * **Fulfillment**: `QUEUED` -> `PREPARING` -> `READY` -> `SERVED` -> `CANCELLED` (Voids/cancellations require mandatory staff reason & immutable `AuditEvent`).
    * **Settlement**: `UNPAID` -> `PARTIAL` -> `PAID` -> `REFUNDED`.
  - **Cardinal Invariant**: Settlement (`PAID`) never marks food `SERVED`. Transitioning settlement status leaves kitchen fulfillment status intact.

- **Multi-Round Ordering & Immutable Financial Snapshots**:
  - Orders accumulate through discrete rounds (`OrderRound` 1, 2, 3...) representing waves of food/drinks (e.g., drinks first, appetizers, mains, desserts).
  - Submitting a new round strictly preserves all items, line statuses, and modifier selections from prior rounds.
  - Price immutability: When an order line is submitted, base price, applied modifier options/deltas (as JSON), tax rate, tax amount, and line notes are snapshotted immutably into `OrderLine`. Subsequent edits in the menu catalog never alter historical accounting or existing tickets.

- **Atomic Table Move & Table Merge Mechanics**:
  - Executed within PostgreSQL `Serializable` transactions via `serializable()`.
  - Moving Table A -> Table B transfers the active `TableSession` reference to Table B atomically, clearing Table A and marking Table B `Occupied`.
  - Merging Table A into Table B re-parents all `RestaurantOrder` records to Table B's active session and marks Table A's session as `MERGED` or re-associates lines cleanly with zero line item duplication or loss.

- **Concurrency & Versioning**:
  - Optimistic Concurrency Control (OCC) using `version: Int @default(1)` on `TableSession`, `RestaurantOrder`, and `OrderLine`.
  - Stale writes against settled (`PAID`) or voided (`CANCELLED`/`REJECTED`) lines fail closed with HTTP 409 Conflict.

- **Hospitality Staff UI/UX Ergonomics (`.agent/skill/uiuxskills.md`)**:
  - Designed for high-speed touch terminals: 65% Catalog / 35% Order Cart layout budget.
  - Interactive Floor Grid: Multi-floor switcher, occupancy badge color isolation (Available: Forest `#28634B`, Occupied: Slate Blue `#315F85`, Reserved: Ochre `#946000`, Billed: Plum `#6F3668`), turn timers (>75m, >90m warning), quick action modals.
  - Compact POS Menu Grid: Quick-switching category pill bar, ~110px card height, dietary badges, fast tap-to-add.
  - Touch-Friendly Modifier Modal: Min/max validation, dynamic Decimal price deltas (`+Rs. 150.00`, `-Rs. 50.00`, `+$0.00 Included`) using `frontend/src/lib/currency.ts`, preset instruction chips.
  - Split-Billing Sheet: Dual-mode (By Item and By Equal Shares), real-time unallocated balance tracker, penny-perfect minor-unit reconciliation.

- **Scope Boundary Isolation**:
  - Strictly Phase 3 Staff MVP. Hardware ESC/POS printing (`PrintJob`), live Kitchen Display System (KDS) stations, and inventory recipe consumption (`RecipeVersion`, `ConsumptionPosting`) are deferred to Phase 4.

---

## Feature Inventory

Every feature from requirements and surveys is cataloged below with its assigned milestone:

| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Floor & Table Prisma Models | Define `Floor` and `RestaurantTable` in `schema.prisma` with composite `businessId` keys | M1 | Survey (Planner) |
| 2 | TableSession & Session Status Models | Define `TableSession` with occupancy statuses (`Available`, `Occupied`, `Reserved`, `Billed`) | M1 | Survey (Planner) |
| 3 | Menu & MenuSection Catalog Models | Define `Menu` and `MenuSection` with display order and status | M1 | Survey (Planner) |
| 4 | MenuItem & Modifier Models | Define `MenuItem`, `ModifierGroup`, `ModifierOption`, `MenuItemModifierGroup` with Decimal deltas | M1 | Survey (Planner) |
| 5 | RestaurantOrder & OrderLine Models | Define `RestaurantOrder`, `OrderRound`, `OrderLine` with 3D status enums and versioning | M1 | Survey (Planner) |
| 6 | Acyclic Topological DAG & Backup Format | Ensure acyclic relation graph for `backup-format.ts`; update `tests/recovery.integration.test.ts:88` (48 -> 60 models) | M1 | Survey (Planner, Tester) |
| 7 | Additive Migration Script | Generate additive migration `202611010001_phase3_restaurant_staff_mvp` | M1 | Survey (Planner) |
| 8 | Floor & Table Management Services | Implement backend services for floor layouts and table seating capacities | M2 | Requirements R1 |
| 9 | Floor & Table REST APIs | Implement `/api/v1/restaurant/floors` and `/api/v1/restaurant/tables` endpoints | M2 | Requirements R1 |
| 10 | Active TableSession Lifecycle | Implement session open, guest count tracking, and session close/settlement | M2 | Requirements R1 |
| 11 | Atomic Table Move Transaction | Implement `/api/v1/restaurant/tables/move` transferring session without duplicating lines | M2 | Requirements R1 |
| 12 | Atomic Table Merge Transaction | Implement `/api/v1/restaurant/tables/merge` combining sessions without line duplication | M2 | Requirements R1 |
| 13 | Menu & Section Management Services & APIs | Implement `/api/v1/restaurant/menus` and `/api/v1/restaurant/menu-sections` | M3 | Requirements R2 |
| 14 | MenuItem Management Services & APIs | Implement `/api/v1/restaurant/menu-items` with base price and category assignments | M3 | Requirements R2 |
| 15 | Modifier Catalog & Decimal Deltas | Implement modifier groups and options with Decimal(12, 2) price deltas | M3 | Requirements R2 |
| 16 | Modifier Group Assignments | Implement min/max selection rules and `MenuItemModifierGroup` associations | M3 | Requirements R2 |
| 17 | Multi-Round Order Creation & Submission | Implement `/api/v1/restaurant/orders` and round submission preserving prior rounds | M4 | Requirements R3 |
| 18 | Immutable OrderLine Snapshotting | Snapshot base price, modifier deltas JSON, tax, and notes immutably on submit | M4 | Requirements R3 |
| 19 | Three-Dimensional Status State Machine | Implement independent Acceptance, Fulfillment, and Settlement lifecycle transitions | M4 | Requirements R3 |
| 20 | Cardinal Invariant Enforcement | Enforce that payment (`PAID`) never marks food `SERVED` | M4 | Requirements R3 |
| 21 | Mandatory Void/Rejection Audit Trail | Enforce mandatory staff reason and `AuditEvent` logging for line voids and rejections | M4 | Requirements R3 |
| 22 | Optimistic Concurrency & Fail-Closed Guards | Implement version checks on order/session mutations; fail closed on stale writes | M4 | Requirements R5 |
| 23 | Interactive Floor Grid Component | Implement floor plan grid with occupancy badges, turn timers, and quick action modals | M5 | Requirements R4 |
| 24 | Compact POS Menu Grid Component | Implement category quick-switching pill bar, ~110px card height, and fast tap-to-add | M5 | Requirements R4 |
| 25 | Touch-Friendly Modifier Selection Modal | Implement modifier modal with dynamic price delta calculations and min/max validation | M5 | Requirements R4 |
| 26 | Split-Billing Sheet Component | Implement By Item and By Equal Shares splitting with penny-perfect reconciliation | M5 | Requirements R4 |
| 27 | 3D Status Visuals & VoidLineModal | Implement visual status chips and mandatory staff reason void modal | M5 | Requirements R4 |
| 28 | Restaurant Staff Dashboard Route | Assemble hospitality POS interface under `frontend/src/app/dashboard/restaurant/` | M5 | Requirements R4 |
| 29 | Adversarial Concurrency Test Suite | Implement `tests/restaurant-concurrency.integration.test.ts` with PostgreSQL PID witnessing | M6 | Requirements R5 |
| 30 | State Machine & Invariant Test Suite | Implement `tests/restaurant-invariants.integration.test.ts` verifying 3D independence & preservation | M6 | Requirements R3, R5 |
| 31 | Split-Billing Penny Reconciliation Tests | Implement stress test verifying zero penny drift across all prime guest counts | M6 | Requirements R4 |
| 32 | Recovery & Backup Integration Tests | Verify `scripts/restro-env.mjs recovery-test` and `rehearse` with 60 models | M6 | Requirements R5 |
| 33 | Monorepo Builds & Documentation | Verify typecheck, builds, and update `docs/hospitality/phases/PHASE_3_RESTAURANT_MVP.md` | M6 | Requirements R5 |

---

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| **M1** | Core Schema Additions & Additive Migration | 12 Prisma models in `schema.prisma`; scalar `RestaurantTable.currentSessionId`; additive migration; `tests/recovery.integration.test.ts:88` update (48 -> 60 models); typecheck & baseline tests | none | DONE |
| **M2** | Floor, Table & TableSession Management Services & APIs | Floor & Table services/routes; table occupancy status lifecycle; active `TableSession`; atomic move & merge in serializable transactions | M1 | IN_PROGRESS |
| **M3** | Restaurant Menu & Modifier Catalog Services & APIs | Menu, Section, MenuItem, ModifierGroup, ModifierOption services & routes; Decimal price deltas; min/max modifier constraints | M1 | PLANNED |
| **M4** | Multi-Round Orders, 3D Status Lifecycles & Snapshotting | Order creation, round accumulation, immutable price/modifier snapshots, independent 3D status state machine, mandatory void reasons & `AuditEvent` logging, OCC versioning | M1, M2, M3 | PLANNED |
| **M5** | Hospitality Staff POS UI/UX Components & Pages | Interactive floor grid, compact menu grid, touch modifier modal with live price deltas, split-billing sheet with penny reconciliation, void modal, `/dashboard/restaurant/` page | M1, M2, M3, M4 | PLANNED |
| **M6** | Adversarial Hardening, Reconciliation & Phase 3 Docs | `tests/restaurant-concurrency.integration.test.ts`, `tests/restaurant-invariants.integration.test.ts`, container test suite verification (127.0.0.1:55439), full recovery & rehearse pass, production builds, and documentation update | M1, M2, M3, M4, M5 | PLANNED |

---

## Interface Contracts

### 1. Table & Session Management (`backend/src/lib/services/table-session-service.ts`)
```ts
export interface OpenSessionParams {
  businessId: string;
  branchId: string;
  tableId: string;
  guestCount: number;
  serverStaffId?: string;
  notes?: string;
}

export interface MoveTableParams {
  businessId: string;
  sourceTableId: string;
  targetTableId: string;
  actorId: string;
}

export interface MergeTableParams {
  businessId: string;
  sourceTableIds: string[];
  targetTableId: string;
  actorId: string;
}

export async function openTableSession(tx: Prisma.TransactionClient, params: OpenSessionParams): Promise<TableSession>;
export async function moveTableSession(tx: Prisma.TransactionClient, params: MoveTableParams): Promise<{ sourceTable: RestaurantTable; targetTable: RestaurantTable; session: TableSession }>;
export async function mergeTableSessions(tx: Prisma.TransactionClient, params: MergeTableParams): Promise<{ targetSession: TableSession; mergedSessionIds: string[] }>;
export async function closeTableSession(tx: Prisma.TransactionClient, businessId: string, sessionId: string, actorId: string): Promise<TableSession>;
```

### 2. Menu & Modifier Catalog Service (`backend/src/lib/services/restaurant-catalog-service.ts`)
```ts
export interface CreateMenuItemParams {
  businessId: string;
  sectionId: string;
  name: string;
  code?: string;
  basePrice: Prisma.Decimal;
  taxRate?: Prisma.Decimal;
  isKitchenItem?: boolean;
  modifierGroupIds?: { groupId: string; minSelections: number; maxSelections: number }[];
}

export interface CreateModifierOptionParams {
  businessId: string;
  groupId: string;
  name: string;
  priceDelta: Prisma.Decimal; // Signed: positive, zero, or negative
  isDefault?: boolean;
}
```

### 3. Multi-Round Orders & 3D Status Engine (`backend/src/lib/services/restaurant-order-service.ts`)
```ts
export interface SubmitOrderRoundParams {
  businessId: string;
  tableSessionId: string;
  orderId?: string; // If null, creates new RestaurantOrder
  roundNumber: number;
  notes?: string;
  lines: {
    menuItemId: string;
    quantity: number;
    notes?: string;
    selectedOptions: { optionId: string; groupId: string; name: string; priceDelta: Prisma.Decimal }[];
  }[];
  actorId: string;
}

export interface TransitionStatusParams {
  businessId: string;
  orderId: string;
  lineId?: string;
  dimension: "acceptance" | "fulfillment" | "settlement";
  targetStatus: string;
  reason?: string; // Mandatory for REJECTED and CANCELLED
  actorId: string;
}

export interface SplitBillingParams {
  businessId: string;
  orderId: string;
  splitType: "BY_ITEM" | "EQUAL_SHARES";
  guestCount?: number;
  itemSplits?: { lineId: string; targetBillIndex: number }[];
}

export async function submitOrderRound(tx: Prisma.TransactionClient, params: SubmitOrderRoundParams): Promise<{ order: RestaurantOrder; round: OrderRound; lines: OrderLine[] }>;
export async function transitionOrderStatus(tx: Prisma.TransactionClient, params: TransitionStatusParams): Promise<RestaurantOrder | OrderLine>;
export async function voidOrderLine(tx: Prisma.TransactionClient, businessId: string, lineId: string, reason: string, actorId: string): Promise<OrderLine>;
```

### 4. Split-Billing Minor-Unit Engine (`frontend/src/lib/hospitality-split.ts`)
```ts
export interface EqualSplitShare {
  guestIndex: number;
  cents: number;
  formatted: string;
}

export function calculateEqualSplits(totalCents: number, guestCount: number): EqualSplitShare[];
```

---

## Code Layout

- **Prisma Schema**: `packages/db/prisma/schema.prisma`
- **Additive Migration**: `packages/db/prisma/migrations/202611010001_phase3_restaurant_staff_mvp/migration.sql`
- **Backend Services**:
  - `backend/src/lib/services/table-session-service.ts`
  - `backend/src/lib/services/restaurant-catalog-service.ts`
  - `backend/src/lib/services/restaurant-order-service.ts`
- **Backend Routes**:
  - `backend/src/app/api/v1/restaurant/floors/route.ts`
  - `backend/src/app/api/v1/restaurant/tables/route.ts`
  - `backend/src/app/api/v1/restaurant/tables/move/route.ts`
  - `backend/src/app/api/v1/restaurant/tables/merge/route.ts`
  - `backend/src/app/api/v1/restaurant/sessions/route.ts`
  - `backend/src/app/api/v1/restaurant/menus/route.ts`
  - `backend/src/app/api/v1/restaurant/menu-sections/route.ts`
  - `backend/src/app/api/v1/restaurant/menu-items/route.ts`
  - `backend/src/app/api/v1/restaurant/modifier-groups/route.ts`
  - `backend/src/app/api/v1/restaurant/orders/route.ts`
  - `backend/src/app/api/v1/restaurant/orders/[id]/route.ts`
  - `backend/src/app/api/v1/restaurant/orders/[id]/rounds/route.ts`
  - `backend/src/app/api/v1/restaurant/orders/[id]/status/route.ts`
  - `backend/src/app/api/v1/restaurant/orders/[id]/lines/[lineId]/void/route.ts`
  - `backend/src/app/api/v1/restaurant/orders/[id]/split/route.ts`
- **Disaster Recovery**:
  - `backend/src/lib/backup-format.ts`
  - `tests/recovery.integration.test.ts`
- **Frontend Components & Pages**:
  - `frontend/src/lib/hospitality-split.ts`
  - `frontend/src/components/hospitality/floor-grid.tsx`
  - `frontend/src/components/hospitality/menu-grid.tsx`
  - `frontend/src/components/hospitality/modifier-modal.tsx`
  - `frontend/src/components/hospitality/split-billing-sheet.tsx`
  - `frontend/src/components/hospitality/void-line-modal.tsx`
  - `frontend/src/app/dashboard/restaurant/page.tsx`
- **Adversarial & Invariant Test Suites**:
  - `tests/restaurant-invariants.integration.test.ts`
  - `tests/restaurant-concurrency.integration.test.ts`
  - `tests/restaurant-split-billing.test.ts`
