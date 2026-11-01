# Phase 4: Production Kitchen, Recipes & Kitchen Display System (KDS)

> **Status**: Completed & Verified.
> **Dependencies**: Phase 3 and Transactional Outbox from Phase 2.

## 1. Objectives & Scope
- Route ordered items to dedicated kitchen preparation stations (Hot Kitchen, Cold Pantry, Bar/Bakery).
- Deliver real-time Kitchen Display System (KDS) web views with line-level progress tracking and touch status advances.
- Generate and print physical Kitchen Order Tickets (KOT) via ESC/POS outbox events.
- Implement recipe bill-of-materials (BOM) with automatic ingredient stock consumption and waste tracking.

---

## 2. Key Entities & Schema Additions
Added 7 multi-tenant domain models to `packages/db/prisma/schema.prisma` with composite `@@unique([businessId, id])` keys and acyclic DAG design for disaster recovery:
1. `KitchenStation`: Preparation area in a branch (e.g. Hot Kitchen, Cold Pantry, Bar, Bakery) with name, code, printer IP/config, and display order.
2. `StationRoute`: Mapping between `MenuItem` or `Category` and target `KitchenStation`.
3. `KitchenTicket`: Station-specific ticket generated for each `OrderRound` with `ticketNumber`, `stationId`, `orderId`, `roundId`, `status: QUEUED | PREPARING | READY | SERVED | CANCELLED`, and `revisionNumber`.
4. `KitchenTicketLine`: Line items assigned to a ticket with preparation status, notes, allergens, and applied modifiers.
5. `RecipeVersion`: Versioned ingredient definition for a `MenuItem` (`isActive: true`, version number, yield).
6. `RecipeIngredient`: Quantity and unit of raw inventory `Product` consumed per dish with `@db.Decimal(12, 4)` precision.
7. `ConsumptionPosting`: Append-only inventory deduction triggered upon cooking confirmation (`READY`), linking directly to Phase 2's authoritative `StockMovement` ledger.

---

## 3. Strict Rules & Invariants Enforced
- **Multi-Station Routing**: Multi-station orders produce separate station tickets (e.g., Pizza to Hot Oven, Mojito to Bar).
- **Idempotent Ticket Generation**: Each order round routes exactly once per target station (`@@unique([businessId, roundId, stationId])`); printer retries or reconnects increment `revisionNumber` without duplicating logical tickets.
- **Dietary & Allergen Alert Highlighting**: Notes with keywords (e.g., "GLUTEN FREE", "NO NUTS", "VEGAN") are parsed and snapshotted in `dietaryAlerts`.
- **Automatic Ingredient Stock Deduction**: Marking a ticket or line as `READY` automatically triggers `deductRecipeIngredientsForTicketLine`, creating signed negative `StockMovement` entries and linking `ConsumptionPosting`.
- **Pre-Prep vs Post-Prep Cancellation**: Cancellation *before* preparation releases reservations; cancellation *after* preparation commences marks the item as `isWaste: true` and logs kitchen waste.
- **Order Settlement Separation**: Order payment or settlement never alters kitchen ticket or preparation fulfillment status.

---

## 4. Implemented Services & Endpoints
- **Domain Services**:
  - `backend/src/lib/services/kitchen-routing-service.ts`: `createKitchenStation`, `getKitchenStations`, `createStationRoute`, `routeOrderRoundToStations`, `advanceTicketStatus`, `advanceTicketLineStatus`, `getLiveKDSTickets`.
  - `backend/src/lib/services/recipe-consumption-service.ts`: `createRecipeVersion`, `getActiveRecipe`, `deductRecipeIngredientsForTicketLine`.
- **REST Endpoints**:
  - `GET, POST /api/v1/restaurant/kitchen-stations`
  - `GET, POST /api/v1/restaurant/kitchen-tickets`
  - `PATCH /api/v1/restaurant/kitchen-tickets/[id]/status`
  - `GET, POST /api/v1/restaurant/recipes`
- **UI/UX (KDS Terminal)**:
  - `frontend/src/app/dashboard/restaurant/kds/page.tsx`: High-contrast 3-meter legibility view, station filter tabs, live elapsed timers (Normal $\rightarrow$ Ochre $\rightarrow$ Urgent Red), allergen flags, one-tap status advances.
  - Sidebar navigation updated in `frontend/src/lib/nav-config.ts` linking to Kitchen Display (KDS).

---

## 5. Verification Evidence

| Test Suite / Command | Scope | Result |
| :--- | :--- | :---: |
| `tests/phase4-kitchen-kds.integration.test.ts` | Multi-station routing, idempotent ticket generation, dietary alerts, auto ingredient stock deduction on READY, post-prep waste tracking | **5/5 PASSED** |
| `tests/restaurant-mvp.integration.test.ts` | Table sessions, atomic move/merge, multi-round orders, 3D status decoupling | **8/8 PASSED** |
| `tests/phase1-security.integration.test.ts` | Multi-tenant composite keys, tenant isolation, audit logging | **14/14 PASSED** |
| `tests/financial-lifecycle.integration.test.ts` | Payment allocations, reversals, refunds, stock ledger movements | **5/5 PASSED** |
| `npm test` | All unit & invariant test suites | **106 PASSED** |
| `scripts/restro-restore-env.mjs rehearse` | 67-model disaster recovery rehearsal, topological sort, tenant isolation | **41/41 PASSED** |
| `npm run typecheck` | Cross-workspace strict TypeScript typecheck | **0 ERRORS** |
| `node scripts/restro-env.mjs backend-build` | Next.js 16 backend production build (70 routes) | **SUCCESS** |
| `node scripts/restro-env.mjs frontend-build` | Next.js 16 frontend production build (67 routes) | **SUCCESS** |
