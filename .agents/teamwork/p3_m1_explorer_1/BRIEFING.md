# BRIEFING — 2026-11-01T03:53:00Z

## Mission
Analyze, specify, and formulate the exact Prisma schema definitions and PostgreSQL DDL migration script for all 12 Phase 3 restaurant hospitality models in Milestone M1.

## 🔒 My Identity
- Archetype: Specification Miner / Prisma Schema & Migration Specialist
- Roles: Schema Analysis, Database Modeling, PostgreSQL DDL Migration Formulation
- Working directory: c:\projects\pos\.agents\teamwork\p3_m1_explorer_1
- Original parent: 98f60f04-06d4-493d-9df7-9f604839d4bc
- Milestone: Milestone M1 (Core Schema Additions & Additive Migration)

## 🔒 Key Constraints
- Read-only on source code and test files (do NOT modify `packages/db/prisma/schema.prisma` directly).
- Strictly enforce multi-tenant composite key patterns (`businessId` in primary and foreign keys, `@@unique([businessId, id])`, `@@index([businessId, ...])`).
- Enforce `Decimal(12, 2)` on all monetary fields (`basePrice`, `priceDelta`, `unitPrice`, `taxAmount`, `subtotal`, `totalAmount`).
- Enforce scalar `RestaurantTable.currentSessionId String?` without `@relation` to preserve acyclicity.
- Provide exact Prisma schema blocks to append.
- Formulate exact PostgreSQL DDL migration script for `packages/db/prisma/migrations/202611010001_phase3_restaurant_staff_mvp/migration.sql`.

## Current Parent
- Conversation ID: 98f60f04-06d4-493d-9df7-9f604839d4bc
- Updated: 2026-11-01T03:53:00Z

## Task Summary
- **What to build**: Complete specification and DDL migration for 12 hospitality models: `Floor`, `RestaurantTable`, `TableSession`, `Menu`, `MenuSection`, `MenuItem`, `ModifierGroup`, `ModifierOption`, `MenuItemModifierGroup`, `RestaurantOrder`, `OrderRound`, `OrderLine`.
- **Success criteria**: Strict multi-tenant isolation, acyclic schema graph, exact Prisma types, composite foreign keys referencing composite unique keys `(businessId, id)`, exact matching SQL DDL migration.
- **Interface contracts**: `docs/hospitality/phases/PHASE_3_RESTAURANT_MVP.md`, `packages/db/prisma/schema.prisma`.
- **Code layout**: `packages/db/prisma/schema.prisma`, `packages/db/prisma/migrations/202611010001_phase3_restaurant_staff_mvp/migration.sql`.

## Key Decisions Made
- `RestaurantTable.currentSessionId`: Modeled as scalar `String?` without `@relation` to ensure acyclicity in `backup-format.ts` topological DAG.
- Prisma relations use single-column foreign keys (`[fieldId] -> [id]`) to satisfy `backup-format.ts:83`, with multi-tenant composite uniqueness (`@@unique([businessId, id])`).
- PostgreSQL migration script adds native composite foreign keys (`FOREIGN KEY ("businessId", "<fieldId>") REFERENCES "<Parent>"("businessId", "id")`) for database-level multi-tenant isolation.
- All monetary fields typed as `Decimal(12, 2)` in Prisma and `DECIMAL(12, 2) NOT NULL` in PostgreSQL.
- Model count in `tests/recovery.integration.test.ts:88` documented to increase from 48 to 60.

## Artifact Index
- `schema_spec_report.md` — Comprehensive schema specification, model breakdowns, Prisma blocks, and DDL script.
- `handoff.md` — 5-component handoff report.
- `progress.md` — Task progress and heartbeat tracking.
- `DISPATCH.md` — Inbound instructions archive.
