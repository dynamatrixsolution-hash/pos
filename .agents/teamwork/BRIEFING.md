# BRIEFING — 2026-11-01T05:18:00Z

## Mission
Coordinate and monitor Phase 5: Hotel Inventory, Rooms & Guest Stays execution via teamwork_orchestrator.

## 🔒 My Identity
- Archetype: sentinel
- Working directory: c:\projects\pos\.agents\teamwork
- Orchestrator: 35cca4ca-b4fa-46c8-b9ea-1c5b07e1cb84
- Victory Auditor: to be spawned on victory claim

## 🔒 Key Constraints
- No technical decisions — relay only
- Victory Audit is MANDATORY before reporting completion
- Organize work using the specialized 4-agent roles requested by the user: Planner (Architecture & Invariants), Designer (UI/UX per .agent/skill/uiuxskills.md), Builder (Full-Stack Engineer per .agent/skill/stack.md), and Tester (Adversarial Security, Concurrency & Financial Reconciliation).
- Implement Phase 2: Financial & Inventory Core Hardening for production as specified in docs/hospitality/phases/PHASE_2_FINANCIAL_INVENTORY_CORE.md and docs/hospitality/IMPLEMENTATION_PLAN.md.
- Replace Float monetary fields with explicit Decimal across prices, totals, payments, ledger balances, and tax amounts with standardized rounding.
- Introduce PaymentAllocation, PaymentReversal, and Refund models. Disallow hard deletion of payments and finalized invoices.
- Implement an append-only StockMovement ledger capturing signed quantity, unit, batch, source event, and actor, reconciling against ProductStock projections.
- Introduce OutboxEvent for reliable asynchronous event dispatch committed atomically with state mutations.
- Protect against race conditions using serializable transactions, ensuring concurrent sales cannot violate configured negative-stock limits.
- Adapt existing frontend components and forms to support Decimal migration and new payment APIs without introducing new dedicated UI screens.
- Run adversarial race tests and financial reconciliation tests on the isolated test container (127.0.0.1:55439).
- Verify npm.cmd run typecheck, unit tests, and recovery tests pass with zero regressions.
- Update documentation in docs/hospitality/phases/PHASE_2_FINANCIAL_INVENTORY_CORE.md.
- Implement Phase 3: Restaurant Staff MVP (Dine-in, Tables, Menus & Orders) for production per docs/hospitality/phases/PHASE_3_RESTAURANT_MVP.md and docs/hospitality/IMPLEMENTATION_PLAN.md.
- Entities: Floor, RestaurantTable, TableSession, Menu, MenuSection, MenuItem, ModifierGroup, ModifierOption, MenuItemModifierGroup, RestaurantOrder, OrderLine, OrderRound.
- Enforce independent 3D status lifecycles: Acceptance (PENDING -> ACCEPTED -> REJECTED), Fulfillment (QUEUED -> PREPARING -> READY -> SERVED -> CANCELLED), Settlement (UNPAID -> PARTIAL -> PAID -> REFUNDED). Paying for an order does not mark food served.
- Atomic table move and merge operations without duplicating lines.
- Submitting Round 2 preserves all items and states from Round 1.
- Mandatory staff reason and audit record for voiding or rejecting order lines.
- Refined hospitality UI/UX per .agent/skill/uiuxskills.md: interactive floor grid, touch-friendly modifier selection modal with instant price delta calculations, compact menu grid with category quick-switching, split-billing sheet (itemized and equal shares).
- Maintain multi-tenant isolation (composite businessId keys) and disaster recovery backup topology compatibility.
- Ensure concurrent updates across terminals handle versioning gracefully, failing closed on stale writes. Restrict scope strictly to Phase 3.
- Phase 5: Hotel Inventory, Rooms & Guest Stays implementation per docs/hospitality/phases/PHASE_5_HOTEL_STAYS_ROOMS.md.
- Multi-tenant Prisma models: RoomType, Room, Reservation, ReservationGuest, Stay, RoomAllocation, HousekeepingTask, MaintenanceTicket with strict @@unique([businessId, id]).
- Additive Prisma migrations applied to both database clusters: 55439 (test) and 55440 (restore). Maintain acyclic DAG topology in backup-format.ts.
- Domain services: Room availability calendar, Reservation, Check-in (atomic allocation lock, stay record, room status change), Room transfer, Check-out (releases occupancy, marks VACANT_DIRTY, creates HousekeepingTask), Housekeeping & Maintenance.
- Hotel API endpoints under backend/src/app/api/v1/hotel/.
- Hotel UI/UX: Interactive Room Rack / Tape Chart matrix with RestroInn tokens, Fast Check-in modal, and sidebar navigation.
- Comprehensive integration testing: double-booking race condition checks, room transfer atomicity, check-out housekeeping triggers.
- Verification gates: npm test passes, npm run typecheck passes with 0 errors, disaster recovery rehearsal passes, production builds succeed.

## Routing Decision
- Path: General (`teamwork_orchestrator`)
- Rationale: Multi-stage SWE feature across schema, backend services, API endpoints, UI/UX, and disaster recovery.

## User Context
- **Last user request**: "complete this phase fast ok hope u achive all the milestone properly". Prioritize speed and parallel execution across M2, M3, and M4 per PROJECT.md interface contracts.
- **Pending clarifications**: none.
- **Delivered results**: Interview conducted, prompt approved, orchestrator launched. Phase 0 Survey complete (PROJECT.md synthesized with 27-item inventory). Milestone 1 implementation complete (8 models, dual-cluster migration applied, 41/41 DR rehearsal pass on 75 models, 20/20 challenger tests pass). Gate 1 verification active. Relayed speed/parallelism directive to orchestrator.

## Project Status
- **Phase**: in progress (Milestone 1 Gate Verification: Reviewers, Challengers, Forensic Auditor active)
- **Active Orchestrator**: 35cca4ca-b4fa-46c8-b9ea-1c5b07e1cb84 (directory: c:\projects\pos\.agents\teamwork\orchestrator_phase5\)
- **Cron 1 (Progress Reporting)**: Task task-24 (*/8 * * * *)
- **Cron 2 (Liveness Check)**: Task task-25 (*/10 * * * *)

## Victory Audit Status
- **Triggered**: no
- **Verdict**: pending
- **Retry count**: 0

## Artifact Index
- c:\projects\pos\.agents\teamwork\ORIGINAL_REQUEST.md — Authoritative record of user requirements
- c:\projects\pos\PROJECT.md — Authoritative project scope, 27-item feature inventory & milestone decomposition
