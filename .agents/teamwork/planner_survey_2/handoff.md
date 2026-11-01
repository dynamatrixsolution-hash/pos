# Phase 3 Architecture & Invariants Survey Handoff Report

**Author**: Planner (Architecture & Invariants Specialist)  
**Working Directory**: `c:\projects\pos\.agents\teamwork\planner_survey_2`  
**Milestone**: Phase 3 — Restaurant Staff MVP (Dine-in, Tables, Menus & Orders)  
**Date**: 2026-11-01  
**Handoff Type**: Hard Handoff (Task Complete)  

---

## 1. Observation

Direct investigation of the codebase, schemas, migrations, scripts, and documentation yielded the following empirical facts:

1. **Authoritative Specification Directives** (`docs/hospitality/phases/PHASE_3_RESTAURANT_MVP.md`, lines 12-30; `docs/hospitality/IMPLEMENTATION_PLAN.md`, lines 101-113, 150-151):
   - Key entities specified: `Floor`, `RestaurantTable`, `TableSession`, `Menu`, `MenuSection`, `MenuItem`, `ModifierGroup`, `ModifierOption`, `MenuItemModifierGroup`, `RestaurantOrder`, `OrderLine`, `OrderRound`.
   - Core strict invariant: "Paying for an order does not mark food served."
   - Three independent lifecycles: Acceptance (`PENDING` -> `ACCEPTED` -> `REJECTED`), Fulfillment (`QUEUED` -> `PREPARING` -> `READY` -> `SERVED` -> `CANCELLED`), Settlement (`UNPAID` -> `PARTIAL` -> `PAID` -> `REFUNDED`).
   - Atomic table moves and merges must transfer open sessions without duplicating lines.
   - Deferral: Kitchen station routing, thermal printing (`PrintJob`), and recipe consumption are strictly deferred to Phase 4.

2. **Existing Multi-Tenant Composite Key Pattern** (`packages/db/prisma/schema.prisma` lines 950-1085):
   - Models (`AuditEvent`, `PaymentAllocation`, `PaymentReversal`, `Refund`, `StockMovement`, `OutboxEvent`) all enforce `businessId String`, `@@unique([businessId, id])`, and index on `[businessId, ...]`.
   - Primary and foreign relations reference the target entity's `id` field directly (`fields: [relationId], references: [id]`).

3. **Backup Engine Topological Dependency Sort Constraint** (`backend/src/lib/backup-format.ts` lines 12-19, 81-86):
   - Lines 12-19:
     ```ts
     const models = Prisma.dmmf.datamodel.models.filter(model => !excludedModels.includes(model.name));
     export const backupModels: typeof models = [];
     const pending = [...models];
     while (pending.length) {
       const index = pending.findIndex(model => model.fields.filter(field => field.relationFromFields?.length).every(field => backupModels.some(parent => parent.name === field.type)));
       if (index < 0) throw new Error("Backup schema has unsupported dependency cycle");
       backupModels.push(pending.splice(index, 1)[0]);
     }
     ```
   - Line 83:
     ```ts
     if (field.relationFromFields!.length !== 1 || field.relationToFields?.[0] !== "id") throw new BackupError("Unsupported composite backup relation");
     ```
   - Line 58:
     ```ts
     if ((model.name === "Business" && row.id !== businessId) || ("businessId" in row && row.businessId !== businessId)) throw new BackupError("Cross-tenant snapshot row");
     ```
   - Crucial constraint: If `RestaurantTable` defines an explicit Prisma relation to `TableSession` AND `TableSession` defines a relation to `RestaurantTable`, the dependency graph has a cycle ($index < 0$), throwing `throw new Error("Backup schema has unsupported dependency cycle")` at module load time!

4. **Existing Decimal Math Standards** (`backend/src/lib/services/decimal-math.ts` lines 38-92):
   - Provides exact banker's rounding (`roundHalfEven`, mode 6) to 2 decimal places (`money()`) and 4 decimal places (`stockQty()`).
   - Arithmetical operations (`addMoney`, `subMoney`, `mulMoney`, `divMoney`) enforce exact decimal calculations, rejecting floating point binary representation drift.

5. **Existing Audit Trail Service** (`backend/src/lib/audit-event.ts` lines 4-72):
   - `createAuditEvent` records append-only `AuditEvent` with sanitization of sensitive fields (`sanitizeAuditData`).
   - When passed transaction client `tx`, failure to write the audit record guarantees transaction rollback.

6. **Current Codebase Health**:
   - `npm test`: Exits 0, passing 85 unit tests across 9 test suites (41 integration tests skipped pending PostgreSQL container).
   - `npm run typecheck`: Exits 0, zero compilation errors across `backend` and `frontend`.

---

## 2. Logic Chain

```
[Observation 1.1] Specifications mandate 12 hospitality entities, 3D status separation, table moves/merges,
                  multi-round ordering, and immutable snapshotting.
       │
       ▼
[Step 1] In hospitality, tables host evolving sessions over hours with multiple waves of food and drinks.
       To support this:
       - `Floor` and `RestaurantTable` model the physical layout.
       - `TableSession` tracks dining parties, guest counts, and order accumulation.
       - Table moves and merges repoint `tableSessionId` atomically inside serializable transactions,
         guaranteeing zero line duplication or item loss.
       │
       ▼
[Observation 1.3] `backup-format.ts` sorts models topologically and throws on any relation cycle.
       │
       ▼
[Step 2] If `RestaurantTable` has `currentSessionId` pointing via `@relation` to `TableSession`,
       and `TableSession` has `tableId` pointing via `@relation` to `RestaurantTable`,
       a circular dependency is formed, immediately crashing the backup engine.
       Therefore, `TableSession` holds the authoritative foreign key `tableId -> RestaurantTable.id`,
       while `RestaurantTable.currentSessionId` must remain a scalar `String?` (without `@relation`).
       This ensures the model dependency graph is a strictly acyclic DAG:
       Business -> Branch -> Floor -> RestaurantTable -> TableSession -> RestaurantOrder -> OrderRound -> OrderLine.
       │
       ▼
[Observation 1.4] Decimal pricing deltas (e.g. +$1.50, -$0.50) must be supported.
       │
       ▼
[Step 3] `ModifierOption.priceDelta` must be stored as `Decimal @default(0) @db.Decimal(12, 2)`.
       Unit price calculation applies `roundHalfEven(max(0, basePrice + sum(deltas)), 2)`.
       To prevent subsequent menu edits from altering historical accounting or receipts,
       `OrderLine` must snapshot basePrice, modifiers array (as JSON), unitPrice, taxRate, taxAmount,
       subtotal, and total immutably upon round submission.
       │
       ▼
[Observation 1.1 & 1.5] Cardinal Invariant: "Paying for an order does not mark food served."
                        Rejections and voids require mandatory reason and audit record.
       │
       ▼
[Step 4] Acceptance, Fulfillment, and Settlement must be modeled as three independent status columns on
       both `RestaurantOrder` and `OrderLine`:
       - Acceptance: PENDING -> ACCEPTED -> REJECTED
       - Fulfillment: QUEUED -> PREPARING -> READY -> SERVED -> CANCELLED
       - Settlement: UNPAID -> PARTIAL -> PAID -> REFUNDED
       Payment allocation transitions settlement status (e.g. UNPAID -> PAID) but NEVER mutates
       fulfillment status (READY remains READY).
       Transitioning to REJECTED or CANCELLED validates non-empty reason and calls `createAuditEvent(..., tx)`.
       │
       ▼
[Observation 1.2 & 1.6] Multi-tenant isolation and OCC versioning.
       │
       ▼
[Step 5] `TableSession`, `RestaurantOrder`, and `OrderLine` incorporate `version Int @default(1)`.
       Mutations apply conditional updates (`where: { id, businessId, version }`).
       Stale writes against settled (`PAID`) or voided (`CANCELLED`/`REJECTED`) lines fail closed with 409.
```

---

## 3. Caveats

1. **Physical Printing & KDS Hardware Routing (Phase 4)**:
   While `MenuItem.isKitchenItem` allows simple food vs drink routing flags, full physical ESC/POS thermal printing queues (`PrintJob`) and real-time Kitchen Display System (KDS) stations are out-of-scope for Phase 3 and must be deferred to Phase 4.
2. **Recipe & Inventory Ingredient Depletion (Phase 4)**:
   In Phase 3, `MenuItem.productId` provides an optional reference to retail products for basic sales tracking. Automatic recipe yield conversions, BOM deductions, and raw ingredient waste posting (`RecipeVersion`, `ConsumptionPosting`) belong to Phase 4.
3. **Hotel Folio Charges (Phase 5/6)**:
   Phase 3 table orders are settled via cash, card, or split billing directly at the restaurant. Posting a restaurant check onto a hotel room folio (`GuestFolio`) is an explicit Phase 6 milestone.
4. **Guest QR Ordering (Phase 7)**:
   Table QR codes for self-ordering by guests without staff assistance are deferred to Phase 7. Phase 3 focuses exclusively on staff-facing POS terminals.

---

## 4. Conclusion

Phase 3 Restaurant Staff MVP architectural design is completely mapped and verified against existing codebase standards. 

Key architectural deliverables in `planner_survey_report.md`:
1. **12 Prisma Models**: `Floor`, `RestaurantTable`, `TableSession`, `Menu`, `MenuSection`, `MenuItem`, `ModifierGroup`, `ModifierOption`, `MenuItemModifierGroup`, `RestaurantOrder`, `OrderRound`, `OrderLine`.
2. **Strict Acyclic Dependency Topology**: Formulated to eliminate relation cycles and pass `backup-format.ts` validation out of the box.
3. **Decoupled 3D Lifecycle State Machine**: Full formal proof and state matrix demonstrating that settlement (`PAID`) never mutates fulfillment (`SERVED`).
4. **Atomic Table Move & Merge Transactions**: Fully defined algorithms that repoint sessions without duplicating lines or dropping unserved items.
5. **Immutable Snapshotting & Signed Pricing Deltas**: Decimal pricing precision using banker's rounding and JSON modifier snapshots.
6. **Optimistic Concurrency Control**: Multi-terminal safety via version checking and fail-closed stale write guards.

---

## 5. Verification Method

To independently verify the findings and architectural integrity:

1. **Verify Baseline Test Suite**:
   ```powershell
   npm test
   ```
   *Expected Result*: All 85 unit tests pass with 0 errors.

2. **Verify Monorepo Typecheck**:
   ```powershell
   npm run typecheck
   ```
   *Expected Result*: Exits 0 with zero TypeScript errors across `backend` and `frontend`.

3. **Verify Disaster Recovery Topological Compatibility**:
   Inspect `backend/src/lib/backup-format.ts` lines 12-19. Confirm that no Phase 3 model introduces bidirectional `@relation` foreign keys. Ensure `RestaurantTable.currentSessionId` remains a scalar `String?` without `@relation`.

4. **Verify Comprehensive Survey Report**:
   Inspect `c:\projects\pos\.agents\teamwork\planner_survey_2\planner_survey_report.md` for complete schema specifications, state transition tables, and atomic move/merge algorithms.
