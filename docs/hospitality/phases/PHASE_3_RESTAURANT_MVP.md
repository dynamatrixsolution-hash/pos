# Phase 3: Restaurant Staff MVP (Dine-in, Tables, Menus & Orders)

> **Status**: Completed & Verified.
> **Dependencies**: Phase 1 & Phase 2 (Completed & Verified).

## 1. Objectives & Scope
- Enable dining-room table management, floor plans, and active table sessions.
- Introduce restaurant menus, sections, items, and modifier groups (e.g. cooking temperature, toppings, sides) with Decimal price deltas.
- Separate order creation, kitchen acceptance, line fulfillment, and settlement into independent lifecycles.
- Support table orders with multiple rounds (drinks round, appetizer round, mains round), strictly preserving all earlier rounds.
- Provide touch-friendly staff UI/UX: interactive floor grid, table occupancy badges, touch-friendly modifier selection modal, and split-billing sheet.

---

## 2. Key Entities & Schema Additions
Added 12 multi-tenant domain models to `packages/db/prisma/schema.prisma` with composite `@@unique([businessId, id])` keys and acyclic DAG design for disaster recovery:
1. `Floor`: Physical dining area with branch linkage and display order.
2. `RestaurantTable`: Table identity with seating capacity and occupancy status (`AVAILABLE`, `OCCUPIED`, `RESERVED`, `BILLED`).
3. `TableSession`: Active dining session tracking seated party, guest count, and accumulating orders.
4. `Menu`: Multi-tenant menu catalog with availability hours and branch override.
5. `MenuSection`: Sections within a menu (e.g. Appetizers, Mains, Grills, Beverages).
6. `MenuItem`: Dishes/beverages with `@db.Decimal(12, 2)` base pricing and tax rates.
7. `ModifierGroup`: Option groupings with min/max selection bounds.
8. `ModifierOption`: Specific modifier choices with `@db.Decimal(12, 2)` price deltas.
9. `MenuItemModifierGroup`: Many-to-many join linking items to customizable modifier groups.
10. `RestaurantOrder`: Order header tracking table sessions, tables, and independent 3D statuses.
11. `OrderRound`: Group of items submitted together as a distinct preparation round.
12. `OrderLine`: Line items snapshotting base price, applied modifier deltas, tax, and notes immutably.

---

## 3. Strict Rules & Invariants Enforced
- **Three-Dimensional Status Separation**:
  - Acceptance: `PENDING` $\rightarrow$ `ACCEPTED` $\rightarrow$ `REJECTED` (requires mandatory rejection reason and audit log).
  - Fulfillment: `QUEUED` $\rightarrow$ `PREPARING` $\rightarrow$ `READY` $\rightarrow$ `SERVED` $\rightarrow$ `CANCELLED`.
  - Settlement: `UNPAID` $\rightarrow$ `PARTIAL` $\rightarrow$ `PAID` $\rightarrow$ `REFUNDED`.
- **Payment Invariant**: Settling an order (status `PAID`) does **never** modify fulfillment status (food does not become `SERVED` upon payment).
- **Audit Logging**: Rejecting or voiding an order line requires a mandatory staff reason and records an append-only `AuditEvent`.
- **Atomic Table Transfers**: Moving or merging table sessions executes in `Serializable` database transactions, transferring all orders without duplicate lines or orphaned records.
- **Optimistic Concurrency Control (OCC)**: `version` fields fail closed on stale writes.

---

## 4. Implemented Services & Endpoints
- **Domain Services**:
  - `backend/src/lib/services/table-session-service.ts`: `openTableSession`, `moveTableSession`, `mergeTableSessions`, `closeTableSession`.
  - `backend/src/lib/services/menu-catalog-service.ts`: `createMenu`, `createMenuSection`, `createMenuItem`, `createModifierGroup`, `getStaffMenuCatalog`.
  - `backend/src/lib/services/restaurant-order-service.ts`: `createOrAppendOrder`, `updateLineStatus`.
- **REST Endpoints**:
  - `GET, POST /api/v1/restaurant/floors`
  - `GET, POST /api/v1/restaurant/tables`
  - `POST /api/v1/restaurant/tables/[id]/move`
  - `POST /api/v1/restaurant/tables/[id]/merge`
  - `GET, POST /api/v1/restaurant/sessions`
  - `POST /api/v1/restaurant/sessions/[id]/close`
  - `GET, POST /api/v1/restaurant/menus`
  - `GET, POST /api/v1/restaurant/orders`
  - `PATCH /api/v1/restaurant/orders/[id]/lines/[lineId]/status`

---

## 5. UI/UX Ergonomics (RestroInn Design System)
- **Floor Management** (`frontend/src/app/dashboard/restaurant/tables/page.tsx`):
  - Floor tab switching with occupancy count badges.
  - Interactive table cards with semantic occupancy tokens (`AVAILABLE`: Forest `#28634B`, `OCCUPIED`: Ochre `#946000`, `BILLED` / `RESERVED`: Blue `#315F85`).
  - Seat party dialog, move table modal, merge table modal.
- **Touch Staff POS** (`frontend/src/app/dashboard/restaurant/pos/page.tsx`):
  - Table switcher and live order header.
  - Categorized menu item grid with instant modifier detection.
  - Multi-round preparation tracker showing submitted rounds (Round 1, Round 2) alongside draft Round $N+1$.
- **Modifier Selection Modal** (`frontend/src/components/restaurant/modifier-modal.tsx`):
  - Touch-friendly modifier selection with real-time Decimal price delta calculation.
  - Enforces min/max selection bounds before allowing item addition.
- **Split-Billing Sheet** (`frontend/src/components/restaurant/split-bill-sheet.tsx`):
  - Equal split across $N$ guests with remainder-cent distribution (exact zero drift).
  - Itemized split assigning dishes to individual guests.

---

## 6. Verification Evidence

| Test Suite / Command | Scope | Result |
| :--- | :--- | :---: |
| `tests/restaurant-mvp.integration.test.ts` | Table sessions, atomic move/merge, multi-round orders, 3D status decoupling, OCC stale-write rejection | **8/8 PASSED** |
| `tests/phase1-security.integration.test.ts` | Multi-tenant composite keys, tenant isolation, audit logging | **14/14 PASSED** |
| `tests/financial-lifecycle.integration.test.ts` | Payment allocations, reversals, refunds, stock ledger movements | **5/5 PASSED** |
| `npm test` | All unit & invariant test suites | **106 PASSED** |
| `scripts/restro-restore-env.mjs rehearse` | 60-model disaster recovery rehearsal, topological sort, tenant isolation | **41/41 PASSED** |
| `npm run typecheck` | Cross-workspace strict TypeScript typecheck | **0 ERRORS** |
| `node scripts/restro-env.mjs backend-build` | Next.js 16 backend production build (65 routes) | **SUCCESS** |
| `node scripts/restro-env.mjs frontend-build` | Next.js 16 frontend production build (66 routes) | **SUCCESS** |
