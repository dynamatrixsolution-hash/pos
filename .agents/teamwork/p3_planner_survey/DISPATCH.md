## 2026-11-01T03:25:29Z

You are the Planner Spec Miner for Phase 3 Restaurant Staff MVP.

MANDATORY FIRST STEP: Read the authoritative original request at:
c:\projects\pos\.agents\teamwork\ORIGINAL_REQUEST.md

Your role: Planner (Architecture & Invariants)
Your working directory: c:\projects\pos\.agents\teamwork\p3_planner_survey\
Do all your writing ONLY within your working directory.

Scope & Objectives:
Investigate authoritative sources:
1. docs/hospitality/phases/PHASE_3_RESTAURANT_MVP.md
2. docs/hospitality/IMPLEMENTATION_PLAN.md
3. Existing codebase: Prisma schema (search in packages/db or packages/api), existing models, multi-tenant composite keys (businessId), migrations.
4. Existing services or patterns for orders, sessions, and payments.

Specifically analyze and document:
- Required Prisma models and relationships:
  * Floor, RestaurantTable, TableSession
  * Menu, MenuSection, MenuItem, ModifierGroup, ModifierOption, MenuItemModifierGroup
  * RestaurantOrder, OrderLine, OrderRound
  * Multi-tenant isolation (composite keys with businessId)
  * Decimal fields and precision for pricing, modifier deltas, taxes, totals
- State Machine Lifecycles:
  * Table occupancy status: Available, Occupied, Reserved, Billed
  * TableSession lifecycle & party tracking
  * Atomic table move and table merge logic (transfer open sessions without duplicating lines)
  * Multi-round orders (Round 2 preserves Round 1 items/state)
  * 3D status separation:
    - Acceptance: PENDING -> ACCEPTED -> REJECTED (mandatory staff reason and audit record)
    - Fulfillment: QUEUED -> PREPARING -> READY -> SERVED -> CANCELLED
    - Settlement: UNPAID -> PARTIAL -> PAID -> REFUNDED
    - Core Invariant: Paying for an order does NOT mark food served
  * Snapshotting base prices, modifiers, tax, notes immutably on order submission
- Out of scope boundaries: Defer KDS routing/printing and recipe consumption to Phase 4.

Constraints:
- You are read-only! DO NOT modify any application source code.
- Write your findings to `c:\projects\pos\.agents\teamwork\p3_planner_survey\planner_survey_report.md` and complete a structured `handoff.md`.
- When finished, send a message to the orchestrator with a summary and link to your report.
