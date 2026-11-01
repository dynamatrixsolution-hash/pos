## 2026-11-01T03:39:33Z
You are the Planner Architecture Explorer for Phase 3: Restaurant Staff MVP (Dine-in, Tables, Menus & Orders).

Working Directory: c:\projects\pos\.agents\teamwork\planner_survey_2
Authoritative Original Request: c:\projects\pos\.agents\teamwork\ORIGINAL_REQUEST.md
Specification Documents:
- docs/hospitality/phases/PHASE_3_RESTAURANT_MVP.md
- docs/hospitality/IMPLEMENTATION_PLAN.md
Existing Codebase References:
- packages/db/prisma/schema.prisma
- packages/db/
- backend/

Your Mission:
Map the complete architectural, schema, and invariant requirements for Phase 3:
1. Floor & Dining Table Management:
   - Floor and RestaurantTable entities, occupancy statuses (Available, Occupied, Reserved, Billed), seating capacities.
   - Active TableSession tracking dining parties, orders, and lifecycle transitions.
   - Atomic Table Move & Table Merge mechanics (transferring open sessions without duplicating line items or dropping state).
2. Restaurant Menu & Modifier Catalog:
   - Hierarchical catalog: Menu, MenuSection, MenuItem, ModifierGroup, ModifierOption, MenuItemModifierGroup.
   - Pricing with Decimal deltas (e.g. +$1.50 for oat milk, -$0.50 for half portion).
   - Immutable snapshotting of base price, applied modifier options/deltas, tax, and notes into OrderLine upon submission.
3. Multi-Round Orders & Three-Dimensional Status Lifecycles:
   - OrderRound model and accumulation of rounds (Round 1, Round 2...) preserving previous rounds.
   - Three independent status lifecycles:
     * Acceptance: PENDING -> ACCEPTED -> REJECTED (mandatory staff reason and audit trail on rejections/voids).
     * Fulfillment: QUEUED -> PREPARING -> READY -> SERVED -> CANCELLED.
     * Settlement: UNPAID -> PARTIAL -> PAID -> REFUNDED.
     * Invariant: Paying for an order NEVER marks food served.
4. Concurrency & Tenant Isolation:
   - Multi-tenant composite keys (`businessId` in primary and foreign keys).
   - Optimistic concurrency control / versioning on TableSession and RestaurantOrder.
   - Stale writes against settled/voided lines fail closed.
   - Backup/recovery topology compatibility (`backup-format.ts`).
5. Scope Boundaries:
   - Strict Phase 3 MVP boundary (defer KDS routing/printing and recipe consumption to Phase 4).

Execution Rules:
- You are read-only; DO NOT modify or create any source code or test files.
- Maintain progress in c:\projects\pos\.agents\teamwork\planner_survey_2\progress.md.
- Write your comprehensive architectural report to c:\projects\pos\.agents\teamwork\planner_survey_2\planner_survey_report.md.
- Write your structured 5-component handoff to c:\projects\pos\.agents\teamwork\planner_survey_2\handoff.md.
- Notify the orchestrator upon completion via send_message.
