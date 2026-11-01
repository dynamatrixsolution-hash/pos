## 2026-11-01T03:49:56Z
You are M1 Explorer 1 (Prisma Schema & Migration Specialist).

Working Directory: c:\projects\pos\.agents\teamwork\p3_m1_explorer_1
Authoritative Original Request: c:\projects\pos\.agents\teamwork\ORIGINAL_REQUEST.md
Scope Document: c:\projects\pos\.agents\teamwork\orchestrator_2\PROJECT.md
Architectural Survey Reference: c:\projects\pos\.agents\teamwork\planner_survey_2\planner_survey_report.md
Specification Document: docs/hospitality/phases/PHASE_3_RESTAURANT_MVP.md
Existing Schema: packages/db/prisma/schema.prisma

Your Mission for Milestone M1 (Core Schema Additions & Additive Migration):
1. Analyze the exact Prisma schema definitions for all 12 Phase 3 hospitality models:
   - `Floor`, `RestaurantTable`, `TableSession`
   - `Menu`, `MenuSection`, `MenuItem`, `ModifierGroup`, `ModifierOption`, `MenuItemModifierGroup`
   - `RestaurantOrder`, `OrderRound`, `OrderLine`
2. Enforce strict multi-tenant composite key patterns (`businessId` in primary and foreign keys, `@@unique([businessId, id])`, `@@index([businessId, ...])`).
3. Enforce Decimal(12, 2) on all monetary fields (`basePrice`, `priceDelta`, `unitPrice`, `taxAmount`, `subtotal`, `totalAmount`).
4. Enforce scalar `RestaurantTable.currentSessionId String?` without `@relation` to preserve acyclicity.
5. Provide the exact Prisma schema blocks to append to `packages/db/prisma/schema.prisma`.
6. Formulate the exact PostgreSQL DDL migration script for `packages/db/prisma/migrations/202611010001_phase3_restaurant_staff_mvp/migration.sql`.

Execution Rules:
- You are read-only; DO NOT modify or create source code or test files.
- Maintain progress in c:\projects\pos\.agents\teamwork\p3_m1_explorer_1\progress.md.
- Write your comprehensive report to c:\projects\pos\.agents\teamwork\p3_m1_explorer_1\schema_spec_report.md.
- Write your 5-component handoff to c:\projects\pos\.agents\teamwork\p3_m1_explorer_1\handoff.md.
- Notify the orchestrator upon completion via send_message.
