# DISPATCH — Orchestrator 1 (Phase 3 Restaurant Staff MVP)

## 2026-11-01T03:23:27Z

Organize work using the specialized 4-agent roles requested by the user:
- Planner: Architecture & Invariants (Table/Order State Machine Lifecycles, 3D status separation, table sessions, rounds).
- Designer: Refined Hospitality UI/UX per `.agent/skill/uiuxskills.md` (Floor grid, table occupancy badges, touch-friendly modifier modal with price deltas, compact menu grid, split-billing sheet).
- Builder: Full-Stack Engineer per `.agent/skill/stack.md` (Next.js 16, React 19, Prisma schema, additive migrations, Decimal pricing deltas).
- Tester: Adversarial Concurrency, State Machine Invariants, Multi-Round Order Integrity, and Reconciliation.
Implement Phase 3: Restaurant Staff MVP (Dine-in, Tables, Menus & Orders) for production as specified in `docs/hospitality/phases/PHASE_3_RESTAURANT_MVP.md` and `docs/hospitality/IMPLEMENTATION_PLAN.md`.

Working directory: c:\projects\pos
Integrity mode: development

## Requirements

### R1. Floor & Table Management
Provide floor plans and dining table entities with occupancy status (Available, Occupied, Reserved, Billed) and seating capacity. Support active table sessions that track dining parties and accumulate orders, with atomic table move and table merge operations that transfer open sessions without duplicating lines.

### R2. Restaurant Menu & Modifier Catalog
Implement a hierarchical catalog with menus, sections, items, modifier groups, and options with Decimal price deltas. Ensure order lines snapshot base prices, applied modifiers, tax, and notes immutably upon order submission.

### R3. Multi-Round Orders & Three-Dimensional Status Separation
Implement restaurant orders supporting multiple rounds (e.g., drinks, appetizers, mains), preserving all items and states from earlier rounds when submitting subsequent rounds. Enforce independent three-dimensional status lifecycles:
- Acceptance: PENDING -> ACCEPTED -> REJECTED (rejections/voids require mandatory staff reason and audit record).
- Fulfillment: QUEUED -> PREPARING -> READY -> SERVED -> CANCELLED.
- Settlement: UNPAID -> PARTIAL -> PAID -> REFUNDED.
Enforce the invariant that paying for an order does not mark food served.

### R4. Hospitality Staff POS UI/UX
Implement refined hospitality staff UI/UX per `.agent/skill/uiuxskills.md`, including an interactive floor grid with table occupancy badges, a compact POS menu item grid with category quick-switching, a touch-friendly modifier selection modal with instant price delta calculations, and a split-billing sheet supporting itemized splitting and equal shares.

### R5. Concurrency, Tenant Isolation, Scope & Documentation
Maintain strict multi-tenant isolation using composite businessId keys and compatibility with the disaster recovery backup topology. Ensure concurrent order or session updates across terminals handle versioning gracefully, failing closed on stale writes to settled or voided lines. Restrict scope strictly to Phase 3 Restaurant Staff MVP, deferring KDS routing/printing and recipe consumption to Phase 4. Update `docs/hospitality/phases/PHASE_3_RESTAURANT_MVP.md` to document implemented schema additions, rules, and exit criteria status.

## Verification Resources
- Isolated PostgreSQL container on 127.0.0.1:55439.
- Monorepo typecheck: `npm.cmd run typecheck`.
- Full test suites: `npm.cmd test`, `node scripts/restro-env.mjs recovery-test`, `node scripts/restro-restore-env.mjs rehearse`.
- Production builds: `node scripts/restro-env.mjs backend-build` and `node scripts/restro-env.mjs frontend-build`.

## Acceptance Criteria

### Core Schema & State Invariants
- [ ] Schema additions for Floor, RestaurantTable, TableSession, Menu, MenuSection, MenuItem, ModifierGroup, ModifierOption, MenuItemModifierGroup, RestaurantOrder, OrderLine, and OrderRound are defined with Decimal pricing deltas and multi-tenant composite keys.
- [ ] Three-dimensional status lifecycles (Acceptance, Fulfillment, Settlement) operate independently; paying for an order does not transition lines to SERVED.
- [ ] Moving or merging tables transfers open sessions atomically without duplicating line items.
- [ ] Submitting Round 2 preserves all items and states from Round 1.
- [ ] Voiding or rejecting order lines requires a mandatory staff reason and preserves audit history.

### User Interface & Ergonomics
- [ ] Interactive floor grid displays real-time occupancy status (Available, Occupied, Reserved, Billed).
- [ ] Touch-friendly modifier selection modal displays and updates price deltas.
- [ ] Compact menu grid enables category quick-switching.
- [ ] Split-billing sheet supports splitting by item and by equal shares.

### Automated Testing & System Verification
- [ ] Concurrent terminal operations on the same table session handle version conflicts gracefully without state corruption.
- [ ] Stale writes against settled or voided lines fail closed.
- [ ] `npm.cmd run typecheck` passes with exit code 0.
- [ ] `npm.cmd test`, `node scripts/restro-env.mjs recovery-test`, and `node scripts/restro-restore-env.mjs rehearse` all pass with zero regressions.
- [ ] `node scripts/restro-env.mjs backend-build` and `node scripts/restro-env.mjs frontend-build` succeed with 0 errors.

### Documentation
- [ ] `docs/hospitality/phases/PHASE_3_RESTAURANT_MVP.md` is updated with completed implementation details and verification results.
